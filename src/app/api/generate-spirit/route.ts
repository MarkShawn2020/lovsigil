import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { EnvServer } from '@/libs/EnvServer'
import { supabaseAdmin, supabaseServer } from '@/libs/SupabaseServer'
import { buildLannaSpiritPrompt, generateImage } from '@/libs/ZenMux'

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
    const { spirit, userPhoto, spiritScores } = body

    if (!spirit) {
      return NextResponse.json(
        { error: 'Missing spirit data' },
        { status: 400 },
      )
    }

    // 构建生成 prompt
    const prompt = buildLannaSpiritPrompt({
      spiritName: spirit.name,
      spiritNameEn: spirit.nameEn,
      element: spirit.element,
      traits: spirit.traits,
      basePrompt: spirit.imagePrompt,
      hasReferenceImage: !!userPhoto,
    })

    // 调用 ZenMux 生成图像（传入用户头像作为参考）
    const generatedImageBase64 = await generateImage(prompt, userPhoto || undefined)

    // 上传生成的图片到 Storage
    const imageUrl = await uploadImageToStorage(generatedImageBase64, spirit.id)

    // Get current user (optional)
    const user = await getAuthUser()

    // 保存生成记录到数据库（存储 URL 而非 base64）
    await supabaseServer.from('spirit_generations').insert({
      spirit_id: spirit.id,
      spirit_name: spirit.name,
      user_photo: userPhoto || null,
      generated_image: imageUrl,
      prompt,
      spirit_scores: spiritScores || null,
      user_id: user?.id || null,
    })

    return NextResponse.json({
      success: true,
      image: imageUrl,
      prompt,
    })
  }
  catch (error) {
    console.error('Spirit generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 },
    )
  }
}
