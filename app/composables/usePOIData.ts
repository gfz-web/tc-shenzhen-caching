import type { POIData } from '~/types/amap'
import { createSharedComposable } from '@vueuse/core'

interface POIFilters {
  category?: string
  search?: string
  sortBy?: string
  sortOrder?: string
}

interface POIResponse {
  success: boolean
  data: POIData[]
  count: number
}

/**
 * POI数据加载 Composable
 * 从API加载POI数据，支持筛选和排序
 */
function _usePOIData(filters: Ref<POIFilters> = ref({})) {
  const pois = ref<POIData[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)
  const lastFetchTime = ref<number>(0)
  const FETCH_COOLDOWN = 3000 // 3秒冷却时间

  // 加载POI数据
  const loadPOIs = async (currentFilters?: POIFilters, force = false) => {
    // 防止频繁请求
    const now = Date.now()
    if (!force && now - lastFetchTime.value < FETCH_COOLDOWN) {
      console.warn('POI数据请求过于频繁，跳过本次请求')
      return
    }

    try {
      loading.value = true
      error.value = null
      lastFetchTime.value = now

      // 构建查询参数 - 只发送服务器端支持的筛选条件
      const params = new URLSearchParams()
      const filterValues = currentFilters || filters.value

      // 只发送服务器端支持的筛选条件
      if (filterValues.category && filterValues.category !== 'all') {
        params.append('category', filterValues.category)
      }
      if (filterValues.search) {
        params.append('search', filterValues.search)
      }

      // 对于排序，只发送服务器端支持的排序字段
      if (filterValues.sortBy && ['name', 'rating', 'distance', 'distanceScore', 'totalScore'].includes(filterValues.sortBy)) {
        params.append('sortBy', filterValues.sortBy)
      }
      if (filterValues.sortOrder) {
        params.append('sortOrder', filterValues.sortOrder)
      }

      // 注意：checkinStatus 是客户端筛选，不发送到服务器

      // 调用API
      const url = `/api/pois${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: POIResponse = await response.json()

      if (!result.success) {
        throw new Error('API返回错误')
      }

      pois.value = result.data
    }
    catch (err) {
      console.error('加载POI数据失败:', err)
      error.value = err instanceof Error ? err.message : '未知错误'

      // 加载失败时使用默认数据
      pois.value = getDefaultPOIs()
    }
    finally {
      loading.value = false
    }
  }

  // 获取默认POI数据（作为备用）
  function getDefaultPOIs(): POIData[] {
    return []
  }

  // 重新加载数据
  const reload = (newFilters?: POIFilters, force = false) => {
    loadPOIs(newFilters, force)
  }

  // 添加新POI
  const addPOI = async (poiData: Omit<POIData, 'id'>) => {
    try {
      const response = await fetch('/api/pois', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(poiData),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to add POI')
      }

      // 重新加载数据以获取最新列表
      await loadPOIs(undefined, true)

      return result.data
    }
    catch (err) {
      console.error('添加POI失败:', err)
      throw err
    }
  }

  // 更新POI
  const updatePOI = async (id: string, poiData: Partial<POIData>) => {
    try {
      const response = await fetch(`/api/pois/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(poiData),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to update POI')
      }

      // 重新加载数据以获取最新列表
      await loadPOIs(undefined, true)

      return result.data
    }
    catch (err) {
      console.error('更新POI失败:', err)
      throw err
    }
  }

  // 软删除POI
  const deletePOI = async (id: string) => {
    try {
      const response = await fetch(`/api/pois/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to delete POI')
      }

      // 重新加载数据以获取最新列表
      await loadPOIs(undefined, true)

      return true
    }
    catch (err) {
      console.error('删除POI失败:', err)
      throw err
    }
  }

  // 恢复软删除的POI
  const restorePOI = async (id: string) => {
    try {
      const response = await fetch(`/api/pois/${id}/restore`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to restore POI')
      }

      // 重新加载数据以获取最新列表
      await loadPOIs(undefined, true)

      return result.data
    }
    catch (err) {
      console.error('恢复POI失败:', err)
      throw err
    }
  }

  // 获取已删除的POI列表
  const getDeletedPOIs = async (filters?: POIFilters) => {
    try {
      const params = new URLSearchParams()
      const filterValues = filters || {}

      if (filterValues.category && filterValues.category !== 'all') {
        params.append('category', filterValues.category)
      }
      if (filterValues.search) {
        params.append('search', filterValues.search)
      }
      if (filterValues.sortBy) {
        params.append('sortBy', filterValues.sortBy)
      }
      if (filterValues.sortOrder) {
        params.append('sortOrder', filterValues.sortOrder)
      }

      const url = `/api/pois/deleted${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: POIResponse = await response.json()

      if (!result.success) {
        throw new Error('API返回错误')
      }

      return result.data
    }
    catch (err) {
      console.error('获取已删除POI失败:', err)
      throw err
    }
  }

  // 监听筛选条件变化 - 只有影响服务器查询的条件改变时才重新加载
  let filterWatchTimeout: NodeJS.Timeout | null = null

  watch(filters, (newFilters, oldFilters) => {
    // 清除之前的定时器，避免重复请求
    if (filterWatchTimeout) {
      clearTimeout(filterWatchTimeout)
    }

    // 防抖处理，避免频繁变化时的重复请求
    filterWatchTimeout = setTimeout(() => {
      // 检查是否有影响服务器查询的条件发生变化
      const serverFilters = ['category', 'search', 'sortBy', 'sortOrder']
      const shouldReload = serverFilters.some(key =>
        newFilters[key as keyof POIFilters] !== oldFilters?.[key as keyof POIFilters],
      )

      if (shouldReload) {
        console.warn('筛选条件变化，重新加载POI数据:', { newFilters, oldFilters })
        loadPOIs(newFilters)
      }
    }, 300) // 300ms防抖
  }, { deep: true })

  // 组件挂载时自动加载（只在首次挂载时加载）
  let hasInitialLoad = false
  onMounted(() => {
    if (!hasInitialLoad) {
      hasInitialLoad = true
      loadPOIs(undefined, true) // 强制加载，跳过冷却检查
    }
  })

  return {
    pois: readonly(pois),
    loading: readonly(loading),
    error: readonly(error),
    reload,
    addPOI,
    updatePOI,
    deletePOI,
    restorePOI,
    getDeletedPOIs,
  }
}

// 使用 VueUse 的 createSharedComposable 创建共享的 composable
export const usePOIData = createSharedComposable(_usePOIData)
