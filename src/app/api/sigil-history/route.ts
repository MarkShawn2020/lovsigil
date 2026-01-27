import { NextResponse } from 'next/server'

import { supabaseServer } from '@/libs/SupabaseServer'

// 从数字 aspect_ratio 推断字符串比例
function inferRatioFromAspectRatio(aspectRatio: number | null): string | undefined {
  if (!aspectRatio) return undefined

  const tolerance = 0.05
  const ratioMap: Array<[number, string]> = [
    [1, '1:1'],
    [0.75, '3:4'],
    [1.333, '4:3'],
    [0.5625, '9:16'],
    [1.778, '16:9'],
  ]

  for (const [value, label] of ratioMap) {
    if (Math.abs(aspectRatio - value) < tolerance) {
      return label
    }
  }
  return undefined
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100)
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)

    // 先获取总数
    const { count } = await supabaseServer
      .from('sigil_generations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')

    const { data: records, error } = await supabaseServer
      .from('sigil_generations')
      .select('id, name, bio, user_photo, generated_image, vibe_analysis, created_at, user_id, order_id, aspect_ratio, metadata, votes')
      .eq('status', 'completed')
      .order('votes', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // 转换字段名为 camelCase
    const formattedRecords = records?.map(r => {
      const ratio = r.aspect_ratio || inferRatioFromAspectRatio(
        r.aspect_ratio === '1:1' ? 1 :
        r.aspect_ratio === '3:4' ? 0.75 :
        r.aspect_ratio === '4:3' ? 1.333 :
        r.aspect_ratio === '9:16' ? 0.5625 :
        r.aspect_ratio === '16:9' ? 1.778 : null
      )
      return {
        id: r.id,
        name: r.name,
        bio: r.bio,
        userPhoto: r.user_photo,
        generatedImage: r.generated_image,
        vibeAnalysis: r.vibe_analysis,
        createdAt: r.created_at,
        userId: r.user_id,
        orderId: r.order_id,
        ratio,
        votes: r.votes ?? 0,
      }
    }) || []

    const hasMore = offset + formattedRecords.length < (count || 0)

    return NextResponse.json({ records: formattedRecords, hasMore, total: count })
  }
  catch (error) {
    console.error('Fetch sigil history error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 },
    )
  }
}
