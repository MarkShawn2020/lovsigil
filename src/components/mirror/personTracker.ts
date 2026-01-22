import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

import type { ExpressionScores, SpiritScores } from './facsAnalyzer'
import { ExpressionAccumulator, extractExpressionScores, getExpressionDescription, getNormalizedSpiritScores } from './facsAnalyzer'

export interface TrackedPerson {
  id: string
  // 脸部边界框（归一化坐标 0-1）
  center: { x: number, y: number }
  size: number // 脸部大小（用于匹配）
  // 表情数据
  accumulator: ExpressionAccumulator
  currentExpression: ExpressionScores | null
  expressionDescription: string
  // 守护灵亲和度（实时）
  spiritScores: SpiritScores
  dominantSpirit: string
  // 追踪状态
  lastSeenFrame: number
  frameCount: number // 累计被检测到的帧数
}

interface DetectedFace {
  landmarks: NormalizedLandmark[]
  center: { x: number, y: number }
  size: number
}

// 从 landmarks 计算脸部中心和大小
function computeFaceMetrics(landmarks: NormalizedLandmark[]): { center: { x: number, y: number }, size: number } {
  if (landmarks.length < 468) {
    return { center: { x: 0.5, y: 0.5 }, size: 0 }
  }

  // 使用关键点计算边界框
  // 鼻尖(4), 左脸(234), 右脸(454), 额头(10), 下巴(152)
  const noseTip = landmarks[4]!
  const leftCheek = landmarks[234]!
  const rightCheek = landmarks[454]!
  const forehead = landmarks[10]!
  const chin = landmarks[152]!

  const centerX = (leftCheek.x + rightCheek.x) / 2
  const centerY = (forehead.y + chin.y) / 2

  // 脸部大小 = 宽度和高度的平均
  const width = Math.abs(rightCheek.x - leftCheek.x)
  const height = Math.abs(chin.y - forehead.y)
  const size = (width + height) / 2

  return {
    center: { x: centerX, y: centerY },
    size,
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

export class PersonTracker {
  private persons: Map<string, TrackedPerson> = new Map()
  private currentFrame = 0

  // 匹配阈值（归一化坐标距离）
  private readonly matchThreshold = 0.15
  // 消失多少帧后移除
  private readonly maxMissedFrames = 30

  // 处理新一帧的脸部检测结果
  update(faceLandmarksList: NormalizedLandmark[][]): TrackedPerson[] {
    this.currentFrame++

    // 1. 将检测到的脸转换为 DetectedFace
    const detectedFaces: DetectedFace[] = faceLandmarksList.map((landmarks) => {
      const metrics = computeFaceMetrics(landmarks)
      return {
        landmarks,
        center: metrics.center,
        size: metrics.size,
      }
    })

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

        // 更新表情
        const scores = extractExpressionScores(face.landmarks)
        person.accumulator.addSample(scores)
        person.currentExpression = scores
        person.expressionDescription = getExpressionDescription(scores)

        // 更新守护灵亲和度
        person.spiritScores = getNormalizedSpiritScores(scores)
        person.dominantSpirit = this.getDominantSpirit(person.spiritScores)

        matched.add(bestMatch)
        usedFaces.add(faceIdx)
      }
    }

    // 3. 为未匹配的脸创建新的 TrackedPerson
    for (let i = 0; i < detectedFaces.length; i++) {
      if (usedFaces.has(i))
        continue

      const face = detectedFaces[i]!
      const scores = extractExpressionScores(face.landmarks)
      const accumulator = new ExpressionAccumulator()
      accumulator.addSample(scores)
      const spiritScores = getNormalizedSpiritScores(scores)

      const newPerson: TrackedPerson = {
        id: generateId(),
        center: face.center,
        size: face.size,
        accumulator,
        currentExpression: scores,
        expressionDescription: getExpressionDescription(scores),
        spiritScores,
        dominantSpirit: this.getDominantSpirit(spiritScores),
        lastSeenFrame: this.currentFrame,
        frameCount: 1,
      }

      this.persons.set(newPerson.id, newPerson)
    }

    // 4. 移除消失太久的人
    const toRemove: string[] = []
    for (const [personId, person] of this.persons) {
      if (this.currentFrame - person.lastSeenFrame > this.maxMissedFrames) {
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

  // 获取主导守护灵
  private getDominantSpirit(scores: SpiritScores): string {
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
}
