import type { Classifications, NormalizedLandmark } from '@mediapipe/tasks-vision'

import type { FaceFeatureScores, SpiritMatchScores } from './faceFeatureAnalyzer'
import {
  extractFaceFeatures,
  FaceFeatureAccumulator,
  getDominantSpirit,
  mapFeaturesToSpirits,
  normalizeScores,
} from './faceFeatureAnalyzer'

// 验证 blendshapes 是否来自真实人脸
// 真实人脸的 blendshapes 会有合理的分布，误检测的值通常异常
// 注意：合照中远处的小脸 blendshapes 数值可能很低，应放宽条件
function isValidBlendshapes(blendshapes: Classifications | undefined): boolean {
  // 没有 blendshapes 数据时，不直接拒绝（可能是远处小脸）
  // 让几何验证来把关
  if (!blendshapes || !blendshapes.categories || blendshapes.categories.length === 0) {
    return true // 放宽：允许没有 blendshapes 的检测通过
  }

  const categories = blendshapes.categories

  // 计算所有 blendshapes 的总分（排除 _neutral）
  let totalScore = 0
  let maxScore = 0
  for (const cat of categories) {
    if (cat.categoryName !== '_neutral') {
      totalScore += cat.score
      if (cat.score > maxScore) maxScore = cat.score
    }
  }

  // 极端放宽：只过滤完全没有任何面部特征的检测
  // 远处的人脸、静止的人脸都可能有很低的 blendshapes
  if (totalScore < 0.01 && maxScore < 0.005) {
    return false // 几乎没有任何面部特征，可能是误检测
  }

  return true
}

export interface TrackedPerson {
  id: string
  // 脸部边界框（归一化坐标 0-1）
  center: { x: number, y: number }
  size: number // 脸部大小（用于匹配）
  // 面部特征数据（静态）
  accumulator: FaceFeatureAccumulator
  currentFeatures: FaceFeatureScores | null
  // 守护灵亲和度（实时）
  spiritScores: SpiritMatchScores
  dominantSpirit: string
  // 追踪状态
  lastSeenFrame: number
  frameCount: number // 累计被检测到的帧数
}

interface DetectedFace {
  landmarks: NormalizedLandmark[]
  center: { x: number, y: number }
  size: number
  aspectRatio: number // 宽高比，用于验证
}

interface FaceMetrics {
  center: { x: number, y: number }
  size: number
  aspectRatio: number
  isValid: boolean // 是否通过几何验证
}

// 从 landmarks 计算脸部中心、大小和几何验证
function computeFaceMetrics(landmarks: NormalizedLandmark[]): FaceMetrics {
  const invalid: FaceMetrics = { center: { x: 0.5, y: 0.5 }, size: 0, aspectRatio: 0, isValid: false }

  if (landmarks.length < 468) {
    return invalid
  }

  // 使用关键点计算边界框
  // 鼻尖(4), 左脸(234), 右脸(454), 额头(10), 下巴(152)
  const leftCheek = landmarks[234]!
  const rightCheek = landmarks[454]!
  const forehead = landmarks[10]!
  const chin = landmarks[152]!
  const noseTip = landmarks[4]!

  const centerX = (leftCheek.x + rightCheek.x) / 2
  const centerY = (forehead.y + chin.y) / 2

  const width = Math.abs(rightCheek.x - leftCheek.x)
  const height = Math.abs(chin.y - forehead.y)
  const size = (width + height) / 2
  const aspectRatio = height > 0 ? width / height : 0

  // 几何验证：大幅放宽以支持合照场景
  // 2% 允许 6-8 人合照时远处的小脸也能被检测
  const MIN_FACE_SIZE = 0.02 // 至少占画面 2%

  // 修复：使用 min/max 处理镜像和头部转向情况
  const minX = Math.min(leftCheek.x, rightCheek.x)
  const maxX = Math.max(leftCheek.x, rightCheek.x)
  const minY = Math.min(forehead.y, chin.y)
  const maxY = Math.max(forehead.y, chin.y)

  // 鼻尖应该在脸部边界框内（放宽：允许边缘情况）
  // 扩大边界框 20% 以容忍极端角度
  const boxWidth = maxX - minX
  const boxHeight = maxY - minY
  const noseInCenter = noseTip.x > minX - boxWidth * 0.2 && noseTip.x < maxX + boxWidth * 0.2
    && noseTip.y > minY - boxHeight * 0.2 && noseTip.y < maxY + boxHeight * 0.2

  // 放宽宽高比限制：支持更多角度
  // 0.3-1.8 覆盖侧脸、仰头、低头等极端姿态
  const isValid = size >= MIN_FACE_SIZE
    && aspectRatio >= 0.3
    && aspectRatio <= 1.8
    && noseInCenter

  return {
    center: { x: centerX, y: centerY },
    size,
    aspectRatio,
    isValid,
  }
}

// 计算两个位置之间的距离
function positionDistance(a: { x: number, y: number }, b: { x: number, y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

// 生成唯一 ID
function generateId(): string {
  return `person_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// 默认分数
const DEFAULT_SCORES: SpiritMatchScores = {
  mom: 0.2,
  naga: 0.2,
  singha: 0.2,
  makara: 0.2,
  hadsadiling: 0.2,
}

// 检测两个脸是否重叠（边界框重叠超过阈值）
function facesOverlap(a: DetectedFace, b: DetectedFace, overlapThreshold = 0.3): boolean {
  // 计算两个脸的边界框（假设脸是正方形，以 center 为中心，size 为边长）
  const aHalf = a.size / 2
  const bHalf = b.size / 2

  const aLeft = a.center.x - aHalf
  const aRight = a.center.x + aHalf
  const aTop = a.center.y - aHalf
  const aBottom = a.center.y + aHalf

  const bLeft = b.center.x - bHalf
  const bRight = b.center.x + bHalf
  const bTop = b.center.y - bHalf
  const bBottom = b.center.y + bHalf

  // 计算重叠区域
  const overlapLeft = Math.max(aLeft, bLeft)
  const overlapRight = Math.min(aRight, bRight)
  const overlapTop = Math.max(aTop, bTop)
  const overlapBottom = Math.min(aBottom, bBottom)

  if (overlapRight <= overlapLeft || overlapBottom <= overlapTop) {
    return false // 没有重叠
  }

  const overlapArea = (overlapRight - overlapLeft) * (overlapBottom - overlapTop)
  const smallerArea = Math.min(a.size * a.size, b.size * b.size)

  // 如果重叠面积超过较小脸面积的阈值，认为是重复
  return overlapArea / smallerArea > overlapThreshold
}

export class PersonTracker {
  private persons: Map<string, TrackedPerson> = new Map()
  private currentFrame = 0

  // 匹配阈值（归一化坐标距离）- 放宽到 0.2 以容忍更多移动
  private readonly matchThreshold = 0.2

  // 处理新一帧的脸部检测结果
  update(faceLandmarksList: NormalizedLandmark[][], faceBlendshapesList: Classifications[] = []): TrackedPerson[] {
    this.currentFrame++

    // 1. 将检测到的脸转换为 DetectedFace，同时进行几何验证 + blendshapes 验证
    const rawFaces: DetectedFace[] = []
    for (let i = 0; i < faceLandmarksList.length; i++) {
      const landmarks = faceLandmarksList[i]!
      const blendshapes = faceBlendshapesList[i]

      // 几何验证
      const metrics = computeFaceMetrics(landmarks)
      if (!metrics.isValid) continue

      // Blendshapes 验证（如果有数据）- 过滤手臂等误检测
      if (faceBlendshapesList.length > 0 && !isValidBlendshapes(blendshapes)) {
        continue
      }

      rawFaces.push({
        landmarks,
        center: metrics.center,
        size: metrics.size,
        aspectRatio: metrics.aspectRatio,
      })
    }

    // 1.5 去重：过滤 MediaPipe 对同一张脸的重复检测
    // 按脸部大小降序排序，优先保留大脸
    const sortedRaw = [...rawFaces].sort((a, b) => b.size - a.size)
    const detectedFaces: DetectedFace[] = []
    for (const face of sortedRaw) {
      // 检查是否与已保留的脸重叠
      // 大幅放宽：只有非常接近的脸才被视为重复
      const isDuplicate = detectedFaces.some((kept) => {
        // 方法1：中心点距离（相对于较小脸的大小）
        // 放宽到 30%：只有当两张脸中心距离 < 小脸直径的 30% 时才认为是重复
        const dist = positionDistance(face.center, kept.center)
        const smallerSize = Math.min(face.size, kept.size)
        if (dist < smallerSize * 0.3) return true

        // 方法2：边界框重叠（提高阈值到 70%）
        // 只有当重叠面积超过小脸的 70% 时才认为是重复
        if (facesOverlap(face, kept, 0.7)) return true

        return false
      })
      if (!isDuplicate) {
        detectedFaces.push(face)
      }
    }

    // 2. 贪婪匹配：为每个检测到的脸找最近的已追踪人
    const matched = new Set<string>()
    const usedFaces = new Set<number>()

    // 对检测到的脸按大小排序（优先匹配大脸/近的人）
    const sortedFaceIndices = detectedFaces
      .map((_, i) => i)
      .sort((a, b) => detectedFaces[b]!.size - detectedFaces[a]!.size)

    for (const faceIdx of sortedFaceIndices) {
      const face = detectedFaces[faceIdx]!
      let bestMatch: string | null = null
      let bestDistance = this.matchThreshold

      // 找最近的未匹配的已追踪人
      for (const [personId, person] of this.persons) {
        if (matched.has(personId))
          continue

        const dist = positionDistance(face.center, person.center)
        if (dist < bestDistance) {
          bestDistance = dist
          bestMatch = personId
        }
      }

      if (bestMatch) {
        // 更新已有人
        const person = this.persons.get(bestMatch)!
        person.center = face.center
        person.size = face.size
        person.lastSeenFrame = this.currentFrame
        person.frameCount++

        // 更新面部特征（静态）
        const features = extractFaceFeatures(face.landmarks)
        if (features) {
          person.accumulator.addSample(features)
          person.currentFeatures = features

          // 使用累积的平均特征计算守护灵亲和度
          const avgFeatures = person.accumulator.getAverageFeatures()
          if (avgFeatures) {
            const rawScores = mapFeaturesToSpirits(avgFeatures)
            person.spiritScores = normalizeScores(rawScores)
            person.dominantSpirit = getDominantSpirit(person.spiritScores)
          }

          // 调试：每 60 帧打印一次特征稳定性报告
          if (this.currentFrame % 60 === 0) {
            person.accumulator.debugPrint()
          }
        }

        matched.add(bestMatch)
        usedFaces.add(faceIdx)
      }
    }

    // 3. 为未匹配的脸创建新的 TrackedPerson
    for (let i = 0; i < detectedFaces.length; i++) {
      if (usedFaces.has(i))
        continue

      const face = detectedFaces[i]!
      const features = extractFaceFeatures(face.landmarks)
      const accumulator = new FaceFeatureAccumulator()

      let spiritScores = DEFAULT_SCORES
      let dominantSpirit = 'mom'

      if (features) {
        accumulator.addSample(features)
        const rawScores = mapFeaturesToSpirits(features)
        spiritScores = normalizeScores(rawScores)
        dominantSpirit = getDominantSpirit(spiritScores)
      }

      const newPerson: TrackedPerson = {
        id: generateId(),
        center: face.center,
        size: face.size,
        accumulator,
        currentFeatures: features,
        spiritScores,
        dominantSpirit,
        lastSeenFrame: this.currentFrame,
        frameCount: 1,
      }

      this.persons.set(newPerson.id, newPerson)
    }

    // 4. 移除消失太久的人
    // 放宽超时条件，避免多人场景下因短暂遮挡导致人员被移除
    const toRemove: string[] = []
    for (const [personId, person] of this.persons) {
      const missedFrames = this.currentFrame - person.lastSeenFrame
      // 检测帧数少于 10 帧的人（新出现），等 15 帧才移除（约 0.5 秒）
      // 检测帧数多的人（已稳定），等 45 帧才移除（约 1.5 秒）
      const timeout = person.frameCount < 10 ? 15 : 45
      if (missedFrames > timeout) {
        toRemove.push(personId)
      }
    }
    for (const id of toRemove) {
      this.persons.delete(id)
    }

    // 5. 返回当前追踪的所有人（浅拷贝以触发 React 更新）
    return Array.from(this.persons.values()).map(p => ({ ...p }))
  }

  // 获取所有当前追踪的人
  getPersons(): TrackedPerson[] {
    return Array.from(this.persons.values())
  }

  // 获取"主要"人物（最大/最近镜头中心的）
  getPrimaryPerson(): TrackedPerson | null {
    const persons = this.getPersons()
    if (persons.length === 0)
      return null

    // 按脸部大小排序，返回最大的
    return persons.sort((a, b) => b.size - a.size)[0] ?? null
  }

  // 根据点击位置找最近的人（坐标已归一化 0-1）
  findPersonNearPosition(x: number, y: number): TrackedPerson | null {
    let closest: TrackedPerson | null = null
    let minDist = 0.2 // 最大距离阈值

    for (const person of this.persons.values()) {
      const dist = positionDistance({ x, y }, person.center)
      if (dist < minDist) {
        minDist = dist
        closest = person
      }
    }

    return closest
  }

  // 重置所有追踪
  reset(): void {
    this.persons.clear()
    this.currentFrame = 0
  }

  // 获取追踪人数
  getCount(): number {
    return this.persons.size
  }
}
