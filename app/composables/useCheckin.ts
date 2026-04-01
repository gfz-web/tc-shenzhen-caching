import type { POIData } from '~/types/amap'
import { computed, ref, watch } from 'vue'
import { useGeolocation } from './useGeolocation'
import { useSearchRange } from './useSearchRange'
import { useToast } from './useToast'
import { ACTIVITY_END_TIME, CHECKIN_BYPASS_GEO } from '~/constants'

interface Position { lng: number, lat: number }

export interface CheckinRecord {
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
  isRejected?: boolean | null
  rejectionReason?: string
}

export function useCheckin(pois: Ref<readonly POIData[]>, options?: { onCheckinSuccess?: (checkinRecord: CheckinRecord) => void }) {
  const { success, error } = useToast()
  const {
    currentPosition,
    accuracyInfo,
    isSupported,
    calculateDistance,
    getCurrentPosition,
    tryHighAccuracyPosition,
    startWatching,
    state: geoState,
  } = useGeolocation()

  const {
    searchRange,
    minRange,
    maxRange,
    showRangeControl,
    showRangeCircle,
    setSearchRange,
    toggleRangeControl,
    formatRange,
    getRangeLevel,
  } = useSearchRange()

  // 打卡相关状态
  const showCheckinModal = ref(false)
  const nearbyPOI = ref<POIData | null>(null)
  const nearbyPOIs = ref<Array<{ poi: POIData, distance: number }>>([])
  const selectedPOI = ref<POIData | null>(null)
  const checkinRecords = ref<CheckinRecord[]>([])
  const isSubmittingCheckin = ref(false)

  // 重试计数器
  let retryCount = 0
  const maxRetries = 2

  // 计算指定范围内的所有POI（过滤掉当前用户已经打卡过的）
  const nearbyPOIsWithDistance = computed(() => {
    if (!currentPosition.value || pois.value.length === 0)
      return []

    const nearby: Array<{ poi: POIData, distance: number }> = []
    const { userInfo } = useUserInfo()

    for (const poi of pois.value) {
      // 检查当前用户是否已经打卡过这个POI（永久性检查）
      const hasCheckedIn = checkinRecords.value.some(record =>
        record.poiId === poi.id
        && record.employeeId === userInfo.value.employeeId,
      )

      // 如果当前用户已经打卡过，跳过这个POI
      if (hasCheckedIn) {
        continue
      }

      const poiPos: Position = { lng: poi.position[0], lat: poi.position[1] }
      const distance = calculateDistance(currentPosition.value, poiPos)

      if (CHECKIN_BYPASS_GEO || distance <= searchRange.value) {
        nearby.push({ poi, distance })
      }
    }

    // 按距离排序，最近的在前面
    return nearby.sort((a, b) => a.distance - b.distance)
  })

  // 计算距离最近的POI
  const nearestPOI = computed(() => {
    if (nearbyPOIsWithDistance.value.length === 0)
      return null
    return nearbyPOIsWithDistance.value[0]
  })

  // 是否可以打卡（在当前搜索范围内即可打卡，依靠照片验证真实性）
  const canCheckin = computed(() => {
    if (!nearestPOI.value)
      return false
    if (CHECKIN_BYPASS_GEO)
      return true
    return nearestPOI.value.distance <= searchRange.value // 在搜索范围内即可打卡
  })

  // 是否显示范围控制器（当当前范围内没有POI或用户主动想扩大范围时）
  const shouldShowRangeControl = computed(() => {
    if (!currentPosition.value || pois.value.length === 0)
      return false

    // 计算基础范围（800米）内的POI
    const poisInBaseRange = pois.value.filter((poi) => {
      const poiPos: Position = { lng: poi.position[0], lat: poi.position[1] }
      const distance = calculateDistance(currentPosition.value!, poiPos)
      return distance <= minRange
    })

    // 如果基础范围内没有POI，则显示控制器让用户扩大范围
    // 或者如果用户已经扩大了范围，也保持显示控制器
    return poisInBaseRange.length === 0 || searchRange.value > minRange
  })

  // 更新附近的POI列表
  watch(nearbyPOIsWithDistance, (nearby) => {
    nearbyPOIs.value = nearby
    if (nearby.length > 0) {
      nearbyPOI.value = nearby[0]?.poi || null
      // 如果当前选择的POI不在范围内，重置为最近的
      const firstPOI = nearby[0]?.poi
      if (!selectedPOI.value || !nearby.find(item => item.poi.id === selectedPOI.value?.id)) {
        selectedPOI.value = firstPOI || null
      }
    }
    else {
      nearbyPOI.value = null
      selectedPOI.value = null
    }
  })

  // 选择要打卡的POI
  function selectPOI(poi: POIData) {
    selectedPOI.value = poi
  }

  // 获取当前要打卡的POI（优先使用选择的，否则使用最近的）
  const currentCheckinPOI = computed(() => {
    return selectedPOI.value || nearbyPOI.value
  })

  // 检查用户是否已经打卡过该POI（永久性检查）
  function hasCheckedIn(poiId: string): boolean {
    const { userInfo } = useUserInfo()
    if (!userInfo.value.employeeId)
      return false

    return checkinRecords.value.some(record =>
      record.poiId === poiId
      && record.employeeId === userInfo.value.employeeId,
    )
  }

  // 改善位置精度
  function improveLocationAccuracy() {
    if (!isSupported.value) {
      error('您的浏览器不支持地理定位功能')
      return Promise.reject(new Error('不支持地理定位'))
    }

    return tryHighAccuracyPosition()
      .then(() => {
        // 位置精度已改善
      })
      .catch((err) => {
        console.warn('改善位置精度失败，可能需要在室外或GPS信号更好的地方')
        throw err
      })
  }

  // 内部定位函数
  function _doLocationTracking() {
    console.warn('开始位置追踪...')

    // 检查高德地图API支持
    if (!isSupported.value) {
      error('高德地图API不可用，请检查网络连接')
      return
    }

    // 显示详细的环境信息
    console.warn('位置服务环境检查:')
    console.warn('- 高德地图API支持:', isSupported.value)
    console.warn('- 协议:', location.protocol)
    console.warn('- 主机:', location.hostname)

    getCurrentPosition()
      .then((result) => {
        // 成功获取位置，重置重试计数器
        retryCount = 0

        startWatching()

        // 高德地图返回的结果结构不同，需要适配
        const _accuracy = result.accuracy || 100
        // 位置获取成功

        // 如果初始精度不好，尝试改善
        setTimeout(() => {
          if (accuracyInfo.value && accuracyInfo.value.accuracy > 20) {
            improveLocationAccuracy().catch(() => {
              // 静默处理错误，不影响主要功能
            })
          }
        }, 3000)
      })
      .catch(() => {
        // console.error('位置获取失败详情:', {
        //   message: err.message,
        //   timestamp: new Date().toLocaleString(),
        // })

        // 有限制的自动重试机制
        if (retryCount < maxRetries) {
          retryCount++
          const retryDelay = retryCount * 3000 // 递增延迟：3秒，6秒

          console.warn(`将在 ${retryDelay / 1000} 秒后自动重试 (${retryCount}/${maxRetries})`)

          setTimeout(() => {
            console.warn(`自动重试位置获取 (第${retryCount}次)`)
            _doLocationTracking()
          }, retryDelay)
        }
        else {
          console.warn('已达到最大重试次数，请手动重试')
          console.warn('定位失败，已达到最大重试次数')
        }
      })
  }

  // 公开的开始定位函数 - 用于手动重试
  function startLocationTracking() {
    // 手动调用时重置重试计数器
    retryCount = 0
    _doLocationTracking()
  }

  // 显示打卡弹窗 - 在当前搜索范围内有POI时即可打卡
  function showCheckinForm() {
    // 首先检查活动是否结束
    if (Date.now() >= ACTIVITY_END_TIME) {
      error('活动已结束，无法打卡')
      return
    }

    // 首先检查是否有位置信息
    if (!currentPosition.value) {
      if (geoState.value.loading) {
        error('正在获取位置信息，请稍候...')
      }
      else if (geoState.value.error) {
        error('无法获取位置信息，请检查定位权限')
      }
      else {
        error('请先获取位置信息')
      }
      return
    }

    // 检查当前搜索范围内是否有POI（绕过距离时列表为全部未打卡 POI）
    if (nearbyPOIsWithDistance.value.length === 0) {
      error(CHECKIN_BYPASS_GEO
        ? '没有可打卡的地点（可能已全部打卡过或 POI 未加载）'
        : `附近${formatRange(searchRange.value)}内没有可打卡的地点，请扩大搜索范围或移动位置`)
      return
    }

    // 允许在同一位置打不同POI的卡，移除重复打卡限制
    // 用户可以在同一个位置多次打卡不同的POI点

    // 所有检查通过，打开打卡弹窗
    showCheckinModal.value = true
  }

  // 关闭打卡弹窗
  function closeCheckinModal() {
    showCheckinModal.value = false
  }

  // 提交打卡
  async function submitCheckin(checkinData: any) {
    // 检查活动是否结束
    if (Date.now() >= ACTIVITY_END_TIME) {
      error('活动已结束，无法打卡')
      return
    }

    if (!currentCheckinPOI.value || !currentPosition.value) {
      error('打卡失败：位置信息异常')
      return
    }

    const checkinPOI = currentCheckinPOI.value
    if (!checkinPOI.id || !checkinPOI.name) {
      error('打卡失败：POI信息异常')
      return
    }

    // 再次检查是否在搜索范围内（防止位置变化；绕过距离时跳过）
    if (!CHECKIN_BYPASS_GEO && nearbyPOIsWithDistance.value.length === 0) {
      error(`附近${formatRange(searchRange.value)}内没有可打卡的地点，打卡失败`)
      return
    }

    // 验证工号
    if (!checkinData.employeeId || !checkinData.employeeId.trim()) {
      error('请输入工号')
      return
    }

    isSubmittingCheckin.value = true

    try {
      const poiPos: Position = { lng: checkinPOI.position[0], lat: checkinPOI.position[1] }
      const distance = calculateDistance(currentPosition.value, poiPos)

      if (!CHECKIN_BYPASS_GEO && distance > searchRange.value) {
        error(`距离${Math.round(distance)}米，超过${formatRange(searchRange.value)}搜索范围，无法打卡`)
        return
      }

      let photoUrl: string | undefined

      // 使用已经上传的照片URL（如果存在）
      if (checkinData.photoUrl) {
        photoUrl = checkinData.photoUrl
        console.warn('使用已上传的照片URL:', photoUrl)
      }
      else if (checkinData.photo) {
        // 如果没有URL但有文件，则上传（兼容旧逻辑）
        try {
          photoUrl = await uploadPhoto(checkinData.photo)
        }
        catch (err) {
          console.warn('照片上传失败:', err)
          // 照片上传失败不影响打卡
        }
      }

      // 准备提交到服务器的数据
      const submitData = {
        employeeId: checkinData.employeeId.trim(),
        employeeName: checkinData.employeeName?.trim() || undefined,
        poiId: checkinPOI.id,
        poiName: checkinPOI.name,
        comment: checkinData.comment || undefined,
        rating: checkinData.rating,
        photoUrl,
        coordinates: {
          latitude: checkinData.coordinates.lat,
          longitude: checkinData.coordinates.lng,
        },
        accuracy: accuracyInfo.value?.accuracy || undefined,
        distanceToPoi: Math.round(distance),
        companionCount: checkinData.companionCount || undefined,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          screenResolution: `${screen.width}x${screen.height}`,
          timestamp: new Date().toISOString(),
        },
      }

      // 提交到服务器
      const serverResponse = await $fetch('/api/checkin', {
        method: 'POST',
        body: submitData,
      }) as { success: boolean, data: { id: string, createdAt: string } }

      // 验证响应数据结构
      if (!serverResponse || !serverResponse.data || !serverResponse.data.id) {
        throw new Error('服务器响应数据格式错误')
      }

      // 创建本地记录
      const record: CheckinRecord = {
        id: serverResponse.data.id,
        employeeId: checkinData.employeeId.trim(),
        employeeName: checkinData.employeeName?.trim(),
        poiId: checkinPOI.id,
        poiName: checkinPOI.name,
        comment: checkinData.comment,
        rating: checkinData.rating,
        photo: photoUrl,
        timestamp: checkinData.timestamp,
        coordinates: checkinData.coordinates,
        distance: Math.round(distance),
        accuracy: accuracyInfo.value?.accuracy,
        companionCount: checkinData.companionCount,
      }

      // 添加到记录列表
      checkinRecords.value.push(record)

      success(`成功在 ${checkinPOI.name} 打卡！`)

      // 延迟关闭模态框，让动画播放完成
      setTimeout(() => {
        closeCheckinModal()
      }, 2000) // 2秒后关闭

      // 调用成功回调，刷新相关数据
      if (options?.onCheckinSuccess) {
        options.onCheckinSuccess(record)
      }
    }
    catch (err: any) {
      console.error('打卡提交失败:', err)

      // 解析错误信息
      let errorMessage = '打卡失败'
      if (err.data?.statusMessage) {
        errorMessage = err.data.statusMessage
      }
      else if (err.message) {
        errorMessage = err.message
      }

      error(errorMessage)
    }
    finally {
      isSubmittingCheckin.value = false
    }
  }

  // 生成唯一ID
  function _generateId(): string {
    return `checkin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 检查POI是否已打卡（只检查当前用户）
  function isPOICheckedIn(poiId: string): boolean {
    const { userInfo } = useUserInfo()
    if (!userInfo.value.employeeId)
      return false

    return checkinRecords.value.some(record =>
      record.poiId === poiId && record.employeeId === userInfo.value.employeeId,
    )
  }

  // 获取POI的打卡记录
  function getPOICheckinRecords(poiId: string): CheckinRecord[] {
    return checkinRecords.value.filter(record => record.poiId === poiId)
  }

  // 获取个人对某个POI的打卡次数
  function getPersonalCheckinCount(poiId: string): number {
    const { userInfo } = useUserInfo()
    if (!userInfo.value.employeeId)
      return 0

    return checkinRecords.value.filter(record =>
      record.poiId === poiId && record.employeeId === userInfo.value.employeeId,
    ).length
  }

  // 获取总打卡人数
  function getTotalCheckinCount(poiId: string): number {
    const uniqueUsers = new Set()
    checkinRecords.value.forEach((record) => {
      if (record.poiId === poiId) {
        uniqueUsers.add(record.employeeId)
      }
    })
    return uniqueUsers.size
  }

  // 获取最近打卡用户
  function getLatestCheckinUser(poiId: string): string | null {
    const poiRecords = checkinRecords.value
      .filter(record => record.poiId === poiId)
      .sort((a, b) => b.timestamp - a.timestamp)

    return poiRecords.length > 0 ? (poiRecords[0]?.employeeName || poiRecords[0]?.employeeId || null) : null
  }

  // 获取已打卡的POI ID列表（只包含当前用户）
  function getCheckedInPOIIds(): string[] {
    const { userInfo } = useUserInfo()
    if (!userInfo.value.employeeId)
      return []

    return [...new Set(
      checkinRecords.value
        .filter(record => record.employeeId === userInfo.value.employeeId)
        .map(record => record.poiId),
    )]
  }

  // 上传照片到云函数
  async function uploadPhoto(file: File): Promise<string> {
    try {
      const { uploadImage } = await import('~/utils/fileUpload')

      const result = await uploadImage(file, {
        userId: 'anonymous', // 可以根据实际用户系统调整
        onProgress: (_progress) => {
          // 上传进度
          // 可以在这里更新UI显示上传进度
        },
      })

      return result.url
    }
    catch (error) {
      console.error('照片上传失败:', error)
      throw new Error(`照片上传失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 修复照片URL格式（现在后端已经返回完整URL，这个函数主要用于兼容性）
  function fixPhotoUrl(photoUrl: string | null | undefined): string | undefined {
    if (!photoUrl)
      return undefined

    // 后端已经处理了URL，直接返回
    return photoUrl
  }

  // 从服务器获取打卡记录
  const lastCheckinFetchTime = ref<number>(0)
  const CHECKIN_FETCH_COOLDOWN = 2000 // 2秒冷却时间

  async function fetchCheckinRecordsFromServer(employeeId?: string, force = false) {
    // 防止频繁请求
    const now = Date.now()
    if (!force && now - lastCheckinFetchTime.value < CHECKIN_FETCH_COOLDOWN) {
      console.warn('打卡记录请求过于频繁，跳过本次请求')
      return
    }

    try {
      lastCheckinFetchTime.value = now
      const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : ''
      const response = await $fetch(`/api/checkin${query}`)

      if (response.success && response.data) {
        // 转换服务器数据格式为本地格式
        const serverRecords = response.data.map((record: any) => ({
          id: record.id,
          employeeId: record.employee_id,
          employeeName: record.employee_name,
          poiId: record.poi_id,
          poiName: record.poi_name,
          comment: record.comment || '',
          rating: record.rating || 0,
          photo: fixPhotoUrl(record.photo_url), // 修复照片URL
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

        checkinRecords.value = serverRecords

        return serverRecords
      }
    }
    catch (err) {
      console.error('从服务器获取打卡记录失败:', err)
      throw err
    }
  }

  // 加载打卡记录（从服务器获取）
  async function loadCheckinRecords(employeeId?: string, force = false) {
    if (import.meta.client) {
      await fetchCheckinRecordsFromServer(employeeId, force)
    }
  }

  // 获取POI的打卡次数
  function getCheckinCount(poiId: string): number {
    return checkinRecords.value.filter(record => record.poiId === poiId).length
  }

  // 获取今日打卡数量
  const todayCheckinCount = computed(() => {
    const today = new Date().toDateString()
    return checkinRecords.value.filter(record =>
      new Date(record.timestamp).toDateString() === today,
    ).length
  })

  // 格式化距离
  function formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}米`
    }
    return `${(meters / 1000).toFixed(1)}公里`
  }

  return {
    // 状态
    showCheckinModal: readonly(showCheckinModal),
    nearbyPOI: readonly(nearbyPOI),
    nearbyPOIs: readonly(nearbyPOIs),
    selectedPOI: readonly(selectedPOI),
    currentCheckinPOI,
    checkinRecords: readonly(checkinRecords),
    isSubmittingCheckin: readonly(isSubmittingCheckin),
    canCheckin,
    nearestPOI,
    todayCheckinCount,
    currentPosition,
    accuracyInfo,
    geoState: readonly(geoState),

    // 范围相关状态
    searchRange,
    showRangeControl,
    showRangeCircle,
    shouldShowRangeControl,
    minRange,
    maxRange,

    // 方法
    startLocationTracking,
    improveLocationAccuracy,
    showCheckinForm,
    closeCheckinModal,
    submitCheckin,
    selectPOI,
    loadCheckinRecords,
    fetchCheckinRecordsFromServer,
    hasCheckedIn,
    getCheckinCount,
    formatDistance,
    calculateDistance,
    isPOICheckedIn,
    getPOICheckinRecords,
    getCheckedInPOIIds,
    getPersonalCheckinCount,
    getTotalCheckinCount,
    getLatestCheckinUser,

    // 范围相关方法
    setSearchRange,
    toggleRangeControl,
    formatRange,
    getRangeLevel,
  }
}
