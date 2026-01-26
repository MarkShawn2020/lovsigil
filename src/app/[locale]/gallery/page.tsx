'use client'

import { ArrowLeft, Grid, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useCallback, useEffect, useRef } from 'react'

import { SPIRIT_INFO } from '@/components/mirror/facsAnalyzer'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { useSpiritHistory } from '@/hooks/useSpiritHistory'

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

  const records = historyData?.records ?? []
  const loaderRef = useRef<HTMLDivElement>(null)

  // Infinite scroll with IntersectionObserver
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries
      if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  )

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '200px',
      threshold: 0,
    })

    if (loaderRef.current) {
      observer.observe(loaderRef.current)
    }

    return () => observer.disconnect()
  }, [handleObserver])

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
      {/* Header - 移动端优化：更紧凑的布局 */}
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
            {historyData?.records.length ?? 0} {t('images')}
          </div>
        </div>
      </header>

      {/* Masonry Grid - 移动端优化 */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {records.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/40">{t('empty')}</p>
          </div>
        ) : (
          <div
            className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-2 sm:gap-3"
            style={{ columnFill: 'balance' }}
          >
            {records.map((record, index) => {
              const info = SPIRIT_INFO[record.spiritId as keyof typeof SPIRIT_INFO]
              return (
                <div
                  key={record.id}
                  role="button"
                  tabIndex={0}
                  className="break-inside-avoid mb-2 sm:mb-3 group cursor-pointer touch-manipulation"
                  style={{
                    // 使用 content-visibility 优化长列表性能
                    contentVisibility: index > 20 ? 'auto' : 'visible',
                    containIntrinsicSize: index > 20 ? '0 200px' : undefined,
                  }}
                  onClick={() => {
                    if (record.orderId) {
                      window.open(`/spirit/${record.orderId}`, '_blank')
                    }
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && record.orderId) {
                      e.preventDefault()
                      window.open(`/spirit/${record.orderId}`, '_blank')
                    }
                  }}
                >
                  <div className="relative rounded-lg overflow-hidden bg-black/30 border border-white/10 active:border-[#D4AF37]/50 sm:hover:border-[#D4AF37]/50 transition-all duration-200">
                    <img
                      src={record.generatedImage}
                      alt={record.spiritName || 'Generated'}
                      className="w-full object-cover sm:group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      decoding="async"
                    />
                    {/* 移动端：始终显示标签；桌面端：hover 显示 */}
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
            })}
          </div>
        )}

        {/* Infinite scroll trigger */}
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
