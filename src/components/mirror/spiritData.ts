import type { LannaSpirit, Question } from './types'

// Lanna Spirit Data
export const LANNA_SPIRITS: LannaSpirit[] = [
  {
    id: 'naga',
    name: 'พญานาค',
    nameEn: 'Naga',
    nameCn: '那伽龙神',
    element: 'water',
    description: 'ผู้พิทักษ์แห่งน้ำ สัญลักษณ์แห่งปัญญาและการปกป้อง / Guardian of water, symbol of wisdom and protection',
    traits: ['ปัญญา / Wisdom', 'ปกป้อง / Protection', 'ลึกซึ้ง / Deep', 'ลึกลับ / Mysterious'],
    color: '#1E90FF',
    imagePrompt: 'Lanna Naga dragon serpent, Thai temple art style, water element, blue and gold, sacred protective deity',
  },
  {
    id: 'singha',
    name: 'สิงห์',
    nameEn: 'Singha',
    nameCn: '狮神',
    element: 'fire',
    description: 'สัญลักษณ์แห่งพลังและความกล้าหาญ ผู้พิทักษ์วิหาร / Symbol of strength and courage, temple guardian',
    traits: ['กล้าหาญ / Courage', 'พลัง / Strength', 'ผู้นำ / Leader', 'ผู้พิทักษ์ / Guardian'],
    color: '#FF6B35',
    imagePrompt: 'Lanna Singha lion, Thai temple guardian style, fire element, gold and red, majestic powerful deity',
  },
  {
    id: 'hong',
    name: 'หงส์',
    nameEn: 'Hongsa',
    nameCn: '天鹅神鸟',
    element: 'air',
    description: 'ร่างของความสง่างามและความบริสุทธิ์ ตัวแทนศิลปะและอิสรภาพ / Embodiment of grace and purity, symbol of art and freedom',
    traits: ['สง่างาม / Graceful', 'บริสุทธิ์ / Pure', 'ศิลปะ / Artistic', 'อิสระ / Free'],
    color: '#FFD700',
    imagePrompt: 'Lanna Hongsa swan bird, Thai celestial style, air element, white and gold, graceful divine creature',
  },
  {
    id: 'chang',
    name: 'ช้าง',
    nameEn: 'Chang',
    nameCn: '圣象',
    element: 'earth',
    description: 'สัญลักษณ์แห่งความมั่นคงและความเจริญรุ่งเรือง ผู้พิทักษ์แผ่นดิน / Symbol of stability and prosperity, earth guardian',
    traits: ['มั่นคง / Stable', 'เจริญรุ่งเรือง / Prosperous', 'ซื่อสัตย์ / Loyal', 'ฉลาด / Wise'],
    color: '#8B4513',
    imagePrompt: 'Lanna sacred elephant, Thai royal style, earth element, grey and gold ornaments, wise gentle giant',
  },
  {
    id: 'garuda',
    name: 'ครุฑ',
    nameEn: 'Garuda',
    nameCn: '金翅大鹏',
    element: 'spirit',
    description: 'ราชาแห่งท้องฟ้า พาหนะแห่งเทพเจ้า สัญลักษณ์แห่งพลังจิตวิญญาณ / King of the sky, mount of gods, symbol of spiritual power',
    traits: ['เหนือธรรมชาติ / Transcendent', 'ศักดิ์สิทธิ์ / Sacred', 'รวดเร็ว / Swift', 'ยุติธรรม / Just'],
    color: '#9932CC',
    imagePrompt: 'Lanna Garuda eagle man, Thai royal emblem style, spirit element, gold and purple, divine king of birds',
  },
]

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
