<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { mapConfig } from '~/config/map'

interface Props {
  visible: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 地图相关
const mapContainer = ref<HTMLElement>()
const map = ref<any>()
const isMapLoading = ref(true)
const markers = ref<any[]>([])

// 打卡记录数据
const checkinRecords = ref<any[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// 地图样式配置
const mapStyles = {
  normal: 'amap://styles/normal',
  dark: 'amap://styles/dark',
}

// 获取所有打卡记录
async function fetchAllCheckinRecords() {
  if (loading.value)
    return

  loading.value = true
  error.value = null

  try {
    const response = await $fetch('/api/checkin')

    if (response.success && response.data) {
      checkinRecords.value = response.data.map((record: any) => ({
        id: record.id,
        employeeId: record.employee_id,
        employeeName: record.employee_name,
        poiId: record.poi_id,
        poiName: record.poi_name,
        comment: record.comment || '',
        rating: record.rating || 0,
        photoUrl: record.photo_url,
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
    }
    else {
      throw new Error('获取打卡记录失败')
    }
  }
  catch (err: any) {
    console.error('获取打卡记录失败:', err)
    error.value = err.message || '网络错误，请稍后重试'
    checkinRecords.value = []
  }
  finally {
    loading.value = false
  }
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
  map.value = new window.AMap.Map('checkin-map-container', {
    center: mapConfig.center,
    zoom: mapConfig.zoom - 1, // 稍微缩小一点，能看到更多区域
    mapStyle: mapStyles.normal,
    viewMode: '2D',
    features: ['bg', 'road', 'building', 'point'],
    resizeEnable: true,
  })

  // 添加地图控件
  map.value.addControl(new window.AMap.Scale())
  map.value.addControl(new window.AMap.ToolBar({
    locate: false,
    position: 'LT',
  }))

  // 检测深色模式
  const htmlElement = document.documentElement
  const pageIsDark = htmlElement.classList.contains('dark')
  if (pageIsDark) {
    map.value.setMapStyle(mapStyles.dark)
  }

  isMapLoading.value = false
}

// 在地图上添加打卡点标记
function addCheckinsToMap() {
  if (!map.value || checkinRecords.value.length === 0)
    return

  // 清除旧标记
  markers.value.forEach(marker => marker.setMap(null))
  markers.value = []

  // 创建标记
  checkinRecords.value.forEach((record) => {
    // 跳过审核不通过的记录
    if (record.isRejected)
      return

    const position = [record.coordinates.lng, record.coordinates.lat]

    // 创建一个小圆点标记
    const marker = new window.AMap.CircleMarker({
      center: position,
      radius: 6, // 小圆点半径
      fillColor: '#3b82f6', // 蓝色填充
      fillOpacity: 0.8,
      strokeColor: '#ffffff',
      strokeWeight: 1,
      strokeOpacity: 1,
      zIndex: 100,
      cursor: 'pointer',
    })

    // 创建信息窗口
    const infoWindow = new window.AMap.InfoWindow({
      isCustom: false,
      content: createInfoWindowContent(record),
      offset: new window.AMap.Pixel(0, -10),
    })

    // 点击标记显示信息窗口
    marker.on('click', () => {
      infoWindow.open(map.value, position)
    })

    // 鼠标悬停效果
    marker.on('mouseover', () => {
      marker.setOptions({
        radius: 8,
        fillOpacity: 1,
      })
    })

    marker.on('mouseout', () => {
      marker.setOptions({
        radius: 6,
        fillOpacity: 0.8,
      })
    })

    marker.setMap(map.value)
    markers.value.push(marker)
  })

  // 调整地图视野以显示所有标记
  if (markers.value.length > 0) {
    map.value.setFitView(markers.value, false, [50, 50, 50, 50])
  }
}

// 创建信息窗口内容
function createInfoWindowContent(record: any): string {
  const time = new Date(record.timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  // 优先显示姓名，如果有姓名则在括号中显示工号
  const userDisplay = record.employeeName 
    ? `${record.employeeName} (${record.employeeId})`
    : record.employeeId

  return `
    <div style="padding: 12px; min-width: 200px;">
      <div style="font-size: 15px; font-weight: 600; color: #333; margin-bottom: 8px;">
        ${record.poiName}
      </div>
      <div style="font-size: 13px; color: #666; margin-bottom: 4px;">
        👤 ${userDisplay}
      </div>
      <div style="font-size: 12px; color: #999; margin-bottom: 4px;">
        🕐 ${time}
      </div>
      ${record.distance ? `<div style="font-size: 12px; color: #999;">📍 距离POI ${record.distance}米</div>` : ''}
      ${record.comment ? `<div style="font-size: 12px; color: #666; margin-top: 6px; padding-top: 6px; border-top: 1px solid #eee;">${record.comment}</div>` : ''}
    </div>
  `
}

// 关闭弹窗
function onClose() {
  emit('close')
}

// 监听弹窗显示状态
watch(() => props.visible, (visible) => {
  if (visible) {
    document.body.style.overflow = 'hidden'
    
    // 获取打卡记录
    fetchAllCheckinRecords()
    
    // 初始化地图（延迟一下确保DOM已渲染）
    setTimeout(() => {
      if (!map.value) {
        initMap()
      }
      else {
        // 如果地图已存在，重新调整大小
        map.value.resize()
      }
    }, 100)
  }
  else {
    document.body.style.overflow = ''
  }
})

// 监听打卡记录变化，更新地图标记
watch(() => checkinRecords.value, () => {
  if (map.value && !isMapLoading.value) {
    addCheckinsToMap()
  }
}, { deep: true })

// 组件卸载时清理
onBeforeUnmount(() => {
  document.body.style.overflow = ''
  
  // 清除标记
  markers.value.forEach(marker => marker.setMap(null))
  markers.value = []
  
  // 销毁地图
  if (map.value) {
    map.value.destroy()
    map.value = null
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="checkin-map-modal-overlay" @click="onClose">
      <div class="checkin-map-modal" @click.stop>
        <div class="modal-header">
          <h3>🗺️ 全员打卡地图</h3>
          <button class="close-btn" @click="onClose">
            ×
          </button>
        </div>

        <div class="modal-body">
          <!-- 统计信息 -->
          <div v-if="!loading && !error" class="stats-bar">
            <div class="stat-item">
              <span class="stat-icon">📍</span>
              <span class="stat-label">打卡总数</span>
              <span class="stat-value">{{ checkinRecords.length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">👥</span>
              <span class="stat-label">打卡人数</span>
              <span class="stat-value">{{ new Set(checkinRecords.map(r => r.employeeId)).size }}</span>
            </div>
          </div>

          <!-- 加载状态 -->
          <div v-if="loading" class="loading-state">
            <div class="loading-spinner" />
            <div class="loading-text">
              正在加载打卡记录...
            </div>
          </div>

          <!-- 错误状态 -->
          <div v-else-if="error" class="error-state">
            <div class="error-icon">
              ⚠️
            </div>
            <div class="error-text">
              {{ error }}
            </div>
            <button class="retry-btn" @click="fetchAllCheckinRecords">
              🔄 重试
            </button>
          </div>

          <!-- 空状态 -->
          <div v-else-if="checkinRecords.length === 0" class="empty-state">
            <div class="empty-icon">
              📍
            </div>
            <div class="empty-text">
              暂无打卡记录
            </div>
          </div>

          <!-- 地图容器 -->
          <div class="map-wrapper">
            <div
              id="checkin-map-container"
              class="checkin-map-container"
            />
            
            <!-- 地图加载状态 -->
            <div v-if="isMapLoading" class="map-loading-overlay">
              <div class="loading-spinner" />
              <p>正在加载地图...</p>
            </div>

            <!-- 图例 -->
            <div v-if="!loading && !error && checkinRecords.length > 0" class="map-legend">
              <div class="legend-item">
                <span class="legend-dot" />
                <span class="legend-text">打卡位置</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* 弹窗遮罩 */
.checkin-map-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

/* 弹窗主体 */
.checkin-map-modal {
  background: white;
  border-radius: 12px;
  max-width: 1000px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

/* 弹窗头部 */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 16px;
  border-bottom: 1px solid var(--gray-border, #e9ecef);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary, #666);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--gray-light, #f8f9fa);
  color: var(--text-primary, #333);
}

/* 弹窗内容 */
.modal-body {
  padding: 20px 24px 24px;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 统计条 */
.stats-bar {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.stat-icon {
  font-size: 18px;
}

.stat-label {
  color: #6c757d;
}

.stat-value {
  font-weight: 600;
  color: #007bff;
  font-size: 16px;
}

/* 地图包装器 */
.map-wrapper {
  flex: 1;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  min-height: 500px;
}

/* 地图容器 */
.checkin-map-container {
  width: 100%;
  height: 100%;
  min-height: 500px;
}

/* 地图加载状态 */
.map-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.map-loading-overlay p {
  margin-top: 16px;
  color: #666;
  font-size: 14px;
}

/* 图例 */
.map-legend {
  position: absolute;
  bottom: 16px;
  left: 16px;
  background: white;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #495057;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #3b82f6;
  border: 2px solid white;
  box-shadow: 0 0 0 1px #3b82f6;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 16px;
  color: #666;
  font-size: 14px;
}

/* 错误状态 */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-text {
  font-size: 16px;
  color: #dc3545;
  margin-bottom: 16px;
}

.retry-btn {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.retry-btn:hover {
  background: #0056b3;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  color: #6c757d;
}

/* 深色模式 */
.dark .checkin-map-modal {
  background: #1f2937;
  color: #f9fafb;
}

.dark .modal-header {
  border-bottom-color: #374151;
}

.dark .modal-header h3 {
  color: #f9fafb;
}

.dark .close-btn {
  color: #9ca3af;
}

.dark .close-btn:hover {
  background: #374151;
  color: #f9fafb;
}

.dark .stats-bar {
  background: #374151;
}

.dark .stat-label {
  color: #9ca3af;
}

.dark .stat-value {
  color: #60a5fa;
}

.dark .map-legend {
  background: #1f2937;
  color: #f9fafb;
  border: 1px solid #374151;
}

.dark .legend-item {
  color: #d1d5db;
}

.dark .map-loading-overlay {
  background: rgba(31, 41, 55, 0.9);
}

.dark .map-loading-overlay p {
  color: #9ca3af;
}

.dark .loading-spinner {
  border-color: #374151;
  border-top-color: #3b82f6;
}

.dark .loading-text {
  color: #9ca3af;
}

.dark .empty-text {
  color: #9ca3af;
}

.dark .error-text {
  color: #ef4444;
}

.dark .retry-btn {
  background: #3b82f6;
}

.dark .retry-btn:hover {
  background: #2563eb;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .checkin-map-modal-overlay {
    padding: 12px;
  }

  .checkin-map-modal {
    max-height: 95vh;
  }

  .modal-header {
    padding: 20px 20px 16px;
  }

  .modal-header h3 {
    font-size: 16px;
  }

  .modal-body {
    padding: 16px 20px 20px;
  }

  .stats-bar {
    flex-direction: column;
    gap: 12px;
  }

  .map-wrapper {
    min-height: 400px;
  }

  .checkin-map-container {
    min-height: 400px;
  }

  .map-legend {
    bottom: 12px;
    left: 12px;
    padding: 8px 12px;
  }
}

/* 小屏幕优化 */
@media (max-width: 480px) {
  .checkin-map-modal-overlay {
    padding: 8px;
  }

  .modal-header {
    padding: 16px 16px 12px;
  }

  .modal-body {
    padding: 12px 16px 16px;
  }

  .map-wrapper {
    min-height: 350px;
  }

  .checkin-map-container {
    min-height: 350px;
  }
}
</style>

