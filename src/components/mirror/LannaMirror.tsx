'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

// 兰纳主色调
const LANNA_PRIMARY = [204, 120, 92] // 陶土色 #CC785C
const LANNA_GOLD = [212, 175, 55] // 金色

type MirrorState = 'attract' | 'interact' | 'generate' | 'result'

export function LannaMirror() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<MirrorState>('attract')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const animationRef = useRef<number>(0)
  const segmenterRef = useRef<any>(null)

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

          const r = data[srcPixel]
          const g = data[srcPixel + 1]
          const b = data[srcPixel + 2]

          if (mask[srcIndex] > 0) {
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

      // 第二遍：检测边缘并添加金色发光
      const edgeGlow = 3 // 发光半径
      for (let y = edgeGlow; y < height - edgeGlow; y++) {
        for (let x = edgeGlow; x < width - edgeGlow; x++) {
          const srcIndex = y * width + x
          if (mask[srcIndex] === 0)
            continue

          // 检查是否是边缘（相邻有背景像素）
          let isEdge = false
          for (let dy = -1; dy <= 1 && !isEdge; dy++) {
            for (let dx = -1; dx <= 1 && !isEdge; dx++) {
              if (dx === 0 && dy === 0)
                continue
              const neighborIndex = (y + dy) * width + (x + dx)
              if (mask[neighborIndex] === 0) {
                isEdge = true
              }
            }
          }

          if (isEdge) {
            // 在镜像后的位置添加金色发光
            const mirrorX = width - 1 - x
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
                const intensity = (1 - dist / edgeGlow) * 0.6

                output[glowIndex] = Math.min(255, output[glowIndex] + LANNA_GOLD[0] * intensity)
                output[glowIndex + 1] = Math.min(255, output[glowIndex + 1] + LANNA_GOLD[1] * intensity)
                output[glowIndex + 2] = Math.min(255, output[glowIndex + 2] + LANNA_GOLD[2] * intensity * 0.3)
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

  // 拍照进入交互模式
  const captureAndInteract = useCallback(() => {
    setState('interact')
    cancelAnimationFrame(animationRef.current)
  }, [])

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
        onClick={captureAndInteract}
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

      {/* 交互模式 - 问答 */}
      {state === 'interact' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="bg-card p-8 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-center mb-6" style={{ color: '#CC785C' }}>
              回答几个问题，找到你的守护灵
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              （问答功能开发中...）
            </p>
            <Button
              onClick={() => setState('attract')}
              variant="outline"
              className="w-full"
            >
              返回镜子
            </Button>
          </div>
        </div>
      )}

      {/* 标题 */}
      <div className="absolute top-8 left-0 right-0 text-center">
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
