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

// Create a new order for spirit generation
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { spirit, userPhoto, spiritScores, group } = body

    const user = await getAuthUser()
    const isGroup = !!(group && Array.isArray(group.persons) && group.persons.length >= 2)

    // Prepare order data
    const orderData: Record<string, unknown> = {
      status: 'pending',
      user_id: user?.id || null,
    }

    if (isGroup) {
      // Group order
      orderData.spirit_id = 'group'
      orderData.spirit_name = group.persons.map((p: any) => p.spirit.name).join(' + ')
      orderData.user_photo = null
      orderData.metadata = {
        isGroup: true,
        persons: group.persons.map((p: any) => ({
          spiritId: p.spirit.id,
          spiritName: p.spirit.name,
          hasPhoto: !!p.photo,
        })),
      }
    } else {
      // Single person order
      if (!spirit) {
        return NextResponse.json({ error: 'Missing spirit data' }, { status: 400 })
      }
      orderData.spirit_id = spirit.id
      orderData.spirit_name = spirit.name
      orderData.user_photo = userPhoto || null
      orderData.spirit_scores = spiritScores || null
    }

    // Create order record with pending status
    const { data: order, error } = await supabaseServer
      .from('spirit_generations')
      .insert(orderData)
      .select('order_id')
      .single()

    if (error) throw error

    const baseUrl = await getBaseUrl()

    return NextResponse.json({
      success: true,
      orderId: order.order_id,
      orderUrl: `${baseUrl}/spirit/${order.order_id}`,
    })
  }
  catch (error) {
    console.error('Create order error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create order' },
      { status: 500 },
    )
  }
}
