'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { downloadImage, generateLannaPoster } from '@/components/mirror/posterGenerator'
import { SPIRIT_INFO } from '@/components/mirror/facsAnalyzer'

type OrderStatus = 'pending' | 'generating' | 'completed' | 'failed'

interface OrderData {
  orderId: string
  spiritId: string
  spiritName: string
  userPhoto: string | null
  generatedImage: string | null
  status: OrderStatus
  metadata: Record<string, unknown> | null
  createdAt: string
}

// Print product option IDs
type PrintOptionId = 'tattoo' | 'frame' | 'figurine' | 'postcard'

interface PrintOption {
  id: PrintOptionId
  emoji: string
  price: string
}

const PRINT_OPTIONS: PrintOption[] = [
  { id: 'tattoo', emoji: '🎨', price: '¥29' },
  { id: 'frame', emoji: '🖼️', price: '¥79' },
  { id: 'figurine', emoji: '🗿', price: '¥199' },
  { id: 'postcard', emoji: '💌', price: '¥19' },
]

export default function SpiritOrderPage() {
  const t = useTranslations('SpiritOrder')
  const params = useParams()
  const orderId = params.orderId as string

  const [order, setOrder] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 海报相关状态
  const [poster, setPoster] = useState<string | null>(null)
  const [posterLoading, setPosterLoading] = useState(false)
  const [includeOriginal, setIncludeOriginal] = useState(false)
  const [showPoster, setShowPoster] = useState(false)

  // Fetch order data with polling for pending/generating status
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    async function fetchOrder() {
      try {
        const res = await fetch(`/api/spirit/${orderId}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError(t('order_not_found'))
          } else {
            setError(t('fetch_error'))
          }
          setLoading(false)
          return
        }

        const data = await res.json()
        setOrder(data)
        setLoading(false)

        // If still generating, keep polling
        if (data.status === 'pending' || data.status === 'generating') {
          if (!intervalId) {
            intervalId = setInterval(fetchOrder, 2000) // Poll every 2 seconds
          }
        } else {
          // Stop polling when done
          if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
          }
        }
      } catch {
        setError(t('fetch_error'))
        setLoading(false)
      }
    }

    fetchOrder()

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [orderId, t])

  // 生成海报
  useEffect(() => {
    if (!order?.generatedImage || order.status !== 'completed') {
      setPoster(null)
      return
    }

    setPosterLoading(true)
    generateLannaPoster({
      originalImage: order.userPhoto || '',
      generatedImage: order.generatedImage,
      spiritId: order.spiritId,
      includeOriginal: includeOriginal && !!order.userPhoto,
    })
      .then(setPoster)
      .catch(console.error)
      .finally(() => setPosterLoading(false))
  }, [order?.generatedImage, order?.userPhoto, order?.spiritId, order?.status, includeOriginal])

  // Handle print option click - for now just show coming soon
  const handlePrintOption = (optionId: string) => {
    alert(t('coming_soon'))
    console.log('Print option selected:', optionId)
  }

  // 获取当前页面 URL 用于分享
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#D4AF37] border-t-transparent mx-auto" />
          <p className="text-white/60">{t('loading')}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-black/50 border-white/10">
          <CardHeader className="text-center">
            <CardTitle className="text-red-400">{t('error')}</CardTitle>
            <CardDescription className="text-white/60">{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!order) return null

  const spiritInfo = SPIRIT_INFO[order.spiritId as keyof typeof SPIRIT_INFO]
  const isGroup = order.spiritId === 'group'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#D4AF37] mb-2">
            {isGroup ? t('group_portrait') : t('spirit_portrait')}
          </h1>
          <p className="text-white/60">
            {order.spiritName}
          </p>
        </div>

        {/* Status Section */}
        {(order.status === 'pending' || order.status === 'generating') && (
          <Card className="mb-8 bg-black/50 border-[#D4AF37]/20">
            <CardContent className="py-12 text-center">
              {/* Animated Spirit Icon */}
              <div className="mb-6">
                <span className="text-6xl animate-pulse">
                  {spiritInfo?.emoji || '🔮'}
                </span>
              </div>

              {/* Loading Spinner */}
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#D4AF37] border-t-transparent mx-auto" />

              <p className="text-white/80 text-lg mb-2">
                {order.status === 'pending' ? t('status_pending') : t('status_generating')}
              </p>
              <p className="text-white/40 text-sm">
                {t('generation_time')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Failed State */}
        {order.status === 'failed' && (
          <Card className="mb-8 bg-black/50 border-red-500/20">
            <CardContent className="py-12 text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <p className="text-red-400 text-lg mb-2">{t('status_failed')}</p>
              <p className="text-white/40 text-sm">
                {(order.metadata as Record<string, string>)?.error || t('unknown_error')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Completed State - Result Image */}
        {order.status === 'completed' && order.generatedImage && (
          <>
            {/* 原采集画像 + 生成结果对比 */}
            {order.userPhoto && (
              <div className="flex items-center justify-center gap-4 mb-6">
                {/* 原采集画像 */}
                <div className="text-center">
                  <p className="text-white/40 text-xs mb-2">{t('original_photo')}</p>
                  <div
                    className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2"
                    style={{
                      borderColor: spiritInfo?.color || '#D4AF37',
                      background: `radial-gradient(circle, ${spiritInfo?.color || '#D4AF37'}40 0%, ${spiritInfo?.color || '#D4AF37'}20 100%)`,
                    }}
                  >
                    <img src={order.userPhoto} alt="Original" className="w-full h-full object-contain" />
                  </div>
                </div>
                {/* 箭头 */}
                <div className="text-white/30 text-2xl">→</div>
                {/* 生成结果缩略图 */}
                <div className="text-center">
                  <p className="text-white/40 text-xs mb-2">{t('spirit_result')}</p>
                  <div
                    className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2"
                    style={{ borderColor: spiritInfo?.color || '#D4AF37' }}
                  >
                    <img src={order.generatedImage} alt="Spirit" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            )}

            {/* Result Image Card / Poster */}
            <Card className="mb-6 bg-black/50 border-[#D4AF37]/20 overflow-hidden">
              <CardContent className="p-0">
                <div className="relative">
                  {showPoster && poster ? (
                    // 显示海报
                    posterLoading ? (
                      <div className="w-full aspect-[3/4] flex items-center justify-center bg-black/30">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#D4AF37] border-t-transparent" />
                      </div>
                    ) : (
                      <img
                        src={poster}
                        alt="Poster"
                        className="w-full object-contain"
                      />
                    )
                  ) : (
                    // 显示原图
                    <img
                      src={order.generatedImage}
                      alt={order.spiritName}
                      className="w-full aspect-square object-cover"
                    />
                  )}

                  {/* Spirit Badge */}
                  {spiritInfo && !showPoster && (
                    <div
                      className="absolute bottom-4 left-4 px-4 py-2 rounded-full backdrop-blur-sm"
                      style={{ backgroundColor: `${spiritInfo.color}CC` }}
                    >
                      <span className="text-white font-medium">
                        {spiritInfo.emoji} {spiritInfo.name}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 操作按钮组 */}
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {/* 切换海报/原图 */}
              <Button
                onClick={() => setShowPoster(!showPoster)}
                className="bg-white/20 text-white border-2 border-white/50 hover:bg-white/30 hover:border-white/70 font-medium px-6"
              >
                🖼️ {showPoster ? t('show_image') : t('show_poster')}
              </Button>

              {/* 切换海报模式（仅在非海报模式且有原图时显示） */}
              {order.userPhoto && !showPoster && (
                <Button
                  onClick={() => setIncludeOriginal(!includeOriginal)}
                  className="bg-white/20 text-white border-2 border-white/50 hover:bg-white/30 hover:border-white/70 font-medium px-6"
                >
                  {includeOriginal ? `✨ ${t('spirit_only')}` : `👤 ${t('with_original')}`}
                </Button>
              )}

              {/* 下载按钮 */}
              <Button
                onClick={() => downloadImage(
                  showPoster && poster ? poster : order.generatedImage!,
                  `lanna-spirit-${showPoster ? 'poster' : 'image'}-${order.spiritId}-${Date.now()}.png`
                )}
                className="text-white font-medium px-6 border-2 border-transparent hover:brightness-110"
                style={{ backgroundColor: spiritInfo?.color || '#D4AF37' }}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t('download')}
              </Button>
            </div>

            {/* 分享二维码 */}
            <Card className="mb-8 bg-black/50 border-[#D4AF37]/20">
              <CardContent className="py-6">
                <h3 className="text-center text-white/80 font-medium mb-4">{t('share_title')}</h3>
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white rounded-xl p-3">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}`}
                      alt="QR Code"
                      className="w-[150px] h-[150px]"
                    />
                  </div>
                  <p className="text-white/40 text-xs text-center max-w-xs">
                    {t('share_hint')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Print Options Section */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4 text-center">
                {t('print_title')}
              </h2>
              <p className="text-white/60 text-center mb-6">
                {t('print_subtitle')}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {PRINT_OPTIONS.map((option) => {
                  const names: Record<PrintOptionId, string> = {
                    tattoo: t('print_tattoo'),
                    frame: t('print_frame'),
                    figurine: t('print_figurine'),
                    postcard: t('print_postcard'),
                  }
                  const descs: Record<PrintOptionId, string> = {
                    tattoo: t('print_tattoo_desc'),
                    frame: t('print_frame_desc'),
                    figurine: t('print_figurine_desc'),
                    postcard: t('print_postcard_desc'),
                  }

                  return (
                    <Card
                      key={option.id}
                      className="bg-black/30 border-white/10 hover:border-[#D4AF37]/50 transition-colors cursor-pointer group"
                      onClick={() => handlePrintOption(option.id)}
                    >
                      <CardContent className="p-4 text-center">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
                          {option.emoji}
                        </div>
                        <h3 className="text-white font-medium mb-1">
                          {names[option.id]}
                        </h3>
                        <p className="text-white/40 text-xs mb-2">
                          {descs[option.id]}
                        </p>
                        <div className="text-[#D4AF37] font-semibold">
                          {option.price}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="text-center text-white/30 text-sm">
          <p>{t('powered_by')}</p>
        </div>
      </div>
    </div>
  )
}
