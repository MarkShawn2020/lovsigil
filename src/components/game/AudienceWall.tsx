'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
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

  // 计算最优列数和行数，使所有项目适应屏幕
  const { columns, rows } = useMemo(() => {
    const count = sigils.length
    if (count <= 1) return { columns: 1, rows: 1 }
    if (count <= 2) return { columns: 2, rows: 1 }
    if (count <= 4) return { columns: 2, rows: 2 }
    if (count <= 6) return { columns: 3, rows: 2 }
    if (count <= 9) return { columns: 3, rows: 3 }
    if (count <= 12) return { columns: 4, rows: 3 }
    if (count <= 16) return { columns: 4, rows: 4 }
    if (count <= 20) return { columns: 5, rows: 4 }
    if (count <= 25) return { columns: 5, rows: 5 }
    const cols = 6
    return { columns: cols, rows: Math.ceil(count / cols) }
  }, [sigils.length])

  // Highlight new sigil
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
        <h3 className="text-lg font-medium text-foreground mb-2">玩家墙</h3>
        <p className="text-center text-sm">
          生成的图腾将在这里展示
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
          玩家墙
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {sigils.filter(s => s.status === 'completed').length} 位
          </span>
        </h2>
      </div>

      {/* Grid */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
      >
        <div
          className="h-full grid"
          style={{
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
        >
          {sigils.map((sigil, index) => (
            <div
              key={sigil.id}
              className={`
                relative bg-bg-deep overflow-hidden h-full group
                transition-all duration-300
                ${highlightedId === sigil.id ? 'ring-2 ring-primary z-10' : ''}
              `}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              {sigil.status === 'completed' && sigil.generatedImage ? (
                <img
                  src={sigil.generatedImage}
                  alt={sigil.name}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              ) : sigil.status === 'generating' ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-3 animate-pulse">
                  {sigil.userPhoto ? (
                    <img
                      src={sigil.userPhoto}
                      alt={sigil.name}
                      className="w-16 h-16 rounded-full border-2 border-primary object-cover mb-3"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/20 mb-3" />
                  )}
                  <h4 className="font-bold text-white text-center">{sigil.name}</h4>
                  {sigil.bio && (
                    <p className="text-xs text-white/60 text-center mt-1 line-clamp-2">{sigil.bio}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-primary">
                    <Spinner className="w-4 h-4" />
                    <span className="text-xs">生成中...</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-3">
                  {sigil.userPhoto ? (
                    <img
                      src={sigil.userPhoto}
                      alt={sigil.name}
                      className="w-16 h-16 rounded-full border-2 border-dashed border-primary/30 object-cover mb-3"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center mb-3">
                      <Sparkles className="w-6 h-6 text-primary/30" />
                    </div>
                  )}
                  <h4 className="font-medium text-white/70 text-center">{sigil.name}</h4>
                  {sigil.bio && (
                    <p className="text-xs text-white/40 text-center mt-1 line-clamp-2">{sigil.bio}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">等待生成</p>
                </div>
              )}

              {/* Hover overlay with info */}
              <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2">
                {sigil.userPhoto && (
                  <img
                    src={sigil.userPhoto}
                    alt={sigil.name}
                    className="w-12 h-12 rounded-full border-2 border-primary object-cover mb-2"
                  />
                )}
                <h4 className="font-bold text-white text-center">{sigil.name}</h4>
                {sigil.bio && (
                  <p className="text-xs text-white/70 text-center mt-1 line-clamp-2">{sigil.bio}</p>
                )}
              </div>

              {/* New badge */}
              {highlightedId === sigil.id && (
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full font-medium animate-pulse">
                  NEW
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
