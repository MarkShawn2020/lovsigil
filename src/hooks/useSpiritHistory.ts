import { useInfiniteQuery } from '@tanstack/react-query'

import { spiritKeys } from '@/libs/queryKeys'

// Sigil history record type
export type SigilHistoryRecord = {
  id: number
  name: string
  bio?: string | null
  userPhoto: string | null
  generatedImage: string
  vibeAnalysis?: Record<string, unknown> | null
  createdAt: string
  userId: string | null
  orderId: string | null
  ratio?: string // 生成时的比例 (1:1, 3:4, 4:3, 9:16, 16:9)
  votes: number // 净票数 (likes - dislikes)
}

/** @deprecated Use SigilHistoryRecord instead */
export type SpiritHistoryRecord = SigilHistoryRecord
export type HistoryRecord = SigilHistoryRecord

type HistoryResponse = {
  records: SigilHistoryRecord[]
  hasMore: boolean
  total: number
}

async function fetchSigilHistory({ pageParam = 0 }): Promise<HistoryResponse> {
  const res = await fetch(`/api/sigil-history?limit=20&offset=${pageParam}`)
  if (!res.ok)
    throw new Error('Failed to fetch history')
  return res.json()
}

export function useSpiritHistory() {
  return useInfiniteQuery({
    queryKey: spiritKeys.history(),
    queryFn: fetchSigilHistory,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore)
        return undefined
      return allPages.reduce((acc, page) => acc + page.records.length, 0)
    },
    select: data => ({
      records: data.pages.flatMap(page => page.records),
      hasMore: data.pages[data.pages.length - 1]?.hasMore ?? false,
    }),
  })
}
