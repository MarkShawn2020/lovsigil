'use client'

import { Download, RefreshCw } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

interface SigilOrder {
  order_id: string
  name: string
  bio: string | null
  aspect_ratio: string | null
  style: 'rune' | 'totem' | null
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
  const [isRetrying, setIsRetrying] = useState(false)
  const [pollTrigger, setPollTrigger] = useState(0)

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
  }, [orderId, pollTrigger])

  // Download handler - converts SVG to PNG with 2x DPI
  const handleDownload = useCallback(async () => {
    if (!order?.generated_image) return

    const imageUrl = order.generated_image
    const isSvg = imageUrl.endsWith('.svg')

    if (!isSvg) {
      // Direct download for non-SVG
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = `${order.name}-sigil.png`
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      return
    }

    // SVG to PNG conversion with 2x DPI
    try {
      const res = await fetch(imageUrl)
      const svgText = await res.text()

      // Parse SVG to get dimensions
      const parser = new DOMParser()
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml')
      const svgEl = svgDoc.querySelector('svg')
      if (!svgEl) throw new Error('Invalid SVG')

      const width = Number.parseInt(svgEl.getAttribute('width') || '400', 10)
      const height = Number.parseInt(svgEl.getAttribute('height') || '400', 10)

      // Create 2x canvas for higher DPI
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = width * scale
      canvas.height = height * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context failed')

      // Create image from SVG blob
      const blob = new Blob([svgText], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)

      const img = new window.Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)

        // Download as PNG
        const link = document.createElement('a')
        link.href = canvas.toDataURL('image/png')
        link.download = `${order.name}-sigil.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        // Fallback: direct download
        const link = document.createElement('a')
        link.href = imageUrl
        link.download = `${order.name}-sigil.svg`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
      img.src = url
    } catch (e) {
      console.error('Download conversion failed:', e)
      // Fallback: direct download
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = `${order.name}-sigil.svg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }, [order])

  // Retry handler
  const handleRetry = async () => {
    if (!orderId || isRetrying) return
    setIsRetrying(true)
    try {
      const res = await fetch(`/api/sigil-status?id=${orderId}&retry=1`)
      if (res.ok) {
        // Reset order and restart polling
        setOrder(prev => prev ? { ...prev, status: 'generating', generated_image: null } : null)
        setPollTrigger(prev => prev + 1)
      }
    } catch (e) {
      console.error('Retry failed:', e)
    } finally {
      setIsRetrying(false)
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D1B2A] p-4">
        <Link href="/" className="absolute left-4 top-4 text-amber-300/60 hover:text-amber-300 transition-colors">
          &larr; Back to Home
        </Link>
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
        <Link href="/" className="absolute left-4 top-4 text-amber-300/60 hover:text-amber-300 transition-colors">
          &larr; Back to Home
        </Link>
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
      {/* Back to Home */}
      <Link href="/" className="absolute left-4 top-4 text-amber-300/60 hover:text-amber-300 transition-colors">
        &larr; Back to Home
      </Link>

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
          {order.status === 'completed' && order.vibe_analysis?.description && (
            <div className="space-y-3 rounded-lg bg-[#0D1B2A] p-4">
              <p className="text-center text-sm italic text-amber-200/80">
                &quot;{order.vibe_analysis.description}&quot;
              </p>
              {(order.vibe_analysis.dominantVibe || order.vibe_analysis.traits?.length) && (
                <div className="flex flex-wrap justify-center gap-2">
                  {order.vibe_analysis.dominantVibe && (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-300">
                      {order.vibe_analysis.dominantVibe}
                    </Badge>
                  )}
                  {order.vibe_analysis.traits?.map(trait => (
                    <Badge key={trait} variant="outline" className="border-cyan-500/30 text-cyan-300">
                      {trait}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Generation Parameters */}
          <div className="mt-4 rounded-lg bg-[#0D1B2A]/50 p-3 text-xs">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <span className="text-amber-200/60">Name</span>
              <span className="text-amber-200/80">{order.name}</span>
              {order.bio && (
                <>
                  <span className="text-amber-200/60">Bio</span>
                  <span className="text-amber-200/80">{order.bio}</span>
                </>
              )}
              {order.style && (
                <>
                  <span className="text-amber-200/60">Style</span>
                  <span className="text-amber-200/80">{order.style === 'totem' ? '生命图腾' : '神秘符文'}</span>
                </>
              )}
              {order.aspect_ratio && (
                <>
                  <span className="text-amber-200/60">Ratio</span>
                  <span className="text-amber-200/80">{order.aspect_ratio}</span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/">
              <Button variant="outline" className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10">
                Create Your Own
              </Button>
            </Link>
            {/* Retry button - show for completed or failed */}
            {(order.status === 'completed' || order.status === 'failed') && (
              <Button
                variant="outline"
                className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <Spinner className="mr-2 size-4" />
                ) : (
                  <RefreshCw className="mr-2 size-4" />
                )}
                Retry
              </Button>
            )}
            {order.status === 'completed' && order.generated_image && (
              <Button className="bg-amber-600 hover:bg-amber-700" onClick={handleDownload}>
                <Download className="mr-2 size-4" />
                Download
              </Button>
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
