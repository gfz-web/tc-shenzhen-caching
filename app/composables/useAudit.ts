import { computed, ref } from 'vue'

export interface AuditRecord {
  id: string
  employeeId: string
  employeeName?: string
  poiId: string
  poiName: string
  comment: string
  rating: number
  photo?: string
  timestamp: number
  coordinates: {
    lat: number
    lng: number
  }
  distance: number
  accuracy?: number
  companionCount?: number
  isRejected: boolean | null
  rejectionReason?: string
  createdAt: string
}

export function useAudit() {
  // 审核相关状态
  const showAuditPanel = ref(false)
  const auditRecords = ref<AuditRecord[]>([])
  const isLoadingAuditRecords = ref(false)
  const includeAudited = ref(false)
  const auditDays = ref(7) // 默认过去7天

  // 审核选项
  const auditOptions = [
    { value: 'approve', label: '通过', icon: '✅' },
    { value: 'reject', label: '拒绝', icon: '❌' },
    { value: 'pending', label: '待审核', icon: '⏳' },
  ]

  // 计算过滤后的审核记录
  const filteredAuditRecords = computed(() => {
    if (!includeAudited.value) {
      // 只显示未审核的记录（isRejected为null）
      return auditRecords.value.filter(record => record.isRejected === null)
    }
    // 已审核包括isRejected为true或false的记录
    return auditRecords.value.filter(record => record.isRejected !== null)
  })

  // 获取审核记录
  async function fetchAuditRecords() {
    isLoadingAuditRecords.value = true

    try {
      // 计算日期范围
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - auditDays.value)

      const queryParams = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })

      const response = await $fetch(`/api/checkin?${queryParams}`)

      if (response.success && response.data) {
        // 转换数据格式
        auditRecords.value = response.data.map((record: any) => ({
          id: record.id,
          employeeId: record.employee_id,
          employeeName: record.employee_name,
          poiId: record.poi_id,
          poiName: record.poi_name,
          comment: record.comment || '',
          rating: record.rating || 0,
          photo: record.photo_url,
          timestamp: new Date(record.created_at).getTime(),
          coordinates: {
            lat: record.latitude,
            lng: record.longitude,
          },
          distance: record.distance_to_poi || 0,
          accuracy: record.accuracy,
          companionCount: record.companion_count,
          isRejected: record.is_rejected,
          rejectionReason: record.rejection_reason,
          createdAt: record.created_at,
        }))
      }
    }
    catch (error) {
      console.error('获取审核记录失败:', error)
    }
    finally {
      isLoadingAuditRecords.value = false
    }
  }

  // 审核记录
  async function auditRecord(recordId: string, action: 'approve' | 'reject', reason?: string) {
    try {
      const response = await $fetch(`/api/checkin/${recordId}`, {
        method: 'PUT',
        body: {
          isRejected: action === 'reject',
          rejectionReason: action === 'reject' ? reason : null,
        },
      }) as any

      if (response?.success) {
        // 更新本地记录
        const recordIndex = auditRecords.value.findIndex(r => r.id === recordId)
        if (recordIndex !== -1 && auditRecords.value[recordIndex]) {
          auditRecords.value[recordIndex]!.isRejected = action === 'reject'
          auditRecords.value[recordIndex]!.rejectionReason = action === 'reject' ? reason : undefined
        }
        return true
      }
    }
    catch (error) {
      console.error('审核记录失败:', error)
      return false
    }
  }

  // 修改同行人数
  async function updateCompanionCount(recordId: string, companionCount: number | null) {
    try {
      const response = await $fetch(`/api/checkin/${recordId}`, {
        method: 'PUT',
        body: {
          companionCount,
        },
      }) as any

      if (response?.success) {
        // 更新本地记录
        const recordIndex = auditRecords.value.findIndex(r => r.id === recordId)
        if (recordIndex !== -1 && auditRecords.value[recordIndex]) {
          auditRecords.value[recordIndex]!.companionCount = companionCount ?? undefined
        }
        return true
      }
      return false
    }
    catch (error) {
      console.error('修改同行人数失败:', error)
      return false
    }
  }

  // 批量审核
  async function batchAudit(recordIds: string[], action: 'approve' | 'reject', reason?: string) {
    const results = await Promise.allSettled(
      recordIds.map(id => auditRecord(id, action, reason)),
    )

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length
    return { successCount, totalCount: recordIds.length }
  }

  // 切换审核面板
  function toggleAuditPanel() {
    showAuditPanel.value = !showAuditPanel.value
    if (showAuditPanel.value && auditRecords.value.length === 0) {
      fetchAuditRecords()
    }
  }

  // 关闭审核面板
  function closeAuditPanel() {
    showAuditPanel.value = false
  }

  // 格式化时间
  function formatAuditTime(timestamp: number): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return '今天'
    }
    else if (diffDays === 1) {
      return '昨天'
    }
    else if (diffDays < 7) {
      return `${diffDays}天前`
    }
    else {
      return date.toLocaleDateString()
    }
  }

  // 获取审核状态文本
  function getAuditStatusText(record: AuditRecord): string {
    if (record.isRejected === true) {
      return '已拒绝'
    }
    if (record.rejectionReason) {
      return '已拒绝'
    }
    return '待审核'
  }

  // 获取审核状态样式类
  function getAuditStatusClass(record: AuditRecord): string {
    if (record.isRejected === true) {
      return 'audit-rejected'
    }
    if (record.rejectionReason) {
      return 'audit-rejected'
    }
    return 'audit-pending'
  }

  return {
    // 状态
    showAuditPanel: readonly(showAuditPanel),
    auditRecords: readonly(auditRecords),
    filteredAuditRecords,
    isLoadingAuditRecords: readonly(isLoadingAuditRecords),
    includeAudited,
    auditDays,
    auditOptions,

    // 方法
    fetchAuditRecords,
    auditRecord,
    batchAudit,
    updateCompanionCount,
    toggleAuditPanel,
    closeAuditPanel,
    formatAuditTime,
    getAuditStatusText,
    getAuditStatusClass,
  }
}
