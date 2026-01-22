import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { EnvServer } from '@/libs/EnvServer'
import { supabaseAdmin, supabaseServer } from '@/libs/SupabaseServer'

async function migrateRecord(supabase: SupabaseClient, record: { id: number, spirit_id: string, generated_image: string }) {
  // 解析 base64 数据
  const matches = record.generated_image.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!matches) {
    return { id: record.id, error: 'Invalid base64 format' }
  }

  const ext = matches[1]!
  const base64 = matches[2]!
  const buffer = Buffer.from(base64, 'base64')

  // 生成唯一文件名
  const fileName = `${record.spirit_id}/${record.id}-migrated.${ext}`

  // 上传到 Storage
  const { error: uploadError } = await supabase.storage
    .from('spirit-images')
    .upload(fileName, buffer, {
      contentType: `image/${ext}`,
      upsert: true,
    })

  if (uploadError) {
    return { id: record.id, error: `Upload failed: ${uploadError.message}` }
  }

  // 生成公开 URL
  const imageUrl = `${EnvServer.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/spirit-images/${fileName}`

  // 更新数据库记录
  const { error: updateError } = await supabase
    .from('spirit_generations')
    .update({ generated_image: imageUrl })
    .eq('id', record.id)

  if (updateError) {
    return { id: record.id, error: `Update failed: ${updateError.message}` }
  }

  return { id: record.id, success: true, url: imageUrl }
}

export async function POST(request: Request) {
  const supabase = supabaseAdmin || supabaseServer

  try {
    // 获取要迁移的单个 ID（避免超时）
    const { searchParams } = new URL(request.url)
    const singleId = searchParams.get('id')

    if (singleId) {
      // 迁移单条记录
      const { data: record, error: fetchError } = await supabase
        .from('spirit_generations')
        .select('id, spirit_id, generated_image')
        .eq('id', singleId)
        .single()

      if (fetchError) throw fetchError
      if (!record) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 })
      }

      // 检查是否已经迁移
      if (!record.generated_image.startsWith('data:image')) {
        return NextResponse.json({ id: record.id, message: 'Already migrated', url: record.generated_image })
      }

      const result = await migrateRecord(supabase, record)
      return NextResponse.json(result)
    }

    // 获取需要迁移的记录 ID 列表（不含大字段，避免超时）
    const { data: records, error: fetchError } = await supabase
      .from('spirit_generations')
      .select('id')
      .like('generated_image', 'data:image%')

    if (fetchError) throw fetchError

    if (!records || records.length === 0) {
      return NextResponse.json({ message: 'No records to migrate', migrated: 0 })
    }

    // 返回待迁移的 ID 列表
    return NextResponse.json({
      message: 'Call POST /api/migrate-spirit-images?id=X for each record',
      pending: records.map(r => r.id),
      total: records.length,
    })
  }
  catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 },
    )
  }
}
