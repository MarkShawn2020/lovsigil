'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { getEnergyColor, labelConnectedComponents, matchSpirit, QUESTIONS } from './spiritData'
import type { LannaSpirit } from './types'

// 兰纳主色调
const LANNA_PRIMARY = [204, 120, 92] // 陶土色 #CC785C

type MirrorState = 'attract' | 'interact' | 'generate' | 'result'

export function LannaMirror() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<MirrorState>('attract')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const animationRef = useRef<number>(0)
  const segmenterRef = useRef<any>(null)

  // 问答相关状态
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
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

  // 初始化 MediaPipe Image Segmenter
  const initSegmenter = useCallback(async () => {
    try {
      const { ImageSegmenter, FilesetResolver } = await import('@mediapipe/tasks-vision')

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      )

      const segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        outputCategoryMask: true,
      })

      segmenterRef.current = segmenter
      setIsLoading(false)
    }
    catch (err) {
      setError('加载 AI 模型失败')
      console.error('Segmenter error:', err)
    }
  }, [])

  // 渲染循环 - 实时分割并染色
  const renderLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const segmenter = segmenterRef.current

    if (!video || !canvas || !segmenter || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(renderLoop)
      return
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx)
      return

    const width = video.videoWidth
    const height = video.videoHeight

    // 设置 canvas 尺寸（只设置一次）
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    // 先绘制原始视频（不镜像），用于分割
    ctx.drawImage(video, 0, 0, width, height)

    // 执行分割
    const result = segmenter.segmentForVideo(video, performance.now())

    if (result.categoryMask) {
      const mask = result.categoryMask.getAsUint8Array()
      const imageData = ctx.getImageData(0, 0, width, height)
      const data = imageData.data

      // 连通组件分析 - 识别不同的人
      const { labels, components } = labelConnectedComponents(mask, width, height)

      // 为每个组件计算能量颜色（加入时间脉动）
      const timestamp = performance.now()
      const componentColors = new Map<number, [number, number, number]>()
      for (const comp of components) {
        // 基于位置的基础能量 + 时间脉动
        const pulsePhase = (timestamp / 4000) * Math.PI * 2 // 4秒周期
        const pulse = Math.sin(pulsePhase + comp.id * 1.5) * 50 // 每个组件相位不同
        const energyLevel = Math.max(150, Math.min(650, comp.energyLevel + pulse))
        componentColors.set(comp.id, getEnergyColor(energyLevel))
      }

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

          const r = data[srcPixel] ?? 0
          const g = data[srcPixel + 1] ?? 0
          const b = data[srcPixel + 2] ?? 0

          if (labels[srcIndex] !== undefined && labels[srcIndex] >= 0) {
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

      // 第二遍：检测边缘并添加基于组件的能量发光
      const edgeGlow = 3
      for (let y = edgeGlow; y < height - edgeGlow; y++) {
        for (let x = edgeGlow; x < width - edgeGlow; x++) {
          const srcIndex = y * width + x
          const componentId = labels[srcIndex]
          if (componentId === undefined || componentId < 0)
            continue

          let isEdge = false
          for (let dy = -1; dy <= 1 && !isEdge; dy++) {
            for (let dx = -1; dx <= 1 && !isEdge; dx++) {
              if (dx === 0 && dy === 0)
                continue
              const neighborIndex = (y + dy) * width + (x + dx)
              const neighborLabel = labels[neighborIndex]
              // 边缘：邻居是背景或不同组件
              if (neighborLabel === undefined || neighborLabel < 0 || neighborLabel !== componentId) {
                isEdge = true
              }
            }
          }

          if (isEdge) {
            const mirrorX = width - 1 - x
            // 获取该组件的能量颜色
            const glowColor = componentColors.get(componentId) ?? [212, 175, 55]

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

                output[glowIndex] = Math.min(255, (output[glowIndex] ?? 0) + glowColor[0] * intensity)
                output[glowIndex + 1] = Math.min(255, (output[glowIndex + 1] ?? 0) + glowColor[1] * intensity)
                output[glowIndex + 2] = Math.min(255, (output[glowIndex + 2] ?? 0) + glowColor[2] * intensity)
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

  // 拍照并进入问答
  const captureAndInteract = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas)
      return

    // 保存当前画面
    const photo = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedPhoto(photo)

    // 重置问答状态
    setCurrentQuestionIndex(0)
    setAnswers({})
    setMatchedSpirit(null)

    setState('interact')
    cancelAnimationFrame(animationRef.current)
  }, [])

  // 回答问题
  const handleAnswer = useCallback((questionId: string, optionId: string) => {
    const newAnswers = { ...answers, [questionId]: optionId }
    setAnswers(newAnswers)

    if (currentQuestionIndex < QUESTIONS.length - 1) {
      // 下一题
      setCurrentQuestionIndex(prev => prev + 1)
    }
    else {
      // 问答完成，计算匹配结果
      const spirit = matchSpirit(newAnswers)
      setMatchedSpirit(spirit)
      setState('result')
    }
  }, [answers, currentQuestionIndex])

  // 重新开始
  const restart = useCallback(() => {
    setCapturedPhoto(null)
    setCurrentQuestionIndex(0)
    setAnswers({})
    setMatchedSpirit(null)
    setGeneratedImage(null)
    setGenerateError(null)
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
    initSegmenter()

    return () => {
      cancelAnimationFrame(animationRef.current)
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach(track => track.stop())
      }
    }
  }, [initCamera, initSegmenter])

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

  const currentQuestion = QUESTIONS[currentQuestionIndex]

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
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
        className="h-full w-full object-contain"
        onClick={state === 'attract' ? captureAndInteract : undefined}
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

      {/* 吸引模式 - 提示文字 */}
      {state === 'attract' && !isLoading && (
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-white text-2xl font-light tracking-wider animate-pulse">
            点击屏幕，发现你的兰纳守护灵
          </p>
        </div>
      )}

      {/* 问答模式 */}
      {state === 'interact' && currentQuestion && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="bg-card/95 backdrop-blur p-8 rounded-2xl max-w-lg w-full mx-4 shadow-2xl">
            {/* 进度指示 */}
            <div className="flex justify-center gap-2 mb-6">
              {QUESTIONS.map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    i < currentQuestionIndex
                      ? 'bg-[#CC785C]'
                      : i === currentQuestionIndex
                        ? 'bg-[#D4AF37]'
                        : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {/* 问题 */}
            <h2
              className="text-2xl font-bold text-center mb-8"
              style={{ color: '#CC785C' }}
            >
              {currentQuestion.text}
            </h2>

            {/* 选项 */}
            <div className="space-y-3">
              {currentQuestion.options.map(option => (
                <button
                  key={option.id}
                  onClick={() => handleAnswer(currentQuestion.id, option.id)}
                  className="w-full p-4 text-left rounded-xl border-2 border-[#CC785C]/30 hover:border-[#CC785C] hover:bg-[#CC785C]/10 transition-all duration-200 text-lg"
                >
                  {option.text}
                </button>
              ))}
            </div>

            {/* 返回按钮 */}
            <Button
              onClick={restart}
              variant="ghost"
              className="w-full mt-6 text-muted-foreground"
            >
              返回镜子
            </Button>
          </div>
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

      {/* 标题 */}
      <div className="absolute top-8 left-0 right-0 text-center pointer-events-none">
        <h1
          className="text-4xl font-bold tracking-widest"
          style={{ color: '#CC785C', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
        >
          兰纳照妖镜
        </h1>
        <p className="text-white/60 mt-2 text-sm">Lanna Spirit Mirror</p>
      </div>
    </div>
  )
}
