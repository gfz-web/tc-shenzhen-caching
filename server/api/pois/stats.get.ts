// 获取POI打卡统计API
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (_event) => {
  try {
    const config = useRuntimeConfig()

    // 创建Supabase客户端
    const supabase = createClient(
      config.supabaseUrl,
      config.supabaseAnonKey,
    )

    // 获取每个POI的打卡统计
    const { data, error } = await supabase
      .from('checkin_records')
      .select('poi_id, employee_id')

    if (error) {
      console.error('获取打卡统计失败:', error)
      throw createError({
        statusCode: 500,
        statusMessage: '获取打卡统计失败',
      })
    }

    // 计算每个POI的打卡人数（去重）
    const poiStats: Record<string, {
      poiId: string
      checkinCount: number
      uniqueUsers: number
    }> = {}

    data.forEach((record) => {
      const poiId = record.poi_id
      if (!poiStats[poiId]) {
        poiStats[poiId] = {
          poiId,
          checkinCount: 0,
          uniqueUsers: 0,
        }
      }
      poiStats[poiId].checkinCount += 1
    })

    // 计算每个POI的唯一用户数
    const usersByPOI: Record<string, Set<string>> = {}
    data.forEach((record) => {
      const poiId = record.poi_id
      if (!usersByPOI[poiId]) {
        usersByPOI[poiId] = new Set()
      }
      usersByPOI[poiId].add(record.employee_id)
    })

    // 更新唯一用户数
    Object.keys(poiStats).forEach((poiId) => {
      poiStats[poiId].uniqueUsers = usersByPOI[poiId]?.size || 0
    })

    return {
      success: true,
      data: Object.values(poiStats),
    }
  }
  catch (error: any) {
    console.error('POI统计API错误:', error)

    // 如果是已知错误，直接抛出
    if (error.statusCode) {
      throw error
    }

    // 未知错误
    throw createError({
      statusCode: 500,
      statusMessage: '服务器内部错误',
    })
  }
})
