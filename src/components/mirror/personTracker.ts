import type { Classifications, NormalizedLandmark } from '@mediapipe/tasks-vision'

// 验证 blendshapes 是否来自真实人脸
function isValidBlendshapes(blendshapes: Classifications | undefined): boolean {
  if (!blendshapes || !blendshapes.categories || blendshapes.categories.length === 0) {
    return true // 放宽：允许没有 blendshapes 的检测通过
  }

  const categories = blendshapes.categories

  let totalScore = 0
  let maxScore = 0
  for (const cat of categories) {
    if (cat.categoryName !== '_neutral') {
      totalScore += cat.score
      if (cat.score > maxScore) maxScore = cat.score
    }
  }

  // 极端放宽：只过滤完全没有任何面部特征的检测
  if (totalScore < 0.01 && maxScore < 0.005) {
    return false
  }

  return true
}

export interface TrackedPerson {
  id: string
  // 脸部边界框（归一化坐标 0-1）
  center: { x: number, y: number }
  size: number
  // 追踪状态
  lastSeenFrame: number
  frameCount: number
}

interface DetectedFace {
  landmarks: NormalizedLandmark[]
  center: { x: number, y: number }
  size: number
  aspectRatio: number
}

interface FaceMetrics {
  center: { x: number, y: number }
  size: number
  aspectRatio: number
  isValid: boolean
}

// 从 landmarks 计算脸部中心、大小和几何验证
function computeFaceMetrics(landmarks: NormalizedLandmark[]): FaceMetrics {
  const invalid: FaceMetrics = { center: { x: 0.5, y: 0.5 }, size: 0, aspectRatio: 0, isValid: false }

  if (landmarks.length < 468) {
    return invalid
  }

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

  const MIN_FACE_SIZE = 0.02

  const minX = Math.min(leftCheek.x, rightCheek.x)
  const maxX = Math.max(leftCheek.x, rightCheek.x)
  const minY = Math.min(forehead.y, chin.y)
  const maxY = Math.max(forehead.y, chin.y)

  const boxWidth = maxX - minX
  const boxHeight = maxY - minY
  const noseInCenter = noseTip.x > minX - boxWidth * 0.2 && noseTip.x < maxX + boxWidth * 0.2
    && noseTip.y > minY - boxHeight * 0.2 && noseTip.y < maxY + boxHeight * 0.2

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

function positionDistance(a: { x: number, y: number }, b: { x: number, y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function generateId(): string {
  return `person_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// 检测两个脸是否重叠
function facesOverlap(a: DetectedFace, b: DetectedFace, overlapThreshold = 0.3): boolean {
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

  const overlapLeft = Math.max(aLeft, bLeft)
  const overlapRight = Math.min(aRight, bRight)
  const overlapTop = Math.max(aTop, bTop)
  const overlapBottom = Math.min(aBottom, bBottom)

  if (overlapRight <= overlapLeft || overlapBottom <= overlapTop) {
    return false
  }

  const overlapArea = (overlapRight - overlapLeft) * (overlapBottom - overlapTop)
  const smallerArea = Math.min(a.size * a.size, b.size * b.size)

  return overlapArea / smallerArea > overlapThreshold
}

export class PersonTracker {
  private persons: Map<string, TrackedPerson> = new Map()
  private currentFrame = 0
  private readonly matchThreshold = 0.2

  update(faceLandmarksList: NormalizedLandmark[][], faceBlendshapesList: Classifications[] = []): TrackedPerson[] {
    this.currentFrame++

    // 1. 将检测到的脸转换为 DetectedFace，同时进行几何验证
    const rawFaces: DetectedFace[] = []
    for (let i = 0; i < faceLandmarksList.length; i++) {
      const landmarks = faceLandmarksList[i]!
      const blendshapes = faceBlendshapesList[i]

      const metrics = computeFaceMetrics(landmarks)
      if (!metrics.isValid) continue

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

    // 1.5 去重：按大小排序，优先保留大脸
    const sortedRaw = [...rawFaces].sort((a, b) => b.size - a.size)
    const detectedFaces: DetectedFace[] = []
    for (const face of sortedRaw) {
      const isDuplicate = detectedFaces.some((kept) => {
        const dist = positionDistance(face.center, kept.center)
        const smallerSize = Math.min(face.size, kept.size)
        if (dist < smallerSize * 0.3) return true
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

    const sortedFaceIndices = detectedFaces
      .map((_, i) => i)
      .sort((a, b) => detectedFaces[b]!.size - detectedFaces[a]!.size)

    for (const faceIdx of sortedFaceIndices) {
      const face = detectedFaces[faceIdx]!
      let bestMatch: string | null = null
      let bestDistance = this.matchThreshold

      for (const [personId, person] of this.persons) {
        if (matched.has(personId)) continue

        const dist = positionDistance(face.center, person.center)
        if (dist < bestDistance) {
          bestDistance = dist
          bestMatch = personId
        }
      }

      if (bestMatch) {
        const person = this.persons.get(bestMatch)!
        person.center = face.center
        person.size = face.size
        person.lastSeenFrame = this.currentFrame
        person.frameCount++

        matched.add(bestMatch)
        usedFaces.add(faceIdx)
      }
    }

    // 3. 为未匹配的脸创建新的 TrackedPerson
    for (let i = 0; i < detectedFaces.length; i++) {
      if (usedFaces.has(i)) continue

      const face = detectedFaces[i]!
      const newPerson: TrackedPerson = {
        id: generateId(),
        center: face.center,
        size: face.size,
        lastSeenFrame: this.currentFrame,
        frameCount: 1,
      }

      this.persons.set(newPerson.id, newPerson)
    }

    // 4. 移除消失太久的人
    const toRemove: string[] = []
    for (const [personId, person] of this.persons) {
      const missedFrames = this.currentFrame - person.lastSeenFrame
      const timeout = person.frameCount < 10 ? 15 : 45
      if (missedFrames > timeout) {
        toRemove.push(personId)
      }
    }
    for (const id of toRemove) {
      this.persons.delete(id)
    }

    return Array.from(this.persons.values()).map(p => ({ ...p }))
  }

  getPersons(): TrackedPerson[] {
    return Array.from(this.persons.values())
  }

  getPrimaryPerson(): TrackedPerson | null {
    const persons = this.getPersons()
    if (persons.length === 0) return null
    return persons.sort((a, b) => b.size - a.size)[0] ?? null
  }

  findPersonNearPosition(x: number, y: number): TrackedPerson | null {
    let closest: TrackedPerson | null = null
    let minDist = 0.2

    for (const person of this.persons.values()) {
      const dist = positionDistance({ x, y }, person.center)
      if (dist < minDist) {
        minDist = dist
        closest = person
      }
    }

    return closest
  }

  reset(): void {
    this.persons.clear()
    this.currentFrame = 0
  }

  getCount(): number {
    return this.persons.size
  }
}
