import type { POIData } from '~/types/amap'
import { centerPoint, samplePOIs } from '~/config/map'

/**
 * 地图数据管理 Composable
 * 提供POI数据的增删改查功能
 */
export function useMapData() {
  // 响应式POI数据
  const pois = ref<POIData[]>([...samplePOIs])
  const center = ref<POIData>(centerPoint)

  // 添加新的POI
  const addPOI = (poi: POIData) => {
    const exists = pois.value.find(p => p.id === poi.id)
    if (!exists) {
      pois.value.push(poi)
      return true
    }
    return false
  }

  // 删除POI
  const removePOI = (id: string) => {
    const index = pois.value.findIndex(p => p.id === id)
    if (index > -1) {
      pois.value.splice(index, 1)
      return true
    }
    return false
  }

  // 更新POI
  const updatePOI = (id: string, updates: Partial<POIData>) => {
    const index = pois.value.findIndex(p => p.id === id)
    if (index > -1) {
      pois.value[index] = { ...pois.value[index], ...updates }
      return true
    }
    return false
  }

  // 根据ID获取POI
  const getPOIById = (id: string) => {
    return pois.value.find(p => p.id === id)
  }

  // 根据分类筛选POI
  const getPOIsByCategory = (category: string) => {
    return pois.value.filter(p => p.category === category)
  }

  // 获取所有分类
  const getCategories = () => {
    const categories = pois.value.map(p => p.category).filter(Boolean)
    return [...new Set(categories)]
  }

  // 清空所有POI
  const clearPOIs = () => {
    pois.value = []
  }

  // 重置为默认POI
  const resetPOIs = () => {
    pois.value = [...samplePOIs]
  }

  // 导出POI数据为JSON
  const exportPOIs = () => {
    return JSON.stringify(pois.value, null, 2)
  }

  // 从JSON导入POI数据
  const importPOIs = (jsonData: string) => {
    try {
      const importedPOIs = JSON.parse(jsonData) as POIData[]
      if (Array.isArray(importedPOIs)) {
        pois.value = importedPOIs
        return true
      }
      return false
    }
    catch (error) {
      console.error('导入POI数据失败:', error)
      return false
    }
  }

  return {
    // 数据
    pois: readonly(pois),
    center: readonly(center),

    // 方法
    addPOI,
    removePOI,
    updatePOI,
    getPOIById,
    getPOIsByCategory,
    getCategories,
    clearPOIs,
    resetPOIs,
    exportPOIs,
    importPOIs,
  }
}
