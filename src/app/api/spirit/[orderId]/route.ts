import { NextResponse } from 'next/server'

import { supabaseServer } from '@/libs/SupabaseServer'

// Get order status and data by orderId
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    const { data: order, error } = await supabaseServer
      .from('spirit_generations')
      .select('order_id, spirit_id, spirit_name, user_photo, generated_image, spirit_scores, status, metadata, created_at')
      .eq('order_id', orderId)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({
      orderId: order.order_id,
      spiritId: order.spirit_id,
      spiritName: order.spirit_name,
      userPhoto: order.user_photo,
      generatedImage: order.generated_image,
      spiritScores: order.spirit_scores,
      status: order.status,
      metadata: order.metadata,
      createdAt: order.created_at,
    })
  }
  catch (error) {
    console.error('Fetch order error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch order' },
      { status: 500 },
    )
  }
}
