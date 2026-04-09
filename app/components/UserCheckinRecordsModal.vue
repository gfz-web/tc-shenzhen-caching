<script setup lang="ts">
import { ref, watch } from 'vue'
import { usePOIData } from '~/composables/usePOIData'
import { useToast } from '~/composables/useToast'
import { calculateCheckinTotalScore, calculateCompanionBonus, calculateEasterEggBonus, calculatePOIScores } from '~/utils/scoreCalculation'
import PhotoViewModal from './PhotoViewModal.vue'

interface Props {
  visible: boolean
  userId: string
  userName: string
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { error: _error } = useToast()
const { pois } = usePOIData()

// 打卡记录数据
const checkinRecords = ref<Array<{
  id: string
  employeeId: string
  employeeName: string
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
  isRejected?: boolean | null
  rejectionReason?: string
}>>([])

const loading = ref(false)
const errorMessage = ref<string | null>(null)

// 照片查看弹窗相关状态
const showPhotoModal = ref(false)
const selectedCheckinRecord = ref<any>(null)

// 获取用户的打卡记录
async function fetchUserCheckinRecords() {
  if (loading.value || !props.userId)
    return

  loading.value = true
  errorMessage.value = null

  try {
    const response = await $fetch(`/api/checkin?employeeId=${encodeURIComponent(props.userId)}`)

    if (response.success && response.data) {
      // 转换服务器数据格式为本地格式
      console.log('原始服务器数据:', response.data) // 调试信息
      checkinRecords.value = response.data.map((record: any) => ({
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
        rejectionReason: record.rejection_reason || undefined,
      }))

      // 调试信息：检查转换后的数据
      console.log('转换后的打卡记录:', checkinRecords.value)
      console.log('审核不通过的记录:', checkinRecords.value.filter(r => r.isRejected))
    }
    else {
      throw new Error('获取打卡记录失败')
    }
  }
  catch (err: any) {
    console.error('获取用户打卡记录失败:', err)
    errorMessage.value = err.message || '网络错误，请稍后重试'
    checkinRecords.value = []
  }
  finally {
    loading.value = false
  }
}

// 修复照片URL
function fixPhotoUrl(photoUrl: string | null | undefined): string | undefined {
  if (!photoUrl)
    return undefined

  // 如果已经是完整URL，直接返回
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
    return photoUrl
  }

  // 如果是Base64数据，直接返回
  if (photoUrl.startsWith('data:')) {
    return photoUrl
  }

  // 如果是COS文件key，构建完整URL
  try {
    const cosConfig = {
      Bucket: process.env.NUXT_TENCENT_COS_BUCKET || '',
      Region: process.env.NUXT_TENCENT_COS_REGION || 'ap-guangzhou',
      Domain: process.env.NUXT_TENCENT_COS_DOMAIN || undefined,
    }

    if (cosConfig.Domain) {
      const domain = cosConfig.Domain.replace(/^https?:\/\//, '')
      return `https://${domain}/${photoUrl}`
    }

    return `https://${cosConfig.Bucket}.cos.${cosConfig.Region}.myqcloud.com/${photoUrl}`
  }
  catch (error) {
    console.warn('处理图片URL失败:', error)
    return photoUrl
  }
}

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) {
    return `${diffDays}天前`
  }
  else if (diffHours > 0) {
    return `${diffHours}小时前`
  }
  else {
    return '刚刚'
  }
}

// 格式化详细时间
function formatDetailedTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// 格式化距离显示
function formatDistance(distance: number): string {
  if (distance >= 1000) {
    const km = distance / 1000
    return km % 1 === 0 ? `${km}km` : `${km.toFixed(1)}km`
  }
  return `${distance.toFixed(0)}m`
}

// 关闭弹窗
function onClose() {
  emit('close')
}

// 查看照片
function viewPhoto(record: any) {
  if (record.photo) {
    selectedCheckinRecord.value = record
    showPhotoModal.value = true
  }
}

// 关闭照片查看弹窗
function closePhotoModal() {
  showPhotoModal.value = false
  selectedCheckinRecord.value = null
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

// 计算用户总积分（排除审核不通过的记录）
function getTotalScore(): number {
  return checkinRecords.value.reduce((total, record) => {
    // 审核不通过的记录不计入总分
    if (record.isRejected === true) {
      return total
    }
    return total + getRecordTotalScore(record)
  }, 0)
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

// 监听弹窗显示状态
watch(() => props.visible, (visible) => {
  if (visible && props.userId) {
    document.body.style.overflow = 'hidden'
    fetchUserCheckinRecords()
  }
  else {
    document.body.style.overflow = ''
  }
})

// 组件卸载时恢复页面滚动
onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="user-records-modal-overlay" @click="onClose">
      <div class="user-records-modal" @click.stop>
        <div class="modal-header">
          <h3>📋 {{ userName }} 的打卡记录</h3>
          <button class="close-btn" @click="onClose">
            ×
          </button>
        </div>

        <div class="modal-body">
          <!-- 加载状态 -->
          <div v-if="loading" class="loading-state">
            <div class="loading-icon">
              ⏳
            </div>
            <div class="loading-text">
              正在加载打卡记录...
            </div>
          </div>

          <!-- 错误状态 -->
          <div v-else-if="errorMessage" class="error-state">
            <div class="error-icon">
              ⚠️
            </div>
            <div class="error-text">
              {{ errorMessage }}
            </div>
            <button class="retry-btn" @click="fetchUserCheckinRecords">
              🔄 重试
            </button>
          </div>

          <!-- 空状态 -->
          <div v-else-if="checkinRecords.length === 0" class="empty-state">
            <div class="empty-icon">
              📝
            </div>
            <div class="empty-text">
              暂无打卡记录
            </div>
            <div class="empty-hint">
              该用户还没有进行过打卡
            </div>
          </div>

          <!-- 打卡记录列表 -->
          <div v-else class="records-list">
            <div class="records-summary">
              <div class="summary-header">
                <div class="summary-title">
                  📊 打卡统计
                </div>
              </div>
              <div class="summary-content">
                <div class="summary-item">
                  <div class="summary-icon">
                    🏆
                  </div>
                  <div class="summary-info">
                    <div class="summary-label">
                      总积分
                    </div>
                    <div class="total-score summary-value">
                      {{ getTotalScore() }}分
                    </div>
                  </div>
                </div>
                <div class="summary-item">
                  <div class="summary-icon">
                    📍
                  </div>
                  <div class="summary-info">
                    <div class="summary-label">
                      打卡次数
                    </div>
                    <div class="summary-value">
                      {{ checkinRecords.length }}次
                    </div>
                  </div>
                </div>
                <div class="summary-item">
                  <div class="summary-icon">
                    ⏰
                  </div>
                  <div class="summary-info">
                    <div class="summary-label">
                      最近打卡
                    </div>
                    <div class="summary-value">
                      {{ formatTime(checkinRecords[0]?.timestamp || 0) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="records-items">
              <div
                v-for="record in checkinRecords"
                :key="record.id"
                class="record-item"
                :class="{
                  'has-photo': record.photo,
                  'rejected': record.isRejected === true,
                }"
              >
                <div class="record-header">
                  <div class="record-poi">
                    <span class="poi-icon">📍</span>
                    {{ record.poiName }}
                  </div>
                  <div class="record-time">
                    {{ formatDetailedTime(record.timestamp) }}
                  </div>
                </div>

                <div class="record-details">
                  <div class="record-meta">
                    <div class="meta-row">
                      <span class="score-item meta-item" :class="{ 'rejected-score': record.isRejected === true }">
                        <span class="meta-icon">🏆 积分: {{ getRecordTotalScore(record) }}分</span>
                        <span v-if="record.isRejected === true" class="rejected-score-text">不计入总分</span>
                        <span v-else class="score-formula">{{ getScoreFormula(record) }}</span>
                      </span>
                      <span v-if="record.rating" class="meta-item">
                        <span class="meta-icon">🏔️</span>
                        建议: {{ record.rating }}分
                      </span>
                      <span v-if="record.companionCount && record.companionCount > 1" class="meta-item">
                        <span class="meta-icon">👥</span>
                        {{ record.companionCount }}人
                      </span>
                      <span v-if="record.distance" class="meta-item">
                        <span class="meta-icon">📏</span>
                        {{ formatDistance(record.distance) }}
                      </span>
                    </div>
                  </div>

                  <div v-if="record.photo" class="record-photo" @click="viewPhoto(record)">
                    <img :src="record.photo" alt="打卡照片" class="photo-thumbnail">
                    <div class="photo-overlay">
                      <span class="photo-icon">📷</span>
                      <span class="photo-text">点击查看大图</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 照片查看弹窗 -->
    <PhotoViewModal
      :is-open="showPhotoModal"
      :checkin-record="selectedCheckinRecord"
      @close="closePhotoModal"
    />
  </Teleport>
</template>

<style scoped>
/* 弹窗遮罩 */
.user-records-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

/* 弹窗主体 */
.user-records-modal {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

/* 弹窗头部 */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 16px;
  border-bottom: 1px solid var(--gray-border, #e9ecef);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary, #666);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--gray-light, #f8f9fa);
  color: var(--text-primary, #333);
}

/* 弹窗内容 */
.modal-body {
  padding: 20px 24px 24px;
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* 加载状态 */
.loading-state {
  padding: 40px 20px;
  text-align: center;
}

.loading-icon {
  font-size: 48px;
  margin-bottom: 16px;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 16px;
  color: #6c757d;
}

/* 错误状态 */
.error-state {
  padding: 40px 20px;
  text-align: center;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-text {
  font-size: 16px;
  color: #dc3545;
  margin-bottom: 16px;
}

.retry-btn {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.retry-btn:hover {
  background: #0056b3;
}

/* 空状态 */
.empty-state {
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  color: #495057;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 14px;
  color: #6c757d;
}

/* 记录摘要 */
.records-summary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  color: white;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2);
}

.summary-header {
  margin-bottom: 16px;
}

.summary-title {
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  opacity: 0.95;
}

.summary-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.15);
  padding: 12px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.summary-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.summary-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.summary-label {
  font-size: 12px;
  opacity: 0.8;
  font-weight: 500;
}

.summary-value {
  font-size: 16px;
  font-weight: 700;
  color: white;
}

.total-score {
  color: #ffd700 !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 记录列表 */
.records-items {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

/* PC端两列布局 */
@media (min-width: 768px) {
  .records-items {
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
}

.record-item {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 12px;
  transition: all 0.2s ease;
}

.record-item:hover {
  border-color: #007bff;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.1);
}

.record-item.has-photo {
  border-color: #28a745;
}

.record-item.rejected {
  border-color: #dc3545;
  background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%);
  position: relative;
}

.record-item.rejected::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #dc3545 0%, #ff6b6b 100%);
  border-radius: 8px 8px 0 0;
}

/* 记录头部 */
.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.record-poi {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  flex: 1;
  min-width: 0;
}

.poi-icon {
  font-size: 18px;
}

.record-time {
  font-size: 12px;
  color: #6c757d;
  text-align: right;
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: 12px;
}

/* 记录详情 */
.record-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

/* 照片 */
.record-photo {
  position: relative;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;
}

.photo-thumbnail {
  width: 100%;
  height: 150px;
  object-fit: cover;
  transition: transform 0.2s ease;
}

.photo-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
  color: white;
}

.record-photo:hover .photo-overlay {
  opacity: 1;
}

.record-photo:hover .photo-thumbnail {
  transform: scale(1.05);
}

.photo-icon {
  font-size: 24px;
}

.photo-text {
  font-size: 14px;
  font-weight: 500;
}

/* 审核不通过红标 */
.rejection-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #dc3545 0%, #ff6b6b 100%);
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: 8px;
  box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

/* 审核说明 */
.rejection-reason {
  background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
  position: relative;
  overflow: hidden;
}

.rejection-reason::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #ffc107 0%, #ff8c00 100%);
}

.rejection-reason-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.rejection-icon {
  font-size: 16px;
}

.rejection-title {
  font-size: 14px;
  font-weight: 600;
  color: #856404;
}

.rejection-reason-text {
  font-size: 13px;
  color: #856404;
  line-height: 1.4;
  margin-bottom: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  border-left: 3px solid #ffc107;
}

.rejection-notice {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #dc3545;
  font-weight: 600;
  background: rgba(220, 53, 69, 0.1);
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid rgba(220, 53, 69, 0.2);
}

.notice-icon {
  font-size: 14px;
}

.notice-text {
  font-weight: 600;
}

/* 深色模式 */
.dark .user-records-modal {
  background: #1f2937;
  color: #f9fafb;
}

.dark .modal-header {
  border-bottom-color: #374151;
}

.dark .modal-header h3 {
  color: #f9fafb;
}

.dark .close-btn {
  color: #9ca3af;
}

.dark .close-btn:hover {
  background: #374151;
  color: #f9fafb;
}

.dark .records-summary {
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.2);
}

.dark .record-item {
  background: #1f2937;
  border-color: #374151;
}

.dark .record-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.dark .record-item.has-photo {
  border-color: #10b981;
}

.dark .record-item.rejected {
  background: linear-gradient(135deg, #2d1b1b 0%, #1f2937 100%);
  border-color: #dc2626;
}

.dark .rejection-badge {
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  box-shadow: 0 2px 4px rgba(220, 38, 38, 0.4);
}

.dark .rejection-reason {
  background: linear-gradient(135deg, #451a03 0%, #78350f 100%);
  border-color: #d97706;
}

.dark .rejection-title {
  color: #fbbf24;
}

.dark .rejection-reason-text {
  color: #fbbf24;
  background: rgba(0, 0, 0, 0.3);
  border-left-color: #d97706;
}

.dark .rejection-notice {
  color: #fca5a5;
  background: rgba(220, 38, 38, 0.2);
  border-color: rgba(220, 38, 38, 0.3);
}

.dark .record-poi {
  color: #f9fafb;
}

.dark .record-time {
  color: #9ca3af;
}

.dark .meta-item {
  background: #374151;
  color: #9ca3af;
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

.dark .record-photo {
  background: #374151;
}

.dark .empty-text {
  color: #e5e7eb;
}

.dark .empty-hint {
  color: #9ca3af;
}

.dark .loading-text {
  color: #9ca3af;
}

.dark .error-text {
  color: #ef4444;
}

.dark .retry-btn {
  background: #3b82f6;
}

.dark .retry-btn:hover {
  background: #2563eb;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .user-records-modal-overlay {
    padding: 12px;
    align-items: flex-start;
    padding-top: 5vh;
  }

  .user-records-modal {
    max-height: calc(95vh - 5vh);
  }

  .modal-header {
    padding: 20px 20px 16px;
  }

  .modal-header h3 {
    font-size: 16px;
  }

  .modal-body {
    padding: 16px 20px calc(20px + env(safe-area-inset-bottom));
  }

  .records-summary {
    padding: 16px;
  }

  .summary-content {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .summary-item {
    padding: 10px;
  }

  .summary-icon {
    font-size: 20px;
  }

  .summary-value {
    font-size: 14px;
  }

  .record-header {
    flex-direction: row;
    align-items: center;
  }

  .record-poi {
    flex: 1;
    min-width: 0;
  }

  .record-time {
    text-align: right;
    margin-left: 12px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .record-meta {
    gap: 4px;
  }

  .meta-row {
    gap: 6px;
  }

  .score-item {
    padding: 6px 8px;
    border-radius: 6px;
  }

  .score-main {
    font-size: 13px;
  }

  .score-formula {
    font-size: 9px;
    padding: 1px 4px;
  }

  .photo-thumbnail {
    height: 120px;
  }
}

/* 小屏幕优化 */
@media (max-width: 480px) {
  .user-records-modal-overlay {
    padding: 8px;
    padding-top: 3vh;
  }

  .user-records-modal {
    max-height: calc(97vh - 3vh);
  }

  .modal-header {
    padding: 16px 16px 12px;
  }

  .modal-body {
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
  }

  .record-item {
    padding: 10px;
  }

  .photo-thumbnail {
    height: 120px;
  }
}
</style>
