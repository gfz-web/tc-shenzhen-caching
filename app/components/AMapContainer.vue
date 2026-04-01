<script setup lang="ts">
import type { MapInstance, POIData } from '~/types/amap'
import MapControls from '~/components/MapControls.vue'
import { useToast } from '~/composables/useToast'
import { mapConfig } from '~/config/map'
import { MarkerManager } from '~/utils/markerManager'

const props = withDefaults(defineProps<Props>(), {
  pois: () => [],
  showCenter: true,
  height: '600px',
  developerMode: false,
})

// Emits
const emit = defineEmits<{
  positionSelected: [position: { lng: number, lat: number }]
  toggleDeveloper: []
  toggleDarkMode: []
  editUserInfo: []
  showRanking: []
  showCoordinateCalibration: []
  showAudit: []
  showEasterEgg: []
  showCheckinMap: []
}>()

// Props
interface Props {
  pois?: POIData[]
  showCenter?: boolean
  height?: string
  developerMode?: boolean
  showDeveloperButton?: boolean
  deletePOI?: (id: string) => Promise<boolean>
  editPOI?: (poi: POIData) => void
  userPosition?: { lat: number, lng: number } | null
  isPOICheckedIn?: (poiId: string) => boolean
  getPersonalCheckinCount?: (poiId: string) => number
  searchRange?: number
  showRangeCircle?: boolean
  onInfoWindowToggle?: (isOpen: boolean) => void
  onPOIClick?: (poi: POIData) => void
}

// Composables
const { info, error } = useToast()

// Refs
const mapContainer = ref<HTMLElement>()
const isLoading = ref(true)
const map = ref<MapInstance>()
const infoWindow = ref<any>()
const isDarkMode = ref(false)
const markerManager = ref<MarkerManager>()

// 地图样式配置
const mapStyles = {
  normal: 'amap://styles/normal',
  dark: 'amap://styles/dark',
  satellite: 'amap://styles/satellite',
}

// 初始化地图
function initMap() {
  if (!window.AMap) {
    console.error('高德地图 API 未加载')
    return
  }

  // 设置安全密钥
  window._AMapSecurityConfig = {
    securityJsCode: mapConfig.securityJsCode,
  }

  // 创建地图实例
  map.value = new window.AMap.Map('amap-container', {
    center: mapConfig.center,
    zoom: mapConfig.zoom,
    mapStyle: mapStyles.normal,
    viewMode: '3D',
    features: ['bg', 'road', 'building', 'point'],
    resizeEnable: true,
  })

  // 添加地图控件
  map.value.addControl(new window.AMap.Scale())
  map.value.addControl(new window.AMap.ToolBar({
    locate: false, // 禁用内置定位按钮，使用我们自己的定位系统
    position: 'LT',
  }))

  // 预加载定位插件
  window.AMap.plugin('AMap.Geolocation', () => {
    console.warn('高德地图定位插件已加载')
  })

  // 创建信息窗体
  infoWindow.value = new window.AMap.InfoWindow({
    isCustom: true,
    content: '',
    anchor: 'bottom-center',
    offset: new window.AMap.Pixel(0, -30),
    closeWhenClickMap: true, // 点击地图时关闭信息窗体
  })

  // 初始化标记管理器
  markerManager.value = new MarkerManager({
    map: map.value,
    infoWindow: infoWindow.value,
    showCenter: props.showCenter,
    developerMode: props.developerMode,
    isPOICheckedIn: props.isPOICheckedIn,
    getPersonalCheckinCount: props.getPersonalCheckinCount,
    editPOI: props.editPOI,
    deletePOI: props.deletePOI,
    onPositionSelected: position => emit('positionSelected', position),
    onInfoWindowToggle: props.onInfoWindowToggle,
    onPOIClick: props.onPOIClick,
    onSuccess: info,
    onError: error,
  })

  // 添加标记点
  markerManager.value.addMarkers(props.pois)

  // 地图加载完成后设置正确的样式
  if (import.meta.client) {
    nextTick(() => {
      setTimeout(() => {
        const htmlElement = document.documentElement
        const pageIsDark = htmlElement.classList.contains('dark')
        console.warn('地图加载完成后检测深色模式:', pageIsDark)
        setMapStyleFromPageMode(pageIsDark)
      }, 500)
    })
  }

  isLoading.value = false
}

// 简化的地图操作方法

// 重置视图
function resetView() {
  if (map.value) {
    // 如果有用户位置，重置到用户位置；否则重置到默认中心点
    if (props.userPosition) {
      const userCenter: [number, number] = [props.userPosition.lng, props.userPosition.lat]
      map.value.setCenter(userCenter)
      map.value.setZoom(16) // 用户位置使用更高的缩放级别
    }
    else {
      map.value.setCenter(mapConfig.center)
      map.value.setZoom(mapConfig.zoom)
    }
  }
}

// 定位到指定位置
function panToPosition(position: [number, number], zoom?: number) {
  if (map.value) {
    map.value.setCenter(position)
    if (zoom) {
      map.value.setZoom(zoom)
    }
  }
}

// 根据页面深色模式设置地图样式
function setMapStyleFromPageMode(pageIsDark: boolean) {
  if (map.value) {
    isDarkMode.value = pageIsDark
    const style = pageIsDark ? mapStyles.dark : mapStyles.normal
    console.warn('设置地图样式:', pageIsDark ? '深色' : '浅色', style)
    map.value.setMapStyle(style)

    // 确保样式设置成功，如果需要的话重试
    setTimeout(() => {
      if (map.value && isDarkMode.value !== pageIsDark) {
        console.warn('重试设置地图样式')
        map.value.setMapStyle(style)
      }
    }, 200)
  }
}

// 监听 POI 数据变化
watch(() => props.pois, () => {
  if (markerManager.value) {
    markerManager.value.addMarkers(props.pois)
  }
}, { deep: true })

// 监听开发者模式变化
watch(() => props.developerMode, (newMode) => {
  if (markerManager.value) {
    markerManager.value.updateDeveloperMode(newMode)
  }
})

// 监听深色模式变化，重新渲染信息窗口
const colorMode = useColorMode()
watch(() => colorMode.value, () => {
  if (markerManager.value) {
    markerManager.value.updateDarkMode()
  }
})

// 监听用户位置变化
watch(() => props.userPosition, (newPosition) => {
  if (markerManager.value) {
    if (newPosition) {
      markerManager.value.addUserLocationMarker(newPosition)
      // 更新范围圆圈
      if (props.searchRange) {
        markerManager.value.updateRangeCircle(newPosition, props.searchRange, props.showRangeCircle)
      }
    }
    else {
      markerManager.value.removeUserLocationMarker()
      markerManager.value.removeRangeCircle()
    }
  }
}, { immediate: true })

// 监听搜索范围变化
watch(() => props.searchRange, (newRange) => {
  if (props.userPosition && newRange && markerManager.value) {
    markerManager.value.updateRangeCircle(props.userPosition, newRange, props.showRangeCircle)
  }
})

// 监听范围圆圈显示状态变化
watch(() => props.showRangeCircle, (show) => {
  if (markerManager.value) {
    if (!show) {
      markerManager.value.removeRangeCircle()
    }
    else if (props.userPosition && props.searchRange) {
      markerManager.value.updateRangeCircle(props.userPosition, props.searchRange, show)
    }
  }
})

// 组件挂载后初始化地图
onMounted(() => {
  // 确保高德地图 API 已加载
  const checkAMapLoaded = () => {
    if (window.AMap) {
      initMap()
      // 地图初始化后强制调整大小
      nextTick(() => {
        if (map.value) {
          // 获取容器尺寸
          const container = document.getElementById('amap-container')
          if (container) {
            // 设置地图尺寸

            // 强制设置地图尺寸
            setTimeout(() => {
              if (map.value) {
                // 使用正确的高德地图API方法
                map.value.getSize()
                map.value.resize()

                // 再次强制触发地图重绘
                setTimeout(() => {
                  if (map.value) {
                    map.value.resize()
                  }
                }, 100)
              }
            }, 300)
          }
        }
      })
    }
    else {
      setTimeout(checkAMapLoaded, 100)
    }
  }

  checkAMapLoaded()

  // 监听窗口大小变化
  const handleResize = () => {
    if (map.value) {
      setTimeout(() => {
        map.value.resize()
      }, 100)
    }
  }

  // 监听键盘事件，ESC键关闭信息窗口
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && infoWindow.value && markerManager.value?.currentInfoWindow?.value) {
      infoWindow.value.close()
    }
  }

  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeyDown)

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('keydown', handleKeyDown)
    if (markerManager.value) {
      markerManager.value.destroy()
    }
    if (map.value) {
      map.value.destroy()
    }
  })
})

// 暴露方法给父组件
defineExpose({
  panToPosition,
  resetView,
  setMapStyleFromPageMode,
})
</script>

<template>
  <div class="map-container">
    <div
      ref="mapContainer"
      class="map-wrapper"
      :class="{ 'map-loading': isLoading }"
    >
      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner">
          <div class="spinner" />
          <p>正在加载地图...</p>
        </div>
      </div>

      <!-- 地图容器 -->
      <div id="amap-container" class="amap-container" />
    </div>

    <!-- 地图控制面板 -->
    <MapControls
      :developer-mode="developerMode"
      :show-developer-button="showDeveloperButton"
      @reset-view="resetView"
      @toggle-dark-mode="emit('toggleDarkMode')"
      @toggle-developer="emit('toggleDeveloper')"
      @edit-user-info="emit('editUserInfo')"
      @show-ranking="emit('showRanking')"
      @show-coordinate-calibration="emit('showCoordinateCalibration')"
      @show-audit="emit('showAudit')"
      @show-easter-egg="emit('showEasterEgg')"
      @show-checkin-map="emit('showCheckinMap')"
    />
  </div>
</template>

<style scoped>
.map-container {
  position: relative;
  width: 100% !important;
  height: 100% !important;
  min-height: 100vh !important;
  margin: 0;
  padding: 0;
  border-radius: 0;
  overflow: hidden;
  box-shadow: none;
}

.map-wrapper {
  width: 100% !important;
  height: 100% !important;
  min-height: 100vh !important;
  position: relative;
  margin: 0;
  padding: 0;
}

.amap-container {
  width: 100% !important;
  height: 100% !important;
  min-width: 100vw !important;
  min-height: 100vh !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* 确保高德地图内部元素也有正确尺寸 */
.amap-container :deep(.amap-maps) {
  width: 100% !important;
  height: 100% !important;
}

.amap-container :deep(.amap-layers) {
  width: 100% !important;
  height: 100% !important;
}

.amap-container :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .map-container {
    height: 400px;
    border-radius: 8px;
  }
}

/* 现代化信息窗口样式 */
:global(.modern-info-window) {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  border-radius: 16px;
  overflow: hidden;
  min-width: 320px;
  max-width: 380px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.15),
    0 8px 16px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  position: relative;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 浅色主题 */
:global(.modern-info-window.light-theme) {
  background: rgb(255, 255, 255);
  color: #1f2937;
}

/* 深色主题 */
:global(.modern-info-window.dark-theme) {
  background: rgb(31, 41, 55);
  color: #f9fafb;
  border-color: rgba(255, 255, 255, 0.1);
}

/* 头部样式 */
:global(.modern-info-window .info-header) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

:global(.modern-info-window.dark-theme .info-header) {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
}

:global(.modern-info-window .info-header::before) {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
  pointer-events: none;
}

:global(.modern-info-window .header-content) {
  padding: 20px;
  padding-right: 60px; /* 为关闭按钮留出空间 */
  position: relative;
  z-index: 1;
}

:global(.light-theme .description) {
  margin: 0 0 16px 0;
  color: #666;
  line-height: 1.5;
  font-size: 14px;
}

:global(.dark-theme .description) {
  margin: 0 0 16px 0;
  color: #ccc;
  line-height: 1.5;
  font-size: 14px;
}

/* 参考照片样式 */
:global(.reference-photo) {
  margin: 0 0 16px 0;
}

:global(.reference-photo .photo-header) {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
}

:global(.light-theme .reference-photo .photo-header) {
  color: #495057;
}

:global(.dark-theme .reference-photo .photo-header) {
  color: #adb5bd;
}

:global(.reference-photo .photo-icon) {
  font-size: 16px;
}

:global(.reference-photo .reference-image) {
  width: 100%;
  max-width: 200px;
  height: 120px;
  border-radius: 6px;
  border: 1px solid #e9ecef;
  object-fit: cover;
  cursor: pointer;
  transition: all 0.2s ease;
  display: block;
}

:global(.reference-photo .reference-image:hover) {
  transform: scale(1.02);
  opacity: 0.9;
}

:global(.dark-theme .reference-photo .reference-image) {
  border-color: #495057;
}

:global(.info-item) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
}

:global(.info-item .label) {
  font-weight: 500;
  min-width: 80px;
}

:global(.light-theme .info-item .label) {
  color: #495057;
}

:global(.dark-theme .info-item .label) {
  color: #adb5bd;
}

:global(.info-item .value) {
  font-weight: 400;
  text-align: right;
}

:global(.light-theme .info-item .value) {
  color: #333;
}

:global(.dark-theme .info-item .value) {
  color: #e5e5e5;
}

:global(.info-scores) {
  margin-top: 16px;
}

:global(.score-section) {
  margin-bottom: 16px;
}

:global(.score-title) {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 2px solid;
}

:global(.light-theme .score-title) {
  color: #495057;
  border-bottom-color: #e9ecef;
}

:global(.dark-theme .score-title) {
  color: #adb5bd;
  border-bottom-color: #495057;
}

/* 特殊值样式 */
:global(.value.distance) {
  color: #007bff;
  font-weight: 600;
}

:global(.value.distance-score) {
  color: #28a745;
  font-weight: 600;
}

:global(.value.rating) {
  color: #ffc107;
  font-weight: 600;
}

:global(.value.total-score) {
  color: #dc3545;
  font-weight: 600;
}

/* 操作按钮样式 */
:global(.info-actions) {
  margin-top: 16px;
  padding-top: 12px;
  display: flex;
  gap: 8px;
}

:global(.light-theme .info-actions) {
  border-top: 1px solid #eee;
}

:global(.dark-theme .info-actions) {
  border-top: 1px solid #495057;
}

:global(.edit-btn) {
  flex: 1;
  padding: 8px 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

:global(.edit-btn:hover) {
  background: #0056b3;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
}

:global(.delete-btn) {
  flex: 1;
  padding: 8px 12px;
  background: #ff4757;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

:global(.delete-btn:hover) {
  background: #ff3742;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3);
}

/* 新的现代化样式继续 */
:global(.modern-info-window .poi-title) {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

:global(.modern-info-window .category-icon) {
  font-size: 24px;
  flex-shrink: 0;
}

:global(.modern-info-window .poi-title h3) {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: white;
  line-height: 1.2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.modern-info-window .checkin-badge) {
  background: rgba(34, 197, 94, 0.9);
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

:global(.modern-info-window .close-btn) {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  z-index: 10;
}

:global(.modern-info-window .close-btn:hover) {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

:global(.modern-info-window .category-tag) {
  position: absolute;
  bottom: 0;
  left: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: white;
  text-align: center;
  border-radius: 8px 8px 0 0;
}

:global(.modern-info-window .info-body) {
  padding: 20px;
}

:global(.modern-info-window .description) {
  margin: 0 0 20px 0;
  padding: 16px;
  background: rgba(59, 130, 246, 0.05);
  border-left: 4px solid #3b82f6;
  border-radius: 0 8px 8px 0;
  font-size: 14px;
  line-height: 1.6;
  color: #4b5563;
}

:global(.modern-info-window.dark-theme .description) {
  background: rgba(59, 130, 246, 0.1);
  color: #d1d5db;
}

:global(.modern-info-window .info-grid) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

:global(.modern-info-window .info-card) {
  background: rgba(249, 250, 251, 0.8);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(229, 231, 235, 0.8);
  transition: all 0.2s ease;
}

:global(.modern-info-window.dark-theme .info-card) {
  background: rgba(55, 65, 81, 0.8);
  border-color: rgba(75, 85, 99, 0.8);
}

:global(.modern-info-window .info-card:hover) {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

:global(.modern-info-window .card-header) {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

:global(.modern-info-window .card-icon) {
  font-size: 16px;
}

:global(.modern-info-window .card-title) {
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

:global(.modern-info-window.dark-theme .card-title) {
  color: #9ca3af;
}

:global(.modern-info-window .card-content) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:global(.modern-info-window .metric) {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

:global(.modern-info-window .metric-label) {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

:global(.modern-info-window.dark-theme .metric-label) {
  color: #9ca3af;
}

:global(.modern-info-window .metric-value) {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

:global(.modern-info-window.dark-theme .metric-value) {
  color: #f9fafb;
}

:global(.modern-info-window .total-score-metric .metric-value) {
  color: #059669;
  font-size: 16px;
  font-weight: 700;
}

:global(.modern-info-window.dark-theme .total-score-metric .metric-value) {
  color: #10b981;
}

:global(.modern-info-window .info-actions) {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

:global(.modern-info-window .edit-btn, .modern-info-window .delete-btn) {
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

:global(.modern-info-window .edit-btn) {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
}

:global(.modern-info-window .edit-btn:hover) {
  background: linear-gradient(135deg, #1d4ed8, #1e40af);
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(59, 130, 246, 0.4);
}

:global(.modern-info-window .delete-btn) {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
  box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
}

:global(.modern-info-window .delete-btn:hover) {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(239, 68, 68, 0.4);
}

:global(.modern-info-window .btn-icon) {
  font-size: 16px;
}

:global(.modern-info-window .btn-text) {
  font-size: 13px;
}

/* 移动端现代化信息窗体优化 */
@media (max-width: 768px) {
  :global(.modern-info-window) {
    min-width: 280px;
    max-width: 320px;
    margin: 10px;
  }

  :global(.modern-info-window .header-content) {
    padding: 16px;
  }

  :global(.modern-info-window .poi-title h3) {
    font-size: 18px;
  }

  :global(.modern-info-window .category-icon) {
    font-size: 20px;
  }

  :global(.modern-info-window .info-body) {
    padding: 16px;
  }

  :global(.modern-info-window .info-grid) {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  :global(.modern-info-window .info-card) {
    padding: 12px;
  }

  :global(.modern-info-window .card-title) {
    font-size: 12px;
  }

  :global(.modern-info-window .metric-label) {
    font-size: 12px;
  }

  :global(.modern-info-window .metric-value) {
    font-size: 13px;
  }

  :global(.modern-info-window .total-score-metric .metric-value) {
    font-size: 15px;
  }

  :global(.modern-info-window .edit-btn, .modern-info-window .delete-btn) {
    padding: 10px 12px;
    font-size: 13px;
  }
}
</style>
