'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface SigilOrder {
  order_id: string
  name: string
  bio: string | null
  generated_image: string | null
  vibe_analysis: {
    dominantVibe: string
    traits: string[]
    runeAffinity: string
    description: string
  } | null
  status: 'pending' | 'generating' | 'completed' | 'failed'
  created_at: string
}

export default function SigilPage({ params }: { params: Promise<{ orderId: string }> }) {
  const [order, setOrder] = useState<SigilOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  // Unwrap params
  useEffect(() => {
    params.then(p => setOrderId(p.orderId))
  }, [params])

  // Fetch order and poll if pending/generating
  useEffect(() => {
    if (!orderId) return

    let interval: NodeJS.Timeout | null = null

    async function fetchOrder() {
      try {
        const res = await fetch(`/api/sigil-status?id=${orderId}`)
        if (!res.ok) {
          setError('Sigil not found')
          return
        }
        const data = await res.json()
        setOrder(data)

        // Stop polling if completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          if (interval) clearInterval(interval)
        }
      } catch {
        setError('Failed to load sigil')
      }
    }

    fetchOrder()
    interval = setInterval(fetchOrder, 3000) // Poll every 3s

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [orderId])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D1B2A] p-4">
        <Card className="w-full max-w-md border-amber-500/20 bg-[#1B2838]">
          <CardContent className="p-8 text-center">
            <p className="text-lg text-red-400">{error}</p>
            <Link href="/">
              <Button className="mt-4" variant="outline">
                Go Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D1B2A]">
        <Spinner className="size-8 text-amber-500" />
      </div>
    )
  }

  const statusConfig = {
    pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400' },
    generating: { label: 'Generating...', color: 'bg-blue-500/20 text-blue-400' },
    completed: { label: 'Complete', color: 'bg-green-500/20 text-green-400' },
    failed: { label: 'Failed', color: 'bg-red-500/20 text-red-400' },
  }

  const status = statusConfig[order.status]

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D1B2A] p-4">
      <Card className="w-full max-w-lg border-amber-500/20 bg-[#1B2838]">
        <CardContent className="p-6">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-amber-100">{order.name}&apos;s Sigil</h1>
            <Badge className={`mt-2 ${status.color}`}>{status.label}</Badge>
          </div>

          {/* Sigil Image or Loading */}
          <div className="relative mb-6 aspect-square overflow-hidden rounded-lg bg-[#0D1B2A]">
            {order.status === 'completed' && order.generated_image ? (
              <Image
                src={order.generated_image}
                alt={`${order.name}'s personal sigil`}
                fill
                className="object-contain"
                unoptimized
              />
            ) : order.status === 'failed' ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-red-400">Generation failed</p>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4">
                <Spinner className="size-12 text-amber-500" />
                <p className="text-amber-200/60">
                  {order.status === 'pending' ? 'Waiting to start...' : 'Creating your sigil...'}
                </p>
              </div>
            )}
          </div>

          {/* Vibe Analysis */}
          {order.status === 'completed' && order.vibe_analysis && (
            <div className="space-y-3 rounded-lg bg-[#0D1B2A] p-4">
              <p className="text-center text-sm italic text-amber-200/80">
                &quot;{order.vibe_analysis.description}&quot;
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="outline" className="border-amber-500/30 text-amber-300">
                  {order.vibe_analysis.dominantVibe}
                </Badge>
                {order.vibe_analysis.traits.map(trait => (
                  <Badge key={trait} variant="outline" className="border-cyan-500/30 text-cyan-300">
                    {trait}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/">
              <Button variant="outline" className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10">
                Create Your Own
              </Button>
            </Link>
            {order.status === 'completed' && order.generated_image && (
              <a href={order.generated_image} download={`${order.name}-sigil.png`} target="_blank">
                <Button className="bg-amber-600 hover:bg-amber-700">
                  Download
                </Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="mt-6 text-sm text-amber-200/40">
        Powered by LovSigil
      </p>
    </div>
  )
}
