// 更新打卡记录API（主要用于审核）
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const recordId = getRouterParam(event, 'id')
    const body = await readBody(event)

    if (!recordId) {
      throw createError({
        statusCode: 400,
        statusMessage: '记录ID不能为空',
      })
    }

    // 创建Supabase客户端
    const supabase = createClient(
      config.supabaseUrl,
      config.supabaseAnonKey,
    )

    // 构建更新数据
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    // 审核相关字段
    if (typeof body.isRejected === 'boolean') {
      updateData.is_rejected = body.isRejected
    }

    if (body.rejectionReason !== undefined) {
      updateData.rejection_reason = body.rejectionReason
    }

    // 同行人数修改
    if ('companionCount' in body) {
      // 允许null或大于等于0的数字
      if (body.companionCount === null || body.companionCount === undefined) {
        updateData.companion_count = null
      }
      else if (typeof body.companionCount === 'number' && body.companionCount >= 0) {
        updateData.companion_count = body.companionCount
      }
    }

    // 执行更新
    const { data, error } = await supabase
      .from('checkin_records')
      .update(updateData)
      .eq('id', recordId)
      .is('deleted_at', null) // 确保不更新已删除的记录
      .select()

    if (error) {
      console.error('更新打卡记录失败:', error)
      throw createError({
        statusCode: 500,
        statusMessage: '更新失败',
      })
    }

    if (!data || data.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: '记录不存在或已被删除',
      })
    }

    return {
      success: true,
      data: data[0],
      message: '更新成功',
    }
  }
  catch (error: any) {
    console.error('更新打卡记录错误:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: '服务器内部错误',
    })
  }
})
