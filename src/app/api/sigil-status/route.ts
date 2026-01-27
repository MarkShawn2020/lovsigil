import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { supabaseAdmin } from '@/libs/SupabaseServer'

async function getBaseUrl() {
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  return `${protocol}://${host}`
}

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('id')
  const retry = request.nextUrl.searchParams.get('retry')

  if (!orderId) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server config error' }, { status: 500 })
  }

  // Retry mode: reset and regenerate
  if (retry === '1') {
    // Get existing order data
    const { data: existingOrder, error: fetchError } = await supabaseAdmin
      .from('sigil_generations')
      .select('name, bio, user_photo, aspect_ratio, style')
      .eq('order_id', orderId)
      .single()

    if (fetchError || !existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Reset order status to generating (skip pending since we trigger immediately)
    await supabaseAdmin
      .from('sigil_generations')
      .update({
        status: 'generating',
        generated_image: null,
        vibe_analysis: null,
        prompt: null,
      })
      .eq('order_id', orderId)

    const baseUrl = await getBaseUrl()

    // Trigger regeneration in background
    fetch(`${baseUrl}/api/generate-sigil`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: existingOrder.name,
        bio: existingOrder.bio,
        userPhoto: existingOrder.user_photo,
        aspectRatio: existingOrder.aspect_ratio,
        style: existingOrder.style || 'totem',
        orderId,
      }),
    }).catch(console.error)

    return NextResponse.json({ success: true, orderId, message: 'Retry initiated' })
  }

  // Normal mode: get status
  const { data, error } = await supabaseAdmin
    .from('sigil_generations')
    .select('order_id, name, bio, aspect_ratio, style, generated_image, vibe_analysis, status, created_at')
    .eq('order_id', orderId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
