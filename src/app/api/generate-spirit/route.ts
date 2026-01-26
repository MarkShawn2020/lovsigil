import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { EnvServer } from '@/libs/EnvServer'
import { supabaseAdmin, supabaseServer } from '@/libs/SupabaseServer'
import { buildLannaGroupSpiritPrompt, buildLannaSpiritPrompt, generateImage, generateImageWithMultipleRefs } from '@/libs/ZenMux'

// Get authenticated user from cookies (optional - not required for generation)
async function getAuthUser() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      EnvServer.NEXT_PUBLIC_SUPABASE_URL || '',
      EnvServer.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
        },
      },
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }
  catch {
    return null
  }
}

// 上传 base64 图片到 Storage，返回公开 URL
async function uploadImageToStorage(base64Data: string, spiritId: string): Promise<string> {
  const supabase = supabaseAdmin || supabaseServer

  // 解析 base64 数据
  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!matches) {
    throw new Error('Invalid base64 image format')
  }

  const ext = matches[1]!
  const base64 = matches[2]!
  const buffer = Buffer.from(base64, 'base64')

  // 生成唯一文件名
  const fileName = `${spiritId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  // 上传到 Storage
  const { error } = await supabase.storage
    .from('spirit-images')
    .upload(fileName, buffer, {
      contentType: `image/${ext}`,
      upsert: false,
    })

  if (error) throw error

  // 返回公开 URL
  return `${EnvServer.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/spirit-images/${fileName}`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { spirit, userPhoto, spiritScores, group, orderId, generationOptions } = body

    // 多人合像模式
    if (group && Array.isArray(group.persons) && group.persons.length >= 2) {
      return handleGroupGeneration(group, orderId, generationOptions)
    }

    // 单人模式
    if (!spirit) {
      return NextResponse.json(
        { error: 'Missing spirit data' },
        { status: 400 },
      )
    }

    // If orderId provided, update existing order status to 'generating'
    if (orderId) {
      await supabaseServer
        .from('spirit_generations')
        .update({ status: 'generating' })
        .eq('order_id', orderId)
    }

    // 构建生成 prompt，带风格修饰符
    const prompt = buildLannaSpiritPrompt({
      spiritName: spirit.name,
      spiritNameEn: spirit.nameEn,
      element: spirit.element,
      traits: spirit.traits,
      basePrompt: spirit.imagePrompt,
      hasReferenceImage: !!userPhoto,
      styleModifier: generationOptions?.stylePromptModifier,
    })

    try {
      // 调用 ZenMux 生成图像（传入用户头像作为参考，以及图片配置）
      const generatedImageBase64 = await generateImage(prompt, userPhoto || undefined, {
        aspectRatio: generationOptions?.aspectRatio,
      })

      // 上传生成的图片到 Storage
      const imageUrl = await uploadImageToStorage(generatedImageBase64, spirit.id)

      // 构建 metadata 存储生成选项
      const metadata = {
        style: generationOptions?.style,
        aspectRatio: generationOptions?.aspectRatio,
      }

      if (orderId) {
        // Update existing order with result
        await supabaseServer
          .from('spirit_generations')
          .update({
            generated_image: imageUrl,
            prompt,
            status: 'completed',
            metadata,
          })
          .eq('order_id', orderId)
      } else {
        // Create new record (legacy mode)
        const user = await getAuthUser()
        await supabaseServer.from('spirit_generations').insert({
          spirit_id: spirit.id,
          spirit_name: spirit.name,
          user_photo: userPhoto || null,
          generated_image: imageUrl,
          prompt,
          spirit_scores: spiritScores || null,
          user_id: user?.id || null,
          status: 'completed',
          metadata,
        })
      }

      return NextResponse.json({
        success: true,
        image: imageUrl,
        prompt,
        orderId,
      })
    } catch (genError) {
      // Update order status to failed if orderId was provided
      if (orderId) {
        await supabaseServer
          .from('spirit_generations')
          .update({
            status: 'failed',
            metadata: { error: genError instanceof Error ? genError.message : 'Generation failed' },
          })
          .eq('order_id', orderId)
      }
      throw genError
    }
  }
  catch (error) {
    console.error('Spirit generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 },
    )
  }
}

// 多人合像生成
async function handleGroupGeneration(group: {
  persons: Array<{
    photo: string | null
    spirit: {
      id: string
      name: string
      nameEn: string
      element: string
      traits: string[]
    }
  }>
}, orderId?: string, generationOptions?: { style?: string; stylePromptModifier?: string; aspectRatio?: string }) {
  const { persons } = group

  // If orderId provided, update existing order status to 'generating'
  if (orderId) {
    await supabaseServer
      .from('spirit_generations')
      .update({ status: 'generating' })
      .eq('order_id', orderId)
  }

  // 构建多人合像 prompt
  const prompt = buildLannaGroupSpiritPrompt({
    persons: persons.map(p => ({
      spiritName: p.spirit.name,
      spiritNameEn: p.spirit.nameEn,
      element: p.spirit.element,
      traits: p.spirit.traits,
    })),
    hasReferenceImages: persons.some(p => !!p.photo),
    styleModifier: generationOptions?.stylePromptModifier,
  })

  // 收集所有参考图片（过滤掉 null）
  const referenceImages = persons
    .map(p => p.photo)
    .filter((photo): photo is string => !!photo)

  try {
    // 调用多图生成（传入图片配置）
    const generatedImageBase64 = await generateImageWithMultipleRefs(prompt, referenceImages, {
      aspectRatio: generationOptions?.aspectRatio,
    })

    // 上传到 Storage（使用 "group" 作为目录）
    const imageUrl = await uploadImageToStorage(generatedImageBase64, 'group')

    // 构建 metadata 存储生成选项
    const metadata = {
      style: generationOptions?.style,
      aspectRatio: generationOptions?.aspectRatio,
    }

    if (orderId) {
      // Update existing order with result
      await supabaseServer
        .from('spirit_generations')
        .update({
          generated_image: imageUrl,
          prompt,
          status: 'completed',
          metadata,
        })
        .eq('order_id', orderId)
    } else {
      // Create new record (legacy mode)
      const user = await getAuthUser()
      await supabaseServer.from('spirit_generations').insert({
        spirit_id: 'group',
        spirit_name: persons.map(p => p.spirit.name).join(' + '),
        user_photo: null,
        generated_image: imageUrl,
        prompt,
        spirit_scores: null,
        user_id: user?.id || null,
        status: 'completed',
        metadata,
      })
    }

    return NextResponse.json({
      success: true,
      image: imageUrl,
      prompt,
      isGroup: true,
      orderId,
    })
  } catch (genError) {
    // Update order status to failed if orderId was provided
    if (orderId) {
      await supabaseServer
        .from('spirit_generations')
        .update({
          status: 'failed',
          metadata: { error: genError instanceof Error ? genError.message : 'Generation failed' },
        })
        .eq('order_id', orderId)
    }
    throw genError
  }
}
