'use client'

import type { RenderComponentProps } from 'masonic'
import { ArrowLeft, Download, Grid, Loader2, Sparkles } from 'lucide-react'
import { Masonry } from 'masonic'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { downloadImage } from '@/components/mirror/posterGenerator'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import type { SigilHistoryRecord } from '@/hooks/useSpiritHistory'
import { useSpiritHistory } from '@/hooks/useSpiritHistory'

// Supabase Storage 图片变换
function getOptimizedImageUrl(url: string, width: number): string {
  if (!url || !url.includes('supabase.co/storage')) return url
  const base = url.replace('/object/public/', '/render/image/public/')
  // resize=contain 保持原始比例缩放
  return `${base}?width=${width}&resize=contain`
}

// 全局缓存：使用 record.id 作为 key（绝对稳定）
const loadedImagesCache = new Set<number>()

// 扩展 props 类型以支持 onSelect 回调
interface GalleryCardProps extends RenderComponentProps<SigilHistoryRecord> {
  onSelect?: (record: SigilHistoryRecord) => void
}

function GalleryCard({ data: record, index, onSelect }: GalleryCardProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const isMobile = useIsMobile()

  // 图片 URL - 使用统一宽度避免 SSR/Hydration 不一致
  const displayUrl = getOptimizedImageUrl(record.generatedImage, 280)

  // 使用比例字符串转换为数字
  const aspectRatio = record.ratio === '1:1' ? 1 : record.ratio === '4:3' ? 1.333 : record.ratio === '16:9' ? 1.778 : record.ratio === '9:16' ? 0.5625 : 0.75

  // 使用 record.id 作为缓存 key（绝对稳定）
  const isFromCache = loadedImagesCache.has(record.id)
  const [loaded, setLoaded] = useState(isFromCache)

  // 双重保险：在 DOM 更新后立即检查浏览器图片缓存
  useLayoutEffect(() => {
    const img = imgRef.current
    if (!loaded && img?.complete && img.naturalWidth > 0) {
      loadedImagesCache.add(record.id)
      setLoaded(true)
    }
  }, [loaded, record.id])

  const handleImageLoad = useCallback(() => {
    loadedImagesCache.add(record.id)
    setLoaded(true)
  }, [record.id])

  const handleClick = useCallback(() => {
    onSelect?.(record)
  }, [record, onSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect?.(record)
    }
  }, [record, onSelect])

  return (
    <div
      role="button"
      tabIndex={0}
      className="group cursor-pointer touch-manipulation"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* 固定比例容器 */}
      <div
        className="relative rounded-lg overflow-hidden bg-white/5 border border-white/10 active:border-primary/50 sm:hover:border-primary/50 transition-all duration-200"
        style={{ aspectRatio }}
      >
        {/* 骨架屏 shimmer */}
        {!loaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/15 to-white/5 bg-[length:200%_100%] animate-shimmer" />
        )}

        {/* 图片 - 缓存的直接显示，新加载的用过渡动画 */}
        <img
          ref={imgRef}
          src={displayUrl}
          alt={record.name || 'Sigil'}
          className={`absolute inset-0 w-full h-full object-cover sm:group-hover:scale-105 ${
            loaded
              ? 'opacity-100'
              : 'opacity-0 transition-opacity duration-300'
          }`}
          loading={index < 10 ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={index < 4 ? 'high' : 'auto'}
          onLoad={handleImageLoad}
        />

        {/* 信息覆盖层 */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
          <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs text-white font-medium bg-primary">
                ✨ {isMobile ? '' : record.name}
              </span>
            </div>
            {!isMobile && (
              <p className="text-white/50 text-xs mt-1">
                {new Date(record.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GalleryPage() {
  const t = useTranslations('Gallery')
  const isMobile = useIsMobile()
  const router = useRouter()
  const {
    data: historyData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useSpiritHistory()

  const records = useMemo(() => historyData?.records ?? [], [historyData?.records])
  const loaderRef = useRef<HTMLDivElement>(null)

  // 悬浮窗状态
  const [selectedRecord, setSelectedRecord] = useState<SigilHistoryRecord | null>(null)

  // 处理"我要做同款"
  const handleMakeSame = useCallback(() => {
    // 跳转到主页生成新的 Sigil
    router.push('/')
  }, [router])

  // 稳定的布局参数（首次确定后不变，避免 hydration 导致重新布局）
  const layoutRef = useRef<{ columnWidth: number; columnGutter: number } | null>(null)
  if (layoutRef.current === null && typeof window !== 'undefined') {
    const mobile = window.innerWidth < 768
    layoutRef.current = {
      columnWidth: mobile ? 150 : 220,
      columnGutter: mobile ? 8 : 12,
    }
  }
  const columnWidth = layoutRef.current?.columnWidth ?? 220
  const columnGutter = layoutRef.current?.columnGutter ?? 12

  // 无限滚动：IntersectionObserver
  useEffect(() => {
    const loader = loaderRef.current
    if (!loader) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(loader)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  if (isLoading) {
    return (
      <div className="min-h-screen min-h-dvh bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-white/60">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen min-h-dvh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-sm border-b border-primary/20 safe-area-top">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <Link href="/" className="touch-manipulation">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 h-10 px-2 sm:px-3">
              <ArrowLeft className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('back')}</span>
            </Button>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2 text-primary">
            <Grid className="w-4 h-4 sm:w-5 sm:h-5" />
            <h1 className="text-base sm:text-lg font-semibold">{t('title')}</h1>
          </div>
          <div className="text-white/40 text-xs sm:text-sm">
            {records.length} {t('images')}
          </div>
        </div>
      </header>

      {/* Masonry Grid */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {records.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/40">{t('empty')}</p>
          </div>
        ) : (
          <Masonry
            items={records}
            columnGutter={columnGutter}
            columnWidth={columnWidth}
            overscanBy={5}
            itemKey={(item) => item.id}
            render={(props) => <GalleryCard {...props} onSelect={setSelectedRecord} />}
          />
        )}

        {/* Loading indicator + infinite scroll trigger */}
        <div ref={loaderRef} className="py-6 sm:py-8 flex justify-center">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-white/60">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t('loading_more')}</span>
            </div>
          )}
          {!hasNextPage && records.length > 0 && (
            <p className="text-white/30 text-sm">{t('end')}</p>
          )}
        </div>
      </main>

      {/* 图片详情悬浮窗 */}
      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="bg-card border-primary/30 p-0 max-w-lg sm:max-w-2xl overflow-hidden" showCloseButton={false}>
          {selectedRecord && (
            <div className="flex flex-col">
              {/* 大图 */}
              <div className="relative">
                <img
                  src={selectedRecord.generatedImage}
                  alt={selectedRecord.name || 'Sigil'}
                  className="w-full max-h-[60vh] object-contain bg-black"
                />
                {/* 关闭按钮 */}
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                >
                  <span className="text-xl leading-none">&times;</span>
                </button>
                {/* Sigil 标签 */}
                <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full backdrop-blur-sm bg-primary/80">
                  <span className="text-white font-medium text-sm">
                    ✨ {selectedRecord.name}
                  </span>
                </div>
              </div>

              {/* 信息和操作 */}
              <div className="p-4 space-y-4">
                {/* 日期和详情链接 */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">
                    {new Date(selectedRecord.createdAt).toLocaleString()}
                  </span>
                  {selectedRecord.orderId && (
                    <Link
                      href={`/sigil/${selectedRecord.orderId}`}
                      className="text-primary hover:underline"
                      target="_blank"
                    >
                      {t('view_detail')}
                    </Link>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => downloadImage(
                      selectedRecord.generatedImage,
                      `lovsigil-${selectedRecord.name}-${Date.now()}.png`
                    )}
                    variant="outline"
                    className="flex-1 border-white/30 text-white hover:bg-white/10"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {t('download')}
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedRecord(null)
                      handleMakeSame()
                    }}
                    className="flex-1 text-white font-medium bg-primary hover:bg-primary/90"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t('make_same')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
