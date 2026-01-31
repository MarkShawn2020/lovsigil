'use client'

import { useQueryClient } from '@tanstack/react-query'
import {
  Camera,
  CameraOff,
  Coins,
  Gamepad2,
  LogOut,
  Palette,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Video,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QRCode } from '@/components/ui/qr-code'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
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

import type { AspectRatio, SigilInput  } from './sigilTypes'
import { useSpiritHistory } from '@/hooks/useSpiritHistory'
import { spiritKeys } from '@/libs/queryKeys'
import { useAuth } from '@/providers/AuthProvider'
import { SigilInputDialog } from './SigilInputDialog'
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
  const [cameraEnabled, setCameraEnabled] = useState(true)

  const animationRef = useRef<number>(0)
  const dialogOpenRef = useRef(false)
  const cameraEnabledRef = useRef(true)
  const rebuildingMediaPipeRef = useRef(false)
  const segmenterRef = useRef<any>(null)
  const faceLandmarkerRef = useRef<any>(null)
  const webglRendererRef = useRef<WebGLRenderer | null>(null)

  // 简化状态：单个头像
  const [hasFaceDetected, setHasFaceDetected] = useState(false)
  const [capturedThumbnail, setCapturedThumbnail] = useState<string | null>(null)

  const queryClient = useQueryClient()

  // 历史记录 - 只显示生命图腾风格
  const { data: historyData } = useSpiritHistory()
  const historyRecords = (historyData?.records ?? []).filter(
    r => (r.vibeAnalysis as { style?: string } | null)?.style === 'totem'
  )

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

  // 移动端表单状态
  const [mobileName, setMobileName] = useState('')
  const [mobileBio, setMobileBio] = useState(urlBio)
  const [mobileSubmitting, setMobileSubmitting] = useState(false)

  const tSigil = useTranslations('Sigil')

  // 同步 dialog 状态
  useEffect(() => {
    dialogOpenRef.current = sigilDialog.open
  }, [sigilDialog.open])

  // 停止摄像头
  const stopCamera = useCallback(() => {
    if (persistentStream) {
      persistentStream.getTracks().forEach(track => track.stop())
      persistentStream = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (rawVideoRef.current) {
      rawVideoRef.current.srcObject = null
    }
  }, [])

  // 初始化摄像头
  // 注意：使用 cameraEnabledRef 而不是 cameraEnabled state，
  // 避免函数重建导致 useEffect cleanup 取消 renderLoop
  const initCamera = useCallback(async () => {
    if (!cameraEnabledRef.current) return

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
    // 摄像头关闭或正在重建 MediaPipe 时跳过处理
    if (!cameraEnabledRef.current || rebuildingMediaPipeRef.current) {
      animationRef.current = requestAnimationFrame(renderLoop)
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const segmenter = segmenterRef.current
    const faceLandmarker = faceLandmarkerRef.current
    const webglRenderer = webglRendererRef.current

    if (!video || !canvas || !segmenter || !faceLandmarker || video.readyState < 2) {
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

    const photoData = canvas.toDataURL('image/png')
    setCapturedThumbnail(photoData)
    // 直接打开 dialog
    setSigilDialog({ open: true, capturedPhoto: photoData, defaultRatio: urlRatio, defaultBio: urlBio })
  }, [urlRatio, urlBio])

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

  // 切换摄像头开关
  const toggleCamera = useCallback(async () => {
    if (cameraEnabled) {
      stopCamera()
      setCameraEnabled(false)
      cameraEnabledRef.current = false
      setHasFaceDetected(false)
    } else {
      // 设置重建标志，阻止 renderLoop 使用旧实例
      rebuildingMediaPipeRef.current = true

      // 清除旧的 refs，防止 renderLoop 使用已关闭的实例
      segmenterRef.current = null
      faceLandmarkerRef.current = null

      // 更新状态
      setCameraEnabled(true)
      cameraEnabledRef.current = true

      // 重新创建 MediaPipe 实例
      try {
        const { ImageSegmenter, FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm',
        )

        // 关闭旧实例
        if (persistentSegmenter) {
          persistentSegmenter.close()
          persistentSegmenter = null
        }
        if (persistentFaceLandmarker) {
          persistentFaceLandmarker.close()
          persistentFaceLandmarker = null
        }

        // 创建新实例
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
      } catch (err) {
        console.error('Failed to reinitialize MediaPipe:', err)
      } finally {
        // 无论成功或失败，都清除重建标志
        rebuildingMediaPipeRef.current = false
      }

      // 重新初始化摄像头
      await initCamera()
    }
  }, [cameraEnabled, stopCamera, initCamera])

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

  // 移动端直接提交
  const handleMobileSubmit = useCallback(async () => {
    if (!mobileName.trim() || mobileSubmitting) return

    setMobileSubmitting(true)
    const creditResult = await spendCredits(2, `Sigil generation: ${mobileName}`)
    if (!creditResult.success) {
      alert(creditResult.error || 'Failed to spend credits')
      setMobileSubmitting(false)
      return
    }

    try {
      const orderRes = await fetch('/api/sigil/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mobileName.trim(),
          bio: mobileBio.trim(),
          userPhoto: null,
          aspectRatio: '1:1' as AspectRatio,
        }),
      })

      if (!orderRes.ok) throw new Error('Failed to create order')
      const orderData = await orderRes.json()

      // 先触发生成（不等待完成），再跳转，避免页面卸载取消请求
      fetch('/api/generate-sigil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mobileName.trim(),
          bio: mobileBio.trim(),
          userPhoto: null,
          orderId: orderData.orderId,
          aspectRatio: '1:1',
          style: 'totem',
        }),
      }).catch(console.error)

      window.location.href = `/sigil/${orderData.orderId}`

      setMobileName('')
      setMobileBio('')
    } catch (err) {
      console.error('Create order error:', err)
      alert(err instanceof Error ? err.message : 'Failed to create order')
    } finally {
      setMobileSubmitting(false)
    }
  }, [mobileName, mobileBio, mobileSubmitting, spendCredits])

  // 初始化
  useEffect(() => {
    setMounted(true)
  }, [])

  // 首次初始化标记
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!mounted || initializedRef.current) return
    initializedRef.current = true

    // 移动端默认不开启相机（性能和体验优化）
    const isMobileDevice = window.innerWidth < 768
    if (isMobileDevice) {
      setCameraEnabled(false)
      cameraEnabledRef.current = false
    } else {
      initCamera()
    }

    initMediaPipe()
    initWebGL()
    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [mounted, initCamera, initMediaPipe, initWebGL])

  // 当开启摄像头时重新初始化
  useEffect(() => {
    if (mounted && cameraEnabled) {
      initCamera()
    }
  }, [mounted, cameraEnabled, initCamera])

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

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col overflow-hidden">
      {/* 隐藏的视频元素 */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* 顶部历史记录 - 仅桌面端 */}
      <div className={`shrink-0 border-b-2 border-gold/60 bg-elevated ${isMobile ? 'hidden' : ''}`}>
        <div className="h-32 px-4 flex items-center gap-4">
          {/* Logo + 标题 */}
          <div className="shrink-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/30 border border-gold/50 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-gold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-widest text-gold">{t('title')}</h1>
                <Badge variant="outline" className="text-[10px] text-gold/70 border-gold/50">v{version}</Badge>
              </div>
              <p className="text-light text-xs">{t('subtitle')}</p>
            </div>
          </div>

          {/* 分割线 */}
          {historyRecords.length > 0 && <div className="w-px h-16 bg-gold/60" />}

          {/* 历史记录滚动 */}
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
                      className="w-24 h-24 object-cover rounded-lg border border-muted group-hover/item:border-primary/50 transition-colors"
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
        /* 移动端布局 - Mystic Rune 风格 */
        <div className="flex-1 flex flex-col min-h-0 bg-deep">
          {/* 顶部导航栏 */}
          <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-gold/30">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gold/20 border border-gold/40 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-gold" />
              </div>
              <span className="text-base font-semibold text-gold tracking-wide">LovSigil</span>
            </div>
            <div className="flex items-center gap-1">
              <LocaleSwitcher className="text-light/60" />
              <Link href="/gallery" className="p-2 rounded-lg text-light/60 hover:text-gold">
                <Palette className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* 主内容区 */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-6 space-y-6">
              {/* 标题区 - 神秘风格 */}
              <div className="text-center space-y-3 py-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gold/10 border-2 border-gold/40 flex items-center justify-center sigil-glow">
                  <Sparkles className="w-8 h-8 text-gold" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gold tracking-wider">{t('title')}</h1>
                  <p className="text-light/60 text-sm mt-1">{t('subtitle')}</p>
                </div>
              </div>

              {/* 表单卡片 */}
              <div className="p-5 rounded-2xl bg-surface border border-gold/20 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-light/80">
                    {tSigil('your_name')} <span className="text-copper">*</span>
                  </label>
                  <Input
                    value={mobileName}
                    onChange={(e) => setMobileName(e.target.value)}
                    placeholder={tSigil('name_placeholder')}
                    maxLength={50}
                    className="h-12 bg-elevated border-subtle focus:border-gold/50 text-light placeholder:text-faded"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-light/80">
                    {tSigil('your_bio')}
                  </label>
                  <Input
                    value={mobileBio}
                    onChange={(e) => setMobileBio(e.target.value)}
                    placeholder={tSigil('bio_placeholder')}
                    maxLength={200}
                    className="h-12 bg-elevated border-subtle focus:border-gold/50 text-light placeholder:text-faded"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 底部操作区 */}
          <div className="shrink-0 px-5 py-4 border-t border-gold/30 bg-surface/80 backdrop-blur-sm">
            {authLoading ? (
              <div className="flex justify-center py-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              </div>
            ) : !user ? (
              <Button onClick={() => signInWithGoogle()} className="w-full h-12 bg-elevated border-gold/30 text-light hover:bg-hover" variant="outline">
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {tSigil('sign_in_to_generate')}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold text-sm font-medium overflow-hidden">
                      {user.profile?.avatarUrl ? (
                        <img src={user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.profile?.displayName?.[0] || user.email?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <span className="text-sm text-light/60">{user.profile?.displayName || user.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/30">
                    <Coins className="w-4 h-4 text-gold" />
                    <span className="text-gold font-semibold">{credits}</span>
                    <span className="text-xs text-light/40">(-2)</span>
                  </div>
                </div>
                <Button
                  onClick={handleMobileSubmit}
                  disabled={!mobileName.trim() || credits < 2 || mobileSubmitting}
                  className="w-full h-12 text-base font-semibold gradient-gold-copper text-deep disabled:opacity-50 sigil-glow"
                >
                  {mobileSubmitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-deep border-t-transparent mr-2" />
                  ) : (
                    <Sparkles className="w-5 h-5 mr-2" />
                  )}
                  {!mobileName.trim()
                    ? tSigil('enter_name')
                    : credits < 2
                      ? tSigil('insufficient_credits')
                      : tSigil('generate_sigil')}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 桌面端布局：居中镜子 + 右侧边栏 */
        <div className="flex-1 min-h-0 flex relative">
          {/* 主内容区 */}
          <div className="flex-1 flex flex-col items-center justify-center">
          {/* 镜子区域 - 居中显示 */}
          <div className="relative w-full max-w-4xl aspect-video mx-auto">
            {/* 始终渲染 video/canvas，用 CSS 控制显隐，保持 refs 有效 */}
            <video
              ref={rawVideoRef}
              className={`absolute inset-0 h-full w-full object-cover rounded-2xl ${cameraEnabled && showRawVideoInput ? '' : 'hidden'}`}
              style={{ transform: 'scaleX(-1)' }}
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 h-full w-full object-cover rounded-2xl ${cameraEnabled && !showRawVideoInput ? '' : 'hidden'}`}
            />
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 h-full w-full object-cover pointer-events-none rounded-2xl ${cameraEnabled && !showRawVideoInput ? '' : 'hidden'}`}
            />
            {/* 加载中 */}
            {cameraEnabled && isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface rounded-2xl">
                <div className="w-16 h-16 rounded-xl border-2 border-primary/40 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-8 h-8 text-primary/60" />
                </div>
              </div>
            )}
            {/* 摄像头关闭时的占位 */}
            {!cameraEnabled && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface rounded-2xl border border-primary/20">
                <CameraOff className="w-16 h-16 text-primary/40 mb-4" />
                <p className="text-muted-foreground">{t('camera_off') || '摄像头已关闭'}</p>
              </div>
            )}

            {/* 镜子内悬浮控制按钮 */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={toggleCamera}
                      className={`p-2.5 rounded-xl backdrop-blur-sm transition-colors border ${
                        cameraEnabled
                          ? 'bg-black/50 hover:bg-black/70 border-white/20 text-white/70 hover:text-white'
                          : 'bg-primary/20 hover:bg-primary/30 border-primary/40 text-primary'
                      }`}
                    >
                      {cameraEnabled ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {cameraEnabled ? (t('turn_off_camera') || '关闭摄像头') : (t('turn_on_camera') || '开启摄像头')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {cameraEnabled && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setShowRawVideoInput(!showRawVideoInput)}
                        className="p-2.5 bg-black/50 backdrop-blur-sm rounded-xl text-white/70 hover:text-white hover:bg-black/70 transition-colors border border-white/20"
                      >
                        {showRawVideoInput ? <Sparkles className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {showRawVideoInput ? t('ai_effect') : t('raw_input')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* 底部控制面板 */}
          <div className="mt-6 flex items-stretch gap-4">
            {/* 已拍照：显示头像 + 生成按钮 */}
            {capturedThumbnail ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-elevated rounded-2xl border-2 border-gold">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gold">
                  <img src={capturedThumbnail} alt="" className="w-full h-full object-cover" />
                </div>
                <Button
                  onClick={handleOpenSigilDialog}
                  className="gradient-gold-copper hover:brightness-110"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  {t('generate_portrait')}
                </Button>
                <Button
                  onClick={handleClearPhoto}
                  variant="ghost"
                  size="icon"
                  className="text-muted hover:text-light"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              /* 未拍照：拍照按钮 + 无头像生成 */
              <div className="flex items-center gap-3 px-4 py-3 bg-elevated rounded-2xl border-2 border-gold">
                {cameraEnabled ? (
                  <>
                    <Button
                      onClick={handleCapturePhoto}
                      disabled={!hasFaceDetected}
                      className={hasFaceDetected
                        ? 'gradient-gold-copper hover:brightness-110'
                        : 'bg-outline border-2 border-light/20 cursor-not-allowed text-light/50'
                      }
                    >
                      <Camera className="w-4 h-4 mr-1.5" />
                      {t('capture_photo') || '拍照'}
                    </Button>
                    {!hasFaceDetected && (
                      <span className="text-muted text-sm">{t('step_closer')}</span>
                    )}
                  </>
                ) : null}
                <Button
                  onClick={handleOpenSigilDialogWithoutPhoto}
                  className="bg-hover border-2 border-gold text-gold hover:bg-gold/20"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  {t('generate_without_photo')}
                </Button>
              </div>
            )}

            {/* 用户信息 */}
            <div className="px-3 py-2 bg-elevated rounded-xl border-2 border-gold">
              {authLoading ? (
                <div className="h-8 w-8 flex items-center justify-center">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent" />
                </div>
              ) : user ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-medium shrink-0 overflow-hidden">
                    {user.profile?.avatarUrl ? (
                      <img src={user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.profile?.displayName?.[0] || user.email?.[0]?.toUpperCase() || '?'
                    )}
                  </div>
                  <Link href="/credits" className="text-xs text-muted flex items-center gap-1 hover:text-gold">
                    <Coins className="w-3 h-3 text-gold" />
                    <span className="text-gold font-medium">{credits}</span>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => signOut()} className="h-8 w-8 text-light/70 hover:text-light">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button onClick={() => signInWithGoogle()} variant="ghost" size="sm" className="text-muted hover:text-light">
                  <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {t('sign_in')}
                </Button>
              )}
            </div>

            {/* 工具栏 */}
            <div className="flex items-center gap-1 px-2 py-1 bg-elevated rounded-xl border-2 border-gold">
              <Link
                href="/game"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gold/20 text-gold transition-colors"
                title="游戏模式"
              >
                <Gamepad2 className="w-4 h-4" />
              </Link>
              <Link
                href="/gallery"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gold/20 text-gold transition-colors"
              >
                <Palette className="w-4 h-4" />
              </Link>
              <LocaleSwitcher className="text-muted [&>button]:w-8 [&>button]:h-8 [&>button]:p-0 [&>button]:justify-center" />
            </div>
          </div>
          </div>

          {/* 右侧边栏 - 二维码 */}
          <div className="w-48 shrink-0 flex flex-col items-center justify-center px-4 border-l border-gold/30">
            <div className="bg-card rounded-xl p-4 border border-gold/30 shadow-lg">
              <QRCode
                size={140}
                bgColor="#FFFFFF"
                fgColor="#121214"
                includeMargin={false}
              />
              <p className="text-xs text-muted-foreground text-center mt-3">
                {t('scan_qr') || '手机扫码访问'}
              </p>
            </div>
          </div>
        </div>
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
                  className="gradient-gold-copper text-white font-medium hover:brightness-110"
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
