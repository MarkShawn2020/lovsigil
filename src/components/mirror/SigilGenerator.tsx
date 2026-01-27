'use client'

import {
  Camera,
  Coins,
  Download,
  LogOut,
  Palette,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Video,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useIsMobile } from '@/hooks/use-mobile'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { version } from '../../../package.json'

// 过滤 MediaPipe 的 INFO 日志
if (typeof window !== 'undefined') {
  const originalError = console.error
  console.error = (...args: unknown[]) => {
    const msg = args[0]
    if (typeof msg === 'string' && msg.includes('Created TensorFlow Lite XNNPACK delegate')) {
      return
    }
    originalError.apply(console, args)
  }
}

import type { SigilInput } from './sigilTypes'
import { useSpiritHistory } from '@/hooks/useSpiritHistory'
import { spiritKeys } from '@/libs/queryKeys'
import { useAuth } from '@/providers/AuthProvider'
import { downloadImage } from './posterGenerator'
import { SigilInputDialog } from './SigilInputDialog'
import type { AspectRatio } from './sigilTypes'
import { WebGLRenderer } from './webglRenderer'

// Sigil 默认发光颜色（深金色）
const DEFAULT_GLOW_COLOR: [number, number, number] = [0.79, 0.64, 0.15]

// 模块级变量：跨组件重新挂载保持状态
let persistentStream: MediaStream | null = null
let persistentSegmenter: any = null
let persistentFaceLandmarker: any = null
let persistentWebGLRenderer: WebGLRenderer | null = null

export function SigilGenerator() {
  const t = useTranslations('SigilGenerator')
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()

  const urlBio = searchParams.get('bio') || ''
  const urlRatio = (searchParams.get('ratio') as AspectRatio) || undefined
  const { user, isAdmin, credits, loading: authLoading, signInWithGoogle, signOut, spendCredits } = useAuth()

  const videoRef = useRef<HTMLVideoElement>(null)
  const rawVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRawVideoInput, setShowRawVideoInput] = useState(false)

  const animationRef = useRef<number>(0)
  const dialogOpenRef = useRef(false)
  const segmenterRef = useRef<any>(null)
  const faceLandmarkerRef = useRef<any>(null)
  const webglRendererRef = useRef<WebGLRenderer | null>(null)

  // 简化状态：单个头像
  const [hasFaceDetected, setHasFaceDetected] = useState(false)
  const [capturedThumbnail, setCapturedThumbnail] = useState<string | null>(null)

  const queryClient = useQueryClient()

  // 历史记录
  const { data: historyData } = useSpiritHistory()
  const historyRecords = historyData?.records ?? []

  // Visitor ID for voting
  const getVisitorId = useCallback(() => {
    if (typeof window === 'undefined') return ''
    let id = localStorage.getItem('lanna-visitor-id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('lanna-visitor-id', id)
    }
    return id
  }, [])

  const [previewRecord, setPreviewRecord] = useState<{
    id: number
    generatedImage: string
    userPhoto: string | null
    name: string
    bio?: string | null
    userId: string | null
    orderId?: string | null
    ratio?: string
    votes?: number
    userVote?: number | null
  } | null>(null)

  // Fetch user's vote status
  useEffect(() => {
    if (!previewRecord || previewRecord.id <= 0) return
    const visitorId = getVisitorId()
    if (!visitorId) return

    fetch(`/api/spirit-vote?id=${previewRecord.id}&visitorId=${visitorId}`)
      .then(res => res.json())
      .then(data => {
        setPreviewRecord(prev => prev?.id === previewRecord.id ? { ...prev, userVote: data.userVote } : prev)
      })
      .catch(console.error)
  }, [previewRecord?.id, getVisitorId])

  // Vote handler
  const handleVote = useCallback((vote: 'like' | 'dislike') => {
    const id = previewRecord?.id
    if (!id) return

    setPreviewRecord(prev => {
      if (!prev) return prev
      const voteValue = vote === 'like' ? 1 : -1
      let newVotes = prev.votes ?? 0
      let newUserVote: number | null = voteValue

      if (prev.userVote === voteValue) {
        newVotes -= voteValue
        newUserVote = null
      } else if (prev.userVote !== null) {
        newVotes += voteValue * 2
      } else {
        newVotes += voteValue
      }
      return { ...prev, votes: newVotes, userVote: newUserVote }
    })

    const visitorId = getVisitorId()
    fetch('/api/spirit-vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, vote, visitorId }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: spiritKeys.history() })
    }).catch(console.error)
  }, [getVisitorId, previewRecord?.id, queryClient])

  // Sigil 对话框状态
  const [sigilDialog, setSigilDialog] = useState<{
    open: boolean
    capturedPhoto?: string
    defaultRatio?: AspectRatio
    defaultBio?: string
  }>({ open: false })

  // 同步 dialog 状态
  useEffect(() => {
    dialogOpenRef.current = sigilDialog.open
  }, [sigilDialog.open])

  // 初始化摄像头
  const initCamera = useCallback(async () => {
    try {
      let stream = persistentStream
      if (!stream || !stream.active) {
        const videoConstraints = isMobile
          ? { width: 640, height: 480, facingMode: 'user' }
          : { width: 1280, height: 720, facingMode: 'user' }
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        })
        persistentStream = stream
      }

      if (videoRef.current && videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch((e) => {
          if (e.name !== 'AbortError') console.error('Video play error:', e)
        })
      }
      if (rawVideoRef.current && rawVideoRef.current.srcObject !== stream) {
        rawVideoRef.current.srcObject = stream
        rawVideoRef.current.play().catch((e) => {
          if (e.name !== 'AbortError') console.error('Raw video play error:', e)
        })
      }
    }
    catch (err) {
      setError(t('camera_error'))
      console.error('Camera error:', err)
    }
  }, [isMobile, t])

  // 初始化 WebGL
  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (persistentWebGLRenderer) {
      webglRendererRef.current = persistentWebGLRenderer
      return
    }

    try {
      const renderer = new WebGLRenderer({ canvas })
      webglRendererRef.current = renderer
      persistentWebGLRenderer = renderer
    } catch (err) {
      console.error('WebGL init error:', err)
    }
  }, [])

  // 初始化 MediaPipe
  const initMediaPipe = useCallback(async () => {
    try {
      if (persistentSegmenter && persistentFaceLandmarker) {
        segmenterRef.current = persistentSegmenter
        faceLandmarkerRef.current = persistentFaceLandmarker
        setIsLoading(false)
        return
      }

      const { ImageSegmenter, FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm',
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
      persistentSegmenter = segmenter

      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
      faceLandmarkerRef.current = faceLandmarker
      persistentFaceLandmarker = faceLandmarker

      setIsLoading(false)
    }
    catch (err) {
      setError(t('ai_load_error'))
      console.error('MediaPipe error:', err)
    }
  }, [t])

  // 渲染循环 - 简化版
  const renderLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const segmenter = segmenterRef.current
    const faceLandmarker = faceLandmarkerRef.current
    const webglRenderer = webglRendererRef.current

    if (!video || !canvas || !segmenter || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(renderLoop)
      return
    }

    if (dialogOpenRef.current) {
      animationRef.current = requestAnimationFrame(renderLoop)
      return
    }

    const width = video.videoWidth
    const height = video.videoHeight
    const now = performance.now()

    // 检测人脸（只检测是否存在）
    if (faceLandmarker) {
      const faceResult = faceLandmarker.detectForVideo(video, now)
      const hasAnyFace = (faceResult.faceLandmarks?.length || 0) > 0
      setHasFaceDetected(prev => prev !== hasAnyFace ? hasAnyFace : prev)
    }

    // 执行分割
    const result = segmenter.segmentForVideo(video, now)

    if (result.categoryMask) {
      const mask = result.categoryMask.getAsUint8Array()
      const glowColor: [number, number, number] = DEFAULT_GLOW_COLOR

      if (webglRenderer) {
        webglRenderer.render(video, mask, width, height, glowColor, 3.0)

        // 绘制边框和轮廓
        const overlayCanvas = overlayCanvasRef.current
        if (overlayCanvas) {
          if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
            overlayCanvas.width = width
            overlayCanvas.height = height
          }
          const overlayCtx = overlayCanvas.getContext('2d')
          if (overlayCtx) {
            overlayCtx.clearRect(0, 0, width, height)
            webglRenderer.drawBorder(overlayCtx, width, height, '#CC785C')

            // 简化的轮廓绘制
            const edgeData = overlayCtx.createImageData(width, height)
            const edgePixels = edgeData.data
            const lineWidth = 3

            for (let y = lineWidth; y < height - lineWidth; y++) {
              for (let x = lineWidth; x < width - lineWidth; x++) {
                const idx = y * width + x
                if (mask[idx]! > 0) {
                  let isEdge = false
                  for (let dy = -lineWidth; dy <= lineWidth && !isEdge; dy++) {
                    for (let dx = -lineWidth; dx <= lineWidth && !isEdge; dx++) {
                      if (mask[(y + dy) * width + (x + dx)] === 0) {
                        isEdge = true
                      }
                    }
                  }
                  if (isEdge) {
                    const mirrorX = width - 1 - x
                    const pixelIdx = (y * width + mirrorX) * 4
                    edgePixels[pixelIdx] = 204
                    edgePixels[pixelIdx + 1] = 120
                    edgePixels[pixelIdx + 2] = 92
                    edgePixels[pixelIdx + 3] = 255
                  }
                }
              }
            }
            overlayCtx.putImageData(edgeData, 0, 0)
          }
        }
      }
      result.categoryMask.close()
    }

    result.close()
    animationRef.current = requestAnimationFrame(renderLoop)
  }, [])

  // 拍照捕获头像
  const handleCapturePhoto = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return

    const canvas = document.createElement('canvas')
    const size = 200
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 从视频中心裁剪正方形
    const vw = video.videoWidth
    const vh = video.videoHeight
    const cropSize = Math.min(vw, vh)
    const sx = (vw - cropSize) / 2
    const sy = (vh - cropSize) / 2

    // 镜像绘制
    ctx.translate(size, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, size, size)

    setCapturedThumbnail(canvas.toDataURL('image/png'))
  }, [])

  // 清除已拍照
  const handleClearPhoto = useCallback(() => {
    setCapturedThumbnail(null)
  }, [])

  // 打开 Sigil 对话框（带头像）
  const handleOpenSigilDialog = useCallback(() => {
    setSigilDialog({ open: true, capturedPhoto: capturedThumbnail || undefined, defaultRatio: urlRatio, defaultBio: urlBio })
  }, [capturedThumbnail, urlRatio, urlBio])

  // 打开 Sigil 对话框（无头像）
  const handleOpenSigilDialogWithoutPhoto = useCallback(() => {
    setSigilDialog({ open: true, capturedPhoto: undefined, defaultRatio: urlRatio, defaultBio: urlBio })
  }, [urlRatio, urlBio])

  // 确认生成
  const handleConfirmSigil = useCallback(async (input: SigilInput) => {
    setSigilDialog({ open: false })
    const photo = sigilDialog.capturedPhoto || null

    const creditResult = await spendCredits(2, `Sigil generation: ${input.name}`)
    if (!creditResult.success) {
      alert(creditResult.error || 'Failed to spend credits')
      return
    }

    try {
      const orderRes = await fetch('/api/sigil/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.name,
          bio: input.bio,
          userPhoto: photo,
          aspectRatio: input.aspectRatio,
        }),
      })

      if (!orderRes.ok) throw new Error('Failed to create order')
      const orderData = await orderRes.json()

      window.open(`/sigil/${orderData.orderId}`, '_blank')

      fetch('/api/generate-sigil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.name,
          bio: input.bio,
          userPhoto: photo,
          orderId: orderData.orderId,
          aspectRatio: input.aspectRatio,
          style: input.style,
        }),
      }).catch(console.error)
    } catch (err) {
      console.error('Create order error:', err)
      alert(err instanceof Error ? err.message : 'Failed to create order')
    }
  }, [sigilDialog.capturedPhoto, spendCredits])

  // 初始化
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    initCamera()
    initMediaPipe()
    initWebGL()
    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [mounted, initCamera, initMediaPipe, initWebGL])

  useEffect(() => {
    if (!isLoading) {
      animationRef.current = requestAnimationFrame(renderLoop)
    }
    return () => cancelAnimationFrame(animationRef.current)
  }, [isLoading, renderLoop])

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive text-lg">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            {t('retry')}
          </Button>
        </div>
      </div>
    )
  }

  if (!mounted) {
    return <div className="h-screen w-screen bg-black" />
  }

  // 左侧面板内容
  const renderSidebarContent = () => (
    <>
      {/* 加载状态 */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-white">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-white/60">{t('loading_ai')}</p>
        </div>
      )}

      {/* 主内容 */}
      {!isLoading && (
        <div className="space-y-4">
          {/* 已拍照：显示头像预览 */}
          {capturedThumbnail ? (
            <div className="text-center space-y-3">
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#D4AF37] mx-auto">
                  <img src={capturedThumbnail} alt="" className="w-full h-full object-cover" />
                </div>
                <button
                  onClick={handleClearPhoto}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <Button
                onClick={handleOpenSigilDialog}
                className="w-full bg-gradient-to-r from-[#C9A227] to-[#00D4FF] hover:brightness-110"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                {t('generate_portrait')}
              </Button>
              <Button
                onClick={handleClearPhoto}
                variant="outline"
                size="sm"
                className="w-full border-white/20 text-white/60 hover:text-white hover:bg-white/10"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                {t('retake') || '重新拍照'}
              </Button>
            </div>
          ) : (
            /* 未拍照：显示拍照/无头像按钮 */
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full border-2 border-dashed border-[#D4AF37]/40 flex items-center justify-center">
                <Camera className="w-6 h-6 text-[#D4AF37]/60" />
              </div>

              {hasFaceDetected ? (
                <p className="text-white/60 text-sm">{t('face_detected') || '检测到人脸，点击拍照'}</p>
              ) : (
                <p className="text-white/40 text-sm">{t('step_closer')}</p>
              )}

              <div className="space-y-2">
                <Button
                  onClick={handleCapturePhoto}
                  disabled={!hasFaceDetected}
                  className={`w-full ${hasFaceDetected
                    ? 'bg-gradient-to-r from-[#C9A227] to-[#00D4FF] hover:brightness-110'
                    : 'bg-white/20 cursor-not-allowed'
                  }`}
                >
                  <Camera className="w-4 h-4 mr-1.5" />
                  {t('capture_photo') || '拍照'}
                </Button>
                <Button
                  onClick={handleOpenSigilDialogWithoutPhoto}
                  variant="outline"
                  className="w-full border-[#D4AF37]/40 text-[#D4AF37]/80 hover:bg-[#D4AF37]/10"
                >
                  {t('generate_without_photo')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )

  return (
    <div className="h-dvh w-screen overflow-hidden bg-black flex flex-col">
      {/* 隐藏的视频元素 */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* 顶部历史记录 */}
      <div className={`shrink-0 border-b border-[#D4AF37]/20 bg-black/95 ${isMobile ? 'hidden' : ''}`}>
        <div className="h-40 px-4 flex items-center">
          {historyRecords.length > 0 && (
            <div
              className="flex-1 h-full overflow-hidden relative group flex items-center"
              onMouseEnter={(e) => {
                const inner = e.currentTarget.querySelector('[data-marquee]') as HTMLElement
                if (inner) inner.style.animationPlayState = 'paused'
              }}
              onMouseLeave={(e) => {
                const inner = e.currentTarget.querySelector('[data-marquee]') as HTMLElement
                if (inner) inner.style.animationPlayState = 'running'
              }}
            >
              <div
                data-marquee
                className="flex gap-3 animate-marquee"
                style={{ animationDuration: `${Math.max(20, historyRecords.length * 3)}s` }}
              >
                {[...historyRecords, ...historyRecords].map((record, idx) => (
                  <div
                    key={`${record.id}-${idx}`}
                    className="relative group/item cursor-pointer shrink-0"
                    onClick={() => {
                      setPreviewRecord({
                        id: record.id,
                        generatedImage: record.generatedImage,
                        userPhoto: record.userPhoto,
                        name: record.name || 'Sigil',
                        bio: record.bio,
                        userId: record.userId,
                        orderId: record.orderId,
                        ratio: record.ratio,
                        votes: record.votes,
                        userVote: null,
                      })
                    }}
                  >
                    <img
                      src={record.generatedImage}
                      alt={record.name || 'Sigil'}
                      className="w-36 h-36 object-cover rounded-lg border border-white/10 group-hover/item:border-[#D4AF37]/50 transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 主体区域 */}
      {isMobile ? (
        /* 移动端布局 */
        <div className="flex-1 min-h-0 relative flex flex-col">
          <div className="flex-1 relative overflow-hidden">
            <video
              ref={rawVideoRef}
              className={`absolute inset-0 h-full w-full object-cover ${showRawVideoInput ? '' : 'hidden'}`}
              style={{ transform: 'scaleX(-1)' }}
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 h-full w-full object-cover ${showRawVideoInput ? 'hidden' : ''}`}
            />
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 h-full w-full object-cover pointer-events-none ${showRawVideoInput ? 'hidden' : ''}`}
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="w-16 h-16 rounded-xl border-2 border-[#D4AF37]/40 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-8 h-8 text-[#D4AF37]/60" />
                </div>
              </div>
            )}
            {/* 顶部状态栏 */}
            <div className="absolute top-0 left-0 right-0 safe-area-top">
              <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/70 via-black/40 to-transparent">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-[#CC785C]/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-[#CC785C]" />
                  </div>
                  <span className="text-sm font-semibold text-white/90">LovSigil</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <LocaleSwitcher className="text-white/80 scale-90" />
                  <Link
                    href="/gallery"
                    className="w-8 h-8 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] active:bg-[#D4AF37]/30"
                  >
                    <Palette className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* 移动端底部工具栏 */}
          <div className="shrink-0 bg-black/95 border-t border-[#D4AF37]/20 p-3 safe-area-bottom">
            {!isLoading && (
              <div className="flex items-center gap-3">
                {capturedThumbnail ? (
                  <>
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#D4AF37] shrink-0">
                      <img src={capturedThumbnail} alt="" className="w-full h-full object-cover" />
                    </div>
                    <Button
                      onClick={handleOpenSigilDialog}
                      className="flex-1 bg-gradient-to-r from-[#C9A227] to-[#00D4FF]"
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      Generate
                    </Button>
                    <Button onClick={handleClearPhoto} variant="ghost" size="icon" className="text-white/60">
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleCapturePhoto}
                      disabled={!hasFaceDetected}
                      className={`flex-1 ${hasFaceDetected ? 'bg-[#D4AF37]' : 'bg-white/20'}`}
                    >
                      <Camera className="w-4 h-4 mr-1" />
                      {t('capture_photo') || '拍照'}
                    </Button>
                    <Button
                      onClick={handleOpenSigilDialogWithoutPhoto}
                      variant="outline"
                      className="border-[#D4AF37]/40 text-[#D4AF37]"
                    >
                      {t('generate_without_photo')}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 桌面端布局 */
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0" autoSaveId="lanna-mirror-sidebar">
          <ResizablePanel
            defaultSize={20}
            minSize={5}
            maxSize={35}
            className="flex flex-col bg-black/95 overflow-y-auto"
            style={{ flexBasis: 320, minWidth: 120, maxWidth: 480 }}
          >
            {/* 标题 */}
            <div className="px-4 py-3 border-b border-[#D4AF37]/20">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-widest" style={{ color: '#CC785C' }}>
                  {t('title')}
                </h1>
                <Badge variant="outline" className="text-[10px] text-white/40 border-white/20">
                  v{version}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-white/50 text-sm">{t('subtitle')}</p>
                <div className="flex items-center gap-2">
                  <Link
                    href="/gallery"
                    className="p-1.5 rounded-md hover:bg-[#D4AF37]/20 text-[#D4AF37]"
                  >
                    <Palette className="w-4 h-4" />
                  </Link>
                  <LocaleSwitcher className="text-white" />
                </div>
              </div>
            </div>

            {/* 内容区 */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {renderSidebarContent()}
            </div>

            {/* 用户登录区域 */}
            <div className="p-3 border-t border-[#D4AF37]/20">
              {authLoading ? (
                <div className="flex items-center justify-center py-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
                </div>
              ) : user ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-medium shrink-0 overflow-hidden">
                    {user.profile?.avatarUrl ? (
                      <img src={user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.profile?.displayName?.[0] || user.email?.[0]?.toUpperCase() || '?'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm truncate">
                      {user.profile?.displayName || user.email?.split('@')[0]}
                    </p>
                    <div className="flex items-center gap-2">
                      {isAdmin && <span className="text-[10px] text-[#D4AF37]/80">Admin</span>}
                      <Link href="/credits" className="text-[10px] text-white/50 flex items-center gap-0.5 hover:text-[#D4AF37]">
                        <Coins className="w-3 h-3 text-[#D4AF37]" />
                        <span className="text-[#D4AF37]">{credits}</span>
                      </Link>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-white/40 hover:text-white/80 h-8 px-2">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button onClick={() => signInWithGoogle()} className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {t('sign_in')}
                </Button>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-[#D4AF37]/30 hover:bg-[#D4AF37]/50 transition-colors" />

          {/* 右侧镜子区域 */}
          <ResizablePanel defaultSize={80} className="relative min-w-0 overflow-hidden">
            <video
              ref={rawVideoRef}
              className={`absolute inset-0 h-full w-full object-cover ${showRawVideoInput ? '' : 'hidden'}`}
              style={{ transform: 'scaleX(-1)' }}
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 h-full w-full object-cover ${showRawVideoInput ? 'hidden' : ''}`}
            />
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 h-full w-full object-cover pointer-events-none ${showRawVideoInput ? 'hidden' : ''}`}
            />
            <button
              onClick={() => setShowRawVideoInput(!showRawVideoInput)}
              className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-lg text-white/70 hover:text-white hover:bg-black/70 transition-colors text-xs border border-white/20 flex items-center gap-1.5"
            >
              {showRawVideoInput ? (
                <>
                  <Palette className="w-3.5 h-3.5" />
                  {t('ai_effect')}
                </>
              ) : (
                <>
                  <Video className="w-3.5 h-3.5" />
                  {t('raw_input')}
                </>
              )}
            </button>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="w-16 h-16 rounded-xl border-2 border-[#D4AF37]/40 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-8 h-8 text-[#D4AF37]/60" />
                </div>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      {/* 大图预览浮层 */}
      {previewRecord && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewRecord(null)}
        >
          <div className="relative flex flex-col items-center gap-4">
            <img
              src={previewRecord.generatedImage}
              alt="Generated Sigil"
              className="max-h-[70vh] object-contain rounded-lg shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => handleVote('like')}
                className={`p-2 rounded-full transition-colors ${
                  previewRecord.userVote === 1 ? 'bg-green-500/50 text-green-300' : 'bg-white/10 hover:bg-green-500/30 text-white'
                }`}
              >
                <ThumbsUp className="w-5 h-5" />
              </button>
              <span className={`min-w-[3rem] text-center text-lg font-bold ${
                (previewRecord.votes ?? 0) > 0 ? 'text-green-400' : (previewRecord.votes ?? 0) < 0 ? 'text-red-400' : 'text-white/60'
              }`}>
                {(previewRecord.votes ?? 0) > 0 ? '+' : ''}{previewRecord.votes ?? 0}
              </span>
              <button
                onClick={() => handleVote('dislike')}
                className={`p-2 rounded-full transition-colors ${
                  previewRecord.userVote === -1 ? 'bg-red-500/50 text-red-300' : 'bg-white/10 hover:bg-red-500/30 text-white'
                }`}
              >
                <ThumbsDown className="w-5 h-5" />
              </button>
            </div>
            {previewRecord.generatedImage && (
              <div className="flex flex-wrap justify-center gap-3 p-3 bg-black/50 rounded-xl backdrop-blur-sm">
                <Button
                  onClick={() => {
                    const defaultRatio = previewRecord.ratio as AspectRatio | undefined
                    const defaultBio = previewRecord.bio || ''
                    setPreviewRecord(null)
                    setSigilDialog({ open: true, capturedPhoto: capturedThumbnail || undefined, defaultRatio, defaultBio })
                  }}
                  className="bg-gradient-to-r from-[#D4AF37] to-[#CC785C] text-white font-medium hover:brightness-110"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  {t('make_same')}
                </Button>
                {previewRecord.orderId && (
                  <Button
                    onClick={() => window.open(`/sigil/${previewRecord.orderId}`, '_blank')}
                    className="bg-white/20 text-white border border-white/30 hover:bg-white/30"
                  >
                    {t('view_detail')}
                  </Button>
                )}
              </div>
            )}
            <button
              className="absolute -top-2 -right-2 w-8 h-8 bg-black/60 rounded-full text-white/80 hover:text-white flex items-center justify-center"
              onClick={() => setPreviewRecord(null)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sigil 输入对话框 */}
      <SigilInputDialog
        open={sigilDialog.open}
        onOpenChange={(open) => setSigilDialog(prev => ({ ...prev, open }))}
        onConfirm={handleConfirmSigil}
        userPhoto={sigilDialog.capturedPhoto}
        defaultRatio={sigilDialog.defaultRatio}
        defaultBio={sigilDialog.defaultBio}
      />
    </div>
  )
}
