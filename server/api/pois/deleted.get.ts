import { dbRecordToPOI, supabase } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)

    // 构建查询（只查询已删除的记录）
    let supabaseQuery = supabase
      .from('pois')
      .select('*')
      .not('deleted_at', 'is', null)

    // 按分类筛选
    if (query.category && query.category !== 'all') {
      supabaseQuery = supabaseQuery.eq('category', query.category)
    }

    // 按名称搜索
    if (query.search) {
      supabaseQuery = supabaseQuery.or(`name.ilike.%${query.search}%,description.ilike.%${query.search}%`)
    }

    // 排序
    const sortBy = query.sortBy as string || 'deleted_at'
    const sortOrder = query.sortOrder as string || 'desc'

    if (sortBy === 'name') {
      supabaseQuery = supabaseQuery.order('name', { ascending: sortOrder === 'asc' })
    }
    else if (sortBy === 'rating') {
      supabaseQuery = supabaseQuery.order('rating', { ascending: sortOrder === 'asc' })
    }
    else if (sortBy === 'deleted_at') {
      supabaseQuery = supabaseQuery.order('deleted_at', { ascending: sortOrder === 'asc' })
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

    // 转换为前端格式
    const pois = data.map(record => dbRecordToPOI(record))

    return {
      success: true,
      data: pois,
      count: pois.length,
    }
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch deleted POIs: ${error}`,
    })
  }
})
