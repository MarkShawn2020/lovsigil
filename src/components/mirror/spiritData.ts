import type { LannaSpirit, Question } from './types'

// Lanna Spirit Data - Himaphan 森林神兽体系
// 基于兰纳文化，5位守护神：Chang, Singha, Kinnari, Garuda, Mom
export const LANNA_SPIRITS: LannaSpirit[] = [
  {
    id: 'chang',
    name: 'ช้าง',
    nameEn: 'Chang',
    nameCn: '圣象',
    element: 'earth',
    description: 'สัญลักษณ์แห่งความมั่นคงและความเจริญรุ่งเรือง ผู้พิทักษ์แผ่นดิน / Symbol of stability and prosperity, earth guardian',
    traits: ['温和 / Gentle', '智慧 / Wise', '慈悲 / Compassionate', '可靠 / Reliable'],
    color: '#8B4513',
    imagePrompt: 'Lanna sacred elephant, Thai royal style, earth element, grey and gold ornaments, wise gentle giant with warm peaceful aura',
  },
  {
    id: 'singha',
    name: 'สิงห์',
    nameEn: 'Singha',
    nameCn: '狮王',
    element: 'fire',
    description: 'สัญลักษณ์แห่งพลังและความกล้าหาญ ผู้พิทักษ์วิหาร / Symbol of strength and courage, temple guardian',
    traits: ['自信 / Confident', '勇敢 / Brave', '果断 / Decisive', '领导 / Leader'],
    color: '#FF6B35',
    imagePrompt: 'Lanna Singha lion, Thai temple guardian style, fire element, gold and red, majestic powerful deity with commanding presence',
  },
  {
    id: 'kinnari',
    name: 'กินรี',
    nameEn: 'Kinnari',
    nameCn: '天女',
    element: 'air',
    description: 'นางฟ้าครึ่งมนุษย์ครึ่งนก สัญลักษณ์แห่งความงามและศิลปะ / Half-human half-bird celestial, symbol of beauty and art',
    traits: ['优雅 / Graceful', '创造 / Creative', '敏感 / Sensitive', '浪漫 / Romantic'],
    color: '#FFD700',
    imagePrompt: 'Lanna Kinnari celestial maiden, Thai Himaphan creature, half woman half bird, graceful dancer with golden feathers, artistic ethereal beauty',
  },
  {
    id: 'garuda',
    name: 'ครุฑ',
    nameEn: 'Garuda',
    nameCn: '金翅',
    element: 'spirit',
    description: 'ราชาแห่งท้องฟ้า พาหนะแห่งเทพเจ้า สัญลักษณ์แห่งพลังจิตวิญญาณ / King of the sky, mount of gods, symbol of spiritual power',
    traits: ['正义 / Just', '热情 / Passionate', '冒险 / Adventurous', '理想 / Idealistic'],
    color: '#9932CC',
    imagePrompt: 'Lanna Garuda eagle man, Thai royal emblem style, spirit element, gold and purple, divine king of birds with fierce noble gaze',
  },
  {
    id: 'mom',
    name: 'มอม',
    nameEn: 'Mom',
    nameCn: '秘兽',
    element: 'mystery',
    description: 'สัตว์ลึกลับแห่งล้านนา ไม่มีรูปร่างแน่นอน เปลี่ยนแปลงตามจินตนาการ / Mysterious Lanna creature, shapeless and ever-changing',
    traits: ['独特 / Unique', '神秘 / Mysterious', '多变 / Versatile', '不可预测 / Unpredictable'],
    color: '#2F4F4F',
    imagePrompt: 'Lanna Mom mythical beast, unique Himaphan creature, mysterious shapeshifting entity, dark forest spirit with ethereal otherworldly presence',
  },
]

// 问答问题（用于辅助匹配，权重30%）
export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: '在人群中，你通常是？',
    textEn: 'In a crowd, you usually are?',
    options: [
      { id: 'q1a', text: '安静观察的那个', textEn: 'The quiet observer', spirits: ['kinnari', 'mom'] },
      { id: 'q1b', text: '带动气氛的人', textEn: 'The life of the party', spirits: ['singha', 'garuda'] },
      { id: 'q1c', text: '随性自在地穿梭', textEn: 'Flowing freely through', spirits: ['kinnari', 'mom'] },
      { id: 'q1d', text: '可靠的支持者', textEn: 'The reliable supporter', spirits: ['chang', 'singha'] },
    ],
  },
  {
    id: 'q2',
    text: '面对挑战时，你会？',
    textEn: 'When facing challenges, you?',
    options: [
      { id: 'q2a', text: '深思熟虑后行动', textEn: 'Think deeply then act', spirits: ['chang', 'kinnari'] },
      { id: 'q2b', text: '直接迎难而上', textEn: 'Face it head-on', spirits: ['singha', 'garuda'] },
      { id: 'q2c', text: '寻找创意解决方案', textEn: 'Find creative solutions', spirits: ['kinnari', 'garuda'] },
      { id: 'q2d', text: '稳扎稳打逐步推进', textEn: 'Steady progress step by step', spirits: ['chang', 'mom'] },
    ],
  },
  {
    id: 'q3',
    text: '什么最能让你感到充实？',
    textEn: 'What makes you feel fulfilled?',
    options: [
      { id: 'q3a', text: '探索未知的领域', textEn: 'Exploring the unknown', spirits: ['mom', 'garuda'] },
      { id: 'q3b', text: '保护重要的人', textEn: 'Protecting loved ones', spirits: ['singha', 'chang'] },
      { id: 'q3c', text: '创造美好的事物', textEn: 'Creating beautiful things', spirits: ['kinnari', 'mom'] },
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
