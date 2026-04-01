// 提交打卡记录API
import { createClient } from '@supabase/supabase-js'
import { calculateCheckinTotalScore, calculateCompanionBonus, calculateDistance, calculateDistanceScore, SHENZHEN_CENTER } from '../../../app/utils/scoreCalculation'

// 活动结束时间（与前端保持一致）
const ACTIVITY_END_TIME = new Date('2026-06-30T23:59:59+08:00').getTime() // 2026年6月30日23:59:59 (UTC+8)

// 检查时间段是否激活
function isTimeSlotActive(timeSlot: any, checkinTime: Date): boolean {
  // 检查具体日期时间模式
  if (timeSlot.start_datetime && timeSlot.end_datetime) {
    const startTime = new Date(timeSlot.start_datetime)
    const endTime = new Date(timeSlot.end_datetime)
    return checkinTime >= startTime && checkinTime <= endTime
  }

  // 检查每日时间模式
  if (timeSlot.start_time && timeSlot.end_time) {
    const currentHour = checkinTime.getHours()
    const currentMinute = checkinTime.getMinutes()
    const currentTimeInMinutes = currentHour * 60 + currentMinute

    // 解析时间
    const [startHour, startMin] = timeSlot.start_time.split(':').map(Number)
    const [endHour, endMin] = timeSlot.end_time.split(':').map(Number)
    const startTimeInMinutes = startHour * 60 + startMin
    const endTimeInMinutes = endHour * 60 + endMin

    // 检查时间范围
    if (startTimeInMinutes <= endTimeInMinutes) {
      // 同一天的时间范围
      return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes
    }
    else {
      // 跨天的时间范围
      return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes
    }
  }

  return false
}

interface CheckinData {
  employeeId: string
  employeeName?: string
  poiId: string
  poiName: string
  comment?: string
  rating?: number
  photoUrl?: string
  coordinates: {
    latitude: number
    longitude: number
  }
  accuracy?: number
  distanceToPoi?: number
  deviceInfo?: any
  companionCount?: number
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event) as CheckinData
    const config = useRuntimeConfig()

    // 检查活动是否结束
    if (Date.now() >= ACTIVITY_END_TIME) {
      throw createError({
        statusCode: 403,
        statusMessage: '活动已结束，无法打卡',
      })
    }

    // 验证必填字段
    if (!body.employeeId || !body.poiId || !body.poiName || !body.coordinates) {
      throw createError({
        statusCode: 400,
        statusMessage: '缺少必填字段',
      })
    }

    // 验证工号格式（仅数字）
    if (!/^\d+$/.test(body.employeeId)) {
      throw createError({
        statusCode: 400,
        statusMessage: '工号必须为纯数字',
      })
    }

    // 验证建议难度等级范围（用户建议，不计入分数）
    if (body.rating && (body.rating < 1 || body.rating > 5)) {
      throw createError({
        statusCode: 400,
        statusMessage: '建议难度等级必须在1-5之间',
      })
    }

    // 验证坐标范围
    const { latitude, longitude } = body.coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw createError({
        statusCode: 400,
        statusMessage: '坐标格式错误',
      })
    }

    // 创建Supabase客户端
    const supabase = createClient(
      config.supabaseUrl,
      config.supabaseAnonKey,
    )

    // 获取POI信息，包括彩蛋配置
    const { data: poiData, error: poiError } = await supabase
      .from('pois')
      .select('id, rating, lng, lat, easter_egg')
      .eq('id', body.poiId)
      .single()

    if (poiError) {
      console.error('获取POI信息失败:', poiError)
      throw createError({
        statusCode: 500,
        statusMessage: '获取地点信息失败',
      })
    }

    if (!poiData) {
      throw createError({
        statusCode: 404,
        statusMessage: '地点不存在',
      })
    }

    // 检查用户是否已经在该POI打卡过
    const { data: existingRecord, error: checkError } = await supabase
      .from('checkin_records')
      .select('id')
      .eq('employee_id', body.employeeId)
      .eq('poi_id', body.poiId)
      .limit(1)

    if (checkError) {
      console.error('检查重复打卡失败:', checkError)
      throw createError({
        statusCode: 500,
        statusMessage: '检查打卡记录失败',
      })
    }

    if (existingRecord && existingRecord.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: '您已经在该地点打卡过了，每个地点只能打卡一次',
      })
    }

    // 获取客户端信息
    const headers = getHeaders(event)
    let clientIP = getHeader(event, 'x-forwarded-for')
      || getHeader(event, 'x-real-ip')
      || getHeader(event, 'cf-connecting-ip')
      || event.node.req.connection?.remoteAddress
      || event.node.req.socket?.remoteAddress
      || '127.0.0.1'

    // 处理多个IP地址的情况 (x-forwarded-for可能包含多个IP)
    if (clientIP && clientIP.includes(',')) {
      clientIP = clientIP.split(',')[0].trim()
    }

    // 确保IP地址格式正确，如果无效则使用默认值
    if (!clientIP || clientIP === 'unknown' || !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(clientIP)) {
      clientIP = '127.0.0.1'
    }

    // 服务端分数计算和彩蛋校验
    const checkinTime = new Date()
    const poiPosition: [number, number] = [poiData.lng, poiData.lat]

    // 计算距离和距离分数
    const distance = calculateDistance(poiPosition, SHENZHEN_CENTER)
    const distanceScore = calculateDistanceScore(distance)
    const poiBaseScore = poiData.rating || 0

    // 服务端彩蛋校验和分数计算
    let easterEggBonus = 0
    let easterEggActive = false

    if (poiData.easter_egg) {
      // 校验彩蛋激活状态
      const easterEgg = poiData.easter_egg

      // 检查时间段
      if (easterEgg.time_slots && Array.isArray(easterEgg.time_slots)) {
        for (const timeSlot of easterEgg.time_slots) {
          if (isTimeSlotActive(timeSlot, checkinTime)) {
            easterEggActive = true
            break
          }
        }
      }

      // 如果彩蛋激活，计算奖励分数
      if (easterEggActive) {
        easterEggBonus = easterEgg.bonus_score || 0
      }
    }

    // 计算总分数
    const totalScore = calculateCheckinTotalScore(
      poiBaseScore,
      distanceScore,
      body.companionCount,
      easterEggActive ? poiData.easter_egg : undefined,
      checkinTime,
    )

    // 准备插入数据
    const checkinRecord = {
      employee_id: body.employeeId,
      employee_name: body.employeeName || null,
      poi_id: body.poiId,
      poi_name: body.poiName,
      comment: body.comment || null,
      rating: body.rating || null, // 用户建议的难度等级，仅供参考，不计入分数
      photo_url: body.photoUrl || null,
      latitude: body.coordinates.latitude,
      longitude: body.coordinates.longitude,
      accuracy: body.accuracy || null,
      distance_to_poi: body.distanceToPoi || null,
      companion_count: body.companionCount || null, // 结伴人数
      is_easter_egg_checkin: easterEggActive, // 是否在彩蛋时间打卡
      is_rejected: null, // 默认未审核
      rejection_reason: null, // 默认无审核说明
      ip_address: clientIP,
      user_agent: headers['user-agent'] || null,
      device_info: body.deviceInfo || null,
    }

    // 插入数据库
    const { data, error } = await supabase
      .from('checkin_records')
      .insert(checkinRecord)
      .select()
      .single()

    if (error) {
      console.error('数据库插入错误:', error)
      console.error('错误详情:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })

      // 根据错误类型提供更具体的错误信息
      let errorMessage = '数据库操作失败'
      if (error.code === '42P01') {
        errorMessage = 'checkin_records表不存在，请联系管理员配置数据库'
      }
      else if (error.code === '42703') {
        errorMessage = '数据库表结构不匹配，请联系管理员更新表结构'
      }
      else if (error.code === '22P02') {
        errorMessage = 'IP地址格式错误'
      }

      throw createError({
        statusCode: 500,
        statusMessage: errorMessage,
        data: {
          errorCode: error.code,
          sqlError: error.message,
        },
      })
    }

    return {
      success: true,
      message: easterEggActive ? '打卡成功！获得彩蛋奖励！' : '打卡记录保存成功',
      data: {
        id: data.id,
        createdAt: data.created_at,
        score: {
          baseScore: poiBaseScore,
          distanceScore,
          companionBonus: calculateCompanionBonus(body.companionCount),
          easterEggBonus,
          totalScore,
        },
        easterEgg: easterEggActive
          ? {
              active: true,
              bonus: easterEggBonus,
              description: poiData.easter_egg?.description || '彩蛋奖励',
              icon: poiData.easter_egg?.icon || '🎁',
            }
          : null,
      },
    }
  }
  catch (error: any) {
    console.error('打卡记录提交失败:', error)

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
