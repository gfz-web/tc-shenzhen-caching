import { calculatePOIScores } from '../../../app/utils/scoreCalculation'
import { dbRecordToPOI, supabase } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)

    // 构建查询（只查询未删除的记录）
    let supabaseQuery = supabase
      .from('pois')
      .select('*')
      .is('deleted_at', null)

    // 按分类筛选
    if (query.category && query.category !== 'all') {
      supabaseQuery = supabaseQuery.eq('category', query.category)
    }

    // 按名称搜索
    if (query.search) {
      supabaseQuery = supabaseQuery.or(`name.ilike.%${query.search}%,description.ilike.%${query.search}%`)
    }

    // 排序
    const sortBy = query.sortBy as string || 'created_at'
    const sortOrder = query.sortOrder as string || 'desc'

    if (sortBy === 'name') {
      supabaseQuery = supabaseQuery.order('name', { ascending: sortOrder === 'asc' })
    }
    else if (sortBy === 'rating') {
      supabaseQuery = supabaseQuery.order('rating', { ascending: sortOrder === 'asc' })
    }
    else {
      supabaseQuery = supabaseQuery.order('created_at', { ascending: sortOrder === 'asc' })
    }

    const { data, error } = await supabaseQuery

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${error.message}`,
      })
    }

    // 转换为前端格式并计算距离相关数据
    const pois = data.map((record) => {
      const poi = dbRecordToPOI(record)

      // 使用统一的积分计算工具
      const scores = calculatePOIScores(poi.position, poi.rating || 0)

      poi.distance = scores.distance
      poi.distanceScore = scores.distanceScore
      poi.totalScore = scores.totalScore

      return poi
    })

    // 根据查询参数进行距离相关的排序
    if (sortBy === 'distance') {
      pois.sort((a, b) => {
        return sortOrder === 'asc' ? a.distance! - b.distance! : b.distance! - a.distance!
      })
    }
    else if (sortBy === 'distanceScore') {
      pois.sort((a, b) => {
        return sortOrder === 'asc' ? a.distanceScore! - b.distanceScore! : b.distanceScore! - a.distanceScore!
      })
    }
    else if (sortBy === 'totalScore') {
      pois.sort((a, b) => {
        return sortOrder === 'asc' ? a.totalScore! - b.totalScore! : b.totalScore! - a.totalScore!
      })
    }

    return {
      success: true,
      data: pois,
      count: pois.length,
    }
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch POIs: ${error}`,
    })
  }
})
