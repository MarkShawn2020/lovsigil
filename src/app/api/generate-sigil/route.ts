import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { EnvServer } from '@/libs/EnvServer'
import { supabaseAdmin, supabaseServer } from '@/libs/SupabaseServer'
import { analyzeSigilVibe, buildSigilPrompt, generateImage } from '@/libs/ZenMux'

// Get authenticated user from cookies (optional)
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

// Upload base64 image to Storage, return public URL
async function uploadImageToStorage(base64Data: string, sigilId: string): Promise<string> {
  const supabase = supabaseAdmin || supabaseServer

  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!matches) {
    throw new Error('Invalid base64 image format')
  }

  const ext = matches[1]!
  const base64 = matches[2]!
  const buffer = Buffer.from(base64, 'base64')

  const fileName = `sigils/${sigilId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage
    .from('spirit-images')
    .upload(fileName, buffer, {
      contentType: `image/${ext}`,
      upsert: false,
    })

  if (error) throw error

  return `${EnvServer.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/spirit-images/${fileName}`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, bio, userPhoto, orderId, aspectRatio = '1:1' } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 },
      )
    }

    // If orderId provided, update existing order status to 'generating'
    if (orderId) {
      await supabaseServer
        .from('sigil_generations')
        .update({ status: 'generating' })
        .eq('order_id', orderId)
    }

    try {
      // Step 1: Analyze vibe from photo (if provided)
      let vibeAnalysis = null
      if (userPhoto) {
        vibeAnalysis = await analyzeSigilVibe(userPhoto, name, bio)
      } else {
        // Default vibe for users without photo
        vibeAnalysis = {
          dominantVibe: 'seeker',
          traits: ['curious', 'open', 'balanced'],
          runeAffinity: 'mystical' as const,
          description: 'A soul seeking its true path',
        }
      }

      // Step 2: Build sigil prompt
      const prompt = buildSigilPrompt({
        name,
        bio,
        vibeAnalysis,
        hasReferenceImage: !!userPhoto,
      })

      // Step 3: Generate sigil image
      const generatedImageBase64 = await generateImage(prompt, userPhoto || undefined, {
        aspectRatio,
      })

      // Step 4: Upload to storage
      const sigilId = orderId || `sigil-${Date.now()}`
      const imageUrl = await uploadImageToStorage(generatedImageBase64, sigilId)

      // Step 5: Save to database
      if (orderId) {
        await supabaseServer
          .from('sigil_generations')
          .update({
            generated_image: imageUrl,
            prompt,
            vibe_analysis: vibeAnalysis,
            status: 'completed',
          })
          .eq('order_id', orderId)
      } else {
        const user = await getAuthUser()
        await supabaseServer.from('sigil_generations').insert({
          name,
          bio: bio || null,
          user_photo: userPhoto || null,
          generated_image: imageUrl,
          prompt,
          vibe_analysis: vibeAnalysis,
          aspect_ratio: aspectRatio,
          user_id: user?.id || null,
          status: 'completed',
        })
      }

      return NextResponse.json({
        success: true,
        image: imageUrl,
        vibeAnalysis,
        prompt,
        orderId,
      })
    } catch (genError) {
      // Update order status to failed if orderId was provided
      if (orderId) {
        await supabaseServer
          .from('sigil_generations')
          .update({
            status: 'failed',
            metadata: { error: genError instanceof Error ? genError.message : 'Generation failed' },
          })
          .eq('order_id', orderId)
      }
      throw genError
    }
  }
  catch (error) {
    console.error('Sigil generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 },
    )
  }
}
