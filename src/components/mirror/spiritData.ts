import type { LannaSpirit, Question } from './types'

// 霍普金斯能量等级参考 (Hawkins Scale of Consciousness)
// 200: 勇气 (Courage) - 临界点，金色
// 250: 中立 (Neutrality) - 绿色
// 310: 意愿 (Willingness) - 黄绿
// 350: 接纳 (Acceptance) - 黄色
// 400: 理性 (Reason) - 金黄
// 500: 爱 (Love) - 粉红
// 540: 喜悦 (Joy) - 金色
// 600: 平和 (Peace) - 银色
// 700+: 开悟 (Enlightenment) - 白色

// 兰纳守护灵数据（临时占位，等文化研究完成后替换）
export const LANNA_SPIRITS: LannaSpirit[] = [
  {
    id: 'naga',
    name: 'พญานาค',
    nameEn: 'Naga',
    nameCn: '那伽龙神',
    element: 'water',
    description: '水之守护者，象征智慧与保护。那伽是兰纳文化中最重要的神话生物，守护着河流与雨水。',
    traits: ['智慧', '保护', '深邃', '神秘'],
    color: '#1E90FF',
    imagePrompt: 'Lanna Naga dragon serpent, Thai temple art style, water element, blue and gold, sacred protective deity',
    energy: {
      level: 550, // 爱与平和之间
      state: 'Love-Peace',
      glowColor: [64, 224, 208], // 青色 (Turquoise) - 水的深邃智慧
    },
  },
  {
    id: 'singha',
    name: 'สิงห์',
    nameEn: 'Singha',
    nameCn: '狮神',
    element: 'fire',
    description: '力量与勇气的象征。狮神守护着寺庙入口，代表着无畏的精神和领导力。',
    traits: ['勇气', '力量', '领导', '守护'],
    color: '#FF6B35',
    imagePrompt: 'Lanna Singha lion, Thai temple guardian style, fire element, gold and red, majestic powerful deity',
    energy: {
      level: 300, // 勇气与意愿之间
      state: 'Courage-Willingness',
      glowColor: [255, 140, 0], // 橙金色 - 火焰的勇气
    },
  },
  {
    id: 'hong',
    name: 'หงส์',
    nameEn: 'Hongsa',
    nameCn: '天鹅神鸟',
    element: 'air',
    description: '优雅与纯洁的化身。天鹅神鸟翱翔于天际，代表着艺术、美感与精神升华。',
    traits: ['优雅', '纯洁', '艺术', '自由'],
    color: '#FFD700',
    imagePrompt: 'Lanna Hongsa swan bird, Thai celestial style, air element, white and gold, graceful divine creature',
    energy: {
      level: 620, // 平和与开悟之间
      state: 'Peace-Enlightenment',
      glowColor: [255, 250, 240], // 花白色 - 纯洁的光芒
    },
  },
  {
    id: 'chang',
    name: 'ช้าง',
    nameEn: 'Chang',
    nameCn: '圣象',
    element: 'earth',
    description: '稳重与繁荣的象征。大象在兰纳文化中代表皇室与吉祥，是大地的守护者。',
    traits: ['稳重', '繁荣', '忠诚', '智慧'],
    color: '#8B4513',
    imagePrompt: 'Lanna sacred elephant, Thai royal style, earth element, grey and gold ornaments, wise gentle giant',
    energy: {
      level: 350, // 中立与接纳之间
      state: 'Neutrality-Acceptance',
      glowColor: [154, 205, 50], // 黄绿色 - 大地的稳定
    },
  },
  {
    id: 'garuda',
    name: 'ครุฑ',
    nameEn: 'Garuda',
    nameCn: '金翅大鹏',
    element: 'spirit',
    description: '神圣的天空之王。金翅大鹏是众神的坐骑，象征着超越与精神力量。',
    traits: ['超越', '神圣', '速度', '正义'],
    color: '#9932CC',
    imagePrompt: 'Lanna Garuda eagle man, Thai royal emblem style, spirit element, gold and purple, divine king of birds',
    energy: {
      level: 750, // 开悟境界
      state: 'Enlightenment',
      glowColor: [230, 230, 250], // 薰衣草白 - 神圣的超越
    },
  },
]

// 默认能量颜色 - 200 勇气等级的金色（临界点）
export const DEFAULT_GLOW_COLOR: [number, number, number] = [212, 175, 55]

// 霍普金斯能量色谱 - 完整的意识能量等级颜色映射
// 用于动态脉动效果，从低能量到高能量的色彩渐变
export const HAWKINS_SPECTRUM: Array<{ level: number, color: [number, number, number], state: string }> = [
  { level: 20, color: [139, 0, 0], state: 'Shame' },           // 暗红 - 羞耻
  { level: 30, color: [165, 42, 42], state: 'Guilt' },         // 棕红 - 内疚
  { level: 50, color: [74, 74, 74], state: 'Apathy' },         // 深灰 - 冷漠
  { level: 75, color: [25, 25, 112], state: 'Grief' },         // 午夜蓝 - 悲伤
  { level: 100, color: [255, 69, 0], state: 'Fear' },          // 橙红 - 恐惧
  { level: 125, color: [220, 20, 60], state: 'Desire' },       // 绯红 - 欲望
  { level: 150, color: [255, 0, 0], state: 'Anger' },          // 红 - 愤怒
  { level: 175, color: [65, 105, 225], state: 'Pride' },       // 皇家蓝 - 骄傲
  { level: 200, color: [255, 215, 0], state: 'Courage' },      // 金 - 勇气（临界点）
  { level: 250, color: [50, 205, 50], state: 'Neutrality' },   // 酸橙绿 - 中立
  { level: 310, color: [154, 205, 50], state: 'Willingness' }, // 黄绿 - 意愿
  { level: 350, color: [255, 255, 0], state: 'Acceptance' },   // 黄 - 接纳
  { level: 400, color: [255, 165, 0], state: 'Reason' },       // 橙 - 理性
  { level: 500, color: [255, 105, 180], state: 'Love' },       // 热粉 - 爱
  { level: 540, color: [255, 215, 0], state: 'Joy' },          // 金 - 喜悦
  { level: 600, color: [192, 192, 192], state: 'Peace' },      // 银 - 平和
  { level: 700, color: [255, 255, 255], state: 'Enlightenment' }, // 白 - 开悟
]

// 根据能量等级获取插值颜色
export function getEnergyColor(level: number): [number, number, number] {
  // 边界检查
  if (level <= HAWKINS_SPECTRUM[0]!.level) return HAWKINS_SPECTRUM[0]!.color
  if (level >= HAWKINS_SPECTRUM[HAWKINS_SPECTRUM.length - 1]!.level) {
    return HAWKINS_SPECTRUM[HAWKINS_SPECTRUM.length - 1]!.color
  }

  // 找到两个相邻的能量等级进行插值
  for (let i = 0; i < HAWKINS_SPECTRUM.length - 1; i++) {
    const current = HAWKINS_SPECTRUM[i]!
    const next = HAWKINS_SPECTRUM[i + 1]!

    if (level >= current.level && level <= next.level) {
      const t = (level - current.level) / (next.level - current.level)
      return [
        Math.round(current.color[0] + (next.color[0] - current.color[0]) * t),
        Math.round(current.color[1] + (next.color[1] - current.color[1]) * t),
        Math.round(current.color[2] + (next.color[2] - current.color[2]) * t),
      ]
    }
  }

  return DEFAULT_GLOW_COLOR
}

// 能量脉动：返回基于时间的能量等级（在 200-700 之间正弦波动）
// 周期约 6 秒，主要在正能量区间（200+）波动
export function getPulsingEnergyLevel(timestamp: number): number {
  const period = 6000 // 6 秒周期
  const phase = (timestamp % period) / period * Math.PI * 2
  // 在 150-650 之间波动，大部分时间在正能量区
  const baseLevel = 400
  const amplitude = 250
  return baseLevel + Math.sin(phase) * amplitude
}

// 连通组件标记结果
export interface ComponentInfo {
  id: number
  centerX: number
  centerY: number
  pixelCount: number
  energyLevel: number // 基于位置计算的稳定能量等级
}

// 使用 Union-Find 进行连通组件标记
// 为每个识别出的人分配独立的能量颜色
export function labelConnectedComponents(
  mask: Uint8Array,
  width: number,
  height: number,
): { labels: Int32Array, components: ComponentInfo[] } {
  const labels = new Int32Array(width * height)
  labels.fill(-1)

  const parent: number[] = []
  const rank: number[] = []
  let nextLabel = 0

  // Union-Find 辅助函数
  function find(x: number): number {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]!)
    }
    return parent[x]!
  }

  function union(x: number, y: number): void {
    const rootX = find(x)
    const rootY = find(y)
    if (rootX !== rootY) {
      if (rank[rootX]! < rank[rootY]!) {
        parent[rootX] = rootY
      } else if (rank[rootX]! > rank[rootY]!) {
        parent[rootY] = rootX
      } else {
        parent[rootY] = rootX
        rank[rootX]!++
      }
    }
  }

  // 第一遍：分配临时标签并记录等价关系
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (!mask[idx] || mask[idx] === 0) continue

      const neighbors: number[] = []

      // 检查左边和上边的邻居（4-连通）
      if (x > 0 && labels[idx - 1] !== -1) {
        neighbors.push(labels[idx - 1]!)
      }
      if (y > 0 && labels[idx - width] !== -1) {
        neighbors.push(labels[idx - width]!)
      }

      if (neighbors.length === 0) {
        // 新组件
        labels[idx] = nextLabel
        parent.push(nextLabel)
        rank.push(0)
        nextLabel++
      } else {
        // 使用最小标签
        const minLabel = Math.min(...neighbors)
        labels[idx] = minLabel

        // 合并所有邻居标签
        for (const n of neighbors) {
          union(n, minLabel)
        }
      }
    }
  }

  // 第二遍：规范化标签并计算组件信息
  const labelMap = new Map<number, number>()
  const componentStats = new Map<number, { sumX: number, sumY: number, count: number }>()
  let finalLabelCount = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (labels[idx] === -1) continue

      const root = find(labels[idx]!)
      if (!labelMap.has(root)) {
        labelMap.set(root, finalLabelCount++)
        componentStats.set(labelMap.get(root)!, { sumX: 0, sumY: 0, count: 0 })
      }

      const finalLabel = labelMap.get(root)!
      labels[idx] = finalLabel

      const stats = componentStats.get(finalLabel)!
      stats.sumX += x
      stats.sumY += y
      stats.count++
    }
  }

  // 构建组件信息数组
  const components: ComponentInfo[] = []
  for (const [id, stats] of componentStats) {
    const centerX = stats.sumX / stats.count
    const centerY = stats.sumY / stats.count

    // 基于水平位置计算能量等级
    // 画面左侧 → 较低能量，右侧 → 较高能量
    // 加入时间因子使颜色缓慢脉动
    const positionRatio = centerX / width
    const baseEnergy = 200 + positionRatio * 450 // 200-650 范围

    components.push({
      id,
      centerX,
      centerY,
      pixelCount: stats.count,
      energyLevel: baseEnergy,
    })
  }

  // 按像素数量排序（大的组件在前）
  components.sort((a, b) => b.pixelCount - a.pixelCount)

  return { labels, components }
}

// 问答问题
export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: '在人群中，你通常是？',
    textEn: 'In a crowd, you usually are?',
    options: [
      { id: 'q1a', text: '安静观察的那个', textEn: 'The quiet observer', spirits: ['naga', 'chang'] },
      { id: 'q1b', text: '带动气氛的人', textEn: 'The life of the party', spirits: ['singha', 'garuda'] },
      { id: 'q1c', text: '随性自在地穿梭', textEn: 'Flowing freely through', spirits: ['hong', 'naga'] },
      { id: 'q1d', text: '可靠的支持者', textEn: 'The reliable supporter', spirits: ['chang', 'singha'] },
    ],
  },
  {
    id: 'q2',
    text: '面对挑战时，你会？',
    textEn: 'When facing challenges, you?',
    options: [
      { id: 'q2a', text: '深思熟虑后行动', textEn: 'Think deeply then act', spirits: ['naga', 'chang'] },
      { id: 'q2b', text: '直接迎难而上', textEn: 'Face it head-on', spirits: ['singha', 'garuda'] },
      { id: 'q2c', text: '寻找创意解决方案', textEn: 'Find creative solutions', spirits: ['hong', 'garuda'] },
      { id: 'q2d', text: '稳扎稳打逐步推进', textEn: 'Steady progress step by step', spirits: ['chang', 'naga'] },
    ],
  },
  {
    id: 'q3',
    text: '什么最能让你感到充实？',
    textEn: 'What makes you feel fulfilled?',
    options: [
      { id: 'q3a', text: '探索未知的领域', textEn: 'Exploring the unknown', spirits: ['naga', 'garuda'] },
      { id: 'q3b', text: '保护重要的人', textEn: 'Protecting loved ones', spirits: ['singha', 'chang'] },
      { id: 'q3c', text: '创造美好的事物', textEn: 'Creating beautiful things', spirits: ['hong', 'naga'] },
      { id: 'q3d', text: '达成设定的目标', textEn: 'Achieving set goals', spirits: ['garuda', 'singha'] },
    ],
  },
]

// 根据答案计算匹配的守护灵
export function matchSpirit(answers: Record<string, string>): LannaSpirit {
  const scores: Record<string, number> = {}

  // 初始化分数
  LANNA_SPIRITS.forEach((spirit) => {
    scores[spirit.id] = 0
  })

  // 计算每个守护灵的分数
  Object.entries(answers).forEach(([questionId, optionId]) => {
    const question = QUESTIONS.find(q => q.id === questionId)
    if (!question)
      return

    const option = question.options.find(o => o.id === optionId)
    if (!option)
      return

    option.spirits.forEach((spiritId) => {
      scores[spiritId] = (scores[spiritId] || 0) + 1
    })
  })

  // 找出得分最高的守护灵
  let maxScore = 0
  // 使用非空断言，因为 LANNA_SPIRITS 始终有元素
  let matchedSpirit: LannaSpirit = LANNA_SPIRITS[0]!

  Object.entries(scores).forEach(([spiritId, score]) => {
    if (score > maxScore) {
      maxScore = score
      const found = LANNA_SPIRITS.find(s => s.id === spiritId)
      if (found) matchedSpirit = found
    }
  })

  return matchedSpirit
}
