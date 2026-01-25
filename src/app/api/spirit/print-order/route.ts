import { NextResponse } from 'next/server'

import { notifyNewPrintOrder } from '@/libs/notify'
import { supabaseServer } from '@/libs/SupabaseServer'

// Price mapping in cents (THB satang)
const PRICES: Record<string, number> = {
  frame: 29900, // ฿299
  figurine: 59900, // ฿599
}

// Create a new print order
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, productType, name, phone, address } = body

    // Validate required fields
    if (!orderId || !productType || !name || !phone || !address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate product type
    if (!PRICES[productType]) {
      return NextResponse.json({ error: 'Invalid product type' }, { status: 400 })
    }

    // Check if spirit order exists
    const { data: spiritOrder, error: spiritError } = await supabaseServer
      .from('spirit_generations')
      .select('order_id, spirit_name')
      .eq('order_id', orderId)
      .single()

    if (spiritError || !spiritOrder) {
      return NextResponse.json({ error: 'Spirit order not found' }, { status: 404 })
    }

    // Create print order
    const { data: printOrder, error } = await supabaseServer
      .from('print_orders')
      .insert({
        order_id: orderId,
        product_type: productType,
        customer_name: name,
        customer_phone: phone,
        customer_address: address,
        price_cents: PRICES[productType],
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) throw error

    // Send notification to admin
    notifyNewPrintOrder({
      printOrderId: printOrder.id,
      orderId,
      productType,
      customerName: name,
      customerPhone: phone,
      price: PRICES[productType] / 100,
      spiritName: spiritOrder.spirit_name || 'Unknown Spirit',
    }).catch(console.error) // Don't block on notification failure

    return NextResponse.json({
      success: true,
      printOrderId: printOrder.id,
    })
  } catch (error) {
    console.error('Create print order error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create print order' },
      { status: 500 },
    )
  }
}
