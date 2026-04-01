<script setup lang="ts">
import type { POIData } from '~/types/amap'
import { calculateDistance, calculateDistanceScore, calculateTotalScore, formatDistance, getDistanceLevel, getEasterEggDisplayInfo, SHENZHEN_CENTER } from '~/utils/scoreCalculation'

// Props
interface Props {
  visible: boolean
  poi: POIData | null
  developerMode?: boolean
  isPOICheckedIn?: (poiId: string) => boolean
  getTotalCheckinCount?: (poiId: string) => number
  getLatestCheckinUser?: (poiId: string) => string | null
  editPOI?: (poi: POIData) => void
  deletePOI?: (id: string) => Promise<boolean>
}

const props = withDefaults(defineProps<Props>(), {
  developerMode: false,
})

// Emits
const emit = defineEmits<{
  close: []
}>()

// 计算属性
const isCheckedIn = computed(() => {
  if (!props.poi || !props.isPOICheckedIn)
    return false
  return props.isPOICheckedIn(props.poi.id)
})

const totalCheckinCount = computed(() => {
  if (!props.poi || !props.getTotalCheckinCount)
    return 0
  return props.getTotalCheckinCount(props.poi.id)
})

const latestCheckinUser = computed(() => {
  if (!props.poi || !props.getLatestCheckinUser)
    return null
  return props.getLatestCheckinUser(props.poi.id)
})

const distance = computed(() => {
  if (!props.poi)
    return 0
  // 统一使用深圳中心点计算距离
  return calculateDistance(props.poi.position, SHENZHEN_CENTER)
})

const distanceScore = computed(() => {
  return calculateDistanceScore(distance.value)
})

const totalScore = computed(() => {
  if (!props.poi)
    return 0
  return calculateTotalScore(props.poi.rating || 1, distanceScore.value)
})

// 彩蛋信息
const easterEggInfo = computed(() => {
  if (!props.poi?.easter_egg)
    return null
  return getEasterEggDisplayInfo(props.poi.easter_egg)
})

// 方法
function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    山脉: '🏔️',
    景点: '🏛️',
    公园: '🌳',
    海滩: '🏖️',
    湖泊: '🏞️',
    建筑: '🏢',
    其他: '📍',
  }
  return icons[category] || '📍'
}

function getDistanceLevelClass(score: number): string {
  if (score >= 8)
    return 'score-excellent'
  if (score >= 6)
    return 'score-good'
  if (score >= 4)
    return 'score-fair'
  return 'score-poor'
}

function handleOverlayClick() {
  emit('close')
}

function openPhotoModal() {
  if (props.poi?.referencePhoto && window.openPhotoModal) {
    window.openPhotoModal(props.poi.referencePhoto)
  }
}

function handleEdit() {
  if (props.poi && props.editPOI) {
    props.editPOI(props.poi)
    emit('close')
  }
}

// 状态
const isDeleting = ref(false)
const isDescriptionExpanded = ref(false)

async function handleDelete() {
  if (props.poi && props.deletePOI && !isDeleting.value) {
    try {
      isDeleting.value = true
      const success = await props.deletePOI(props.poi.id)
      if (success) {
        emit('close')
      }
    }
    catch (error) {
      console.error('删除失败:', error)
    }
    finally {
      isDeleting.value = false
    }
  }
}

function toggleDescription() {
  isDescriptionExpanded.value = !isDescriptionExpanded.value
}
</script>

<template>
  <div v-if="visible" class="poi-info-modal-overlay" @click="handleOverlayClick">
    <div class="poi-info-modal" @click.stop>
      <!-- 关闭按钮 -->
      <button class="poi-modal-close" title="关闭" @click="$emit('close')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <!-- POI信息内容 -->
      <div v-if="poi" class="poi-modal-content">
        <!-- 头部 -->
        <div class="poi-modal-header">
          <div class="poi-title-section">
            <span class="category-icon">{{ getCategoryIcon(poi.category || '') }}</span>
            <h3 class="poi-title">
              {{ poi.name }}
            </h3>
            <span v-if="isCheckedIn" class="personal-checkin-badge">
              ✓ 已打卡
            </span>
          </div>
          <div v-if="poi.category" class="category-tag">
            {{ poi.category }}
          </div>
        </div>

        <!-- 描述 -->
        <div v-if="poi.description" class="poi-description-section">
          <div class="description-container">
            <div
              class="poi-description"
              :class="{ expanded: isDescriptionExpanded }"
            >
              {{ poi.description }}
            </div>
            <div
              v-if="poi.description && poi.description.length > 100 && !isDescriptionExpanded"
              class="description-fade"
            />
          </div>
          <button
            v-if="poi.description && poi.description.length > 100"
            class="description-toggle"
            @click="toggleDescription"
          >
            {{ isDescriptionExpanded ? '隐藏' : '更多' }}
          </button>
        </div>

        <!-- 信息卡片 -->
        <div class="info-cards">
          <!-- 位置信息 -->
          <div class="info-card location-card">
            <div class="card-header">
              <span class="card-icon">📍</span>
              <span class="card-title">位置信息</span>
            </div>
            <div class="card-content">
              <div class="metric">
                <span class="metric-label">距离</span>
                <span class="distance metric-value">{{ formatDistance(distance) }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">距离评分</span>
                <span class="metric-value" :class="getDistanceLevelClass(distanceScore)">
                  {{ distanceScore }}分 ({{ getDistanceLevel(distanceScore) }})
                </span>
              </div>
            </div>
          </div>

          <!-- 评分信息 -->
          <div class="info-card rating-card">
            <div class="card-header">
              <span class="card-icon">⭐</span>
              <span class="card-title">评分信息</span>
            </div>
            <div class="card-content">
              <div class="metric">
                <span class="metric-label">基础评分</span>
                <span class="metric-value">{{ poi.rating || 1 }}分</span>
              </div>
              <div class="metric">
                <span class="metric-label">综合评分</span>
                <span class="metric-value total-score">{{ totalScore }}分</span>
              </div>
            </div>
          </div>

          <!-- 打卡信息 -->
          <div class="info-card checkin-card">
            <div class="card-header">
              <span class="card-icon">✅</span>
              <span class="card-title">打卡信息</span>
            </div>
            <div class="card-content">
              <div class="metric">
                <span class="metric-label">打卡人数</span>
                <span class="metric-value checkin-count">{{ totalCheckinCount }}人</span>
              </div>
              <div v-if="latestCheckinUser" class="metric">
                <span class="metric-label">最近</span>
                <span class="metric-value latest-user">{{ latestCheckinUser }}</span>
              </div>
              <div v-else class="metric">
                <span class="metric-label">最近</span>
                <span class="metric-value no-checkin">暂无</span>
              </div>
            </div>
          </div>

          <!-- 参考照片 -->
          <div v-if="poi.referencePhoto" class="info-card photo-card">
            <div class="card-header">
              <span class="card-icon">📷</span>
              <span class="card-title">参考照片</span>
            </div>
            <div class="card-content photo-content">
              <img
                :src="poi.referencePhoto"
                alt="打卡参考照片"
                class="reference-image-card"
                title="点击查看大图"
                @click="openPhotoModal"
              >
            </div>
          </div>
        </div>

        <!-- 开发者模式按钮 -->
        <div v-if="developerMode && poi.id !== 'center'" class="developer-actions">
          <button class="edit-btn action-btn" @click="handleEdit">
            <span class="btn-icon">✏️</span>
            <span class="btn-text">修改</span>
          </button>
          <button
            class="action-btn delete-btn"
            :class="{ loading: isDeleting }"
            :disabled="isDeleting"
            @click="handleDelete"
          >
            <span v-if="!isDeleting" class="btn-icon">🗑️</span>
            <span v-else class="loading-spinner" />
            <span class="btn-text">{{ isDeleting ? '删除中...' : '删除' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 弹窗遮罩 */
.poi-info-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
  padding: 20px;
}

/* 弹窗主体 */
.poi-info-modal {
  position: relative;
  background: white;
  border-radius: 16px;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: modalSlideIn 0.3s ease-out;
}

/* 关闭按钮 */
.poi-modal-close {
  position: absolute;
  top: 20px;
  right: 16px;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.1);
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 10;
}

.poi-modal-close:hover {
  background: rgba(0, 0, 0, 0.2);
  transform: scale(1.1);
}

/* 内容区域 */
.poi-modal-content {
  padding: 24px;
  padding-top: 24px; /* 与关闭按钮位置协调 */
}

/* 头部 */
.poi-modal-header {
  margin-bottom: 20px;
}

.poi-title-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  padding-right: 55px; /* 为关闭按钮预留空间，适配36px按钮 */
}

.category-icon {
  font-size: 24px;
}

.poi-title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
  flex: 1;
  min-width: 0; /* 允许标题收缩 */
  word-break: break-word; /* 长标题可以换行 */
}

.personal-checkin-badge {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0; /* 防止徽章被压缩 */
}

.category-tag {
  display: inline-block;
  background: #f3f4f6;
  color: #6b7280;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

/* 描述区域 */
.poi-description-section {
  margin-bottom: 20px;
}

.description-container {
  position: relative;
  overflow: hidden;
}

.poi-description {
  color: #4b5563;
  line-height: 1.6;
  font-size: 15px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: calc(1.6em * 4); /* 4行的高度 */
  overflow: hidden;
}

.poi-description.expanded {
  max-height: 1000px; /* 足够大的值来容纳所有内容 */
}

.description-fade {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2em; /* 渐变区域高度 */
  background: linear-gradient(to bottom, transparent, white);
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.description-toggle {
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 16px;
  margin: 8px auto 0;
  transition: all 0.2s ease;
  display: block;
  border-radius: 6px;
  position: relative;
}

.description-toggle:hover {
  color: #2563eb;
  background: rgba(59, 130, 246, 0.1);
}

.description-toggle:active {
  transform: scale(0.98);
}

/* 信息卡片 */
.info-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.info-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #e5e7eb;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.card-icon {
  font-size: 18px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  min-height: 20px;
}

.metric-label {
  font-size: 13px;
  color: #6b7280;
  white-space: nowrap;
  flex-shrink: 0;
}

.metric-value {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  text-align: right;
}

.metric-value.distance {
  color: #3b82f6;
}

.metric-value.total-score {
  color: #10b981;
  font-size: 16px;
}

.metric-value.checkin-count {
  color: #3b82f6;
  font-weight: 700;
}

.metric-value.latest-user {
  color: #8b5cf6;
  font-weight: 600;
}

.metric-value.no-checkin {
  color: #9ca3af;
  font-style: italic;
}

/* 参考照片卡片 */
.photo-content {
  padding: 0;
}

.reference-image-card {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: block;
}

.reference-image-card:hover {
  transform: scale(1.02);
  opacity: 0.9;
}

/* 评分颜色 */
.score-excellent {
  color: #10b981;
}
.score-good {
  color: #3b82f6;
}
.score-fair {
  color: #f59e0b;
}
.score-poor {
  color: #ef4444;
}

/* 开发者操作按钮 */
.developer-actions {
  display: flex;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.edit-btn {
  background: #3b82f6;
  color: white;
}

.edit-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.delete-btn {
  background: #ef4444;
  color: white;
}

.delete-btn:hover:not(:disabled) {
  background: #dc2626;
  transform: translateY(-1px);
}

.delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.delete-btn.loading {
  pointer-events: none;
}

.btn-icon {
  font-size: 16px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
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

/* 动画 */
@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 暗色模式 */
.dark .poi-info-modal {
  background: #1f2937;
}

.dark .poi-modal-close {
  background: rgba(255, 255, 255, 0.1);
  color: #d1d5db;
}

.dark .poi-modal-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.dark .poi-title {
  color: #f9fafb;
}

.dark .category-tag {
  background: #374151;
  color: #9ca3af;
}

.dark .poi-description {
  color: #d1d5db;
}

.dark .description-fade {
  background: linear-gradient(to bottom, transparent, #1f2937);
}

.dark .description-toggle {
  color: #60a5fa;
}

.dark .description-toggle:hover {
  color: #93c5fd;
  background: rgba(96, 165, 250, 0.1);
}

.dark .reference-image-card {
  border: 1px solid #4b5563;
}

.dark .info-card {
  background: #374151;
  border-color: #4b5563;
}

.dark .card-title {
  color: #f3f4f6;
}

.dark .metric-label {
  color: #9ca3af;
}

.dark .metric-value {
  color: #f9fafb;
}

.dark .developer-actions {
  border-color: #4b5563;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .poi-info-modal-overlay {
    padding: 10px;
  }

  .poi-info-modal {
    max-height: 90vh;
  }

  .poi-modal-content {
    padding: 20px;
    padding-top: 20px;
  }

  .poi-modal-close {
    top: 20px;
    right: 12px;
    width: 32px;
    height: 32px;
  }

  .poi-title-section {
    padding-right: 48px; /* 移动端适配32px关闭按钮 */
  }

  .info-cards {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .reference-image-card {
    height: 100px;
  }

  .poi-title {
    font-size: 20px;
  }

  .metric-label {
    font-size: 12px;
  }

  .metric-value {
    font-size: 13px;
  }
}
</style>
