<script setup lang="ts">
import type { POIData } from '~/types/amap'
import { useUserInfo } from '~/composables/useUserInfo'
import { calculatePOIScores, getDistanceLevel } from '~/utils/scoreCalculation'
import { useActivityCountdown } from '~/composables/useActivityCountdown'

definePageMeta({
  layout: 'home',
})

// 页面标题和描述
useHead({
  title: '深圳地图 - 探索深圳精彩地点',
  meta: [
    { name: 'description', content: '在地图上探索深圳的精彩地点，发现城市之美' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover' },
  ],
})

// POI筛选条件
const poiFilters = ref({
  category: 'all',
  search: '',
  sortBy: 'totalScore',
  sortOrder: 'desc',
  checkinStatus: 'all' as 'all' | 'checked' | 'unchecked',
})

// 引用定义（必须在使用前定义）
// POI列表面板引用
const poiListPanelRef = ref()

// 地图组件引用
const mapContainerRef = ref()

// 开发者面板引用
const developerPanelRef = ref()

// 开发者模式 - 仅在URL包含dev=1时启用
const route = useRoute()
const showDeveloperButton = computed(() => {
  return route.query.dev === '1'
})

// 加载POI数据，传入筛选条件
const { pois, loading: poisLoading, error: _poisError, reload: reloadPOIs, deletePOI: _deletePOI } = usePOIData(poiFilters)

// 弹幕功能
const { danmakuRecords, updateDanmakuFromStore, addNewCheckinRecord } = useDanmaku()
const showDanmaku = ref(false)

// 防抖定时器
let refreshTimeout: NodeJS.Timeout | null = null

// 包装删除POI方法，添加额外的刷新逻辑
async function deletePOI(id: string) {
  const result = await _deletePOI(id)

  // 使用防抖机制避免重复刷新
  if (refreshTimeout) {
    clearTimeout(refreshTimeout)
  }

  refreshTimeout = setTimeout(async () => {
    try {
      // 刷新POI列表的统计数据
      if (poiListPanelRef.value?.fetchPOIStats) {
        await poiListPanelRef.value.fetchPOIStats()
      }
    }
    catch (error) {
      console.error('删除POI后刷新失败:', error)
    }
  }, 200) // 200ms防抖

  return result
}

// 用户信息管理
const { userInfo, needsUserInfo, initUserInfo } = useUserInfo()
const showUserInfoModal = ref(false)
const isFirstTimeUser = ref(false)

// 活动倒计时
const { isActivityEnded, countdownText, urgencyLevel } = useActivityCountdown()

// 排名模态框
const showRankingModal = ref(false)

// 坐标校准模态框
const showCoordinateCalibrationModal = ref(false)

// 审核模态框
const showAuditModal = ref(false)

// 彩蛋时间模态框
const showEasterEggModal = ref(false)

// 打卡地图模态框
const showCheckinMapModal = ref(false)

// 新用户引导 - 使用 driver.js
const {
  autoStartTour,
  startManualTour,
  startTestTour,
  startMinimalTour,
  startTourAfterUserSetup,
  forceRestartTour,
  forceCompleteTour,
  manualMoveNext,
  shouldShowTour,
  debugPageState,
  resetTourState,
} = useTour()

// 手动启动引导（开发用）
function startTour() {
  startManualTour(showDeveloperButton.value)
}

// 添加键盘快捷键支持（Ctrl+H 或 Cmd+H 启动引导）
function handleKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
    event.preventDefault()
    startTour()
  }
  // Ctrl+T 启动测试引导
  if ((event.ctrlKey || event.metaKey) && event.key === 't') {
    event.preventDefault()
    startTestTour()
  }
  // Ctrl+Shift+R 重置引导状态（调试用）
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'R') {
    event.preventDefault()
    resetTourState()
  }
  // Ctrl+Shift+F 强制重启引导（解决卡住问题）
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'F') {
    event.preventDefault()
    forceRestartTour(showDeveloperButton.value)
  }
  // Ctrl+Shift+M 启动最小化引导测试
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'M') {
    event.preventDefault()
    startMinimalTour()
  }
  // Ctrl+Shift+D 调试页面状态
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
    event.preventDefault()
    debugPageState()
  }
  // Ctrl+Shift+N 手动跳转下一步（解决卡住问题）
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'N') {
    event.preventDefault()
    manualMoveNext()
  }
  // Ctrl+Shift+C 强制完成引导（当完成按钮无响应时）
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'C') {
    event.preventDefault()
    forceCompleteTour()
  }
}

// 打卡功能
const {
  showCheckinModal,
  nearbyPOI,
  nearbyPOIs,
  selectedPOI,
  currentCheckinPOI,
  canCheckin,
  nearestPOI,
  currentPosition,
  accuracyInfo,
  geoState,
  checkinRecords,
  startLocationTracking,
  improveLocationAccuracy,
  showCheckinForm,
  closeCheckinModal,
  submitCheckin,
  loadCheckinRecords,
  fetchCheckinRecordsFromServer,
  selectPOI,
  formatDistance,
  isPOICheckedIn,
  getPersonalCheckinCount,
  getTotalCheckinCount,
  getLatestCheckinUser,
  // 范围相关
  searchRange,
  showRangeCircle,
  shouldShowRangeControl,
  formatRange,
} = useCheckin(pois as any, {
  onCheckinSuccess: async (checkinRecord: any) => {
    // 使用防抖机制避免重复刷新
    if (refreshTimeout) {
      clearTimeout(refreshTimeout)
    }

    refreshTimeout = setTimeout(async () => {
      try {
        // 刷新POI数据以更新分数和状态
        await reloadPOIs(undefined, true)
        // 刷新POI列表的统计数据
        if (poiListPanelRef.value?.fetchPOIStats) {
          await poiListPanelRef.value.fetchPOIStats()
        }
      }
      catch (error) {
        console.error('打卡后刷新失败:', error)
      }
    }, 200) // 200ms防抖

    // 添加新的打卡记录到弹幕（立即执行，不需要防抖）
    if (checkinRecord) {
      addNewCheckinRecord(checkinRecord)
    }
  },
})

// 颜色模式
const colorMode = useColorMode()

// 地图配置
const mapHeight = ref('100vh')
const showCenterPoint = ref(true)

// 其他状态
const developerMode = ref(false)
const selectedPosition = ref<{ lng: number, lat: number } | null>(null)

// 全局照片弹窗
const showGlobalPhotoModal = ref(false)
const globalModalPhotoUrl = ref('')

// 打卡按钮最小化状态（当信息窗口打开时）
const isCheckinButtonMinimized = ref(false)

// POI信息弹窗状态
const showPOIInfoModal = ref(false)
const currentPOIInfo = ref<POIData | null>(null)

// 全局照片弹窗方法
function openGlobalPhotoModal(photoUrl: string) {
  globalModalPhotoUrl.value = photoUrl
  showGlobalPhotoModal.value = true
}

function closeGlobalPhotoModal() {
  showGlobalPhotoModal.value = false
  globalModalPhotoUrl.value = ''
}

// 将方法挂载到window对象，供信息窗口调用
if (import.meta.client) {
  window.openPhotoModal = openGlobalPhotoModal
}

// 处理信息窗口状态变化
function handleInfoWindowToggle(isOpen: boolean) {
  isCheckinButtonMinimized.value = isOpen
}

// 监听开发者模式变化，开发面板打开时隐藏定位/打卡面板
watch(developerMode, (newValue) => {
  if (newValue) {
    // 开发面板打开时隐藏定位/打卡面板
    isCheckinButtonMinimized.value = true
  }
  else {
    // 开发面板关闭时，只有在没有其他弹窗时才显示定位/打卡面板
    if (!showPOIInfoModal.value) {
      isCheckinButtonMinimized.value = false
    }
  }
})

// 打开POI信息弹窗
function openPOIInfoModal(poi: POIData) {
  currentPOIInfo.value = poi
  showPOIInfoModal.value = true
  isCheckinButtonMinimized.value = true
}

// 关闭POI信息弹窗
function closePOIInfoModal() {
  showPOIInfoModal.value = false
  currentPOIInfo.value = null
  isCheckinButtonMinimized.value = false
}

// 计算是否显示范围圆圈（开发者模式下隐藏）
const shouldShowRangeCircle = computed(() => {
  return showRangeCircle.value && !developerMode.value
})

// 处理POI筛选条件更新
function handleFiltersUpdate(newFilters: any) {
  // 检查是否有实际变化，避免无意义的更新
  const hasChanges = Object.keys(newFilters).some(key =>
    poiFilters.value[key as keyof typeof poiFilters.value] !== newFilters[key],
  )

  if (hasChanges) {
    console.warn('POI筛选条件更新:', { old: poiFilters.value, new: newFilters })
    // 更新父组件的筛选条件以同步到usePOIData
    Object.assign(poiFilters.value, newFilters)
  }
}

// 处理POI面板的互斥逻辑
function handlePOIToggle() {
  // 点击POI列表按钮时，如果开发者模式开启则关闭它
  if (developerMode.value) {
    developerMode.value = false
    selectedPosition.value = null
  }
}

// 切换开发者模式
function toggleDeveloperMode() {
  // 点击开发者模式按钮时，如果POI列表开启则关闭它
  poiListPanelRef.value?.togglePOIList(false)

  developerMode.value = !developerMode.value
  if (!developerMode.value) {
    selectedPosition.value = null
  }
}

// 处理位置选择
function onPositionSelected(position: { lng: number, lat: number }) {
  selectedPosition.value = position
}

// 计算选中位置的距离和距离分数
const selectedPositionDistance = computed(() => {
  if (!selectedPosition.value)
    return null

  const pos: [number, number] = [selectedPosition.value.lng, selectedPosition.value.lat]
  const scores = calculatePOIScores(pos, 0)

  return {
    distance: formatDistance(scores.distance),
    distanceScore: scores.distanceScore,
    level: getDistanceLevel(scores.distanceScore),
  }
})

// 处理POI点击，定位到地图
function onPOIClick(poi: any) {
  selectedPosition.value = {
    lng: poi.position[0],
    lat: poi.position[1],
  }

  // 收起POI列表
  poiListPanelRef.value?.togglePOIList(false)

  // 关闭开发者模式弹窗
  if (developerMode.value) {
    developerMode.value = false
  }

  // 定位地图到该POI位置
  if (mapContainerRef.value && mapContainerRef.value.panToPosition) {
    mapContainerRef.value.panToPosition(poi.position, 15) // 缩放到15级
  }
}

// 处理编辑POI
function handleEditPOI(poi: POIData) {
  if (developerPanelRef.value?.editPOI) {
    developerPanelRef.value.editPOI(poi)
  }
  else {
    console.warn('developerPanelRef 或 editPOI 方法不存在')
  }
}

// POI操作成功后的回调
async function onPOIOperationSuccess() {
  // 清空选中位置
  selectedPosition.value = null

  // 清除之前的刷新定时器，避免重复刷新
  if (refreshTimeout) {
    clearTimeout(refreshTimeout)
  }

  // 防抖刷新，避免频繁操作时的重复请求
  refreshTimeout = setTimeout(async () => {
    try {
      // 刷新POI数据以获取最新列表
      await reloadPOIs(undefined, true)

      // 刷新POI列表的统计数据
      if (poiListPanelRef.value?.fetchPOIStats) {
        await poiListPanelRef.value.fetchPOIStats()
      }

      // 如果当前有打开的POI详情弹窗，需要更新其数据
      if (showPOIInfoModal.value && currentPOIInfo.value) {
        // 从最新的POI列表中找到对应的POI并更新
        const updatedPOI = pois.value.find(poi => poi.id === currentPOIInfo.value?.id)
        if (updatedPOI) {
          currentPOIInfo.value = {
            ...updatedPOI,
            position: [...updatedPOI.position] as [number, number],
          }
        }
      }
    }
    catch (error) {
      console.error('POI操作后刷新失败:', error)
    }
  }, 300) // 300ms防抖
}

// 获取按钮图标
function getButtonIcon(): string {
  if (geoState.value.loading) {
    return '🔄'
  }
  if (geoState.value.error) {
    return '🔄'
  }
  if (!currentPosition.value) {
    return '📍'
  }
  if (canCheckin.value) {
    return '✅'
  }
  return '❌'
}

// 获取按钮文本
function getButtonText(): string {
  if (isActivityEnded.value) {
    return '活动已结束'
  }
  if (geoState.value.loading) {
    return '定位中...'
  }
  if (geoState.value.error) {
    return '重新定位'
  }
  if (!currentPosition.value) {
    return '开始定位'
  }
  if (canCheckin.value) {
    return '打卡'
  }
  return '无法打卡'
}

// 获取按钮样式类
function getButtonClass(): string {
  if (geoState.value.loading) {
    return 'loading'
  }
  if (geoState.value.error) {
    return 'error'
  }
  if (!currentPosition.value) {
    return 'waiting'
  }
  if (canCheckin.value) {
    return 'can-checkin'
  }
  return 'cannot-checkin'
}

// 处理按钮点击
function handleButtonClick() {
  // 如果有错误或没有位置，启动定位
  if (geoState.value.error || !currentPosition.value) {
    startLocationTracking()
  }
  // 如果可以打卡，显示打卡表单
  else if (canCheckin.value) {
    showCheckinForm()
  }
}

// 判断按钮是否应该禁用
function isButtonDisabled(): boolean {
  // 活动结束时禁用按钮
  if (isActivityEnded.value) {
    return true
  }
  // 只在加载中时禁用按钮
  return geoState.value.loading
}

// 切换深色模式（页面 + 地图）
function toggleDarkMode() {
  // 切换页面深色模式
  colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark'
}

// 处理用户信息编辑
function handleEditUserInfo() {
  isFirstTimeUser.value = false
  showUserInfoModal.value = true
}

// 处理用户信息保存
function handleUserInfoSaved() {
  showUserInfoModal.value = false
  const wasFirstTime = isFirstTimeUser.value
  isFirstTimeUser.value = false

  // 如果是首次设置用户信息，启动引导
  if (wasFirstTime) {
    startTourAfterUserSetup(showDeveloperButton.value, 1500)
  }
}

// 处理用户信息模态框关闭
function handleUserInfoModalClose() {
  if (isFirstTimeUser.value && needsUserInfo.value) {
    // 首次使用且仍需要填写信息时不允许关闭
    return
  }
  showUserInfoModal.value = false
  isFirstTimeUser.value = false
}

// 显示排名
function handleShowRanking() {
  showRankingModal.value = true
}

// 关闭排名模态框
function handleRankingModalClose() {
  showRankingModal.value = false
}

// 坐标校准模态框处理
function handleShowCoordinateCalibration() {
  showCoordinateCalibrationModal.value = true
}

function handleCoordinateCalibrationModalClose() {
  showCoordinateCalibrationModal.value = false
}

// 审核功能处理
function handleShowAudit() {
  showAuditModal.value = true
}

function handleAuditModalClose() {
  showAuditModal.value = false
}

// 彩蛋时间模态框处理
function handleShowEasterEgg() {
  showEasterEggModal.value = true
}

function handleEasterEggModalClose() {
  showEasterEggModal.value = false
}

// 打卡地图模态框处理
function handleShowCheckinMap() {
  showCheckinMapModal.value = true
}

function handleCheckinMapModalClose() {
  showCheckinMapModal.value = false
}

// 监听深色模式变化，同步到地图
watch(() => colorMode.value, (newMode) => {
  if (mapContainerRef.value && mapContainerRef.value.setMapStyleFromPageMode) {
    mapContainerRef.value.setMapStyleFromPageMode(newMode === 'dark')
  }
}, { immediate: true })

// 组件挂载后的初始化
onMounted(() => {
  // 对于已有用户信息但未看过引导的用户，延迟启动引导
  if (!needsUserInfo.value && shouldShowTour()) {
    setTimeout(() => {
      autoStartTour(showDeveloperButton.value, 2000)
    }, 3000)
  }

  // 响应式调整地图高度
  const adjustMapHeight = () => {
    if (window.innerWidth < 768) {
      mapHeight.value = '100vh'
    }
    else {
      mapHeight.value = '100vh'
    }
  }

  adjustMapHeight()
  window.addEventListener('resize', adjustMapHeight)

  // 添加键盘快捷键监听
  window.addEventListener('keydown', handleKeydown)

  // 初始化时加载打卡记录
  ;(async () => {
    await loadCheckinRecords()
    updateDanmakuFromStore([...checkinRecords.value])
    showDanmaku.value = true
  })()

  // 确保地图初始化后设置正确的样式
  nextTick(() => {
    setTimeout(() => {
      if (mapContainerRef.value && mapContainerRef.value.setMapStyleFromPageMode) {
        const isDark = colorMode.value === 'dark'
        mapContainerRef.value.setMapStyleFromPageMode(isDark)
      }
    }, 1000) // 给地图更多时间初始化
  })

  // 初始化用户信息
  initUserInfo()

  // 检查是否需要首次填写用户信息
  nextTick(() => {
    if (needsUserInfo.value) {
      isFirstTimeUser.value = true
      showUserInfoModal.value = true
    }
  })

  // 启动位置追踪
  startLocationTracking()

  onBeforeUnmount(() => {
    window.removeEventListener('resize', adjustMapHeight)
    window.removeEventListener('keydown', handleKeydown)
  })
})
</script>

<template>
  <div class="map-page">
    <!-- POI列表面板 -->
    <POIListPanel
      v-show="!developerMode && !showAuditModal"
      ref="poiListPanelRef"
      :pois="pois as any"
      :developer-mode="developerMode"
      :loading="poisLoading"
      :filters="poiFilters"
      :on-p-o-i-click="onPOIClick"
      :is-p-o-i-checked-in="isPOICheckedIn"
      :get-personal-checkin-count="getPersonalCheckinCount"
      @before-toggle="handlePOIToggle"
      @filters-update="handleFiltersUpdate"
    />

    <!-- 地图容器 -->
    <div class="map-section">
      <AMapContainer
        ref="mapContainerRef"
        :height="mapHeight"
        :show-center="showCenterPoint"
        :developer-mode="developerMode"
        :show-developer-button="showDeveloperButton"
        :pois="pois as any"
        :user-position="currentPosition"
        :delete-p-o-i="deletePOI"
        :edit-p-o-i="handleEditPOI"
        :is-p-o-i-checked-in="isPOICheckedIn"
        :get-personal-checkin-count="getPersonalCheckinCount"
        :search-range="searchRange"
        :show-range-circle="shouldShowRangeCircle"
        :on-info-window-toggle="handleInfoWindowToggle"
        :on-p-o-i-click="openPOIInfoModal"
        @position-selected="onPositionSelected"
        @toggle-developer="toggleDeveloperMode"
        @toggle-dark-mode="toggleDarkMode"
        @edit-user-info="handleEditUserInfo"
        @show-ranking="handleShowRanking"
        @show-coordinate-calibration="handleShowCoordinateCalibration"
        @show-audit="handleShowAudit"
        @show-easter-egg="handleShowEasterEgg"
        @show-checkin-map="handleShowCheckinMap"
      />

      <!-- 统一的打卡/位置按钮 -->
      <div
        v-show="!isCheckinButtonMinimized"
        class="checkin-button-container"
      >
        <!-- 活动倒计时 -->
        <div v-if="!isActivityEnded" class="activity-countdown-badge" :class="`urgency-${urgencyLevel}`">
          <span class="countdown-icon">⏰</span>
          <span class="countdown-text">{{ countdownText }}</span>
        </div>
        <div v-else class="activity-ended-badge">
          <span class="ended-icon">🔒</span>
          <span class="ended-text">活动已结束</span>
        </div>

        <button
          class="checkin-btn"
          :class="getButtonClass()"
          :disabled="isButtonDisabled()"
          @click="handleButtonClick"
        >
          {{ getButtonIcon() }} {{ getButtonText() }}
        </button>

        <!-- 可以打卡时显示POI信息 -->
        <div v-if="nearbyPOI && canCheckin" class="checkin-info">
          <div class="poi-name">
            {{ nearbyPOI.name }}
          </div>
          <div v-if="nearestPOI" class="distance">
            {{ formatDistance(nearestPOI.distance) }}
          </div>
        </div>

        <!-- 已定位但无法打卡时的提示 -->
        <div v-else-if="currentPosition && !canCheckin" class="no-checkin location-info">
          <div class="location-status">
            📍 已定位，但附近{{ formatRange(searchRange) }}内无打卡点
          </div>
          <div class="location-hint">
            {{ shouldShowRangeControl ? '可在位置设置中调整打卡范围' : '请移动到打卡点附近' }}
          </div>
        </div>

        <!-- 正在定位 -->
        <div v-else-if="geoState.loading" class="location-info">
          <div class="location-status">
            🔄 正在获取位置...
          </div>
        </div>

        <!-- 定位失败 -->
        <div v-else-if="geoState.error" class="location-info">
          <div class="location-status error">
            ⚠️ {{ geoState.error }}
          </div>
          <div class="location-hint">
            点击按钮重新定位
          </div>
        </div>

        <!-- 等待定位 -->
        <div v-else class="location-info">
          <div class="location-status">
            📍 点击按钮开始定位
          </div>
        </div>
      </div>
    </div>

    <!-- 开发者控制面板 -->
    <DeveloperPanel
      ref="developerPanelRef"
      :visible="developerMode"
      :show-when-p-o-i-list-hidden="true"
      :poi-list-visible="poiListPanelRef?.showPOIList?.value"
      :selected-position="selectedPosition"
      :selected-position-distance="selectedPositionDistance"
      @poi-added="onPOIOperationSuccess"
      @poi-edited="onPOIOperationSuccess"
    />

    <!-- 打卡弹窗 -->
    <CheckinModal
      :visible="showCheckinModal"
      :poi="currentCheckinPOI as any"
      :nearby-pois="nearbyPOIs as any"
      :selected-poi="selectedPOI as any"
      :user-position="currentPosition"
      :distance="nearestPOI?.distance || null"
      :accuracy-info="accuracyInfo"
      :geo-state="geoState"
      @close="closeCheckinModal"
      @submit="submitCheckin"
      @select-poi="selectPOI"
      @improve-accuracy="improveLocationAccuracy"
    />

    <!-- 用户信息模态框 -->
    <UserInfoModal
      :visible="showUserInfoModal"
      :is-first-time="isFirstTimeUser"
      :checkin-records="checkinRecords"
      @close="handleUserInfoModalClose"
      @saved="handleUserInfoSaved"
    />

    <!-- 排名模态框 -->
    <RankingModal
      :visible="showRankingModal"
      @close="handleRankingModalClose"
    />

    <!-- 坐标校准模态框 -->
    <CoordinateCalibrationModal
      :is-open="showCoordinateCalibrationModal"
      @close="handleCoordinateCalibrationModalClose"
    />

    <!-- 审核模态框 -->
    <AuditPanel
      :show="showAuditModal"
      @close="handleAuditModalClose"
      @show-photo="openGlobalPhotoModal"
    />

    <!-- 彩蛋时间模态框 -->
    <EasterEggModal
      :visible="showEasterEggModal"
      @close="handleEasterEggModalClose"
    />

    <!-- 打卡地图模态框 -->
    <CheckinMapModal
      :visible="showCheckinMapModal"
      @close="handleCheckinMapModalClose"
    />

    <!-- POI信息弹窗 -->
    <POIInfoModal
      :visible="showPOIInfoModal"
      :poi="currentPOIInfo"
      :developer-mode="developerMode"
      :is-p-o-i-checked-in="isPOICheckedIn"
      :get-total-checkin-count="getTotalCheckinCount"
      :get-latest-checkin-user="getLatestCheckinUser"
      :edit-p-o-i="handleEditPOI"
      :delete-p-o-i="deletePOI"
      @close="closePOIInfoModal"
    />

    <!-- 全局照片放大弹窗 -->
    <div v-if="showGlobalPhotoModal" class="global-photo-modal-overlay" @click="closeGlobalPhotoModal">
      <div class="global-photo-modal" @click.stop>
        <button class="global-photo-modal-close" title="关闭" @click="closeGlobalPhotoModal">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <img :src="globalModalPhotoUrl" alt="参考照片大图" class="global-photo-modal-image">
        <div class="global-photo-modal-title">
          📷 打卡参考照片
        </div>
      </div>
    </div>

    <!-- 弹幕组件 -->
    <DanmakuBarrage
      v-if="showDanmaku"
      :checkin-records="danmakuRecords as any"
      :enabled="true"
    />
  </div>
</template>

<style>
/* 页面样式：确保全屏，支持安全区域 */
body {
  overflow: hidden;
}

/* 安全区域支持 */
/* 全局颜色变量 */
:root {
  /* 主色调系统 */
  --primary-color: #007bff;
  --primary-hover: #0056b3;
  --primary-light: #e7f3ff;
  --primary-lighter: #f8f9ff;

  /* 功能色系统 */
  --success-color: #28a745;
  --success-hover: #20c997;
  --success-light: #e8f5e8;
  --danger-color: #dc3545;
  --danger-hover: #c82333;
  --warning-color: #fd7e14;
  --warning-hover: #e55a00;

  /* 中性色系统 */
  --gray-color: #6c757d;
  --gray-hover: #545b62;
  --gray-light: #f8f9fa;
  --gray-border: #e9ecef;
  --gray-border-light: #ddd;

  /* 文字颜色系统 */
  --text-primary: #333;
  --text-secondary: #666;
  --text-muted: #999;
  --text-white: #fff;

  /* 背景色系统 */
  --bg-white: #ffffff;
  --bg-light: #fafafa;
  --bg-overlay: #ffffff;
  --bg-card: #ffffff;

  /* 深色模式背景 */
  --dark-bg-primary: #2c2c2c;
  --dark-bg-secondary: #374151;
  --dark-bg-card: #374151;
  --dark-border: #4b5563;

  /* 阴影系统 */
  --shadow-light: rgba(0, 0, 0, 0.15);
  --shadow-dark: rgba(0, 0, 0, 0.3);
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.15);
}

html {
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
</style>

<style scoped>
.map-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.map-section {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  z-index: 0; /* 确保地图在最底层 */
}

/* 打卡按钮样式 */
.checkin-button-container {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1000;
  background: var(--bg-overlay);
  border-radius: 12px;
  padding: 16px;
  box-shadow: var(--shadow-hover);
  min-width: 160px;
  animation: slideIn 0.3s ease-out;
  transition: all 0.3s ease;
}

/* 活动倒计时徽章 */
.activity-countdown-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  border: 2px solid;
  animation: fadeInDown 0.4s ease-out;
}

.activity-countdown-badge.urgency-normal {
  background: linear-gradient(135deg, #d4edda, #e8f5e9);
  border-color: #28a745;
  color: #155724;
}

.activity-countdown-badge.urgency-warning {
  background: linear-gradient(135deg, #fff3cd, #fffbea);
  border-color: #ffc107;
  color: #856404;
  animation: fadeInDown 0.4s ease-out, pulseWarning 2s ease-in-out infinite;
}

.activity-countdown-badge.urgency-danger {
  background: linear-gradient(135deg, #f8d7da, #ffe5e8);
  border-color: #dc3545;
  color: #721c24;
  animation: fadeInDown 0.4s ease-out, pulseDanger 1.5s ease-in-out infinite;
}

.urgency-danger .countdown-icon {
  animation: shake 0.5s ease-in-out infinite;
}

.countdown-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.countdown-text {
  flex: 1;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.5px;
}

/* 活动结束徽章 */
.activity-ended-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  background: linear-gradient(135deg, #e9ecef, #f8f9fa);
  border: 2px solid #6c757d;
  color: #495057;
  animation: fadeInDown 0.4s ease-out;
}

.ended-icon {
  font-size: 16px;
  flex-shrink: 0;
  opacity: 0.6;
}

.ended-text {
  flex: 1;
}

.checkin-btn {
  width: 100%;
  padding: 12px 16px;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* 可以打卡状态 */
.checkin-btn.can-checkin {
  background: linear-gradient(135deg, var(--success-color), var(--success-hover));
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
}

.checkin-btn.can-checkin:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
}

/* 无法打卡状态 */
.checkin-btn.cannot-checkin {
  background: linear-gradient(135deg, var(--danger-color), var(--danger-hover));
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
  cursor: not-allowed;
}

/* 等待定位状态 */
.checkin-btn.waiting {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
}

.checkin-btn.waiting:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
}

/* 定位中状态 */
.checkin-btn.loading {
  background: linear-gradient(135deg, var(--gray-color), var(--gray-hover));
  box-shadow: 0 2px 8px rgba(108, 117, 125, 0.3);
  cursor: wait;
}

/* 为loading按钮添加脉冲动画 */
.checkin-btn.loading {
  animation: loadingPulse 1.5s ease-in-out infinite;
}

@keyframes loadingPulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(0.98);
  }
}

/* 错误状态 */
.checkin-btn.error {
  background: linear-gradient(135deg, var(--warning-color), var(--warning-hover));
  box-shadow: 0 2px 8px rgba(253, 126, 20, 0.3);
}

.checkin-btn.error:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(253, 126, 20, 0.4);
}

.checkin-btn:active {
  transform: translateY(0);
}

.checkin-btn:disabled {
  background: #6c757d !important;
  cursor: not-allowed !important;
  transform: none !important;
  box-shadow: none !important;
}

.checkin-info {
  margin-top: 12px;
  text-align: center;
}

.poi-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.distance {
  font-size: 12px;
  color: #666;
}

.location-info {
  margin-top: 12px;
  text-align: center;
}

.location-status {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.location-status.error {
  color: #dc3545;
}

.location-hint {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

/* 无法打卡时的特殊样式 */
.location-info.no-checkin {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  padding: 12px;
  margin-top: 16px;
}

.location-info.no-checkin .location-status {
  color: #856404;
  font-weight: 600;
  font-size: 13px;
}

.location-info.no-checkin .location-hint {
  color: #856404;
  opacity: 0.8;
  font-size: 12px;
}

/* 暗色模式下的location-info样式 */
.dark .location-info.no-checkin {
  background: rgba(120, 53, 15, 0.2);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.dark .location-info.no-checkin .location-status {
  color: #fbbf24;
}

.dark .location-info.no-checkin .location-hint {
  color: #f59e0b;
  opacity: 0.9;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulseWarning {
  0%, 100% {
    box-shadow: 0 2px 8px rgba(255, 193, 7, 0.2);
  }
  50% {
    box-shadow: 0 4px 16px rgba(255, 193, 7, 0.4);
  }
}

@keyframes pulseDanger {
  0%, 100% {
    box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
  }
  50% {
    box-shadow: 0 6px 20px rgba(220, 53, 69, 0.6);
  }
}

@keyframes shake {
  0%, 100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-10deg);
  }
  75% {
    transform: rotate(10deg);
  }
}

/* 深色模式下的打卡按钮 */
.dark .checkin-button-container {
  background: var(--dark-bg-primary);
}

/* 深色模式下的倒计时徽章 */
.dark .activity-countdown-badge.urgency-normal {
  background: linear-gradient(135deg, #064e3b, #14532d);
  border-color: #10b981;
  color: #86efac;
}

.dark .activity-countdown-badge.urgency-warning {
  background: linear-gradient(135deg, #78350f, #451a03);
  border-color: #f59e0b;
  color: #fbbf24;
}

.dark .activity-countdown-badge.urgency-danger {
  background: linear-gradient(135deg, #7f1d1d, #991b1b);
  border-color: #ef4444;
  color: #fca5a5;
}

.dark .activity-ended-badge {
  background: linear-gradient(135deg, #374151, #4b5563);
  border-color: #4b5563;
  color: #d1d5db;
}

.dark .poi-name {
  color: #f9fafb;
}

.dark .distance {
  color: #9ca3af;
}

.dark .location-status {
  color: #9ca3af;
}

.dark .location-status.error {
  color: #ef4444;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .location-status-container {
    top: 16px;
    right: 16px;
    padding: 12px;
    min-width: 160px;
  }

  .status-icon {
    font-size: 18px;
  }

  .status-loading,
  .status-waiting {
    font-size: 13px;
  }

  .error-message {
    font-size: 12px;
  }

  .retry-btn {
    padding: 5px 10px;
    font-size: 11px;
  }

  .checkin-button-container {
    top: 12px;
    left: 16px;
    right: 60px;
    padding: 12px;
    min-width: 140px;
  }

  .checkin-btn {
    padding: 10px 12px;
    font-size: 14px;
  }

  .poi-name {
    font-size: 13px;
  }

  .distance {
    font-size: 11px;
  }
}
.success-message {
  margin-top: 12px;
  padding: 10px 12px;
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 6px;
  color: #155724;
  font-size: 13px;
  text-align: center;
}

.error-message {
  margin-top: 12px;
  padding: 10px 12px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 6px;
  color: #721c24;
  font-size: 13px;
  text-align: center;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .checkin-button-container {
    top: 12px;
    left: 16px;
    right: 60px;
    padding: 12px;
    min-width: 140px;
  }

  .checkin-btn {
    padding: 10px 12px;
    font-size: 14px;
  }

  .poi-name {
    font-size: 13px;
  }

  .distance {
    font-size: 11px;
  }
}

/* 深色模式样式 */
.dark .success-message {
  background: #155724;
  border-color: #0f5132;
  color: #d4edda;
}

.dark .error-message {
  background: #721c24;
  border-color: #5f1619;
  color: #f8d7da;
}

/* 全局照片放大弹窗 */
.global-photo-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  backdrop-filter: blur(4px);
}

.global-photo-modal {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: globalPhotoModalIn 0.3s ease-out;
}

.global-photo-modal-image {
  width: 100%;
  height: auto;
  max-width: 800px;
  max-height: 600px;
  object-fit: contain;
  display: block;
}

.global-photo-modal-close {
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

.global-photo-modal-close:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: scale(1.1);
}

.global-photo-modal-title {
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

@keyframes globalPhotoModalIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 暗色模式下的全局弹窗 */
.dark .global-photo-modal {
  background: #1a202c;
}
</style>
