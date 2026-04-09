// 查询打卡记录API
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

// 处理图片URL，确保返回完整的URL
function processImageUrl(imageUrl?: string): string | undefined {
  if (!imageUrl) {
    return undefined
  }

  // 如果已经是完整URL，直接返回
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl
  }

  // 如果是Base64数据，直接返回
  if (imageUrl.startsWith('data:')) {
    return imageUrl
  }

  // 如果包含COS域名，说明已经是完整的COS URL，只需要添加https协议
  if (imageUrl.includes('.cos.') && imageUrl.includes('.myqcloud.com')) {
    return `https://${imageUrl}`
  }

  // 如果是COS文件key，构建完整URL
  try {
    const cosConfig = {
      Bucket: process.env.NUXT_TENCENT_COS_BUCKET || '',
      Region: process.env.NUXT_TENCENT_COS_REGION || 'ap-guangzhou',
      Domain: process.env.NUXT_TENCENT_COS_DOMAIN || undefined,
    }

    if (cosConfig.Domain) {
      // 确保Domain配置正确，去掉多余的协议前缀
      const domain = cosConfig.Domain.replace(/^https?:\/\//, '')
      return `https://${domain}/${imageUrl}`
    }

    // 使用标准的COS访问格式
    return `https://${cosConfig.Bucket}.cos.${cosConfig.Region}.myqcloud.com/${imageUrl}`
  }
  catch (error) {
    console.warn('处理图片URL失败:', error)
    return imageUrl
  }
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const config = useRuntimeConfig()

    // 创建Supabase客户端
    const supabase = createClient(
      config.supabaseUrl,
      config.supabaseAnonKey,
    )

    // 构建查询（只查询未删除的记录）
    let queryBuilder = supabase
      .from('checkin_records')
      .select(`
        id,
        employee_id,
        employee_name,
        poi_id,
        poi_name,
        comment,
        rating,
        photo_url,
        latitude,
        longitude,
        accuracy,
        distance_to_poi,
        companion_count,
        is_rejected,
        rejection_reason,
        created_at
      `)
      .is('deleted_at', null)

    // 按工号筛选
    if (query.employeeId) {
      queryBuilder = queryBuilder.eq('employee_id', query.employeeId)
    }

    // 按POI筛选
    if (query.poiId) {
      queryBuilder = queryBuilder.eq('poi_id', query.poiId)
    }

    // 按日期范围筛选
    if (query.startDate) {
      queryBuilder = queryBuilder.gte('created_at', query.startDate)
    }
    if (query.endDate) {
      queryBuilder = queryBuilder.lte('created_at', query.endDate)
    }

    // 按创建时间倒序排列
    queryBuilder = queryBuilder.order('created_at', { ascending: false })

    const { data, error } = await queryBuilder

    if (error) {
      console.error('查询打卡记录失败:', error)
      throw createError({
        statusCode: 500,
        statusMessage: '查询失败',
      })
    }

    // 处理图片URL
    const processedData = (data || []).map(record => ({
      ...record,
      photo_url: record.photo_url,
    }))

    return {
      success: true,
      data: processedData,
    }
  }
  catch (error: any) {
    console.error('查询打卡记录错误:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: '服务器内部错误',
    })
  }
})
