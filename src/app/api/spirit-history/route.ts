import { NextResponse } from 'next/server'

import { supabaseServer } from '@/libs/SupabaseServer'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100)

    const { data: records, error } = await supabaseServer
      .from('spirit_generations')
      .select('id, spirit_id, spirit_name, user_photo, generated_image, spirit_scores, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

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
    })) || []

    return NextResponse.json({ records: formattedRecords })
  }
  catch (error) {
    console.error('Fetch history error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 },
    )
  }
}
