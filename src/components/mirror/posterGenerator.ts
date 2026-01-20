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
    case 'water':
      // 水滴
      ctx.beginPath()
      ctx.moveTo(0, -12)
      ctx.bezierCurveTo(-10, 0, -8, 12, 0, 12)
      ctx.bezierCurveTo(8, 12, 10, 0, 0, -12)
      ctx.fill()
      break
    case 'fire':
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
      ctx.fillStyle = '#FFFFFF'
      ctx.globalAlpha = 0.5
      ctx.fill()
      ctx.globalAlpha = 1
      break
    case 'earth':
      // 山形
      ctx.beginPath()
      ctx.moveTo(-15, 10)
      ctx.lineTo(0, -10)
      ctx.lineTo(15, 10)
      ctx.closePath()
      ctx.fill()
      break
    case 'air':
      // 风纹
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(-12, -6 + i * 6)
        ctx.quadraticCurveTo(0, -10 + i * 6, 12, -6 + i * 6)
        ctx.stroke()
      }
      break
    case 'spirit':
      // 光芒
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2
        const innerR = 5
        const outerR = 12
        ctx.beginPath()
        ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR)
        ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.arc(0, 0, 5, 0, Math.PI * 2)
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

  // 3. 标题区域
  ctx.textAlign = 'center'

  // 主标题
  ctx.font = 'bold 72px serif'
  ctx.fillStyle = COLORS.gold
  ctx.shadowColor = COLORS.gold
  ctx.shadowBlur = 20
  ctx.fillText('LANNA SPIRIT', POSTER_WIDTH / 2, 180)
  ctx.shadowBlur = 0

  // 副标题
  ctx.font = '32px serif'
  ctx.fillStyle = COLORS.whiteTranslucent
  ctx.fillText('กระจกวิญญาณล้านนา', POSTER_WIDTH / 2, 230)

  // 4. 加载图片
  const [originalImg, generatedImg] = await Promise.all([
    loadImage(options.originalImage),
    loadImage(options.generatedImage),
  ])

  // 5. 绘制原图（圆形，较小，顶部）
  const originalY = 380
  drawCircularImage(ctx, originalImg, POSTER_WIDTH / 2, originalY, 100, spiritColor)

  // 6. 绘制变形箭头
  drawTransformArrow(ctx, POSTER_WIDTH / 2, 530, spiritColor)

  // 7. 绘制生成图（主体）
  drawMainImage(ctx, generatedImg, POSTER_WIDTH / 2, 880, 700, 550, spiritColor)

  // 8. 守护灵信息区域
  const infoY = 1280

  // 守护灵名称
  ctx.font = 'bold 64px serif'
  ctx.fillStyle = spiritColor
  ctx.shadowColor = spiritColor
  ctx.shadowBlur = 15
  ctx.fillText(spiritInfo?.emoji || '✨', POSTER_WIDTH / 2, infoY)
  ctx.shadowBlur = 0

  // 泰语名 + 英文名
  ctx.font = 'bold 48px serif'
  ctx.fillStyle = COLORS.white
  const spiritThaiName = spiritInfo?.name || options.spiritName || options.spiritId
  ctx.fillText(spiritThaiName, POSTER_WIDTH / 2, infoY + 70)

  ctx.font = '36px serif'
  ctx.fillStyle = COLORS.goldLight
  const spiritEnName = spiritInfo?.nameEn || options.spiritNameEn || ''
  ctx.fillText(spiritEnName, POSTER_WIDTH / 2, infoY + 120)

  // 元素符号
  if (spiritInfo?.element) {
    drawElementSymbol(ctx, POSTER_WIDTH / 2, infoY + 180, spiritInfo.element, spiritColor)
    ctx.font = '24px sans-serif'
    ctx.fillStyle = COLORS.whiteTranslucent
    const elementNames: Record<string, string> = {
      water: 'น้ำ · Water',
      fire: 'ไฟ · Fire',
      earth: 'ดิน · Earth',
      air: 'ลม · Air',
      spirit: 'จิตวิญญาณ · Spirit',
    }
    ctx.fillText(elementNames[spiritInfo.element] || '', POSTER_WIDTH / 2, infoY + 220)
  }

  // 特质标签
  const traits = spiritInfo?.traits || options.spiritTraits || []
  if (traits.length > 0) {
    ctx.font = '24px sans-serif'
    const traitY = infoY + 280
    const traitWidth = 180
    const totalWidth = Math.min(traits.length, 4) * traitWidth
    const startX = (POSTER_WIDTH - totalWidth) / 2 + traitWidth / 2

    traits.slice(0, 4).forEach((trait, i) => {
      const tx = startX + i * traitWidth
      // 标签背景
      ctx.fillStyle = `${spiritColor}30`
      ctx.beginPath()
      ctx.roundRect(tx - 70, traitY - 20, 140, 40, 20)
      ctx.fill()
      ctx.strokeStyle = spiritColor
      ctx.lineWidth = 1
      ctx.stroke()

      // 标签文字
      ctx.fillStyle = COLORS.white
      ctx.fillText(trait.split(' / ')[0] || trait, tx, traitY + 8)
    })
  }

  // 9. 底部水印
  ctx.font = '20px sans-serif'
  ctx.fillStyle = COLORS.goldDark
  ctx.fillText('Lanna Spirit Mirror · 兰纳灵境', POSTER_WIDTH / 2, POSTER_HEIGHT - 80)
  ctx.font = '16px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillText('Generated with AI', POSTER_WIDTH / 2, POSTER_HEIGHT - 55)

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
