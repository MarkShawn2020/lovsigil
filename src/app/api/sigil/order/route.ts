import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { EnvServer } from '@/libs/EnvServer'
import { supabaseAdmin, supabaseServer } from '@/libs/SupabaseServer'

export const dynamic = 'force-dynamic'

// Get base URL from request headers or environment
async function getBaseUrl() {
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  return `${protocol}://${host}`
}

async function getAuthUser() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      EnvServer.NEXT_PUBLIC_SUPABASE_URL || '',
      EnvServer.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
        },
      },
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }
  catch {
    return null
  }
}

// Create a new order for sigil generation
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, bio, userPhoto, aspectRatio = '1:1' } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const user = await getAuthUser()

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Create order record with pending status
    const { data: order, error } = await supabaseAdmin
      .from('sigil_generations')
      .insert({
        name,
        bio: bio || null,
        user_photo: userPhoto || null,
        aspect_ratio: aspectRatio,
        user_id: user?.id || null,
        status: 'pending',
      })
      .select('order_id')
      .single()

    if (error) throw error

    const baseUrl = await getBaseUrl()

    return NextResponse.json({
      success: true,
      orderId: order.order_id,
      orderUrl: `${baseUrl}/sigil/${order.order_id}`,
    })
  }
  catch (error) {
    console.error('Create sigil order error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create order' },
      { status: 500 },
    )
  }
}

// Get order by ID
export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get('id')

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    const { data: order, error } = await supabaseServer
      .from('sigil_generations')
      .select('order_id, name, bio, generated_image, vibe_analysis, status, created_at')
      .eq('order_id', orderId)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json(order)
  }
  catch (error) {
    console.error('Get sigil order error:', error)
    return NextResponse.json(
      { error: 'Failed to get order' },
      { status: 500 },
    )
  }
}
