'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'

interface QRCodeProps {
  /** If not provided, uses current page URL */
  url?: string
  size?: number
  className?: string
  /** Background color */
  bgColor?: string
  /** Foreground (QR) color */
  fgColor?: string
  /** Include margin */
  includeMargin?: boolean
}

export function QRCode({
  url,
  size = 128,
  className,
  bgColor = '#FFFFFF',
  fgColor = '#000000',
  includeMargin = true,
}: QRCodeProps) {
  const [currentUrl, setCurrentUrl] = useState(url || '')

  useEffect(() => {
    if (!url && typeof window !== 'undefined') {
      setCurrentUrl(window.location.href)
    }
  }, [url])

  if (!currentUrl) {
    return (
      <div
        className={className}
        style={{ width: size, height: size, background: bgColor }}
      />
    )
  }

  return (
    <QRCodeSVG
      value={currentUrl}
      size={size}
      bgColor={bgColor}
      fgColor={fgColor}
      includeMargin={includeMargin}
      className={className}
    />
  )
}
