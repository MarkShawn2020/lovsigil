'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Users } from 'lucide-react'
import { GameGenerator } from './GameGenerator'
import { AudienceWall } from './AudienceWall'

export interface AudienceSigil {
  id: number
  orderId?: string
  name: string
  bio?: string
  userPhoto?: string
  generatedImage?: string
  status: 'pending' | 'generating' | 'completed'
  createdAt: string
}

export function GameModeLayout() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionParam = searchParams.get('session')

  // 如果 URL 没有 session 参数，生成新的并跳转
  const sessionIdRef = useRef<string | null>(null)
  if (sessionIdRef.current === null) {
    sessionIdRef.current = sessionParam || `game-${Date.now()}`
  }
  const sessionId = sessionIdRef.current

  // 跳转到带 session 的 URL
  useEffect(() => {
    if (!sessionParam) {
      router.replace(`/game?session=${sessionId}`)
    }
  }, [sessionParam, sessionId, router])

  const [sigils, setSigils] = useState<AudienceSigil[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load existing sigils for this session
  const loadSessionSigils = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/sigils?session=${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        setSigils((data.sigils || []).map((s: any) => ({ ...s, status: 'completed' })))
      }
    } catch (err) {
      console.error('Failed to load session sigils:', err)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    loadSessionSigils()
  }, [loadSessionSigils])

  // Called when photo is captured - add placeholder to wall
  const handleSigilAdded = useCallback((newSigil: AudienceSigil) => {
    setSigils(prev => [newSigil, ...prev])
  }, [])

  // Called when sigil info is updated (name, bio, status, image)
  const handleSigilUpdated = useCallback((id: number, updates: Partial<AudienceSigil>) => {
    setSigils(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }, [])

  // Remove a sigil (e.g., when clearing photo before generation)
  const handleSigilRemoved = useCallback((id: number) => {
    setSigils(prev => prev.filter(s => s.id !== id))
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-primary/20 bg-bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <span className="text-xl">🎮</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">游戏模式</h1>
              <p className="text-xs text-muted-foreground">为观众生成专属图腾</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">{sigils.filter(s => s.status === 'completed').length} 位观众</span>
          </div>
        </div>
      </header>

      {/* Main Content - Split Layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Generator */}
        <div className="w-1/2 border-r border-primary/10 flex flex-col">
          <GameGenerator
            sessionId={sessionId}
            onSigilAdded={handleSigilAdded}
            onSigilUpdated={handleSigilUpdated}
            onSigilRemoved={handleSigilRemoved}
          />
        </div>

        {/* Right: Audience Wall */}
        <div className="w-1/2 flex flex-col bg-bg-deep/50">
          <AudienceWall sigils={sigils} isLoading={isLoading} />
        </div>
      </main>
    </div>
  )
}
