'use client'

import { Suspense } from 'react'
import { GameModeLayout } from '@/components/game/GameModeLayout'
import { Spinner } from '@/components/ui/spinner'

export default function GamePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-8 text-primary" />
      </div>
    }>
      <GameModeLayout />
    </Suspense>
  )
}
