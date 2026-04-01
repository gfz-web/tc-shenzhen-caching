<script setup lang="ts">
import type { POIData } from '~/types/amap'
import { computed, reactive, ref, watch } from 'vue'
import { useToast } from '~/composables/useToast'
import { useUserInfo } from '~/composables/useUserInfo'
import { getEasterEggDisplayInfo } from '~/utils/scoreCalculation'
import { useActivityCountdown } from '~/composables/useActivityCountdown'

interface CheckinData {
  employeeId: string
  employeeName?: string
  comment: string
  rating: number
  photo?: File
  photoUrl?: string // 服务器上的照片URL
  timestamp: number
  coordinates: {
    lat: number
    lng: number
  }
  companionCount?: number
}

interface Props {
  visible: boolean
  poi: POIData | null
  nearbyPois?: Array<{ poi: POIData, distance: number }>
  selectedPoi?: POIData | null
  userPosition: { lat: number, lng: number } | null
  distance: number | null
  accuracyInfo?: {
    accuracy: number
    level: string
    description: string
    color: string
  } | null
  geoState?: {
    loading: boolean
    error: string | null
  }
}

interface Emits {
  (e: 'close'): void
  (e: 'submit', data: CheckinData): void
  (e: 'improveAccuracy'): void
  (e: 'selectPoi', poi: POIData): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { error } = useToast()
const { userInfo, hasUserInfo } = useUserInfo()
const { isActivityEnded, countdownText, urgencyLevel } = useActivityCountdown()

const photoInput = ref<HTMLInputElement>()
const photoPreview = ref<string>('')
const photoInputCapture = ref<boolean | 'environment' | 'user' | undefined>(undefined)
const submitting = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const showSuccessAnimation = ref(false)
const compressing = ref(false)
const compressionInfo = ref<{ original: number, compressed: number } | null>(null)

const checkinData = reactive<CheckinData>({
  employeeId: '',
  employeeName: '',
  comment: '',
  rating: 5,
  timestamp: Date.now(),
  coordinates: {
    lat: 0,
    lng: 0,
  },
})

// 监听用户位置变化
watch(() => props.userPosition, (newPos) => {
  if (newPos) {
    checkinData.coordinates = { ...newPos }
  }
}, { immediate: true })

// 格式化距离
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}米`
  }
  return `${(meters / 1000).toFixed(1)}公里`
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

// 获取建议难度文本（用于打卡时的建议，不计入分数计算）
function getRatingText(rating: number): string {
  const difficultyTexts = ['', '1分(平地)', '2分(小坡)', '3分(中坡)', '4分(大坡)', '5分(登顶)']
  return difficultyTexts[rating] || ''
}

// 获取提交按钮文本
function getSubmitButtonText(): string {
  if (submitting.value) {
    return '提交中...'
  }
  if (!props.userPosition) {
    if (props.geoState?.loading) {
      return '等待定位...'
    }
    if (props.geoState?.error) {
      return '无法打卡 - 定位失败'
    }
    return '等待位置权限'
  }
  if (!props.poi) {
    return '保存位置记录'
  }
  return '完成打卡'
}

// 选择照片方式
function selectPhoto(type: 'camera' | 'gallery') {
  if (!photoInput.value)
    return

  if (type === 'camera') {
    // 移动端拍照优化：使用更兼容的capture设置
    photoInputCapture.value = 'environment'
    // 设置accept属性确保只接受图片
    photoInput.value.setAttribute('accept', 'image/*')
  }
  else {
    photoInputCapture.value = undefined
    // 相册选择时也确保只接受图片
    photoInput.value.setAttribute('accept', 'image/*')
  }

  // 清除之前的文件选择，确保change事件能正确触发
  photoInput.value.value = ''

  // 延迟触发点击，确保属性设置生效
  setTimeout(() => {
    photoInput.value?.click()
  }, 10)
}

// 更换照片
function changePhoto() {
  if (!photoInput.value)
    return
  photoInput.value.click()
}

// 处理照片上传
async function onPhotoChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return

  // 检查文件类型
  if (!file.type.startsWith('image/')) {
    error('请选择图片文件')
    return
  }

  compressing.value = true
  uploading.value = true
  uploadProgress.value = 0
  compressionInfo.value = null

  try {
    const originalSize = file.size

    // 先创建预览（使用原图）
    const reader = new FileReader()
    reader.onload = (e) => {
      photoPreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)

    // 压缩并上传照片到服务器
    const { uploadImage } = await import('~/utils/fileUpload')

    // 上传时会自动压缩
    const result = await uploadImage(file, {
      onProgress: (progress) => {
        // 前50%显示为压缩进度
        if (progress.percent <= 50) {
          compressing.value = true
        }
        else {
          compressing.value = false
        }
        uploadProgress.value = progress.percent

        // 如果有压缩后的大小信息，更新压缩信息
        if (progress.compressedSize && !compressionInfo.value) {
          compressionInfo.value = {
            original: originalSize,
            compressed: progress.compressedSize,
          }
        }
      },
    })

    // 确保压缩信息已设置（如果回调中没有设置）
    if (!compressionInfo.value && result.url) {
      compressionInfo.value = {
        original: originalSize,
        compressed: Math.round(originalSize * 0.4), // 根据实际压缩率估算
      }
    }

    // 保存文件引用和服务器URL
    checkinData.photo = file
    checkinData.photoUrl = result.url

    if (import.meta.dev) {
      console.warn('照片上传成功:', result.url)
      console.warn('压缩信息:', compressionInfo.value)
    }
  }
  catch (err) {
    // 改进移动端错误处理
    let errorMessage = '照片上传失败，请重试'

    if (err instanceof Error) {
      if (err.message.includes('网络')) {
        errorMessage = '网络连接失败，请检查网络后重试'
      }
      else if (err.message.includes('大小')) {
        errorMessage = '照片文件过大，请选择较小的照片'
      }
      else if (err.message.includes('格式')) {
        errorMessage = '照片格式不支持，请选择JPG或PNG格式'
      }
      else if (err.message.includes('超时')) {
        errorMessage = '上传超时，请重试'
      }
      else if (err.message.includes('压缩')) {
        errorMessage = `照片压缩失败，${err.message}`
      }
    }

    error(errorMessage)
    console.error('照片上传错误:', err)

    // 清除预览和文件
    photoPreview.value = ''
    checkinData.photo = undefined
    checkinData.photoUrl = undefined
    compressionInfo.value = null
  }
  finally {
    compressing.value = false
    uploading.value = false
    uploadProgress.value = 0
  }
}

// 移除照片
function removePhoto() {
  checkinData.photo = undefined
  checkinData.photoUrl = undefined
  photoPreview.value = ''
  compressionInfo.value = null
  if (photoInput.value) {
    photoInput.value.value = ''
  }
}

// 提交打卡
async function onSubmit() {
  // 检查活动是否结束
  if (isActivityEnded.value) {
    error('活动已结束，无法打卡')
    return
  }

  // 验证工号
  if (!checkinData.employeeId.trim()) {
    error('请输入工号')
    return
  }

  // 验证工号格式（仅数字）
  if (!/^\d+$/.test(checkinData.employeeId.trim())) {
    error('工号必须为纯数字')
    return
  }

  // 如果没有位置且不在定位中，提示用户
  if (!props.userPosition && !props.geoState?.loading) {
    error('请先获取位置信息后再提交')
    return
  }

  // 验证照片必填
  if (!checkinData.photo) {
    error('请上传打卡照片')
    return
  }

  // 如果正在定位，等待定位完成
  if (props.geoState?.loading) {
    error('正在定位中，请稍候...')
    return
  }

  // 如果定位失败，不允许提交
  if (props.geoState?.error) {
    error('定位失败，无法打卡。请检查位置权限和网络连接')
    return
  }

  submitting.value = true

  try {
    // 更新时间戳和坐标
    checkinData.timestamp = Date.now()
    if (props.userPosition) {
      checkinData.coordinates = { ...props.userPosition }
    }

    // 显示提交动画
    showSuccessAnimation.value = true

    emit('submit', { ...checkinData })
  }
  catch (err) {
    // 如果出错，隐藏动画
    showSuccessAnimation.value = false
    throw err
  }
  finally {
    submitting.value = false
  }
}

// 关闭弹窗
function onClose() {
  emit('close')
}

// 重置表单
function resetForm() {
  checkinData.employeeId = ''
  checkinData.employeeName = ''
  checkinData.comment = ''
  // 设置建议分数为当前POI的分数，如果没有POI则默认为5
  checkinData.rating = props.poi?.rating || 1
  checkinData.photo = undefined
  checkinData.photoUrl = undefined
  checkinData.companionCount = undefined
  photoPreview.value = ''
  compressionInfo.value = null
  showSuccessAnimation.value = false
  if (photoInput.value) {
    photoInput.value.value = ''
  }
}

// 监听弹窗显示状态，重置表单并处理页面滚动
watch(() => props.visible, (visible) => {
  if (visible) {
    resetForm()
    // 如果有全局用户信息，自动填充
    if (hasUserInfo.value) {
      checkinData.employeeId = userInfo.value.employeeId
      checkinData.employeeName = userInfo.value.employeeName
    }
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

// 计算当前POI的彩蛋信息
const currentEasterEggInfo = computed(() => {
  if (!props.poi?.easter_egg) {
    return null
  }

  return getEasterEggDisplayInfo(props.poi.easter_egg)
})

// 获取GPS信号强度（基于精度）
function _getSignalStrength(accuracy: number): number {
  if (accuracy <= 5)
    return 5 // 极佳
  if (accuracy <= 10)
    return 4 // 很好
  if (accuracy <= 20)
    return 3 // 良好
  if (accuracy <= 50)
    return 2 // 一般
  if (accuracy <= 100)
    return 1 // 较差
  return 0 // 很差
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="checkin-modal-overlay fallback" @click="onClose">
      <div class="checkin-modal" @click.stop>
        <div class="modal-header">
          <h3>📍 {{ poi?.name || '未知地点' }} 打卡</h3>
          <button class="close-btn" @click="onClose">
            ×
          </button>
        </div>

        <div class="modal-body">
          <!-- POI选择和信息 -->
          <div v-if="nearbyPois && nearbyPois.length > 0" class="poi-selection-section">
            <!-- 多个POI可选时显示选择器 -->
            <div v-if="nearbyPois.length > 1" class="poi-selector">
              <div class="selector-header">
                <span class="selector-icon">📍</span>
                <span class="selector-title">选择打卡地点 ({{ nearbyPois.length }}个可选)</span>
              </div>
              <div class="poi-options">
                <div
                  v-for="item in nearbyPois"
                  :key="item.poi.id"
                  class="poi-option"
                  :class="{ active: selectedPoi?.id === item.poi.id }"
                  @click="$emit('selectPoi', item.poi)"
                >
                  <div class="poi-option-info">
                    <div class="poi-option-name">
                      <span>{{ item.poi.name }}</span>
                      <span v-if="getEasterEggDisplayInfo(item.poi.easter_egg)?.isActive" class="easter-egg-badge">
                        {{ getEasterEggDisplayInfo(item.poi.easter_egg)?.icon }}
                      </span>
                    </div>
                    <div class="poi-option-meta">
                      <span class="poi-option-category">{{ item.poi.category }}</span>
                      <span class="poi-option-distance">{{ formatDistance(item.distance) }}</span>
                      <span v-if="getEasterEggDisplayInfo(item.poi.easter_egg)?.isActive" class="easter-egg-time">
                        彩蛋时段
                      </span>
                    </div>
                  </div>
                  <div class="poi-option-indicator">
                    <span v-if="selectedPoi?.id === item.poi.id" class="selected-icon">✓</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 当前选中的POI信息 -->
            <div v-if="poi" class="selected-poi-info">
              <div class="info-header">
                <span class="info-icon">🎯</span>
                <span class="info-title">当前选择的地点</span>
              </div>
              <div class="info-content">
                <div class="info-item">
                  <span class="label">📍 地点：</span>
                  <span class="value">{{ poi.name }}</span>
                </div>
                <div v-if="poi.category" class="info-item">
                  <span class="label">🏷️ 分类：</span>
                  <span class="value">{{ poi.category }}</span>
                </div>
                <div v-if="distance !== null" class="info-item">
                  <span class="label">📏 距离：</span>
                  <span class="value">{{ formatDistance(distance) }}</span>
                </div>
                <!-- 彩蛋信息显示 -->
                <div v-if="currentEasterEggInfo" class="easter-egg-info">
                  <div v-if="currentEasterEggInfo.isActive" class="easter-egg-active">
                    <span class="easter-egg-icon">{{ currentEasterEggInfo.icon }}</span>
                    <div class="easter-egg-details">
                      <div class="easter-egg-title">
                        🎊 彩蛋激活中！
                      </div>
                      <div class="easter-egg-bonus">
                        +{{ currentEasterEggInfo.bonusScore }}分 额外奖励
                      </div>
                      <div class="easter-egg-desc">
                        {{ currentEasterEggInfo.description }}
                      </div>
                    </div>
                  </div>
                  <div v-else class="easter-egg-inactive">
                    <span class="easter-egg-icon-inactive">{{ currentEasterEggInfo.icon }}</span>
                    <div class="easter-egg-details">
                      <div class="easter-egg-title">
                        🎁 彩蛋等待中
                      </div>
                      <div class="easter-egg-time">
                        激活时间：{{ currentEasterEggInfo.timeRange }}
                      </div>
                      <div class="easter-egg-desc">
                        {{ currentEasterEggInfo.description }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 单个POI或无POI时的原始信息 -->
          <div v-else-if="poi" class="poi-info">
            <div class="info-item">
              <span class="label">📍 地点：</span>
              <span class="value">{{ poi.name }}</span>
            </div>
            <div v-if="poi.category" class="info-item">
              <span class="label">🏷️ 分类：</span>
              <span class="value">{{ poi.category }}</span>
            </div>
            <div v-if="distance !== null" class="info-item">
              <span class="label">📏 距离：</span>
              <span class="value">{{ formatDistance(distance) }}</span>
            </div>
            <!-- 彩蛋信息显示 -->
            <div v-if="currentEasterEggInfo" class="easter-egg-info">
              <div v-if="currentEasterEggInfo.isActive" class="easter-egg-active">
                <span class="easter-egg-icon">{{ currentEasterEggInfo.icon }}</span>
                <div class="easter-egg-details">
                  <div class="easter-egg-title">
                    🎊 彩蛋激活中！
                  </div>
                  <div class="easter-egg-bonus">
                    +{{ currentEasterEggInfo.bonusScore }}分 额外奖励
                  </div>
                  <div class="easter-egg-desc">
                    {{ currentEasterEggInfo.description }}
                  </div>
                </div>
              </div>
              <div v-else class="easter-egg-inactive">
                <span class="easter-egg-icon-inactive">{{ currentEasterEggInfo.icon }}</span>
                <div class="easter-egg-details">
                  <div class="easter-egg-title">
                    🎁 彩蛋等待中
                  </div>
                  <div class="easter-egg-time">
                    激活时间：{{ currentEasterEggInfo.timeRange }}
                  </div>
                  <div class="easter-egg-desc">
                    {{ currentEasterEggInfo.description }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 当前范围内没有未打卡的POI时显示提示 -->
          <div v-else-if="!nearbyPois || nearbyPois.length === 0" class="no-pois-available">
            <div class="no-pois-message">
              <span class="message-icon">🚫</span>
              <div class="message-content">
                <h4>附近没有可打卡的地点</h4>
                <p>当前范围内的POI今天都已经打卡过了，请尝试：</p>
                <ul>
                  <li>🔍 扩大搜索范围</li>
                  <li>📍 移动到其他位置</li>
                  <li>⏰ 明天再来打卡</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- 简化的位置状态信息 -->
          <div v-if="!userPosition || geoState?.loading || geoState?.error" class="location-status">
            <!-- 正在定位 -->
            <div v-if="geoState?.loading" class="location-loading">
              <span class="loading-icon">📍</span>
              <span class="loading-text">正在获取位置...</span>
            </div>

            <!-- 定位错误 -->
            <div v-else-if="geoState?.error" class="location-error">
              <span class="error-icon">⚠️</span>
              <span class="error-text">{{ geoState.error }}</span>
              <button type="button" class="retry-btn" @click="$emit('improveAccuracy')">
                重试
              </button>
            </div>

            <!-- 等待位置权限 -->
            <div v-else class="location-waiting">
              <span class="waiting-icon">📍</span>
              <span class="waiting-text">请允许位置访问</span>
              <button type="button" class="start-btn" @click="$emit('improveAccuracy')">
                开始定位
              </button>
            </div>
          </div>

          <!-- 打卡表单 -->
          <form @submit.prevent="onSubmit">
            <!-- 员工信息 -->
            <div class="form-group">
              <label>👤 员工信息:</label>
              <div class="employee-info">
                <div class="input-group">
                  <label for="employeeId" class="input-label">工号 <span class="required">*</span>:</label>
                  <input
                    id="employeeId"
                    v-model="checkinData.employeeId"
                    type="text"
                    placeholder="请输入工号（纯数字）"
                    pattern="[0-9]*"
                    inputmode="numeric"
                    class="employee-input"
                    required
                    maxlength="20"
                    readonly
                    disabled
                  >
                </div>
                <div class="input-group">
                  <label for="employeeName" class="input-label">昵称（可选）:</label>
                  <input
                    id="employeeName"
                    v-model="checkinData.employeeName"
                    type="text"
                    placeholder="请输入昵称"
                    class="employee-input"
                    maxlength="100"
                    readonly
                    disabled
                  >
                </div>
              </div>
            </div>

            <!-- 打卡照片 -->
            <div class="form-group">
              <label>📸 打卡照片（必填）:</label>

              <!-- 照片选择区域 -->
              <div v-if="!photoPreview" class="photo-selector">
                <div class="photo-options">
                  <button
                    type="button"
                    class="camera-btn photo-option-btn"
                    @click="selectPhoto('camera')"
                  >
                    📷 拍照
                  </button>
                  <button
                    type="button"
                    class="photo-option-btn gallery-btn"
                    @click="selectPhoto('gallery')"
                  >
                    🖼️ 相册
                  </button>
                </div>
                <div class="photo-hint">
                  <span class="required-mark">*</span> 必须上传照片才能完成打卡
                </div>
              </div>

              <!-- 隐藏的文件输入 -->
              <input
                ref="photoInput"
                type="file"
                accept="image/*"
                :capture="photoInputCapture"
                class="hidden-input"
                @change="onPhotoChange"
              >

              <!-- 上传进度 -->
              <div v-if="uploading" class="upload-progress">
                <div class="progress-info">
                  <span class="progress-icon">{{ compressing ? '🔄' : '📤' }}</span>
                  <span class="progress-text">
                    {{ compressing ? '正在压缩图片...' : '上传照片中...' }}
                  </span>
                  <span class="progress-percent">{{ uploadProgress }}%</span>
                </div>
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    :style="{ width: `${uploadProgress}%` }"
                  />
                </div>
              </div>

              <!-- 照片预览 -->
              <div v-if="photoPreview && !uploading" class="photo-preview">
                <img :src="photoPreview" alt="打卡照片预览">
                <!-- 压缩信息显示 -->
                <div v-if="compressionInfo" class="compression-info">
                  <span class="compression-icon">✅</span>
                  <span class="compression-text">
                    已压缩: {{ formatFileSize(compressionInfo.original) }} → {{ formatFileSize(compressionInfo.compressed) }}
                    (节省 {{ Math.round((1 - compressionInfo.compressed / compressionInfo.original) * 100) }}%)
                  </span>
                </div>
                <div class="photo-actions">
                  <button type="button" class="change-photo-btn" @click="changePhoto">
                    🔄 更换
                  </button>
                  <button type="button" class="remove-photo-btn" @click="removePhoto">
                    🗑️ 删除
                  </button>
                </div>
              </div>
            </div>

            <!-- 结伴人数 -->
            <div class="form-group">
              <label>👥 结伴人数（可选）:</label>
              <input
                v-model.number="checkinData.companionCount"
                type="number"
                min="2"
                max="20"
                placeholder="请输入结伴人数（包含自己）"
                class="companion-input"
              >
              <div class="companion-hint">
                <div class="hint-item">
                  <strong>单人打卡不用填写</strong>
                </div>
                <div class="hint-item">
                  💡 <strong>结伴加分规则：</strong>2人及以上每多1人加1分，最多5分
                </div>
                <div class="hint-item">
                  📸 <strong>重要提醒：</strong>结伴人数需要在照片中体现，且只能是部门同事
                </div>
                <div class="hint-item">
                  🎯 <strong>人数要求：</strong>最少2人（包含自己），最多5人
                </div>
              </div>
            </div>

            <!-- 打卡感想 -->
            <div class="form-group">
              <label>💭 打卡感想:</label>
              <textarea
                v-model="checkinData.comment"
                placeholder="分享你的感想或体验..."
                rows="4"
                class="comment-textarea"
              />
            </div>

            <!-- 建议难度评级（仅用于建议，不计入分数） -->
            <div class="form-group">
              <label>🏔️ 建议难度等级:</label>
              <div class="rating-stars">
                <button
                  v-for="star in 5"
                  :key="star"
                  type="button"
                  class="star-btn"
                  :class="{ active: star <= checkinData.rating }"
                  @click="checkinData.rating = star"
                >
                  ⭐
                </button>
              </div>
              <span class="rating-text">{{ getRatingText(checkinData.rating) }}</span>
              <div class="difficulty-note">
                💡 此评级作为其他用户的难度参考，最终计算结果分数时候会参考建议修改POI点的分数
              </div>
            </div>

            <!-- 提交按钮 -->
            <div class="form-actions">
              <button type="button" class="cancel-btn" @click="onClose">
                取消
              </button>
              <button
                type="submit"
                class="submit-btn"
                :disabled="submitting || (!userPosition && !geoState?.loading) || isActivityEnded"
              >
                {{ isActivityEnded ? '活动已结束' : getSubmitButtonText() }}
              </button>
            </div>
          </form>
        </div>

        <!-- 打卡成功动画覆盖层 -->
        <div v-if="showSuccessAnimation" class="success-animation-overlay">
          <div class="success-animation-content">
            <div class="success-icon-container">
              <div class="success-icon">
                ✓
              </div>
              <div class="success-ripple" />
              <div class="success-ripple delay-1" />
              <div class="success-ripple delay-2" />
            </div>
            <div class="success-text">
              <h3>打卡成功！</h3>
              <p>正在保存您的打卡记录...</p>
            </div>
            <div class="success-progress">
              <div class="progress-dots">
                <span class="dot" />
                <span class="dot" />
                <span class="dot" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
/* 全局颜色变量 - 与主应用保持一致 */
:root {
  --primary-color: #007bff;
  --primary-hover: #0056b3;
  --primary-light: #e7f3ff;
  --primary-lighter: #f8f9ff;
  --success-color: #28a745;
  --success-hover: #20c997;
  --success-light: #e8f5e8;
  --danger-color: #dc3545;
  --danger-hover: #c82333;
  --warning-color: #fd7e14;
  --warning-hover: #e55a00;
  --gray-color: #6c757d;
  --gray-light: #f8f9fa;
  --gray-border: #e9ecef;
  --text-primary: #333;
  --text-secondary: #666;
  --light-bg: rgba(255, 255, 255, 0.95);
  --dark-bg: rgba(31, 41, 55, 0.95);
  --modal-bg: white;
  --input-bg: white;
  --border-color: #ddd;
}

/* 暗色模式CSS变量重定义 */
.dark {
  --primary-light: #1e3a8a;
  --primary-lighter: #1e40af;
  --success-light: #14532d;
  --gray-light: #374151;
  --gray-border: #4b5563;
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
  --modal-bg: #1f2937;
  --input-bg: #374151;
  --border-color: #4b5563;
}

/* 完全独立的弹窗样式，避免继承任何外部样式 */
.checkin-modal-overlay {
  all: initial !important;
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  background: rgba(0, 0, 0, 0.5) !important;
  z-index: 999999 !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  font-size: 16px !important;
  line-height: 1.5 !important;
  color: var(--text-primary);
  box-sizing: border-box !important;
}

.checkin-modal {
  background: var(--modal-bg);
  border-radius: 12px !important;
  max-width: 500px !important;
  width: calc(100% - 40px) !important;
  max-height: 90vh !important;
  overflow: hidden !important; /* 改为hidden，让内部元素处理滚动 */
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1) !important;
  margin: 0 !important;
  position: relative !important;
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: column !important;
}

/* 经典绝对定位居中方法 */
.checkin-modal-overlay.fallback .checkin-modal {
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  margin: 0 !important;
  width: 90vw !important;
  max-width: 500px !important;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--gray-border);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--gray-light);
  color: var(--text-primary);
}

.modal-body {
  padding: 20px 24px 24px;
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* POI选择和信息样式 */
.poi-selection-section {
  margin-bottom: 24px;
}

.poi-selector {
  background: var(--gray-light);
  border: 1px solid var(--gray-border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.selector-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.selector-icon {
  font-size: 16px;
}

.selector-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 14px;
}

.poi-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.poi-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--modal-bg);
  border: 1px solid var(--gray-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.poi-option:hover {
  border-color: var(--primary-color);
  background: var(--primary-lighter);
}

.poi-option.active {
  border-color: var(--primary-color);
  background: var(--primary-light);
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.poi-option-info {
  flex: 1;
}

.poi-option-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 14px;
  margin-bottom: 4px;
}

.poi-option-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.poi-option-category {
  background: var(--gray-border);
  padding: 2px 6px;
  border-radius: 4px;
}

.poi-option-distance {
  background: var(--primary-light);
  color: var(--primary-color);
  padding: 2px 6px;
  border-radius: 4px;
}

.poi-option-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.selected-icon {
  color: var(--primary-color);
  font-weight: bold;
  font-size: 16px;
}

.selected-poi-info {
  background: var(--success-light);
  border: 1px solid #c8e6c9;
  border-radius: 8px;
  padding: 16px;
}

/* 没有可选POI的提示样式 */
.no-pois-available {
  margin-bottom: 24px;
}

.no-pois-message {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.message-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.message-content h4 {
  margin: 0 0 8px 0;
  color: #856404;
  font-size: 16px;
  font-weight: 600;
}

.message-content p {
  margin: 0 0 12px 0;
  color: #856404;
  font-size: 14px;
  line-height: 1.4;
}

.message-content ul {
  margin: 0;
  padding-left: 20px;
  color: #856404;
}

.message-content li {
  font-size: 14px;
  line-height: 1.4;
  margin-bottom: 4px;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.info-icon {
  font-size: 16px;
}

.info-title {
  font-weight: 600;
  color: #2e7d32;
  font-size: 14px;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.poi-info {
  background: var(--gray-light);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.info-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.label {
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 80px;
}

.value {
  color: var(--text-primary);
}

/* GPS信息样式 */
.gps-info {
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.gps-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.gps-header h4 {
  margin: 0;
  font-size: 14px;
  color: #1976d2;
  font-weight: 600;
}

.accuracy-status {
  margin-bottom: 12px;
}

.accuracy-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.accuracy-icon {
  font-size: 18px;
}

.accuracy-details {
  flex: 1;
}

.accuracy-level {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.accuracy-value {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.improve-btn {
  background: #ff9800;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.improve-btn:hover {
  background: #f57c00;
  transform: scale(1.05);
}

.error-status {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: #ffebee;
  border: 1px solid #ffcdd2;
  border-radius: 6px;
  margin-bottom: 12px;
}

.error-icon {
  font-size: 18px;
  color: #f44336;
}

.error-info {
  flex: 1;
}

.error-message {
  font-weight: 500;
  color: #d32f2f;
  font-size: 12px;
  margin-bottom: 4px;
}

.error-hint {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.signal-strength {
  display: flex;
  align-items: center;
  gap: 8px;
}

.signal-label {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

.signal-bars {
  display: flex;
  gap: 2px;
  align-items: flex-end;
}

.signal-bar {
  width: 4px;
  background: #e0e0e0;
  border-radius: 1px;
  transition: all 0.3s;
}

.signal-bar:nth-child(1) {
  height: 8px;
}
.signal-bar:nth-child(2) {
  height: 12px;
}
.signal-bar:nth-child(3) {
  height: 16px;
}
.signal-bar:nth-child(4) {
  height: 20px;
}
.signal-bar:nth-child(5) {
  height: 24px;
}

.signal-bar.active {
  background: #4caf50;
}

/* 简化的位置状态样式 */
.location-status {
  background: var(--gray-light);
  border: 1px solid var(--gray-border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.location-loading,
.location-error,
.location-waiting {
  display: flex;
  align-items: center;
  gap: 12px;
}

.loading-icon,
.error-icon,
.waiting-icon {
  font-size: 18px;
}

.loading-text,
.error-text,
.waiting-text {
  flex: 1;
  color: var(--text-secondary);
  font-size: 14px;
}

.retry-btn,
.start-btn {
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-btn:hover,
.start-btn:hover {
  background: #0056b3;
}

.location-error .retry-btn {
  background: #dc3545;
}

.location-error .retry-btn:hover {
  background: #c82333;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
}

/* 员工信息样式 */
.employee-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0;
}

.required {
  color: #dc3545;
  margin-left: 2px;
}

.employee-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-family: inherit;
  font-size: 14px;
  background: var(--modal-bg);
  transition: border-color 0.2s ease;
}

.employee-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.employee-input::placeholder {
  color: var(--text-secondary);
}

.employee-input:disabled {
  background: #f5f5f5;
  color: var(--text-secondary);
  cursor: not-allowed;
  border-color: #e0e0e0;
}

/* 移动端输入框优化 */
@media (max-width: 768px) {
  .employee-input {
    font-size: 16px; /* 防止iOS缩放 */
    padding: 14px 12px;
  }

  /* 移动端文件输入优化 */
  .hidden-input {
    /* 确保在移动设备上正确显示文件选择器 */
    position: absolute;
    left: -9999px;
    opacity: 0;
    pointer-events: none;
  }

  /* 移动端照片选择按钮优化 */
  .photo-option-btn {
    /* 增加触摸区域 */
    min-height: 48px;
    min-width: 48px;
    /* 防止双击缩放 */
    touch-action: manipulation;
  }
}

/* 照片选择器样式 */
.photo-selector {
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  background: var(--gray-light);
  transition: all 0.2s ease;
}

.photo-selector:hover {
  border-color: var(--primary-color);
  background: #e3f2fd;
}

.photo-options {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 12px;
}

.photo-option-btn {
  background: var(--modal-bg);
  border: 2px solid #e9ecef;
  border-radius: 8px;
  padding: 12px 20px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 100px;
  justify-content: center;
}

.photo-option-btn:hover {
  border-color: var(--primary-color);
  background: #e3f2fd;
  transform: translateY(-2px);
}

.camera-btn:hover {
  border-color: #28a745;
  background: #d4edda;
}

.gallery-btn:hover {
  border-color: #17a2b8;
  background: #d1ecf1;
}

.photo-hint {
  color: var(--text-secondary);
  font-size: 12px;
  margin-top: 8px;
}

.hidden-input {
  display: none;
}

/* 上传进度样式 */
.upload-progress {
  background: var(--primary-lighter);
  border: 1px solid var(--primary-color);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.progress-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.progress-icon {
  font-size: 18px;
}

.progress-text {
  flex: 1;
  margin: 0 12px;
  color: var(--primary-color);
  font-weight: 500;
}

.progress-percent {
  font-weight: 600;
  color: var(--primary-color);
  font-size: 14px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(0, 123, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color), var(--success-color));
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* 照片预览样式 */
.photo-preview {
  border-radius: 8px;
  overflow: hidden;
  max-width: 300px;
  margin: 0 auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.photo-preview img {
  width: 100%;
  height: auto;
  display: block;
}

/* 压缩信息样式 */
.compression-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  border-top: 1px solid #a5d6a7;
  font-size: 11px;
  color: #2e7d32;
}

.compression-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.compression-text {
  flex: 1;
  font-weight: 500;
  line-height: 1.3;
}

.photo-actions {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: var(--gray-light);
  justify-content: center;
}

.change-photo-btn,
.remove-photo-btn {
  background: var(--modal-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.change-photo-btn:hover {
  border-color: var(--primary-color);
  background: #e3f2fd;
}

.remove-photo-btn:hover {
  border-color: #dc3545;
  background: #f8d7da;
  color: #721c24;
}

.companion-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  background: var(--input-bg);
  color: var(--text-primary);
}

.companion-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.companion-hint {
  margin-top: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #17a2b8;
}

.hint-item {
  font-size: 13px;
  color: #495057;
  margin-bottom: 6px;
  line-height: 1.4;
}

.hint-item:last-child {
  margin-bottom: 0;
}

.hint-item strong {
  color: #212529;
}

.comment-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-family: inherit;
  resize: vertical;
  min-height: 100px;
}

.comment-textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.rating-stars {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.star-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: transform 0.2s;
  filter: grayscale(100%);
  opacity: 0.5;
}

.star-btn.active {
  filter: none;
  opacity: 1;
}

.star-btn:hover {
  transform: scale(1.1);
}

.rating-text {
  color: var(--text-secondary);
  font-size: 14px;
  margin-left: 8px;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e9ecef;
}

.cancel-btn {
  padding: 10px 20px;
  border: 1px solid var(--border-color);
  background: var(--modal-bg);
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn:hover {
  background: var(--gray-light);
  border-color: var(--text-secondary);
}

.submit-btn {
  padding: 10px 24px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.submit-btn:hover:not(:disabled) {
  background: #0056b3;
}

.submit-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

/* 深色模式 */
.dark .checkin-modal-overlay {
  color: #f9fafb;
}

.dark .checkin-modal {
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

/* 深色模式下的POI选择样式 */
.dark .poi-selector {
  background: #374151;
  border-color: #4b5563;
}

.dark .selector-title {
  color: #f9fafb;
}

.dark .poi-option {
  background: #1f2937;
  border-color: #4b5563;
}

.dark .poi-option:hover {
  border-color: #3b82f6;
  background: #1e3a8a;
}

.dark .poi-option.active {
  border-color: #3b82f6;
  background: #1e3a8a;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.dark .poi-option-name {
  color: #f9fafb;
}

.dark .poi-option-meta {
  color: #9ca3af;
}

.dark .poi-option-category {
  background: #4b5563;
  color: #e5e7eb;
}

.dark .poi-option-distance {
  background: #1e3a8a;
  color: #93c5fd;
}

.dark .selected-icon {
  color: #3b82f6;
}

.dark .selected-poi-info {
  background: #14532d;
  border-color: #16a34a;
}

/* 深色模式下的没有可选POI提示样式 */
.dark .no-pois-message {
  background: #451a03;
  border-color: #f59e0b;
}

.dark .message-content h4,
.dark .message-content p,
.dark .message-content ul {
  color: #fbbf24;
}

.dark .info-title {
  color: #86efac;
}

.dark .poi-info {
  background: #374151;
}

.dark .label {
  color: #9ca3af;
}

.dark .value {
  color: #f9fafb;
}

.dark .form-group label {
  color: #f9fafb;
}

/* 深色模式下的员工信息样式 */
.dark .input-label {
  color: #d1d5db;
}

.dark .employee-input {
  background: #374151;
  border-color: #4b5563;
  color: #f9fafb;
}

.dark .employee-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dark .employee-input::placeholder {
  color: #9ca3af;
}

.dark .employee-input:disabled {
  background: #2d2d2d;
  color: var(--text-secondary);
  cursor: not-allowed;
  border-color: #404040;
}

/* 深色模式下的位置状态样式 */
.dark .location-status {
  background: #374151;
  border-color: #4b5563;
}

.dark .loading-text,
.dark .error-text,
.dark .waiting-text {
  color: #d1d5db;
}

.dark .retry-btn,
.dark .start-btn {
  background: #3b82f6;
}

.dark .retry-btn:hover,
.dark .start-btn:hover {
  background: #2563eb;
}

.dark .location-error .retry-btn {
  background: #dc2626;
}

.dark .location-error .retry-btn:hover {
  background: #b91c1c;
}

/* 深色模式下的照片选择器样式 */
.dark .photo-selector {
  background: #374151;
  border-color: #4b5563;
}

.dark .photo-selector:hover {
  border-color: #3b82f6;
  background: #1e3a8a;
}

.dark .photo-option-btn {
  background: #1f2937;
  border-color: #4b5563;
  color: #f9fafb;
}

.dark .photo-option-btn:hover {
  border-color: #3b82f6;
  background: #1e3a8a;
}

.dark .camera-btn:hover {
  border-color: #10b981;
  background: #064e3b;
}

.dark .gallery-btn:hover {
  border-color: #06b6d4;
  background: #164e63;
}

.dark .photo-hint {
  color: #9ca3af;
}

/* 深色模式下的上传进度样式 */
.dark .upload-progress {
  background: #1e3a8a;
  border-color: #3b82f6;
}

.dark .progress-text,
.dark .progress-percent {
  color: #93c5fd;
}

.dark .progress-bar {
  background: rgba(59, 130, 246, 0.1);
}

.dark .progress-fill {
  background: linear-gradient(90deg, #3b82f6, #10b981);
}

/* 深色模式下的压缩信息样式 */
.dark .compression-info {
  background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
  border-top-color: #047857;
  color: #86efac;
}

.dark .photo-actions {
  background: #374151;
}

.dark .change-photo-btn,
.dark .remove-photo-btn {
  background: #1f2937;
  border-color: #4b5563;
  color: #f9fafb;
}

.dark .change-photo-btn:hover {
  border-color: #3b82f6;
  background: #1e3a8a;
}

.dark .remove-photo-btn:hover {
  border-color: #dc2626;
  background: #7f1d1d;
  color: #fca5a5;
}

.dark .companion-input {
  background: #374151;
  border-color: #4b5563;
  color: #f9fafb;
}

.dark .companion-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dark .companion-hint {
  background: #374151;
  border-left-color: #22d3ee;
}

.dark .hint-item {
  color: #d1d5db;
}

.dark .hint-item strong {
  color: #f9fafb;
}

.dark .comment-textarea {
  background: #374151;
  border-color: #4b5563;
  color: #f9fafb;
}

.dark .comment-textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dark .rating-text {
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

.dark .cancel-btn:hover {
  background: #4b5563;
  border-color: #6b7280;
}

.dark .submit-btn {
  background: #3b82f6;
}

.dark .submit-btn:hover:not(:disabled) {
  background: #2563eb;
}

/* 深色模式GPS信息样式 */
.dark .gps-info {
  background: #1e3a8a;
  border-color: #3b82f6;
}

.dark .gps-header h4 {
  color: #60a5fa;
}

.dark .accuracy-value {
  color: #9ca3af;
}

.dark .improve-btn {
  background: #f59e0b;
}

.dark .improve-btn:hover {
  background: #d97706;
}

.dark .error-status {
  background: #7f1d1d;
  border-color: #dc2626;
}

.dark .error-message {
  color: #fca5a5;
}

.dark .error-hint {
  color: #9ca3af;
}

.dark .signal-label {
  color: #9ca3af;
}

.dark .signal-bar {
  background: #4b5563;
}

.dark .signal-bar.active {
  background: #10b981;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .checkin-modal-overlay {
    padding: 10px !important;
    display: flex !important;
    align-items: flex-start !important;
    justify-content: center !important;
    padding-top: 5vh !important;
  }

  /* 移动端时覆盖绝对定位 */
  .checkin-modal-overlay.fallback .checkin-modal {
    position: relative !important;
    top: auto !important;
    left: auto !important;
    transform: none !important;
    margin: 0 !important;
    width: calc(100vw - 20px) !important;
    max-width: 500px !important;
    max-height: calc(95vh - 10vh) !important;
  }

  .modal-header {
    padding: 16px 20px 12px;
  }

  .modal-body {
    padding: 16px 20px calc(20px + env(safe-area-inset-bottom));
    max-height: calc(95vh - 10vh - 60px); /* 减去header高度 */
    overflow-y: auto;
    -webkit-overflow-scrolling: touch; /* iOS平滑滚动 */
  }

  .rating-stars {
    gap: 8px;
  }

  .star-btn {
    font-size: 20px;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .cancel-btn,
  .submit-btn {
    width: 100%;
  }

  /* 移动端照片选择优化 */
  .photo-options {
    flex-direction: column;
    gap: 8px;
  }

  .photo-option-btn {
    width: 100%;
    padding: 16px;
    font-size: 16px;
  }

  .photo-actions {
    flex-direction: column;
    gap: 8px;
  }

  .change-photo-btn,
  .remove-photo-btn {
    width: 100%;
    padding: 12px;
    font-size: 14px;
  }
}

/* 小屏幕手机优化 */
@media (max-width: 480px) {
  .checkin-modal-overlay {
    padding: 5px !important;
    padding-top: 2vh !important;
  }

  .checkin-modal-overlay.fallback .checkin-modal {
    width: calc(100vw - 10px) !important;
    max-height: calc(98vh - 4vh) !important;
  }

  .modal-header {
    padding: 12px 16px 8px;
  }

  .modal-header h3 {
    font-size: 16px;
  }

  .modal-body {
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
    max-height: calc(98vh - 4vh - 50px); /* 减去更小的header高度 */
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    font-size: 14px;
    margin-bottom: 6px;
  }

  .comment-textarea {
    min-height: 80px;
    font-size: 16px; /* 防止iOS缩放 */
  }

  .photo-option-btn {
    padding: 14px;
    font-size: 15px;
  }

  .rating-stars {
    gap: 6px;
    justify-content: center;
  }

  .star-btn {
    font-size: 18px;
    padding: 2px;
  }

  .form-actions {
    margin-top: 16px;
    padding-top: 16px;
    gap: 8px;
  }

  .cancel-btn,
  .submit-btn {
    padding: 12px;
    font-size: 15px;
  }
}

/* 难度提示说明样式 */
.difficulty-note {
  font-size: 12px;
  color: #6c757d;
  margin-top: 8px;
  padding: 6px 10px;
  background: #f8f9fa;
  border-radius: 4px;
  border-left: 3px solid #17a2b8;
}

.dark .difficulty-note {
  background: #2d2d2d;
  color: #ccc;
  border-left-color: #17a2b8;
}

/* 必填标记样式 */
.required-mark {
  color: #dc3545;
  font-weight: bold;
  margin-right: 4px;
}

.photo-hint {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  margin-top: 8px;
}

.dark .photo-hint {
  color: var(--text-secondary);
}

.dark .required-mark {
  color: #ff6b6b;
}

/* 打卡成功动画样式 */
.success-animation-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  border-radius: 12px;
  animation: fadeIn 0.3s ease-out;
}

.dark .success-animation-overlay {
  background: rgba(31, 41, 55, 0.95);
}

.success-animation-content {
  text-align: center;
  padding: 40px 20px;
  max-width: 300px;
}

.success-icon-container {
  position: relative;
  display: inline-block;
  margin-bottom: 24px;
}

.success-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #28a745, #20c997);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: white;
  font-weight: bold;
  position: relative;
  z-index: 2;
  animation: successIconPop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  box-shadow: 0 8px 25px rgba(40, 167, 69, 0.3);
}

.success-ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 80px;
  height: 80px;
  border: 2px solid #28a745;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: ripple 1.5s ease-out infinite;
  opacity: 0;
}

.success-ripple.delay-1 {
  animation-delay: 0.3s;
}

.success-ripple.delay-2 {
  animation-delay: 0.6s;
}

.success-text h3 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--success-color);
  animation: slideUp 0.6s ease-out 0.2s both;
}

.success-text p {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: var(--text-secondary);
  animation: slideUp 0.6s ease-out 0.4s both;
}

.success-progress {
  animation: slideUp 0.6s ease-out 0.6s both;
}

.progress-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.progress-dots .dot {
  width: 8px;
  height: 8px;
  background: var(--primary-color);
  border-radius: 50%;
  animation: dotPulse 1.4s ease-in-out infinite;
}

.progress-dots .dot:nth-child(2) {
  animation-delay: 0.2s;
}

.progress-dots .dot:nth-child(3) {
  animation-delay: 0.4s;
}

/* 动画关键帧 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes successIconPop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes ripple {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.6;
  }
  100% {
    transform: translate(-50%, -50%) scale(2.5);
    opacity: 0;
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

@keyframes dotPulse {
  0%,
  80%,
  100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1.2);
    opacity: 1;
  }
}

/* 深色模式下的动画样式 */
.dark .success-text h3 {
  color: #10b981;
}

.dark .success-text p {
  color: #d1d5db;
}

.dark .progress-dots .dot {
  background: #3b82f6;
}

/* 彩蛋相关样式 */
.easter-egg-badge {
  display: inline-block;
  margin-left: 8px;
  font-size: 16px;
  animation: bounceIn 0.6s ease;
}

.easter-egg-time {
  background: linear-gradient(45deg, #ff6b6b, #ffd93d);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.easter-egg-info {
  margin-top: 12px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.easter-egg-active {
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 2px solid #ff6b9d;
  animation: pulseGlow 2s ease-in-out infinite;
}

.easter-egg-inactive {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 2px solid #dee2e6;
  opacity: 0.8;
}

.easter-egg-icon {
  font-size: 32px;
  animation: bounce 2s ease-in-out infinite;
}

.easter-egg-icon-inactive {
  font-size: 32px;
  opacity: 0.6;
  filter: grayscale(50%);
}

.easter-egg-details {
  flex: 1;
  min-width: 0;
}

.easter-egg-title {
  font-size: 16px;
  font-weight: 700;
  color: #c7365f;
  margin-bottom: 4px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.easter-egg-active .easter-egg-title {
  color: #7c2d5e;
}

.easter-egg-bonus {
  font-size: 14px;
  font-weight: 600;
  color: #8b1538;
  margin-bottom: 2px;
}

.easter-egg-desc {
  font-size: 12px;
  color: #6c757d;
  line-height: 1.4;
}

.easter-egg-time {
  font-size: 12px;
  color: #495057;
  margin-bottom: 2px;
  font-weight: 500;
}

/* 彩蛋动画 */
@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.3) rotate(-10deg);
  }
  50% {
    opacity: 1;
    transform: scale(1.1) rotate(5deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes bounce {
  0%,
  20%,
  50%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}

@keyframes pulseGlow {
  0%,
  100% {
    box-shadow:
      0 2px 8px rgba(255, 107, 157, 0.3),
      0 0 0 0 rgba(255, 107, 157, 0.4);
  }
  50% {
    box-shadow:
      0 2px 16px rgba(255, 107, 157, 0.5),
      0 0 20px rgba(255, 107, 157, 0.2);
  }
}

/* POI选项中的彩蛋样式 */
.poi-option-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 深色模式下的彩蛋样式 */
.dark .easter-egg-active {
  background: linear-gradient(135deg, #4c1d95 0%, #7c2d92 50%, #be185d 100%);
  border-color: #be185d;
}

.dark .easter-egg-inactive {
  background: linear-gradient(135deg, #374151 0%, #4b5563 100%);
  border-color: #6b7280;
}

.dark .easter-egg-title {
  color: #fbbf24;
}

.dark .easter-egg-active .easter-egg-title {
  color: #fde047;
}

.dark .easter-egg-bonus {
  color: #f59e0b;
}

.dark .easter-egg-desc {
  color: #d1d5db;
}

.dark .easter-egg-time {
  color: #e5e7eb;
}

.dark .easter-egg-time {
  background: linear-gradient(45deg, #dc2626, #f59e0b);
}
</style>
