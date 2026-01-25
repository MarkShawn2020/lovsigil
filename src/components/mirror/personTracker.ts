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
function isValidBlendshapes(blendshapes: Classifications | undefined): boolean {
  if (!blendshapes || !blendshapes.categories || blendshapes.categories.length === 0) {
    return false // 没有 blendshapes 数据，可能是误检测
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

  // 真实人脸应该有一些面部活动（眨眼、嘴部运动等）
  // 误检测通常 totalScore 非常小或 maxScore 异常
  // 放宽条件：只要有最小程度的面部活动即可
  if (totalScore < 0.05 && maxScore < 0.02) {
    return false // 几乎没有任何面部活动，可能是误检测
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

  // 几何验证：真实人脸应满足以下条件
  const MIN_FACE_SIZE = 0.06 // 至少占画面 6%

  // 修复：使用 min/max 处理镜像和头部转向情况
  const minX = Math.min(leftCheek.x, rightCheek.x)
  const maxX = Math.max(leftCheek.x, rightCheek.x)
  const minY = Math.min(forehead.y, chin.y)
  const maxY = Math.max(forehead.y, chin.y)

  // 鼻尖应该在脸部边界框内
  const noseInCenter = noseTip.x > minX && noseTip.x < maxX
    && noseTip.y > minY && noseTip.y < maxY

  const isValid = size >= MIN_FACE_SIZE
    && aspectRatio >= 0.5
    && aspectRatio <= 1.3
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

  // 匹配阈值（归一化坐标距离）
  private readonly matchThreshold = 0.15
  // 消失多少帧后移除
  private readonly maxMissedFrames = 30

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
      // 检查是否与已保留的脸重叠（使用多重检测）
      const isDuplicate = detectedFaces.some((kept) => {
        // 方法1：中心点距离（相对于脸部大小）
        const dist = positionDistance(face.center, kept.center)
        const avgSize = (face.size + kept.size) / 2
        if (dist < avgSize * 0.8) return true // 中心距离小于平均脸部大小的 80%

        // 方法2：边界框重叠
        if (facesOverlap(face, kept, 0.3)) return true

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
    // 对于检测帧数少的人（可能是误检测）使用更短的超时时间
    const toRemove: string[] = []
    for (const [personId, person] of this.persons) {
      const missedFrames = this.currentFrame - person.lastSeenFrame
      // 检测帧数少于 15 帧的人，只等 5 帧就移除（快速清理误检测）
      // 检测帧数多的人，等 30 帧才移除（避免丢失真实用户）
      const timeout = person.frameCount < 15 ? 5 : this.maxMissedFrames
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
