import type { LannaSpirit, Question } from './types'

// Lanna Spirit Data - 兰纳神兽体系
// 基于兰纳文化与面相气质映射：Mom, Naga, Singha, Makara, Hadsadiling
export const LANNA_SPIRITS: LannaSpirit[] = [
  {
    id: 'mom',
    name: 'มอม',
    nameEn: 'Mom',
    nameCn: '莫',
    element: 'earth-water',
    culturalRole: '雨神坐骑，祈求雨水，野性守护，象征万物有灵的生命力',
    description: 'พาหนะแห่งเทพฝน สัญลักษณ์แห่งความอดทนและการปรับตัว / Rain deity mount, symbol of resilience and adaptation',
    traits: ['坚韧 / Resilient', '适应 / Adaptive', '忠诚 / Loyal', '实干 / Pragmatic'],
    color: '#5D4E37',
    imagePrompt: 'Lanna Mom mythical beast, rain deity mount, earth and water element, wild powerful creature with alert round eyes, sturdy build, embodying primal life force and resilience',
    faceFeatures: {
      eyeShape: 'round',
      faceShape: 'sturdy',
      noseType: 'normal',
      mouthSize: 'wide',
      overallVibe: '野性实诚、敦实稳重',
    },
  },
  {
    id: 'naga',
    name: 'นาค',
    nameEn: 'Naga',
    nameCn: '纳迦',
    element: 'water-spirit',
    culturalRole: '彩虹桥，连接人神两界，守护佛法与宝藏，掌控水源',
    description: 'สะพานสายรุ้งเชื่อมโลกมนุษย์และเทวดา ผู้พิทักษ์พุทธศาสนา / Rainbow bridge between realms, dharma guardian',
    traits: ['灵性 / Intuitive', '守护 / Protective', '多变 / Fluid', '艺术 / Artistic'],
    color: '#1E90FF',
    imagePrompt: 'Lanna Naga serpent deity, water and spirit element, ethereal rainbow bridge guardian, phoenix eyes sharp and deep, high cheekbones, cool mysterious allure with protective aura',
    faceFeatures: {
      eyeShape: 'phoenix',
      faceShape: 'angular',
      noseType: 'high',
      mouthSize: 'normal',
      overallVibe: '清冷魅惑、仙气飘飘',
    },
  },
  {
    id: 'singha',
    name: 'สิงห์',
    nameEn: 'Singha',
    nameCn: '醒狮',
    element: 'fire-gold',
    culturalRole: '镇门神兽，物理防御，象征王权与绝对的力量',
    description: 'ผู้พิทักษ์ประตูวิหาร สัญลักษณ์แห่งอำนาจและความยิ่งใหญ่ / Temple gate guardian, symbol of royal power',
    traits: ['领袖 / Leader', '正义 / Just', '威严 / Majestic', '直率 / Direct'],
    color: '#FF6B35',
    imagePrompt: 'Lanna Singha lion guardian, fire and gold element, temple protector with broad forehead, strong nose bridge, thick mane, commanding presence and powerful aura',
    faceFeatures: {
      eyeShape: 'wide',
      faceShape: 'broad',
      noseType: 'straight',
      mouthSize: 'normal',
      overallVibe: '威严霸气、天生领袖',
    },
  },
  {
    id: 'makara',
    name: 'มกร',
    nameEn: 'Makara',
    nameCn: '摩羯',
    element: 'illusion',
    culturalRole: '时间巨怪，吞吐纳迦，象征时间的流逝与轮回的幻象',
    description: 'สัตว์แห่งกาลเวลา กลืนกินและคายนาค สัญลักษณ์แห่งมายา / Time beast, swallows and releases Naga, symbol of illusion',
    traits: ['野心 / Ambitious', '口才 / Eloquent', '务实 / Practical', '洞察 / Perceptive'],
    color: '#8B008B',
    imagePrompt: 'Lanna Makara sea creature, illusion element, time beast with large expressive mouth, mixed exotic features, cunning eyes that see through reality',
    faceFeatures: {
      eyeShape: 'deep',
      faceShape: 'mixed',
      noseType: 'large',
      mouthSize: 'large',
      overallVibe: '能说会道、欲望强烈',
    },
  },
  {
    id: 'hadsadiling',
    name: 'หัสดีลิงค์',
    nameEn: 'Hadsadiling',
    nameCn: '哈萨迪灵',
    element: 'wind-air',
    culturalRole: '灵魂摆渡，葬礼神鸟，驮负高僧灵魂飞升天堂',
    description: 'นกศักดิ์สิทธิ์แห่งพิธีศพ ผู้นำวิญญาณสู่สวรรค์ / Sacred funeral bird, soul ferry to heaven',
    traits: ['高贵 / Noble', '多才 / Versatile', '精神洁癖 / Purist', '名望 / Distinguished'],
    color: '#9932CC',
    imagePrompt: 'Lanna Hadsadiling mythical bird, wind and air element, funeral deity with aquiline nose, large ears, refined elegant features, ethereal otherworldly grace',
    faceFeatures: {
      eyeShape: 'large',
      faceShape: 'refined',
      noseType: 'aquiline',
      mouthSize: 'normal',
      overallVibe: '清高贵族、疏离优雅',
    },
  },
]

// 问答问题（30%权重，用于边界情况修正）
export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: '在人群中，你通常是？',
    textEn: 'In a crowd, you usually are?',
    options: [
      { id: 'q1a', text: '安静观察的那个', textEn: 'The quiet observer', spirits: ['naga', 'hadsadiling'] },
      { id: 'q1b', text: '带动气氛的人', textEn: 'The life of the party', spirits: ['singha', 'makara'] },
      { id: 'q1c', text: '随性自在地穿梭', textEn: 'Flowing freely through', spirits: ['naga', 'hadsadiling'] },
      { id: 'q1d', text: '可靠的支持者', textEn: 'The reliable supporter', spirits: ['mom', 'singha'] },
    ],
  },
  {
    id: 'q2',
    text: '面对挑战时，你会？',
    textEn: 'When facing challenges, you?',
    options: [
      { id: 'q2a', text: '深思熟虑后行动', textEn: 'Think deeply then act', spirits: ['naga', 'hadsadiling'] },
      { id: 'q2b', text: '直接迎难而上', textEn: 'Face it head-on', spirits: ['singha', 'mom'] },
      { id: 'q2c', text: '寻找创意解决方案', textEn: 'Find creative solutions', spirits: ['makara', 'naga'] },
      { id: 'q2d', text: '稳扎稳打逐步推进', textEn: 'Steady progress step by step', spirits: ['mom', 'singha'] },
    ],
  },
  {
    id: 'q3',
    text: '什么最能让你感到充实？',
    textEn: 'What makes you feel fulfilled?',
    options: [
      { id: 'q3a', text: '探索未知的领域', textEn: 'Exploring the unknown', spirits: ['naga', 'makara'] },
      { id: 'q3b', text: '保护重要的人', textEn: 'Protecting loved ones', spirits: ['singha', 'mom'] },
      { id: 'q3c', text: '追求高层次成就', textEn: 'Pursuing higher achievements', spirits: ['hadsadiling', 'makara'] },
      { id: 'q3d', text: '脚踏实地达成目标', textEn: 'Achieving goals step by step', spirits: ['mom', 'singha'] },
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
  let matchedSpirit: LannaSpirit = LANNA_SPIRITS[0]!

  Object.entries(scores).forEach(([spiritId, score]) => {
    if (score > maxScore) {
      maxScore = score
      const found = LANNA_SPIRITS.find(s => s.id === spiritId)
      if (found)
        matchedSpirit = found
    }
  })

  return matchedSpirit
}
