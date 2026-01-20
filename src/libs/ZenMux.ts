import { GoogleGenAI } from '@google/genai'

import { EnvServer } from './EnvServer'

let genaiClient: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  if (!genaiClient) {
    const apiKey = EnvServer.ZENMUX_API_KEY
    if (!apiKey) {
      throw new Error('ZENMUX_API_KEY is not configured')
    }

    genaiClient = new GoogleGenAI({
      apiKey,
      vertexai: true,
      httpOptions: {
        baseUrl: 'https://zenmux.ai/api/vertex-ai',
        apiVersion: 'v1',
      },
    })
  }
  return genaiClient
}

export async function generateImage(prompt: string, referenceImage?: string): Promise<string> {
  const client = getClient()

  // 构建多模态内容
  let contents: any
  if (referenceImage) {
    // 从 data URL 中提取 base64 和 mime type
    const match = referenceImage.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      const [, mimeType, base64Data] = match
      contents = [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ]
    } else {
      // 无效的 data URL，回退到纯文本
      contents = prompt
    }
  } else {
    contents = prompt
  }

  const response = await client.models.generateContent({
    model: 'google/gemini-3-pro-image-preview',
    contents,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  })

  // 从响应中提取图像
  const parts = response.candidates?.[0]?.content?.parts
  if (!parts || parts.length === 0) {
    throw new Error('No content in response')
  }

  // 查找图像部分
  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith('image/')) {
      // 返回 base64 data URL
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
    }
  }

  throw new Error('No image found in response')
}

// 构建兰纳灵魂画像的 prompt
export function buildLannaSpiritPrompt(params: {
  spiritName: string
  spiritNameEn: string
  element: string
  traits: string[]
  basePrompt: string
  hasReferenceImage?: boolean
}): string {
  const { spiritName, spiritNameEn, element, traits, basePrompt, hasReferenceImage } = params

  // 当有参考图像时，强调保持人物相似性和年轻化
  const referenceInstruction = hasReferenceImage
    ? `CRITICAL REQUIREMENTS for the person in reference image:
- Preserve EXACT facial features (eyes, nose, mouth shape, face contour)
- Keep their YOUTHFUL appearance - do NOT age them, make them look the same age or slightly younger
- Maintain smooth, healthy skin - avoid wrinkles or aged appearance
- The person should look vibrant and full of life

`
    : ''

  const prompt = `${referenceInstruction}Create a mystical portrait artwork in traditional Lanna (Northern Thai) art style.

COMPOSITION (TWO SEPARATE ENTITIES):
- The HUMAN: ${hasReferenceImage ? 'The person from the reference image' : 'A young person'}, depicted realistically with youthful features
- The SPIRIT: ${spiritNameEn} (${spiritName}), a mystical ${element} element guardian spirit

IMPORTANT: The human and the spirit guardian must be SEPARATE entities in the image:
- The spirit appears BEHIND or BESIDE the person as a protective guardian
- The spirit can be semi-transparent, ethereal, or glowing
- They are NOT merged or fused together - the person remains fully human
- The spirit watches over and protects the person

Style Requirements:
- Traditional Lanna temple mural art style
- Rich gold leaf accents and ornate decorations
- Thai Buddhist artistic elements
- Warm earth tones (terracotta #CC785C, gold #D4AF37, deep brown)
- Intricate patterns inspired by Lanna textiles
- Mystical aura emanating from the spirit

Spirit Guardian (${spiritNameEn}) Characteristics:
${traits.map(t => `- ${t}`).join('\n')}

${basePrompt}

The artwork should feel sacred and mystical. The person appears blessed and protected by their guardian spirit from Lanna traditions.`

  return prompt
}
