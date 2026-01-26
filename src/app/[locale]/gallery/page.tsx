'use client'

import { ArrowLeft, Grid, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef } from 'react'

import { SPIRIT_INFO } from '@/components/mirror/facsAnalyzer'
import { Button } from '@/components/ui/button'
import { useSpiritHistory } from '@/hooks/useSpiritHistory'

export default function GalleryPage() {
  const t = useTranslations('Gallery')
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
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37] mx-auto mb-4" />
          <p className="text-white/60">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-sm border-b border-[#D4AF37]/20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('back')}
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-[#D4AF37]">
            <Grid className="w-5 h-5" />
            <h1 className="text-lg font-semibold">{t('title')}</h1>
          </div>
          <div className="text-white/40 text-sm">
            {historyData?.records.length ?? 0} {t('images')}
          </div>
        </div>
      </header>

      {/* Masonry Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {records.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/40">{t('empty')}</p>
          </div>
        ) : (
          <div
            className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3"
            style={{ columnFill: 'balance' }}
          >
            {records.map((record) => {
              const info = SPIRIT_INFO[record.spiritId as keyof typeof SPIRIT_INFO]
              return (
                <div
                  key={record.id}
                  className="break-inside-avoid mb-3 group cursor-pointer"
                  onClick={() => {
                    if (record.orderId) {
                      window.open(`/spirit/${record.orderId}`, '_blank')
                    }
                  }}
                >
                  <div className="relative rounded-lg overflow-hidden bg-black/30 border border-white/10 hover:border-[#D4AF37]/50 transition-all duration-300">
                    <img
                      src={record.generatedImage}
                      alt={record.spiritName || 'Generated'}
                      className="w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        {info && (
                          <div className="flex items-center gap-2">
                            <span
                              className="px-2 py-0.5 rounded-full text-xs text-white font-medium"
                              style={{ backgroundColor: info.color }}
                            >
                              {info.emoji} {info.nameEn}
                            </span>
                          </div>
                        )}
                        <p className="text-white/50 text-xs mt-1">
                          {new Date(record.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Infinite scroll trigger */}
        <div ref={loaderRef} className="py-8 flex justify-center">
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
