import { supabase } from '../../../../utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')

    if (!id) {
      return {
        success: false,
        message: 'POI ID is required',
        data: null,
      }
    }

    // 恢复软删除的POI
    const { data, error } = await supabase
      .from('pois')
      .update({ deleted_at: null })
      .eq('id', id)
      .not('deleted_at', 'is', null)
      .select()
      .single()

    if (error) {
      console.error('恢复POI错误:', error)
      return {
        success: false,
        message: `Database error: ${error.message}`,
        data: null,
      }
    }

    if (!data) {
      return {
        success: false,
        message: 'POI not found or not deleted',
        data: null,
      }
    }

    // 转换数据库记录为前端格式
    const restoredPOI = {
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
      message: 'POI restored successfully',
      data: restoredPOI,
    }
  }
  catch (error) {
    console.error('恢复POI错误:', error)
    return {
      success: false,
      message: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
    }
  }
})
