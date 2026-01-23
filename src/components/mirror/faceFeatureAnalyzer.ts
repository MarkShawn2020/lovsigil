import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

// 静态面部特征分析器
// 基于 MediaPipe Face Mesh 468 landmarks 提取稳定的面部结构特征

// 关键 landmark 索引
const LANDMARKS = {
  // 脸部轮廓
  foreheadTop: 10,
  foreheadLeft: 109,
  foreheadRight: 338,
  chin: 152,
  leftJaw: 234,
  rightJaw: 454,
  leftCheekbone: 123,
  rightCheekbone: 352,

  // 眼睛
  leftEyeInner: 133,
  leftEyeOuter: 33,
  leftEyeTop: 159,
  leftEyeBottom: 145,
  rightEyeInner: 362,
  rightEyeOuter: 263,
  rightEyeTop: 386,
  rightEyeBottom: 374,

  // 眉毛
  leftBrowInner: 107,
  leftBrowOuter: 70,
  rightBrowInner: 336,
  rightBrowOuter: 300,

  // 鼻子
  noseBridge: 6,
  noseTip: 4,
  noseBottom: 2,
  leftNostril: 98,
  rightNostril: 327,

  // 嘴巴
  mouthLeft: 61,
  mouthRight: 291,
  upperLipTop: 0,
  lowerLipBottom: 17,

  // 耳朵（可见时）
  leftEarTop: 127,
  leftEarBottom: 234,
  rightEarTop: 356,
  rightEarBottom: 454,
}

// 面部特征分数
export interface FaceFeatureScores {
  // 眼型特征
  eyeRoundness: number // 眼睛圆度 (0=细长凤眼, 1=圆眼)
  eyeSlant: number // 眼角上扬度 (0=下垂, 0.5=平, 1=上扬)
  eyeDistance: number // 眼距比 (0=近, 1=远)

  // 脸型特征
  faceWidthRatio: number // 脸宽长比 (0=窄长, 1=宽圆)
  cheekboneProminence: number // 颧骨突出度
  jawSharpness: number // 下颌角锐度 (0=圆润, 1=方正)

  // 鼻子特征
  noseLengthRatio: number // 鼻长比
  noseBridgeHeight: number // 鼻梁高度
  noseTipAngle: number // 鼻尖角度 (0=上翘, 0.5=平, 1=下垂/鹰钩)

  // 嘴巴特征
  mouthWidthRatio: number // 嘴宽比
  lipFullness: number // 嘴唇厚度

  // 额头特征
  foreheadWidthRatio: number // 额头宽度比
}

// 神兽匹配分数
export interface SpiritMatchScores {
  mom: number
  naga: number
  singha: number
  makara: number
  hadsadiling: number
}

// 计算两点距离
function distance(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
  return Math.sqrt(
    (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + ((p1.z || 0) - (p2.z || 0)) ** 2,
  )
}

// 计算两点的 Y 差值（归一化）
function yDiff(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
  return p1.y - p2.y
}

// 从 landmarks 提取静态面部特征
export function extractFaceFeatures(landmarks: NormalizedLandmark[]): FaceFeatureScores | null {
  if (landmarks.length < 468) {
    return null
  }

  // 获取关键点
  const forehead = landmarks[LANDMARKS.foreheadTop]!
  const chin = landmarks[LANDMARKS.chin]!
  const leftJaw = landmarks[LANDMARKS.leftJaw]!
  const rightJaw = landmarks[LANDMARKS.rightJaw]!
  const leftCheekbone = landmarks[LANDMARKS.leftCheekbone]!
  const rightCheekbone = landmarks[LANDMARKS.rightCheekbone]!

  const leftEyeInner = landmarks[LANDMARKS.leftEyeInner]!
  const leftEyeOuter = landmarks[LANDMARKS.leftEyeOuter]!
  const leftEyeTop = landmarks[LANDMARKS.leftEyeTop]!
  const leftEyeBottom = landmarks[LANDMARKS.leftEyeBottom]!
  const rightEyeInner = landmarks[LANDMARKS.rightEyeInner]!
  const rightEyeOuter = landmarks[LANDMARKS.rightEyeOuter]!
  const rightEyeTop = landmarks[LANDMARKS.rightEyeTop]!
  const rightEyeBottom = landmarks[LANDMARKS.rightEyeBottom]!

  const noseBridge = landmarks[LANDMARKS.noseBridge]!
  const noseTip = landmarks[LANDMARKS.noseTip]!
  const noseBottom = landmarks[LANDMARKS.noseBottom]!
  const leftNostril = landmarks[LANDMARKS.leftNostril]!
  const rightNostril = landmarks[LANDMARKS.rightNostril]!

  const mouthLeft = landmarks[LANDMARKS.mouthLeft]!
  const mouthRight = landmarks[LANDMARKS.mouthRight]!
  const upperLip = landmarks[LANDMARKS.upperLipTop]!
  const lowerLip = landmarks[LANDMARKS.lowerLipBottom]!

  const foreheadLeft = landmarks[LANDMARKS.foreheadLeft]!
  const foreheadRight = landmarks[LANDMARKS.foreheadRight]!

  // 基准尺寸
  const faceHeight = distance(forehead, chin)
  const faceWidth = distance(leftJaw, rightJaw)

  if (faceHeight === 0 || faceWidth === 0) return null

  // === 眼型特征 ===
  // 眼睛宽高比 → 圆度
  const leftEyeWidth = distance(leftEyeInner, leftEyeOuter)
  const leftEyeHeight = distance(leftEyeTop, leftEyeBottom)
  const rightEyeWidth = distance(rightEyeInner, rightEyeOuter)
  const rightEyeHeight = distance(rightEyeTop, rightEyeBottom)
  const avgEyeAspect = ((leftEyeHeight / leftEyeWidth) + (rightEyeHeight / rightEyeWidth)) / 2
  const eyeRoundness = Math.min(1, avgEyeAspect * 2.5) // 归一化

  // 眼角倾斜度
  const leftEyeSlant = yDiff(leftEyeInner, leftEyeOuter) / leftEyeWidth
  const rightEyeSlant = yDiff(rightEyeOuter, rightEyeInner) / rightEyeWidth
  const eyeSlant = 0.5 + ((leftEyeSlant + rightEyeSlant) / 2) * 5 // 归一化到 0-1

  // 眼距
  const eyeDistance = distance(leftEyeInner, rightEyeInner) / faceWidth

  // === 脸型特征 ===
  const faceWidthRatio = faceWidth / faceHeight

  // 颧骨突出度
  const cheekWidth = distance(leftCheekbone, rightCheekbone)
  const cheekboneProminence = cheekWidth / faceWidth

  // 下颌角锐度（通过下颌点与颧骨的相对位置）
  const jawWidth = distance(leftJaw, rightJaw)
  const jawSharpness = 1 - (jawWidth / cheekWidth) // 下颌越窄相对颧骨，越锐利

  // === 鼻子特征 ===
  const noseLength = distance(noseBridge, noseTip)
  const noseLengthRatio = noseLength / faceHeight

  // 鼻梁高度（Z 深度）
  const noseBridgeHeight = Math.abs(noseBridge.z || 0) * 10

  // 鼻尖角度
  const noseTipY = noseTip.y
  const noseBottomY = noseBottom.y
  const noseTipAngle = 0.5 + (noseTipY - noseBottomY) * 10 // 下垂为正

  // === 嘴巴特征 ===
  const mouthWidth = distance(mouthLeft, mouthRight)
  const mouthWidthRatio = mouthWidth / faceWidth

  const lipHeight = distance(upperLip, lowerLip)
  const lipFullness = lipHeight / faceHeight * 10

  // === 额头特征 ===
  const foreheadWidth = distance(foreheadLeft, foreheadRight)
  const foreheadWidthRatio = foreheadWidth / faceWidth

  return {
    eyeRoundness: clamp(eyeRoundness),
    eyeSlant: clamp(eyeSlant),
    eyeDistance: clamp(eyeDistance * 2),
    faceWidthRatio: clamp(faceWidthRatio),
    cheekboneProminence: clamp(cheekboneProminence),
    jawSharpness: clamp(jawSharpness + 0.5),
    noseLengthRatio: clamp(noseLengthRatio * 3),
    noseBridgeHeight: clamp(noseBridgeHeight),
    noseTipAngle: clamp(noseTipAngle),
    mouthWidthRatio: clamp(mouthWidthRatio * 1.5),
    lipFullness: clamp(lipFullness),
    foreheadWidthRatio: clamp(foreheadWidthRatio),
  }
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v))
}

// 基于面部特征计算神兽匹配分数 (70% 权重)
export function mapFeaturesToSpirits(features: FaceFeatureScores): SpiritMatchScores {
  const {
    eyeRoundness,
    eyeSlant,
    faceWidthRatio,
    cheekboneProminence,
    jawSharpness,
    noseLengthRatio,
    noseBridgeHeight,
    noseTipAngle,
    mouthWidthRatio,
    lipFullness,
    foreheadWidthRatio,
  } = features

  // Mom (莫): 眼圆、嘴宽、脸敦实
  const momScore
    = eyeRoundness * 0.3
    + mouthWidthRatio * 0.25
    + faceWidthRatio * 0.25
    + lipFullness * 0.1
    + (1 - jawSharpness) * 0.1

  // Naga (纳迦): 凤眼、颧骨高、轮廓利
  const nagaScore
    = (1 - eyeRoundness) * 0.25 // 细长眼
    + eyeSlant * 0.2 // 眼角上扬
    + cheekboneProminence * 0.25
    + jawSharpness * 0.2
    + noseBridgeHeight * 0.1

  // Singha (醒狮): 额宽、鼻挺、气场强
  const singhaScore
    = foreheadWidthRatio * 0.3
    + noseBridgeHeight * 0.25
    + faceWidthRatio * 0.2
    + (1 - eyeSlant) * 0.15 // 眼睛平直有威严
    + (1 - jawSharpness) * 0.1 // 下颌有力

  // Makara (摩羯): 嘴大、混血感（五官分散）、眼深
  const makaraScore
    = mouthWidthRatio * 0.35
    + (1 - eyeRoundness) * 0.2 // 深邃眼
    + (1 - faceWidthRatio) * 0.15 // 脸型偏长
    + cheekboneProminence * 0.15
    + lipFullness * 0.15

  // Hadsadiling (哈萨迪灵): 鹰钩鼻/长鼻、五官立体、疏离感
  const hadsadilingScore
    = noseLengthRatio * 0.3
    + noseTipAngle * 0.25 // 鼻尖下垂
    + noseBridgeHeight * 0.2
    + jawSharpness * 0.15 // 轮廓锐利
    + (1 - faceWidthRatio) * 0.1 // 脸型偏长

  return {
    mom: momScore,
    naga: nagaScore,
    singha: singhaScore,
    makara: makaraScore,
    hadsadiling: hadsadilingScore,
  }
}

// 归一化分数（总和为 1）
export function normalizeScores(scores: SpiritMatchScores): SpiritMatchScores {
  const total = Object.values(scores).reduce((sum, v) => sum + v, 0)
  if (total === 0) {
    return { mom: 0.2, naga: 0.2, singha: 0.2, makara: 0.2, hadsadiling: 0.2 }
  }
  return {
    mom: scores.mom / total,
    naga: scores.naga / total,
    singha: scores.singha / total,
    makara: scores.makara / total,
    hadsadiling: scores.hadsadiling / total,
  }
}

// 获取主导神兽
export function getDominantSpirit(scores: SpiritMatchScores): string {
  let maxScore = 0
  let dominant = 'mom'
  for (const [id, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      dominant = id
    }
  }
  return dominant
}

// 面部特征累积器（用于稳定结果）
export class FaceFeatureAccumulator {
  private samples: FaceFeatureScores[] = []
  private readonly maxSamples = 30 // 约 1 秒数据

  addSample(features: FaceFeatureScores) {
    this.samples.push(features)
    if (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }
  }

  getAverageFeatures(): FaceFeatureScores | null {
    if (this.samples.length === 0) return null

    const count = this.samples.length
    return {
      eyeRoundness: this.samples.reduce((sum, s) => sum + s.eyeRoundness, 0) / count,
      eyeSlant: this.samples.reduce((sum, s) => sum + s.eyeSlant, 0) / count,
      eyeDistance: this.samples.reduce((sum, s) => sum + s.eyeDistance, 0) / count,
      faceWidthRatio: this.samples.reduce((sum, s) => sum + s.faceWidthRatio, 0) / count,
      cheekboneProminence: this.samples.reduce((sum, s) => sum + s.cheekboneProminence, 0) / count,
      jawSharpness: this.samples.reduce((sum, s) => sum + s.jawSharpness, 0) / count,
      noseLengthRatio: this.samples.reduce((sum, s) => sum + s.noseLengthRatio, 0) / count,
      noseBridgeHeight: this.samples.reduce((sum, s) => sum + s.noseBridgeHeight, 0) / count,
      noseTipAngle: this.samples.reduce((sum, s) => sum + s.noseTipAngle, 0) / count,
      mouthWidthRatio: this.samples.reduce((sum, s) => sum + s.mouthWidthRatio, 0) / count,
      lipFullness: this.samples.reduce((sum, s) => sum + s.lipFullness, 0) / count,
      foreheadWidthRatio: this.samples.reduce((sum, s) => sum + s.foreheadWidthRatio, 0) / count,
    }
  }

  getSampleCount(): number {
    return this.samples.length
  }

  reset() {
    this.samples = []
  }
}
