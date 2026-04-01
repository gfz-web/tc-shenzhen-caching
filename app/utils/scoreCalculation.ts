/**
 * 统一的积分计算工具
 * 用于项目中所有涉及积分计算的地方，确保逻辑一致性
 */

import { centerPoint } from '~/config/map'

// 深圳中心点坐标（数睿科技深圳办公地点）
export const SHENZHEN_CENTER: [number, number] = [centerPoint.position[0], centerPoint.position[1]]

/**
 * 计算两点间直线距离（公里）
 * @param pos1 第一个坐标点 [经度, 纬度]
 * @param pos2 第二个坐标点 [经度, 纬度]
 * @returns 距离（公里）
 */
export function calculateDistance(pos1: [number, number], pos2: [number, number]): number {
  const [lng1, lat1] = pos1
  const [lng2, lat2] = pos2

  const R = 6371 // 地球半径（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * 根据距离计算距离分数（0-5分）
 * 距离越远分数越高，鼓励探索更远的地点
 * @param distance 距离（公里）
 * @returns 距离分数（0-5分）
 */
export function calculateDistanceScore(distance: number): number {
  // 限制最大距离为30公里
  const limitedDistance = Math.min(distance, 30)

  // 阶梯评分系统
  if (limitedDistance <= 10) {
    return 0 // 0-10km: 0分 (很近)
  }
  else if (limitedDistance <= 15) {
    return 1 // 10-15km: 1分 (较近)
  }
  else if (limitedDistance <= 20) {
    return 2 // 15-20km: 2分 (中等)
  }
  else if (limitedDistance <= 20) {
    return 3 // 20-25km: 3分 (较远)
  }
  else if (limitedDistance <= 30) {
    return 4 // 25-30km: 4分 (很远)
  }
  else {
    return 5 // 30km以上: 5分 (极远)
  }
}

/**
 * 计算POI的总分数
 * 总分数 = POI基础分 + 距离分数
 * 注意：不包含用户建议的难度评级，用户评级仅供其他用户参考
 * @param baseScore POI基础评分（1-5分）
 * @param distanceScore 距离分数（0-5分）
 * @returns 总分数
 */
export function calculateTotalScore(baseScore: number = 0, distanceScore: number = 0): number {
  return baseScore + distanceScore
}

/**
 * 计算POI到深圳中心点的距离和分数
 * @param poiPosition POI坐标 [经度, 纬度]
 * @returns 包含距离、距离分数和总分数的对象
 */
export function calculatePOIScores(poiPosition: [number, number], baseRating: number = 0) {
  const distance = calculateDistance(SHENZHEN_CENTER, poiPosition)
  const distanceScore = calculateDistanceScore(distance)
  const totalScore = calculateTotalScore(baseRating, distanceScore)

  return {
    distance,
    distanceScore,
    totalScore,
  }
}

/**
 * 获取距离分数对应的级别描述
 * @param distanceScore 距离分数（0-5）
 * @returns 级别描述
 */
export function getDistanceLevel(distanceScore: number): string {
  const levels = ['很近', '较近', '中等', '较远', '很远', '极远']
  return levels[distanceScore] || '未知'
}

/**
 * 格式化距离显示
 * @param distance 距离（公里）
 * @returns 格式化的距离字符串
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`
  }
  else {
    return `${distance.toFixed(1)}km`
  }
}

/**
 * 格式化评分显示
 * @param rating 评分
 * @returns 格式化的评分字符串
 */
export function formatRating(rating?: number): string {
  if (!rating)
    return '-'
  return `${rating}分`
}

/**
 * 格式化距离分数显示
 * @param distanceScore 距离分数
 * @returns 格式化的距离分数字符串
 */
export function formatDistanceScore(distanceScore?: number): string {
  if (distanceScore === undefined || distanceScore === null)
    return '-'
  return `${distanceScore}分 (${getDistanceLevel(distanceScore)})`
}

/**
 * 格式化总分数显示
 * @param totalScore 总分数
 * @returns 格式化的总分数字符串
 */
export function formatTotalScore(totalScore?: number): string {
  if (totalScore === undefined || totalScore === null)
    return '-'
  return `${totalScore}分`
}

/**
 * 计算结伴人数加分
 * 规则：2人及以上每多1人加1分（包含自己），最多5分
 * @param companionCount 结伴人数（包含自己）
 * @returns 结伴加分
 */
export function calculateCompanionBonus(companionCount?: number): number {
  if (!companionCount || companionCount < 2) {
    return 0
  }

  // 2人及以上每多1人加1分，最多5分
  const bonus = companionCount - 1 // 2人加1分，3人加2分，以此类推
  return Math.min(bonus, 5) // 限制最大加分为5分
}

/**
 * 检查时间段是否激活
 * @param timeSlot 时间段配置
 * @param checkinTime 打卡时间
 * @returns 是否在时间段内
 */
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

/**
 * 检查当前时间是否在彩蛋激活时间范围内
 * @param easterEgg 彩蛋配置
 * @param checkinTime 打卡时间（可选，默认当前时间）
 * @returns 是否在彩蛋时间范围内
 */
export function isEasterEggActive(easterEgg: any, checkinTime?: Date): boolean {
  if (!easterEgg || !easterEgg.time_slots || !Array.isArray(easterEgg.time_slots))
    return false

  const checkTime = checkinTime || new Date()

  // 检查时间段
  for (const timeSlot of easterEgg.time_slots) {
    if (isTimeSlotActive(timeSlot, checkTime)) {
      return true
    }
  }

  return false
}

/**
 * 计算彩蛋加分
 * @param easterEgg 彩蛋配置
 * @param checkinTime 打卡时间（可选，默认当前时间）
 * @returns 彩蛋加分
 */
export function calculateEasterEggBonus(easterEgg: any, checkinTime?: Date): number {
  if (!easterEgg || !isEasterEggActive(easterEgg, checkinTime)) {
    return 0
  }

  return easterEgg.bonus_score || 0
}

/**
 * 计算打卡总分数（包含结伴加分和彩蛋加分）
 * 总分数 = POI基础分 + 距离分数 + 结伴加分 + 彩蛋加分
 * @param baseScore POI基础评分（1-5分）
 * @param distanceScore 距离分数（0-5分）
 * @param companionCount 结伴人数（可选）
 * @param easterEgg 彩蛋配置（可选）
 * @param checkinTime 打卡时间（可选，默认当前时间）
 * @returns 总分数
 */
export function calculateCheckinTotalScore(
  baseScore: number = 0,
  distanceScore: number = 0,
  companionCount?: number,
  easterEgg?: any,
  checkinTime?: Date,
): number {
  const companionBonus = calculateCompanionBonus(companionCount)
  const easterEggBonus = calculateEasterEggBonus(easterEgg, checkinTime)
  return baseScore + distanceScore + companionBonus + easterEggBonus
}

/**
 * 格式化结伴加分显示
 * @param companionCount 结伴人数
 * @returns 格式化的结伴加分字符串
 */
export function formatCompanionBonus(companionCount?: number): string {
  const bonus = calculateCompanionBonus(companionCount)
  if (bonus === 0) {
    return '无结伴加分'
  }
  return `+${bonus}分 (${companionCount}人结伴)`
}

/**
 * 格式化彩蛋加分显示
 * @param easterEgg 彩蛋配置
 * @param checkinTime 打卡时间（可选，默认当前时间）
 * @returns 格式化的彩蛋加分字符串
 */
export function formatEasterEggBonus(easterEgg: any, checkinTime?: Date): string {
  const bonus = calculateEasterEggBonus(easterEgg, checkinTime)
  if (bonus === 0) {
    return '无彩蛋加分'
  }
  const icon = easterEgg?.icon || '🎁'
  return `+${bonus}分 ${icon} 彩蛋奖励`
}

/**
 * 获取彩蛋的显示信息
 * @param easterEgg 彩蛋配置
 * @param checkinTime 打卡时间（可选，默认当前时间）
 * @returns 彩蛋显示信息
 */
export function getEasterEggDisplayInfo(easterEgg: any, checkinTime?: Date) {
  if (!easterEgg) {
    return null
  }

  const isActive = isEasterEggActive(easterEgg, checkinTime)
  const icon = easterEgg.icon || '🎁'
  const description = easterEgg.description || '特殊时段彩蛋'

  return {
    isActive,
    icon,
    description,
    bonusScore: easterEgg.bonus_score || 0,
    timeRange: `${easterEgg.start_time}-${easterEgg.end_time}`,
  }
}
