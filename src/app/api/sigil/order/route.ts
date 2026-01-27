import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { EnvServer } from '@/libs/EnvServer'
import { supabaseServer } from '@/libs/SupabaseServer'

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

    // Create order record with pending status
    const { data: order, error } = await supabaseServer
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
