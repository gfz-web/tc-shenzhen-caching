<script setup lang="ts">
import type { UserInfo } from '~/composables/useUserInfo'
import { computed, reactive, ref, watch } from 'vue'
import { usePOIData } from '~/composables/usePOIData'
import { useToast } from '~/composables/useToast'
import { useUserInfo } from '~/composables/useUserInfo'
import { calculateCheckinTotalScore, calculatePOIScores } from '~/utils/scoreCalculation'

interface Props {
  visible: boolean
  isFirstTime?: boolean // 是否是首次填写
  checkinRecords?: readonly any[] // 打卡记录数据
}

interface Emits {
  (e: 'close'): void
  (e: 'saved', userInfo: UserInfo): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { saveUserInfo, validateUserInfo, getCurrentUserInfo } = useUserInfo()
const { success, error } = useToast()
const { pois } = usePOIData()

const submitting = ref(false)

// 照片查看相关状态
const showPhotoModal = ref(false)
const selectedCheckinRecord = ref<any>(null)

const formData = reactive<UserInfo>({
  employeeId: '',
  employeeName: '',
})

// 计算当前用户的打卡记录和积分
const currentUserCheckins = computed(() => {
  const currentInfo = getCurrentUserInfo()
  console.warn('UserInfoModal - 调试信息:', {
    employeeId: currentInfo.employeeId,
    checkinRecordsLength: props.checkinRecords?.length || 0,
    checkinRecords: props.checkinRecords,
  })

  if (!currentInfo.employeeId || !props.checkinRecords)
    return []

  const filtered = props.checkinRecords
    .filter(record => record.employeeId === currentInfo.employeeId)
    .sort((a, b) => b.timestamp - a.timestamp) // 按时间倒序

  console.warn('UserInfoModal - 过滤后的打卡记录:', filtered)
  return filtered
})

const currentUserStats = computed(() => {
  const checkins = currentUserCheckins.value
  let totalScore = 0

  checkins.forEach((record) => {
    // 审核不通过的记录不计入总分
    if (record.isRejected === true) {
      return
    }
    // 找到对应的POI
    const poi = pois.value.find(p => p.id === record.poiId)
    if (!poi) {
      // 如果找不到POI，尝试从打卡记录的坐标计算分数
      if (record.coordinates) {
        // 使用打卡记录的坐标计算距离分数，假设POI基础分为1分
        const poiScores = calculatePOIScores([record.coordinates.lng, record.coordinates.lat], 1)
        // 包含结伴加分和彩蛋加分
        const finalScore = calculateCheckinTotalScore(1, poiScores.distanceScore, record.companionCount, undefined, new Date(record.timestamp))
        totalScore += finalScore
      }
      else {
        // 如果连坐标都没有，使用最小分数（包含结伴加分和彩蛋加分）
        const finalScore = calculateCheckinTotalScore(1, 0, record.companionCount, undefined, new Date(record.timestamp))
        totalScore += finalScore
      }
      return
    }

    // 使用统一的积分计算工具计算POI分数（点位分数+距离分数+结伴加分+彩蛋加分）
    const poiScores = calculatePOIScores([poi.position[0], poi.position[1]], poi.rating || 0)
    const finalScore = calculateCheckinTotalScore(poi.rating || 0, poiScores.distanceScore, record.companionCount, poi.easter_egg, new Date(record.timestamp))
    totalScore += finalScore
  })

  return {
    totalScore,
    checkinCount: checkins.length,
    uniquePOIs: [...new Set(checkins.map(r => r.poiId))].length,
  }
})

// 格式化时间
function formatCheckinTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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

  // 使用统一的积分计算工具计算POI分数（点位分数+距离分数+结伴加分+彩蛋加分）
  const poiScores = calculatePOIScores([poi.position[0], poi.position[1]], poi.rating || 0)
  return calculateCheckinTotalScore(poi.rating || 0, poiScores.distanceScore, record.companionCount, poi.easter_egg, new Date(record.timestamp))
}

// 监听弹窗显示状态，初始化表单数据
watch(() => props.visible, (visible) => {
  if (visible) {
    const currentInfo = getCurrentUserInfo()
    formData.employeeId = currentInfo.employeeId
    formData.employeeName = currentInfo.employeeName

    // 防止背景页面滚动
    document.body.style.overflow = 'hidden'
  }
  else {
    // 恢复页面滚动
    document.body.style.overflow = ''
  }
})

// 组件卸载时恢复页面滚动
onBeforeUnmount(() => {
  document.body.style.overflow = ''
})

// 提交表单
async function onSubmit() {
  if (submitting.value)
    return

  // 验证表单
  const validation = validateUserInfo(formData)
  if (!validation.valid) {
    error(validation.error || '请检查输入内容')
    return
  }

  submitting.value = true

  try {
    saveUserInfo(formData)
    success('用户信息保存成功')
    emit('saved', { ...formData })
    onClose()
  }
  catch (err: any) {
    error(err.message || '保存失败')
  }
  finally {
    submitting.value = false
  }
}

// 关闭弹窗
function onClose() {
  if (props.isFirstTime) {
    // 首次填写时不允许关闭（除非已填写）
    const validation = validateUserInfo(formData)
    if (!validation.valid) {
      error('请完成用户信息填写')
      return
    }
  }
  emit('close')
}

// 获取标题
function getTitle(): string {
  if (props.isFirstTime) {
    return '首次使用 - 请填写用户信息'
  }
  else {
    const currentInfo = getCurrentUserInfo()
    if (currentInfo.employeeName && currentInfo.employeeId) {
      return `${currentInfo.employeeName}(${currentInfo.employeeId})`
    }
    return '编辑用户信息'
  }
}

// 获取提交按钮文本
function getSubmitText(): string {
  if (submitting.value)
    return '保存中...'
  return props.isFirstTime ? '完成设置' : '保存修改'
}

// 打卡记录照片查看
function viewCheckinPhoto(record: any) {
  if (record.photo) {
    selectedCheckinRecord.value = record
    showPhotoModal.value = true
  }
}

function closePhotoModal() {
  showPhotoModal.value = false
  selectedCheckinRecord.value = null
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="user-info-modal-overlay" @click="onClose">
      <div class="user-info-modal" @click.stop>
        <div class="modal-header">
          <h3>👤 {{ getTitle() }}</h3>
          <button v-if="!isFirstTime" class="close-btn" @click="onClose">
            ×
          </button>
        </div>

        <div class="modal-body">
          <div v-if="isFirstTime" class="first-time-notice">
            <div class="notice-icon text-center">
              🌟
            </div>
            <div class="notice-content">
              <p>欢迎使用深圳地图打卡系统！</p>
              <p>请先填写您的基本信息，这将用于所有打卡记录。</p>
            </div>
          </div>

          <!-- 用户统计信息 -->
          <div v-if="!isFirstTime && currentUserStats.checkinCount > 0" class="user-stats-section">
            <div class="stats-header">
              <h4>📊 我的打卡统计</h4>
            </div>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-number">
                  {{ currentUserStats.totalScore }}
                </div>
                <div class="stat-label">
                  总积分
                </div>
              </div>
              <div class="stat-item">
                <div class="stat-number">
                  {{ currentUserStats.checkinCount }}
                </div>
                <div class="stat-label">
                  打卡次数
                </div>
              </div>
              <div class="stat-item">
                <div class="stat-number">
                  {{ currentUserStats.uniquePOIs }}
                </div>
                <div class="stat-label">
                  打卡地点
                </div>
              </div>
            </div>
          </div>

          <form @submit.prevent="onSubmit">
            <div class="form-group">
              <label for="employeeId" class="form-label">
                工号 <span class="required">*</span>
              </label>
              <input
                id="employeeId"
                v-model="formData.employeeId"
                type="text"
                placeholder="请输入工号（纯数字）"
                pattern="[0-9]*"
                inputmode="numeric"
                class="form-input"
                required
                maxlength="20"
                :disabled="submitting"
              >
              <div class="input-hint">
                请输入您的员工工号，仅支持数字
              </div>
            </div>

            <div class="form-group">
              <label for="employeeName" class="form-label">
                昵称 <span class="required">*</span>
              </label>
              <input
                id="employeeName"
                v-model="formData.employeeName"
                type="text"
                placeholder="请输入您的昵称"
                class="form-input"
                required
                maxlength="100"
                :disabled="submitting"
              >
              <div class="input-hint">
                请输入您的昵称或真实姓名
              </div>
            </div>

            <div class="form-actions">
              <button
                v-if="!isFirstTime"
                type="button"
                class="cancel-btn"
                :disabled="submitting || !isFirstTime"
                @click="onClose"
              >
                取消
              </button>
              <button
                type="submit"
                class="submit-btn"
                :disabled="submitting"
              >
                {{ getSubmitText() }}
              </button>
            </div>
          </form>

          <!-- 打卡记录列表 -->
          <div v-if="!isFirstTime" class="checkin-records-section">
            <div class="records-header">
              <h4>📍 最近打卡记录</h4>
              <span class="records-count">{{ currentUserCheckins.length }}条记录</span>
            </div>
            <div class="records-list">
              <!-- 有打卡记录时显示列表 -->
              <div
                v-for="record in currentUserCheckins.slice(0, 5)"
                v-if="currentUserCheckins.length > 0"
                :key="record.id"
                class="record-item"
                :class="{
                  'has-photo': record.photo,
                  'rejected': record.isRejected === true,
                }"
                @click.stop="viewCheckinPhoto(record)"
              >
                <div class="record-main">
                  <div class="record-header">
                    <div class="record-poi">
                      {{ record.poiName }}
                    </div>
                    <div class="record-score">
                      <span class="score-label">获得积分:</span>
                      <span class="score-value" :class="{ 'rejected-score': record.isRejected === true }">
                        {{ getRecordTotalScore(record) }}分
                        <span v-if="record.isRejected === true" class="rejected-text">不计入总分</span>
                      </span>
                    </div>
                  </div>
                  <div class="record-time">
                    {{ formatCheckinTime(record.timestamp) }}
                  </div>

                  <div class="record-details">
                    <span v-if="record.rating" class="user-rating">🏔️ 建议难度{{ record.rating }}分</span>
                    <span v-if="record.photo" class="record-photo">📷</span>
                    <span v-if="record.comment" class="record-comment">💭</span>
                    <span v-if="record.companionCount && record.companionCount > 1" class="companion-info">👥 {{ record.companionCount }}人</span>
                  </div>
                </div>
              </div>

              <!-- 没有打卡记录时的提示 -->
              <div v-else class="empty-records">
                <div class="empty-icon">
                  📍
                </div>
                <div class="empty-text">
                  还没有打卡记录
                </div>
                <div class="empty-hint">
                  去地图上探索深圳的精彩地点吧！
                </div>
              </div>
            </div>
            <div v-if="currentUserCheckins.length > 5" class="more-records">
              还有{{ currentUserCheckins.length - 5 }}条记录...
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 照片查看模态框 -->
    <PhotoViewModal
      :is-open="showPhotoModal"
      :checkin-record="selectedCheckinRecord"
      @close="closePhotoModal"
    />
  </Teleport>
</template>

<style scoped>
/* 弹窗遮罩 */
.user-info-modal-overlay {
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
.user-info-modal {
  background: white;
  border-radius: 12px;
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

/* 桌面端尺寸优化 */
@media (min-width: 1024px) {
  .user-info-modal {
    max-width: 500px;
    max-height: 60vh;
  }
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

/* 首次使用提示 */
.first-time-notice {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
  border: 1px solid #bbdefb;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
}

.notice-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.notice-content {
  flex: 1;
}

.notice-content p {
  margin: 0 0 8px 0;
  color: var(--text-primary, #333);
  font-size: 14px;
  line-height: 1.5;
}

.notice-content p:last-child {
  margin-bottom: 0;
}

/* 表单样式 */
.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary, #333);
  font-size: 14px;
}

.required {
  color: #dc3545;
  margin-left: 2px;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--gray-border, #e9ecef);
  border-radius: 8px;
  font-family: inherit;
  font-size: 16px;
  background: white;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-color, #007bff);
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.form-input:disabled {
  background: var(--gray-light, #f8f9fa);
  color: var(--text-secondary, #666);
  cursor: not-allowed;
}

.form-input::placeholder {
  color: #999;
}

.input-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary, #666);
  line-height: 1.4;
}

/* 表单操作区 */
.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid var(--gray-border, #e9ecef);
}

.cancel-btn {
  padding: 12px 24px;
  border: 2px solid var(--gray-border, #e9ecef);
  background: white;
  color: var(--text-secondary, #666);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.cancel-btn:hover:not(:disabled) {
  background: var(--gray-light, #f8f9fa);
  border-color: #999;
  color: var(--text-primary, #333);
}

.cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.submit-btn {
  padding: 12px 32px;
  background: linear-gradient(135deg, var(--primary-color, #007bff), #0056b3);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.2);
}

.submit-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #0056b3, #004085);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
}

.submit-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 用户统计样式 */
.user-stats-section {
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
}

.stats-header h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-item {
  text-align: center;
  background: white;
  padding: 16px 12px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  color: var(--primary-color, #007bff);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary, #666);
  font-weight: 500;
}

/* 打卡记录样式 */
.checkin-records-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-top: 24px;
}

.records-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.records-header h4 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.records-count {
  font-size: 12px;
  color: var(--text-secondary, #666);
  background: white;
  padding: 4px 8px;
  border-radius: 12px;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.record-item {
  background: white;
  border-radius: 6px;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.record-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.record-item.has-photo {
  cursor: pointer;
  position: relative;
}

.record-item.has-photo:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  background: #f8f9fa;
}

.record-item.rejected {
  border-left: 4px solid #dc3545;
  background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%);
  position: relative;
}

.record-item.rejected::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #dc3545 0%, #ff6b6b 100%);
  border-radius: 6px 6px 0 0;
}

.record-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.record-poi {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #333);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.record-time {
  font-size: 12px;
  color: var(--text-secondary, #666);
}

.record-score {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.score-label {
  font-size: 11px;
  color: var(--text-secondary, #666);
}

.score-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-color, #007bff);
  background: rgba(0, 123, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.record-details {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.user-rating,
.poi-score,
.record-photo,
.record-comment,
.companion-info {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 8px;
  background: #e9ecef;
  color: #495057;
}

.user-rating {
  background: #fff3cd;
  color: #856404;
}

.poi-score {
  background: #e3f2fd;
  color: #1565c0;
}

.record-photo {
  background: #d1ecf1;
  color: #0c5460;
}

.record-comment {
  background: #d4edda;
  color: #155724;
}

.companion-info {
  background: #e1ecf4;
  color: #0c5460;
}

.record-action {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.view-photo-btn {
  width: 100%;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-photo-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.more-records {
  text-align: center;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-secondary, #666);
  font-style: italic;
}

.position-info {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-row .label {
  font-size: 14px;
  color: var(--text-secondary, #666);
  font-weight: 500;
}

.info-row .value {
  font-size: 13px;
  color: var(--text-primary, #333);
  font-family: monospace;
}

.offset-controls {
  margin-bottom: 20px;
}

.offset-group {
  margin-bottom: 32px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.offset-group:last-child {
  margin-bottom: 0;
}

.offset-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #333);
}

.offset-direction-hint {
  font-size: 12px;
  color: var(--text-secondary, #666);
  margin-bottom: 16px;
  font-style: italic;
}

.slider-container {
  margin-bottom: 16px;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.slider-label {
  font-size: 11px;
  color: var(--text-secondary, #666);
  font-weight: 500;
}

.offset-slider {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: #e5e7eb;
  outline: none;
  appearance: none;
  cursor: pointer;
  margin-bottom: 8px;
}

.lat-slider {
  background: linear-gradient(90deg, #ef4444 0%, #f3f4f6 50%, #22c55e 100%);
}

.lng-slider {
  background: linear-gradient(90deg, #f59e0b 0%, #f3f4f6 50%, #3b82f6 100%);
}

.offset-slider::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  border: 3px solid #3b82f6;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
}

.offset-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.lat-slider::-webkit-slider-thumb {
  border-color: #22c55e;
}

.lng-slider::-webkit-slider-thumb {
  border-color: #3b82f6;
}

.offset-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  border: 3px solid #3b82f6;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.lat-slider::-moz-range-thumb {
  border-color: #22c55e;
}

.lng-slider::-moz-range-thumb {
  border-color: #3b82f6;
}

.slider-value {
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: #3b82f6;
  margin-bottom: 8px;
}

.lat-slider + .slider-value {
  color: #22c55e;
}

.lng-slider + .slider-value {
  color: #3b82f6;
}

.manual-input {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.input-label {
  font-size: 13px;
  color: var(--text-secondary, #666);
  font-weight: 500;
  white-space: nowrap;
}

.offset-input {
  width: 80px;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
  background: white;
}

.offset-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.input-unit {
  font-size: 13px;
  color: var(--text-secondary, #666);
  font-weight: 500;
}

.note-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.note-text {
  flex: 1;
}

.note-text p {
  margin: 0 0 6px 0;
  font-size: 13px;
  color: var(--text-primary, #333);
  line-height: 1.4;
}

.note-text p:last-child {
  margin-bottom: 0;
}

.save-btn {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-btn:hover {
  background: linear-gradient(135deg, #20c997, #17a2b8);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);
}

/* 深色模式 */
.dark .user-info-modal {
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

.dark .first-time-notice {
  background: linear-gradient(135deg, #1e3a8a, #581c87);
  border-color: #3b82f6;
}

.dark .notice-content p {
  color: #e5e7eb;
}

.dark .form-label {
  color: #f9fafb;
}

.dark .form-input {
  background: #374151;
  border-color: #4b5563;
  color: #f9fafb;
}

.dark .form-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dark .form-input:disabled {
  background: #4b5563;
  color: #9ca3af;
}

.dark .form-input::placeholder {
  color: #9ca3af;
}

.dark .input-hint {
  color: #9ca3af;
}

.dark .form-actions {
  border-top-color: #374151;
}

.dark .cancel-btn {
  background: #374151;
  border-color: #4b5563;
  color: #9ca3af;
}

.dark .cancel-btn:hover:not(:disabled) {
  background: #4b5563;
  border-color: #6b7280;
  color: #e5e7eb;
}

.dark .submit-btn {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
}

.dark .submit-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* 深色模式下的统计和记录样式 */
.dark .user-stats-section {
  background: linear-gradient(135deg, #374151, #4b5563);
}

.dark .stats-header h4 {
  color: #f9fafb;
}

.dark .stat-item {
  background: #1f2937;
}

.dark .stat-number {
  color: #60a5fa;
}

.dark .stat-label {
  color: #9ca3af;
}

.dark .checkin-records-section {
  background: #374151;
}

.dark .records-header h4 {
  color: #f9fafb;
}

.dark .records-count {
  background: #1f2937;
  color: #d1d5db;
}

.dark .record-item {
  background: #1f2937;
}

.dark .record-item.has-photo:hover {
  background: #374151;
}

.dark .record-poi {
  color: #f9fafb;
}

.dark .record-time {
  color: #9ca3af;
}

.dark .score-label {
  color: #9ca3af;
}

.dark .score-value {
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
}

.dark .user-rating,
.dark .poi-score,
.dark .record-photo,
.dark .record-comment,
.dark .companion-info {
  background: #4b5563;
  color: #d1d5db;
}

.dark .user-rating {
  background: #92400e;
  color: #fbbf24;
}

.dark .poi-score {
  background: #1e3a8a;
  color: #93c5fd;
}

.dark .record-photo {
  background: #155e75;
  color: #67e8f9;
}

.dark .record-comment {
  background: #14532d;
  color: #86efac;
}

.dark .companion-info {
  background: #1e3a8a;
  color: #93c5fd;
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

/* 审核不通过积分样式 */
.rejected-score {
  color: #dc3545 !important;
  font-weight: 600;
}

.rejected-text {
  font-size: 10px;
  color: #dc3545;
  margin-left: 4px;
}

/* 审核说明 */
.rejection-reason {
  background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
  border: 1px solid #ffc107;
  border-radius: 6px;
  padding: 8px;
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

.rejection-reason-text {
  font-size: 12px;
  color: #856404;
  line-height: 1.4;
  margin-bottom: 4px;
}

.rejection-notice {
  font-size: 11px;
  color: #dc3545;
  font-weight: 600;
  background: rgba(220, 53, 69, 0.1);
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid rgba(220, 53, 69, 0.2);
}

/* 深色模式下的审核样式 */
.dark .record-item.rejected {
  background: linear-gradient(135deg, #2d1b1b 0%, #1f2937 100%);
  border-left-color: #dc2626;
}

.dark .rejection-badge {
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  box-shadow: 0 2px 4px rgba(220, 38, 38, 0.4);
}

.dark .rejection-reason {
  background: linear-gradient(135deg, #451a03 0%, #78350f 100%);
  border-color: #d97706;
}

.dark .rejection-reason-text {
  color: #fbbf24;
}

.dark .rejection-notice {
  color: #fca5a5;
  background: rgba(220, 38, 38, 0.2);
  border-color: rgba(220, 38, 38, 0.3);
}

.dark .view-photo-btn {
  background: #3b82f6;
  color: white;
}

.dark .view-photo-btn:hover {
  background: #2563eb;
}

.dark .more-records {
  color: #9ca3af;
}

.dark .status-text {
  color: #f9fafb;
}

.dark .position-info {
  background: #374151;
}

.dark .info-row .label {
  color: #9ca3af;
}

.dark .info-row .value {
  color: #e5e7eb;
}

.dark .offset-group {
  background: #1f2937;
  border-color: #374151;
}

.dark .offset-group label {
  color: #f9fafb;
}

.dark .offset-direction-hint {
  color: #9ca3af;
}

.dark .slider-label {
  color: #9ca3af;
}

/* 空状态样式 */
.empty-records {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #374151;
}

.empty-hint {
  font-size: 14px;
  color: #9ca3af;
}

.dark .empty-text {
  color: #e5e7eb;
}

.dark .empty-hint {
  color: #6b7280;
}

.dark .manual-input {
  background: #374151;
  border-color: #4b5563;
}

.dark .input-label {
  color: #d1d5db;
}

.dark .input-unit {
  color: #d1d5db;
}

.dark .offset-input {
  background: #1f2937;
  border-color: #4b5563;
  color: #e5e7eb;
}

.dark .offset-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.dark .lat-slider {
  background: linear-gradient(90deg, #7f1d1d 0%, #374151 50%, #14532d 100%);
}

.dark .lng-slider {
  background: linear-gradient(90deg, #92400e 0%, #374151 50%, #1e3a8a 100%);
}

.dark .note-text p {
  color: #e5e7eb;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .user-info-modal-overlay {
    padding: 12px;
    align-items: flex-start;
    padding-top: 5vh;
  }

  .user-info-modal {
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

  .first-time-notice {
    padding: 16px;
    margin-bottom: 20px;
  }

  .notice-icon {
    font-size: 20px;
  }

  .notice-content p {
    font-size: 13px;
  }

  .form-group {
    margin-bottom: 18px;
  }

  .form-input {
    padding: 14px 16px;
    font-size: 16px; /* 防止iOS缩放 */
  }

  .form-actions {
    flex-direction: column-reverse;
    gap: 12px;
    margin-top: 24px;
  }

  .cancel-btn,
  .submit-btn {
    width: 100%;
    padding: 14px 24px;
    font-size: 16px;
  }
}

/* 小屏幕优化 */
@media (max-width: 480px) {
  .user-info-modal-overlay {
    padding: 8px;
    padding-top: 3vh;
  }

  .user-info-modal {
    max-height: calc(97vh - 3vh);
  }

  .modal-header {
    padding: 16px 16px 12px;
  }

  .modal-body {
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
  }

  .first-time-notice {
    flex-direction: column;
    text-align: center;
    gap: 12px;
    padding: 16px;
  }

  .form-actions {
    margin-top: 20px;
    padding-top: 16px;
  }
}
</style>
