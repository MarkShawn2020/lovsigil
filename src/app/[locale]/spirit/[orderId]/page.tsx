'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import {
  AlertTriangle,
  ArrowRight,
  Box,
  Download,
  Frame,
  Image,
  Sparkles,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
type PrintOptionId = 'frame' | 'figurine'

interface PrintOption {
  id: PrintOptionId
  icon: React.ReactNode
  price: string
}

const PRINT_OPTIONS: PrintOption[] = [
  { id: 'frame', icon: <Frame className="w-8 h-8" />, price: '฿299' },
  { id: 'figurine', icon: <Box className="w-8 h-8" />, price: '฿599' },
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

  // 打印订单弹窗状态
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [selectedPrintOption, setSelectedPrintOption] = useState<PrintOptionId | null>(null)
  const [printForm, setPrintForm] = useState({ name: '', phone: '', address: '' })
  const [printSubmitting, setPrintSubmitting] = useState(false)

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

  // Handle print option click
  const handlePrintOption = (optionId: PrintOptionId) => {
    setSelectedPrintOption(optionId)
    setPrintDialogOpen(true)
  }

  // Submit print order
  const handlePrintSubmit = async () => {
    if (!printForm.name || !printForm.phone || !printForm.address) {
      alert(t('print_form_required'))
      return
    }
    setPrintSubmitting(true)
    try {
      // TODO: 发送订单到后端
      console.log('Print order:', { orderId, option: selectedPrintOption, ...printForm })
      alert(t('print_order_success'))
      setPrintDialogOpen(false)
      setPrintForm({ name: '', phone: '', address: '' })
    } catch {
      alert(t('print_order_error'))
    } finally {
      setPrintSubmitting(false)
    }
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#D4AF37] mb-2">
            {isGroup ? t('group_portrait') : t('spirit_portrait')}
          </h1>
          <p className="text-white/60">
            {order.spiritName}
          </p>
        </div>

        {/* Status Section - 非完成状态时保持居中 */}
        {(order.status === 'pending' || order.status === 'generating') && (
          <Card className="mb-8 bg-black/50 border-[#D4AF37]/20 max-w-xl mx-auto">
            <CardContent className="py-12 text-center">
              <div className="mb-6">
                {spiritInfo?.emoji ? (
                  <span className="text-6xl animate-pulse">{spiritInfo.emoji}</span>
                ) : (
                  <div className="w-16 h-16 mx-auto rounded-full border-2 border-[#D4AF37]/40 flex items-center justify-center animate-pulse">
                    <Sparkles className="w-8 h-8 text-[#D4AF37]" />
                  </div>
                )}
              </div>
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#D4AF37] border-t-transparent mx-auto" />
              <p className="text-white/80 text-lg mb-2">
                {order.status === 'pending' ? t('status_pending') : t('status_generating')}
              </p>
              <p className="text-white/40 text-sm">{t('generation_time')}</p>
            </CardContent>
          </Card>
        )}

        {/* Failed State */}
        {order.status === 'failed' && (
          <Card className="mb-8 bg-black/50 border-red-500/20 max-w-xl mx-auto">
            <CardContent className="py-12 text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="w-16 h-16 text-yellow-500" />
              </div>
              <p className="text-red-400 text-lg mb-2">{t('status_failed')}</p>
              <p className="text-white/40 text-sm">
                {(order.metadata as Record<string, string>)?.error || t('unknown_error')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Completed State - 左右布局 */}
        {order.status === 'completed' && order.generatedImage && (
          <div className="flex flex-col lg:flex-row gap-8 lg:items-start">
            {/* 左侧：图片预览区 */}
            <div className="lg:w-1/2 lg:sticky lg:top-4">
              {/* 原采集画像 + 生成结果对比 */}
              {order.userPhoto && (
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-white/40 text-xs mb-2">{t('original_photo')}</p>
                    <div
                      className="w-16 h-16 rounded-full overflow-hidden border-2"
                      style={{
                        borderColor: spiritInfo?.color || '#D4AF37',
                        background: `radial-gradient(circle, ${spiritInfo?.color || '#D4AF37'}40 0%, ${spiritInfo?.color || '#D4AF37'}20 100%)`,
                      }}
                    >
                      <img src={order.userPhoto} alt="Original" className="w-full h-full object-contain" />
                    </div>
                  </div>
                  <div className="text-white/30">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-white/40 text-xs mb-2">{t('spirit_result')}</p>
                    <div
                      className="w-16 h-16 rounded-full overflow-hidden border-2"
                      style={{ borderColor: spiritInfo?.color || '#D4AF37' }}
                    >
                      <img src={order.generatedImage} alt="Spirit" className="w-full h-full object-cover" />
                    </div>
                  </div>
                </div>
              )}

              {/* Result Image Card / Poster */}
              <Card className="bg-black/50 border-[#D4AF37]/20 overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative flex items-center justify-center">
                    {showPoster && poster ? (
                      posterLoading ? (
                        <div className="w-full aspect-[3/4] max-h-[60vh] flex items-center justify-center bg-black/30">
                          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#D4AF37] border-t-transparent" />
                        </div>
                      ) : (
                        <img src={poster} alt="Poster" className="w-full max-h-[60vh] object-contain" />
                      )
                    ) : (
                      <img
                        src={order.generatedImage}
                        alt={order.spiritName}
                        className="w-full max-h-[60vh] object-contain"
                      />
                    )}
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

              {/* 操作按钮组 - 在图片下方 */}
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                <Button
                  onClick={() => setShowPoster(!showPoster)}
                  className="bg-white/20 text-white border-2 border-white/50 hover:bg-white/30 hover:border-white/70 font-medium"
                >
                  <Image className="w-4 h-4 mr-1.5" />
                  {showPoster ? t('show_image') : t('show_poster')}
                </Button>

                {order.userPhoto && !showPoster && (
                  <Button
                    onClick={() => setIncludeOriginal(!includeOriginal)}
                    className="bg-white/20 text-white border-2 border-white/50 hover:bg-white/30 hover:border-white/70 font-medium"
                  >
                    {includeOriginal ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-1.5" />
                        {t('spirit_only')}
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4 mr-1.5" />
                        {t('with_original')}
                      </>
                    )}
                  </Button>
                )}

                <Button
                  onClick={() => downloadImage(
                    showPoster && poster ? poster : order.generatedImage!,
                    `lanna-spirit-${showPoster ? 'poster' : 'image'}-${order.spiritId}-${Date.now()}.png`
                  )}
                  className="text-white font-medium border-2 border-transparent hover:brightness-110"
                  style={{ backgroundColor: spiritInfo?.color || '#D4AF37' }}
                >
                  <Download className="w-5 h-5 mr-2" />
                  {t('download')}
                </Button>
              </div>
            </div>

            {/* 右侧：信息区 */}
            <div className="lg:w-1/2 space-y-6">

              {/* 分享二维码 */}
              <Card className="bg-black/50 border-[#D4AF37]/20">
                <CardContent className="py-6">
                  <h3 className="text-white/80 font-medium mb-4">{t('share_title')}</h3>
                  <div className="flex items-start gap-4">
                    <div className="bg-white rounded-xl p-2 shrink-0">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(shareUrl)}`}
                        alt="QR Code"
                        className="w-[100px] h-[100px]"
                      />
                    </div>
                    <p className="text-white/40 text-sm">{t('share_hint')}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Print Options Section */}
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">{t('print_title')}</h2>
                <p className="text-white/60 text-sm mb-4">{t('print_subtitle')}</p>

                <div className="grid grid-cols-2 gap-3">
                  {PRINT_OPTIONS.map((option) => {
                    const names: Record<PrintOptionId, string> = {
                      frame: t('print_frame'),
                      figurine: t('print_figurine'),
                    }
                    const descs: Record<PrintOptionId, string> = {
                      frame: t('print_frame_desc'),
                      figurine: t('print_figurine_desc'),
                    }

                    return (
                      <Card
                        key={option.id}
                        className="bg-black/30 border-white/10 hover:border-[#D4AF37]/50 transition-colors cursor-pointer group"
                        onClick={() => handlePrintOption(option.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="text-[#D4AF37] group-hover:scale-110 transition-transform">
                              {option.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-white font-medium text-sm">{names[option.id]}</h3>
                              <p className="text-white/40 text-xs truncate">{descs[option.id]}</p>
                            </div>
                            <div className="text-[#D4AF37] font-semibold text-sm">{option.price}</div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="text-white/30 text-sm pt-4">
                <p>{t('powered_by')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer for non-completed states */}
        {order.status !== 'completed' && (
          <div className="text-center text-white/30 text-sm">
            <p>{t('powered_by')}</p>
          </div>
        )}
      </div>

      {/* 打印订单弹窗 */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="bg-[#1a1a2e] border-[#D4AF37]/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#D4AF37]">
              {selectedPrintOption === 'frame' ? t('print_frame') : t('print_figurine')}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {t('print_dialog_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white/80">{t('print_form_name')}</Label>
              <Input
                id="name"
                value={printForm.name}
                onChange={(e) => setPrintForm({ ...printForm, name: e.target.value })}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                placeholder={t('print_form_name_placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white/80">{t('print_form_phone')}</Label>
              <Input
                id="phone"
                value={printForm.phone}
                onChange={(e) => setPrintForm({ ...printForm, phone: e.target.value })}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                placeholder={t('print_form_phone_placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address" className="text-white/80">{t('print_form_address')}</Label>
              <Textarea
                id="address"
                value={printForm.address}
                onChange={(e) => setPrintForm({ ...printForm, address: e.target.value })}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-[80px]"
                placeholder={t('print_form_address_placeholder')}
              />
              <p className="text-white/40 text-xs">{t('print_form_delivery_note')}</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setPrintDialogOpen(false)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handlePrintSubmit}
              disabled={printSubmitting}
              className="bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90"
            >
              {printSubmitting ? t('submitting') : t('print_submit')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
