<script setup lang="ts">
import { useAudit } from '~/composables/useAudit'
import { usePOIData } from '~/composables/usePOIData'
import { calculateCheckinTotalScore, calculateCompanionBonus, calculateEasterEggBonus, calculatePOIScores, formatDistance } from '~/utils/scoreCalculation'

// Props
interface Props {
  show: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  close: []
  showPhoto: [photoUrl: string]
}>()

// 审核功能
const {
  auditRecords,
  filteredAuditRecords,
  isLoadingAuditRecords,
  includeAudited,
  auditDays,
  fetchAuditRecords,
  auditRecord,
  batchAudit,
  updateCompanionCount,
  formatAuditTime,
  getAuditStatusText,
  getAuditStatusClass,
} = useAudit()

// POI数据
const { pois } = usePOIData()

// 审核相关状态
const selectedRecords = ref<string[]>([])
const rejectReason = ref('')
const showRejectForm = ref(false)
const currentRejectRecordId = ref<string | null>(null)
const isBatchReject = ref(false)

// 修改人数相关状态
const showCompanionModal = ref(false)
const currentEditRecordId = ref<string | null>(null)
const editingCompanionCount = ref(1)

// 轮播图状态
const currentIndex = ref(0)

// 视图模式
const viewMode = ref<'list' | 'carousel'>('carousel')

// 选择记录
function toggleRecordSelection(recordId: string) {
  const index = selectedRecords.value.indexOf(recordId)
  if (index > -1) {
    selectedRecords.value.splice(index, 1)
  }
  else {
    selectedRecords.value.push(recordId)
  }
}

// 全选/取消全选
function toggleSelectAll() {
  if (selectedRecords.value.length === filteredAuditRecords.value.length) {
    selectedRecords.value = []
  }
  else {
    selectedRecords.value = filteredAuditRecords.value.map(r => r.id)
  }
}

// 处理单个通过
async function handleSingleApprove(recordId: string) {
  await auditRecord(recordId, 'approve')
  await fetchAuditRecords()
}

// 处理单个拒绝
function handleSingleReject(recordId: string) {
  currentRejectRecordId.value = recordId
  isBatchReject.value = false
  rejectReason.value = ''
  showRejectForm.value = true
}

// 轮播图控制方法
function nextSlide() {
  if (currentIndex.value < filteredAuditRecords.value.length - 1) {
    currentIndex.value++
  }
}

function prevSlide() {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

// 轮播图审核方法
async function handleCarouselApprove(recordId: string) {
  await auditRecord(recordId, 'approve')
  await fetchAuditRecords()
  // 审核完成后自动切换到下一个
  if (currentIndex.value < filteredAuditRecords.value.length - 1) {
    currentIndex.value++
  }
}

function handleCarouselReject(recordId: string) {
  currentRejectRecordId.value = recordId
  isBatchReject.value = false
  rejectReason.value = ''
  showRejectForm.value = true
}

// 执行审核
async function performAudit(action: 'approve' | 'reject') {
  if (selectedRecords.value.length === 0) {
    return
  }

  if (action === 'approve') {
    // 批量通过
    await batchAudit(selectedRecords.value, action)
    selectedRecords.value = []
    await fetchAuditRecords()
  }
  else {
    // 批量拒绝 - 显示拒绝原因表单
    isBatchReject.value = true
    currentRejectRecordId.value = null
    rejectReason.value = ''
    showRejectForm.value = true
  }
}

// 处理拒绝确认
async function handleRejectConfirm() {
  if (!rejectReason.value.trim()) {
    // 如果拒绝理由为空，使用默认理由
    rejectReason.value = '照片不符合要求'
  }

  if (isBatchReject.value) {
    // 批量拒绝
    await batchAudit(selectedRecords.value, 'reject', rejectReason.value)
    selectedRecords.value = []
    await fetchAuditRecords()
  }
  else if (currentRejectRecordId.value) {
    // 单个拒绝
    await auditRecord(currentRejectRecordId.value, 'reject', rejectReason.value)
    await fetchAuditRecords()
    // 轮播图中拒绝后自动切换到下一个
    if (currentIndex.value < filteredAuditRecords.value.length - 1) {
      currentIndex.value++
    }
  }

  // 重置状态
  showRejectForm.value = false
  rejectReason.value = ''
  currentRejectRecordId.value = null
  isBatchReject.value = false
}

// 关闭面板
function closePanel() {
  emit('close')
}

// 打开修改人数弹窗
function openCompanionModal(recordId: string, currentCount?: number) {
  currentEditRecordId.value = recordId
  editingCompanionCount.value = currentCount || 1
  showCompanionModal.value = true
}

// 确认修改人数
async function confirmUpdateCompanionCount() {
  if (!currentEditRecordId.value || editingCompanionCount.value < 0) {
    return
  }

  // 如果人数为0或1，传null给数据库
  const companionCount = (editingCompanionCount.value === 0 || editingCompanionCount.value === 1)
    ? null
    : editingCompanionCount.value

  const success = await updateCompanionCount(currentEditRecordId.value, companionCount)
  if (success) {
    showCompanionModal.value = false
    currentEditRecordId.value = null
    editingCompanionCount.value = 1
  }
}

// 获取打卡记录的总分数（包含结伴加分）
function getRecordTotalScore(record: any): number {
  const poi = pois.value.find(p => p.id === record.poiId)
  if (!poi) {
    // 如果找不到POI，尝试从打卡记录的坐标计算分数
    if (record.coordinates) {
      const poiScores = calculatePOIScores([record.coordinates.lng, record.coordinates.lat], 1)
      return calculateCheckinTotalScore(1, poiScores.distanceScore, record.companionCount, undefined, new Date(record.timestamp))
    }
    else {
      // 如果连坐标都没有，使用最小分数（包含结伴加分）
      return calculateCheckinTotalScore(1, 0, record.companionCount, undefined, new Date(record.timestamp))
    }
  }

  // 使用统一的积分计算工具计算POI分数（点位分数+距离分数+结伴加分）
  const poiScores = calculatePOIScores([poi.position[0], poi.position[1]], poi.rating || 0)
  return calculateCheckinTotalScore(poi.rating || 0, poiScores.distanceScore, record.companionCount, poi.easter_egg, new Date(record.timestamp))
}

// 获取积分计算公式展示
function getScoreFormula(record: any): string {
  const poi = pois.value.find(p => p.id === record.poiId)
  let baseScore = 1
  let distanceScore = 0
  let companionBonus = 0
  let easterEggBonus = 0

  if (poi) {
    baseScore = poi.rating || 1
    const poiScores = calculatePOIScores([poi.position[0], poi.position[1]], baseScore)
    distanceScore = poiScores.distanceScore

    // 计算彩蛋加分
    if (poi.easter_egg && record.timestamp) {
      easterEggBonus = calculateEasterEggBonus(poi.easter_egg, new Date(record.timestamp))
    }
  }
  else if (record.coordinates) {
    const poiScores = calculatePOIScores([record.coordinates.lng, record.coordinates.lat], 1)
    distanceScore = poiScores.distanceScore
  }

  companionBonus = calculateCompanionBonus(record.companionCount)

  const totalScore = getRecordTotalScore(record)
  const parts = []

  if (baseScore > 0)
    parts.push(`${baseScore}(基础)`)
  if (distanceScore > 0)
    parts.push(`${distanceScore}(距离)`)
  if (companionBonus > 0)
    parts.push(`${companionBonus}(结伴)`)
  if (easterEggBonus > 0)
    parts.push(`${easterEggBonus}(彩蛋)`)

  if (parts.length > 0) {
    return `${totalScore}分=${parts.join('+')}`
  }
  else {
    return `${totalScore}分=1(默认)`
  }
}

// 监听显示状态，自动加载数据
watch(() => props.show, (newShow) => {
  if (newShow && auditRecords.value.length === 0) {
    fetchAuditRecords()
  }
  // 重置轮播图索引
  if (newShow) {
    currentIndex.value = 0
  }
})

// 监听记录变化，重置轮播图索引
watch(() => filteredAuditRecords.value.length, (newLength) => {
  if (newLength > 0 && currentIndex.value >= newLength) {
    currentIndex.value = Math.max(0, newLength - 1)
  }
})

// 监听筛选条件变化，自动刷新
watch([includeAudited, auditDays], () => {
  fetchAuditRecords()
})
</script>

<template>
  <!-- 审核弹窗遮罩 -->
  <div v-if="show" class="audit-modal-overlay" @click="closePanel">
    <div class="audit-modal" @click.stop>
      <!-- 弹窗头部 -->
      <div class="audit-modal-header">
        <h2 class="audit-modal-title">
          <span class="audit-icon">🔍</span>
          审核打卡记录
        </h2>
        <button class="audit-modal-close" @click="closePanel">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M15.5 4.5L4.5 15.5M4.5 4.5L15.5 15.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <!-- 筛选和操作栏 -->
      <div class="audit-modal-toolbar h-full relative overflow-y-auto">
        <div class="toolbar-content">
          <div class="audit-filters bg-#fafbfd top-0 sticky z-1">
            <div class="flex gap-4">
              <div class="filter-item pl-4px">
                <label class="filter-label">
                  <input
                    v-model="includeAudited"
                    type="checkbox"
                    class="filter-checkbox"
                  >
                  <span class="filter-text">已审核</span>
                </label>
              </div>
              <div class="filter-item">
                <label class="filter-label">
                  <span class="filter-text">范围：</span>
                  <select v-model="auditDays" class="filter-select">
                    <option value="1">过去1天</option>
                    <option value="3">过去3天</option>
                    <option value="7">过去7天</option>
                    <option value="30">过去30天</option>
                  </select>
                </label>
              </div>
              <div class="filter-item">
                <div class="view-toggle">
                  <button
                    class="view-toggle-btn"
                    :class="{ active: viewMode === 'list' }"
                    @click="viewMode = 'list'"
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zM14 9a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 00-1-1h-2z" />
                    </svg>
                  </button>
                  <button
                    class="view-toggle-btn"
                    :class="{ active: viewMode === 'carousel' }"
                    @click="viewMode = 'carousel'"
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- 批量操作 -->
            <div v-if="filteredAuditRecords.length > 0 && viewMode === 'list'" class="batch-operations">
              <div class="flex select-all justify-start">
                <label class="select-all-label">
                  <input
                    type="checkbox"
                    :checked="selectedRecords.length === filteredAuditRecords.length"
                    class="select-all-checkbox"
                    @change="toggleSelectAll"
                  >
                  <span class="select-all-text">
                    全选 ({{ selectedRecords.length }}/{{ filteredAuditRecords.length }})
                  </span>
                </label>
              </div>
              <div v-if="selectedRecords.length > 0" class="batch-buttons">
                <button class="batch-btn batch-approve" @click="performAudit('approve')">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                  </svg>
                  通过
                </button>
                <button class="batch-btn batch-reject" @click="showRejectForm = true">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                  </svg>
                  拒绝
                </button>
              </div>
            </div>
          </div>

          <!-- 记录容器 -->
          <div class="audit-records-container mb-10px max-h-full">
            <div v-if="isLoadingAuditRecords" class="audit-loading">
              <div class="loading-spinner large" />
              <p>加载审核记录中...</p>
            </div>
            <div v-else-if="filteredAuditRecords.length === 0" class="audit-empty">
              <div class="empty-icon">
                📝
              </div>
              <p>暂无需要审核的记录</p>
            </div>

            <!-- 轮播图模式 -->
            <div v-else-if="viewMode === 'carousel'" class="audit-carousel">
              <!-- 轮播图主体 -->
              <div class="carousel-wrapper">
                <div class="carousel-track" :style="{ transform: `translateX(-${currentIndex * 100}%)` }">
                  <div
                    v-for="record in filteredAuditRecords"
                    :key="record.id"
                    class="carousel-slide"
                    :class="{
                      rejected: record.isRejected === true || record.rejectionReason,
                    }"
                  >
                    <!-- 记录头部信息 -->
                    <div class="carousel-header">
                      <div class="record-info">
                        <div class="record-main-line">
                          <div class="poi-name">
                            {{ record.poiName }}
                          </div>
                          <div class="employee-info">
                            {{ record.employeeName }}({{ record.employeeId }})
                          </div>
                          <div class="record-time">
                            {{ formatAuditTime(record.timestamp) }}
                          </div>
                          <div class="record-status" :class="getAuditStatusClass(record)">
                            {{ getAuditStatusText(record) }}
                          </div>
                        </div>

                        <!-- 记录详情作为第二行 -->
                        <div class="record-details-line">
                          <div class="meta-row">
                            <!-- 积分显示 -->
                            <span class="score-item meta-item" :class="{ 'rejected-score': record.isRejected === true }">
                              <span class="meta-icon">🏆 积分: {{ getRecordTotalScore(record) }}分</span>
                              <span v-if="record.isRejected === true" class="rejected-score-text">不计入总分</span>
                              <span v-else class="score-formula">{{ getScoreFormula(record) }}</span>
                            </span>

                            <!-- 建议评分 -->
                            <span v-if="record.rating" class="meta-item">
                              <span class="meta-icon">🏔️</span>
                              建议: {{ record.rating }}分
                            </span>

                            <!-- 同行人数 -->
                            <span v-if="record.companionCount && record.companionCount > 1" class="meta-item">
                              <span class="meta-icon">👥</span>
                              {{ record.companionCount }}人
                              <button
                                class="edit-companion-btn"
                                title="修改人数"
                                @click.stop="openCompanionModal(record.id, record.companionCount)"
                              >
                                ✏️
                              </button>
                            </span>
                            <span v-else class="meta-item">
                              <span class="meta-icon">👥</span>
                              1人
                              <button
                                class="edit-companion-btn"
                                title="修改人数"
                                @click.stop="openCompanionModal(record.id, 1)"
                              >
                                ✏️
                              </button>
                            </span>

                            <!-- 距离 -->
                            <span v-if="record.distance" class="meta-item">
                              <span class="meta-icon">📏</span>
                              {{ formatDistance(record.distance) }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 照片区域 -->
                    <div v-if="record.photo" class="carousel-photo">
                      <img
                        :src="record.photo"
                        :alt="record.poiName"
                        class="carousel-photo-img"
                        @click="$emit('showPhoto', record.photo)"
                      >
                    </div>

                    <!-- 备注 -->
                    <div v-if="record.comment" class="carousel-comment">
                      <div class="comment-label">
                        备注：
                      </div>
                      <div class="comment-text">
                        {{ record.comment }}
                      </div>
                    </div>

                    <!-- 拒绝原因 -->
                    <div v-if="record.rejectionReason" class="carousel-rejection">
                      <div class="rejection-label">
                        拒绝原因：
                      </div>
                      <div class="rejection-text">
                        {{ record.rejectionReason }}
                      </div>
                    </div>

                    <!-- 操作按钮 -->
                    <div v-if="record.isRejected !== true && !record.rejectionReason" class="carousel-actions">
                      <button
                        class="carousel-action-btn approve-btn"
                        title="通过"
                        @click="handleCarouselApprove(record.id)"
                      >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                        </svg>
                        通过
                      </button>
                      <button
                        class="carousel-action-btn reject-btn"
                        title="拒绝"
                        @click="handleCarouselReject(record.id)"
                      >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                        </svg>
                        拒绝
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 轮播图控制按钮 -->
              <div class="carousel-controls">
                <button
                  class="carousel-control-btn prev-btn"
                  :disabled="currentIndex === 0"
                  @click="prevSlide"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" />
                  </svg>
                  上一个
                </button>

                <div class="carousel-indicator">
                  {{ currentIndex + 1 }} / {{ filteredAuditRecords.length }}
                </div>

                <button
                  class="carousel-control-btn next-btn"
                  :disabled="currentIndex === filteredAuditRecords.length - 1"
                  @click="nextSlide"
                >
                  下一个
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- 列表模式 -->
            <div v-else class="audit-records-list">
              <div
                v-for="record in filteredAuditRecords"
                :key="record.id"
                class="audit-record-item"
                :class="{
                  selected: selectedRecords.includes(record.id),
                  rejected: record.isRejected === true || record.rejectionReason,
                }"
              >
                <div class="record-header">
                  <label class="record-checkbox">
                    <input
                      type="checkbox"
                      :checked="selectedRecords.includes(record.id)"
                      class="checkbox-input"
                      @change="toggleRecordSelection(record.id)"
                    >
                    <span class="checkbox-mark" />
                  </label>

                  <div class="record-main-info">
                    <div class="employee-section">
                      <div class="poi-name">
                        {{ record.poiName }}
                      </div>
                      <div class="record-meta">
                        <span class="record-time">{{ formatAuditTime(record.timestamp) }}</span>
                      </div>
                      <div class="employee-name">
                        {{ record.employeeName }}({{ record.employeeId }})
                      </div>
                      <div class="record-status" :class="getAuditStatusClass(record)">
                        {{ getAuditStatusText(record) }}
                      </div>
                    </div>
                    <div class="record-details">
                      <div class="record-meta">
                        <div class="meta-row">
                          <!-- 积分显示 -->
                          <span class="score-item meta-item" :class="{ 'rejected-score': record.isRejected === true }">
                            <span class="meta-icon">🏆 积分: {{ getRecordTotalScore(record) }}分</span>
                            <span v-if="record.isRejected === true" class="rejected-score-text">不计入总分</span>
                            <span v-else class="score-formula">{{ getScoreFormula(record) }}</span>
                          </span>

                          <!-- 建议评分 -->
                          <span v-if="record.rating" class="meta-item">
                            <span class="meta-icon">🏔️</span>
                            建议: {{ record.rating }}分
                          </span>

                          <!-- 同行人数 -->
                          <span v-if="record.companionCount && record.companionCount > 1" class="meta-item">
                            <span class="meta-icon">👥</span>
                            {{ record.companionCount }}人
                            <button
                              class="edit-companion-btn"
                              title="修改人数"
                              @click.stop="openCompanionModal(record.id, record.companionCount)"
                            >
                              ✏️
                            </button>
                          </span>
                          <span v-else class="meta-item">
                            <span class="meta-icon">👥</span>
                            1人
                            <button
                              class="edit-companion-btn"
                              title="修改人数"
                              @click.stop="openCompanionModal(record.id, 1)"
                            >
                              ✏️
                            </button>
                          </span>

                          <!-- 距离 -->
                          <span v-if="record.distance" class="meta-item">
                            <span class="meta-icon">📏</span>
                            {{ formatDistance(record.distance) }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="record.comment" class="record-comment">
                  <div class="comment-label">
                    备注：
                  </div>
                  <div class="comment-text">
                    {{ record.comment }}
                  </div>
                </div>

                <div v-if="record.photo" class="record-photo">
                  <img
                    :src="record.photo"
                    :alt="record.poiName"
                    class="photo-thumbnail"
                    @click="$emit('showPhoto', record.photo)"
                  >
                </div>

                <div v-if="record.rejectionReason" class="rejection-reason">
                  <div class="rejection-label">
                    拒绝原因：
                  </div>
                  <div class="rejection-text">
                    {{ record.rejectionReason }}
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div v-if="record.isRejected !== true && !record.rejectionReason" class="record-actions">
                  <button
                    class="approve-btn action-btn"
                    title="通过"
                    @click="handleSingleApprove(record.id)"
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                    通过
                  </button>
                  <button
                    class="action-btn reject-btn"
                    title="拒绝"
                    @click="handleSingleReject(record.id)"
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                    </svg>
                    拒绝
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 拒绝原因弹窗 -->
        <div v-if="showRejectForm" class="reject-form-overlay" @click="showRejectForm = false">
          <div class="reject-form" @click.stop>
            <div class="reject-form-header">
              <h3>拒绝原因</h3>
              <button class="reject-form-close" @click="showRejectForm = false">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M15.5 4.5L4.5 15.5M4.5 4.5L15.5 15.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <div class="reject-form-content">
              <div class="form-group">
                <label class="form-label">请输入拒绝原因：</label>
                <textarea
                  v-model="rejectReason"
                  placeholder="请详细说明拒绝的原因..."
                  class="form-textarea"
                  rows="4"
                />
              </div>
              <div class="form-actions">
                <button class="cancel-btn form-btn" @click="showRejectForm = false">
                  取消
                </button>
                <button class="form-btn confirm-btn" @click="handleRejectConfirm">
                  确认拒绝
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 修改人数弹窗 -->
        <div v-if="showCompanionModal" class="reject-form-overlay" @click="showCompanionModal = false">
          <div class="reject-form" @click.stop>
            <div class="reject-form-header">
              <h3>修改同行人数</h3>
              <button class="reject-form-close" @click="showCompanionModal = false">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M15.5 4.5L4.5 15.5M4.5 4.5L15.5 15.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <div class="reject-form-content">
              <div class="form-group">
                <label class="form-label">请输入同行人数（包含自己）：</label>
                <input
                  v-model.number="editingCompanionCount"
                  type="number"
                  min="0"
                  max="99"
                  class="form-input"
                  placeholder="请输入人数"
                >
                <p class="form-hint">
                  提示：输入0或1表示仅自己（无结伴加分），2人及以上有结伴加分
                </p>
              </div>
              <div class="form-actions">
                <button class="cancel-btn form-btn" @click="showCompanionModal = false">
                  取消
                </button>
                <button class="form-btn confirm-btn" @click="confirmUpdateCompanionCount">
                  确认修改
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 审核弹窗遮罩 */
.audit-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-out;
}

/* 审核弹窗主体 */
.audit-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 85vw;
  max-width: 800px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.3s ease-out;
}

/* 弹窗头部 */
.audit-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.audit-modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.audit-icon {
  font-size: 24px;
}

.audit-modal-close {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  padding: 8px;
  transition: all 0.2s ease;
}

.audit-modal-close:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

/* 工具栏 */
.audit-modal-toolbar {
  padding: 0 10px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.toolbar-content {
  display: flex;
  flex-direction: column;
}

.audit-filters {
  padding-top: 10px;
  padding-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
}

.audit-filters::-webkit-scrollbar {
  height: 4px;
}

.audit-filters::-webkit-scrollbar-track {
  background: transparent;
}

.audit-filters::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 2px;
}

.audit-filters::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.filter-item {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  white-space: nowrap;
}

.filter-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #475569;
}

.filter-checkbox {
  width: 14px;
  height: 14px;
  accent-color: #667eea;
}

.filter-select {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.view-toggle {
  display: flex;
  gap: 2px;
  background: #f3f4f6;
  border-radius: 6px;
  padding: 2px;
  flex-shrink: 0;
}

.view-toggle-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-toggle-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.view-toggle-btn.active {
  background: #667eea;
  color: white;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.2);
}

.filter-refresh-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-refresh-btn:hover:not(:disabled) {
  background: #5a67d8;
  transform: translateY(-1px);
}

.filter-refresh-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
}

/* 批量操作 */
.batch-operations {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  gap: 16px;
  width: 100%;
}

.select-all-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #92400e;
}

.select-all-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #f59e0b;
}

.batch-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  width: 150px;
}

.batch-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.batch-approve {
  background: #10b981;
  color: white;
}

.batch-approve:hover {
  background: #059669;
  transform: translateY(-1px);
}

.batch-reject {
  background: #ef4444;
  color: white;
}

.batch-reject:hover {
  background: #dc2626;
  transform: translateY(-1px);
}

/* 记录容器 */
.audit-records-container {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

/* 列表模式 */
.audit-records-list {
  padding: 0px 0px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.audit-record-item {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.audit-record-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.audit-record-item:hover {
  border-color: #667eea;
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
  transform: translateY(-2px);
}

.audit-record-item:hover::before {
  opacity: 1;
}

.audit-record-item.selected {
  border-color: #667eea;
  background: #f8fafc;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.2);
}

.audit-record-item.selected::before {
  opacity: 1;
}

.audit-record-item.rejected {
  border-color: #ef4444;
  background: #fef2f2;
}

.audit-record-item.rejected::before {
  background: #ef4444;
  opacity: 1;
}

/* 记录头部 */
.record-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.record-checkbox {
  position: relative;
  cursor: pointer;
  margin-top: 4px;
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
}

.checkbox-mark {
  display: block;
  width: 20px;
  height: 20px;
  border: 2px solid #d1d5db;
  border-radius: 6px;
  background: white;
  transition: all 0.2s ease;
}

.checkbox-input:checked + .checkbox-mark {
  background: #667eea;
  border-color: #667eea;
}

.checkbox-input:checked + .checkbox-mark::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.record-main-info {
  flex: 1;
}

.employee-section {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.employee-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.poi-name {
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
}

.record-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
}

.record-details {
  margin-top: 8px;
  justify-items: left;
  border-radius: 6px;
}

.record-time {
  display: flex;
  align-items: center;
  gap: 4px;
}

.record-status {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.record-status.audit-pending {
  background: #fef3c7;
  color: #92400e;
}

.record-status.audit-rejected {
  background: #fee2e2;
  color: #991b1b;
}

/* 记录操作按钮 */
.record-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.action-btn {
  flex: 1;
  height: 40px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.approve-btn {
  background: #d1fae5;
  color: #065f46;
}

.approve-btn:hover {
  background: #a7f3d0;
  transform: scale(1.05);
}

.reject-btn {
  background: #fee2e2;
  color: #991b1b;
}

.reject-btn:hover {
  background: #fecaca;
  transform: scale(1.05);
}

/* 记录内容 */
.record-comment {
  margin-top: 12px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 6px;
  border-left: 3px solid #667eea;
}

.comment-label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 4px;
}

.comment-text {
  font-size: 14px;
  color: #374151;
  line-height: 1.5;
}

.record-photo {
  margin-top: 12px;
}

.photo-thumbnail {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 6px;
  cursor: pointer;
  border: 2px solid #e5e7eb;
  transition: all 0.2s ease;
}

.photo-thumbnail:hover {
  border-color: #667eea;
  transform: scale(1.05);
}

.rejection-reason {
  margin-top: 12px;
  padding: 8px 12px;
  background: #fef2f2;
  border-radius: 6px;
  border-left: 3px solid #ef4444;
}

.rejection-label {
  font-size: 12px;
  font-weight: 500;
  color: #991b1b;
  margin-bottom: 4px;
}

.rejection-text {
  font-size: 14px;
  color: #7f1d1d;
  line-height: 1.5;
}

/* 轮播图容器 */
.audit-carousel-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.audit-carousel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.carousel-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.carousel-track {
  display: flex;
  height: 100%;
  transition: transform 0.3s ease-in-out;
}

.carousel-slide {
  min-width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 14px;
  overflow-y: auto;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.carousel-slide.rejected {
  border: 2px solid #ef4444;
  background: #fef2f2;
}

.carousel-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.record-info {
  display: flex;
  flex-direction: column;
  gap: 0px;
}

.record-main-line {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.record-details-line {
  margin-top: 8px;
}

.poi-name {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.employee-info {
  font-size: 14px;
  color: #6b7280;
}

.record-time {
  font-size: 12px;
  color: #9ca3af;
}

.carousel-details {
  margin-bottom: 20px;
}

.carousel-photo {
  margin-bottom: 20px;
  text-align: center;
}

.carousel-photo-img {
  width: 100%;
  height: 400px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  border: 2px solid #e5e7eb;
  transition: all 0.2s ease;
}

.carousel-photo-img:hover {
  border-color: #667eea;
  transform: scale(1.02);
}

.carousel-comment,
.carousel-rejection {
  margin-bottom: 20px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 6px;
  border-left: 3px solid #667eea;
}

.carousel-rejection {
  background: #fef2f2;
  border-left-color: #ef4444;
}

.comment-label,
.rejection-label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 4px;
}

.comment-text,
.rejection-text {
  font-size: 14px;
  color: #374151;
  line-height: 1.5;
}

.carousel-actions {
  display: flex;
  gap: 16px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid #e5e7eb;
}

.carousel-action-btn {
  flex: 1;
  height: 40px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.carousel-action-btn.approve-btn {
  background: #d1fae5;
  color: #065f46;
}

.carousel-action-btn.approve-btn:hover {
  background: #a7f3d0;
  transform: scale(1.05);
}

.carousel-action-btn.reject-btn {
  background: #fee2e2;
  color: #991b1b;
}

.carousel-action-btn.reject-btn:hover {
  background: #fecaca;
  transform: scale(1.05);
}

.carousel-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding: 12px 20px;
  background: #f8fafc;
  border-top: 1px solid #e5e7eb;
  position: sticky;
  bottom: 0;
  z-index: 10;
  flex-shrink: 0;
}

.carousel-control-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.carousel-control-btn:hover:not(:disabled) {
  background: #5a67d8;
  transform: translateY(-1px);
}

.carousel-control-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
}

.carousel-indicator {
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  background: white;
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid #e5e7eb;
}

.audit-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #6b7280;
}

.audit-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #6b7280;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

/* 记录列表 */
.audit-records-list {
  padding: 0px 0px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.audit-record-item {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.audit-record-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.audit-record-item:hover {
  border-color: #667eea;
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
  transform: translateY(-2px);
}

.audit-record-item:hover::before {
  opacity: 1;
}

.audit-record-item.selected {
  border-color: #667eea;
  background: #f8fafc;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.2);
}

.audit-record-item.selected::before {
  opacity: 1;
}

.audit-record-item.rejected {
  border-color: #ef4444;
  background: #fef2f2;
}

.audit-record-item.rejected::before {
  background: #ef4444;
  opacity: 1;
}

/* 记录头部 */
.record-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.record-checkbox {
  position: relative;
  cursor: pointer;
  margin-top: 4px;
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
}

.checkbox-mark {
  display: block;
  width: 20px;
  height: 20px;
  border: 2px solid #d1d5db;
  border-radius: 6px;
  background: white;
  transition: all 0.2s ease;
}

.checkbox-input:checked + .checkbox-mark {
  background: #667eea;
  border-color: #667eea;
}

.checkbox-input:checked + .checkbox-mark::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.record-main-info {
  flex: 1;
}

.employee-section {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.employee-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.poi-name {
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
}

.record-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
}

.record-details {
  margin-top: 8px;
  border-radius: 6px;
  justify-items: left;
}

.record-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #6c757d;
  background: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
}

.score-item {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: white !important;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  border-radius: 8px;
  align-items: flex-start;
  font-size: 13px;
  gap: 3px;
  padding: 8px 10px;
  position: relative;
  overflow: hidden;
}

.score-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  pointer-events: none;
}

.score-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.score-main {
  font-size: 14px;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  gap: 4px;
}

.score-formula {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
}

.rejected-score {
  background: linear-gradient(135deg, #dc3545 0%, #ff6b6b 100%) !important;
  opacity: 0.8;
}

.rejected-score-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
}

.meta-icon {
  font-size: 14px;
}

.record-time {
  display: flex;
  align-items: center;
  gap: 4px;
}

.record-status {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.record-status.audit-pending {
  background: #fef3c7;
  color: #92400e;
}

.record-status.audit-rejected {
  background: #fee2e2;
  color: #991b1b;
}

/* 记录操作按钮 */
.record-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.action-btn {
  flex: 1;
  height: 40px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.approve-btn {
  background: #d1fae5;
  color: #065f46;
}

.approve-btn:hover {
  background: #a7f3d0;
  transform: scale(1.05);
}

.reject-btn {
  background: #fee2e2;
  color: #991b1b;
}

.reject-btn:hover {
  background: #fecaca;
  transform: scale(1.05);
}

/* 记录内容 */
.record-comment {
  margin-top: 12px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 6px;
  border-left: 3px solid #667eea;
}

.comment-label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 4px;
}

.comment-text {
  font-size: 14px;
  color: #374151;
  line-height: 1.5;
}

.record-photo {
  margin-top: 12px;
}

.photo-thumbnail {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 6px;
  cursor: pointer;
  border: 2px solid #e5e7eb;
  transition: all 0.2s ease;
}

.photo-thumbnail:hover {
  border-color: #667eea;
  transform: scale(1.05);
}

.rejection-reason {
  margin-top: 12px;
  padding: 8px 12px;
  background: #fef2f2;
  border-radius: 6px;
  border-left: 3px solid #ef4444;
}

.rejection-label {
  font-size: 12px;
  font-weight: 500;
  color: #991b1b;
  margin-bottom: 4px;
}

.rejection-text {
  font-size: 14px;
  color: #7f1d1d;
  line-height: 1.5;
}

/* 拒绝原因弹窗 */
.reject-form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  animation: fadeIn 0.2s ease-out;
}

.reject-form {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90vw;
  max-width: 500px;
  animation: slideUp 0.2s ease-out;
}

.reject-form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.reject-form-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.reject-form-close {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.reject-form-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.reject-form-content {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  resize: vertical;
  transition: all 0.2s ease;
}

.form-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
  font-style: italic;
}

.edit-companion-btn {
  background: rgba(102, 126, 234, 0.1);
  border: none;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
  margin-left: 4px;
}

.edit-companion-btn:hover {
  background: rgba(102, 126, 234, 0.2);
  transform: scale(1.1);
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.form-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn {
  background: #f3f4f6;
  color: #374151;
}

.cancel-btn:hover {
  background: #e5e7eb;
}

.confirm-btn {
  background: #ef4444;
  color: white;
}

.confirm-btn:hover {
  background: #dc2626;
  transform: translateY(-1px);
}

/* 加载动画 */
.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #f3f4f6;
  border-top: 2px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner.large {
  width: 40px;
  height: 40px;
  border-width: 4px;
  margin-bottom: 16px;
}

/* 动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 深色模式 */
.dark .audit-modal {
  background: #1f2937;
  color: #f9fafb;
}

.dark .audit-modal-header {
  background: linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%);
}

.dark .audit-modal-toolbar {
  background: #111827;
  border-bottom-color: #374151;
}

.dark .filter-label {
  color: #d1d5db;
}

.dark .filter-select {
  background: #374151;
  border-color: #4b5563;
  color: #f9fafb;
}

.dark .batch-operations {
  background: #451a03;
  border-color: #ea580c;
}

.dark .select-all-label {
  color: #fed7aa;
}

.dark .audit-record-item {
  background: #374151;
  border-color: #4b5563;
}

.dark .audit-record-item:hover {
  border-color: #7c3aed;
}

.dark .audit-record-item.selected {
  background: #1e1b4b;
}

.dark .employee-name {
  color: #f9fafb;
}

.dark .poi-name {
  background: #4b5563;
  color: #d1d5db;
}

.dark .record-details {
  background: #1f2937;
  border-color: #374151;
}

.dark .score-item {
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%) !important;
  color: white !important;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.dark .score-item::before {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%);
}

.dark .score-formula {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.15);
}

.dark .rejected-score {
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%) !important;
}

.dark .rejected-score-text {
  color: rgba(255, 255, 255, 0.95);
  background: rgba(255, 255, 255, 0.25);
}

/* 轮播图深色模式 */
.dark .carousel-slide {
  background: #374151;
  color: #f9fafb;
}

.dark .carousel-slide.rejected {
  background: #7f1d1d;
  border-color: #dc2626;
}

.dark .carousel-header {
  border-bottom-color: #4b5563;
}

.dark .poi-name {
  color: #f9fafb;
}

.dark .employee-info {
  color: #d1d5db;
}

.dark .record-time {
  color: #9ca3af;
}

.dark .carousel-photo-img {
  border-color: #4b5563;
}

.dark .carousel-photo-img:hover {
  border-color: #7c3aed;
}

.dark .carousel-comment {
  background: #1f2937;
  border-left-color: #7c3aed;
}

.dark .carousel-rejection {
  background: #7f1d1d;
  border-left-color: #ef4444;
}

.dark .comment-text,
.dark .rejection-text {
  color: #d1d5db;
}

.dark .carousel-actions {
  border-top-color: #4b5563;
}

.dark .carousel-controls {
  background: #1f2937;
  border-top-color: #4b5563;
}

.dark .carousel-indicator {
  background: #374151;
  color: #d1d5db;
  border-color: #4b5563;
}

.dark .meta-item {
  background: #374151;
  color: #9ca3af;
}

.dark .record-comment {
  background: #1f2937;
  border-left-color: #7c3aed;
}

.dark .comment-text {
  color: #d1d5db;
}

.dark .rejection-reason {
  background: #7f1d1d;
  border-left-color: #ef4444;
}

.dark .rejection-text {
  color: #fecaca;
}

.dark .reject-form {
  background: #374151;
}

.dark .reject-form-header h3 {
  color: #f9fafb;
}

.dark .form-textarea {
  background: #4b5563;
  border-color: #6b7280;
  color: #f9fafb;
}

.dark .form-textarea:focus {
  border-color: #7c3aed;
}

.dark .form-input {
  background: #4b5563;
  border-color: #6b7280;
  color: #f9fafb;
}

.dark .form-input:focus {
  border-color: #7c3aed;
}

.dark .form-hint {
  color: #9ca3af;
}

.dark .edit-companion-btn {
  background: rgba(124, 58, 237, 0.2);
  color: #d1d5db;
}

.dark .edit-companion-btn:hover {
  background: rgba(124, 58, 237, 0.3);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .audit-modal {
    width: 95vw;
    max-height: 95vh;
  }

  .audit-modal-header {
    padding: 16px 20px;
  }

  .audit-modal-toolbar {
    padding: 12px 10px;
  }

  .audit-filters {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .batch-operations {
    gap: 12px;
  }

  .batch-btn {
    flex: 1;
    justify-content: center;
  }

  .audit-records-list {
    padding: 0px 0px;
    gap: 12px;
  }

  .record-header {
    gap: 8px;
  }

  .record-actions {
    align-self: flex-end;
  }
}
</style>
