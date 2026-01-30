import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/global.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Your Personal Sigil | LovSigil',
  description: 'View and download your AI-generated personal sigil totem.',
}

export default function SigilLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="font-sans antialiased bg-deep text-light">
        {children}
      </body>
    </html>
  )
}
