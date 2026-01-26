import { useInfiniteQuery } from '@tanstack/react-query'

import { spiritKeys } from '@/libs/queryKeys'

export type SpiritHistoryRecord = {
  id: number
  spiritId: string
  spiritName: string | null
  userPhoto: string | null
  generatedImage: string
  spiritScores?: Record<string, number> | null
  createdAt: string
  userId: string | null
  orderId: string | null
  aspectRatio?: number // width/height, defaults to 0.75 (3:4)
  style?: string // 生成时的风格 (mural, cute, mysterious, modern)
  ratio?: string // 生成时的比例 (1:1, 3:4, 4:3, 9:16, 16:9)
  votes: number // 净票数 (likes - dislikes)
}

/** @deprecated Use SpiritHistoryRecord instead */
export type HistoryRecord = SpiritHistoryRecord

type HistoryResponse = {
  records: SpiritHistoryRecord[]
  hasMore: boolean
  total: number
}

async function fetchSpiritHistory({ pageParam = 0 }): Promise<HistoryResponse> {
  const res = await fetch(`/api/spirit-history?limit=20&offset=${pageParam}`)
  if (!res.ok)
    throw new Error('Failed to fetch history')
  return res.json()
}

export function useSpiritHistory() {
  return useInfiniteQuery({
    queryKey: spiritKeys.history(),
    queryFn: fetchSpiritHistory,
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
