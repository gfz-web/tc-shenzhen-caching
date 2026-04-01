import { supabase } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'POI ID is required',
      })
    }

    // 软删除POI（设置deleted_at时间戳）
    const { error } = await supabase
      .from('pois')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${error.message}`,
      })
    }

    return {
      success: true,
      message: 'POI deleted successfully',
    }
  }
  catch (error) {
    if (error.statusCode) {
      throw error // 重新抛出已知错误
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to delete POI: ${error}`,
    })
  }
})
