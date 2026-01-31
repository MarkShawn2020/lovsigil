'use client'

import { useEffect, useRef, useState } from 'react'
import { Users, Sparkles } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import type { AudienceSigil } from './GameModeLayout'

interface AudienceWallProps {
  sigils: AudienceSigil[]
  isLoading: boolean
}

export function AudienceWall({ sigils, isLoading }: AudienceWallProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
  const prevLengthRef = useRef(sigils.length)

  // Auto-scroll and highlight when new sigil added
  useEffect(() => {
    if (sigils.length <= prevLengthRef.current) {
      prevLengthRef.current = sigils.length
      return
    }

    const newest = sigils[0]
    if (!newest) {
      prevLengthRef.current = sigils.length
      return
    }

    setHighlightedId(newest.id)

    // Scroll to top
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // Remove highlight after animation
    const timer = setTimeout(() => setHighlightedId(null), 2000)
    prevLengthRef.current = sigils.length
    return () => clearTimeout(timer)
  }, [sigils.length, sigils[0]?.id])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    )
  }

  if (sigils.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Users className="w-12 h-12 text-primary/50" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">观众墙</h3>
        <p className="text-center text-sm">
          还没有观众图腾<br />
          在左侧拍照开始吧!
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-primary/10">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          观众墙
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {sigils.filter(s => s.status === 'completed').length} 位
          </span>
        </h2>
      </div>

      {/* Grid */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4"
      >
        <div className="grid grid-cols-3 gap-3">
          {sigils.map((sigil, index) => (
            <div
              key={sigil.id}
              className={`
                relative bg-bg-card rounded-lg overflow-hidden border
                transition-all duration-500 ease-out
                ${highlightedId === sigil.id
                  ? 'border-primary shadow-lg shadow-primary/30 scale-105 z-10'
                  : 'border-primary/10 hover:border-primary/30'
                }
              `}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              {/* Sigil Image / Placeholder */}
              <div className="aspect-square relative bg-bg-deep">
                {sigil.status === 'completed' && sigil.generatedImage ? (
                  <img
                    src={sigil.generatedImage}
                    alt={sigil.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : sigil.status === 'generating' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <Spinner className="w-8 h-8 text-primary" />
                    <p className="text-xs text-muted-foreground mt-2">生成中...</p>
                  </div>
                ) : (
                  // pending status
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <Sparkles className="w-8 h-8 text-primary/30" />
                    <p className="text-xs text-muted-foreground mt-2">
                      等待生成
                    </p>
                  </div>
                )}

                {/* New badge */}
                {highlightedId === sigil.id && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full font-medium animate-pulse">
                    NEW
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3 flex items-center gap-3 bg-black/40">
                {sigil.userPhoto && (
                  <img
                    src={sigil.userPhoto}
                    alt={sigil.name}
                    className="w-10 h-10 rounded-full border-2 border-primary/50 object-cover shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-base text-white truncate">
                    {sigil.name}
                  </h4>
                  {sigil.bio && (
                    <p className="text-sm text-white/70 truncate">
                      {sigil.bio}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
