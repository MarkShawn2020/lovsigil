import { NextResponse } from 'next/server'

import { supabaseServer } from '@/libs/SupabaseServer'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100)
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)

    // 先获取总数（排除 disabled 的记录）
    const { count } = await supabaseServer
      .from('spirit_generations')
      .select('*', { count: 'exact', head: true })
      .eq('disabled', false)

    const { data: records, error } = await supabaseServer
      .from('spirit_generations')
      .select('id, spirit_id, spirit_name, user_photo, generated_image, spirit_scores, created_at, user_id, order_id')
      .eq('disabled', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // 转换字段名为 camelCase
    const formattedRecords = records?.map(r => ({
      id: r.id,
      spiritId: r.spirit_id,
      spiritName: r.spirit_name,
      userPhoto: r.user_photo,
      generatedImage: r.generated_image,
      spiritScores: r.spirit_scores,
      createdAt: r.created_at,
      userId: r.user_id,
      orderId: r.order_id,
    })) || []

    const hasMore = offset + formattedRecords.length < (count || 0)

    return NextResponse.json({ records: formattedRecords, hasMore, total: count })
  }
  catch (error) {
    console.error('Fetch history error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 },
    )
  }
}
