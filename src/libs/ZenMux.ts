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

// Vision AI 气质分析结果
export interface VibeAnalysisResult {
  scores: {
    mom: number // 野性实诚、敦实稳重
    naga: number // 清冷魅惑、仙气飘飘
    singha: number // 威严霸气、天生领袖
    makara: number // 能说会道、欲望强烈
    hadsadiling: number // 清高贵族、疏离优雅
  }
  dominantVibe: string
  description: string
}

// 使用 Vision AI 分析面部气质（30% 权重）
export async function analyzeVibeFromImage(imageBase64: string): Promise<VibeAnalysisResult> {
  const client = getClient()

  const prompt = `分析这张人脸照片的气质特征，判断最符合以下哪种类型：

1. Mom (莫) - 野性实诚、敦实稳重、外冷内热、忠诚可靠
2. Naga (纳迦) - 清冷魅惑、仙气飘飘、直觉敏锐、艺术天分
3. Singha (醒狮) - 威严霸气、天生领袖、掌控欲强、正义感重
4. Makara (摩羯) - 能说会道、欲望强烈、务实精明、看透本质
5. Hadsadiling (哈萨迪灵) - 清高贵族、疏离优雅、多才多艺、精神洁癖

请根据：
- 整体气场和氛围
- 眼神特质（清澈/深邃/锐利/温和）
- 面部给人的第一印象
- 是否有"发量浓密"、"混血感"、"五官立体"等特征

返回 JSON 格式：
{
  "scores": {
    "mom": 0.0-1.0,
    "naga": 0.0-1.0,
    "singha": 0.0-1.0,
    "makara": 0.0-1.0,
    "hadsadiling": 0.0-1.0
  },
  "dominantVibe": "最匹配的类型ID",
  "description": "简短的气质描述（20字以内）"
}

只返回 JSON，不要其他内容。`

  // 解析 base64
  const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    throw new Error('Invalid image format')
  }
  const [, mimeType, base64Data] = match

  const response = await client.models.generateContent({
    model: 'google/gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType!, data: base64Data! } },
        ],
      },
    ],
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // 解析 JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    // 返回默认值
    return {
      scores: { mom: 0.2, naga: 0.2, singha: 0.2, makara: 0.2, hadsadiling: 0.2 },
      dominantVibe: 'mom',
      description: '无法分析',
    }
  }

  const result = JSON.parse(jsonMatch[0]) as VibeAnalysisResult
  return result
}

export interface ImageGenerationOptions {
  aspectRatio?: string // "1:1", "3:4", "4:3", "9:16", "16:9", etc.
  imageSize?: string   // "1K", "2K", "4K"
}

export async function generateImage(prompt: string, referenceImage?: string, options?: ImageGenerationOptions): Promise<string> {
  return generateImageWithMultipleRefs(prompt, referenceImage ? [referenceImage] : [], options)
}

// 支持多张参考图片的生成函数
export async function generateImageWithMultipleRefs(prompt: string, referenceImages: string[], options?: ImageGenerationOptions): Promise<string> {
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

  // 构建 config，包含 imageConfig（如果有 aspectRatio/imageSize）
  const config: any = {
    responseModalities: ['TEXT', 'IMAGE'],
  }

  if (options?.aspectRatio || options?.imageSize) {
    config.imageConfig = {}
    if (options.aspectRatio) {
      config.imageConfig.aspectRatio = options.aspectRatio
    }
    if (options.imageSize) {
      config.imageConfig.imageSize = options.imageSize
    }
  }

  const response = await client.models.generateContent({
    model: 'google/gemini-3-pro-image-preview',
    contents,
    config,
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
  styleModifier?: string
}): string {
  const { spiritName, spiritNameEn, element, traits, basePrompt, hasReferenceImage, styleModifier } = params

  // 当有参考图像时，强调保持人物相似性和年龄
  const referenceInstruction = hasReferenceImage
    ? `⚠️ ABSOLUTE CRITICAL - AGE PRESERVATION REQUIREMENTS ⚠️
The person in the reference image is YOUNG. You MUST:
- Preserve their EXACT AGE - they should look the SAME AGE as in the photo, NOT older
- Keep their youthful, smooth, flawless skin - NO wrinkles, NO aging lines, NO mature features
- Maintain their young facial structure - soft features, not hardened or aged
- Eyes should be bright and lively, not tired or aged
- If the person looks like a teenager or young adult (18-25), keep them looking 18-25
- DO NOT add any signs of aging: no crow's feet, no forehead lines, no nasolabial folds
- Hair should be full and healthy, not thinned or grayed
- The person should radiate youth and vitality

FACE PRESERVATION:
- Preserve EXACT facial features (eyes shape, nose, mouth, face contour, skin tone)
- Keep their natural expression and energy
- The generated face must be immediately recognizable as the same person

`
    : ''

  // 使用自定义风格或默认兰纳壁画风格
  const artStyleDescription = styleModifier || 'traditional Lanna temple mural art style, rich gold leaf accents, Thai Buddhist artistic elements, warm earth tones'

  const prompt = `${referenceInstruction}Create a mystical portrait artwork. Art style: ${artStyleDescription}.

COMPOSITION (TWO SEPARATE ENTITIES):
- The HUMAN: ${hasReferenceImage ? 'The person from the reference image' : 'A young person'}, depicted realistically with youthful features
- The SPIRIT: ${spiritNameEn} (${spiritName}), a mystical ${element} element guardian spirit

IMPORTANT: The human and the spirit guardian must be SEPARATE entities in the image:
- The spirit appears BEHIND or BESIDE the person as a protective guardian
- The spirit can be semi-transparent, ethereal, or glowing
- They are NOT merged or fused together - the person remains fully human
- The spirit watches over and protects the person

Style Requirements:
- ${artStyleDescription}
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
  styleModifier?: string
}): string {
  const { persons, hasReferenceImages, styleModifier } = params
  const count = persons.length

  // 使用自定义风格或默认兰纳壁画风格
  const artStyleDescription = styleModifier || 'traditional Lanna temple mural art style, rich gold leaf accents, Thai Buddhist artistic elements, warm earth tones'

  const referenceInstruction = hasReferenceImages
    ? `⚠️ ABSOLUTE CRITICAL - AGE PRESERVATION FOR ALL ${count} PERSONS ⚠️
The people in the reference images are YOUNG. You MUST for EACH person:
- Preserve their EXACT AGE - they should look the SAME AGE as in photos, NOT older
- Keep youthful, smooth, flawless skin - NO wrinkles, NO aging lines, NO mature features
- Maintain young facial structures - soft features, not hardened or aged
- Eyes should be bright and lively, not tired or aged
- DO NOT add any signs of aging to anyone
- Each person should radiate youth and vitality

FACE PRESERVATION FOR EACH PERSON:
- Preserve EXACT facial features (eyes, nose, mouth, face contour, skin tone)
- Each person must be clearly distinguishable and immediately recognizable
- Maintain their natural expressions and energy

`
    : ''

  // 构建每个人的守护灵描述
  const spiritDescriptions = persons.map((p, i) => {
    return `Person ${i + 1}: Protected by ${p.spiritNameEn} (${p.spiritName}), a ${p.element} element spirit
   Traits: ${p.traits.slice(0, 3).join(', ')}`
  }).join('\n')

  const prompt = `${referenceInstruction}Create a mystical GROUP PORTRAIT artwork. Art style: ${artStyleDescription}. Featuring ${count} PEOPLE TOGETHER.

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
- ${artStyleDescription}
- Intricate patterns inspired by Lanna textiles
- Mystical auras emanating from each spirit guardian

The artwork should feel sacred and mystical, showing a group blessed and protected by their guardian spirits from Lanna traditions. The composition should celebrate their connection and shared spiritual protection.`

  return prompt
}

// 守护灵信息（用于祝福语生成）
const SPIRIT_BLESSING_INFO: Record<string, { name: string; element: string; traits: string[] }> = {
  mom: { name: 'Mom (莫)', element: 'Earth-Water', traits: ['resilience', 'loyalty', 'hard work'] },
  naga: { name: 'Naga (纳迦)', element: 'Water-Spirit', traits: ['wisdom', 'protection', 'artistry'] },
  singha: { name: 'Singha (醒狮)', element: 'Fire-Gold', traits: ['leadership', 'justice', 'majesty'] },
  makara: { name: 'Makara (摩羯)', element: 'Illusion', traits: ['ambition', 'eloquence', 'perception'] },
  hadsadiling: { name: 'Hadsadiling (哈萨迪灵)', element: 'Wind-Air', traits: ['nobility', 'versatility', 'distinction'] },
}

/**
 * 使用 LLM 生成兰纳风格祝福语
 */
export async function generateLannaBlessing(spiritIds: string[]): Promise<string> {
  const client = getClient()

  const spirits = spiritIds
    .map(id => SPIRIT_BLESSING_INFO[id])
    .filter((s): s is { name: string; element: string; traits: string[] } => !!s)

  if (spirits.length === 0) {
    return ''
  }

  const spiritDesc = spirits.map(s => `${s.name} (${s.element} element, traits: ${s.traits.join(', ')})`).join(' and ')

  const prompt = `You are a wise monk from the ancient Lanna Kingdom of Northern Thailand. Generate a short, heartfelt blessing (1-2 sentences, max 80 characters) for people protected by ${spiritDesc}.

Requirements:
- Draw from Lanna Buddhist traditions and Thai Northern culture
- Reference the spirits' elemental powers and traits
- Focus on harmony, protection, prosperity, or spiritual growth
- Keep it poetic but accessible
- Output in English only
- Do not use quotation marks

Example blessings for reference (do not copy these exactly):
- "May the steadfast earth guide your path and flowing waters cleanse your spirit"
- "Under the dragon's wise gaze, may wisdom illuminate your journey"
- "Let the lion's courage kindle the sacred fire within your heart"

Generate a unique blessing for these guardians:`

  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  })

  const text = response.text?.trim() || ''
  // 清理可能的引号
  return text.replace(/^["']|["']$/g, '').trim()
}
