'use client'

import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

// 过滤 MediaPipe 的 INFO 日志（它们被错误地输出到 stderr）
if (typeof window !== 'undefined') {
  const originalError = console.error
  console.error = (...args: unknown[]) => {
    const msg = args[0]
    if (typeof msg === 'string' && msg.includes('Created TensorFlow Lite XNNPACK delegate')) {
      return // 静默忽略这个 INFO 消息
    }
    originalError.apply(console, args)
  }
}
import { matchSpiritByExpression, SPIRIT_INFO } from './facsAnalyzer'
import { PersonTracker } from './personTracker'
import type { TrackedPerson } from './personTracker'
import { downloadImage, generateLannaPoster, getImageDataUrl } from './posterGenerator'
import { LANNA_SPIRITS } from './spiritData'
import type { LannaSpirit } from './types'

// 守护灵顺序（用于渲染）
const SPIRIT_ORDER = ['naga', 'singha', 'hong', 'chang', 'garuda'] as const

// 兰纳主色调
const LANNA_GOLD = [212, 175, 55] // 金色

// hex 转 rgb
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1]!, 16), parseInt(result[2]!, 16), parseInt(result[3]!, 16)]
    : LANNA_GOLD as [number, number, number]
}

type MirrorState = 'attract' | 'generate' | 'result'

export function LannaMirror() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<MirrorState>('attract')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const animationRef = useRef<number>(0)
  const segmenterRef = useRef<any>(null)
  const faceLandmarkerRef = useRef<any>(null)
  const personTrackerRef = useRef<PersonTracker>(new PersonTracker())

  // 多人追踪状态
  const [trackedPersons, setTrackedPersons] = useState<TrackedPerson[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  // 头部抠像缩略图 (personId -> dataURL)
  const [headThumbnails, setHeadThumbnails] = useState<Record<string, string>>({})
  const lastThumbnailUpdateRef = useRef<number>(0)
  const thumbnailCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // 匹配相关状态
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [matchedSpirit, setMatchedSpirit] = useState<LannaSpirit | null>(null)

  // 生成相关状态
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // 历史记录状态
  const [historyRecords, setHistoryRecords] = useState<Array<{
    id: number
    spiritId: string
    spiritName: string | null
    userPhoto: string | null
    generatedImage: string
    createdAt: string
  }>>([])
  const [showHistory, setShowHistory] = useState(false)
  const [previewRecord, setPreviewRecord] = useState<{
    generatedImage: string
    userPhoto: string | null
    spiritId: string
  } | null>(null)
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false)

  // 下载处理函数
  const handleDownloadOriginal = async () => {
    if (!previewRecord?.userPhoto) return
    try {
      const dataUrl = await getImageDataUrl(previewRecord.userPhoto)
      downloadImage(dataUrl, `lanna-original-${Date.now()}.png`)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const handleDownloadGenerated = async () => {
    if (!previewRecord?.generatedImage) return
    try {
      const dataUrl = await getImageDataUrl(previewRecord.generatedImage)
      downloadImage(dataUrl, `lanna-spirit-${previewRecord.spiritId}-${Date.now()}.png`)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const handleDownloadPoster = async () => {
    if (!previewRecord?.generatedImage || !previewRecord.userPhoto) return
    setIsGeneratingPoster(true)
    try {
      const posterDataUrl = await generateLannaPoster({
        originalImage: previewRecord.userPhoto,
        generatedImage: previewRecord.generatedImage,
        spiritId: previewRecord.spiritId,
      })
      downloadImage(posterDataUrl, `lanna-spirit-poster-${previewRecord.spiritId}-${Date.now()}.png`)
    } catch (err) {
      console.error('Poster generation failed:', err)
    } finally {
      setIsGeneratingPoster(false)
    }
  }

  // 初始化摄像头
  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    }
    catch (err) {
      setError('ไม่สามารถเข้าถึงกล้อง / Cannot access camera')
      console.error('Camera error:', err)
    }
  }, [])

  // 初始化 MediaPipe (Segmenter + Face Landmarker)
  const initMediaPipe = useCallback(async () => {
    try {
      const { ImageSegmenter, FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      )

      // 初始化 Segmenter
      const segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        outputCategoryMask: true,
      })
      segmenterRef.current = segmenter

      // 初始化 Face Landmarker (FACS 基础) - 支持多人
      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 4, // 支持最多 4 人同时检测
        outputFaceBlendshapes: true,
      })
      faceLandmarkerRef.current = faceLandmarker

      setIsLoading(false)
    }
    catch (err) {
      setError('โหลด AI ล้มเหลว / Failed to load AI')
      console.error('MediaPipe error:', err)
    }
  }, [])

  // 渲染循环 - 实时分割并染色 + FACS 表情分析
  const renderLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const segmenter = segmenterRef.current
    const faceLandmarker = faceLandmarkerRef.current

    if (!video || !canvas || !segmenter || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(renderLoop)
      return
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx)
      return

    const width = video.videoWidth
    const height = video.videoHeight
    const now = performance.now()

    // 设置 canvas 尺寸（只设置一次）
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    // 先绘制原始视频（不镜像），用于分割
    ctx.drawImage(video, 0, 0, width, height)

    // FACS 表情分析 - 多人追踪
    if (faceLandmarker) {
      const faceResult = faceLandmarker.detectForVideo(video, now)
      const faceLandmarksList: NormalizedLandmark[][] = faceResult.faceLandmarks || []

      // 更新人员追踪器
      const persons = personTrackerRef.current.update(faceLandmarksList)
      setTrackedPersons(persons)

      // 绘制每人的表情状态覆盖层
      const overlayCanvas = overlayCanvasRef.current
      if (overlayCanvas) {
        const overlayCtx = overlayCanvas.getContext('2d')
        if (overlayCtx) {
          // 同步尺寸
          if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
            overlayCanvas.width = width
            overlayCanvas.height = height
          }
          overlayCtx.clearRect(0, 0, width, height)

          // 不在镜子上绘制任何标注，保持镜子干净
        }
      }
    }

    // 执行分割
    const result = segmenter.segmentForVideo(video, now)

    if (result.categoryMask) {
      const mask = result.categoryMask.getAsUint8Array()
      const imageData = ctx.getImageData(0, 0, width, height)
      const data = imageData.data

      // 创建输出 imageData（镜像后的）
      const outputData = ctx.createImageData(width, height)
      const output = outputData.data

      // 第一遍：基础处理 + 镜像
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIndex = y * width + x
          const mirrorX = width - 1 - x
          const dstIndex = y * width + mirrorX

          const srcPixel = srcIndex * 4
          const dstPixel = dstIndex * 4

          const r = data[srcPixel]!
          const g = data[srcPixel + 1]!
          const b = data[srcPixel + 2]!

          if (mask[srcIndex]! === 0) {
            // 人像区域 (mask=0) - 保留原色，轻微暖色调提亮
            output[dstPixel] = Math.min(255, Math.round(r * 1.1 + 15))
            output[dstPixel + 1] = Math.min(255, Math.round(g * 1.05 + 10))
            output[dstPixel + 2] = Math.min(255, Math.round(b * 0.95 + 5))
            output[dstPixel + 3] = 255
          }
          else {
            // 背景 (mask>0) - 暗化但保留可见度
            output[dstPixel] = Math.round(r * 0.25)
            output[dstPixel + 1] = Math.round(g * 0.25)
            output[dstPixel + 2] = Math.round(b * 0.3)
            output[dstPixel + 3] = 255
          }
        }
      }

      // 第二遍：检测边缘并添加守护灵颜色发光
      const edgeGlow = 3
      const persons = personTrackerRef.current.getPersons()

      for (let y = edgeGlow; y < height - edgeGlow; y++) {
        for (let x = edgeGlow; x < width - edgeGlow; x++) {
          const srcIndex = y * width + x
          if (mask[srcIndex]! !== 0)
            continue // 跳过背景

          let isEdge = false
          for (let dy = -1; dy <= 1 && !isEdge; dy++) {
            for (let dx = -1; dx <= 1 && !isEdge; dx++) {
              if (dx === 0 && dy === 0)
                continue
              const neighborIndex = (y + dy) * width + (x + dx)
              if (mask[neighborIndex]! !== 0) {
                isEdge = true // 邻居是背景，说明当前是边缘
              }
            }
          }

          if (isEdge) {
            const mirrorX = width - 1 - x
            // 归一化坐标（镜像后）
            const normX = mirrorX / width
            const normY = y / height

            // 找最近的人，使用其守护灵颜色
            let glowColor = LANNA_GOLD
            let minDist = Infinity

            for (const person of persons) {
              const dx = normX - person.center.x
              const dy = normY - person.center.y
              const dist = dx * dx + dy * dy
              if (dist < minDist) {
                minDist = dist
                const spiritInfo = SPIRIT_INFO[person.dominantSpirit as keyof typeof SPIRIT_INFO]
                if (spiritInfo) {
                  glowColor = hexToRgb(spiritInfo.color)
                }
              }
            }

            for (let gy = -edgeGlow; gy <= edgeGlow; gy++) {
              for (let gx = -edgeGlow; gx <= edgeGlow; gx++) {
                const dist = Math.sqrt(gx * gx + gy * gy)
                if (dist > edgeGlow)
                  continue

                const glowY = y + gy
                const glowX = mirrorX + gx
                if (glowY < 0 || glowY >= height || glowX < 0 || glowX >= width)
                  continue

                const glowIndex = (glowY * width + glowX) * 4
                const intensity = (1 - dist / edgeGlow) * 0.7

                output[glowIndex] = Math.min(255, output[glowIndex]! + glowColor[0]! * intensity)
                output[glowIndex + 1] = Math.min(255, output[glowIndex + 1]! + glowColor[1]! * intensity)
                output[glowIndex + 2] = Math.min(255, output[glowIndex + 2]! + glowColor[2]! * intensity)
              }
            }
          }
        }
      }

      ctx.putImageData(outputData, 0, 0)

      // 兰纳风格边框
      ctx.strokeStyle = '#CC785C'
      ctx.lineWidth = 4
      ctx.strokeRect(2, 2, width - 4, height - 4)

      // 提取头部真实抠像缩略图（节流：每 300ms 更新一次）
      if (persons.length > 0 && now - lastThumbnailUpdateRef.current > 300) {
        lastThumbnailUpdateRef.current = now

        if (!thumbnailCanvasRef.current) {
          thumbnailCanvasRef.current = document.createElement('canvas')
        }
        const thumbCanvas = thumbnailCanvasRef.current
        const thumbSize = 80
        const newThumbnails: Record<string, string> = {}

        for (const person of persons) {
          // 头部区域（原始坐标，未镜像）
          const headRadius = person.size * 1.5
          const srcCenterX = person.center.x * width
          const srcCenterY = person.center.y * height

          const srcX = Math.max(0, Math.round(srcCenterX - headRadius * width))
          const srcY = Math.max(0, Math.round(srcCenterY - headRadius * height * 1.2))
          const srcW = Math.min(width - srcX, Math.round(headRadius * width * 2))
          const srcH = Math.min(height - srcY, Math.round(headRadius * height * 2.4))

          if (srcW > 20 && srcH > 20) {
            thumbCanvas.width = thumbSize
            thumbCanvas.height = thumbSize
            const thumbCtx = thumbCanvas.getContext('2d')
            if (!thumbCtx) continue

            // 创建带透明通道的 imageData
            const thumbData = thumbCtx.createImageData(thumbSize, thumbSize)
            const thumbPixels = thumbData.data

            for (let ty = 0; ty < thumbSize; ty++) {
              for (let tx = 0; tx < thumbSize; tx++) {
                // 源图坐标
                const sx = Math.floor(srcX + (tx / thumbSize) * srcW)
                const sy = Math.floor(srcY + (ty / thumbSize) * srcH)

                if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                  const srcIdx = sy * width + sx
                  const srcPixel = srcIdx * 4
                  // 镜像 x
                  const mirrorTx = thumbSize - 1 - tx
                  const thumbIdx = (ty * thumbSize + mirrorTx) * 4

                  // 用 mask 判断是否为人像（mask=0 是人像，mask>0 是背景）
                  if (mask[srcIdx]! === 0) {
                    thumbPixels[thumbIdx] = data[srcPixel]!
                    thumbPixels[thumbIdx + 1] = data[srcPixel + 1]!
                    thumbPixels[thumbIdx + 2] = data[srcPixel + 2]!
                    thumbPixels[thumbIdx + 3] = 255
                  }
                  // else: 背景保持透明
                }
              }
            }

            thumbCtx.putImageData(thumbData, 0, 0)
            newThumbnails[person.id] = thumbCanvas.toDataURL('image/png')
          }
        }

        if (Object.keys(newThumbnails).length > 0) {
          setHeadThumbnails(newThumbnails)
        }
      }

      result.categoryMask.close()
    }

    result.close()
    animationRef.current = requestAnimationFrame(renderLoop)
  }, [])

  // 重新开始
  const restart = useCallback(() => {
    setCapturedPhoto(null)
    setMatchedSpirit(null)
    setGeneratedImage(null)
    setGenerateError(null)
    setTrackedPersons([])
    setSelectedPersonId(null)
    personTrackerRef.current.reset()
    setState('attract')
  }, [])

  // 生成灵魂画像
  const generateSpiritImage = useCallback(async () => {
    if (!matchedSpirit)
      return

    setState('generate')
    setGenerateError(null)

    try {
      const response = await fetch('/api/generate-spirit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spirit: matchedSpirit,
          userPhoto: capturedPhoto,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed')
      }

      setGeneratedImage(data.image)
      setState('result')
    }
    catch (err) {
      console.error('Generation error:', err)
      setGenerateError(err instanceof Error ? err.message : 'Generation failed')
    }
  }, [matchedSpirit, capturedPhoto])

  // 获取历史记录
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/spirit-history?limit=20')
      const data = await res.json()
      if (data.records) {
        setHistoryRecords(data.records)
      }
    } catch (err) {
      console.error('Failed to fetch history:', err)
    }
  }, [])

  // 从 attract 状态直接生成某人的守护灵画像
  const handleGenerateForPerson = useCallback(async (person: TrackedPerson) => {
    const spirit = LANNA_SPIRITS.find(s => s.id === person.dominantSpirit)
    if (!spirit) return

    const photo = headThumbnails[person.id] || null
    setMatchedSpirit(spirit)
    setCapturedPhoto(photo)
    setState('generate')
    setGenerateError(null)

    try {
      const response = await fetch('/api/generate-spirit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spirit,
          userPhoto: photo,
          spiritScores: person.spiritScores,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Generation failed')
      }
      setGeneratedImage(data.image)
      setState('result')
      fetchHistory() // 刷新历史记录
    } catch (err) {
      console.error('Generation error:', err)
      setGenerateError(err instanceof Error ? err.message : 'Generation failed')
    }
  }, [headThumbnails, fetchHistory])

  // 下载当前生成的图片（结果页使用）
  const downloadCurrentImage = useCallback(() => {
    if (!generatedImage || !matchedSpirit)
      return

    const link = document.createElement('a')
    link.href = generatedImage
    link.download = `lanna-spirit-${matchedSpirit.id}-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [generatedImage, matchedSpirit])

  // 初始化
  useEffect(() => {
    initCamera()
    initMediaPipe()
    fetchHistory()

    return () => {
      cancelAnimationFrame(animationRef.current)
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach(track => track.stop())
      }
    }
  }, [initCamera, initMediaPipe, fetchHistory])

  // 开始渲染循环
  useEffect(() => {
    if (!isLoading && state === 'attract') {
      animationRef.current = requestAnimationFrame(renderLoop)
    }
    return () => cancelAnimationFrame(animationRef.current)
  }, [isLoading, state, renderLoop])

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive text-lg">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            ลองอีกครั้ง / Retry
          </Button>
        </div>
      </div>
    )
  }

  const personCount = trackedPersons.length
  const hasPersons = personCount > 0

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black">
      {/* 隐藏的视频元素 */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
      />

      {/* 左侧面板 */}
      <div className="w-80 shrink-0 flex flex-col bg-black/95 border-r border-[#D4AF37]/30 overflow-y-auto">
        {/* 标题区域 */}
        <div className="p-6 border-b border-[#D4AF37]/20">
          <h1
            className="text-2xl font-bold tracking-widest"
            style={{ color: '#CC785C' }}
          >
            กระจกวิญญาณล้านนา
          </h1>
          <p className="text-white/50 mt-1 text-sm">Lanna Spirit Mirror</p>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 p-4">
          {/* 加载状态 */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-white">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-white/60">กำลังโหลด AI...</p>
              <p className="text-xs text-white/40 mt-1">Loading AI...</p>
            </div>
          )}

          {/* 吸引模式 - 等待或显示守护灵面板 */}
          {state === 'attract' && !isLoading && (
            <>
              {!hasPersons ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">🪞</div>
                  <p className="text-white/40 text-sm">เข้ามาใกล้กระจก...</p>
                  <p className="text-white/30 text-xs mt-1">Step closer to the mirror...</p>
                  <p className="text-white/30 text-xs mt-3">ระบบจะวิเคราะห์การแสดงออกของคุณ</p>
                  <p className="text-white/20 text-xs mt-1">System will analyze your expressions</p>
                </div>
              ) : (
                <>
                  {/* 守护灵面板 */}
                  <div className="space-y-3">
                    {trackedPersons.map((person) => {
                      const thumbnail = headThumbnails[person.id]
                      const spiritInfo = SPIRIT_INFO[person.dominantSpirit as keyof typeof SPIRIT_INFO]

                      return (
                        <div
                          key={person.id}
                          className="bg-black/50 rounded-lg p-3 border border-[#D4AF37]/20"
                        >
                          {/* 头部：抠像头像 + 主导守护灵 */}
                          <div className="flex items-center gap-3 mb-3">
                            {/* 头部抠像缩略图 - 透明背景用守护灵颜色填充 */}
                            <div
                              className="w-14 h-14 rounded-full overflow-hidden border-2 shrink-0"
                              style={{
                                borderColor: spiritInfo?.color || '#D4AF37',
                                background: `radial-gradient(circle, ${spiritInfo?.color}40 0%, ${spiritInfo?.color}20 100%)`,
                              }}
                            >
                              {thumbnail ? (
                                <img
                                  src={thumbnail}
                                  alt=""
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-white/30 text-xs">...</span>
                                </div>
                              )}
                            </div>
                            {/* 守护灵信息 */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xl">{spiritInfo?.emoji}</span>
                              <span className="text-white/70 text-sm">{spiritInfo?.name}</span>
                            </div>
                          </div>

                        {/* 守护灵亲和度条形图 - 按分数倒序 */}
                        <div className="space-y-1.5">
                          {Object.entries(person.spiritScores)
                            .sort(([, a], [, b]) => b - a)
                            .map(([spiritId, score]) => {
                              const info = SPIRIT_INFO[spiritId as keyof typeof SPIRIT_INFO]
                              const isDominant = spiritId === person.dominantSpirit

                              return (
                                <div key={spiritId} className="flex items-center gap-2">
                                  <span className="w-5 text-center text-sm">{info.emoji}</span>
                                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${score * 100}%`,
                                        backgroundColor: isDominant ? info.color : `${info.color}66`,
                                      }}
                                    />
                                  </div>
                                  <span
                                    className={`w-9 text-right text-xs ${isDominant ? 'text-white font-bold' : 'text-white/40'}`}
                                  >
                                    {Math.round(score * 100)}%
                                  </span>
                                </div>
                              )
                            })}
                        </div>

                        {/* 生成守护灵画像按钮 */}
                        <Button
                          onClick={() => handleGenerateForPerson(person)}
                          className="w-full mt-3"
                        >
                          ✨ สร้างภาพวิญญาณ / Generate Portrait
                        </Button>
                      </div>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* 结果展示 */}
          {state === 'result' && matchedSpirit && (
            <div className="space-y-4">
              {/* 守护灵名称 */}
              <div className="text-center">
                <div
                  className="text-3xl font-bold mb-1"
                  style={{ color: matchedSpirit.color }}
                >
                  {matchedSpirit.nameCn}
                </div>
                <div className="text-lg text-white/60">
                  {matchedSpirit.name}
                </div>
                <div className="text-sm text-white/40">
                  {matchedSpirit.nameEn}
                </div>
              </div>

              {/* 描述 */}
              <p className="text-sm text-white/70 leading-relaxed">
                {matchedSpirit.description}
              </p>

              {/* 特质标签 */}
              <div className="flex flex-wrap gap-2">
                {matchedSpirit.traits.map(trait => (
                  <span
                    key={trait}
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${matchedSpirit.color}20`,
                      color: matchedSpirit.color,
                    }}
                  >
                    {trait}
                  </span>
                ))}
              </div>

              {/* 原始头像 vs 生成画像对比 */}
              {generatedImage && (
                <div className="space-y-2">
                  <div className="flex gap-3 items-center justify-center">
                    {/* 原始头像 */}
                    {capturedPhoto && (
                      <div className="text-center">
                        <p className="text-white/40 text-xs mb-1">ต้นฉบับ</p>
                        <div
                          className="w-20 h-20 rounded-full overflow-hidden border-2"
                          style={{
                            borderColor: matchedSpirit.color,
                            background: `radial-gradient(circle, ${matchedSpirit.color}40 0%, ${matchedSpirit.color}20 100%)`,
                          }}
                        >
                          <img src={capturedPhoto} alt="Original" className="w-full h-full object-contain" />
                        </div>
                      </div>
                    )}
                    {/* 箭头 */}
                    <div className="text-white/30 text-xl">→</div>
                    {/* 生成结果缩略图 */}
                    <div className="text-center">
                      <p className="text-white/40 text-xs mb-1">วิญญาณ</p>
                      <div
                        className="w-20 h-20 rounded-full overflow-hidden border-2"
                        style={{ borderColor: matchedSpirit.color }}
                      >
                        <img src={generatedImage} alt="Spirit" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  </div>
                  {/* 完整生成画像 */}
                  <img
                    src={generatedImage}
                    alt="Your Lanna Spirit"
                    className="w-full rounded-lg border-2 shadow-lg"
                    style={{ borderColor: matchedSpirit.color }}
                  />
                </div>
              )}

              {/* 操作按钮 */}
              <div className="space-y-2 pt-2">
                {generatedImage ? (
                  <Button
                    onClick={downloadCurrentImage}
                    className="w-full"
                    style={{ backgroundColor: matchedSpirit.color }}
                  >
                    ดาวน์โหลด / Download
                  </Button>
                ) : (
                  <Button
                    onClick={generateSpiritImage}
                    className="w-full"
                    style={{ backgroundColor: matchedSpirit.color }}
                  >
                    สร้างภาพวิญญาณ / Generate Portrait
                  </Button>
                )}
                <Button
                  onClick={restart}
                  variant="outline"
                  className="w-full"
                >
                  ทดสอบอีกครั้ง / Try Again
                </Button>
              </div>
            </div>
          )}

          {/* 生成中状态 */}
          {state === 'generate' && (
            <div className="text-center py-8">
              {/* 原始采集头像 */}
              {capturedPhoto && matchedSpirit && (
                <div className="mb-4">
                  <p className="text-white/40 text-xs mb-2">ภาพต้นฉบับ / Original</p>
                  <div
                    className="w-24 h-24 mx-auto rounded-full overflow-hidden border-2"
                    style={{
                      borderColor: matchedSpirit.color,
                      background: `radial-gradient(circle, ${matchedSpirit.color}40 0%, ${matchedSpirit.color}20 100%)`,
                    }}
                  >
                    <img src={capturedPhoto} alt="Original" className="w-full h-full object-contain" />
                  </div>
                </div>
              )}
              {generateError ? (
                <>
                  <div className="text-4xl mb-4">⚠️</div>
                  <p className="text-red-400 mb-2">การสร้างล้มเหลว / Generation Failed</p>
                  <p className="text-xs text-white/50 mb-4">{generateError}</p>
                  <div className="space-y-2">
                    <Button onClick={generateSpiritImage} size="sm" style={{ backgroundColor: '#CC785C' }}>
                      ลองอีกครั้ง / Retry
                    </Button>
                    <Button onClick={restart} variant="outline" size="sm" className="ml-2">
                      เริ่มใหม่ / Start Over
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#D4AF37] border-t-transparent mx-auto" />
                  <p className="text-white/80 text-sm">กำลังสร้างภาพ...</p>
                  <p className="text-xs text-white/40 mt-1">Generating portrait...</p>
                  <p className="text-xs text-white/30 mt-2">ประมาณ 10-30 วินาที / About 10-30 seconds</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* 历史记录面板 */}
        <div className="border-t border-[#D4AF37]/20">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full p-3 flex items-center justify-between text-white/60 hover:text-white/80 transition-colors"
          >
            <span className="text-sm">ประวัติ / History ({historyRecords.length})</span>
            <span className="text-xs">{showHistory ? '▼' : '▶'}</span>
          </button>
          {showHistory && historyRecords.length > 0 && (
            <div className="px-3 pb-3 grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {historyRecords.map((record) => {
                const info = SPIRIT_INFO[record.spiritId as keyof typeof SPIRIT_INFO]
                return (
                  <div
                    key={record.id}
                    className="relative group cursor-pointer"
                    onClick={() => setPreviewRecord({
                      generatedImage: record.generatedImage,
                      userPhoto: record.userPhoto,
                      spiritId: record.spiritId,
                    })}
                  >
                    <img
                      src={record.generatedImage}
                      alt={record.spiritName || record.spiritId}
                      className="w-full aspect-square object-cover rounded border border-white/10 group-hover:border-[#D4AF37]/50 transition-colors"
                    />
                    <div
                      className="absolute bottom-0 left-0 right-0 text-center text-xs py-0.5 bg-black/60"
                      style={{ color: info?.color || '#D4AF37' }}
                    >
                      {info?.emoji}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {showHistory && historyRecords.length === 0 && (
            <p className="px-3 pb-3 text-white/30 text-xs text-center">ยังไม่มีประวัติ / No history yet</p>
          )}
        </div>

        {/* 底部信息 */}
        <div className="p-4 border-t border-[#D4AF37]/20 text-center">
          <p className="text-white/30 text-xs">วิเคราะห์ใบหน้าด้วย AI</p>
          <p className="text-white/20 text-xs mt-0.5">AI Facial Analysis</p>
        </div>
      </div>

      {/* 右侧镜子区域 */}
      <div className="flex-1 relative min-w-0 overflow-hidden">
        {/* 主画布 */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* 覆盖层画布 - 显示每人的编号 */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />

        {/* 镜子加载占位 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-6xl animate-pulse">🪞</div>
          </div>
        )}
      </div>

      {/* 大图预览浮层 */}
      {previewRecord && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewRecord(null)}
        >
          <div className="relative flex flex-col items-center gap-4 max-w-4xl" onClick={e => e.stopPropagation()}>
            {/* 图片展示区 */}
            <div className="flex items-center gap-6">
              {/* 原始头像 */}
              {previewRecord.userPhoto && (
                <div className="text-center">
                  <p className="text-white/50 text-sm mb-2">ต้นฉบับ / Original</p>
                  <div
                    className="w-32 h-32 rounded-full overflow-hidden border-2"
                    style={{
                      borderColor: SPIRIT_INFO[previewRecord.spiritId as keyof typeof SPIRIT_INFO]?.color || '#D4AF37',
                      background: `radial-gradient(circle, ${SPIRIT_INFO[previewRecord.spiritId as keyof typeof SPIRIT_INFO]?.color}40 0%, ${SPIRIT_INFO[previewRecord.spiritId as keyof typeof SPIRIT_INFO]?.color}20 100%)`,
                    }}
                  >
                    <img src={previewRecord.userPhoto} alt="Original" className="w-full h-full object-contain" />
                  </div>
                </div>
              )}
              {/* 箭头 */}
              {previewRecord.userPhoto && (
                <div className="text-white/40 text-3xl">→</div>
              )}
              {/* 生成结果 */}
              <div className="text-center">
                <p className="text-white/50 text-sm mb-2">วิญญาณ / Spirit</p>
                <img
                  src={previewRecord.generatedImage}
                  alt="Generated"
                  className="max-w-md max-h-[60vh] object-contain rounded-lg border-2"
                  style={{ borderColor: SPIRIT_INFO[previewRecord.spiritId as keyof typeof SPIRIT_INFO]?.color || '#D4AF37' }}
                />
              </div>
            </div>

            {/* 下载按钮组 */}
            <div className="flex items-center gap-3 mt-4 p-3 bg-black/50 rounded-xl backdrop-blur-sm">
              {/* 下载原图 */}
              {previewRecord.userPhoto && (
                <Button
                  size="sm"
                  onClick={handleDownloadOriginal}
                  className="bg-white/10 border border-white/30 text-white hover:bg-white/20 hover:border-white/50"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  原图
                </Button>
              )}
              {/* 下载生成图 */}
              <Button
                size="sm"
                onClick={handleDownloadGenerated}
                className="bg-white/10 border border-white/30 text-white hover:bg-white/20 hover:border-white/50"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                灵图
              </Button>
              {/* 下载海报 */}
              {previewRecord.userPhoto && (
                <Button
                  size="sm"
                  onClick={handleDownloadPoster}
                  disabled={isGeneratingPoster}
                  className="text-white font-medium shadow-lg"
                  style={{
                    backgroundColor: SPIRIT_INFO[previewRecord.spiritId as keyof typeof SPIRIT_INFO]?.color || '#D4AF37',
                  }}
                >
                  {isGeneratingPoster ? (
                    <>
                      <svg className="w-4 h-4 mr-1.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      生成中...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      海报
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* 关闭按钮 */}
            <button
              className="absolute -top-2 -right-2 w-8 h-8 bg-black/60 rounded-full text-white/80 hover:text-white flex items-center justify-center"
              onClick={() => setPreviewRecord(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
