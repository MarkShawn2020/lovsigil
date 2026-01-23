import type { SpiritMatchScores as SpiritScores } from '@/components/mirror/faceFeatureAnalyzer'

import type { LannaSpirit } from '@/components/mirror/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { spiritKeys } from '@/libs/queryKeys'

type GenerateInput = {
  spirit: LannaSpirit
  userPhoto: string | null
  spiritScores?: SpiritScores
}

type GenerateResponse = {
  success: boolean
  image: string
  prompt: string
}

async function generateSpirit(input: GenerateInput): Promise<GenerateResponse> {
  const res = await fetch('/api/generate-spirit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await res.json()
  if (!res.ok)
    throw new Error(data.error || 'Generation failed')
  return data
}

export function useGenerateSpirit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: generateSpirit,
    onSuccess: (data, variables) => {
      // 乐观更新：将新记录插入缓存头部
      queryClient.setQueryData(spiritKeys.history(), (old: any) => {
        if (!old)
          return old
        const newRecord = {
          id: Date.now(), // 临时 ID，刷新后会替换
          spiritId: variables.spirit.id,
          spiritName: variables.spirit.name,
          userPhoto: variables.userPhoto,
          generatedImage: data.image,
          createdAt: new Date().toISOString(),
          userId: null,
        }
        return {
          pages: [
            {
              records: [newRecord, ...old.pages[0].records],
              hasMore: old.pages[0].hasMore,
              total: (old.pages[0].total || 0) + 1,
            },
            ...old.pages.slice(1),
          ],
          pageParams: old.pageParams,
        }
      })
      // 后台静默刷新确保数据一致性
      queryClient.invalidateQueries({ queryKey: spiritKeys.history() })
    },
  })
}
