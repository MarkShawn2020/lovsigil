import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { EnvServer } from '@/libs/EnvServer'
import { supabaseAdmin, supabaseServer } from '@/libs/SupabaseServer'

// Get authenticated user from cookies
async function getAuthUser() {
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

// Check if user is admin
async function isUserAdmin(userId: string): Promise<boolean> {
  const supabase = supabaseAdmin || supabaseServer
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .single()
  return !!data
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const recordId = Number.parseInt(id, 10)

    if (Number.isNaN(recordId)) {
      return NextResponse.json({ error: 'Invalid record ID' }, { status: 400 })
    }

    // Get current user
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the record to check ownership
    const supabase = supabaseAdmin || supabaseServer
    const { data: record, error: fetchError } = await supabase
      .from('spirit_generations')
      .select('id, user_id')
      .eq('id', recordId)
      .single()

    if (fetchError || !record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    // Check permission: must be owner or admin
    const isAdmin = await isUserAdmin(user.id)
    const isOwner = record.user_id === user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Soft delete: mark as disabled
    const { error: updateError } = await supabase
      .from('spirit_generations')
      .update({ disabled: true })
      .eq('id', recordId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  }
  catch (error) {
    console.error('Delete spirit error:', error)
    return NextResponse.json(
      { error: 'Failed to delete record' },
      { status: 500 },
    )
  }
}
