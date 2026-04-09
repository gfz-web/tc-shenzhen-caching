<script setup lang="ts">
import type { POIData } from '~/types/amap'

// Props
interface Props {
  visible: boolean
  showWhenPOIListHidden?: boolean
  poiListVisible?: boolean
  selectedPosition?: { lng: number, lat: number } | null
  selectedPositionDistance?: {
    distance: string
    distanceScore: number
    level: string
  } | null
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  showWhenPOIListHidden: true,
  poiListVisible: false,
  selectedPosition: null,
  selectedPositionDistance: null,
})

// Emits
const emit = defineEmits<{
  positionSelected: [position: { lng: number, lat: number }]
  poiAdded: []
  poiEdited: []
}>()

// Toast
const { success, error } = useToast()

// 加载POI数据管理功能
const { addPOI, updatePOI } = usePOIData()

const { userInfo } = useUserInfo()

// POI生成器
const {
  newPOI,
  showAddForm,
  showEditForm,
  categoryOptions,
  toggleAddForm,
  startEditPOI,
  cancelEdit,
  setPOIPosition,
  generatePOI,
  updatePOI: updatePOIData,
} = usePOIGenerator()

// 计算是否显示面板
const shouldShowPanel = computed(() => {
  if (!props.visible)
    return false
  if (props.showWhenPOIListHidden && props.poiListVisible)
    return false
  return true
})

// 参考照片上传相关
const referencePhotoInput = ref<HTMLInputElement>()
const referencePhotoPreview = ref<string>('')
const referencePhotoUploading = ref(false)
const referencePhotoProgress = ref(0)
const referencePhotoFile = ref<File | null>(null)
const useUrlInput = ref(false) // 是否使用URL输入模式
const showPhotoOptions = ref(false) // 是否显示选择方式
const showPhotoModal = ref(false) // 是否显示照片放大弹窗
const modalPhotoUrl = ref('') // 弹窗中显示的照片URL

// 彩蛋设置相关
const easterEggEnabled = ref(false)
const timeSlotMode = ref<'datetime' | 'daily'>('datetime') // 时间段模式：具体日期时间 或 每日时间
const easterEggConfig = reactive({
  id: '',
  time_slots: [
    {
      start_datetime: '',
      end_datetime: '',
    },
  ],
  bonus_score: 5,
  icon: '🎁',
  description: '特殊时段彩蛋奖励',
})

// 星期选项
const dayOptions = ['日', '一', '二', '三', '四', '五', '六']

// 时间段管理功能
function addTimeSlot() {
  if (timeSlotMode.value === 'datetime') {
    easterEggConfig.time_slots.push({
      start_datetime: '',
      end_datetime: '',
    } as any)
  }
  else {
    easterEggConfig.time_slots.push({
      start_time: '05:00',
      end_time: '07:00',
    } as any)
  }
}

function removeTimeSlot(index: number) {
  if (easterEggConfig.time_slots.length > 1) {
    easterEggConfig.time_slots.splice(index, 1)
  }
}

// 格式化日期时间显示
function formatDateTime(datetime: string): string {
  if (!datetime)
    return ''
  const dateObj = new Date(datetime)
  return dateObj.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 格式化每日时间显示
function formatDailyTime(startTime: string, endTime: string): string {
  if (!startTime || !endTime)
    return ''
  return `${startTime} - ${endTime}`
}

// 切换时间段模式
function switchTimeSlotMode(mode: 'datetime' | 'daily') {
  timeSlotMode.value = mode

  // 清空现有时间段，添加一个默认的时间段
  easterEggConfig.time_slots = []
  addTimeSlot()
}

// 处理编辑POI
function handleEditPOI(poi: POIData) {
  console.warn('DeveloperPanel handleEditPOI 被调用:', poi, 'startEditPOI 函数:', startEditPOI)
  startEditPOI(poi)
}

// 切换添加POI表单
function handleToggleAddForm() {
  toggleAddForm(props.selectedPosition)
}

// 取消编辑
function handleCancelEdit() {
  cancelEdit()
}

// POI添加成功后的回调
function onPOIAddSuccess() {
  emit('poiAdded')
}

// POI编辑成功后的回调
function onPOIEditSuccess() {
  emit('poiEdited')
}

// 复制坐标
async function copyPosition() {
  if (props.selectedPosition) {
    const text = `[${props.selectedPosition.lng.toFixed(6)}, ${props.selectedPosition.lat.toFixed(6)}]`
    try {
      await navigator.clipboard.writeText(text)
      success('复制成功', '坐标已复制到剪贴板')
    }
    catch (err) {
      console.error('复制失败:', err)
      error('复制失败', '无法访问剪贴板')
    }
  }
}

// 参考照片相关方法
function selectReferencePhoto() {
  referencePhotoInput.value?.click()
}

// 处理粘贴图片
async function handlePaste(event: ClipboardEvent) {
  // 只在开发面板可见且不是URL输入模式时处理粘贴
  if (!props.visible || useUrlInput.value)
    return

  const items = event.clipboardData?.items
  if (!items)
    return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault()
      const file = item.getAsFile()
      if (file) {
        await processImageFile(file)
      }
      break
    }
  }
}

// 处理图片文件（从文件选择或粘贴）
async function processImageFile(file: File) {
  // 检查文件类型
  if (!file.type.startsWith('image/')) {
    error('请选择图片文件')
    return
  }

  referencePhotoUploading.value = true
  referencePhotoProgress.value = 0
  referencePhotoFile.value = file

  try {
    // 创建预览
    const reader = new FileReader()
    reader.onload = (e) => {
      referencePhotoPreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)

    // 上传到云函数
    const { uploadImage } = await import('~/utils/fileUpload')
    const result = await uploadImage(file, {
      onProgress: (progress) => {
        referencePhotoProgress.value = progress.percent
      },
      userId: userInfo.value?.employeeId || 'anonymous',
    })

    // 更新POI数据中的参考照片URL
    newPOI.value.referencePhoto = result.url

    // 确保预览也显示上传的图片
    referencePhotoPreview.value = result.url

    success('上传成功', '参考照片已上传')
  }
  catch (err) {
    error('上传失败', '照片上传失败，请重试')
    console.error('参考照片上传错误:', err)
    removeReferencePhoto()
  }
  finally {
    referencePhotoUploading.value = false
    referencePhotoProgress.value = 0
  }
}

async function onReferencePhotoChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return

  await processImageFile(file)
}

function removeReferencePhoto() {
  referencePhotoPreview.value = ''
  referencePhotoFile.value = null
  newPOI.value.referencePhoto = ''
  useUrlInput.value = false
  showPhotoOptions.value = false
  if (referencePhotoInput.value) {
    referencePhotoInput.value.value = ''
  }
}

// URL输入相关方法
function onUrlInput() {
  // 当切换到URL模式时，清空上传相关状态
  if (useUrlInput.value) {
    referencePhotoPreview.value = ''
    referencePhotoFile.value = null
    referencePhotoUploading.value = false
    referencePhotoProgress.value = 0
  }
}

function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  }
  catch {
    return false
  }
}

function onUrlImageError() {
  error('图片加载失败', '请检查URL地址是否正确')
}

// 获取当前应该显示的照片URL
function getCurrentPhotoUrl(): string | undefined {
  // 如果是URL模式且有有效URL，显示URL
  if (useUrlInput.value && newPOI.value.referencePhoto && isValidUrl(newPOI.value.referencePhoto)) {
    return newPOI.value.referencePhoto
  }

  // 如果是上传模式且有预览，显示预览
  if (!useUrlInput.value && referencePhotoPreview.value) {
    return referencePhotoPreview.value
  }

  // 如果有POI的参考照片URL（编辑模式），显示它
  if (!useUrlInput.value && newPOI.value.referencePhoto && isValidUrl(newPOI.value.referencePhoto)) {
    return newPOI.value.referencePhoto
  }

  return undefined
}

// 新的模式选择方法
function selectUploadMode() {
  useUrlInput.value = false
  showPhotoOptions.value = false
  selectReferencePhoto()
}

function selectUrlMode() {
  useUrlInput.value = true
  showPhotoOptions.value = false
}

// 点击照片放大
function openPhotoModal() {
  const photoUrl = getCurrentPhotoUrl()
  if (photoUrl) {
    modalPhotoUrl.value = photoUrl
    showPhotoModal.value = true
  }
}

// 处理编辑照片按钮点击
function handleEditPhoto() {
  console.warn('编辑照片按钮被点击')
  showPhotoOptions.value = true
  console.warn('showPhotoOptions 设置为:', showPhotoOptions.value)
}

// 关闭照片弹窗
function closePhotoModal() {
  showPhotoModal.value = false
  modalPhotoUrl.value = ''
}

// 组件挂载时添加粘贴事件监听
onMounted(() => {
  document.addEventListener('paste', handlePaste)
})

// 组件卸载时移除粘贴事件监听
onUnmounted(() => {
  document.removeEventListener('paste', handlePaste)
})

// 监听选中位置变化，自动设置POI位置
watch(() => props.selectedPosition, (newPosition) => {
  if (newPosition && (showAddForm.value || showEditForm.value)) {
    setPOIPosition(newPosition)
  }
})

// 监听POI数据变化，同步参考照片预览
watch(() => newPOI.value.referencePhoto, (newPhoto) => {
  if (newPhoto && !useUrlInput.value && isValidUrl(newPhoto) && newPhoto !== referencePhotoPreview.value) {
    // 如果是上传模式且有现有照片URL，显示预览
    referencePhotoPreview.value = newPhoto
  }
  else if (!newPhoto) {
    // 如果没有照片，清空预览
    referencePhotoPreview.value = ''
  }
})

// 监听模式切换
watch(useUrlInput, (newUseUrl) => {
  if (newUseUrl) {
    // 切换到URL模式时，清空上传相关状态
    referencePhotoPreview.value = ''
    referencePhotoFile.value = null
    referencePhotoUploading.value = false
    referencePhotoProgress.value = 0
  }
  else {
    // 切换到上传模式时，如果有URL，尝试显示预览
    if (newPOI.value.referencePhoto && isValidUrl(newPOI.value.referencePhoto)) {
      referencePhotoPreview.value = newPOI.value.referencePhoto
    }
  }
})

// 监听表单状态变化，重置照片和彩蛋相关状态
watch([showAddForm, showEditForm], ([newAddForm, newEditForm]) => {
  if (!newAddForm && !newEditForm) {
    // 表单关闭时，清理照片相关状态
    referencePhotoPreview.value = ''
    referencePhotoFile.value = null
    referencePhotoUploading.value = false
    referencePhotoProgress.value = 0
    useUrlInput.value = false // 重置为上传模式
    showPhotoOptions.value = false // 重置选择状态

    // 清理彩蛋相关状态
    easterEggEnabled.value = false
    timeSlotMode.value = 'datetime'
    easterEggConfig.id = ''
    easterEggConfig.time_slots = [
      {
        start_datetime: '',
        end_datetime: '',
      },
    ]
    easterEggConfig.bonus_score = 5
    easterEggConfig.icon = '🎁'
    easterEggConfig.description = '特殊时段彩蛋奖励'
  }
})

// 监听POI数据变化，同步彩蛋设置
watch(() => newPOI.value, (poi) => {
  console.log('POI数据变化:', poi)
  if (poi?.easter_egg) {
    console.log('彩蛋数据:', poi.easter_egg)
    easterEggEnabled.value = true

    // 复制彩蛋配置
    Object.assign(easterEggConfig, poi.easter_egg)

    // 根据时间段数据判断模式
    if (poi.easter_egg.time_slots && poi.easter_egg.time_slots.length > 0) {
      const firstSlot = poi.easter_egg.time_slots[0] as any
      console.log('第一个时间段:', firstSlot)
      if (firstSlot.start_datetime && firstSlot.end_datetime) {
        // 具体日期时间模式
        timeSlotMode.value = 'datetime'
        console.log('设置为具体日期时间模式')
      }
      else if (firstSlot.start_time && firstSlot.end_time) {
        // 每日时间模式
        timeSlotMode.value = 'daily'
        console.log('设置为每日时间模式')
      }
    }
  }
  else {
    easterEggEnabled.value = false
  }
}, { deep: true, immediate: true })

// 监听彩蛋配置变化，更新POI数据
watch([easterEggEnabled, easterEggConfig], () => {
  if (easterEggEnabled.value) {
    // 生成彩蛋ID
    if (!easterEggConfig.id) {
      easterEggConfig.id = `easter_${Date.now()}`
    }
    // 确保time_slots是数组
    if (!Array.isArray(easterEggConfig.time_slots)) {
      if (timeSlotMode.value === 'datetime') {
        easterEggConfig.time_slots = [
          {
            start_datetime: '',
            end_datetime: '',
          },
        ]
      }
      else {
        easterEggConfig.time_slots = [
          {
            start_time: '05:00',
            end_time: '07:00',
          } as any,
        ]
      }
    }
    newPOI.value.easter_egg = { ...easterEggConfig }
  }
  else {
    // 明确设置为undefined，确保数据库能正确处理删除操作
    newPOI.value.easter_egg = undefined
  }
}, { deep: true })

// 暴露编辑方法给父组件
defineExpose({
  editPOI: handleEditPOI,
})
</script>

<template>
  <div v-show="shouldShowPanel" class="developer-panel">
    <div v-if="visible" class="developer-controls">
      <!-- POI生成表单切换按钮 -->
      <div class="control-group">
        <button
          v-if="!showEditForm"
          class="add-poi-btn"
          :class="{ active: showAddForm }"
          @click="handleToggleAddForm"
        >
          {{ showAddForm ? '取消添加' : '添加新POI' }}
        </button>
        <button
          v-if="showEditForm"
          class="cancel-edit-btn"
          @click="handleCancelEdit"
        >
          取消编辑
        </button>
      </div>

      <!-- POI生成/编辑表单 -->
      <div v-if="showAddForm || showEditForm" class="add-poi-form">
        <h4>{{ showEditForm ? '编辑POI' : '添加新POI' }}</h4>

        <div class="form-layout">
          <!-- 左列：基本信息 -->
          <div class="form-column form-column-left">
            <!-- 名称输入 -->
            <div class="form-group">
              <label>POI名称:</label>
              <input
                v-model="newPOI.name"
                type="text"
                placeholder="请输入POI名称"
                class="poi-input"
              >
            </div>

            <!-- POI难度分数（计入总分） -->
            <div class="form-group">
              <label>POI难度分数 (1-5，计入总分):</label>
              <BaseSelect
                v-model="newPOI.rating"
                :options="[
                  { label: '1分(平地)', value: 1 },
                  { label: '2分(小坡)', value: 2 },
                  { label: '3分(中坡)', value: 3 },
                  { label: '4分(大坡)', value: 4 },
                  { label: '5分(登顶)', value: 5 },
                ]"
                placeholder="选择评分"
                variant="default"
              />
            </div>

            <!-- 彩蛋设置 -->
            <div class="form-group">
              <label class="section-label">🎁 彩蛋设置（可选）</label>
              <div class="easter-egg-toggle">
                <label class="toggle-label">
                  <input
                    v-model="easterEggEnabled"
                    type="checkbox"
                    class="toggle-checkbox"
                  >
                  <div class="toggle-content">
                    <span class="toggle-text">启用彩蛋功能</span>
                    <span class="toggle-hint">在特定时间段打卡可获得额外分数奖励</span>
                  </div>
                </label>
              </div>

              <div v-if="easterEggEnabled" class="easter-egg-config">
                <!-- 时间段模式选择 -->
                <div class="mode-selection">
                  <label class="mode-label">时间段模式:</label>
                  <div class="mode-options">
                    <button
                      type="button"
                      class="mode-option"
                      :class="{ active: timeSlotMode === 'datetime' }"
                      @click="switchTimeSlotMode('datetime')"
                    >
                      📅 具体日期时间
                    </button>
                    <button
                      type="button"
                      class="mode-option"
                      :class="{ active: timeSlotMode === 'daily' }"
                      @click="switchTimeSlotMode('daily')"
                    >
                      ⏰ 每日时间
                    </button>
                  </div>
                </div>

                <!-- 时间段配置 -->
                <div class="time-slots-section">
                  <div class="section-header">
                    <label>📅 时间段配置:</label>
                    <button type="button" class="add-slot-btn" @click="addTimeSlot">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      添加时间段
                    </button>
                  </div>

                  <div v-for="(slot, index) in easterEggConfig.time_slots" :key="index" class="time-slot-item">
                    <div class="slot-header">
                      <span class="slot-number">时间段 {{ index + 1 }}</span>
                      <button
                        v-if="easterEggConfig.time_slots.length > 1"
                        type="button"
                        class="remove-slot-btn"
                        @click="removeTimeSlot(index)"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>

                    <div class="slot-config">
                      <!-- 具体日期时间模式 -->
                      <div v-if="timeSlotMode === 'datetime'">
                        <div class="config-row">
                          <div class="config-field">
                            <label>📅 开始时间:</label>
                            <input
                              v-model="slot.start_datetime"
                              type="datetime-local"
                              class="datetime-input"
                            >
                          </div>
                          <div class="config-field">
                            <label>📅 结束时间:</label>
                            <input
                              v-model="slot.end_datetime"
                              type="datetime-local"
                              class="datetime-input"
                            >
                          </div>
                        </div>

                        <!-- 时间段预览 -->
                        <div v-if="slot.start_datetime || slot.end_datetime" class="slot-preview">
                          <div class="preview-item">
                            <span class="preview-label">开始:</span>
                            <span class="preview-value">{{ formatDateTime(slot.start_datetime) || '未设置' }}</span>
                          </div>
                          <div class="preview-item">
                            <span class="preview-label">结束:</span>
                            <span class="preview-value">{{ formatDateTime(slot.end_datetime) || '未设置' }}</span>
                          </div>
                        </div>
                      </div>

                      <!-- 每日时间模式 -->
                      <div v-else>
                        <div class="config-row">
                          <div class="config-field">
                            <label>⏰ 开始时间:</label>
                            <input
                              v-model="(slot as any).start_time"
                              type="time"
                              class="time-input"
                            >
                          </div>
                          <div class="config-field">
                            <label>⏰ 结束时间:</label>
                            <input
                              v-model="(slot as any).end_time"
                              type="time"
                              class="time-input"
                            >
                          </div>
                        </div>

                        <!-- 每日时间预览 -->
                        <div v-if="(slot as any).start_time || (slot as any).end_time" class="slot-preview">
                          <div class="preview-item">
                            <span class="preview-label">时间:</span>
                            <span class="preview-value">{{ formatDailyTime((slot as any).start_time, (slot as any).end_time) || '未设置' }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="config-row">
                  <div class="config-field">
                    <label>🎁 奖励分数:</label>
                    <input
                      v-model.number="easterEggConfig.bonus_score"
                      type="number"
                      min="1"
                      max="50"
                      class="number-input"
                      placeholder="额外分数"
                    >
                    <span class="field-hint">1-50分</span>
                  </div>
                  <div class="config-field">
                    <label>📱 彩蛋图标:</label>
                    <input
                      v-model="easterEggConfig.icon"
                      type="text"
                      class="icon-input"
                      placeholder="🎁"
                      maxlength="2"
                    >
                    <span class="field-hint">支持emoji</span>
                  </div>
                </div>

                <div class="config-field config-field-full">
                  <label>📝 彩蛋描述:</label>
                  <input
                    v-model="easterEggConfig.description"
                    type="text"
                    class="description-input"
                    placeholder="特殊时段彩蛋奖励"
                  >
                  <span class="field-hint">向用户展示的彩蛋说明</span>
                </div>
              </div>

              <!-- 分类选择 -->
              <div class="form-group">
                <label>分类:</label>
                <BaseSelect
                  v-model="newPOI.category"
                  :options="categoryOptions"
                  placeholder="选择分类"
                  variant="default"
                />
              </div>
            </div>
          </div>
          <!-- 右列：描述和位置 -->
          <div class="form-column form-column-right">
            <!-- 描述输入 -->
            <div class="form-group">
              <label>描述:</label>
              <textarea
                v-model="newPOI.description"
                placeholder="请输入POI描述（可选）"
                class="poi-textarea"
                rows="3"
              />
            </div>

            <!-- 参考照片上传 -->
            <div class="form-group">
              <label class="section-label">📷 打卡参考照片</label>

              <!-- 已有照片预览 -->
              <div v-if="!showPhotoOptions && getCurrentPhotoUrl()" class="photo-display">
                <div class="photo-card">
                  <img
                    :src="getCurrentPhotoUrl()"
                    alt="参考照片"
                    class="photo-image"
                    title="点击查看大图"
                    @error="onUrlImageError"
                    @click="openPhotoModal"
                  >
                  <div class="photo-overlay">
                    <button type="button" class="delete-btn overlay-btn" title="删除照片" @click="removeReferencePhoto">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6" />
                        <path d="M19,6v14a2,2 0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2" />
                      </svg>
                    </button>
                    <button type="button" class="overlay-btn edit-btn" title="更换照片" @click="handleEditPhoto">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <!-- 选择照片方式 -->
              <div v-else class="photo-options">
                <div class="option-cards">
                  <button type="button" class="upload-card option-card" :disabled="referencePhotoUploading" @click="selectUploadMode">
                    <div class="card-icon">
                      <svg v-if="!referencePhotoUploading" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21,15 16,10 5,21" />
                      </svg>
                      <div v-else class="loading-spinner" />
                    </div>
                    <div class="card-content">
                      <div class="card-title">
                        {{ referencePhotoUploading ? '上传中...' : '上传图片' }}
                      </div>
                      <div class="card-desc">
                        {{ referencePhotoUploading ? `${referencePhotoProgress}%` : '从设备选择图片' }}
                      </div>
                    </div>
                  </button>

                  <button type="button" class="option-card url-card" @click="selectUrlMode">
                    <div class="card-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    </div>
                    <div class="card-content">
                      <div class="card-title">
                        图片链接
                      </div>
                      <div class="card-desc">
                        输入图片URL地址
                      </div>
                    </div>
                  </button>
                </div>

                <div class="photo-hint">
                  💡 添加参考照片可以帮助用户更好地了解打卡位置<br>
                  📋 您也可以直接按 <kbd>Ctrl+V</kbd> 粘贴剪贴板中的图片
                </div>
              </div>

              <!-- URL输入框 -->
              <div v-if="useUrlInput && !newPOI.referencePhoto" class="url-input-container">
                <div class="input-with-icon">
                  <svg class="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <input
                    v-model="newPOI.referencePhoto"
                    type="url"
                    placeholder="粘贴图片URL地址..."
                    class="url-input"
                    @input="onUrlInput"
                  >
                  <button v-if="newPOI.referencePhoto" type="button" class="clear-btn" @click="newPOI.referencePhoto = ''">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- 隐藏的文件输入 -->
              <input
                ref="referencePhotoInput"
                type="file"
                accept="image/*"
                style="display: none"
                @change="onReferencePhotoChange"
              >
            </div>

            <!-- 位置信息 -->
            <div class="form-group">
              <label>位置:</label>
              <!-- 如果有选中位置，显示选中位置信息 -->
              <div v-if="selectedPosition" class="position-display">
                <div class="position-header">
                  <h5>当前选中位置:</h5>
                  <button class="copy-btn" @click="copyPosition">
                    复制
                  </button>
                </div>
                <div class="position-text">
                  经度: {{ selectedPosition.lng.toFixed(6) }}<br>
                  纬度: {{ selectedPosition.lat.toFixed(6) }}<br>
                  坐标: [{{ selectedPosition.lng.toFixed(6) }}, {{ selectedPosition.lat.toFixed(6) }}]
                </div>
                <div v-if="selectedPositionDistance" class="distance-score-preview">
                  <h6>距离评分预览:</h6>
                  <div class="distance-score-info">
                    <div class="distance-info">
                      📏 距离: {{ selectedPositionDistance.distance }}
                    </div>
                    <div class="score-info">
                      🎯 距离分: {{ selectedPositionDistance.distanceScore }}分 ({{ selectedPositionDistance.level }})
                    </div>
                  </div>
                </div>
              </div>
              <!-- 如果没有选中位置但有POI位置 -->
              <div v-else-if="newPOI.position" class="position-display">
                <div class="position-text">
                  已设置位置:<br>
                  经度: {{ newPOI.position.lng.toFixed(6) }}<br>
                  纬度: {{ newPOI.position.lat.toFixed(6) }}
                </div>
              </div>
              <!-- 都没有时的提示 -->
              <div v-else class="no-position">
                <div class="no-position-text">
                  请在地图上点击选择位置
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- 操作按钮 -->
        <div class="form-actions">
          <button
            v-if="showAddForm"
            class="submit-btn"
            @click="() => generatePOI(addPOI, onPOIAddSuccess)"
          >
            保存POI到数据库
          </button>
          <button
            v-if="showEditForm"
            class="submit-btn"
            @click="() => updatePOIData(updatePOI, onPOIEditSuccess)"
          >
            更新POI
          </button>
        </div>
      </div>
    </div>

    <!-- 照片放大弹窗 -->
    <div v-if="showPhotoModal" class="photo-modal-overlay" @click="closePhotoModal">
      <div class="photo-modal" @click.stop>
        <button class="photo-modal-close" title="关闭" @click="closePhotoModal">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <img :src="modalPhotoUrl" alt="参考照片大图" class="photo-modal-image">
        <div class="photo-modal-title">
          📷 打卡参考照片
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 开发者面板 */
.developer-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  min-width: 280px;
  max-width: 350px;
  max-height: 80vh;
  overflow-y: auto;
  overflow-x: hidden;
}

.developer-controls {
  padding: 16px;
}

/* 自定义滚动条样式 */
.developer-panel::-webkit-scrollbar {
  width: 6px;
}

.developer-panel::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.developer-panel::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
}

.developer-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}

.control-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
  font-size: 14px;
}

.mode-btn {
  width: 100%;
  padding: 10px 16px;
  border: 2px solid #ddd;
  background: white;
  color: #666;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.mode-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.mode-btn.active {
  background: #667eea;
  border-color: #667eea;
  color: white;
}

.position-info {
  margin-top: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.position-info h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #333;
}

.position-details {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #666;
  margin-bottom: 12px;
}

.position-details div {
  margin: 4px 0;
}

.copy-btn {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #28a745;
  background: #28a745;
  color: white;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.copy-btn:hover {
  background: #218838;
  border-color: #218838;
}

.distance-score-preview {
  margin-top: 12px;
  padding: 12px;
  background: #f0f8ff;
  border: 1px solid #b3d9ff;
  border-radius: 6px;
}

.distance-score-preview h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #333;
  font-weight: 600;
}

.distance-score-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.distance-info,
.score-info {
  font-size: 12px;
  color: #555;
  display: flex;
  align-items: center;
  gap: 4px;
}

.score-info {
  font-weight: 500;
  color: #2e7d32;
}

/* POI生成表单样式 */
.add-poi-btn {
  width: 100%;
  padding: 10px 16px;
  border: 2px solid #007bff;
  background: white;
  color: #007bff;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.add-poi-btn:hover {
  background: #007bff;
  color: white;
}

.add-poi-btn.active {
  background: #007bff;
  color: white;
}

.cancel-edit-btn {
  width: 100%;
  padding: 10px 16px;
  border: 2px solid #6c757d;
  background: white;
  color: #6c757d;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 16px;
}

.cancel-edit-btn:hover {
  background: #6c757d;
  color: white;
}

.add-poi-form {
  margin-top: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

/* PC端紧凑布局优化 */
@media (min-width: 769px) {
  .add-poi-form {
    padding: 14px;
  }

  .form-group {
    margin-bottom: 14px;
  }

  .form-actions {
    margin-top: 16px;
  }
}

.add-poi-form h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #333;
}

/* 单列布局（PC和移动端共用） */
.form-layout {
  display: flex;
  gap: 16px;
  flex-direction: column;
}

.form-column {
  flex: 1;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 6px;
  color: #333;
  font-size: 14px;
}

.poi-input,
.poi-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  transition: border-color 0.3s ease;
}

.poi-textarea {
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

.poi-input:focus,
.poi-textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.input-hint {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
  line-height: 1.4;
}

.position-display {
  background: white;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #ddd;
}

.position-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.position-header h5 {
  margin: 0;
  font-size: 14px;
  color: #333;
  font-weight: 600;
}

.position-header .copy-btn {
  padding: 4px 8px;
  font-size: 11px;
  width: 50px;
  flex-shrink: 0;
}

.distance-score-preview h6 {
  margin: 8px 0 6px 0;
  font-size: 13px;
  color: #333;
  font-weight: 600;
}

.position-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #666;
  margin-bottom: 8px;
}

.no-position {
  background: white;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #ddd;
  text-align: center;
}

.no-position-text {
  font-size: 14px;
  color: #999;
  margin-bottom: 8px;
}

.use-position-btn {
  width: 100%;
  padding: 6px 12px;
  border: 1px solid #6c757d;
  background: #6c757d;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.use-position-btn:hover:not(:disabled) {
  background: #5a6268;
  border-color: #5a6268;
}

.use-position-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-actions {
  margin-top: 20px;
}

.submit-btn {
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: #28a745;
  color: white;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.submit-btn:hover {
  background: #218838;
}

/* PC端进一步优化 */
@media (min-width: 1200px) {
  .developer-panel {
    max-height: 70vh;
    min-width: 500px;
    max-width: 600px;
  }
}

@media (min-width: 769px) and (max-width: 1199px) {
  .developer-panel {
    max-height: 75vh;
    min-width: 450px;
    max-width: 550px;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .developer-panel {
    bottom: calc(10px + env(safe-area-inset-bottom));
    left: calc(10px + env(safe-area-inset-left));
    right: calc(10px + env(safe-area-inset-right));
    transform: none;
    min-width: auto;
    max-width: none;
    width: auto;
    z-index: 1000;
    max-height: 50vh;
    overflow-y: auto;
  }

  .developer-controls {
    padding: 12px;
  }

  .position-info {
    padding: 12px;
  }

  .position-details {
    font-size: 11px;
  }
}

/* 深色模式支持 */
.dark .developer-panel {
  background: rgba(45, 45, 45, 0.95);
}

/* 深色模式下的滚动条样式 */
.dark .developer-panel::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
}

.dark .developer-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
}

.dark .developer-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

.dark .developer-controls {
  border-top-color: #2c2c2c;
}

.dark .control-group label {
  color: #fff;
}

.dark .mode-btn {
  background: #2d2d2d;
  border-color: #404040;
  color: #ccc;
}

.dark .mode-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.dark .position-info {
  background: #1a1a1a;
  border-color: #404040;
}

.dark .position-info h4 {
  color: #fff;
}

.dark .position-details {
  color: #ccc;
}

.dark .distance-score-preview {
  background: #1a2332;
  border-color: #3d4f66;
}

.dark .distance-score-preview h5 {
  color: #fff;
}

.dark .distance-info,
.dark .score-info {
  color: #ccc;
}

.dark .score-info {
  color: #4caf50;
}

/* 深色模式下的POI表单样式 */
.dark .add-poi-btn {
  background: #2d2d2d;
  border-color: #007bff;
  color: #007bff;
}

.dark .add-poi-btn:hover {
  background: #007bff;
  color: white;
}

.dark .add-poi-btn.active {
  background: #007bff;
  color: white;
}

.dark .cancel-edit-btn {
  background: #2d2d2d;
  border-color: #6c757d;
  color: #6c757d;
}

.dark .cancel-edit-btn:hover {
  background: #6c757d;
  color: white;
}

.dark .add-poi-form {
  background: #1a1a1a;
  border-color: #404040;
}

.dark .add-poi-form h4 {
  color: #fff;
}

.dark .form-group label {
  color: #fff;
}

.dark .poi-input,
.dark .poi-textarea {
  background: #2d2d2d;
  border-color: #404040;
  color: #fff;
}

.dark .poi-input:focus,
.dark .poi-textarea:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.dark .input-hint {
  color: #999;
}

/* 参考照片上传样式 - 全新设计 */
.section-label {
  display: block;
  font-weight: 600;
  margin-bottom: 16px;
  color: #2d3748;
  font-size: 15px;
}

/* 照片显示区域 */
.photo-display {
  margin-bottom: 16px;
}

.photo-card {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  max-width: 200px;
  display: inline-block;
}

.photo-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.photo-image {
  width: 100%;
  max-width: 200px;
  height: 120px;
  object-fit: cover;
  display: block;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.photo-image:hover {
  opacity: 0.9;
}

.photo-overlay {
  position: absolute;
  top: 0;
  right: 0;
  padding: 12px;
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.photo-card:hover .photo-overlay {
  opacity: 1;
}

.overlay-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
}

.delete-btn {
  background: rgba(239, 68, 68, 0.9);
  color: white;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 1);
  transform: scale(1.1);
}

.edit-btn {
  background: rgba(59, 130, 246, 0.9);
  color: white;
}

.edit-btn:hover {
  background: rgba(59, 130, 246, 1);
  transform: scale(1.1);
}

/* 选择方式卡片 */
.photo-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.option-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.option-card {
  padding: 8px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.option-card:hover {
  border-color: #3b82f6;
  background: #f8faff;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.1);
}

.option-card:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.card-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.upload-card .card-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.url-card .card-icon {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-title {
  font-weight: 600;
  font-size: 11px;
  color: #2d3748;
}

.card-desc {
  font-size: 9px;
  color: #718096;
  line-height: 1.1;
}

.photo-hint {
  font-size: 13px;
  color: #718096;
  text-align: center;
  padding: 12px;
  background: #f7fafc;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.photo-hint kbd {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 3px;
  padding: 2px 6px;
  font-family: monospace;
  font-size: 11px;
  color: #475569;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* URL输入框 */
.url-input-container {
  margin-top: 16px;
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  color: #a0aec0;
  z-index: 1;
}

.url-input {
  width: 100%;
  padding: 12px 12px 12px 44px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s ease;
  background: #ffffff;
}

.url-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.clear-btn {
  position: absolute;
  right: 8px;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: #f1f5f9;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.clear-btn:hover {
  background: #e2e8f0;
  color: #475569;
}

/* 加载动画 */
.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 暗色模式样式 */
.dark .section-label {
  color: #e2e8f0;
}

.dark .photo-card {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.dark .photo-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.dark .option-card {
  background: #2d3748;
  border-color: #4a5568;
}

.dark .option-card:hover {
  background: #374151;
  border-color: #3b82f6;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.2);
}

.dark .card-title {
  color: #e2e8f0;
}

.dark .card-desc {
  color: #a0aec0;
}

.dark .photo-hint {
  background: #2d3748;
  color: #a0aec0;
  border-left-color: #3b82f6;
}

.dark .photo-hint kbd {
  background: #4a5568;
  border-color: #718096;
  color: #e2e8f0;
}

.dark .url-input {
  background: #2d3748;
  border-color: #4a5568;
  color: #e2e8f0;
}

.dark .url-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.dark .input-icon {
  color: #718096;
}

.dark .clear-btn {
  background: #4a5568;
  color: #a0aec0;
}

.dark .clear-btn:hover {
  background: #2d3748;
  color: #e2e8f0;
}

/* 照片放大弹窗 */
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
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.photo-modal {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: photoModalIn 0.3s ease-out;
}

.photo-modal-image {
  width: 100%;
  height: auto;
  max-width: 800px;
  max-height: 600px;
  object-fit: contain;
  display: block;
}

.photo-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 1;
}

.photo-modal-close:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: scale(1.1);
}

.photo-modal-title {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  color: white;
  padding: 20px 16px 16px;
  font-size: 16px;
  font-weight: 500;
}

@keyframes photoModalIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 暗色模式下的弹窗 */
.dark .photo-modal {
  background: #1a202c;
}

.dark .position-display,
.dark .no-position {
  background: #2d2d2d;
  border-color: #404040;
}

.dark .position-header h5 {
  color: #fff;
}

.dark .distance-score-preview h6 {
  color: #fff;
}

.dark .position-text {
  color: #ccc;
}

.dark .no-position-text {
  color: #999;
}

.dark .use-position-btn {
  background: #6c757d;
  border-color: #6c757d;
}

.dark .use-position-btn:hover:not(:disabled) {
  background: #5a6268;
  border-color: #5a6268;
}

.dark .submit-btn {
  background: #28a745;
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
}

.dark .submit-btn:hover {
  background: #218838;
  box-shadow: 0 4px 8px rgba(40, 167, 69, 0.4);
}

/* 彩蛋设置样式 */
.easter-egg-toggle {
  margin-bottom: 16px;
}

/* 模式选择样式 */
.mode-selection {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.mode-label {
  display: block;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  font-size: 14px;
}

.mode-options {
  display: flex;
  gap: 8px;
}

.mode-option {
  flex: 1;
  padding: 10px 16px;
  border: 2px solid #dee2e6;
  background: white;
  color: #495057;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.mode-option:hover {
  border-color: #007bff;
  color: #007bff;
}

.mode-option.active {
  background: #007bff;
  border-color: #007bff;
  color: white;
}

/* 时间段配置样式 */
.time-slots-section {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header label {
  font-weight: 600;
  color: #333;
  margin: 0;
}

.add-slot-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-slot-btn:hover {
  background: #0056b3;
  transform: translateY(-1px);
}

.time-slot-item {
  background: transparent;
  border: none;
  border-bottom: 1px solid #e9ecef;
  border-radius: 0;
  padding: 20px 0;
  margin-bottom: 0;
  position: relative;
}

.time-slot-item:last-child {
  border-bottom: none;
}

.slot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.slot-number {
  font-weight: 600;
  color: #495057;
  font-size: 14px;
}

.remove-slot-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: #dc3545;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.remove-slot-btn:hover {
  background: #c82333;
  transform: scale(1.1);
}

.slot-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.datetime-input {
  padding: 10px 14px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  transition: all 0.3s ease;
  width: 100%;
}

.datetime-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
  background: #fafbff;
}

.time-input {
  padding: 10px 14px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  transition: all 0.3s ease;
  width: 100%;
}

.time-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
  background: #fafbff;
}

.slot-preview {
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 6px;
  padding: 12px;
  margin-top: 8px;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.preview-item:last-child {
  margin-bottom: 0;
}

.preview-label {
  font-weight: 500;
  color: #1976d2;
  font-size: 13px;
}

.preview-value {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: #333;
  background: white;
  padding: 2px 6px;
  border-radius: 3px;
}

.toggle-label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  padding: 12px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.toggle-label:hover {
  background: #e9ecef;
}

.toggle-label:has(.toggle-checkbox:checked) {
  background: #d4edda;
  border-color: #28a745;
}

.toggle-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #28a745;
  margin-top: 2px;
  flex-shrink: 0;
}

.toggle-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.toggle-text {
  font-weight: 500;
  color: #333;
}

.toggle-hint {
  font-size: 12px;
  color: #6c757d;
  font-style: italic;
}

/* PC端样式优化 */
@media (min-width: 769px) {
  /* PC端按钮样式优化 */
  .submit-btn {
    padding: 14px 20px;
    font-size: 15px;
    border-radius: 8px;
    font-weight: 600;
    box-shadow: 0 2px 4px rgba(40, 167, 69, 0.2);
    transition: all 0.2s ease;
  }

  .submit-btn:hover {
    background: #218838;
    box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);
    transform: translateY(-1px);
  }

  .submit-btn:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(40, 167, 69, 0.2);
  }
}

.easter-egg-config {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 16px;
  margin-top: 12px;
  animation: slideDown 0.3s ease-out;
}

/* 星期选择器新样式 */
.weekdays-selector {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.weekday-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid #dee2e6;
  border-radius: 20px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  font-size: 13px;
  font-weight: 500;
  min-width: 32px;
}

.weekday-chip:hover {
  background: #e9ecef;
  border-color: #adb5bd;
}

.weekday-chip.active {
  background: #007bff;
  border-color: #007bff;
  color: white;
}

.weekday-checkbox {
  display: none;
}

.config-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-field label {
  font-size: 14px;
  font-weight: 500;
  color: #495057;
  margin: 0;
}

.field-hint {
  font-size: 12px;
  color: #6c757d;
  font-style: italic;
  margin-top: -4px;
}

.time-input,
.number-input,
.icon-input,
.description-input {
  padding: 10px 14px;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  transition: all 0.3s ease;
}

.time-input:focus,
.number-input:focus,
.icon-input:focus,
.description-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  background: #fafbff;
}

.icon-input {
  text-align: center;
  font-size: 18px;
}

.icon-input {
  text-align: center;
  font-size: 16px;
}

.day-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 8px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
  min-height: 64px;
}

.day-option:hover {
  border-color: #007bff;
  background: #f8f9ff;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.day-option:has(.day-checkbox:checked) {
  border-color: #007bff;
  background: linear-gradient(145deg, #e3f2fd, #bbdefb);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.2);
}

.day-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.day-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary, #333);
  user-select: none;
}

.days-hint {
  font-size: 12px;
  color: var(--text-secondary, #666);
  font-style: italic;
}

/* 动画 */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
    max-height: 0;
  }
  to {
    opacity: 1;
    transform: translateY(0);
    max-height: 500px;
  }
}

/* 深色模式下的彩蛋设置样式 */
.dark .mode-selection {
  background: #2d2d2d;
  border-color: #404040;
}

.dark .mode-label {
  color: #fff;
}

.dark .mode-option {
  background: #1a1a1a;
  border-color: #404040;
  color: #e9ecef;
}

.dark .mode-option:hover {
  border-color: #007bff;
  color: #007bff;
}

.dark .mode-option.active {
  background: #007bff;
  border-color: #007bff;
  color: white;
}

.dark .section-header label {
  color: #fff;
}

.dark .add-slot-btn {
  background: #0d6efd;
}

.dark .add-slot-btn:hover {
  background: #0b5ed7;
}

.dark .time-slot-item {
  background: transparent;
  border-bottom-color: #404040;
}

.dark .slot-number {
  color: #e9ecef;
}

.dark .remove-slot-btn {
  background: #dc3545;
}

.dark .remove-slot-btn:hover {
  background: #c82333;
}

.dark .datetime-input {
  background: #1a1a1a;
  border-color: #404040;
  color: #fff;
}

.dark .datetime-input:focus {
  border-color: #007bff;
  background: #0f0f23;
}

.dark .time-input {
  background: #1a1a1a;
  border-color: #404040;
  color: #fff;
}

.dark .time-input:focus {
  border-color: #007bff;
  background: #0f0f23;
}

.dark .slot-preview {
  background: #1a2332;
  border-color: #3d4f66;
}

.dark .preview-label {
  color: #64b5f6;
}

.dark .preview-value {
  background: #2d2d2d;
  color: #e9ecef;
}

.dark .toggle-label {
  background: #2d2d2d;
  border-color: #404040;
}

.dark .toggle-label:hover {
  background: #3d3d3d;
}

.dark .toggle-label:has(.toggle-checkbox:checked) {
  background: #1e4a1e;
  border-color: #28a745;
}

.dark .toggle-text {
  color: #fff;
}

.dark .toggle-hint {
  color: #adb5bd;
}

.dark .easter-egg-config {
  background: #2d2d2d;
  border-color: #404040;
}

.dark .config-field label {
  color: #e9ecef;
}

.dark .field-hint {
  color: #adb5bd;
}

.dark .time-input,
.dark .number-input,
.dark .icon-input,
.dark .description-input {
  background: #1a1a1a;
  border-color: #404040;
  color: #fff;
}

.dark .time-input:focus,
.dark .number-input:focus,
.dark .icon-input:focus,
.dark .description-input:focus {
  border-color: #007bff;
  background: #0f0f23;
}

.dark .weekday-chip {
  background: #3d3d3d;
  border-color: #565e64;
  color: #e9ecef;
}

.dark .weekday-chip:hover {
  background: #4d4d4d;
  border-color: #6c757d;
}

.dark .weekday-chip.active {
  background: #0d6efd;
  border-color: #0d6efd;
  color: white;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .config-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .add-slot-btn {
    width: 100%;
    justify-content: center;
  }

  .time-slot-item {
    padding: 12px;
  }

  .slot-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .remove-slot-btn {
    align-self: flex-end;
  }

  .slot-preview {
    padding: 8px;
  }

  .preview-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>
