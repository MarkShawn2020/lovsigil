import { Suspense } from 'react'
import { SigilGenerator } from '@/components/mirror/SigilGenerator'
import { Spinner } from '@/components/ui/spinner'

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><Spinner className="size-8 text-primary" /></div>}>
      <SigilGenerator />
    </Suspense>
  )
}
