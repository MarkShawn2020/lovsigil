'use client'

import {
  AlertTriangle,
  ArrowRight,
  Box,
  Download,
  Frame,
  Image,
  Smartphone,
  Sparkles,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'

import { useEffect, useState } from 'react'
import { SPIRIT_INFO } from '@/components/mirror/facsAnalyzer'
import { downloadImage, generateLannaPoster } from '@/components/mirror/posterGenerator'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QRCode } from '@/components/ui/qr-code'
import { Textarea } from '@/components/ui/textarea'

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
      const res = await fetch('/api/spirit/print-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          productType: selectedPrintOption,
          name: printForm.name,
          phone: printForm.phone,
          address: printForm.address,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit order')
      }

      alert(t('print_order_success'))
      setPrintDialogOpen(false)
      setPrintForm({ name: '', phone: '', address: '' })
    } catch (err) {
      console.error('Print order error:', err)
      alert(t('print_order_error'))
    } finally {
      setPrintSubmitting(false)
    }
  }

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
          <Card className="mb-8 bg-black/50 border-[#D4AF37]/20 max-w-md mx-auto">
            <CardContent className="py-12 px-8">
              <div className="flex flex-col items-center">
                <div className="mb-6">
                  {spiritInfo?.emoji ? (
                    <span className="text-6xl animate-pulse">{spiritInfo.emoji}</span>
                  ) : (
                    <div className="w-16 h-16 rounded-full border-2 border-[#D4AF37]/40 flex items-center justify-center animate-pulse">
                      <Sparkles className="w-8 h-8 text-[#D4AF37]" />
                    </div>
                  )}
                </div>
                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#D4AF37] border-t-transparent" />
                <p className="text-white/80 text-lg mb-2 text-center">
                  {order.status === 'pending' ? t('status_pending') : t('status_generating')}
                </p>
                <p className="text-white/40 text-sm text-center">{t('generation_time')}</p>

                {/* QR Code for mobile viewing */}
                <div className="mt-8 pt-6 border-t border-white/10 w-full">
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-white rounded-lg p-1.5">
                      <QRCode size={100} />
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                        <p className="text-white/70 text-sm">{t('qr_scan_mobile')}</p>
                      </div>
                      <p className="text-white/40 text-xs">{t('qr_scan_wait')}</p>
                    </div>
                  </div>
                </div>
              </div>
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
              <p className="text-white/40 text-sm mb-6">
                {(order.metadata as Record<string, string>)?.error || t('unknown_error')}
              </p>

              {/* QR Code for sharing/retry */}
              <div className="pt-6 border-t border-white/10">
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-white rounded-lg p-1.5">
                    <QRCode size={80} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-white/50" />
                    <p className="text-white/50 text-xs">{t('qr_scan_share')}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed State - 左右布局 */}
        {order.status === 'completed' && order.generatedImage && (
          <div className="flex flex-col lg:flex-row gap-8 lg:items-start">
            {/* 左侧：图片预览区 */}
            <div className="lg:w-1/2 lg:sticky lg:top-4">
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
              {/* 原采集画像 + 生成结果对比 */}
              {order.userPhoto && (
                <div className="flex items-center justify-center gap-4 p-4 bg-black/30 rounded-xl border border-white/10">
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

              {/* Print Options Section */}
              <Card className="bg-black/50 border-[#D4AF37]/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white">{t('print_title')}</CardTitle>
                  <CardDescription className="text-white/60">{t('print_subtitle')}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
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
                        <div
                          key={option.id}
                          className="p-3 rounded-lg bg-black/30 border border-white/10 hover:border-[#D4AF37]/50 transition-colors cursor-pointer group"
                          onClick={() => handlePrintOption(option.id)}
                        >
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
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* 分享二维码 */}
              <div className="flex items-center gap-3 p-4 bg-black/30 rounded-lg border border-white/10">
                <div className="bg-white rounded-lg p-2 shrink-0">
                  <QRCode size={120} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                    <p className="text-white/80 text-sm font-medium">{t('qr_scan_title')}</p>
                  </div>
                  <p className="text-white/50 text-xs">{t('qr_scan_hint')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Footer */}
        <div className="text-center text-white/30 text-sm mt-8 pb-4">
          <p>{t('powered_by')}</p>
        </div>
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
              className="border-white/40 text-white/80 bg-white/5 hover:bg-white/10 hover:text-white"
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
