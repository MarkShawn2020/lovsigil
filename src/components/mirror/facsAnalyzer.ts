import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

import type { LannaSpirit } from './types'
import { LANNA_SPIRITS } from './spiritData'

// 简化的 AU (Action Unit) 检测
// 基于 MediaPipe Face Mesh 468 landmarks

// 关键 landmark 索引 (MediaPipe Face Mesh)
const LANDMARKS = {
  // 眉毛
  leftBrowInner: 107,
  leftBrowOuter: 70,
  rightBrowInner: 336,
  rightBrowOuter: 300,

  // 眼睛
  leftEyeTop: 159,
  leftEyeBottom: 145,
  rightEyeTop: 386,
  rightEyeBottom: 374,

  // 嘴巴
  mouthLeft: 61,
  mouthRight: 291,
  mouthTop: 13,
  mouthBottom: 14,
  upperLipTop: 0,
  lowerLipBottom: 17,

  // 脸部基准
  noseTip: 4,
  chin: 152,
  foreheadCenter: 10,
  leftCheek: 123,
  rightCheek: 352,
}

export interface ExpressionScores {
  smile: number // AU12 - 嘴角上扬
  browRaise: number // AU1+AU2 - 眉毛上扬
  browFurrow: number // AU4 - 皱眉
  eyeOpenness: number // AU5 - 睁眼程度
  mouthOpen: number // AU25+AU26 - 嘴巴张开
  intensity: number // 整体表情强度
}

export interface SpiritScores {
  naga: number
  singha: number
  hong: number
  chang: number
  garuda: number
}

// 计算两点之间的距离
function distance(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
  return Math.sqrt(
    (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + ((p1.z || 0) - (p2.z || 0)) ** 2,
  )
}

// 从 landmarks 提取表情分数
export function extractExpressionScores(landmarks: NormalizedLandmark[]): ExpressionScores {
  const defaultScores = { smile: 0, browRaise: 0, browFurrow: 0, eyeOpenness: 0, mouthOpen: 0, intensity: 0 }

  if (landmarks.length < 468) {
    return defaultScores
  }

  // 获取关键点（带类型断言，因为已检查 length）
  const leftBrowInner = landmarks[LANDMARKS.leftBrowInner]!
  const rightBrowInner = landmarks[LANDMARKS.rightBrowInner]!
  const leftBrowOuter = landmarks[LANDMARKS.leftBrowOuter]!
  const rightBrowOuter = landmarks[LANDMARKS.rightBrowOuter]!
  const chin = landmarks[LANDMARKS.chin]!
  const forehead = landmarks[LANDMARKS.foreheadCenter]!

  const leftEyeTop = landmarks[LANDMARKS.leftEyeTop]!
  const leftEyeBottom = landmarks[LANDMARKS.leftEyeBottom]!
  const rightEyeTop = landmarks[LANDMARKS.rightEyeTop]!
  const rightEyeBottom = landmarks[LANDMARKS.rightEyeBottom]!

  const mouthLeft = landmarks[LANDMARKS.mouthLeft]!
  const mouthRight = landmarks[LANDMARKS.mouthRight]!
  const mouthTop = landmarks[LANDMARKS.mouthTop]!
  const mouthBottom = landmarks[LANDMARKS.mouthBottom]!

  // 计算脸部基准高度（用于归一化）
  const faceHeight = distance(forehead, chin)
  if (faceHeight === 0)
    return defaultScores

  // AU12 - 微笑检测（嘴角相对于嘴巴中心的上扬程度）
  const mouthCenterY = (mouthTop.y + mouthBottom.y) / 2
  const mouthCornerY = (mouthLeft.y + mouthRight.y) / 2
  const mouthWidth = distance(mouthLeft, mouthRight)
  const smile = Math.max(0, (mouthCenterY - mouthCornerY) / faceHeight * 10 + mouthWidth / faceHeight * 2)

  // AU1+AU2 - 眉毛上扬（眉毛相对于眼睛的位置）
  const browHeight = (
    (forehead.y - leftBrowInner.y)
    + (forehead.y - rightBrowInner.y)
    + (forehead.y - leftBrowOuter.y)
    + (forehead.y - rightBrowOuter.y)
  ) / 4
  const browRaise = Math.max(0, browHeight / faceHeight * 15)

  // AU4 - 皱眉（眉毛内侧距离）
  const browInnerDist = distance(leftBrowInner, rightBrowInner)
  const browFurrow = Math.max(0, 1 - browInnerDist / faceHeight * 3)

  // AU5 - 睁眼程度
  const leftEyeOpen = distance(leftEyeTop, leftEyeBottom)
  const rightEyeOpen = distance(rightEyeTop, rightEyeBottom)
  const eyeOpenness = ((leftEyeOpen + rightEyeOpen) / 2) / faceHeight * 20

  // AU25+AU26 - 嘴巴张开程度
  const mouthOpenDist = distance(mouthTop, mouthBottom)
  const mouthOpen = mouthOpenDist / faceHeight * 10

  // 整体表情强度
  const intensity = (Math.abs(smile) + Math.abs(browRaise) + Math.abs(browFurrow) + Math.abs(eyeOpenness - 0.5) + Math.abs(mouthOpen)) / 5

  return {
    smile: Math.min(1, smile),
    browRaise: Math.min(1, browRaise),
    browFurrow: Math.min(1, browFurrow),
    eyeOpenness: Math.min(1, eyeOpenness),
    mouthOpen: Math.min(1, mouthOpen),
    intensity: Math.min(1, intensity),
  }
}

// 表情到守护灵的映射规则
// Naga (水) - 深邃、神秘、智慧 → 平静、微皱眉（思考）
// Singha (火) - 勇气、力量、守护 → 强烈、直视、轻微张嘴（自信）
// Hongsa (空) - 优雅、纯洁、自由 → 微笑、放松、眉毛舒展
// Chang (土) - 稳重、忠诚、智慧 → 中性、稳定、轻微微笑
// Garuda (灵) - 超越、神圣、正义 → 专注、眼睛大睁、眉毛上扬

export function mapExpressionToSpirits(scores: ExpressionScores): SpiritScores {
  const { smile, browRaise, browFurrow, eyeOpenness, mouthOpen, intensity } = scores

  // 计算每个守护灵的匹配度
  const spiritScores: SpiritScores = {
    // Naga: 思考型 - 皱眉高、微笑低、嘴巴闭合
    naga: browFurrow * 0.4 + (1 - smile) * 0.3 + (1 - mouthOpen) * 0.2 + (1 - intensity) * 0.1,

    // Singha: 自信型 - 强度高、眼睛大、嘴巴略张
    singha: intensity * 0.3 + eyeOpenness * 0.3 + mouthOpen * 0.2 + (1 - browFurrow) * 0.2,

    // Hongsa: 愉悦型 - 微笑高、眉毛舒展、放松
    hong: smile * 0.5 + (1 - browFurrow) * 0.3 + browRaise * 0.1 + (1 - intensity) * 0.1,

    // Chang: 稳定型 - 各项中等、不极端
    chang: (1 - Math.abs(smile - 0.3)) * 0.3
      + (1 - Math.abs(browFurrow - 0.2)) * 0.3
      + (1 - intensity) * 0.2
      + (1 - mouthOpen) * 0.2,

    // Garuda: 专注型 - 眼睛大睁、眉毛上扬、强度高
    garuda: eyeOpenness * 0.4 + browRaise * 0.3 + intensity * 0.2 + (1 - smile) * 0.1,
  }

  return spiritScores
}

// 累积表情分析器类
export class ExpressionAccumulator {
  private samples: ExpressionScores[] = []
  private readonly maxSamples = 60 // 约 2 秒的数据 (30fps)

  addSample(scores: ExpressionScores) {
    this.samples.push(scores)
    if (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }
  }

  getAverageScores(): ExpressionScores {
    if (this.samples.length === 0) {
      return { smile: 0, browRaise: 0, browFurrow: 0, eyeOpenness: 0, mouthOpen: 0, intensity: 0 }
    }

    const sum = this.samples.reduce(
      (acc, s) => ({
        smile: acc.smile + s.smile,
        browRaise: acc.browRaise + s.browRaise,
        browFurrow: acc.browFurrow + s.browFurrow,
        eyeOpenness: acc.eyeOpenness + s.eyeOpenness,
        mouthOpen: acc.mouthOpen + s.mouthOpen,
        intensity: acc.intensity + s.intensity,
      }),
      { smile: 0, browRaise: 0, browFurrow: 0, eyeOpenness: 0, mouthOpen: 0, intensity: 0 },
    )

    const count = this.samples.length
    return {
      smile: sum.smile / count,
      browRaise: sum.browRaise / count,
      browFurrow: sum.browFurrow / count,
      eyeOpenness: sum.eyeOpenness / count,
      mouthOpen: sum.mouthOpen / count,
      intensity: sum.intensity / count,
    }
  }

  getSampleCount(): number {
    return this.samples.length
  }

  reset() {
    this.samples = []
  }
}

// 根据累积的表情数据匹配守护灵
export function matchSpiritByExpression(accumulator: ExpressionAccumulator): LannaSpirit {
  const avgScores = accumulator.getAverageScores()
  const spiritScores = mapExpressionToSpirits(avgScores)

  // 找出得分最高的守护灵
  let maxScore = 0
  let matchedId = 'chang' // 默认

  Object.entries(spiritScores).forEach(([id, score]) => {
    if (score > maxScore) {
      maxScore = score
      matchedId = id
    }
  })

  const found = LANNA_SPIRITS.find(s => s.id === matchedId)
  // Chang (index 3) 作为默认
  return found ?? LANNA_SPIRITS[3]!
}

// 获取当前表情的简短描述
export function getExpressionDescription(scores: ExpressionScores): string {
  const spiritScores = mapExpressionToSpirits(scores)

  // 找出得分最高的守护灵
  let maxScore = 0
  let dominant = 'chang'

  Object.entries(spiritScores).forEach(([id, score]) => {
    if (score > maxScore) {
      maxScore = score
      dominant = id
    }
  })

  const names: Record<string, string> = {
    naga: 'พญานาค',
    singha: 'สิงห์',
    hong: 'หงส์',
    chang: 'ช้าง',
    garuda: 'ครุฑ',
  }

  return names[dominant] || 'ช้าง'
}

// Spirit info for display (Thai / English)
export const SPIRIT_INFO = {
  naga: { name: 'พญานาค / Naga', emoji: '🐉', color: '#1E90FF' },
  singha: { name: 'สิงห์ / Singha', emoji: '🦁', color: '#FF6B35' },
  hong: { name: 'หงส์ / Hongsa', emoji: '🦢', color: '#FFD700' },
  chang: { name: 'ช้าง / Chang', emoji: '🐘', color: '#8B4513' },
  garuda: { name: 'ครุฑ / Garuda', emoji: '🦅', color: '#9932CC' },
} as const

// 归一化守护灵分数（总和为 1）
export function getNormalizedSpiritScores(scores: ExpressionScores): SpiritScores {
  const raw = mapExpressionToSpirits(scores)
  const total = Object.values(raw).reduce((sum, v) => sum + v, 0)

  if (total === 0) {
    return { naga: 0.2, singha: 0.2, hong: 0.2, chang: 0.2, garuda: 0.2 }
  }

  return {
    naga: raw.naga / total,
    singha: raw.singha / total,
    hong: raw.hong / total,
    chang: raw.chang / total,
    garuda: raw.garuda / total,
  }
}
