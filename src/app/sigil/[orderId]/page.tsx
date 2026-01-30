'use client'

import { Download, RefreshCw } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
      <div className="min-h-screen bg-deep flex flex-col items-center justify-center p-4">
        <p className="text-lg text-red-400 mb-4">{error}</p>
        <Link href="/">
          <Button variant="outline" className="border-gold/30 text-light hover:bg-gold/10">
            Go Home
          </Button>
        </Link>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-deep flex items-center justify-center">
        <Spinner className="size-8 text-gold" />
      </div>
    )
  }

  const statusConfig = {
    pending: { label: 'Pending', color: 'bg-gold/20 text-gold border border-gold/30' },
    generating: { label: 'Generating...', color: 'bg-copper/20 text-copper border border-copper/30' },
    completed: { label: 'Complete', color: 'bg-green-500/20 text-green-400 border border-green-500/30' },
    failed: { label: 'Failed', color: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  }

  const status = statusConfig[order.status]

  return (
    <div className="min-h-screen bg-deep text-light">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-deep/90 backdrop-blur-sm border-b border-gold/20">
        <Link href="/" className="text-light/60 hover:text-gold transition-colors text-sm">
          &larr; Back
        </Link>
        <Badge className={`${status.color} text-xs`}>{status.label}</Badge>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 max-w-lg mx-auto">
        {/* Title */}
        <h1 className="text-2xl font-bold text-center text-gold tracking-wide mb-6">
          {order.name}&apos;s Sigil
        </h1>

        {/* Sigil Image */}
        <div className="relative w-full overflow-hidden rounded-2xl border-2 border-gold/30 sigil-glow">
          {order.status === 'completed' && order.generated_image ? (
            <Image
              src={order.generated_image}
              alt={`${order.name}'s personal sigil`}
              width={600}
              height={600}
              className="w-full h-auto"
              unoptimized
            />
          ) : order.status === 'failed' ? (
            <div className="aspect-square flex items-center justify-center bg-surface">
              <p className="text-red-400">Generation failed</p>
            </div>
          ) : (
            <div className="aspect-square flex flex-col items-center justify-center gap-4 bg-surface">
              <Spinner className="size-12 text-gold" />
              <p className="text-light/60">
                {order.status === 'pending' ? 'Waiting to start...' : 'Creating your sigil...'}
              </p>
            </div>
          )}
        </div>

        {/* Meta Tags */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs">
          {order.style && (
            <span className="px-3 py-1.5 rounded-full bg-gold/10 border border-gold/20 text-gold">
              {order.style === 'totem' ? '生命图腾' : '神秘符文'}
            </span>
          )}
          {order.aspect_ratio && (
            <span className="px-3 py-1.5 rounded-full bg-surface border border-subtle text-light/60">
              {order.aspect_ratio}
            </span>
          )}
          <span className="px-3 py-1.5 rounded-full bg-surface border border-subtle text-light/60">
            {new Date(order.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-8 space-y-3">
          {order.status === 'completed' && order.generated_image && (
            <Button
              className="w-full h-12 gradient-gold-copper text-deep text-base font-semibold sigil-glow"
              onClick={handleDownload}
            >
              <Download className="mr-2 size-5" />
              Download Sigil
            </Button>
          )}

          <div className="flex gap-3">
            <Link href="/" className="flex-1">
              <Button
                variant="outline"
                className="w-full h-11 bg-surface border-gold/30 text-light hover:bg-elevated hover:border-gold/50"
              >
                Create New
              </Button>
            </Link>
            {(order.status === 'completed' || order.status === 'failed') && (
              <Button
                variant="outline"
                className="flex-1 h-11 bg-surface border-gold/30 text-light hover:bg-elevated hover:border-gold/50"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <Spinner className="mr-2 size-4" />
                ) : (
                  <RefreshCw className="mr-2 size-4" />
                )}
                Regenerate
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 inset-x-0 py-3 text-center text-xs text-gold/40">
        LovSigil
      </footer>
    </div>
  )
}
