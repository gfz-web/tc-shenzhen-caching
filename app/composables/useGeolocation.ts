import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useUserInfo } from '~/composables/useUserInfo'
import { calculateDistance as coreCalculateDistance } from '~/utils/scoreCalculation'

// Coordinate interface for location data
interface Coordinate {
  lng: number
  lat: number
}

export interface GeolocationState {
  coords: {
    latitude: number
    longitude: number
    accuracy: number
  } | null
  error: string | null
  loading: boolean
  supported: boolean
}

export function useGeolocation() {
  const state = ref<GeolocationState>({
    coords: null,
    error: null,
    loading: false,
    supported: false,
  })

  let geolocation: any = null
  let watchId: number | null = null

  // 获取用户信息以应用坐标校准
  const { userInfo } = useUserInfo()

  // 检查高德地图是否可用
  const isSupported = computed(() => typeof window !== 'undefined' && !!window.AMap)

  // 原始GPS位置（未校准）
  const rawPosition = computed<Coordinate | null>(() => {
    if (!state.value.coords)
      return null
    return {
      lng: state.value.coords.longitude,
      lat: state.value.coords.latitude,
    }
  })

  // 当前位置作为Coordinate格式（应用坐标校准）
  const currentPosition = computed<Coordinate | null>(() => {
    if (!rawPosition.value)
      return null

    // 获取坐标偏移量
    const offset = userInfo.value.coordinateOffset
    if (!offset || (offset.lat === 0 && offset.lng === 0)) {
      // 没有偏移量，返回原始坐标
      return rawPosition.value
    }

    // 应用坐标偏移量（将米转换为度）
    // 在深圳地区的近似转换：1米 ≈ 1/111000度 纬度，1米 ≈ 1/(111000 * cos(纬度))度 经度
    const latDegreePerMeter = 1 / 111000
    const lngDegreePerMeter = 1 / (111000 * Math.cos(rawPosition.value.lat * Math.PI / 180))

    return {
      lng: rawPosition.value.lng + (offset.lng * lngDegreePerMeter),
      lat: rawPosition.value.lat + (offset.lat * latDegreePerMeter),
    }
  })

  // 位置精度信息
  const accuracyInfo = computed(() => {
    if (!state.value.coords)
      return null

    const accuracy = state.value.coords.accuracy
    let level = 'unknown'
    let description = '未知'
    let color = '#6c757d'

    if (accuracy <= 5) {
      level = 'excellent'
      description = '极佳 (<5m)'
      color = '#28a745'
    }
    else if (accuracy <= 10) {
      level = 'good'
      description = '良好 (<10m)'
      color = '#28a745'
    }
    else if (accuracy <= 20) {
      level = 'fair'
      description = '一般 (<20m)'
      color = '#ffc107'
    }
    else if (accuracy <= 50) {
      level = 'poor'
      description = '较差 (<50m)'
      color = '#fd7e14'
    }
    else {
      level = 'very-poor'
      description = '很差 (>50m)'
      color = '#dc3545'
    }

    return {
      accuracy: Math.round(accuracy),
      level,
      description,
      color,
    }
  })

  // 计算两点之间的距离（使用统一的计算工具，返回米）
  function calculateDistance(pos1: Coordinate, pos2: Coordinate): number {
    // 使用统一的距离计算函数（返回公里），然后转换为米
    const distanceInKm = coreCalculateDistance([pos1.lng, pos1.lat], [pos2.lng, pos2.lat])
    return distanceInKm * 1000 // 转换为米
  }

  // 检查是否在指定距离内
  function isWithinDistance(targetPosition: Coordinate, maxDistance: number = 100): boolean {
    if (!currentPosition.value)
      return false
    const distance = calculateDistance(currentPosition.value, targetPosition)
    return distance <= maxDistance
  }

  // 初始化高德地图定位插件
  function initAMapGeolocation(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!window.AMap) {
        reject(new Error('高德地图API未加载'))
        return
      }

      // 加载定位插件
      window.AMap.plugin('AMap.Geolocation', () => {
        geolocation = new window.AMap.Geolocation({
          enableHighAccuracy: true, // 启用高精度定位
          timeout: 30000, // 增加超时时间到30秒
          maximumAge: 0, // 不使用缓存，强制获取最新位置
          convert: true, // 自动坐标转换到高德坐标系
          showButton: false, // 不显示定位按钮
          showMarker: false, // 不显示定位标记
          showCircle: false, // 不显示精度圆圈
          panToLocation: false, // 不自动移动地图
          zoomToAccuracy: false, // 不自动调整视野
          // 新增优化参数
          needAddress: true, // 返回地址信息
          extensions: 'all', // 返回详细信息
          // 定位来源优先级：GPS > 网络定位 > IP定位
          locationFirst: true, // 优先使用精确定位
          noIpLocate: false, // 允许IP定位作为备选
          noGeoLocation: false, // 允许浏览器定位
          GeoLocationFirst: true, // 优先使用浏览器定位
        })

        resolve(geolocation)
      })
    })
  }

  // 获取当前位置 - 使用高德地图定位
  async function getCurrentPosition(): Promise<any> {
    return new Promise(async (resolve, reject) => {
      if (!isSupported.value) {
        reject(new Error('高德地图API不可用'))
        return
      }

      state.value.loading = true
      state.value.error = null

      try {
        // 确保定位插件已初始化
        if (!geolocation) {
          await initAMapGeolocation()
        }

        // 执行定位
        geolocation.getCurrentPosition((status: string, result: any) => {
          if (status === 'complete') {
            console.warn('高德地图定位成功:', result)

            // 更新状态
            state.value.coords = {
              latitude: result.position.lat,
              longitude: result.position.lng,
              accuracy: result.accuracy || 100, // 高德返回的精度，默认100米
            }
            state.value.loading = false

            resolve(result)
          }
          else {
            // console.error('高德地图定位失败:', result)
            const errorMsg = getAMapErrorMessage(result.message)
            state.value.error = errorMsg
            state.value.loading = false
            reject(new Error(errorMsg))
          }
        })
      }
      catch (error) {
        // console.error('定位插件初始化失败:', error)
        state.value.error = '定位服务初始化失败'
        state.value.loading = false
        reject(error)
      }
    })
  }

  // 开始监听位置变化
  async function startWatching() {
    if (!isSupported.value) {
      state.value.error = '高德地图API不可用'
      return
    }

    try {
      // 确保定位插件已初始化
      if (!geolocation) {
        await initAMapGeolocation()
      }

      // 使用高德地图的watchPosition功能
      // 注意：高德地图的Geolocation插件主要用于单次定位
      // 对于持续监听，我们可以定期调用getCurrentPosition
      const watchInterval = setInterval(async () => {
        try {
          await getCurrentPosition()
        }
        catch (error) {
          console.warn('位置监听更新失败:', error)
        }
      }, 30000) // 每30秒更新一次位置

      // 保存定时器ID用于清理
      watchId = watchInterval as any
    }
    catch (error) {
      console.error('开始位置监听失败:', error)
      state.value.error = '位置监听启动失败'
    }
  }

  // 停止监听位置变化
  function stopWatching() {
    if (watchId !== null) {
      clearInterval(watchId)
      watchId = null
    }
  }

  // 尝试获取更高精度的位置
  async function tryHighAccuracyPosition(): Promise<any> {
    console.warn('尝试获取高精度位置...')

    try {
      // 确保定位插件已初始化
      if (!geolocation) {
        await initAMapGeolocation()
      }

      return new Promise((resolve, reject) => {
        // 创建一个新的高精度定位实例
        const highAccuracyGeolocation = new window.AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 45000, // 给更多时间获取GPS精确位置
          maximumAge: 0, // 不使用缓存，强制获取新位置
          convert: true,
          showButton: false,
          showMarker: false,
          showCircle: false,
          panToLocation: false,
          zoomToAccuracy: false,
        })

        highAccuracyGeolocation.getCurrentPosition((status: string, result: any) => {
          if (status === 'complete') {
            console.warn('高精度定位成功:', result)

            // 如果新位置精度更好，更新状态
            const newAccuracy = result.accuracy || 100
            if (!state.value.coords || newAccuracy < state.value.coords.accuracy) {
              state.value.coords = {
                latitude: result.position.lat,
                longitude: result.position.lng,
                accuracy: newAccuracy,
              }
              console.warn('位置精度已改善到:', `${newAccuracy}米`)
            }
            resolve(result)
          }
          else {
            console.error('高精度定位失败:', result)
            reject(new Error(getAMapErrorMessage(result.message)))
          }
        })
      })
    }
    catch (error) {
      console.error('高精度定位初始化失败:', error)
      throw error
    }
  }

  // 获取高德地图错误信息
  function getAMapErrorMessage(message: string): string {
    if (!message)
      return '定位失败'

    // 根据高德地图常见错误信息进行映射
    if (message.includes('permission') || message.includes('权限')) {
      return '请允许位置访问权限'
    }
    if (message.includes('timeout') || message.includes('超时')) {
      return '定位超时，请检查网络连接或移动到GPS信号更好的地方'
    }
    if (message.includes('unavailable') || message.includes('不可用')) {
      return '位置服务不可用，请检查设备GPS设置或尝试在室外使用'
    }
    if (message.includes('network') || message.includes('网络')) {
      return '网络连接异常，请检查网络设置'
    }

    return `定位失败: ${message}`
  }

  // 保留原有的错误处理函数（用于兼容性）
  function _getErrorMessage(error: any): string {
    if (error && error.code) {
      switch (error.code) {
        case 1: // PERMISSION_DENIED
          return '请在浏览器设置中允许位置访问权限'
        case 2: // POSITION_UNAVAILABLE
          return '位置服务不可用，请检查设备GPS设置或尝试在室外使用'
        case 3: // TIMEOUT
          return '定位超时，请检查网络连接或移动到GPS信号更好的地方'
        default:
          return `定位失败 (错误代码: ${error.code})`
      }
    }
    return error?.message || '定位失败'
  }

  // 组件挂载时检查支持性
  onMounted(() => {
    state.value.supported = isSupported.value
  })

  // 组件卸载时停止监听
  onBeforeUnmount(() => {
    stopWatching()
  })

  return {
    state: readonly(state),
    currentPosition,
    rawPosition,
    accuracyInfo,
    isSupported,
    calculateDistance,
    isWithinDistance,
    getCurrentPosition,
    tryHighAccuracyPosition,
    startWatching,
    stopWatching,
  }
}
