// Sigil element types
export type SpiritElement = 'earth-water' | 'water-spirit' | 'fire-gold' | 'illusion' | 'wind-air'

export interface LannaSpirit {
  id: string
  name: string
  nameEn: string
  nameCn: string
  element: SpiritElement
  culturalRole: string
  description: string
  traits: string[]
  color: string // 主色调 hex
  imagePrompt: string // 用于 AI 生成的提示词
  // 面相映射特征
  faceFeatures: {
    eyeShape: 'round' | 'phoenix' | 'wide' | 'large' | 'deep' // 眼型
    faceShape: 'sturdy' | 'angular' | 'broad' | 'mixed' | 'refined' // 脸型
    noseType: 'normal' | 'high' | 'straight' | 'large' | 'aquiline' // 鼻型
    mouthSize: 'wide' | 'normal' | 'large' // 嘴型
    overallVibe: string // AI 判断的整体气质关键词
  }
}

// 问答问题
export interface Question {
  id: string
  text: string
  textEn: string
  options: QuestionOption[]
}

export interface QuestionOption {
  id: string
  text: string
  textEn: string
  spirits: string[] // related sigil IDs
}

// 用户答案
export interface UserAnswers {
  visitorPhoto: string // base64
  answers: Record<string, string> // questionId -> optionId
  timestamp: number
}

// 匹配结果
export interface MatchResult {
  spirit: LannaSpirit
  matchScore: number
  generatedImage?: string
}
