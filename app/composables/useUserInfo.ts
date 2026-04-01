// 全局用户信息管理
import { createSharedComposable, useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

export interface UserInfo {
  employeeId: string
  employeeName: string // 保持内部结构不变，但界面显示为昵称
  coordinateOffset?: {
    lat: number // 纬度偏移量（米）
    lng: number // 经度偏移量（米）
    calibratedAt: number // 校准时间戳
  }
}

const STORAGE_KEY = 'shenzhen-caching-user-info'

// 创建用户信息 composable
function _useUserInfo() {
  // 使用 VueUse 的 useLocalStorage，自动处理序列化和同步
  const userInfo = useLocalStorage<UserInfo>(STORAGE_KEY, {
    employeeId: '',
    employeeName: '',
  }, {
    deep: true, // 深度监听对象变化
    serializer: {
      read: (value: string) => {
        try {
          return JSON.parse(value)
        }
        catch {
          return { employeeId: '', employeeName: '' }
        }
      },
      write: (value: UserInfo) => JSON.stringify(value),
    },
  })

  // 是否已填写用户信息
  const hasUserInfo = computed(() => {
    return !!(userInfo.value.employeeId && userInfo.value.employeeId.trim()
      && userInfo.value.employeeName && userInfo.value.employeeName.trim())
  })

  // 是否需要提示填写用户信息
  const needsUserInfo = computed(() => {
    return !hasUserInfo.value
  })

  // 初始化用户信息（VueUse 的 useLocalStorage 会自动处理）
  function initUserInfo() {
    // VueUse useLocalStorage 自动初始化完成
  }

  // 保存用户信息
  function saveUserInfo(info: UserInfo) {
    // 验证工号格式（纯数字）
    if (!/^\d+$/.test(info.employeeId.trim())) {
      throw new Error('工号必须为纯数字')
    }

    // 直接更新 userInfo，VueUse 会自动保存到 localStorage
    userInfo.value = {
      employeeId: info.employeeId.trim(),
      employeeName: info.employeeName.trim(),
      coordinateOffset: userInfo.value.coordinateOffset, // 保留原有的坐标校准
    }
  }

  // 清除用户信息
  function clearUserInfo() {
    userInfo.value = {
      employeeId: '',
      employeeName: '',
    }
  }

  // 验证用户信息
  function validateUserInfo(info: Partial<UserInfo>): { valid: boolean, error?: string } {
    if (!info.employeeId || !info.employeeId.trim()) {
      return { valid: false, error: '请输入工号' }
    }

    if (!/^\d+$/.test(info.employeeId.trim())) {
      return { valid: false, error: '工号必须为纯数字' }
    }

    if (info.employeeId.trim().length > 20) {
      return { valid: false, error: '工号长度不能超过20位' }
    }

    if (!info.employeeName || !info.employeeName.trim()) {
      return { valid: false, error: '请输入昵称' }
    }

    if (info.employeeName.trim().length > 100) {
      return { valid: false, error: '昵称长度不能超过100个字符' }
    }

    return { valid: true }
  }

  // 获取当前用户信息
  function getCurrentUserInfo(): UserInfo {
    return { ...userInfo.value }
  }

  // 保存坐标校准偏移量
  function saveCoordinateOffset(latOffset: number, lngOffset: number) {
    // 限制偏移量在±500米范围内
    const maxOffset = 800
    const clampedLatOffset = Math.max(-maxOffset, Math.min(maxOffset, latOffset))
    const clampedLngOffset = Math.max(-maxOffset, Math.min(maxOffset, lngOffset))

    userInfo.value.coordinateOffset = {
      lat: clampedLatOffset,
      lng: clampedLngOffset,
      calibratedAt: Date.now(),
    }
  }

  // 清除坐标校准
  function clearCoordinateOffset() {
    userInfo.value.coordinateOffset = undefined
  }

  // 应用坐标校准到指定位置
  function applyCalibratedCoordinates(position: { lat: number, lng: number }): { lat: number, lng: number } {
    if (!userInfo.value.coordinateOffset) {
      return position
    }

    const offset = userInfo.value.coordinateOffset

    // 将米转换为度数偏移量
    // 纬度：1度约等于111000米
    // 经度：在中国深圳地区（约22.5°N），1度约等于111000 * cos(22.5°) ≈ 102400米
    const latOffsetDegrees = offset.lat / 111000
    const lngOffsetDegrees = offset.lng / 102400

    return {
      lat: position.lat + latOffsetDegrees,
      lng: position.lng + lngOffsetDegrees,
    }
  }

  return {
    userInfo,
    hasUserInfo,
    needsUserInfo,
    initUserInfo,
    saveUserInfo,
    clearUserInfo,
    validateUserInfo,
    getCurrentUserInfo,
    saveCoordinateOffset,
    clearCoordinateOffset,
    applyCalibratedCoordinates,
  }
}

// 使用 VueUse 的 createSharedComposable 创建共享的 composable
export const useUserInfo = createSharedComposable(_useUserInfo)
