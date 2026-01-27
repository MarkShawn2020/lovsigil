'use client'

import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import {
  Coins,
  Download,
  LogOut,
  Palette,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Video,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import type { TrackedPerson } from './personTracker'
import type { SigilInput } from './sigilTypes'
import { useSpiritHistory } from '@/hooks/useSpiritHistory'
import { spiritKeys } from '@/libs/queryKeys'
import { useAuth } from '@/providers/AuthProvider'
import { PersonTracker } from './personTracker'
import { downloadImage } from './posterGenerator'
import { SigilInputDialog } from './SigilInputDialog'
import type { AspectRatio } from './sigilTypes'
import { hexToNormalizedRgb, WebGLRenderer } from './webglRenderer'

// Sigil 默认发光颜色（深金色）
const DEFAULT_GLOW_COLOR: [number, number, number] = [0.79, 0.64, 0.15] // #C9A227

type MirrorState = 'attract' | 'generate' | 'result'

// 模块级变量：跨组件重新挂载保持状态（语言切换时不重新初始化）
let persistentStream: MediaStream | null = null
let persistentSegmenter: any = null
let persistentFaceLandmarker: any = null
let persistentPoseLandmarker: any = null
let persistentWebGLRenderer: WebGLRenderer | null = null

export function LannaMirror() {
  const t = useTranslations('LannaMirror')
  const isMobile = useIsMobile()
  const { user, isAdmin, credits, loading: authLoading, signInWithGoogle, signOut, spendCredits } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const rawVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<MirrorState>('attract')
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const animationRef = useRef<number>(0)
  const segmenterRef = useRef<any>(null)
  const faceLandmarkerRef = useRef<any>(null)
  const poseLandmarkerRef = useRef<any>(null)
  const webglRendererRef = useRef<WebGLRenderer | null>(null)
  const personTrackerRef = useRef<PersonTracker>(new PersonTracker())

  // 多人追踪状态
  const [trackedPersons, setTrackedPersons] = useState<TrackedPerson[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const lastTrackedUpdateRef = useRef<number>(0)
  // 头部抠像缩略图 (personId -> dataURL)
  const [headThumbnails, setHeadThumbnails] = useState<Record<string, string>>({})
  const lastThumbnailUpdateRef = useRef<number>(0)
  const thumbnailCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // 匹配相关状态
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)

  // 生成相关状态
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // 历史记录 - 使用 react-query
  const {
    data: historyData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSpiritHistory()
  const historyRecords = historyData?.records ?? []
  const hasMoreHistory = hasNextPage ?? false
  const isLoadingMoreHistory = isFetchingNextPage

  const queryClient = useQueryClient()

  // Get or create visitor ID for voting
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
    userId: string | null
    orderId?: string | null
    ratio?: string
    votes?: number
    userVote?: number | null // 1 = liked, -1 = disliked, null = no vote
  } | null>(null)
  const [showRawVideoInput, setShowRawVideoInput] = useState(false)

  // Fetch user's vote status when preview record changes
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

  // Vote handler with instant optimistic update
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

    // Fire and forget API call
    const visitorId = getVisitorId()
    fetch('/api/spirit-vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, vote, visitorId }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: spiritKeys.history() })
    }).catch(console.error)
  }, [getVisitorId, previewRecord?.id, queryClient])

  // Sigil 输入对话框状态
  const [sigilDialog, setSigilDialog] = useState<{
    open: boolean
    capturedPhoto?: string
    defaultRatio?: AspectRatio
  }>({ open: false })

  // QR码弹窗状态
  const [qrModal, setQrModal] = useState<{
    show: boolean
    orderId: string | null
    orderUrl: string | null
    sigilName: string | null
    userPhoto: string | null
    completed: boolean
    resultImage: string | null
  }>({ show: false, orderId: null, orderUrl: null, sigilName: null, userPhoto: null, completed: false, resultImage: null })

  // 初始化摄像头 - 移动端使用较低分辨率以提升性能
  const initCamera = useCallback(async () => {
    try {
      // 复用持久化的 stream（语言切换时不重新获取摄像头）
      let stream = persistentStream
      if (!stream || !stream.active) {
        // 移动端使用 640x480，桌面端使用 1280x720
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
  }, [isMobile])

  // 初始化 WebGL 渲染器
  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 复用持久化的 WebGL 渲染器
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
      // WebGL 失败时会回退到 CPU 渲染（renderLoop 中处理）
    }
  }, [])

  // 初始化 MediaPipe (Segmenter + Face Landmarker + Pose Landmarker)
  const initMediaPipe = useCallback(async () => {
    try {
      // 复用持久化的 MediaPipe 实例（语言切换时不重新加载模型）
      if (persistentSegmenter && persistentFaceLandmarker && persistentPoseLandmarker) {
        segmenterRef.current = persistentSegmenter
        faceLandmarkerRef.current = persistentFaceLandmarker
        poseLandmarkerRef.current = persistentPoseLandmarker
        setIsLoading(false)
        return
      }

      const { ImageSegmenter, FaceLandmarker, PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm',
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
      persistentSegmenter = segmenter

      // 初始化 Face Landmarker (FACS 基础) - 支持多人
      // 大幅降低检测阈值以支持合照中远处的小脸
      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 8, // 支持最多 8 人同时检测（合照场景）
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.4, // 降低检测阈值，支持远处小脸
        minFacePresenceConfidence: 0.3, // 降低存在确认阈值
        minTrackingConfidence: 0.3, // 降低追踪阈值以保持稳定
      })
      faceLandmarkerRef.current = faceLandmarker
      persistentFaceLandmarker = faceLandmarker

      // 初始化 Pose Landmarker - 人体骨骼检测
      const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 4, // 支持最多 4 人
        minPoseDetectionConfidence: 0.3,
        minPosePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
      })
      poseLandmarkerRef.current = poseLandmarker
      persistentPoseLandmarker = poseLandmarker

      setIsLoading(false)
    }
    catch (err) {
      setError(t('ai_load_error'))
      console.error('MediaPipe error:', err)
    }
  }, [])

  // 渲染循环 - 使用 WebGL 进行实时分割染色 + FACS 表情分析
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

    const width = video.videoWidth
    const height = video.videoHeight
    const now = performance.now()

    // FACS 表情分析 - 多人追踪
    let persons: TrackedPerson[] = []
    let faceLandmarksList: NormalizedLandmark[][] = []
    if (faceLandmarker) {
      const faceResult = faceLandmarker.detectForVideo(video, now)
      faceLandmarksList = faceResult.faceLandmarks || []
      const faceBlendshapesList = faceResult.faceBlendshapes || []

      // 更新人员追踪器（传入 blendshapes 用于验证真实人脸）
      persons = personTrackerRef.current.update(faceLandmarksList, faceBlendshapesList)

      // 节流检查（在 setState 外部进行，避免闭包问题）
      // 移动端使用更长的节流间隔以降低 CPU 负载 (400ms vs 200ms)
      const throttleInterval = isMobile ? 400 : 200
      const shouldUpdate = now - lastTrackedUpdateRef.current >= throttleInterval

      // 更新追踪人员状态
      if (persons.length > 0) {
        const currentPersons = persons
        const currentTime = now

        setTrackedPersons((prev) => {
          const prevIds = prev.map(p => p.id).join(',')
          const newIds = currentPersons.map(p => p.id).join(',')

          // ID 变化时立即更新
          if (prevIds !== newIds) {
            lastTrackedUpdateRef.current = currentTime
            return currentPersons
          }

          // 节流更新
          if (!shouldUpdate) {
            return prev
          }

          lastTrackedUpdateRef.current = currentTime
          return currentPersons
        })
      } else {
        // 没有检测到人脸时清空
        setTrackedPersons((prev) => prev.length > 0 ? [] : prev)
      }

      // 同步 overlay canvas 尺寸
      const overlayCanvas = overlayCanvasRef.current
      if (overlayCanvas) {
        if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
          overlayCanvas.width = width
          overlayCanvas.height = height
        }
      }
    }

    // 人体姿态检测
    const poseLandmarker = poseLandmarkerRef.current
    let poseLandmarksList: NormalizedLandmark[][] = []
    if (poseLandmarker) {
      const poseResult = poseLandmarker.detectForVideo(video, now)
      poseLandmarksList = poseResult.landmarks || []
    }

    // 执行分割
    const result = segmenter.segmentForVideo(video, now)

    if (result.categoryMask) {
      const mask = result.categoryMask.getAsUint8Array()

      // 使用默认发光颜色（Sigil 深金色）
      const glowColor: [number, number, number] = DEFAULT_GLOW_COLOR

      // 使用 WebGL 渲染（如果可用）
      if (webglRenderer) {
        webglRenderer.render(video, mask, width, height, glowColor, 3.0)

        // 在 overlay canvas 上绘制边框和人体骨骼
        const overlayCanvas = overlayCanvasRef.current
        if (overlayCanvas) {
          const overlayCtx = overlayCanvas.getContext('2d')
          if (overlayCtx) {
            overlayCtx.clearRect(0, 0, width, height)
            webglRenderer.drawBorder(overlayCtx, width, height, '#CC785C')

            // 对 mask 做形态学开运算（腐蚀+膨胀）去除小碎片
            const cleanMask = new Uint8Array(mask.length)
            const tempMask = new Uint8Array(mask.length)
            const morphRadius = 3 // 形态学半径

            // 腐蚀：只保留周围全是人物的像素
            for (let y = morphRadius; y < height - morphRadius; y++) {
              for (let x = morphRadius; x < width - morphRadius; x++) {
                const idx = y * width + x
                if (mask[idx] === 0) continue

                let allForeground = true
                outer: for (let dy = -morphRadius; dy <= morphRadius; dy++) {
                  for (let dx = -morphRadius; dx <= morphRadius; dx++) {
                    if (mask[(y + dy) * width + (x + dx)] === 0) {
                      allForeground = false
                      break outer
                    }
                  }
                }
                if (allForeground) tempMask[idx] = 1
              }
            }

            // 膨胀：恢复边缘
            for (let y = morphRadius; y < height - morphRadius; y++) {
              for (let x = morphRadius; x < width - morphRadius; x++) {
                const idx = y * width + x
                if (tempMask[idx]! > 0) {
                  for (let dy = -morphRadius; dy <= morphRadius; dy++) {
                    for (let dx = -morphRadius; dx <= morphRadius; dx++) {
                      cleanMask[(y + dy) * width + (x + dx)] = 1
                    }
                  }
                }
              }
            }

            // 绘制人体轮廓（基于清洗后的 mask 边缘检测）
            const edgeData = overlayCtx.createImageData(width, height)
            const edgePixels = edgeData.data
            const lineWidth = 4 // 轮廓线宽度

            for (let y = lineWidth; y < height - lineWidth; y++) {
              for (let x = lineWidth; x < width - lineWidth; x++) {
                const idx = y * width + x
                const current = cleanMask[idx]!

                // 检测边缘：当前是人物，检查更大范围的邻居
                if (current > 0) {
                  let isEdge = false
                  for (let dy = -lineWidth; dy <= lineWidth && !isEdge; dy++) {
                    for (let dx = -lineWidth; dx <= lineWidth && !isEdge; dx++) {
                      if (cleanMask[(y + dy) * width + (x + dx)] === 0) {
                        isEdge = true
                      }
                    }
                  }

                  if (isEdge) {
                    // 镜像 X 坐标
                    const mirrorX = width - 1 - x
                    const pixelIdx = (y * width + mirrorX) * 4
                    // 陶土色 #CC785C
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

      // 提取头部缩略图（节流：每 300ms 更新一次）
      // 注意：这里仍需 CPU 处理，因为需要访问原始视频帧和 mask
      if (persons.length > 0 && now - lastThumbnailUpdateRef.current > 300) {
        lastThumbnailUpdateRef.current = now

        // 创建临时 canvas 获取视频帧数据
        if (!thumbnailCanvasRef.current) {
          thumbnailCanvasRef.current = document.createElement('canvas')
        }
        const thumbCanvas = thumbnailCanvasRef.current
        const thumbSize = 200 // 增大尺寸保留面部细节，帮助 AI 准确识别年龄
        const newThumbnails: Record<string, string> = {}

        // 获取原始视频帧（用于缩略图）
        thumbCanvas.width = width
        thumbCanvas.height = height
        const tempCtx = thumbCanvas.getContext('2d', { willReadFrequently: true })
        if (tempCtx) {
          tempCtx.drawImage(video, 0, 0, width, height)
          const frameData = tempCtx.getImageData(0, 0, width, height).data

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
              // 创建小画布用于缩略图
              const smallCanvas = document.createElement('canvas')
              smallCanvas.width = thumbSize
              smallCanvas.height = thumbSize
              const smallCtx = smallCanvas.getContext('2d')
              if (!smallCtx) continue

              const thumbData = smallCtx.createImageData(thumbSize, thumbSize)
              const thumbPixels = thumbData.data

              for (let ty = 0; ty < thumbSize; ty++) {
                for (let tx = 0; tx < thumbSize; tx++) {
                  const sx = Math.floor(srcX + (tx / thumbSize) * srcW)
                  const sy = Math.floor(srcY + (ty / thumbSize) * srcH)

                  if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                    const srcIdx = sy * width + sx
                    const srcPixel = srcIdx * 4
                    const mirrorTx = thumbSize - 1 - tx
                    const thumbIdx = (ty * thumbSize + mirrorTx) * 4

                    if (mask[srcIdx]! === 0) {
                      thumbPixels[thumbIdx] = frameData[srcPixel]!
                      thumbPixels[thumbIdx + 1] = frameData[srcPixel + 1]!
                      thumbPixels[thumbIdx + 2] = frameData[srcPixel + 2]!
                      thumbPixels[thumbIdx + 3] = 255
                    }
                  }
                }
              }

              smallCtx.putImageData(thumbData, 0, 0)
              newThumbnails[person.id] = smallCanvas.toDataURL('image/png')
            }
          }

          if (Object.keys(newThumbnails).length > 0) {
            setHeadThumbnails(newThumbnails)
          }
        }
      }

      result.categoryMask.close()
    }

    result.close()
    animationRef.current = requestAnimationFrame(renderLoop)
  }, [isMobile])

  // 重新开始
  const restart = useCallback(() => {
    setCapturedPhoto(null)
    setGeneratedImage(null)
    setGenerateError(null)
    setTrackedPersons([])
    setSelectedPersonId(null)
    personTrackerRef.current.reset()
    setState('attract')
  }, [])

  // 打开 Sigil 输入对话框
  const handleOpenSigilDialog = useCallback((person: TrackedPerson) => {
    const capturedPhoto = headThumbnails[person.id]
    setSigilDialog({ open: true, capturedPhoto })
  }, [headThumbnails])

  // 确认 Sigil 输入后开始生成
  const handleConfirmSigil = useCallback(async (input: SigilInput) => {
    setSigilDialog({ open: false })

    const photo = sigilDialog.capturedPhoto || null

    // 先扣除积分（2 credits）
    const creditResult = await spendCredits(2, `Sigil generation: ${input.name}`)
    if (!creditResult.success) {
      alert(creditResult.error || 'Failed to spend credits')
      return
    }

    try {
      // Step 1: Create order first and get orderId
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

      if (!orderRes.ok) {
        throw new Error('Failed to create order')
      }

      const orderData = await orderRes.json()

      // Step 2: Open detail page in new tab immediately
      window.open(`/sigil/${orderData.orderId}`, '_blank')

      // Step 3: Trigger generation in background
      fetch('/api/generate-sigil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.name,
          bio: input.bio,
          userPhoto: photo,
          orderId: orderData.orderId,
          aspectRatio: input.aspectRatio,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setGeneratedImage(data.image)
          }
        })
        .catch(console.error)
    } catch (err) {
      console.error('Create order error:', err)
      alert(err instanceof Error ? err.message : 'Failed to create order')
    }
  }, [sigilDialog.capturedPhoto, spendCredits])


  // 标记组件已挂载（避免 ResizablePanel 宽度闪烁）
  useEffect(() => {
    setMounted(true)
  }, [])

  // 初始化（必须在 mounted 后执行，否则 canvas 不存在）
  useEffect(() => {
    if (!mounted) return

    initCamera()
    initMediaPipe()
    initWebGL()

    // 不在 cleanup 中停止摄像头，让 stream 跨语言切换保持活跃
    // 浏览器会在页面真正离开时自动释放资源
    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [mounted, initCamera, initMediaPipe, initWebGL])

  // 开始渲染循环 - 始终保持实时画面
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

  const personCount = trackedPersons.length
  const hasPersons = personCount > 0

  // 等待挂载后再渲染 ResizablePanelGroup，避免 localStorage 恢复导致的宽度闪烁
  if (!mounted) {
    return <div className="h-screen w-screen bg-black" />
  }

  return (
    <div className="h-dvh w-screen overflow-hidden bg-black flex flex-col">
      {/* 隐藏的视频元素 - 用于 AI 处理 */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
      />

      {/* 顶部历史记录横条 - 走马灯自动滚动 (移动端隐藏以节省空间) */}
      <div className={`shrink-0 border-b border-[#D4AF37]/20 bg-black/95 ${isMobile ? 'hidden' : ''}`}>
        <div className="h-40 px-4 flex items-center">
          {historyRecords.length > 0 ? (
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
                style={{
                  animationDuration: `${Math.max(20, historyRecords.length * 3)}s`,
                }}
              >
                {/* 复制两份实现无缝滚动 */}
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
                          userId: record.userId,
                          orderId: record.orderId,
                          ratio: record.ratio,
                          votes: record.votes,
                          userVote: null, // Will be fetched when needed
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
          ) : null}
        </div>
      </div>

      {/* 主体区域：桌面端左右分栏，移动端全屏镜子 */}
      {isMobile ? (
        /* 移动端布局：全屏镜子 + 底部工具栏 */
        <div className="flex-1 min-h-0 relative flex flex-col">
          {/* 镜子区域 */}
          <div className="flex-1 relative overflow-hidden">
            {/* 原始视频输入 - 镜像显示 */}
            <video
              ref={rawVideoRef}
              className={`absolute inset-0 h-full w-full object-cover ${showRawVideoInput ? '' : 'hidden'}`}
              style={{ transform: 'scaleX(-1)' }}
              playsInline
              muted
            />
            {/* 主画布 - AI 处理后效果 */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 h-full w-full object-cover ${showRawVideoInput ? 'hidden' : ''}`}
            />
            {/* 覆盖层画布 */}
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 h-full w-full object-cover pointer-events-none ${showRawVideoInput ? 'hidden' : ''}`}
            />
            {/* 镜子加载占位 */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="w-16 h-16 rounded-xl border-2 border-[#D4AF37]/40 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-8 h-8 text-[#D4AF37]/60" />
                </div>
              </div>
            )}
            {/* 顶部状态栏 - 简洁紧凑设计 */}
            <div className="absolute top-0 left-0 right-0 safe-area-top">
              <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/70 via-black/40 to-transparent">
                {/* 左侧：简洁 Logo */}
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-[#CC785C]/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-[#CC785C]" />
                  </div>
                  <span className="text-sm font-semibold text-white/90">LovSigil</span>
                </div>
                {/* 右侧：紧凑操作区 */}
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
            {!isLoading && hasPersons ? (
              <div className="flex items-center gap-3">
                {/* 检测到的人员头像列表 */}
                <div className="flex -space-x-2 overflow-hidden flex-1 min-w-0">
                  {trackedPersons.slice(0, 4).map((person) => {
                    const thumbnail = headThumbnails[person.id]
                    return (
                      <div
                        key={person.id}
                        className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#D4AF37]/60 shrink-0"
                        style={{ background: 'radial-gradient(circle, #D4AF3740 0%, #D4AF3720 100%)' }}
                      >
                        {thumbnail ? (
                          <img src={thumbnail} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">...</div>
                        )}
                      </div>
                    )
                  })}
                  {trackedPersons.length > 4 && (
                    <div className="w-12 h-12 rounded-full bg-[#D4AF37]/20 border-2 border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] text-xs font-medium shrink-0">
                      +{trackedPersons.length - 4}
                    </div>
                  )}
                </div>

                {/* 生成按钮 */}
                <Button
                  onClick={() => handleOpenSigilDialog(trackedPersons[0]!)}
                  className="shrink-0 bg-gradient-to-r from-[#C9A227] to-[#00D4FF] text-white font-medium touch-manipulation"
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Generate Sigil
                </Button>
              </div>
            ) : !isLoading ? (
              <div className="text-center py-2">
                <p className="text-white/40 text-sm">{t('step_closer')}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
      /* 桌面端布局：左右分栏 */
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0"
        autoSaveId="lanna-mirror-sidebar"
      >
        {/* 左侧面板 - 固定宽度320px */}
        <ResizablePanel
          defaultSize={20}
          minSize={5}
          maxSize={35}
          className="flex flex-col bg-black/95 overflow-y-auto"
          style={{ flexBasis: 320, minWidth: 120, maxWidth: 480 }}
        >
        {/* 标题区域 */}
        <div className="px-4 py-3 border-b border-[#D4AF37]/20">
          <div className="flex items-center gap-2">
            <h1
              className="text-xl font-bold tracking-widest"
              style={{ color: '#CC785C' }}
            >
              {t('title')}
            </h1>
            <Badge variant="outline" className="text-[10px] text-white/40 border-white/20 self-center">
              v{version}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-white/50 text-sm">{t('subtitle')}</p>
            <div className="flex items-center gap-2">
              <Link
                href="/gallery"
                className="flex items-center justify-center p-1.5 rounded-md hover:bg-[#D4AF37]/20 border border-transparent hover:border-[#D4AF37]/40 text-[#D4AF37] transition-colors"
                onClick={() => {
                  // 停止渲染循环
                  cancelAnimationFrame(animationRef.current)
                  // 释放 MediaPipe 模型以释放 GPU 资源
                  if (persistentSegmenter) {
                    persistentSegmenter.close?.()
                    persistentSegmenter = null
                    segmenterRef.current = null
                  }
                  if (persistentFaceLandmarker) {
                    persistentFaceLandmarker.close?.()
                    persistentFaceLandmarker = null
                    faceLandmarkerRef.current = null
                  }
                  if (persistentPoseLandmarker) {
                    persistentPoseLandmarker.close?.()
                    persistentPoseLandmarker = null
                    poseLandmarkerRef.current = null
                  }
                  // 停止摄像头
                  if (persistentStream) {
                    persistentStream.getTracks().forEach(track => track.stop())
                    persistentStream = null
                  }
                  // 释放 WebGL
                  if (persistentWebGLRenderer) {
                    persistentWebGLRenderer.dispose?.()
                    persistentWebGLRenderer = null
                    webglRendererRef.current = null
                  }
                }}
                title="Gallery"
              >
                <Palette className="w-4 h-4" />
              </Link>
              <LocaleSwitcher className="text-white" />
            </div>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {/* 加载状态 */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-white">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-white/60">{t('loading_ai')}</p>
            </div>
          )}

          {/* 吸引模式 - 等待或显示守护灵面板 */}
          {state === 'attract' && !isLoading && (
            <>
              {!hasPersons ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-lg border-2 border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]/60">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <p className="text-white/40 text-sm">{t('step_closer')}</p>
                  <p className="text-white/30 text-xs mt-3">{t('analyzing')}</p>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  {/* 人员列表 */}
                  <div className="flex-1 space-y-2">
                    {trackedPersons.map((person) => {
                      const thumbnail = headThumbnails[person.id]

                      return (
                        <div
                          key={person.id}
                          className="flex items-center gap-3 bg-black/50 rounded-lg px-3 py-2 border border-[#D4AF37]/20"
                        >
                          {/* 头像 */}
                          <div
                            className="w-20 h-20 rounded-full overflow-hidden border-2 shrink-0 border-[#D4AF37]/60"
                            style={{
                              background: 'radial-gradient(circle, #D4AF3740 0%, #D4AF3720 100%)',
                            }}
                          >
                            {thumbnail ? (
                              <img src={thumbnail} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-white/30 text-xs">...</span>
                              </div>
                            )}
                          </div>
                          {/* 生成按钮 */}
                          <Button
                            onClick={() => handleOpenSigilDialog(person)}
                            size="sm"
                            className="shrink-0 ml-auto bg-gradient-to-r from-[#C9A227] to-[#00D4FF] hover:brightness-110"
                          >
                            <Sparkles className="w-4 h-4 mr-1" />
                            Sigil
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* 用户登录区域 */}
        <div className="p-3 border-t border-[#D4AF37]/20">
          {authLoading ? (
            <div className="flex items-center justify-center py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
            </div>
          ) : user ? (
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-medium shrink-0 overflow-hidden"
              >
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
                  {isAdmin && (
                    <span className="text-[10px] text-[#D4AF37]/80">Admin</span>
                  )}
                  <Link
                    href="/credits"
                    className="text-[10px] text-white/50 flex items-center gap-0.5 hover:text-[#D4AF37] transition-colors"
                  >
                    <Coins className="w-3 h-3 text-[#D4AF37]" />
                    <span className="text-[#D4AF37]">{credits}</span>
                  </Link>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="text-white/40 hover:text-white/80 hover:bg-white/10 h-8 px-2"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => signInWithGoogle()}
              className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20"
            >
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
        {/* 原始视频输入 - 镜像显示 */}
        <video
          ref={rawVideoRef}
          className={`absolute inset-0 h-full w-full object-cover ${showRawVideoInput ? '' : 'hidden'}`}
          style={{ transform: 'scaleX(-1)' }}
          playsInline
          muted
        />

        {/* 主画布 - AI 处理后效果 */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full object-cover ${showRawVideoInput ? 'hidden' : ''}`}
        />

        {/* 覆盖层画布 - 显示每人的编号 */}
        <canvas
          ref={overlayCanvasRef}
          className={`absolute inset-0 h-full w-full object-cover pointer-events-none ${showRawVideoInput ? 'hidden' : ''}`}
        />

        {/* 切换原始/处理后画面按钮 */}
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

        {/* 镜子加载占位 */}
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

      {/* QR 码弹窗 - 生成时显示 */}
      {qrModal.show && qrModal.orderUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setQrModal(prev => ({ ...prev, show: false }))}
        >
          <div
            className="relative bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl p-5 max-w-4xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex gap-5">
              {/* 左侧：生成图片（主角） */}
              <div className="flex-1 min-w-0">
                {qrModal.completed && qrModal.resultImage ? (
                  <img
                    src={qrModal.resultImage}
                    alt="Generated"
                    className="w-full rounded-xl"
                  />
                ) : (
                  <div className="w-full aspect-[3/4] bg-white/5 rounded-xl flex flex-col items-center justify-center gap-3 border border-white/10">
                    <div className="w-12 h-12 animate-spin rounded-full border-4 border-[#D4AF37] border-t-transparent" />
                    <span className="text-white/50">{t('qr_generating')}</span>
                  </div>
                )}
              </div>

              {/* 右侧栏：原照片 + QR码 + 操作 */}
              <div className="w-48 shrink-0 flex flex-col gap-4">
                {/* 标题 */}
                <div className="text-center">
                  <span className="text-2xl">✨</span>
                  <h2 className="text-lg font-bold text-[#D4AF37] mt-1">
                    {qrModal.sigilName || 'Personal Sigil'}
                  </h2>
                </div>

                {/* 原摄像输入 */}
                {qrModal.userPhoto && (
                  <div className="bg-black/30 rounded-lg p-2">
                    <p className="text-white/40 text-xs text-center mb-1">{t('original')}</p>
                    <img
                      src={qrModal.userPhoto}
                      alt="Original"
                      className="w-full aspect-square object-cover rounded"
                    />
                  </div>
                )}

                {/* QR 码 */}
                <div className="bg-white rounded-lg p-2">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrModal.orderUrl)}`}
                    alt="QR Code"
                    className="w-full aspect-square"
                  />
                </div>
                <p className="text-center text-white/40 text-xs -mt-2">
                  {t('qr_subtitle')}
                </p>

                {/* 操作按钮 */}
                {qrModal.completed && qrModal.resultImage && (
                  <Button
                    onClick={() => downloadImage(
                      qrModal.resultImage!,
                      `lovsigil-${qrModal.sigilName || 'sigil'}-${Date.now()}.png`
                    )}
                    className="w-full text-white font-medium bg-[#D4AF37] hover:bg-[#E5C04B]"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    {t('download')}
                  </Button>
                )}
              </div>
            </div>

            {/* 关闭按钮 */}
            <button
              className="absolute top-3 right-3 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full text-white/60 hover:text-white flex items-center justify-center transition-colors"
              onClick={() => setQrModal(prev => ({ ...prev, show: false }))}
            >
              <X className="w-4 h-4" />
            </button>
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
            {/* 生成效果图 */}
            <img
              src={previewRecord.generatedImage}
              alt="Generated Sigil"
              className="max-h-[70vh] object-contain rounded-lg shadow-2xl"
              onClick={e => e.stopPropagation()}
            />

            {/* 投票按钮 */}
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => handleVote('like')}
                className={`p-2 rounded-full transition-colors ${
                  previewRecord.userVote === 1
                    ? 'bg-green-500/50 text-green-300'
                    : 'bg-white/10 hover:bg-green-500/30 text-white'
                }`}
              >
                <ThumbsUp className="w-5 h-5" />
              </button>
              <span className={`min-w-[3rem] text-center text-lg font-bold ${
                (previewRecord.votes ?? 0) > 0 ? 'text-green-400' :
                (previewRecord.votes ?? 0) < 0 ? 'text-red-400' : 'text-white/60'
              }`}>
                {(previewRecord.votes ?? 0) > 0 ? '+' : ''}{previewRecord.votes ?? 0}
              </span>
              <button
                onClick={() => handleVote('dislike')}
                className={`p-2 rounded-full transition-colors ${
                  previewRecord.userVote === -1
                    ? 'bg-red-500/50 text-red-300'
                    : 'bg-white/10 hover:bg-red-500/30 text-white'
                }`}
              >
                <ThumbsDown className="w-5 h-5" />
              </button>
            </div>

            {/* 操作按钮 */}
            {previewRecord.generatedImage && (
              <div className="flex flex-wrap justify-center gap-3 p-3 bg-black/50 rounded-xl backdrop-blur-sm">
                <Button
                  onClick={() => {
                    const defaultRatio = previewRecord.ratio as AspectRatio | undefined
                    setPreviewRecord(null)
                    // 如果有检测到人，直接打开 Sigil 输入对话框
                    if (trackedPersons.length >= 1) {
                      const capturedPhoto = headThumbnails[trackedPersons[0]!.id]
                      setSigilDialog({
                        open: true,
                        capturedPhoto,
                        defaultRatio,
                      })
                    }
                    // 如果没有人，关闭悬浮窗后用户会看到"Step closer..."提示
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

            {/* 关闭按钮 */}
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
      />
    </div>
  )
}
