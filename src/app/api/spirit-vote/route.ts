import { NextResponse } from 'next/server'

import { supabaseServer } from '@/libs/SupabaseServer'

export async function POST(request: Request) {
  try {
    const { id, vote, visitorId } = await request.json()

    if (!id || !['like', 'dislike'].includes(vote) || !visitorId) {
      return NextResponse.json(
        { error: 'Invalid request: id, vote, and visitorId are required' },
        { status: 400 },
      )
    }

    const voteValue = vote === 'like' ? 1 : -1

    // Check existing vote
    const { data: existingVote } = await supabaseServer
      .from('spirit_votes')
      .select('id, vote')
      .eq('generation_id', id)
      .eq('user_id', visitorId)
      .single()

    let voteDelta = 0

    if (existingVote) {
      if (existingVote.vote === voteValue) {
        // Same vote - cancel it
        await supabaseServer
          .from('spirit_votes')
          .delete()
          .eq('id', existingVote.id)
        voteDelta = -voteValue
      } else {
        // Different vote - switch it
        await supabaseServer
          .from('spirit_votes')
          .update({ vote: voteValue, updated_at: new Date().toISOString() })
          .eq('id', existingVote.id)
        voteDelta = voteValue * 2 // Remove old vote (-1 or +1) and add new vote (+1 or -1)
      }
    } else {
      // New vote
      await supabaseServer
        .from('spirit_votes')
        .insert({ generation_id: id, user_id: visitorId, vote: voteValue })
      voteDelta = voteValue
    }

    // Update votes count on spirit_generations
    const { data: generation } = await supabaseServer
      .from('spirit_generations')
      .select('votes')
      .eq('id', id)
      .single()

    const newVotes = (generation?.votes ?? 0) + voteDelta
    await supabaseServer
      .from('spirit_generations')
      .update({ votes: newVotes })
      .eq('id', id)

    // Get user's current vote status
    const { data: userVote } = await supabaseServer
      .from('spirit_votes')
      .select('vote')
      .eq('generation_id', id)
      .eq('user_id', visitorId)
      .single()

    return NextResponse.json({
      success: true,
      votes: newVotes,
      userVote: userVote?.vote ?? null, // 1, -1, or null
    })
  }
  catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json(
      { error: 'Failed to vote' },
      { status: 500 },
    )
  }
}

// Get user's vote status for a generation
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const visitorId = searchParams.get('visitorId')

    if (!id || !visitorId) {
      return NextResponse.json(
        { error: 'id and visitorId are required' },
        { status: 400 },
      )
    }

    const { data: userVote } = await supabaseServer
      .from('spirit_votes')
      .select('vote')
      .eq('generation_id', id)
      .eq('user_id', visitorId)
      .single()

    return NextResponse.json({
      userVote: userVote?.vote ?? null,
    })
  }
  catch (error) {
    console.error('Get vote error:', error)
    return NextResponse.json(
      { error: 'Failed to get vote' },
      { status: 500 },
    )
  }
}
