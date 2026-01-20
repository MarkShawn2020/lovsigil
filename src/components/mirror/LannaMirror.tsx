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

  // 匹配相关状态
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [matchedSpirit, setMatchedSpirit] = useState<LannaSpirit | null>(null)

  // 生成相关状态
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

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
      setError('无法访问摄像头，请检查权限设置')
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
      setError('加载 AI 模型失败')
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

          // 为每个追踪的人绘制编号标记（面板移到底部用 React 渲染）
          for (const person of persons) {
            const mirrorX = 1 - person.center.x
            const screenX = mirrorX * width
            const screenY = person.center.y * height
            const personIndex = persons.indexOf(person) + 1

            // 人员编号圆圈
            overlayCtx.fillStyle = 'rgba(204, 120, 92, 0.9)'
            overlayCtx.beginPath()
            overlayCtx.arc(screenX, screenY - person.size * height * 0.8, 20, 0, Math.PI * 2)
            overlayCtx.fill()

            // 编号
            overlayCtx.fillStyle = '#fff'
            overlayCtx.font = 'bold 16px system-ui'
            overlayCtx.textAlign = 'center'
            overlayCtx.textBaseline = 'middle'
            overlayCtx.fillText(`${personIndex}`, screenX, screenY - person.size * height * 0.8)

            // 主导守护灵 emoji 显示在编号下方
            const dominantInfo = SPIRIT_INFO[person.dominantSpirit as keyof typeof SPIRIT_INFO]
            if (dominantInfo) {
              overlayCtx.font = '24px system-ui'
              overlayCtx.fillText(dominantInfo.emoji, screenX, screenY - person.size * height * 0.8 + 30)
            }
          }
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

          if (mask[srcIndex]! > 0) {
            // 人像区域 - 保留原色，轻微暖色调提亮
            output[dstPixel] = Math.min(255, Math.round(r * 1.1 + 15))
            output[dstPixel + 1] = Math.min(255, Math.round(g * 1.05 + 10))
            output[dstPixel + 2] = Math.min(255, Math.round(b * 0.95 + 5))
            output[dstPixel + 3] = 255
          }
          else {
            // 背景 - 暗化但保留可见度
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
          if (mask[srcIndex]! === 0)
            continue

          let isEdge = false
          for (let dy = -1; dy <= 1 && !isEdge; dy++) {
            for (let dx = -1; dx <= 1 && !isEdge; dx++) {
              if (dx === 0 && dy === 0)
                continue
              const neighborIndex = (y + dy) * width + (x + dx)
              if (mask[neighborIndex]! === 0) {
                isEdge = true
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

      result.categoryMask.close()
    }

    result.close()
    animationRef.current = requestAnimationFrame(renderLoop)
  }, [])

  // 点击处理 - 根据点击位置选择人并匹配守护灵
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || state !== 'attract')
      return

    const persons = personTrackerRef.current.getPersons()
    if (persons.length === 0)
      return

    // 计算点击位置（归一化）
    const rect = canvas.getBoundingClientRect()
    const clickX = (e.clientX - rect.left) / rect.width
    const clickY = (e.clientY - rect.top) / rect.height

    // 找到点击位置最近的人，或使用主要人物
    let targetPerson: TrackedPerson | null = null

    if (persons.length === 1) {
      targetPerson = persons[0]!
    }
    else {
      // 多人时，找点击位置最近的
      targetPerson = personTrackerRef.current.findPersonNearPosition(clickX, clickY)
      if (!targetPerson) {
        // 如果点击位置没有人，使用最大的人
        targetPerson = personTrackerRef.current.getPrimaryPerson()
      }
    }

    if (!targetPerson || targetPerson.accumulator.getSampleCount() < 10) {
      return // 数据不足
    }

    // 保存当前画面
    const photo = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedPhoto(photo)
    setSelectedPersonId(targetPerson.id)

    // 基于该人的累积表情数据匹配守护灵
    const spirit = matchSpiritByExpression(targetPerson.accumulator)
    setMatchedSpirit(spirit)

    // 停止渲染循环
    cancelAnimationFrame(animationRef.current)
    setState('result')
  }, [state])

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

  // 下载图片
  const downloadImage = useCallback(() => {
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

    return () => {
      cancelAnimationFrame(animationRef.current)
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach(track => track.stop())
      }
    }
  }, [initCamera, initMediaPipe])

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
            重试
          </Button>
        </div>
      </div>
    )
  }

  const personCount = trackedPersons.length
  const hasPersons = personCount > 0

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-black">
      {/* 镜子区域 */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* 隐藏的视频元素 */}
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          muted
        />

        {/* 主画布 */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-contain"
          onClick={handleCanvasClick}
        />

        {/* 覆盖层画布 - 显示每人的编号 */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 h-full w-full object-contain pointer-events-none"
        />

        {/* 加载状态 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p>正在加载兰纳照妖镜...</p>
            </div>
          </div>
        )}

        {/* 标题 */}
        <div className="absolute top-6 left-0 right-0 text-center pointer-events-none">
          <h1
            className="text-3xl font-bold tracking-widest"
            style={{ color: '#CC785C', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
          >
            兰纳照妖镜
          </h1>
          <p className="text-white/60 mt-1 text-sm">Lanna Spirit Mirror</p>
        </div>

        {/* 吸引模式提示 */}
        {state === 'attract' && !isLoading && (
          <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
            <p className={`text-xl font-light tracking-wider ${hasPersons ? 'text-[#D4AF37] animate-pulse' : 'text-white/40'}`}>
              {hasPersons
                ? personCount > 1
                  ? '点击你想测试的人，照见守护灵'
                  : '点击屏幕，照见你的兰纳守护灵'
                : '请走近镜子...'}
            </p>
          </div>
        )}
      </div>

      {/* 底部 HUD 区域 - 镜子外面 */}
      {state === 'attract' && !isLoading && hasPersons && (
        <div className="shrink-0 h-28 bg-black/90 border-t border-[#D4AF37]/30 flex justify-center items-center gap-3 px-4 py-2">
          {trackedPersons.map((person, index) => (
            <div
              key={person.id}
              className="flex items-center gap-3 bg-black/50 rounded-lg px-3 py-2 border border-[#D4AF37]/20"
            >
              {/* 编号 + 主导守护灵 */}
              <div className="flex flex-col items-center">
                <span className="w-6 h-6 rounded-full bg-[#CC785C] flex items-center justify-center text-white text-xs font-bold">
                  {index + 1}
                </span>
                <span className="text-lg mt-1">
                  {SPIRIT_INFO[person.dominantSpirit as keyof typeof SPIRIT_INFO]?.emoji}
                </span>
              </div>

              {/* 守护灵亲和度条形图 - 水平紧凑布局 */}
              <div className="flex flex-col gap-0.5">
                {SPIRIT_ORDER.map((spiritId) => {
                  const info = SPIRIT_INFO[spiritId]
                  const score = person.spiritScores[spiritId]
                  const isDominant = spiritId === person.dominantSpirit

                  return (
                    <div key={spiritId} className="flex items-center gap-1">
                      <span className="w-4 text-center text-xs">{info.emoji}</span>
                      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${score * 100}%`,
                            backgroundColor: isDominant ? info.color : `${info.color}66`,
                          }}
                        />
                      </div>
                      <span
                        className={`w-7 text-right text-[10px] ${isDominant ? 'text-white font-bold' : 'text-white/40'}`}
                      >
                        {Math.round(score * 100)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 结果展示 */}
      {state === 'result' && matchedSpirit && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="bg-card/95 backdrop-blur p-8 rounded-2xl max-w-lg w-full mx-4 shadow-2xl text-center">
            {/* 守护灵名称 */}
            <div
              className="text-5xl font-bold mb-2"
              style={{ color: matchedSpirit.color }}
            >
              {matchedSpirit.nameCn}
            </div>
            <div className="text-2xl text-muted-foreground mb-1">
              {matchedSpirit.name}
            </div>
            <div className="text-lg text-muted-foreground/70 mb-6">
              {matchedSpirit.nameEn}
            </div>

            {/* 描述 */}
            <p className="text-lg leading-relaxed mb-6">
              {matchedSpirit.description}
            </p>

            {/* 特质标签 */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {matchedSpirit.traits.map(trait => (
                <span
                  key={trait}
                  className="px-4 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: `${matchedSpirit.color}20`,
                    color: matchedSpirit.color,
                  }}
                >
                  {trait}
                </span>
              ))}
            </div>

            {/* 生成的画像或拍摄的照片 */}
            <div className="mb-6">
              {generatedImage
                ? (
                    <img
                      src={generatedImage}
                      alt="Your Lanna Spirit"
                      className="w-64 h-auto mx-auto rounded-lg border-4 shadow-lg"
                      style={{ borderColor: matchedSpirit.color }}
                    />
                  )
                : capturedPhoto && (
                    <img
                      src={capturedPhoto}
                      alt="Your photo"
                      className="w-48 h-auto mx-auto rounded-lg border-4 opacity-80"
                      style={{ borderColor: matchedSpirit.color }}
                    />
                  )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-4">
              <Button
                onClick={restart}
                variant="outline"
                className="flex-1"
              >
                重新测试
              </Button>
              {generatedImage
                ? (
                    <Button
                      onClick={downloadImage}
                      className="flex-1"
                      style={{ backgroundColor: matchedSpirit.color }}
                    >
                      下载画像
                    </Button>
                  )
                : (
                    <Button
                      onClick={generateSpiritImage}
                      className="flex-1"
                      style={{ backgroundColor: matchedSpirit.color }}
                    >
                      生成灵魂画像
                    </Button>
                  )}
            </div>
          </div>
        </div>
      )}

      {/* 生成中状态 */}
      {state === 'generate' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center text-white max-w-md mx-4">
            {generateError
              ? (
                  <>
                    <div className="text-6xl mb-4">⚠️</div>
                    <p className="text-xl text-red-400 mb-2">生成失败</p>
                    <p className="text-sm text-white/60 mb-6">{generateError}</p>
                    <div className="flex gap-4 justify-center">
                      <Button onClick={restart} variant="outline">
                        重新开始
                      </Button>
                      <Button onClick={generateSpiritImage} style={{ backgroundColor: '#CC785C' }}>
                        重试
                      </Button>
                    </div>
                  </>
                )
              : (
                  <>
                    <div className="mb-4 h-16 w-16 animate-spin rounded-full border-4 border-[#D4AF37] border-t-transparent mx-auto" />
                    <p className="text-xl">正在生成你的兰纳灵魂画像...</p>
                    <p className="text-sm text-white/60 mt-2">这可能需要 10-30 秒</p>
                  </>
                )}
          </div>
        </div>
      )}

    </div>
  )
}
