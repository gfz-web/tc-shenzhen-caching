import type { POIData } from '../../../app/types/amap'
import { supabase } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    // 获取POI ID
    const id = getRouterParam(event, 'id')
    if (!id) {
      return {
        success: false,
        message: 'POI ID is required',
        data: null,
      }
    }

    // 获取请求体
    const body = await readBody(event)

    // 验证必要字段
    if (!body.name || typeof body.name !== 'string') {
      return {
        success: false,
        message: 'Name is required and must be a string',
        data: null,
      }
    }

    if (!body.position || !Array.isArray(body.position) || body.position.length !== 2) {
      return {
        success: false,
        message: 'Position must be an array of [longitude, latitude]',
        data: null,
      }
    }

    // 构建更新的POI数据
    const updatedPOI: Partial<POIData> = {
      name: body.name.trim(),
      description: body.description || '',
      rating: body.rating || 3,
      position: body.position,
      category: body.category || '景点',
      referencePhoto: body.referencePhoto,
      easter_egg: body.easter_egg === null ? null : body.easter_egg,
    }

    // 转换为数据库记录格式（只包含需要更新的字段）
    const dbUpdate = {
      name: updatedPOI.name,
      description: updatedPOI.description,
      rating: updatedPOI.rating,
      lng: updatedPOI.position![0],
      lat: updatedPOI.position![1],
      category: updatedPOI.category,
      reference_photo: updatedPOI.referencePhoto,
      easter_egg: updatedPOI.easter_egg,
    }

    // 更新到数据库（只更新未删除的记录）
    const { data, error } = await supabase
      .from('pois')
      .update(dbUpdate)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      console.error('Supabase更新错误:', error)
      return {
        success: false,
        message: `Database error: ${error.message}`,
        data: null,
      }
    }

    if (!data) {
      return {
        success: false,
        message: 'POI not found or update failed',
        data: null,
      }
    }

    // 转换数据库记录为前端格式
    const updatedPOIData = {
      id: data.id,
      name: data.name,
      description: data.description,
      rating: data.rating,
      position: [data.lng, data.lat] as [number, number],
      category: data.category,
      referencePhoto: data.reference_photo,
      easter_egg: data.easter_egg,
    }

    return {
      success: true,
      message: 'POI updated successfully',
      data: updatedPOIData,
    }
  }
  catch (error) {
    console.error('更新POI错误:', error)
    return {
      success: false,
      message: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
    }
  }
})
