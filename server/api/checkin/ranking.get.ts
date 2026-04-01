// 获取打卡排行榜API
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { calculateCheckinTotalScore, calculateDistance, calculateDistanceScore, SHENZHEN_CENTER } from '../../../app/utils/scoreCalculation'

// 处理图片URL，确保返回完整的URL
function _processImageUrl(imageUrl?: string): string | undefined {
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

export default defineEventHandler(async (_event) => {
  try {
    const config = useRuntimeConfig()

    // 创建Supabase客户端
    const supabase = createClient(
      config.supabaseUrl,
      config.supabaseAnonKey,
    )

    // 获取所有打卡记录（只查询未删除且审核通过的记录）
    const { data: checkinData, error: checkinError } = await supabase
      .from('checkin_records')
      .select('employee_id, employee_name, rating, photo_url, comment, created_at, poi_id, companion_count, is_easter_egg_checkin, is_rejected')
      .is('deleted_at', null)
      .or('is_rejected.is.null,is_rejected.eq.false')
      .order('created_at', { ascending: false })

    if (checkinError) {
      console.error('获取打卡记录失败:', checkinError)
      throw createError({
        statusCode: 500,
        statusMessage: '获取排行榜数据失败',
      })
    }

    // 获取所有POI信息（只查询未删除的记录）
    const { data: poisData, error: poisError } = await supabase
      .from('pois')
      .select('id, rating, lng, lat, easter_egg')
      .is('deleted_at', null)

    if (poisError) {
      console.error('获取POI数据失败:', poisError)
      throw createError({
        statusCode: 500,
        statusMessage: '获取POI数据失败',
      })
    }

    // 创建POI映射表以便快速查询
    const poisMap = new Map()
    poisData.forEach((poi) => {
      poisMap.set(poi.id, poi)
    })

    // 使用统一的中心点坐标（数睿科技深圳办公地点）

    // 计算每个用户的积分
    const userScores: Record<string, {
      employeeId: string
      employeeName: string
      totalScore: number
      checkinCount: number
      lastCheckinTime: string
    }> = {}

    checkinData.forEach((record) => {
      const key = record.employee_id
      if (!userScores[key]) {
        userScores[key] = {
          employeeId: record.employee_id,
          employeeName: record.employee_name || '匿名用户',
          totalScore: 0,
          checkinCount: 0,
          lastCheckinTime: record.created_at,
        }
      }

      // 从POI映射表中获取POI信息
      const poi = poisMap.get(record.poi_id)
      if (!poi) {
        // 如果找不到POI，使用默认分数
        console.warn(`找不到POI: ${record.poi_id}`)
        userScores[key].totalScore += 3 // 默认基础分
        userScores[key].checkinCount += 1
        return
      }

      // 计算POI到中心点的距离
      const distance = calculateDistance(
        SHENZHEN_CENTER,
        [poi.lng, poi.lat],
      )

      // 计算积分：POI基础分 + 距离分数 + 结伴加分 + 彩蛋加分
      const poiBaseScore = poi.rating || 0 // POI基础评分
      const distanceScore = calculateDistanceScore(distance) // 距离分数
      const companionCount = record.companion_count || undefined // 结伴人数
      const easterEgg = (record.is_easter_egg_checkin && poi.easter_egg) ? poi.easter_egg : undefined // 只有标记为彩蛋打卡才使用彩蛋配置
      const checkinTime = new Date(record.created_at) // 打卡时间
      const finalScore = calculateCheckinTotalScore(poiBaseScore, distanceScore, companionCount, easterEgg, checkinTime)

      userScores[key].totalScore += finalScore
      userScores[key].checkinCount += 1

      // 更新最后打卡时间（保持最新的）
      if (new Date(record.created_at) > new Date(userScores[key].lastCheckinTime)) {
        userScores[key].lastCheckinTime = record.created_at
      }
    })

    // 转换为数组并排序
    const rankings = Object.values(userScores)
      .sort((a, b) => {
        // 先按总积分从高到低排序
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore
        }
        // 同分情况下，按最后打卡时间从早到晚排序（先打卡的排在前面）
        return new Date(a.lastCheckinTime).getTime() - new Date(b.lastCheckinTime).getTime()
      })

    return {
      success: true,
      data: rankings,
    }
  }
  catch (error: any) {
    console.error('排行榜API错误:', error)

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
