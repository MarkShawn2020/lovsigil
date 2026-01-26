/**
 * 批量更新 spirit_generations 表的 aspect_ratio 字段
 * 运行: npx tsx scripts/update-aspect-ratios.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function getImageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  try {
    // 使用 Supabase 图片变换获取元数据
    const response = await fetch(url, { method: 'HEAD' })
    if (!response.ok) return null

    // 尝试从响应头获取尺寸（如果 Supabase 返回）
    const contentLength = response.headers.get('content-length')

    // 如果无法从头获取，需要下载图片
    const imgResponse = await fetch(url)
    const buffer = await imgResponse.arrayBuffer()

    // 解析 PNG/JPEG 头获取尺寸
    const dimensions = parseImageDimensions(new Uint8Array(buffer))
    return dimensions
  } catch (error) {
    console.error(`Failed to get dimensions for ${url}:`, error)
    return null
  }
}

function parseImageDimensions(data: Uint8Array): { width: number; height: number } | null {
  // PNG: 宽高在 IHDR chunk (offset 16-23)
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    const w16 = data[16], w17 = data[17], w18 = data[18], w19 = data[19]
    const h20 = data[20], h21 = data[21], h22 = data[22], h23 = data[23]
    if (w16 === undefined || w17 === undefined || w18 === undefined || w19 === undefined) return null
    if (h20 === undefined || h21 === undefined || h22 === undefined || h23 === undefined) return null
    const width = (w16 << 24) | (w17 << 16) | (w18 << 8) | w19
    const height = (h20 << 24) | (h21 << 16) | (h22 << 8) | h23
    return { width, height }
  }

  // JPEG: 需要找到 SOF0/SOF2 marker
  if (data[0] === 0xFF && data[1] === 0xD8) {
    let offset = 2
    while (offset < data.length - 10) {
      if (data[offset] !== 0xFF) break
      const marker = data[offset + 1]
      // SOF0 (0xC0) 或 SOF2 (0xC2)
      if (marker === 0xC0 || marker === 0xC2) {
        const h5 = data[offset + 5], h6 = data[offset + 6]
        const w7 = data[offset + 7], w8 = data[offset + 8]
        if (h5 === undefined || h6 === undefined || w7 === undefined || w8 === undefined) return null
        const height = (h5 << 8) | h6
        const width = (w7 << 8) | w8
        return { width, height }
      }
      // 跳到下一个 marker
      const len2 = data[offset + 2], len3 = data[offset + 3]
      if (len2 === undefined || len3 === undefined) break
      const length = (len2 << 8) | len3
      offset += 2 + length
    }
  }

  return null
}

async function main() {
  console.log('Fetching records without aspect_ratio...')

  // 获取没有 aspect_ratio 的记录
  const { data: records, error } = await supabase
    .from('spirit_generations')
    .select('id, generated_image')
    .is('aspect_ratio', null)
    .not('generated_image', 'is', null)
    .limit(100) // 分批处理

  if (error) {
    console.error('Error fetching records:', error)
    return
  }

  console.log(`Found ${records?.length || 0} records to update`)

  if (!records || records.length === 0) {
    console.log('All records have aspect_ratio!')
    return
  }

  let updated = 0
  let failed = 0

  for (const record of records) {
    const dimensions = await getImageDimensions(record.generated_image)

    if (dimensions) {
      const aspectRatio = dimensions.width / dimensions.height

      const { error: updateError } = await supabase
        .from('spirit_generations')
        .update({ aspect_ratio: aspectRatio })
        .eq('id', record.id)

      if (updateError) {
        console.error(`Failed to update record ${record.id}:`, updateError)
        failed++
      } else {
        console.log(`Updated record ${record.id}: ${dimensions.width}x${dimensions.height} = ${aspectRatio.toFixed(3)}`)
        updated++
      }
    } else {
      console.warn(`Could not get dimensions for record ${record.id}`)
      failed++
    }

    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  console.log(`\nDone! Updated: ${updated}, Failed: ${failed}`)
  console.log('Run again to process more records if needed.')
}

main()
