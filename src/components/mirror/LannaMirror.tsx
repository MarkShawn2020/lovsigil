'use client'

import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Coins,
  Download,
  LogOut,
  Palette,
  Sparkles,
  Users,
  Video,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import type {GenerationOptions} from './GenerationOptionsDialog';
import type { TrackedPerson } from './personTracker'
import type { LannaSpirit } from './types'
import { useDeleteRecord } from '@/hooks/useDeleteRecord'
import { useGenerateSpirit } from '@/hooks/useGenerateSpirit'
import { useSpiritHistory } from '@/hooks/useSpiritHistory'
import { useAuth } from '@/providers/AuthProvider'
import { SPIRIT_INFO } from './facsAnalyzer'
import {
  GENERATION_STYLES,
  
  GenerationOptionsDialog
} from './GenerationOptionsDialog'
import { PersonTracker } from './personTracker'
import { downloadImage, generateLannaPoster } from './posterGenerator'
import { LANNA_SPIRITS } from './spiritData'
import { hexToNormalizedRgb, WebGLRenderer } from './webglRenderer'

// 合像生成中单人的状态
interface GroupGenerationPerson {
  personId: string
  photo: string | null
  spirit: LannaSpirit
  status: 'pending' | 'generating' | 'done' | 'error'
  generatedImage: string | null
  error: string | null
}

type MirrorState = 'attract' | 'generate' | 'result'

// 模块级变量：跨组件重新挂载保持状态（语言切换时不重新初始化）
let persistentStream: MediaStream | null = null
let persistentSegmenter: any = null
let persistentFaceLandmarker: any = null
let persistentPoseLandmarker: any = null
let persistentWebGLRenderer: WebGLRenderer | null = null

export function LannaMirror() {
  const t = useTranslations('LannaMirror')
  const { user, isAdmin, credits, loading: authLoading, signInWithGoogle, signOut, spendCredits } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const rawVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<MirrorState>('attract')
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
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
  const lastSpiritUpdateRef = useRef<number>(0)
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

  // Mutations
  const generateMutation = useGenerateSpirit()
  const deleteMutation = useDeleteRecord()
  const [previewRecord, setPreviewRecord] = useState<{
    id: number
    generatedImage: string
    userPhoto: string | null
    spiritId: string
    userId: string | null
  } | null>(null)
  const [previewPoster, setPreviewPoster] = useState<string | null>(null)
  const [includeOriginalInPoster, setIncludeOriginalInPoster] = useState(false)
  const [showRawVideoInput, setShowRawVideoInput] = useState(false)

  // 合像相关状态
  const [groupGenerating, setGroupGenerating] = useState(false)
  const [groupPersons, setGroupPersons] = useState<GroupGenerationPerson[]>([])
  const [groupPoster, setGroupPoster] = useState<string | null>(null)

  // 生成选项对话框状态（包含捕获时刻的截图）
  const [optionsDialog, setOptionsDialog] = useState<{
    open: boolean
    person: TrackedPerson | null
    isGroup: boolean
    capturedPhoto?: string  // 单人时捕获的截图
    capturedPhotos?: string[]  // 合照时捕获的截图列表
  }>({ open: false, person: null, isGroup: false })

  // QR码弹窗状态
  const [qrModal, setQrModal] = useState<{
    show: boolean
    orderId: string | null
    orderUrl: string | null
    spiritName: string | null
    spiritEmoji: string | null
    spiritId: string | null
    userPhoto: string | null
    completed: boolean
    resultImage: string | null
  }>({ show: false, orderId: null, orderUrl: null, spiritName: null, spiritEmoji: null, spiritId: null, userPhoto: null, completed: false, resultImage: null })

  // 预览时自动生成海报（根据模式生成不同版本）
  useEffect(() => {
    if (!previewRecord?.generatedImage) {
      setPreviewPoster(null)
      return
    }
    generateLannaPoster({
      originalImage: previewRecord.userPhoto || '',
      generatedImage: previewRecord.generatedImage,
      spiritId: previewRecord.spiritId,
      includeOriginal: includeOriginalInPoster && !!previewRecord.userPhoto,
    })
      .then(setPreviewPoster)
      .catch(console.error)
  }, [previewRecord, includeOriginalInPoster])

  // 初始化摄像头
  const initCamera = useCallback(async () => {
    try {
      // 复用持久化的 stream（语言切换时不重新获取摄像头）
      let stream = persistentStream
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
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
  }, [])

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
      const shouldUpdate = now - lastSpiritUpdateRef.current >= 200

      // 更新追踪人员状态
      if (persons.length > 0) {
        const currentPersons = persons // 捕获当前帧的 persons 引用
        const currentTime = now // 捕获当前时间

        setTrackedPersons((prev) => {
          const prevIds = prev.map(p => p.id).join(',')
          const newIds = currentPersons.map(p => p.id).join(',')

          // ID 变化时立即更新（深拷贝 spiritScores 避免引用问题）
          if (prevIds !== newIds) {
            lastSpiritUpdateRef.current = currentTime
            return currentPersons.map(p => ({
              ...p,
              spiritScores: { ...p.spiritScores },
            }))
          }

          // 节流：每 200ms 更新一次 spiritScores
          if (!shouldUpdate) {
            return prev
          }

          lastSpiritUpdateRef.current = currentTime
          // 返回新数组以触发 React 重渲染（按 ID 匹配，而非索引）
          const prevMap = new Map(prev.map(p => [p.id, p]))
          return currentPersons.map((newPerson) => {
            const prevPerson = prevMap.get(newPerson.id)
            return prevPerson ? {
              ...prevPerson,
              currentFeatures: newPerson.currentFeatures,
              spiritScores: { ...newPerson.spiritScores }, // 深拷贝 spiritScores
              dominantSpirit: newPerson.dominantSpirit,
            } : newPerson
          })
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

      // 确定发光颜色（使用最大脸部的守护灵颜色）
      let glowColor: [number, number, number] = [0.83, 0.69, 0.22] // 默认金色
      if (persons.length > 0) {
        // 按脸部大小排序，取最大的
        const primaryPerson = persons.reduce((a, b) => a.size > b.size ? a : b)
        const spiritInfo = SPIRIT_INFO[primaryPerson.dominantSpirit as keyof typeof SPIRIT_INFO]
        if (spiritInfo) {
          glowColor = hexToNormalizedRgb(spiritInfo.color)
        }
      }

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

            // 绘制人体轮廓（基于分割 mask 边缘检测，加粗版）
            const edgeData = overlayCtx.createImageData(width, height)
            const edgePixels = edgeData.data
            const lineWidth = 4 // 轮廓线宽度

            for (let y = lineWidth; y < height - lineWidth; y++) {
              for (let x = lineWidth; x < width - lineWidth; x++) {
                const idx = y * width + x
                const current = mask[idx]

                // 检测边缘：当前是人物，检查更大范围的邻居
                if (current > 0) {
                  let isEdge = false
                  for (let dy = -lineWidth; dy <= lineWidth && !isEdge; dy++) {
                    for (let dx = -lineWidth; dx <= lineWidth && !isEdge; dx++) {
                      if (mask[(y + dy) * width + (x + dx)] === 0) {
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


  // 打开生成选项对话框（在此时捕获截图）
  const handleOpenOptionsDialog = useCallback((person: TrackedPerson) => {
    const capturedPhoto = headThumbnails[person.id]
    setOptionsDialog({ open: true, person, isGroup: false, capturedPhoto })
  }, [headThumbnails])

  // 打开合像生成选项对话框（在此时捕获所有人的截图）
  const handleOpenGroupOptionsDialog = useCallback(() => {
    if (trackedPersons.length < 2) return
    const capturedPhotos = trackedPersons
      .map(p => headThumbnails[p.id])
      .filter((p): p is string => !!p)
    setOptionsDialog({ open: true, person: null, isGroup: true, capturedPhotos })
  }, [trackedPersons, headThumbnails])

  // 确认生成选项后开始生成
  const handleConfirmGeneration = useCallback(async (options: GenerationOptions) => {
    setOptionsDialog({ open: false, person: null, isGroup: false })

    if (optionsDialog.isGroup) {
      // 合像生成
      handleGenerateGroupPortraitWithOptions(options)
    } else if (optionsDialog.person) {
      // 单人生成
      handleGenerateForPersonWithOptions(optionsDialog.person, options)
    }
  }, [optionsDialog])

  // 从 attract 状态直接生成某人的守护灵画像（带选项）
  const handleGenerateForPersonWithOptions = useCallback(async (person: TrackedPerson, options: GenerationOptions) => {
    const spirit = LANNA_SPIRITS.find(s => s.id === person.dominantSpirit)
    if (!spirit)
      return

    const photo = headThumbnails[person.id] || null
    const spiritInfo = SPIRIT_INFO[person.dominantSpirit as keyof typeof SPIRIT_INFO]
    const styleConfig = GENERATION_STYLES.find(s => s.id === options.style)

    // 先扣除积分（单人 2 credits）
    const creditResult = await spendCredits(2, `Spirit generation: ${spirit.name}`)
    if (!creditResult.success) {
      alert(creditResult.error || 'Failed to spend credits')
      return
    }

    try {
      // Step 1: Create order first and get orderId
      const orderRes = await fetch('/api/spirit/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spirit: {
            id: spirit.id,
            name: spirit.name,
            nameEn: spirit.nameEn,
            element: spirit.element,
            traits: spirit.traits,
          },
          userPhoto: photo,
          spiritScores: person.spiritScores,
          generationOptions: options,
        }),
      })

      if (!orderRes.ok) {
        throw new Error('Failed to create order')
      }

      const orderData = await orderRes.json()

      // Step 2: Open detail page in new tab immediately
      window.open(`/spirit/${orderData.orderId}`, '_blank')

      // Step 3: Trigger generation in background (with orderId and options)
      fetch('/api/generate-spirit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spirit: {
            id: spirit.id,
            name: spirit.name,
            nameEn: spirit.nameEn,
            element: spirit.element,
            traits: spirit.traits,
            imagePrompt: spirit.imagePrompt,
          },
          userPhoto: photo,
          spiritScores: person.spiritScores,
          orderId: orderData.orderId,
          generationOptions: {
            style: options.style,
            stylePromptModifier: styleConfig?.promptModifier,
            aspectRatio: options.aspectRatio,
          },
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
  }, [headThumbnails, spendCredits])

  // 生成合像（单次 API 调用，多人一起生成）- 带选项
  const handleGenerateGroupPortraitWithOptions = useCallback(async (options: GenerationOptions) => {
    if (trackedPersons.length < 2) return

    // 先扣除积分（合照 2 * n credits）
    const creditCost = 2 * trackedPersons.length
    const creditResult = await spendCredits(creditCost, `Group spirit generation: ${trackedPersons.length} people`)
    if (!creditResult.success) {
      alert(creditResult.error || 'Failed to spend credits')
      return
    }

    // 准备所有人的数据
    const persons: GroupGenerationPerson[] = trackedPersons.map((person) => {
      const spirit = LANNA_SPIRITS.find(s => s.id === person.dominantSpirit)!
      return {
        personId: person.id,
        photo: headThumbnails[person.id] || null,
        spirit,
        status: 'generating' as const,
        generatedImage: null,
        error: null,
      }
    })

    const styleConfig = GENERATION_STYLES.find(s => s.id === options.style)

    const groupData = {
      persons: persons.map(p => ({
        photo: p.photo,
        spirit: {
          id: p.spirit.id,
          name: p.spirit.name,
          nameEn: p.spirit.nameEn,
          element: p.spirit.element,
          traits: p.spirit.traits,
        },
      })),
    }

    try {
      // Step 1: Create order first
      const orderRes = await fetch('/api/spirit/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: groupData, generationOptions: options }),
      })

      if (!orderRes.ok) {
        throw new Error('Failed to create order')
      }

      const orderData = await orderRes.json()

      // Step 2: Open detail page in new tab immediately
      window.open(`/spirit/${orderData.orderId}`, '_blank')

      // Also start the group generation modal for those staying at the mirror
      setGroupPersons(persons)
      setGroupGenerating(true)
      setGroupPoster(null)

      // Step 3: Trigger generation in background (with orderId and options)
      const response = await fetch('/api/generate-spirit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group: groupData,
          orderId: orderData.orderId,
          generationOptions: {
            style: options.style,
            stylePromptModifier: styleConfig?.promptModifier,
            aspectRatio: options.aspectRatio,
          },
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Generation failed')
      }

      const data = await response.json()

      // 全部标记为完成，共享同一张生成图
      setGroupPersons(prev => prev.map(p => ({
        ...p,
        status: 'done' as const,
        generatedImage: data.image,
      })))

      // 直接使用生成的合像作为海报
      setGroupPoster(data.image)
    } catch (err) {
      console.error('Group generation error:', err)
      // 全部标记为错误
      setGroupPersons(prev => prev.map(p => ({
        ...p,
        status: 'error' as const,
        error: err instanceof Error ? err.message : 'Failed',
      })))
    }

    setGroupGenerating(false)
  }, [trackedPersons, headThumbnails, spendCredits])

  // 关闭合像弹窗
  const closeGroupModal = useCallback(() => {
    setGroupGenerating(false)
    setGroupPersons([])
    setGroupPoster(null)
  }, [])

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

  // 删除历史记录
  const handleDeleteRecord = useCallback((recordId: number) => {
    deleteMutation.mutate(recordId, {
      onSuccess: () => {
        setPreviewRecord(null)
      },
      onError: (err) => {
        console.error('Delete error:', err)
        alert(err instanceof Error ? err.message : '删除失败')
      },
    })
  }, [deleteMutation])

  const isDeleting = deleteMutation.isPending

  // 检查是否可以删除（管理员或所有者，且是已保存的记录）
  const canDelete = useCallback((record: { id: number; userId: string | null }) => {
    if (record.id <= 0) return false // 新生成的未保存记录不可删除
    if (isAdmin) return true
    if (user && record.userId === user.id) return true
    return false
  }, [isAdmin, user])

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

      {/* 顶部历史记录横条 - 走马灯自动滚动 */}
      <div className="shrink-0 border-b border-[#D4AF37]/20 bg-black/95">
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
                {[...historyRecords, ...historyRecords].map((record, idx) => {
                  const info = SPIRIT_INFO[record.spiritId as keyof typeof SPIRIT_INFO]
                  return (
                    <div
                      key={`${record.id}-${idx}`}
                      className="relative group/item cursor-pointer shrink-0"
                      onClick={() => {
                        if (record.orderId) {
                          window.open(`/spirit/${record.orderId}`, '_blank')
                        } else {
                          setPreviewRecord({
                            id: record.id,
                            generatedImage: record.generatedImage,
                            userPhoto: record.userPhoto,
                            spiritId: record.spiritId,
                            userId: record.userId,
                          })
                        }
                      }}
                    >
                      <img
                        src={record.generatedImage}
                        alt={record.spiritName || record.spiritId}
                        className="w-36 h-36 object-cover rounded-lg border border-white/10 group-hover/item:border-[#D4AF37]/50 transition-colors"
                      />
                      <div
                        className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-xs"
                        style={{ color: info?.color || '#D4AF37' }}
                      >
                        {record.spiritId === 'group' ? <Users className="w-4 h-4" /> : info?.emoji}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 主体区域：左右分栏 */}
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
            <LocaleSwitcher className="text-white" />
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
                <>
                  {/* 守护灵面板 - 单行精简显示 */}
                  <div className="space-y-2">
                    {trackedPersons.map((person) => {
                      const thumbnail = headThumbnails[person.id]
                      const spiritInfo = SPIRIT_INFO[person.dominantSpirit as keyof typeof SPIRIT_INFO]

                      return (
                        <div
                          key={person.id}
                          className="flex items-center gap-2 bg-black/50 rounded-lg px-3 py-2 border border-[#D4AF37]/20"
                        >
                          {/* 头像 */}
                          <div
                            className="w-20 h-20 rounded-full overflow-hidden border-2 shrink-0"
                            style={{
                              borderColor: spiritInfo?.color || '#D4AF37',
                              background: `radial-gradient(circle, ${spiritInfo?.color}40 0%, ${spiritInfo?.color}20 100%)`,
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
                          {/* 守护灵 */}
                          <span className="text-lg">{spiritInfo?.emoji}</span>
                          <span className="text-white/70 text-sm flex-1 truncate">{spiritInfo?.name}</span>
                          {/* 生成按钮 */}
                          <Button
                            onClick={() => handleOpenOptionsDialog(person)}
                            size="sm"
                            className="shrink-0"
                          >
                            <Sparkles className="w-4 h-4 mr-1" />
                            Generate
                          </Button>
                        </div>
                      )
                    })}

                    {/* 合像按钮 - 常驻显示，非多人时 disabled */}
                    <Button
                      onClick={handleOpenGroupOptionsDialog}
                      disabled={groupGenerating || trackedPersons.length < 2}
                      className="w-full mt-2 bg-gradient-to-r from-[#D4AF37] to-[#CC785C] hover:from-[#E5C04B] hover:to-[#DD896D] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {groupGenerating ? (
                        <>
                          <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          {t('generating_group')}
                        </>
                      ) : (
                        <>
                          <Users className="w-4 h-4 mr-1" />
                          Group
                        </>
                      )}
                    </Button>
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
                        <p className="text-white/40 text-xs mb-1">{t('original')}</p>
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
                    <div className="text-white/30">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                    {/* 生成结果缩略图 */}
                    <div className="text-center">
                      <p className="text-white/40 text-xs mb-1">{t('spirit')}</p>
                      <div
                        className="w-20 h-20 rounded-full overflow-hidden border-2"
                        style={{ borderColor: matchedSpirit.color }}
                      >
                        <img src={generatedImage} alt="Spirit" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="pt-2">
                {generatedImage ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setPreviewRecord({
                        id: 0,
                        generatedImage,
                        userPhoto: capturedPhoto || '',
                        spiritId: matchedSpirit.id,
                        userId: null,
                      })}
                      className="flex-1"
                      style={{ backgroundColor: matchedSpirit.color }}
                    >
                      {t('preview')}
                    </Button>
                    <Button
                      onClick={restart}
                      variant="outline"
                      className="flex-1"
                    >
                      {t('another_one')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={generateSpiritImage}
                    className="w-full"
                    style={{ backgroundColor: matchedSpirit.color }}
                  >
                    {t('generate_portrait')}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* 生成中状态 */}
          {state === 'generate' && (
            <div className="text-center py-8">
              {/* 原始采集头像 */}
              {capturedPhoto && matchedSpirit && (
                <div className="mb-4">
                  <p className="text-white/40 text-xs mb-2">{t('original')}</p>
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
                  <div className="flex justify-center mb-4">
                    <AlertTriangle className="w-10 h-10 text-yellow-500" />
                  </div>
                  <p className="text-red-400 mb-2">{t('generation_failed')}</p>
                  <p className="text-xs text-white/50 mb-4">{generateError}</p>
                  <div className="space-y-2">
                    <Button onClick={generateSpiritImage} size="sm" style={{ backgroundColor: '#CC785C' }}>
                      {t('retry')}
                    </Button>
                    <Button onClick={restart} variant="outline" size="sm" className="ml-2">
                      {t('start_over')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#D4AF37] border-t-transparent mx-auto" />
                  <p className="text-white/80 text-sm">{t('generating')}</p>
                  <p className="text-xs text-white/30 mt-2">{t('generation_time')}</p>
                </>
              )}
            </div>
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

      {/* 合像生成浮层 */}
      {(groupGenerating || groupPersons.length > 0) && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeGroupModal}
        >
          <div
            className="relative flex flex-col items-center gap-6 max-w-4xl w-full"
            onClick={e => e.stopPropagation()}
          >
            {/* 标题 */}
            <h2 className="text-2xl font-bold text-[#D4AF37] flex items-center gap-2 justify-center">
              <Users className="w-6 h-6" />
              {t('group_portrait')}
            </h2>

            {/* 生成进度或海报结果 */}
            {groupPoster ? (
              // 显示合像海报
              <>
                <img
                  src={groupPoster}
                  alt="Group Portrait"
                  className="max-h-[70vh] object-contain rounded-lg shadow-2xl"
                />
                <div className="flex gap-3">
                  <Button
                    onClick={() => downloadImage(groupPoster, `lanna-group-portrait-${Date.now()}.png`)}
                    className="bg-[#D4AF37] hover:bg-[#E5C04B] text-white"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    {t('download')}
                  </Button>
                  <Button
                    onClick={closeGroupModal}
                    variant="outline"
                    className="text-white border-white/30 hover:bg-white/10"
                  >
                    {t('close')}
                  </Button>
                </div>
              </>
            ) : (
              // 显示生成进度
              <div className="w-full max-w-md space-y-4">
                {groupPersons.map((person, idx) => {
                  const spiritInfo = SPIRIT_INFO[person.spirit.id as keyof typeof SPIRIT_INFO]
                  return (
                    <div
                      key={person.personId}
                      className="flex items-center gap-4 p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      {/* 头像/缩略图 */}
                      <div
                        className="w-12 h-12 rounded-full overflow-hidden border-2 shrink-0"
                        style={{
                          borderColor: spiritInfo?.color || '#D4AF37',
                          background: `radial-gradient(circle, ${spiritInfo?.color}40 0%, ${spiritInfo?.color}20 100%)`,
                        }}
                      >
                        {person.photo ? (
                          <img src={person.photo} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/30">
                            {idx + 1}
                          </div>
                        )}
                      </div>

                      {/* 守护灵信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{spiritInfo?.emoji}</span>
                          <span className="text-white/80 text-sm">{spiritInfo?.name}</span>
                        </div>
                        <p className="text-xs text-white/40 truncate">{spiritInfo?.nameEn}</p>
                      </div>

                      {/* 状态指示 */}
                      <div className="shrink-0">
                        {person.status === 'pending' && (
                          <span className="text-white/30 text-sm">{t('waiting')}</span>
                        )}
                        {person.status === 'generating' && (
                          <div className="w-5 h-5 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
                        )}
                        {person.status === 'done' && (
                          <Check className="w-5 h-5 text-green-400" />
                        )}
                        {person.status === 'error' && (
                          <span title={person.error || ''}>
                            <X className="w-5 h-5 text-red-400" />
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* 合像生成提示 */}
                {groupPersons.every(p => p.status === 'done' || p.status === 'error') && !groupPoster && (
                  <div className="text-center py-4">
                    <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent mx-auto" />
                    <p className="text-white/60 text-sm">{t('composing_group_poster')}</p>
                  </div>
                )}
              </div>
            )}

            {/* 关闭按钮 */}
            <button
              className="absolute -top-2 -right-2 w-8 h-8 bg-black/60 rounded-full text-white/80 hover:text-white flex items-center justify-center"
              onClick={closeGroupModal}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
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

              {/* 右侧栏：原照片 + 信息 + QR码 + 操作 */}
              <div className="w-48 shrink-0 flex flex-col gap-4">
                {/* 守护神信息 */}
                <div className="text-center">
                  <span className="text-2xl">{qrModal.spiritEmoji}</span>
                  <h2 className="text-lg font-bold text-[#D4AF37] mt-1">
                    {qrModal.spiritName}
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
                      `lanna-spirit-${qrModal.spiritId || 'group'}-${Date.now()}.png`
                    )}
                    className="w-full text-white font-medium"
                    style={{ backgroundColor: qrModal.spiritId ? (SPIRIT_INFO[qrModal.spiritId as keyof typeof SPIRIT_INFO]?.color || '#D4AF37') : '#D4AF37' }}
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
          <div className="relative flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
            {/* 海报展示 */}
            {previewPoster ? (
              <img
                src={previewPoster}
                alt="Lanna Spirit Poster"
                className="max-h-[80vh] object-contain rounded-lg shadow-2xl"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#D4AF37] border-t-transparent" />
                <p className="text-white/60 text-sm">{t('generating_poster')}</p>
              </div>
            )}

            {/* 操作按钮 */}
            {previewPoster && (
              <div className="flex gap-3 p-3 bg-black/50 rounded-xl backdrop-blur-sm">
                {previewRecord.userPhoto && (
                  <Button
                    onClick={() => setIncludeOriginalInPoster(!includeOriginalInPoster)}
                    className="bg-white/20 text-white border border-white/30 hover:bg-white/30"
                  >
                    {includeOriginalInPoster ? t('spirit_only') : t('with_original')}
                  </Button>
                )}
                <Button
                  onClick={() => downloadImage(
                    previewPoster,
                    `lanna-spirit-poster-${includeOriginalInPoster ? 'compare' : 'spirit'}-${previewRecord.spiritId}-${Date.now()}.png`
                  )}
                  className="text-white font-medium"
                  style={{
                    backgroundColor: SPIRIT_INFO[previewRecord.spiritId as keyof typeof SPIRIT_INFO]?.color || '#D4AF37',
                  }}
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  {t('download')}
                </Button>
                {canDelete(previewRecord) && (
                  <Button
                    onClick={() => handleDeleteRecord(previewRecord.id)}
                    disabled={isDeleting}
                    className="bg-red-600/80 text-white hover:bg-red-600"
                  >
                    <X className="w-4 h-4 mr-1.5" />
                    {isDeleting ? t('deleting') : t('delete')}
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

      {/* 生成选项对话框 */}
      <GenerationOptionsDialog
        open={optionsDialog.open}
        onOpenChange={(open) => setOptionsDialog(prev => ({ ...prev, open }))}
        onConfirm={handleConfirmGeneration}
        personName={optionsDialog.person ? SPIRIT_INFO[optionsDialog.person.dominantSpirit as keyof typeof SPIRIT_INFO]?.name : undefined}
        personCount={optionsDialog.isGroup ? trackedPersons.length : 1}
        userPhoto={optionsDialog.capturedPhoto}
        userPhotos={optionsDialog.capturedPhotos}
      />
    </div>
  )
}
