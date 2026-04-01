/**
 * 信息窗口工具函数
 * 处理信息窗口的内容创建和渲染
 */
import type { POIData } from '~/types/amap'

import {
  calculateDistance,
  calculateDistanceScore,
  calculateTotalScore,
  formatDistance,
  formatRating,
  formatTotalScore,
  getDistanceLevel,
  getEasterEggDisplayInfo,
  SHENZHEN_CENTER,
} from '~/utils/scoreCalculation'

// 获取类别图标
function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    公园: '🌳',
    景点: '🏛️',
    商场: '🛍️',
    博物馆: '🏛️',
    海滩: '🏖️',
    山峰: '⛰️',
    寺庙: '🏯',
    广场: '🏛️',
  }
  return icons[category] || '📍'
}

// 创建信息窗口内容
export function createInfoWindowContent(
  data: POIData,
  developerMode: boolean = false,
  isDark: boolean = false,
  isPOICheckedIn: ((poiId: string) => boolean) | undefined = undefined,
  getPersonalCheckinCount: ((poiId: string) => number) | undefined = undefined,
): string {
  // 计算距离和评分信息 - 统一使用深圳中心点
  const distance = calculateDistance(data.position, SHENZHEN_CENTER)
  const distanceScore = calculateDistanceScore(distance)
  const totalScore = calculateTotalScore(data.rating || 0, distanceScore)

  // 获取彩蛋显示信息
  const easterEggInfo = getEasterEggDisplayInfo(data.easter_egg)

  const themeClass = isDark ? 'dark-theme' : 'light-theme'

  // 获取距离级别
  const distanceLevel = getDistanceLevel(distanceScore)

  // 检查是否已打卡和个人打卡次数
  const _isCheckedIn = isPOICheckedIn ? isPOICheckedIn(data.id) : false
  const personalCheckinCount = getPersonalCheckinCount ? getPersonalCheckinCount(data.id) : 0

  const actionButtons = (developerMode && data.id !== 'center')
    ? `
    <div class="info-actions">
      <button class="edit-btn" onclick="window.editPOI('${data.id}')">
        <span class="btn-icon">✏️</span>
        <span class="btn-text">修改</span>
      </button>
      <button class="delete-btn" onclick="window.deletePOI('${data.id}')">
        <span class="btn-icon">🗑️</span>
        <span class="btn-text">删除</span>
      </button>
    </div>
  `
    : ''

  return `
    <div class="modern-info-window ${themeClass}">
      <div class="info-header">
        <button class="close-btn" onclick="window.closeInfoWindow()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="header-content">
          <div class="poi-title">
            <span class="category-icon">${getCategoryIcon(data.category || '')}</span>
            <h3>${data.name}</h3>
            ${personalCheckinCount > 0 ? `<span class="personal-checkin-badge">✓ ${personalCheckinCount}次</span>` : ''}
          </div>
        </div>
        ${data.category ? `<div class="category-tag">${data.category}</div>` : ''}
      </div>
      
      <div class="info-body">
        ${data.description ? `<div class="description">${data.description}</div>` : ''}
        
        ${data.referencePhoto
          ? `
        <div class="reference-photo">
          <div class="photo-header">
            <span class="photo-icon">📷</span>
            <span class="photo-label">参考照片</span>
          </div>
          <img src="${data.referencePhoto}" alt="打卡参考照片" class="reference-image" onclick="window.openPhotoModal && window.openPhotoModal('${data.referencePhoto}')" />
        </div>
        `
          : ''}
        
        <div class="info-grid">
          <div class="info-card location-card">
            <div class="card-header">
              <span class="card-icon">📍</span>
              <span class="card-title">位置信息</span>
            </div>
            <div class="card-content">
              <div class="metric">
                <span class="metric-label">距离</span>
                <span class="metric-value distance">${formatDistance(distance)}</span>
              </div>
              <div class="metric">
                <span class="metric-label">距离评分</span>
                <span class="metric-value distance-score">${distanceScore}分 (${distanceLevel})</span>
              </div>
            </div>
          </div>
          
          <div class="info-card score-card">
            <div class="card-header">
              <span class="card-icon">⭐</span>
              <span class="card-title">评分信息</span>
            </div>
            <div class="card-content">
              <div class="metric">
                <span class="metric-label">基础评分</span>
                <span class="metric-value rating">${formatRating(data.rating)}</span>
              </div>
              <div class="metric total-score-metric">
                <span class="metric-label">综合评分</span>
                <span class="metric-value total-score">${formatTotalScore(totalScore)}</span>
              </div>
              ${easterEggInfo
                ? `
              <div class="metric easter-egg-metric ${easterEggInfo.isActive ? 'active' : 'inactive'}">
                <span class="metric-label">${easterEggInfo.icon} 彩蛋状态</span>
                <span class="metric-value easter-egg-status">
                  ${easterEggInfo.isActive
                      ? `<span class="active-egg">激活中 +${easterEggInfo.bonusScore}分</span>`
                      : `<span class="inactive-egg">${easterEggInfo.timeRange}</span>`
                  }
                </span>
              </div>
              `
                : ''}
            </div>
          </div>
        </div>
        
        ${actionButtons}
      </div>
    </div>
  `
}

// 设置全局方法
export function setupInfoWindowGlobalMethods(
  infoWindowRef: Ref<any>,
  currentInfoWindowData: Ref<POIData | null>,
  editPOI: ((poi: POIData) => void) | undefined,
  deletePOI: ((id: string) => Promise<boolean>) | undefined,
  pois: POIData[],
  onSuccess?: (message: string) => void,
  onError?: (title: string, message?: string) => void,
) {
  if (!import.meta.client)
    return

  // 关闭信息窗体的全局方法
  window.closeInfoWindow = () => {
    if (infoWindowRef.value) {
      infoWindowRef.value.close()
      currentInfoWindowData.value = null
    }
  }

  // 编辑POI的全局方法
  window.editPOI = (id: string) => {
    console.warn('editPOI 被调用:', {
      id,
      editPOI: !!editPOI,
      currentInfoWindowData: currentInfoWindowData?.value,
      poisLength: pois.length,
    })

    if (editPOI) {
      // 优先从pois数组中查找，如果找不到再使用currentInfoWindowData
      let poiToEdit = pois.find(poi => poi.id === id)

      if (!poiToEdit && currentInfoWindowData?.value) {
        poiToEdit = currentInfoWindowData.value
      }

      console.warn('找到POI:', poiToEdit)

      if (poiToEdit) {
        console.warn('调用editPOI函数')
        editPOI(poiToEdit)
        if (infoWindowRef.value) {
          infoWindowRef.value.close()
          if (currentInfoWindowData) {
            currentInfoWindowData.value = null
          }
        }
      }
      else {
        console.warn('🔧 未找到POI数据，ID:', id)
      }
    }
    else {
      console.warn('🔧 editPOI函数不存在')
    }
  }

  // 删除POI的全局方法
  window.deletePOI = async (id: string) => {
    if (deletePOI) {
      try {
        onSuccess?.('请在开发者面板中使用删除功能')
        console.warn('请求删除POI:', id)

        await deletePOI(id)
        if (infoWindowRef.value) {
          infoWindowRef.value.close()
          currentInfoWindowData.value = null
        }
      }
      catch (err) {
        onError?.('删除失败', err instanceof Error ? err.message : '未知错误')
      }
    }
  }
}

// 清理全局方法
export function cleanupInfoWindowGlobalMethods() {
  if (!import.meta.client)
    return

  delete window.closeInfoWindow
  delete window.editPOI
  delete window.deletePOI
}
