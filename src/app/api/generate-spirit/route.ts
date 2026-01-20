import { NextResponse } from 'next/server'

import { buildLannaSpiritPrompt, generateImage } from '@/libs/ZenMux'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { spirit, userPhoto } = body

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
