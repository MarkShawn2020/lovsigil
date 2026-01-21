// 兰纳守护灵类型
export interface LannaSpirit {
  id: string
  name: string // 泰语名
  nameEn: string // 英文名
  nameCn: string // 中文名
  element: 'fire' | 'water' | 'earth' | 'air' | 'spirit'
  description: string
  traits: string[]
  color: string // 主色调 hex
  imagePrompt: string // 用于 AI 生成的提示词
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
  spirits: string[] // 关联的守护灵 ID
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
