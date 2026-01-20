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

export async function generateImage(prompt: string): Promise<string> {
  const client = getClient()

  const response = await client.models.generateContent({
    model: 'google/gemini-3-pro-image-preview',
    contents: prompt,
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
  userDescription?: string
}): string {
  const { spiritName, spiritNameEn, element, traits, basePrompt, userDescription } = params

  const prompt = `Create a mystical portrait artwork in traditional Lanna (Northern Thai) art style.

Subject: A person embodied with the spirit of ${spiritNameEn} (${spiritName}), the ${element} element guardian.

Style Requirements:
- Traditional Lanna temple mural art style
- Rich gold leaf accents and ornate decorations
- Thai Buddhist artistic elements
- Warm earth tones (terracotta #CC785C, gold #D4AF37, deep brown)
- Intricate patterns inspired by Lanna textiles
- Sacred geometric motifs
- Mystical aura surrounding the figure

Spirit Characteristics:
${traits.map(t => `- ${t}`).join('\n')}

${basePrompt}

${userDescription ? `Additional context: ${userDescription}` : ''}

The artwork should feel sacred, mystical, and deeply connected to Lanna spiritual traditions. The figure should appear as if they are a guardian spirit from an ancient temple painting.`

  return prompt
}
