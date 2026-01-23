import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

// 静态面部结构特征（用于气质匹配，而非表情匹配）
export interface FacialStructure {
  // 脸型指数
  faceRatio: number        // 脸宽/脸高 (圆脸 > 0.8, 长脸 < 0.7)

  // 五官比例
  eyeDistance: number      // 两眼间距/脸宽 (宽眼距 > 0.35)
  eyeSize: number          // 眼睛高度/脸高 (大眼 > 0.06)
  browHeight: number       // 眉眼距/脸高 (高眉 > 0.08)
  noseLength: number       // 鼻长/脸高
  mouthWidth: number       // 嘴宽/脸宽
  lipThickness: number     // 唇厚/嘴高

  // 脸部轮廓
  jawAngularity: number    // 下颌角锐度 (0-1, 1=方脸)
  cheekboneWidth: number   // 颧骨宽度/脸宽
}

// 新版守护神分数（5个：Chang, Singha, Kinnari, Garuda, Mom）
export interface SpiritScores {
  chang: number    // 圣象 - 温和稳重
  singha: number   // 狮王 - 自信勇敢
  kinnari: number  // 天女 - 优雅敏感
  garuda: number   // 金翅 - 正义冒险
  mom: number      // 秘兽 - 神秘多变
}

// MediaPipe Face Mesh 关键点索引
const LANDMARKS = {
  // 脸部边界
  foreheadTop: 10,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,

  // 眉毛
  leftBrowInner: 107,
  leftBrowOuter: 70,
  leftBrowTop: 105,
  rightBrowInner: 336,
  rightBrowOuter: 300,
  rightBrowTop: 334,

  // 眼睛
  leftEyeInner: 133,
  leftEyeOuter: 33,
  leftEyeTop: 159,
  leftEyeBottom: 145,
  rightEyeInner: 362,
  rightEyeOuter: 263,
  rightEyeTop: 386,
  rightEyeBottom: 374,

  // 鼻子
  noseBridge: 6,
  noseTip: 4,
  noseBottom: 2,

  // 嘴巴
  mouthLeft: 61,
  mouthRight: 291,
  upperLipTop: 0,
  lowerLipBottom: 17,

  // 下颌
  jawLeft: 172,
  jawRight: 397,
  jawAngleLeft: 136,
  jawAngleRight: 365,

  // 颧骨
  cheekboneLeft: 123,
  cheekboneRight: 352,
}

// 计算两点距离
function distance(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
  return Math.sqrt(
    (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + ((p1.z || 0) - (p2.z || 0)) ** 2,
  )
}

// 从 landmarks 提取静态面部结构特征
export function extractFacialStructure(landmarks: NormalizedLandmark[]): FacialStructure | null {
  if (landmarks.length < 468) {
    return null
  }

  // 获取关键点
  const forehead = landmarks[LANDMARKS.foreheadTop]!
  const chin = landmarks[LANDMARKS.chin]!
  const leftCheek = landmarks[LANDMARKS.leftCheek]!
  const rightCheek = landmarks[LANDMARKS.rightCheek]!

  const leftEyeInner = landmarks[LANDMARKS.leftEyeInner]!
  const leftEyeOuter = landmarks[LANDMARKS.leftEyeOuter]!
  const leftEyeTop = landmarks[LANDMARKS.leftEyeTop]!
  const leftEyeBottom = landmarks[LANDMARKS.leftEyeBottom]!
  const rightEyeInner = landmarks[LANDMARKS.rightEyeInner]!
  const rightEyeOuter = landmarks[LANDMARKS.rightEyeOuter]!
  const rightEyeTop = landmarks[LANDMARKS.rightEyeTop]!
  const rightEyeBottom = landmarks[LANDMARKS.rightEyeBottom]!

  const leftBrowTop = landmarks[LANDMARKS.leftBrowTop]!
  const rightBrowTop = landmarks[LANDMARKS.rightBrowTop]!

  const noseBridge = landmarks[LANDMARKS.noseBridge]!
  const noseTip = landmarks[LANDMARKS.noseTip]!

  const mouthLeft = landmarks[LANDMARKS.mouthLeft]!
  const mouthRight = landmarks[LANDMARKS.mouthRight]!
  const upperLip = landmarks[LANDMARKS.upperLipTop]!
  const lowerLip = landmarks[LANDMARKS.lowerLipBottom]!

  const jawAngleLeft = landmarks[LANDMARKS.jawAngleLeft]!
  const jawAngleRight = landmarks[LANDMARKS.jawAngleRight]!
  const cheekboneLeft = landmarks[LANDMARKS.cheekboneLeft]!
  const cheekboneRight = landmarks[LANDMARKS.cheekboneRight]!

  // 计算基准尺寸
  const faceHeight = distance(forehead, chin)
  const faceWidth = distance(leftCheek, rightCheek)

  if (faceHeight === 0 || faceWidth === 0) {
    return null
  }

  // 1. 脸型指数 (脸宽/脸高)
  const faceRatio = faceWidth / faceHeight

  // 2. 眼距 (两眼内角距离/脸宽)
  const eyeInnerDistance = distance(leftEyeInner, rightEyeInner)
  const eyeDistance = eyeInnerDistance / faceWidth

  // 3. 眼睛大小 (眼睛高度/脸高)
  const leftEyeHeight = distance(leftEyeTop, leftEyeBottom)
  const rightEyeHeight = distance(rightEyeTop, rightEyeBottom)
  const eyeSize = ((leftEyeHeight + rightEyeHeight) / 2) / faceHeight

  // 4. 眉眼距 (眉毛到眼睛的距离/脸高)
  const leftBrowEyeDist = Math.abs(leftBrowTop.y - leftEyeTop.y)
  const rightBrowEyeDist = Math.abs(rightBrowTop.y - rightEyeTop.y)
  const browHeight = ((leftBrowEyeDist + rightBrowEyeDist) / 2) / faceHeight

  // 5. 鼻长 (鼻梁到鼻尖/脸高)
  const noseLength = distance(noseBridge, noseTip) / faceHeight

  // 6. 嘴宽 (嘴角距离/脸宽)
  const mouthWidth = distance(mouthLeft, mouthRight) / faceWidth

  // 7. 唇厚 (上下唇距离/嘴高)
  const lipHeight = distance(upperLip, lowerLip)
  const lipThickness = lipHeight / faceHeight

  // 8. 下颌角锐度 (通过下颌角位置估算)
  // 方脸的下颌角更接近90度，圆脸的下颌角更钝
  const jawWidth = distance(jawAngleLeft, jawAngleRight)
  const jawAngularity = Math.min(1, jawWidth / faceWidth)

  // 9. 颧骨宽度
  const cheekboneWidthVal = distance(cheekboneLeft, cheekboneRight)
  const cheekboneWidth = cheekboneWidthVal / faceWidth

  return {
    faceRatio,
    eyeDistance,
    eyeSize,
    browHeight,
    noseLength,
    mouthWidth,
    lipThickness,
    jawAngularity,
    cheekboneWidth,
  }
}

// 静态面部特征到守护神的映射
// Chang 圣象: 圆脸 + 大眼距 + 厚唇 → 温和包容
// Singha 狮王: 方脸 + 宽颧骨 + 大嘴 → 自信有力
// Kinnari 天女: 长脸 + 大眼 + 高眉弓 → 优雅精致
// Garuda 金翅: 窄脸 + 高鼻 + 薄唇 → 锐利专注
// Mom 秘兽: 特征混合/异常值 → 难以归类

export function mapStructureToSpirits(structure: FacialStructure): SpiritScores {
  const {
    faceRatio,
    eyeDistance,
    eyeSize,
    browHeight,
    noseLength,
    mouthWidth,
    lipThickness,
    jawAngularity,
    cheekboneWidth,
  } = structure

  // Chang 圣象: 圆脸、大眼距、厚唇、宽嘴
  const changScore =
    (faceRatio > 0.75 ? (faceRatio - 0.75) * 4 : 0) * 0.25 +  // 圆脸加分
    (eyeDistance > 0.3 ? (eyeDistance - 0.3) * 5 : 0) * 0.25 + // 宽眼距加分
    (lipThickness > 0.04 ? (lipThickness - 0.04) * 10 : 0) * 0.25 + // 厚唇加分
    (mouthWidth > 0.4 ? (mouthWidth - 0.4) * 3 : 0) * 0.25     // 宽嘴加分

  // Singha 狮王: 方脸、宽颧骨、大嘴、下颌角明显
  const singhaScore =
    (jawAngularity > 0.85 ? (jawAngularity - 0.85) * 6 : 0) * 0.3 + // 方下颌加分
    (cheekboneWidth > 0.9 ? (cheekboneWidth - 0.9) * 10 : 0) * 0.3 + // 宽颧骨加分
    (mouthWidth > 0.45 ? (mouthWidth - 0.45) * 4 : 0) * 0.2 +       // 大嘴加分
    (faceRatio > 0.8 ? (faceRatio - 0.8) * 5 : 0) * 0.2             // 宽脸加分

  // Kinnari 天女: 长脸、大眼、高眉弓、小嘴
  const kinnariScore =
    (faceRatio < 0.72 ? (0.72 - faceRatio) * 5 : 0) * 0.25 +   // 长脸加分
    (eyeSize > 0.05 ? (eyeSize - 0.05) * 15 : 0) * 0.3 +       // 大眼加分
    (browHeight > 0.06 ? (browHeight - 0.06) * 10 : 0) * 0.25 + // 高眉弓加分
    (mouthWidth < 0.38 ? (0.38 - mouthWidth) * 4 : 0) * 0.2     // 小嘴加分

  // Garuda 金翅: 窄脸、高鼻、薄唇、锐利轮廓
  const garudaScore =
    (faceRatio < 0.7 ? (0.7 - faceRatio) * 6 : 0) * 0.25 +      // 窄脸加分
    (noseLength > 0.12 ? (noseLength - 0.12) * 8 : 0) * 0.3 +   // 高鼻加分
    (lipThickness < 0.035 ? (0.035 - lipThickness) * 20 : 0) * 0.25 + // 薄唇加分
    (jawAngularity > 0.8 ? (jawAngularity - 0.8) * 5 : 0) * 0.2  // 锐利下颌加分

  // Mom 秘兽: 特征组合异常、难以归类
  // 计算各项特征偏离"平均值"的程度
  const avgFaceRatio = 0.75
  const avgEyeSize = 0.05
  const avgNoseLength = 0.11
  const avgMouthWidth = 0.42
  const avgLipThickness = 0.04

  const deviationScore =
    Math.abs(faceRatio - avgFaceRatio) * 3 +
    Math.abs(eyeSize - avgEyeSize) * 15 +
    Math.abs(noseLength - avgNoseLength) * 8 +
    Math.abs(mouthWidth - avgMouthWidth) * 3 +
    Math.abs(lipThickness - avgLipThickness) * 15

  // Mom 得分 = 偏离程度高 + 其他守护神分数都不突出
  const maxOtherScore = Math.max(changScore, singhaScore, kinnariScore, garudaScore)
  const momScore = deviationScore * 0.5 + (maxOtherScore < 0.3 ? (0.3 - maxOtherScore) * 2 : 0)

  // 归一化
  const raw = { chang: changScore, singha: singhaScore, kinnari: kinnariScore, garuda: garudaScore, mom: momScore }
  const total = Object.values(raw).reduce((sum, v) => sum + Math.max(0, v), 0)

  if (total === 0) {
    // 默认分布
    return { chang: 0.28, singha: 0.25, kinnari: 0.20, garuda: 0.17, mom: 0.10 }
  }

  return {
    chang: Math.max(0, changScore) / total,
    singha: Math.max(0, singhaScore) / total,
    kinnari: Math.max(0, kinnariScore) / total,
    garuda: Math.max(0, garudaScore) / total,
    mom: Math.max(0, momScore) / total,
  }
}

// 结构特征累积器（用于平滑抖动）
export class StructureAccumulator {
  private samples: FacialStructure[] = []
  private readonly maxSamples = 15 // 约 0.5 秒的数据 (30fps)

  addSample(structure: FacialStructure) {
    this.samples.push(structure)
    if (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }
  }

  getAverageStructure(): FacialStructure | null {
    if (this.samples.length === 0) {
      return null
    }

    const sum = this.samples.reduce(
      (acc, s) => ({
        faceRatio: acc.faceRatio + s.faceRatio,
        eyeDistance: acc.eyeDistance + s.eyeDistance,
        eyeSize: acc.eyeSize + s.eyeSize,
        browHeight: acc.browHeight + s.browHeight,
        noseLength: acc.noseLength + s.noseLength,
        mouthWidth: acc.mouthWidth + s.mouthWidth,
        lipThickness: acc.lipThickness + s.lipThickness,
        jawAngularity: acc.jawAngularity + s.jawAngularity,
        cheekboneWidth: acc.cheekboneWidth + s.cheekboneWidth,
      }),
      {
        faceRatio: 0, eyeDistance: 0, eyeSize: 0, browHeight: 0,
        noseLength: 0, mouthWidth: 0, lipThickness: 0, jawAngularity: 0, cheekboneWidth: 0,
      },
    )

    const count = this.samples.length
    return {
      faceRatio: sum.faceRatio / count,
      eyeDistance: sum.eyeDistance / count,
      eyeSize: sum.eyeSize / count,
      browHeight: sum.browHeight / count,
      noseLength: sum.noseLength / count,
      mouthWidth: sum.mouthWidth / count,
      lipThickness: sum.lipThickness / count,
      jawAngularity: sum.jawAngularity / count,
      cheekboneWidth: sum.cheekboneWidth / count,
    }
  }

  getSampleCount(): number {
    return this.samples.length
  }

  reset() {
    this.samples = []
  }
}

// 获取主导守护神
export function getDominantSpirit(scores: SpiritScores): string {
  let maxScore = 0
  let dominant = 'chang'

  Object.entries(scores).forEach(([id, score]) => {
    if (score > maxScore) {
      maxScore = score
      dominant = id
    }
  })

  return dominant
}
