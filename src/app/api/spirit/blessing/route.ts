import { NextResponse } from 'next/server'

import { generateLannaBlessing } from '@/libs/ZenMux'

export async function POST(request: Request) {
  try {
    const { spiritIds } = await request.json()

    if (!Array.isArray(spiritIds) || spiritIds.length === 0) {
      return NextResponse.json(
        { error: 'spiritIds must be a non-empty array' },
        { status: 400 },
      )
    }

    const blessing = await generateLannaBlessing(spiritIds)

    return NextResponse.json({ blessing })
  }
  catch (error) {
    console.error('Failed to generate blessing:', error)
    return NextResponse.json(
      { error: 'Failed to generate blessing' },
      { status: 500 },
    )
  }
}
