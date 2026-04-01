import type { POIData } from '../../../app/types/amap'
import { poiToDbRecord, supabase } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // 验证必需字段
    if (!body.name || !body.position || !Array.isArray(body.position) || body.position.length !== 2) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: name and position [lng, lat]',
      })
    }

    // 生成唯一ID
    const poi: POIData = {
      id: `poi-${Math.random().toString(36).substr(2, 8)}`,
      name: body.name,
      description: body.description,
      rating: body.rating || 1,
      position: body.position,
      category: body.category || '其他',
      referencePhoto: body.referencePhoto,
      easter_egg: body.easter_egg,
    }

    // 转换为数据库格式
    const dbRecord = poiToDbRecord(poi)

    // 插入到数据库
    const { data: _data, error } = await supabase
      .from('pois')
      .insert([dbRecord])
      .select()
      .single()

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${error.message}`,
      })
    }

    return {
      success: true,
      message: 'POI created successfully',
      data: poi,
    }
  }
  catch (error: any) {
    if (error.statusCode) {
      throw error // 重新抛出已知错误
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create POI: ${error}`,
    })
  }
})
