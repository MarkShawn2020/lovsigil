'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Sparkles, RotateCcw, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { AudienceSigil } from './GameModeLayout'

interface GameGeneratorProps {
  sessionId: string
  onSigilAdded: (sigil: AudienceSigil) => void
  onSigilUpdated: (id: number, updates: Partial<AudienceSigil>) => void
  onSigilRemoved: (id: number) => void
}

// Module-level: persist across remounts
let persistentStream: MediaStream | null = null

export function GameGenerator({ sessionId, onSigilAdded, onSigilUpdated, onSigilRemoved }: GameGeneratorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Current audience being edited - use ref to avoid async state issues
  const [currentId, setCurrentId] = useState<number | null>(null)
  const currentIdRef = useRef<number | null>(null)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')

  // Initialize camera
  const initCamera = useCallback(async () => {
    try {
      setCameraError(null)
      let stream = persistentStream
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })
        persistentStream = stream
      }

      if (videoRef.current && videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(e => {
          if (e.name !== 'AbortError') console.error('Video play error:', e)
        })
      }
    } catch (err) {
      setCameraError('无法访问摄像头')
      console.error('Camera error:', err)
    }
  }, [])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (persistentStream) {
      persistentStream.getTracks().forEach(track => track.stop())
      persistentStream = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (cameraEnabled) {
      stopCamera()
      setCameraEnabled(false)
    } else {
      setCameraEnabled(true)
      initCamera()
    }
  }, [cameraEnabled, stopCamera, initCamera])

  // Capture photo - update current entry or create new one
  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return

    const canvas = document.createElement('canvas')
    const size = 200
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Crop center square, mirror
    const vw = video.videoWidth
    const vh = video.videoHeight
    const cropSize = Math.min(vw, vh)
    const sx = (vw - cropSize) / 2
    const sy = (vh - cropSize) / 2

    ctx.translate(size, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, size, size)

    const photoData = canvas.toDataURL('image/png')

    // 只更新头像，不重置姓名和简介
    setCapturedPhoto(photoData)

    // 如果已有条目则更新头像，否则创建新条目
    if (currentIdRef.current) {
      onSigilUpdated(currentIdRef.current, { userPhoto: photoData })
    } else {
      const newId = Date.now()
      setCurrentId(newId)
      currentIdRef.current = newId
      onSigilAdded({
        id: newId,
        name: name || '新玩家',
        bio: bio || undefined,
        userPhoto: photoData,
        status: 'pending',
        createdAt: new Date().toISOString(),
      })
    }
  }, [name, bio, onSigilAdded, onSigilUpdated])

  // Update name in real-time
  const handleNameChange = useCallback((newName: string) => {
    setName(newName)
    if (currentIdRef.current) {
      onSigilUpdated(currentIdRef.current, { name: newName || '新玩家' })
    }
  }, [onSigilUpdated])

  // Update bio in real-time
  const handleBioChange = useCallback((newBio: string) => {
    setBio(newBio)
    if (currentIdRef.current) {
      onSigilUpdated(currentIdRef.current, { bio: newBio })
    }
  }, [onSigilUpdated])

  // Clear captured photo
  const clearPhoto = useCallback(() => {
    if (currentIdRef.current) {
      onSigilRemoved(currentIdRef.current)
    }
    setCapturedPhoto(null)
    setCurrentId(null)
    currentIdRef.current = null
    setName('')
    setBio('')
  }, [onSigilRemoved])

  // Generate sigil
  const handleGenerate = useCallback(async () => {
    if (!name.trim()) return

    // 捕获当前值
    const genName = name.trim()
    const genBio = bio.trim() || undefined
    const genPhoto = capturedPhoto || undefined
    const genId = currentIdRef.current

    // 如果没有拍照，先创建一个新条目
    let sigilId = genId
    if (!sigilId) {
      sigilId = Date.now()
      onSigilAdded({
        id: sigilId,
        name: genName,
        bio: genBio,
        status: 'generating',
        createdAt: new Date().toISOString(),
      })
    } else {
      onSigilUpdated(sigilId, { status: 'generating' })
    }

    // 立即重置表单，允许新输入
    setCapturedPhoto(null)
    setCurrentId(null)
    currentIdRef.current = null
    setName('')
    setBio('')

    // 后台生成
    try {
      const orderRes = await fetch('/api/sigil/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: genName,
          bio: genBio,
          userPhoto: genPhoto,
          aspectRatio: '1:1',
          style: 'totem',
          sessionId,
        }),
      })

      if (!orderRes.ok) throw new Error('Failed to create order')
      const { orderId } = await orderRes.json()

      const genRes = await fetch('/api/generate-sigil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: genName,
          bio: genBio,
          userPhoto: genPhoto,
          orderId,
          aspectRatio: '1:1',
          style: 'totem',
          sessionId,
        }),
      })

      if (!genRes.ok) throw new Error('Generation failed')
      const result = await genRes.json()

      onSigilUpdated(sigilId, {
        orderId,
        generatedImage: result.image,
        status: 'completed',
      })
    } catch (err) {
      console.error('Generation error:', err)
      onSigilUpdated(sigilId, { status: 'pending' })
    }
  }, [name, bio, capturedPhoto, sessionId, onSigilAdded, onSigilUpdated])

  // Init camera on mount
  useEffect(() => {
    if (cameraEnabled) {
      initCamera()
    }
  }, [cameraEnabled, initCamera])

  return (
    <div className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto">
      {/* Camera Preview */}
      <div className="relative aspect-video bg-bg-card rounded-xl overflow-hidden border border-primary/20">
        {cameraEnabled && !cameraError ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover scale-x-[-1]"
            playsInline
            muted
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <CameraOff className="w-12 h-12 mb-2" />
            <p>{cameraError || '摄像头已关闭'}</p>
          </div>
        )}

        {/* Camera controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleCamera}
            className="bg-black/50 backdrop-blur-sm border-primary/30"
          >
            {cameraEnabled ? <CameraOff className="w-4 h-4 mr-1" /> : <Camera className="w-4 h-4 mr-1" />}
            {cameraEnabled ? '关闭' : '开启'}
          </Button>
          {cameraEnabled && (
            <Button
              variant="default"
              size="sm"
              onClick={capturePhoto}
              className="gradient-gold-copper"
            >
              <Camera className="w-4 h-4 mr-1" />
              拍照
            </Button>
          )}
        </div>
      </div>

      {/* Input Form */}
      <div className="space-y-4">
        {/* 头像 + 姓名 */}
        <div className="flex items-center gap-4">
          {/* 左侧头像 */}
          <div className="shrink-0">
            {capturedPhoto ? (
              <button
                onClick={clearPhoto}
                className="relative group"
                title="点击重拍"
              >
                <img
                  src={capturedPhoto}
                  alt="Captured"
                  className="w-16 h-16 rounded-full border-2 border-primary object-cover group-hover:opacity-70 transition-opacity"
                />
                <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <RotateCcw className="w-5 h-5 text-white drop-shadow-lg" />
                </div>
              </button>
            ) : (
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center text-muted-foreground">
                <User className="w-6 h-6" />
              </div>
            )}
          </div>

          {/* 右侧姓名 */}
          <div className="flex-1">
            <label className="text-sm text-muted-foreground mb-1 block">
              玩家姓名 *
            </label>
            <Input
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="输入玩家姓名..."
              className="bg-bg-card border-primary/30 text-lg"
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">
            简介（可选）
          </label>
          <Textarea
            value={bio}
            onChange={e => handleBioChange(e.target.value)}
            placeholder="简单介绍一下这位玩家..."
            className="bg-bg-card border-primary/30 resize-none"
            rows={2}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleGenerate}
            disabled={!name.trim()}
            className="flex-1 gradient-gold-copper text-lg py-6"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            生成图腾
          </Button>

          {capturedPhoto && (
            <Button
              variant="outline"
              onClick={clearPhoto}
              className="border-primary/30"
            >
              <RotateCcw className="w-5 h-5 mr-1" />
              重拍
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground text-center">
          拍照可选，输入姓名即可生成
        </p>
      </div>
    </div>
  )
}
