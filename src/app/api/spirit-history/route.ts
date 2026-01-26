import { NextResponse } from 'next/server'

import { supabaseServer } from '@/libs/SupabaseServer'

// 风格关键词映射（用于从 prompt 推断 style）
const STYLE_KEYWORDS: Record<string, string> = {
  'traditional Lanna temple mural': 'mural',
  'cute chibi art style': 'cute',
  'dark mystical art style': 'mysterious',
  'modern digital art style': 'modern',
}

// 从 prompt 中推断使用的 style
function inferStyleFromPrompt(prompt: string | null): string | undefined {
  if (!prompt) return undefined

  for (const [keyword, styleId] of Object.entries(STYLE_KEYWORDS)) {
    if (prompt.includes(keyword)) {
      return styleId
    }
  }
  return undefined
}

// 从数字 aspect_ratio 推断字符串比例
function inferRatioFromAspectRatio(aspectRatio: number | null): string | undefined {
  if (!aspectRatio) return undefined

  // 允许一定误差
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

    // 先获取总数（排除 disabled 的记录）
    const { count } = await supabaseServer
      .from('spirit_generations')
      .select('*', { count: 'exact', head: true })
      .eq('disabled', false)

    const { data: records, error } = await supabaseServer
      .from('spirit_generations')
      .select('id, spirit_id, spirit_name, user_photo, generated_image, spirit_scores, created_at, user_id, order_id, aspect_ratio, metadata, prompt, votes')
      .eq('disabled', false)
      .order('votes', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // 转换字段名为 camelCase
    const formattedRecords = records?.map(r => {
      const metadata = r.metadata as { style?: string; aspectRatio?: string } | null
      // 优先使用 metadata，如果没有则推断
      const style = metadata?.style || inferStyleFromPrompt(r.prompt)
      const ratio = metadata?.aspectRatio || inferRatioFromAspectRatio(r.aspect_ratio)
      return {
        id: r.id,
        spiritId: r.spirit_id,
        spiritName: r.spirit_name,
        userPhoto: r.user_photo,
        generatedImage: r.generated_image,
        spiritScores: r.spirit_scores,
        createdAt: r.created_at,
        userId: r.user_id,
        orderId: r.order_id,
        aspectRatio: r.aspect_ratio ?? 0.75,
        style,
        ratio,
        votes: r.votes ?? 0,
      }
    }) || []

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
