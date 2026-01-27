import { NextRequest, NextResponse } from 'next/server'

import { supabaseAdmin } from '@/libs/SupabaseServer'

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('id')

  if (!orderId) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server config error' }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin
    .from('sigil_generations')
    .select('order_id, name, bio, generated_image, vibe_analysis, status, created_at')
    .eq('order_id', orderId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
