import type { POIData } from '~/types/amap'
import {
  calculateDistance,
  calculateDistanceScore,
  calculateTotalScore,
  SHENZHEN_CENTER,
} from '~/utils/scoreCalculation'

/**
 * POI列表管理 Composable
 * 提供POI列表的筛选、排序、搜索等功能，使用API进行数据加载
 */

export function usePOIList(pois: Ref<POIData[]>, _mapCenter: [number, number] = SHENZHEN_CENTER, isPOICheckedIn?: (poiId: string) => boolean) {
  // 列表显示状态
  const showPOIList = ref(false)

  // 筛选条件
  const filters = ref({
    category: 'all' as string,
    search: '',
    sortBy: 'name' as 'name' | 'distance' | 'rating' | 'distanceScore' | 'totalScore',
    sortOrder: 'asc' as 'asc' | 'desc',
    checkinStatus: 'all' as 'all' | 'checked' | 'unchecked', // 新增打卡状态筛选
  })

  // 获取所有分类
  const categories = computed(() => {
    const cats = new Set(pois.value.map(poi => poi.category).filter(Boolean))
    return Array.from(cats)
  })

  // 筛选POI数据，包括分类、搜索、打卡状态筛选和排序
  const filteredPOIs = computed(() => {
    let result = pois.value

    // 根据分类筛选
    if (filters.value.category !== 'all') {
      result = result.filter(poi => poi.category === filters.value.category)
    }

    // 根据搜索文本筛选
    if (filters.value.search.trim()) {
      const searchTerm = filters.value.search.toLowerCase().trim()
      result = result.filter(poi =>
        poi.name.toLowerCase().includes(searchTerm)
        || (poi.description && poi.description.toLowerCase().includes(searchTerm)),
      )
    }

    // 根据打卡状态筛选
    if (filters.value.checkinStatus !== 'all' && isPOICheckedIn) {
      result = result.filter((poi) => {
        const isChecked = isPOICheckedIn(poi.id)
        if (filters.value.checkinStatus === 'checked') {
          return isChecked
        }
        else if (filters.value.checkinStatus === 'unchecked') {
          return !isChecked
        }
        return true
      })
    }

    // 排序
    result = [...result].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (filters.value.sortBy) {
        case 'name':
          aValue = a.name
          bValue = b.name
          break
        case 'distance':
          aValue = a.distance || 0
          bValue = b.distance || 0
          break
        case 'rating':
          aValue = a.rating || 0
          bValue = b.rating || 0
          break
        case 'distanceScore':
          aValue = a.distanceScore || 0
          bValue = b.distanceScore || 0
          break
        case 'totalScore':
          aValue = a.totalScore || 0
          bValue = b.totalScore || 0
          break
        default:
          aValue = a.name
          bValue = b.name
      }

      if (filters.value.sortOrder === 'desc') {
        return typeof aValue === 'string' ? bValue.localeCompare(aValue) : bValue - aValue
      }
      else {
        return typeof aValue === 'string' ? aValue.localeCompare(bValue) : aValue - bValue
      }
    })

    return result
  })

  // 切换列表显示状态
  function togglePOIList(show: boolean = !showPOIList.value) {
    showPOIList.value = show
  }

  // 设置分类筛选
  function setCategory(category: string) {
    filters.value.category = category
  }

  // 设置搜索文本
  function setSearchText(text: string) {
    filters.value.search = text
  }

  // 设置排序方式
  function setSorting(sortBy: typeof filters.value.sortBy, sortOrder: typeof filters.value.sortOrder = 'asc') {
    filters.value.sortBy = sortBy
    filters.value.sortOrder = sortOrder
  }

  // 设置打卡状态筛选
  function setCheckinStatus(status: typeof filters.value.checkinStatus) {
    filters.value.checkinStatus = status
  }

  // 清除所有筛选条件
  function clearFilters() {
    filters.value = {
      category: 'all',
      search: '',
      sortBy: 'name',
      sortOrder: 'asc',
      checkinStatus: 'all',
    }
  }

  // 格式化距离显示
  function formatDistance(distance: number): string {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`
    }
    else {
      return `${distance.toFixed(1)}km`
    }
  }

  // 格式化评分显示
  function formatRating(rating?: number): string {
    if (!rating)
      return '-'
    return `${rating}分`
  }

  // 格式化距离分数显示
  function formatDistanceScore(distanceScore?: number): string {
    if (distanceScore === undefined || distanceScore === null)
      return '-'
    const levels = ['很近', '较近', '中等', '较远', '很远', '极远']
    return `${distanceScore}分 (${levels[distanceScore]})`
  }

  // 格式化综合分数显示
  function formatTotalScore(totalScore?: number): string {
    if (!totalScore)
      return '-'
    return `${totalScore}分`
  }

  return {
    // 状态
    showPOIList, // 提供可写访问以支持外部互斥逻辑
    filters: readonly(filters),
    categories,
    filteredPOIs,

    // 方法
    togglePOIList,
    setCategory,
    setSearchText,
    setSorting,
    setCheckinStatus,
    clearFilters,
    calculateDistance,
    calculateDistanceScore,
    calculateTotalScore,
    formatDistance,
    formatRating,
    formatDistanceScore,
    formatTotalScore,
  }
}
