/**
 * 兰纳风格海报生成器
 * Lanna Spirit Mirror - Poster Generator
 *
 * 设计灵感：泰北兰纳王国的寺庙艺术、金色装饰、神圣几何图案
 */

import { SPIRIT_INFO } from './facsAnalyzer'

// 海报尺寸（Instagram Story 比例 9:16）
const POSTER_WIDTH = 1080
const POSTER_HEIGHT = 1920

// 颜色常量
const COLORS = {
  background: '#0a0a12', // 深夜蓝黑
  backgroundGradientEnd: '#1a1a2e', // 深紫蓝
  gold: '#D4AF37', // 兰纳金
  goldLight: '#F4E4A6', // 浅金
  goldDark: '#8B7355', // 暗金
  white: '#FFFFFF',
  whiteTranslucent: 'rgba(255,255,255,0.8)',
}

interface PosterOptions {
  originalImage: string // 原图 base64 或 URL
  generatedImage: string // 生成图 base64 或 URL
  spiritId: string
  spiritName?: string
  spiritNameEn?: string
  spiritTraits?: string[]
  includeOriginal?: boolean // 是否包含原始采集照片
}

// 合像海报选项
export interface GroupPosterPerson {
  originalImage: string | null
  generatedImage: string
  spiritId: string
}

export interface GroupPosterOptions {
  persons: GroupPosterPerson[]
  includeOriginal?: boolean
}

/**
 * 加载图片
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * 绘制圆角矩形（兼容旧浏览器）
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.arcTo(x + width, y, x + width, y + radius, radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius)
  ctx.lineTo(x + radius, y + height)
  ctx.arcTo(x, y + height, x, y + height - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

/**
 * 绘制兰纳风格边框装饰
 */
function drawLannaBorder(ctx: CanvasRenderingContext2D, width: number, height: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = 3

  const margin = 40
  const cornerSize = 60

  // 四角装饰 - 兰纳风格的三角装饰
  const corners = [
    { x: margin, y: margin, rot: 0 },
    { x: width - margin, y: margin, rot: Math.PI / 2 },
    { x: width - margin, y: height - margin, rot: Math.PI },
    { x: margin, y: height - margin, rot: -Math.PI / 2 },
  ]

  corners.forEach(({ x, y, rot }) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)

    // 绘制角落装饰
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(cornerSize, 0)
    ctx.moveTo(0, 0)
    ctx.lineTo(0, cornerSize)

    // 内角装饰线
    ctx.moveTo(15, 15)
    ctx.lineTo(cornerSize - 10, 15)
    ctx.moveTo(15, 15)
    ctx.lineTo(15, cornerSize - 10)

    // 小三角装饰
    ctx.moveTo(cornerSize / 2, 5)
    ctx.lineTo(cornerSize / 2 - 8, 12)
    ctx.lineTo(cornerSize / 2 + 8, 12)
    ctx.closePath()

    ctx.stroke()
    ctx.restore()
  })

  // 顶部中心装饰 - 类似佛塔尖顶
  ctx.save()
  ctx.translate(width / 2, margin + 20)

  ctx.beginPath()
  // 尖顶
  ctx.moveTo(0, -30)
  ctx.lineTo(-8, -15)
  ctx.lineTo(8, -15)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()

  // 底座
  ctx.beginPath()
  ctx.moveTo(-25, 0)
  ctx.lineTo(-15, -10)
  ctx.lineTo(15, -10)
  ctx.lineTo(25, 0)
  ctx.stroke()

  // 两侧延伸线
  ctx.beginPath()
  ctx.moveTo(-25, 0)
  ctx.lineTo(-80, 0)
  ctx.moveTo(25, 0)
  ctx.lineTo(80, 0)
  ctx.stroke()

  ctx.restore()

  // 底部装饰 - 莲花波纹
  ctx.save()
  ctx.translate(width / 2, height - margin - 20)

  // 中心莲花
  const petalCount = 5
  const petalSize = 15
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI - Math.PI / 2
    const px = Math.cos(angle) * petalSize
    const py = Math.sin(angle) * petalSize * 0.5

    ctx.beginPath()
    ctx.ellipse(px, py - 5, 8, 12, angle, 0, Math.PI * 2)
    ctx.stroke()
  }

  // 波纹延伸
  ctx.beginPath()
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue
    const x = i * 50
    const amp = 8
    ctx.moveTo(x - 20, 15)
    ctx.quadraticCurveTo(x, 15 - amp, x + 20, 15)
  }
  ctx.stroke()

  ctx.restore()
}

/**
 * 绘制圆形带装饰边框的图片
 */
function drawCircularImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  radius: number,
  borderColor: string,
) {
  // 外圈装饰
  ctx.beginPath()
  ctx.arc(x, y, radius + 8, 0, Math.PI * 2)
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 2
  ctx.stroke()

  // 主边框
  ctx.beginPath()
  ctx.arc(x, y, radius + 3, 0, Math.PI * 2)
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 4
  ctx.stroke()

  // 裁剪并绘制图片
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.clip()

  // 计算图片缩放以填充圆形
  const scale = Math.max((radius * 2) / img.width, (radius * 2) / img.height)
  const drawWidth = img.width * scale
  const drawHeight = img.height * scale
  ctx.drawImage(img, x - drawWidth / 2, y - drawHeight / 2, drawWidth, drawHeight)

  ctx.restore()
}

/**
 * 绘制主图片（带装饰边框）
 */
function drawMainImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
  borderColor: string,
) {
  // 计算图片尺寸（保持比例）
  const scale = Math.min(maxWidth / img.width, maxHeight / img.height)
  const width = img.width * scale
  const height = img.height * scale
  const drawX = x - width / 2
  const drawY = y - height / 2

  // 外发光效果
  ctx.shadowColor = borderColor
  ctx.shadowBlur = 30
  ctx.fillStyle = borderColor
  ctx.fillRect(drawX - 4, drawY - 4, width + 8, height + 8)
  ctx.shadowBlur = 0

  // 主图片
  ctx.drawImage(img, drawX, drawY, width, height)

  // 边框
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 4
  ctx.strokeRect(drawX - 2, drawY - 2, width + 4, height + 4)

  // 角落装饰
  const cornerLen = 30
  const corners = [
    { dx: drawX - 6, dy: drawY - 6, sx: 1, sy: 1 },
    { dx: drawX + width + 6, dy: drawY - 6, sx: -1, sy: 1 },
    { dx: drawX + width + 6, dy: drawY + height + 6, sx: -1, sy: -1 },
    { dx: drawX - 6, dy: drawY + height + 6, sx: 1, sy: -1 },
  ]

  ctx.lineWidth = 3
  corners.forEach(({ dx, dy, sx, sy }) => {
    ctx.beginPath()
    ctx.moveTo(dx, dy)
    ctx.lineTo(dx + cornerLen * sx, dy)
    ctx.moveTo(dx, dy)
    ctx.lineTo(dx, dy + cornerLen * sy)
    ctx.stroke()
  })

  return { width, height, x: drawX, y: drawY }
}

/**
 * 绘制变形箭头
 */
function drawTransformArrow(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.save()
  ctx.translate(x, y)

  // 发光效果
  ctx.shadowColor = color
  ctx.shadowBlur = 15

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 3

  // 箭头主体 - 兰纳风格
  ctx.beginPath()
  ctx.moveTo(-30, 0)
  ctx.lineTo(20, 0)
  ctx.stroke()

  // 箭头头部（三角形）
  ctx.beginPath()
  ctx.moveTo(30, 0)
  ctx.lineTo(15, -10)
  ctx.lineTo(15, 10)
  ctx.closePath()
  ctx.fill()

  // 装饰点
  ctx.beginPath()
  ctx.arc(-35, 0, 4, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.restore()
}

/**
 * 绘制元素符号
 */
function drawElementSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, element: string, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = 2

  switch (element) {
    case 'earth-water':
      // 山与水滴结合
      ctx.beginPath()
      ctx.moveTo(-15, 10)
      ctx.lineTo(0, -5)
      ctx.lineTo(15, 10)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(0, -12)
      ctx.bezierCurveTo(-5, -8, -4, -2, 0, 0)
      ctx.bezierCurveTo(4, -2, 5, -8, 0, -12)
      ctx.fillStyle = '#4A90D9'
      ctx.fill()
      break
    case 'water-spirit':
      // 水滴与光芒
      ctx.beginPath()
      ctx.moveTo(0, -12)
      ctx.bezierCurveTo(-10, 0, -8, 12, 0, 12)
      ctx.bezierCurveTo(8, 12, 10, 0, 0, -12)
      ctx.fill()
      // 光芒环绕
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(Math.cos(angle) * 14, Math.sin(angle) * 14)
        ctx.lineTo(Math.cos(angle) * 18, Math.sin(angle) * 18)
        ctx.stroke()
      }
      break
    case 'fire-gold':
      // 火焰
      ctx.beginPath()
      ctx.moveTo(0, -15)
      ctx.bezierCurveTo(10, -5, 8, 8, 0, 15)
      ctx.bezierCurveTo(-8, 8, -10, -5, 0, -15)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(0, -8)
      ctx.bezierCurveTo(5, -2, 4, 6, 0, 10)
      ctx.bezierCurveTo(-4, 6, -5, -2, 0, -8)
      ctx.fillStyle = '#FFD700'
      ctx.globalAlpha = 0.7
      ctx.fill()
      ctx.globalAlpha = 1
      break
    case 'illusion':
      // 漩涡/幻象
      ctx.beginPath()
      for (let i = 0; i < 3; i++) {
        const r = 5 + i * 4
        ctx.arc(0, 0, r, 0, Math.PI * 1.5)
      }
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, 3, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'wind-air':
      // 风纹与羽毛
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(-12, -6 + i * 6)
        ctx.quadraticCurveTo(0, -10 + i * 6, 12, -6 + i * 6)
        ctx.stroke()
      }
      // 羽毛尖
      ctx.beginPath()
      ctx.moveTo(15, -6)
      ctx.lineTo(20, -8)
      ctx.lineTo(18, -4)
      ctx.closePath()
      ctx.fill()
      break
  }

  ctx.restore()
}

/**
 * 生成兰纳风格海报
 */
export async function generateLannaPoster(options: PosterOptions): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = POSTER_WIDTH
  canvas.height = POSTER_HEIGHT
  const ctx = canvas.getContext('2d')!

  const spiritInfo = SPIRIT_INFO[options.spiritId as keyof typeof SPIRIT_INFO]
  const spiritColor = spiritInfo?.color || COLORS.gold

  // 1. 绘制背景渐变
  const gradient = ctx.createLinearGradient(0, 0, 0, POSTER_HEIGHT)
  gradient.addColorStop(0, COLORS.background)
  gradient.addColorStop(0.5, COLORS.backgroundGradientEnd)
  gradient.addColorStop(1, COLORS.background)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT)

  // 添加微妙的纹理（使用噪点）
  ctx.globalAlpha = 0.03
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * POSTER_WIDTH
    const y = Math.random() * POSTER_HEIGHT
    ctx.fillStyle = Math.random() > 0.5 ? COLORS.white : COLORS.gold
    ctx.fillRect(x, y, 1, 1)
  }
  ctx.globalAlpha = 1

  // 2. 绘制装饰边框
  drawLannaBorder(ctx, POSTER_WIDTH, POSTER_HEIGHT, COLORS.gold)

  // 3. 顶部标题区域（压缩，类似游戏王卡名区）
  ctx.textAlign = 'center'

  // 主标题（缩小）
  ctx.font = 'bold 48px serif'
  ctx.fillStyle = COLORS.gold
  ctx.shadowColor = COLORS.gold
  ctx.shadowBlur = 15
  ctx.fillText('LANNA SPIRIT', POSTER_WIDTH / 2, 100)
  ctx.shadowBlur = 0

  // 副标题（缩小）
  ctx.font = '22px serif'
  ctx.fillStyle = COLORS.whiteTranslucent
  ctx.fillText('กระจกวิญญาณล้านนา', POSTER_WIDTH / 2, 135)

  // 4. 加载图片
  const generatedImg = await loadImage(options.generatedImage)

  // 5. 根据模式绘制图片
  if (options.includeOriginal && options.originalImage) {
    // 对比模式：上方大图展示 spirit，下方小对比区
    const originalImg = await loadImage(options.originalImage)

    // 主图（spirit 生成图，占据主要视觉空间）
    drawMainImage(ctx, generatedImg, POSTER_WIDTH / 2, 700, 900, 900, spiritColor)

    // 底部对比区域背景
    const compareY = 1280
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    drawRoundedRect(ctx, 80, compareY - 80, POSTER_WIDTH - 160, 180, 20)
    ctx.fill()

    // 对比区标题
    ctx.font = '20px sans-serif'
    ctx.fillStyle = COLORS.goldDark
    ctx.textAlign = 'center'
    ctx.fillText('TRANSFORMATION', POSTER_WIDTH / 2, compareY - 48)

    // 原图（左侧小圆）
    const leftX = POSTER_WIDTH / 2 - 150
    drawCircularImage(ctx, originalImg, leftX, compareY + 20, 60, COLORS.goldDark)

    // 变形箭头（中间）
    drawTransformArrow(ctx, POSTER_WIDTH / 2, compareY + 20, spiritColor)

    // 生成图（右侧小圆）
    const rightX = POSTER_WIDTH / 2 + 150
    drawCircularImage(ctx, generatedImg, rightX, compareY + 20, 60, spiritColor)
  } else {
    // 纯生成图模式（最大化显示）
    drawMainImage(ctx, generatedImg, POSTER_WIDTH / 2, 790, 980, 1200, spiritColor)
  }

  // 6. 底部信息区域
  const infoY = options.includeOriginal ? 1540 : 1480

  // 守护灵 emoji + 泰文名
  ctx.font = 'bold 52px serif'
  ctx.fillStyle = spiritColor
  ctx.shadowColor = spiritColor
  ctx.shadowBlur = 12
  const spiritThaiName = spiritInfo?.name || options.spiritName || options.spiritId
  ctx.fillText(`${spiritInfo?.emoji || '✨'} ${spiritThaiName}`, POSTER_WIDTH / 2, infoY)
  ctx.shadowBlur = 0

  // 英文名
  ctx.font = '36px serif'
  ctx.fillStyle = COLORS.goldLight
  const spiritEnName = spiritInfo?.nameEn || options.spiritNameEn || ''
  ctx.fillText(spiritEnName, POSTER_WIDTH / 2, infoY + 55)

  // 特质翻译映射（泰 -> 英）
  const traitTranslations: Record<string, string> = {
    // Mom
    'ความอดทน': 'Resilience', 'ปรับตัว': 'Adaptive', 'ซื่อสัตย์': 'Loyalty', 'ทำงานหนัก': 'Hardworking',
    // Naga
    'ปัญญา': 'Wisdom', 'ปกป้อง': 'Protection', 'ลึกลับ': 'Mystery', 'ศิลปะ': 'Artistic',
    // Singha
    'ผู้นำ': 'Leader', 'ยุติธรรม': 'Justice', 'สง่างาม': 'Majestic', 'ตรงไปตรงมา': 'Direct',
    // Makara
    'ทะเยอทะยาน': 'Ambitious', 'พูดเก่ง': 'Eloquent', 'ปฏิบัติ': 'Practical', 'มองทะลุ': 'Perceptive',
    // Hadsadiling
    'สูงส่ง': 'Noble', 'หลากหลาย': 'Versatile', 'บริสุทธิ์': 'Purist', 'มีชื่อเสียง': 'Distinguished',
  }

  // 特质标签（双语）
  const traits = spiritInfo?.traits || options.spiritTraits || []
  if (traits.length > 0) {
    const traitY = infoY + 115
    // 泰文特质
    ctx.font = '22px sans-serif'
    ctx.fillStyle = COLORS.whiteTranslucent
    ctx.fillText(traits.slice(0, 4).join(' · '), POSTER_WIDTH / 2, traitY)
    // 英文特质
    ctx.font = '18px sans-serif'
    ctx.fillStyle = COLORS.goldDark
    const engTraits = traits.slice(0, 4).map(t => traitTranslations[t] || t)
    ctx.fillText(engTraits.join(' · '), POSTER_WIDTH / 2, traitY + 30)
  }

  // 7. 底部水印（双语）
  ctx.font = '18px sans-serif'
  ctx.fillStyle = COLORS.goldDark
  ctx.fillText('Lanna Spirit Mirror · กระจกวิญญาณล้านนา', POSTER_WIDTH / 2, POSTER_HEIGHT - 50)

  return canvas.toDataURL('image/png', 1.0)
}

/**
 * 下载图片
 */
export function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * 从 URL 或 base64 获取 dataURL（用于下载）
 */
export async function getImageDataUrl(src: string): Promise<string> {
  // 如果已经是 data URL，直接返回
  if (src.startsWith('data:')) {
    return src
  }

  // 否则加载图片并转换
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/png', 1.0)
}

/**
 * 生成合像海报（多人守护灵）
 */
export async function generateGroupPoster(options: GroupPosterOptions): Promise<string> {
  const { persons, includeOriginal = false } = options
  const count = persons.length

  if (count < 2) {
    throw new Error('Group poster requires at least 2 persons')
  }

  const canvas = document.createElement('canvas')
  canvas.width = POSTER_WIDTH
  canvas.height = POSTER_HEIGHT
  const ctx = canvas.getContext('2d')!

  // 1. 绘制背景渐变
  const gradient = ctx.createLinearGradient(0, 0, 0, POSTER_HEIGHT)
  gradient.addColorStop(0, COLORS.background)
  gradient.addColorStop(0.5, COLORS.backgroundGradientEnd)
  gradient.addColorStop(1, COLORS.background)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT)

  // 微妙纹理
  ctx.globalAlpha = 0.03
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * POSTER_WIDTH
    const y = Math.random() * POSTER_HEIGHT
    ctx.fillStyle = Math.random() > 0.5 ? COLORS.white : COLORS.gold
    ctx.fillRect(x, y, 1, 1)
  }
  ctx.globalAlpha = 1

  // 2. 绘制装饰边框
  drawLannaBorder(ctx, POSTER_WIDTH, POSTER_HEIGHT, COLORS.gold)

  // 3. 顶部标题
  ctx.textAlign = 'center'
  ctx.font = 'bold 48px serif'
  ctx.fillStyle = COLORS.gold
  ctx.shadowColor = COLORS.gold
  ctx.shadowBlur = 15
  ctx.fillText('LANNA SPIRITS', POSTER_WIDTH / 2, 100)
  ctx.shadowBlur = 0

  ctx.font = '22px serif'
  ctx.fillStyle = COLORS.whiteTranslucent
  ctx.fillText('กระจกวิญญาณล้านนา', POSTER_WIDTH / 2, 135)

  // 4. 加载所有图片
  const loadedPersons = await Promise.all(
    persons.map(async (p) => ({
      ...p,
      generatedImg: await loadImage(p.generatedImage),
      originalImg: p.originalImage ? await loadImage(p.originalImage).catch(() => null) : null,
    })),
  )

  // 5. 根据人数计算布局
  const layouts = getGroupLayout(count, includeOriginal)
  const startY = 180
  const availableHeight = includeOriginal ? 1100 : 1300

  for (let i = 0; i < loadedPersons.length; i++) {
    const person = loadedPersons[i]!
    const layout = layouts[i]!
    const spiritInfo = SPIRIT_INFO[person.spiritId as keyof typeof SPIRIT_INFO]
    const spiritColor = spiritInfo?.color || COLORS.gold

    // 计算位置
    const centerX = POSTER_WIDTH * layout.x
    const centerY = startY + availableHeight * layout.y
    const maxSize = Math.min(POSTER_WIDTH, availableHeight) * layout.size

    // 绘制生成图
    drawMainImage(ctx, person.generatedImg, centerX, centerY, maxSize, maxSize, spiritColor)

    // 守护灵 emoji 和名称（图片下方）
    const labelY = centerY + maxSize / 2 + 40
    ctx.font = 'bold 28px serif'
    ctx.fillStyle = spiritColor
    ctx.shadowColor = spiritColor
    ctx.shadowBlur = 8
    ctx.fillText(`${spiritInfo?.emoji || '✨'} ${spiritInfo?.name || ''}`, centerX, labelY)
    ctx.shadowBlur = 0
  }

  // 6. 底部对比区（如果包含原图）
  if (includeOriginal) {
    const compareY = 1380
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    drawRoundedRect(ctx, 60, compareY - 30, POSTER_WIDTH - 120, 140, 20)
    ctx.fill()

    ctx.font = '18px sans-serif'
    ctx.fillStyle = COLORS.goldDark
    ctx.fillText('TRANSFORMATION', POSTER_WIDTH / 2, compareY)

    // 绘制原图 -> 生成图 缩略对
    const pairWidth = (POSTER_WIDTH - 120) / count
    for (let i = 0; i < loadedPersons.length; i++) {
      const person = loadedPersons[i]!
      const spiritInfo = SPIRIT_INFO[person.spiritId as keyof typeof SPIRIT_INFO]
      const spiritColor = spiritInfo?.color || COLORS.gold
      const pairX = 60 + pairWidth * (i + 0.5)

      if (person.originalImg) {
        drawCircularImage(ctx, person.originalImg, pairX - 45, compareY + 55, 30, COLORS.goldDark)
      }
      ctx.fillStyle = spiritColor
      ctx.font = '16px sans-serif'
      ctx.fillText('→', pairX, compareY + 60)
      drawCircularImage(ctx, person.generatedImg, pairX + 45, compareY + 55, 30, spiritColor)
    }
  }

  // 7. 底部水印
  ctx.font = '18px sans-serif'
  ctx.fillStyle = COLORS.goldDark
  ctx.fillText('Lanna Spirit Mirror · กระจกวิญญาณล้านนา', POSTER_WIDTH / 2, POSTER_HEIGHT - 50)

  return canvas.toDataURL('image/png', 1.0)
}

// 根据人数计算布局位置
function getGroupLayout(count: number, includeOriginal: boolean): Array<{ x: number, y: number, size: number }> {
  // x, y 是中心点的相对位置 (0-1)，size 是相对尺寸
  if (count === 2) {
    return [
      { x: 0.3, y: 0.4, size: 0.45 },
      { x: 0.7, y: 0.4, size: 0.45 },
    ]
  }
  if (count === 3) {
    return [
      { x: 0.5, y: 0.25, size: 0.4 },
      { x: 0.3, y: 0.65, size: 0.35 },
      { x: 0.7, y: 0.65, size: 0.35 },
    ]
  }
  // 4人：2x2 网格
  return [
    { x: 0.3, y: 0.28, size: 0.38 },
    { x: 0.7, y: 0.28, size: 0.38 },
    { x: 0.3, y: 0.72, size: 0.38 },
    { x: 0.7, y: 0.72, size: 0.38 },
  ]
}
