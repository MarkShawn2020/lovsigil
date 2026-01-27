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

// Sigil 气质分析结果
export interface SigilVibeAnalysis {
  dominantVibe: string // "warrior", "sage", "mystic", "guardian", "seeker", "creator", "healer"
  traits: string[] // ["determined", "intuitive", "grounded"]
  runeAffinity: 'elder_futhark' | 'younger_futhark' | 'anglo_saxon' | 'mystical'
  description: string // poetic one-sentence description
}

// 使用 Vision AI 分析面部气质（用于 Sigil 生成）
export async function analyzeSigilVibe(
  imageBase64: string,
  name?: string,
  bio?: string,
): Promise<SigilVibeAnalysis> {
  const client = getClient()

  const contextInfo = [
    name ? `Their name is "${name}".` : '',
    bio ? `About them: "${bio}"` : '',
  ].filter(Boolean).join('\n')

  const prompt = `Analyze this person's face to understand their inner essence for creating a personal sigil.

${contextInfo}

Based on the facial features, expression, and overall energy, determine:

1. dominantVibe: One word capturing their core energy. Choose from:
   - "warrior" - strength, determination, courage
   - "sage" - wisdom, knowledge, contemplation
   - "mystic" - spiritual depth, intuition, mystery
   - "guardian" - protection, reliability, steadfastness
   - "seeker" - curiosity, exploration, growth
   - "creator" - creativity, innovation, artistry
   - "healer" - compassion, nurturing, harmony

2. traits: 3-5 personality traits visible in their features (e.g., ["determined", "intuitive", "grounded", "passionate"])

3. runeAffinity: Which rune tradition best matches their energy:
   - "elder_futhark" - Ancient, primal power (strong, earthy features)
   - "younger_futhark" - Refined, focused energy (sharp, precise features)
   - "anglo_saxon" - Expansive, worldly wisdom (open, expressive features)
   - "mystical" - Transcendent, spiritual depth (ethereal, dreamlike quality)

4. description: A poetic one-sentence description of their essence (max 100 chars)

Return JSON only:
{
  "dominantVibe": "...",
  "traits": ["...", "...", "..."],
  "runeAffinity": "...",
  "description": "..."
}`

  // 解析 base64
  const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    throw new Error('Invalid image format')
  }
  const [, mimeType, base64Data] = match

  const response = await client.models.generateContent({
    model: 'google/gemini-3-pro-preview',
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
      dominantVibe: 'seeker',
      traits: ['curious', 'open', 'balanced'],
      runeAffinity: 'mystical',
      description: 'A soul seeking its true path',
    }
  }

  const result = JSON.parse(jsonMatch[0]) as SigilVibeAnalysis
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

// 构建 Sigil 生成的 prompt
export function buildSigilPrompt(params: {
  name: string
  bio?: string
  vibeAnalysis: SigilVibeAnalysis
  hasReferenceImage: boolean
}): string {
  const { name, bio, vibeAnalysis, hasReferenceImage } = params

  // 当有参考图像时，将面部本质抽象融入符文设计
  const faceInstruction = hasReferenceImage
    ? `FACE ESSENCE INTEGRATION:
Subtly incorporate the facial essence and energy of the reference photo into the sigil's design:
- NOT as a portrait, but as geometric abstraction of their unique features
- The person's facial angles and proportions can inspire the sigil's geometry
- Their expression's energy should influence the sigil's flow and balance
- This is a spiritual transformation - turning their physical form into pure symbol

`
    : ''

  // 根据 runeAffinity 调整风格描述
  const runeStyleMap: Record<string, string> = {
    elder_futhark: 'Elder Futhark runes - ancient, primal, angular strokes with powerful energy',
    younger_futhark: 'Younger Futhark runes - refined, simplified, focused geometric forms',
    anglo_saxon: 'Anglo-Saxon Futhorc runes - expansive, complex, interwoven patterns',
    mystical: 'Mystical runes - ethereal, flowing, transcendent sacred geometry',
  }

  const runeStyle = runeStyleMap[vibeAnalysis.runeAffinity] || runeStyleMap.mystical

  const prompt = `Create a mystical personal sigil for "${name}".
${bio ? `Their essence: ${bio}` : ''}

VIBE ANALYSIS:
- Dominant energy: ${vibeAnalysis.dominantVibe}
- Core traits: ${vibeAnalysis.traits.join(', ')}
- Rune affinity: ${vibeAnalysis.runeAffinity}
- Soul description: ${vibeAnalysis.description}

${faceInstruction}ART STYLE REQUIREMENTS:
- ${runeStyle}
- Dark mystical background (deep navy #0D1B2A, charcoal, or cosmic black)
- Glowing golden/amber (#C9A227) rune lines and symbols
- Add electric blue (#00D4FF) accent glows for ethereal effect
- Incorporate bind rune principles (multiple runes combined into ONE unified symbol)
- Sacred geometric elements (circles, triangles, interlocking patterns)
- Subtle ethereal glow effects emanating from the sigil
- The sigil should feel personal, powerful, and ancient

CRITICAL REQUIREMENTS:
- Create ONE single, centered sigil design
- NO text, NO letters, NO readable words - only symbolic rune-like patterns
- The sigil represents the person's inner essence and destiny
- Could be worn as a talisman or used as a personal seal
- Clean, balanced composition with the sigil as the focal point
- The design should feel like it was carved in stone or forged in fire

The final image should evoke mystery, personal power, and ancient wisdom.`

  return prompt
}

// Life Totem 生成 (使用 Claude Opus 4.5 via ZenMux Anthropic endpoint)
export async function generateLifeTotem(name: string, bio?: string): Promise<string> {
  const apiKey = EnvServer.ZENMUX_API_KEY
  if (!apiKey) {
    throw new Error('ZENMUX_API_KEY is not configured')
  }

  const prompt = `你是一位创造生命图腾的大师。请为以下人物创造一个极简主义的抽象图腾。

姓名：${name}
${bio ? `附加信息：${bio}` : ''}

请生成一个 SVG 图像，要求：
1. 黑色背景 (#000000)
2. 白色设计元素 (#FFFFFF)
3. 边缘 2.5% 的留白
4. 一个优雅的框架，包含：
   - 顶部是人物姓名（优雅字体）
   - 姓名下方有一条精致的水平分割线
   - 中心是一个抽象的图腾符号（几何、神秘、个人化）
   - 底部是一句禅意公案式的短句（深邃、含蓄，10-20个中文字）
5. 右下角框架外部有 "@LovSigil" 水印，与框架边线保持 10px 以上间距

图腾应该是：
- 极简主义和抽象的
- 象征性和神秘的
- 对这个名字和本质独特而个人化
- 平衡和谐

仅返回完整的 SVG 代码，以 <svg 开始，以 </svg> 结束。
SVG 应该是 400x400 像素，viewBox="0 0 400 400"。`

  const response = await fetch('https://zenmux.ai/api/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4.5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text || ''

  // 提取 SVG
  const svgMatch = text.match(/<svg[\s\S]*<\/svg>/i)
  if (!svgMatch) {
    throw new Error('No SVG found in response')
  }

  return svgMatch[0]
}
