'use client'

import type { RenderComponentProps } from 'masonic'
import { ArrowLeft, Grid, Loader2 } from 'lucide-react'
import { Masonry } from 'masonic'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { SPIRIT_INFO } from '@/components/mirror/facsAnalyzer'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import type { SpiritHistoryRecord } from '@/hooks/useSpiritHistory'
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

function GalleryCard({ data: record, index }: RenderComponentProps<SpiritHistoryRecord>) {
  const imgRef = useRef<HTMLImageElement>(null)
  const isMobile = useIsMobile()
  const info = SPIRIT_INFO[record.spiritId as keyof typeof SPIRIT_INFO]

  // 图片 URL - 使用统一宽度避免 SSR/Hydration 不一致
  const displayUrl = getOptimizedImageUrl(record.generatedImage, 280)

  // 使用真实比例或默认 3:4
  const aspectRatio = record.aspectRatio ?? 0.75

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
    if (record.orderId) {
      window.open(`/spirit/${record.orderId}`, '_blank')
    }
  }, [record.orderId])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && record.orderId) {
      e.preventDefault()
      window.open(`/spirit/${record.orderId}`, '_blank')
    }
  }, [record.orderId])

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
        className="relative rounded-lg overflow-hidden bg-white/5 border border-white/10 active:border-[#D4AF37]/50 sm:hover:border-[#D4AF37]/50 transition-all duration-200"
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
          alt={record.spiritName || 'Generated'}
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
            {info && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span
                  className="px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs text-white font-medium"
                  style={{ backgroundColor: info.color }}
                >
                  {info.emoji} {isMobile ? '' : info.nameEn}
                </span>
              </div>
            )}
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
  const {
    data: historyData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useSpiritHistory()

  const records = useMemo(() => historyData?.records ?? [], [historyData?.records])
  const loaderRef = useRef<HTMLDivElement>(null)

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
      <div className="min-h-screen min-h-dvh bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37] mx-auto mb-4" />
          <p className="text-white/60">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen min-h-dvh bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-sm border-b border-[#D4AF37]/20 safe-area-top">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <Link href="/" className="touch-manipulation">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 h-10 px-2 sm:px-3">
              <ArrowLeft className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('back')}</span>
            </Button>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[#D4AF37]">
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
            render={GalleryCard}
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
    </div>
  )
}
