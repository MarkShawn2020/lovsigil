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
  return generateImageWithMultipleRefs(prompt, referenceImage ? [referenceImage] : [])
}

// 支持多张参考图片的生成函数
export async function generateImageWithMultipleRefs(prompt: string, referenceImages: string[]): Promise<string> {
  const client = getClient()

  // 构建多模态内容
  const parts: any[] = [{ text: prompt }]

  // 添加所有参考图片
  for (const refImage of referenceImages) {
    const match = refImage.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      const [, mimeType, base64Data] = match
      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      })
    }
  }

  const contents = parts.length > 1
    ? [{ role: 'user', parts }]
    : prompt

  const response = await client.models.generateContent({
    model: 'google/gemini-3-pro-image-preview',
    contents,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  })

  // 从响应中提取图像
  const responseParts = response.candidates?.[0]?.content?.parts
  if (!responseParts || responseParts.length === 0) {
    throw new Error('No content in response')
  }

  // 查找图像部分
  for (const part of responseParts) {
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

// 多人合像 prompt 构建
export interface GroupPersonInfo {
  spiritName: string
  spiritNameEn: string
  element: string
  traits: string[]
}

export function buildLannaGroupSpiritPrompt(params: {
  persons: GroupPersonInfo[]
  hasReferenceImages: boolean
}): string {
  const { persons, hasReferenceImages } = params
  const count = persons.length

  const referenceInstruction = hasReferenceImages
    ? `CRITICAL REQUIREMENTS for the ${count} people in the reference images:
- Preserve EXACT facial features of EACH person (eyes, nose, mouth shape, face contour)
- Keep their YOUTHFUL appearance - do NOT age them
- Each person should be clearly distinguishable and recognizable
- Maintain the relative positions/arrangement suggested by the reference images

`
    : ''

  // 构建每个人的守护灵描述
  const spiritDescriptions = persons.map((p, i) => {
    return `Person ${i + 1}: Protected by ${p.spiritNameEn} (${p.spiritName}), a ${p.element} element spirit
   Traits: ${p.traits.slice(0, 3).join(', ')}`
  }).join('\n')

  const prompt = `${referenceInstruction}Create a mystical GROUP PORTRAIT artwork in traditional Lanna (Northern Thai) art style featuring ${count} PEOPLE TOGETHER.

COMPOSITION (GROUP PORTRAIT with ${count} PERSONS):
${spiritDescriptions}

IMPORTANT GROUP PORTRAIT REQUIREMENTS:
- All ${count} persons must appear TOGETHER in ONE harmonious composition
- Each person has their OWN guardian spirit appearing behind/beside them
- The spirits should be semi-transparent, ethereal, or glowing
- The people are NOT merged with spirits - they remain fully human
- Create a sense of unity and connection between the group
- Balance the composition so all persons are equally prominent

Style Requirements:
- Traditional Lanna temple mural art style
- Rich gold leaf accents and ornate decorations
- Thai Buddhist artistic elements
- Warm earth tones (terracotta #CC785C, gold #D4AF37, deep brown)
- Intricate patterns inspired by Lanna textiles
- Mystical auras emanating from each spirit guardian

The artwork should feel sacred and mystical, showing a group blessed and protected by their guardian spirits from Lanna traditions. The composition should celebrate their connection and shared spiritual protection.`

  return prompt
}
