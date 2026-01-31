import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/libs/SupabaseServer'

export const dynamic = 'force-dynamic'

// Get all sigils for a game session
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    const { data: sigils, error } = await supabaseServer
      .from('sigil_generations')
      .select('id, order_id, name, bio, generated_image, created_at')
      .eq('session_id', sessionId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return NextResponse.json({
      sigils: (sigils || []).map(s => ({
        id: s.id,
        orderId: s.order_id,
        name: s.name,
        bio: s.bio,
        generatedImage: s.generated_image,
        createdAt: s.created_at,
      })),
    })
  } catch (error) {
    console.error('Get game sigils error:', error)
    return NextResponse.json(
      { error: 'Failed to get sigils' },
      { status: 500 },
    )
  }
}
