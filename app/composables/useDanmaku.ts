import type { CheckinRecord } from './useCheckin'

interface DanmakuRecord {
  id: string
  employeeId: string
  employeeName?: string
  poiName: string
  timestamp: number
}

export function useDanmaku() {
  const danmakuRecords = ref<DanmakuRecord[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 从store中获取打卡记录数据，转换为弹幕格式
  function updateDanmakuFromStore(checkinRecords: any[]) {
    try {
      isLoading.value = true
      error.value = null

      if (checkinRecords && checkinRecords.length > 0) {
        // 转换数据格式，取最近10条记录
        danmakuRecords.value = checkinRecords
          .slice(0, 10)
          .map((record: any) => ({
            id: record.id,
            employeeId: record.employeeId,
            employeeName: record.employeeName,
            poiName: record.poiName,
            timestamp: record.timestamp,
          }))
      }
    }
    catch (err) {
      console.error('处理弹幕数据失败:', err)
      error.value = err instanceof Error ? err.message : '处理数据失败'
    }
    finally {
      isLoading.value = false
    }
  }

  // 添加新的打卡记录到弹幕
  function addNewCheckinRecord(record: CheckinRecord) {
    const danmakuRecord: DanmakuRecord = {
      id: record.id,
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      poiName: record.poiName,
      timestamp: record.timestamp,
    }

    // 添加到列表开头
    danmakuRecords.value.unshift(danmakuRecord)

    // 保持最多10条记录
    if (danmakuRecords.value.length > 10) {
      danmakuRecords.value = danmakuRecords.value.slice(0, 10)
    }
  }

  // 移除自动获取，避免重复请求
  // 数据获取由调用方控制

  return {
    danmakuRecords: readonly(danmakuRecords),
    isLoading: readonly(isLoading),
    error: readonly(error),
    updateDanmakuFromStore,
    addNewCheckinRecord,
  }
}
