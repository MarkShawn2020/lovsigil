import { Suspense } from 'react'
import { SigilGenerator } from '@/components/mirror/SigilGenerator'
import { Spinner } from '@/components/ui/spinner'

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0D1B2A]"><Spinner className="size-8 text-amber-500" /></div>}>
      <SigilGenerator />
    </Suspense>
  )
}
