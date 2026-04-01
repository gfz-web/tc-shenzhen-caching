<script setup>
import { computed, ref, watch } from 'vue'
import { calculateCheckinTotalScore, calculateCompanionBonus, calculateEasterEggBonus, calculatePOIScores, formatDistance, getDistanceLevel } from '~/utils/scoreCalculation'

// Props
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  checkinRecord: {
    type: Object,
    default: null,
  },
})

// Emits
const emit = defineEmits(['close'])

// State
const imageLoading = ref(false)
const imageError = ref(false)

const _config = useRuntimeConfig()
const { pois } = usePOIData()

// 计算分数组成
const scoreBreakdown = computed(() => {
  if (!props.checkinRecord)
    return null

  const record = props.checkinRecord
  const poi = pois.value.find(p => p.id === record.poiId)

  if (!poi) {
    // 如果找不到POI，尝试从打卡记录的坐标计算分数
    if (record.coordinates) {
      const poiScores = calculatePOIScores([record.coordinates.lng, record.coordinates.lat], 1)
      const companionBonus = calculateCompanionBonus(record.companionCount)
      const easterEggBonus = 0 // 没有POI信息时彩蛋加分为0
      const totalScore = calculateCheckinTotalScore(1, poiScores.distanceScore, record.companionCount, undefined, new Date(record.timestamp))

      return {
        baseScore: 1,
        distanceScore: poiScores.distanceScore,
        companionBonus,
        easterEggBonus,
        totalScore,
        distance: poiScores.distance,
        distanceLevel: getDistanceLevel(poiScores.distanceScore),
      }
    }
    else {
      // 如果连坐标都没有，使用最小分数
      const companionBonus = calculateCompanionBonus(record.companionCount)
      const easterEggBonus = 0 // 没有POI信息时彩蛋加分为0
      const totalScore = calculateCheckinTotalScore(1, 0, record.companionCount, undefined, new Date(record.timestamp))

      return {
        baseScore: 1,
        distanceScore: 0,
        companionBonus,
        easterEggBonus,
        totalScore,
        distance: 0,
        distanceLevel: '很近',
      }
    }
  }

  // 使用POI数据计算分数
  const poiScores = calculatePOIScores([poi.position[0], poi.position[1]], poi.rating || 0)
  const companionBonus = calculateCompanionBonus(record.companionCount)
  const easterEggBonus = poi.easter_egg && record.timestamp ? calculateEasterEggBonus(poi.easter_egg, new Date(record.timestamp)) : 0
  const totalScore = calculateCheckinTotalScore(poi.rating || 0, poiScores.distanceScore, record.companionCount, poi.easter_egg, new Date(record.timestamp))

  return {
    baseScore: poi.rating || 0,
    distanceScore: poiScores.distanceScore,
    companionBonus,
    easterEggBonus,
    totalScore,
    distance: poiScores.distance,
    distanceLevel: getDistanceLevel(poiScores.distanceScore),
  }
})

// Methods
function closeModal() {
  emit('close')
}

function onImageLoad() {
  imageLoading.value = false
  imageError.value = false
}

function onImageError() {
  imageLoading.value = false
  imageError.value = true
}

function retryLoadImage() {
  imageError.value = false
  imageLoading.value = true
  // 触发图片重新加载
  const img = document.querySelector('.checkin-photo')
  if (img && props.checkinRecord?.photo) {
    img.src = props.checkinRecord.photo
  }
}

function formatCheckinTime(timestamp) {
  if (!timestamp)
    return ''

  const date = new Date(timestamp)
  const now = new Date()
  const diffTime = now - date
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  else if (diffDays === 1) {
    return `昨天 ${date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }
  else if (diffDays < 7) {
    return `${diffDays}天前`
  }
  else {
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    })
  }
}

// Watch for photo changes
watch(() => props.checkinRecord?.photo, (newPhoto) => {
  if (newPhoto) {
    imageLoading.value = true
    imageError.value = false
  }
  else {
    imageLoading.value = false
    imageError.value = false
  }
}, { immediate: true })

// Reset state when modal opens/closes
watch(() => props.isOpen, (isOpen) => {
  if (isOpen && props.checkinRecord?.photo) {
    imageLoading.value = true
    imageError.value = false
  }
  else if (!isOpen) {
    imageLoading.value = false
    imageError.value = false
  }
})
</script>

<template>
  <div v-if="isOpen" class="photo-modal-overlay" @click="closeModal">
    <div class="photo-modal-content" @click.stop>
      <div class="photo-modal-header">
        <div class="photo-modal-title">
          <h3>打卡照片</h3>
          <div v-if="checkinRecord" class="photo-info">
            <div class="flex gap-2 items-center">
              <span class="poi-name">{{ checkinRecord.poiName }}</span>
              <!-- 审核不通过红标 -->
              <span v-if="checkinRecord.isRejected === true" class="rejection-badge">
                审核不通过
              </span>
            </div>
            <span class="checkin-time">{{ formatCheckinTime(checkinRecord.timestamp) }}</span>
          </div>
        </div>
        <button class="close-btn" @click="closeModal">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z" />
          </svg>
        </button>
      </div>

      <div class="photo-modal-body">
        <!-- 审核说明 -->
        <div v-if="checkinRecord && checkinRecord.isRejected === true && checkinRecord.rejectionReason" class="rejection-section">
          <h4>⚠️ 审核说明</h4>
          <div class="rejection-reason">
            <div class="rejection-reason-text">
              {{ checkinRecord.rejectionReason }}
            </div>
            <div class="rejection-notice">
              🚫 最终不会计入总分+排名
            </div>
          </div>
        </div>

        <div v-if="checkinRecord && checkinRecord.photo" class="photo-container">
          <img
            v-show="!imageLoading && !imageError"
            :src="checkinRecord.photo"
            :alt="`${checkinRecord.poiName} 打卡照片`"
            class="checkin-photo"
            @load="onImageLoad"
            @error="onImageError"
          >
          <div v-if="imageLoading" class="photo-loading">
            <div class="loading-spinner" />
            <span>照片加载中...</span>
          </div>
          <div v-if="imageError" class="photo-error">
            <div class="error-icon">
              📷
            </div>
            <span>照片加载失败</span>
            <button class="retry-btn" @click="retryLoadImage">
              重试
            </button>
          </div>
        </div>

        <!-- 分数组成详情 -->
        <div v-if="scoreBreakdown" class="score-breakdown-section">
          <h4>📊 积分组成详情</h4>
          <div class="score-breakdown">
            <div class="score-item">
              <div class="score-label">
                <span class="score-icon">📍</span>
                <span class="score-name">点位基础分</span>
              </div>
              <div class="score-value">
                {{ scoreBreakdown.baseScore }}分
              </div>
            </div>
            <div class="score-item">
              <div class="score-label">
                <span class="score-icon">🗺️</span>
                <span class="score-name">距离加分</span>
                <span class="score-detail">({{ formatDistance(scoreBreakdown.distance) }}, {{ scoreBreakdown.distanceLevel }})</span>
              </div>
              <div class="score-value">
                {{ scoreBreakdown.distanceScore }}分
              </div>
            </div>
            <div v-if="scoreBreakdown.companionBonus > 0" class="score-item">
              <div class="score-label">
                <span class="score-icon">👥</span>
                <span class="score-name">结伴加分</span>
                <span class="score-detail">({{ checkinRecord.companionCount }}人结伴)</span>
              </div>
              <div class="score-value">
                +{{ scoreBreakdown.companionBonus }}分
              </div>
            </div>
            <div v-if="scoreBreakdown.easterEggBonus > 0" class="score-item easter-egg-bonus">
              <div class="score-label">
                <span class="score-icon">💰</span>
                <span class="score-name">彩蛋奖励</span>
                <span class="score-detail">(特定时段额外加分)</span>
              </div>
              <div class="score-value bonus-value">
                +{{ scoreBreakdown.easterEggBonus }}分
              </div>
            </div>
            <div class="score-total">
              <div class="score-label">
                <span class="score-icon">🎯</span>
                <span class="score-name">总积分</span>
              </div>
              <div class="score-value total" :class="{ 'rejected-score': checkinRecord?.isRejected === true }">
                {{ scoreBreakdown.totalScore }}分
                <span v-if="checkinRecord?.isRejected === true" class="rejected-notice">不计入总分</span>
              </div>
            </div>
          </div>

          <!-- 计算公式说明 -->
          <div class="formula-explanation">
            <h5>📝 计算公式</h5>
            <div class="formula-text">
              总积分 = 点位基础分 + 距离加分 + 结伴加分 + 彩蛋加分
            </div>
            <div class="formula-details">
              <p>• <strong>点位基础分</strong>: 根据POI的难度等级评定 (1-5分)</p>
              <p>• <strong>距离加分</strong>: 根据距离深圳中心的远近给予额外分数 (0-5分)</p>
              <p>• <strong>结伴加分</strong>: 2人及以上每多1人加1分，最多5分，鼓励团队活动</p>
              <p>• <strong>彩蛋加分</strong>: 在特定时间段打卡可获得额外奖励分数</p>
            </div>
          </div>

          <div v-if="checkinRecord && checkinRecord.comment" class="comment-section">
            <h4>💭 打卡留言</h4>
            <p class="checkin-comment">
              {{ checkinRecord.comment }}
            </p>
          </div>
          <div v-if="checkinRecord && checkinRecord.rating" class="rating-section">
            <h4>🏔️ 建议难度等级</h4>
            <div class="rating-display">
              <span class="rating-stars">
                <span v-for="star in 5" :key="star" class="star" :class="{ filled: star <= checkinRecord.rating }">
                  ★
                </span>
              </span>
              <span class="rating-text">{{ checkinRecord.rating }} / 5</span>
            </div>
            <div class="difficulty-note">
              💡 此评级为用户建议的难度等级，不计入分数
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.photo-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000000;
  padding: 20px;
}

.photo-modal-content {
  background: white;
  border-radius: 12px;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 600px;
  width: 100%;
  max-height: 70vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.photo-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24px 24px 0;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 24px;
}

.photo-modal-title h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.photo-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.poi-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.poi-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary, #374151);
}

.checkin-time {
  font-size: 14px;
  color: var(--text-secondary, #6b7280);
}

.close-btn {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.photo-modal-body {
  padding: 0 24px 24px;
  overflow-y: auto;
  flex: 1;
}

.photo-container {
  position: relative;
  margin-bottom: 24px;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  max-height: 70vh;
}

.checkin-photo {
  max-width: 100%;
  max-height: 500px;
  width: auto;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.photo-loading,
.photo-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--text-secondary, #6b7280);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error-icon {
  font-size: 48px;
  opacity: 0.5;
}

.retry-btn {
  margin-top: 12px;
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.retry-btn:hover {
  background: #2563eb;
}

.comment-section,
.rating-section,
.score-breakdown-section {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.comment-section h4,
.rating-section h4,
.score-breakdown-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #374151);
}

.checkin-comment {
  margin: 0;
  line-height: 1.6;
  color: var(--text-primary, #374151);
}

.rating-display {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.rating-stars {
  display: flex;
  gap: 2px;
  align-items: center;
}

.star {
  font-size: 20px;
  color: #d1d5db;
  transition: color 0.2s ease;
  line-height: 1;
}

.star.filled {
  color: #fbbf24;
}

.rating-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
  line-height: 1.2;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .photo-modal-overlay {
    padding: 12px;
  }

  .photo-modal-content {
    max-height: 95vh;
  }

  .photo-modal-header {
    padding: 20px 20px 0;
    margin-bottom: 20px;
  }

  .photo-modal-body {
    padding: 0 20px 20px;
  }

  .photo-modal-title h3 {
    font-size: 18px;
  }

  .poi-name {
    font-size: 15px;
  }

  .photo-container {
    min-height: 200px;
    max-height: 60vh;
  }

  .checkin-photo {
    max-height: 350px;
  }

  .rating-display {
    gap: 8px;
  }

  .star {
    font-size: 18px;
  }
}

/* 深色模式 */
.dark .photo-modal-content {
  background: #1f2937;
}

.dark .photo-modal-header {
  border-color: #374151;
}

.dark .photo-modal-title h3 {
  color: #f9fafb;
}

.dark .poi-name {
  color: #e5e7eb;
}

.dark .checkin-time {
  color: #d1d5db;
}

.dark .close-btn {
  color: #9ca3af;
}

.dark .close-btn:hover {
  background: #374151;
  color: #d1d5db;
}

.dark .photo-container {
  background: #374151;
}

.dark .photo-loading,
.dark .photo-error {
  color: #d1d5db;
}

.dark .comment-section,
.dark .rating-section,
.dark .score-breakdown-section {
  background: #374151;
  border-color: #4b5563;
}

.dark .comment-section h4,
.dark .rating-section h4,
.dark .score-breakdown-section h4 {
  color: #f9fafb;
}

.dark .checkin-comment {
  color: #e5e7eb;
}

.dark .rating-text {
  color: #d1d5db;
}

/* 难度提示说明样式 */
.difficulty-note {
  font-size: 11px;
  color: #6c757d;
  margin-top: 6px;
  padding: 4px 8px;
  background: #f8f9fa;
  border-radius: 3px;
  border-left: 2px solid #17a2b8;
}

/* 分数组成样式 */
.score-breakdown {
  margin-bottom: 16px;
}

.score-item,
.score-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e9ecef;
}

.score-total {
  border-bottom: none;
  border-top: 2px solid #007bff;
  margin-top: 8px;
  padding-top: 12px;
  font-weight: 600;
}

.score-label {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.score-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.score-name {
  font-size: 14px;
  color: var(--text-primary, #374151);
  font-weight: 500;
}

.score-detail {
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
  margin-left: 4px;
}

.score-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #374151);
  min-width: 60px;
  text-align: right;
}

.score-value.total {
  font-size: 16px;
  color: var(--primary-color, #007bff);
  font-weight: 700;
}

/* 计算公式说明 */
.formula-explanation {
  background: white;
  border-radius: 6px;
  padding: 12px;
  border: 1px solid #e9ecef;
  margin-bottom: 20px;
}

.formula-explanation h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #374151);
}

.formula-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-color, #007bff);
  margin-bottom: 8px;
  padding: 6px 8px;
  background: rgba(0, 123, 255, 0.1);
  border-radius: 4px;
  text-align: center;
}

.formula-details {
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
  line-height: 1.5;
}

.formula-details p {
  margin: 0 0 4px 0;
}

.formula-details p:last-child {
  margin-bottom: 0;
}

.dark .difficulty-note {
  background: #2d2d2d;
  color: #ccc;
  border-left-color: #17a2b8;
}

/* 深色模式下的分数组成样式 */
.dark .score-item,
.dark .score-total {
  border-bottom-color: #4b5563;
}

.dark .score-total {
  border-top-color: #3b82f6;
}

.dark .score-name {
  color: #e5e7eb;
}

.dark .score-detail {
  color: #9ca3af;
}

.dark .score-value {
  color: #e5e7eb;
}

.dark .score-value.total {
  color: #60a5fa;
}

.dark .formula-explanation {
  background: #1f2937;
  border-color: #4b5563;
}

.dark .formula-explanation h5 {
  color: #f9fafb;
}

.dark .formula-text {
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
}

.dark .formula-details {
  color: #9ca3af;
}

/* 审核不通过红标 */
.rejection-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #dc3545 0%, #ff6b6b 100%);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
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

/* 审核不通过积分样式 */
.rejected-total {
  background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%);
  border: 1px solid #dc3545;
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
}

.rejected-score {
  color: #dc3545 !important;
  font-weight: 700;
}

.rejected-notice {
  font-size: 11px;
  color: #dc3545;
  font-weight: 600;
  margin-left: 8px;
  background: rgba(220, 53, 69, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(220, 53, 69, 0.3);
}

/* 审核说明 */
.rejection-section {
  margin-bottom: 20px;
  padding: 20px;
  background: #fef3c7;
  border-radius: 12px;
  position: relative;
  overflow: hidden;
  border: 1px solid #f59e0b;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
}

.rejection-section h4 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 700;
  color: #92400e;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rejection-reason {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(251, 191, 36, 0.3);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.rejection-reason-text {
  font-size: 15px;
  color: #92400e;
  line-height: 1.6;
  margin-bottom: 12px;
  font-weight: 500;
}

.rejection-notice {
  font-size: 13px;
  color: #dc2626;
  font-weight: 700;
  background: #fef2f2;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #fecaca;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* 深色模式下的审核样式 */
.dark .rejection-badge {
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  box-shadow: 0 2px 4px rgba(220, 38, 38, 0.4);
}

.dark .rejected-total {
  background: linear-gradient(135deg, #2d1b1b 0%, #1f2937 100%);
  border-color: #dc2626;
}

.dark .rejection-section {
  background: #451a03;
  border-color: #d97706;
  box-shadow: 0 4px 12px rgba(217, 119, 6, 0.2);
}

.dark .rejection-section::before {
  background: #d97706;
}

.dark .rejection-section h4 {
  color: #fbbf24;
  font-weight: 700;
}

.dark .rejection-reason {
  background: rgba(0, 0, 0, 0.4);
  border-color: rgba(217, 119, 6, 0.3);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.dark .rejection-reason-text {
  color: #fbbf24;
  font-weight: 500;
}

.dark .rejection-notice {
  color: #fca5a5;
  background: #2d1b1b;
  border-color: #dc2626;
  padding: 8px 12px;
  border-radius: 6px;
  font-weight: 700;
}
</style>
