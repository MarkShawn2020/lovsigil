import { NextResponse } from 'next/server'

import { supabaseServer } from '@/libs/SupabaseServer'
import { buildLannaSpiritPrompt, generateImage } from '@/libs/ZenMux'

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
      userDescription: userPhoto ? 'Incorporate the essence of the visitor into this spirit portrait.' : undefined,
    })

    // 调用 ZenMux 生成图像
    const generatedImage = await generateImage(prompt)

    // 保存生成记录到数据库
    await supabaseServer.from('spirit_generations').insert({
      spirit_id: spirit.id,
      spirit_name: spirit.name,
      user_photo: userPhoto || null,
      generated_image: generatedImage,
      prompt,
      spirit_scores: spiritScores || null,
    })

    return NextResponse.json({
      success: true,
      image: generatedImage,
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
