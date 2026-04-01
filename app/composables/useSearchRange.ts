/**
 * 搜索范围管理 Composable
 * 用于管理动态打卡范围和地图上的范围显示
 */

// 全局状态，确保整个应用共享同一个搜索范围状态
const globalSearchRange = ref(800) // 默认800米
const globalShowRangeControl = ref(false)
const globalShowRangeCircle = ref(true)

export function useSearchRange() {
  // 当前搜索范围（米）
  const searchRange = globalSearchRange
  const minRange = 800 // 最小范围800米
  const maxRange = 3000 // 最大范围3公里

  // 是否显示范围控制器
  const showRangeControl = globalShowRangeControl

  // 是否显示地图上的范围圆圈
  const showRangeCircle = globalShowRangeCircle

  // 范围级别描述
  const getRangeLevel = (range: number): string => {
    if (range <= 800)
      return '精确定位'
    if (range <= 1500)
      return '近距离'
    if (range <= 3000)
      return '中距离'
    return '远距离'
  }

  // 格式化范围显示
  const formatRange = (range: number): string => {
    if (range < 1000) {
      return `${range}m`
    }
    return `${(range / 1000).toFixed(1)}km`
  }

  // 设置搜索范围
  const setSearchRange = (range: number) => {
    searchRange.value = Math.max(minRange, Math.min(maxRange, range))
  }

  // 重置为默认范围
  const resetRange = () => {
    searchRange.value = minRange
    showRangeControl.value = false
  }

  // 扩大范围（当没有找到POI时）
  const expandRange = () => {
    if (searchRange.value < maxRange) {
      const newRange = Math.min(searchRange.value + 500, maxRange)
      setSearchRange(newRange)
      return true
    }
    return false
  }

  // 缩小范围
  const shrinkRange = () => {
    if (searchRange.value > minRange) {
      const newRange = Math.max(searchRange.value - 500, minRange)
      setSearchRange(newRange)
      return true
    }
    return false
  }

  // 切换范围控制器显示
  const toggleRangeControl = () => {
    showRangeControl.value = !showRangeControl.value
  }

  // 切换范围圆圈显示
  const toggleRangeCircle = () => {
    showRangeCircle.value = !showRangeCircle.value
  }

  return {
    // 状态
    searchRange: readonly(searchRange),
    minRange,
    maxRange,
    showRangeControl: readonly(showRangeControl),
    showRangeCircle: readonly(showRangeCircle),

    // 方法
    getRangeLevel,
    formatRange,
    setSearchRange,
    resetRange,
    expandRange,
    shrinkRange,
    toggleRangeControl,
    toggleRangeCircle,
  }
}
