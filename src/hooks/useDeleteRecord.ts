import { useMutation, useQueryClient } from '@tanstack/react-query'

import { spiritKeys } from '@/libs/queryKeys'

async function deleteRecord(recordId: number): Promise<void> {
  const res = await fetch(`/api/spirit-history/${recordId}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to delete')
  }
}

export function useDeleteRecord() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteRecord,
    onMutate: async (recordId) => {
      // 取消进行中的请求
      await queryClient.cancelQueries({ queryKey: spiritKeys.history() })

      // 保存快照用于回滚
      const previousData = queryClient.getQueryData(spiritKeys.history())

      // 乐观更新：立即从列表中移除
      queryClient.setQueryData(spiritKeys.history(), (old: any) => {
        if (!old)
          return old
        return {
          pages: old.pages.map((page: any) => ({
            ...page,
            records: page.records.filter((r: any) => r.id !== recordId),
          })),
          pageParams: old.pageParams,
        }
      })

      return { previousData }
    },
    onError: (_err, _recordId, context) => {
      // 回滚
      if (context?.previousData) {
        queryClient.setQueryData(spiritKeys.history(), context.previousData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: spiritKeys.history() })
    },
  })
}
