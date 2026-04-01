<script setup lang="ts">
import type { POIData } from '~/types/amap'
import { onMounted, ref } from 'vue'

interface Props {
  pois: POIData[]
  developerMode: boolean
  loading?: boolean
  filters?: {
    category: string
    search: string
    sortBy: string
    sortOrder: string
    checkinStatus: string
  }
  onPOIClick?: (poi: POIData) => void
  isPOICheckedIn?: (poiId: string) => boolean
  getPersonalCheckinCount?: (poiId: string) => number
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  onPOIClick: () => {},
})

// 深圳中心点坐标

// 定义事件
const emit = defineEmits<{
  beforeToggle: []
  filtersUpdate: [filters: any]
}>() // POI打卡统计数据
const poiStats = ref<Record<string, { checkinCount: number, uniqueUsers: number }>>({})

// 获取POI统计数据
const lastStatsFetchTime = ref<number>(0)
const STATS_FETCH_COOLDOWN = 2000 // 2秒冷却时间

async function fetchPOIStats(force = false) {
  // 防止频繁请求
  const now = Date.now()
  if (!force && now - lastStatsFetchTime.value < STATS_FETCH_COOLDOWN) {
    console.warn('POI统计数据请求过于频繁，跳过本次请求')
    return
  }

  try {
    lastStatsFetchTime.value = now
    const response = await $fetch('/api/pois/stats')
    if (response.success) {
      const statsMap: Record<string, { checkinCount: number, uniqueUsers: number }> = {}
      response.data.forEach((stat: any) => {
        statsMap[stat.poiId] = {
          checkinCount: stat.checkinCount,
          uniqueUsers: stat.uniqueUsers,
        }
      })
      poiStats.value = statsMap
    }
  }
  catch (error) {
    console.error('获取POI统计失败:', error)
  }
}

// 获取POI打卡人数
function getPOICheckinUsers(poiId: string): number {
  return poiStats.value[poiId]?.uniqueUsers || 0
}

// 组件挂载时获取统计数据
onMounted(() => {
  fetchPOIStats()
})

// POI列表管理
const {
  showPOIList,
  filters,
  filteredPOIs,
  togglePOIList,
  setCategory,
  setSearchText,
  setSorting,
  setCheckinStatus,
  clearFilters,
  formatDistance,
} = usePOIList(toRef(props, 'pois'), undefined, props.isPOICheckedIn)

// 同步外部筛选条件
watch(() => props.filters, (newFilters) => {
  if (newFilters && props.filters) {
    // 更新内部筛选状态以反映外部变化
    if (newFilters.category !== filters.value.category) {
      setCategory(newFilters.category)
    }
    if (newFilters.search !== filters.value.search) {
      setSearchText(newFilters.search)
    }
    if (newFilters.sortBy !== filters.value.sortBy || newFilters.sortOrder !== filters.value.sortOrder) {
      setSorting(newFilters.sortBy as any, newFilters.sortOrder as any)
    }
    if (newFilters.checkinStatus !== filters.value.checkinStatus) {
      setCheckinStatus(newFilters.checkinStatus as any)
    }
  }
}, { deep: true, immediate: true })

// 监听内部筛选变化并同步到外部
watch(filters, (newFilters) => {
  emit('filtersUpdate', newFilters)
}, { deep: true })// 对外暴露显示状态和刷新方法，用于父组件的互斥逻辑和数据刷新
defineExpose({
  showPOIList,
  togglePOIList,
  fetchPOIStats, // 暴露统计数据刷新方法
})

// 包装的切换函数，发出事件
function handleToggle() {
  emit('beforeToggle')
  togglePOIList()
}

// 处理排序变化
function handleSortChange(value: string | number) {
  const [sortBy, sortOrder] = (value as string).split('-')
  setSorting(sortBy as any, sortOrder as any)
}

// 处理POI点击
function handlePOIClick(poi: POIData) {
  props.onPOIClick?.(poi)
}
</script>

<template>
  <div
    class="poi-list-panel"
    :class="{
      'active': showPOIList,
      'developer-active': developerMode,
    }"
  >
    <!-- 列表切换按钮 -->
    <button
      class="poi-list-toggle"
      :class="{ active: showPOIList }"
      @click="handleToggle"
    >
      <span class="toggle-icon">📍</span>
      <span>POI列表</span>
      <span class="toggle-icon">{{ showPOIList ? '▼' : '▲' }}</span>
    </button>

    <!-- 列表内容 -->
    <div
      v-if="showPOIList"
      class="poi-list-content"
      :class="{ 'developer-active': developerMode }"
    >
      <!-- 筛选控件 -->
      <div class="poi-filters">
        <!-- 搜索框行 -->
        <div class="filter-row search-row">
          <input
            type="text"
            class="search-input"
            placeholder="搜索POI名称或描述..."
            :value="filters.search"
            @input="setSearchText(($event.target as HTMLInputElement).value)"
          >
          <!-- 未打卡选择框 -->
          <div class="unchecked-filter">
            <label class="checkbox-container">
              <input
                type="checkbox"
                :checked="filters.checkinStatus === 'unchecked'"
                @change="setCheckinStatus($event.target.checked ? 'unchecked' : 'all')"
              >
              <span class="checkmark" />
              <span class="checkbox-label">未打卡</span>
            </label>
          </div>
        </div>

        <!-- 控制按钮行 -->
        <div class="filter-row controls-row">
          <!-- 分类筛选 -->
          <div class="filter-group">
            <BaseSelect
              :model-value="filters.category"
              :options="[
                { label: '全部分类', value: 'all' },
                { label: '景点', value: '景点' },
                { label: '公园', value: '公园' },
                { label: '山脉', value: '山脉' },
              ]"
              variant="filter"
              size="small"
              @change="(value: string | number) => setCategory(value as string)"
            />
          </div>

          <!-- 排序控件 -->
          <div class="filter-group">
            <BaseSelect
              :model-value="`${filters.sortBy}-${filters.sortOrder}`"
              :options="[
                { label: '评分 高-低', value: 'totalScore-desc' },
                { label: '评分 低-高', value: 'totalScore-asc' },
                { label: '距离 近-远', value: 'distance-asc' },
                { label: '距离 远-近', value: 'distance-desc' },
                { label: '名称 A-Z', value: 'name-asc' },
                { label: '名称 Z-A', value: 'name-desc' },
                { label: '距离分 高-低', value: 'distanceScore-desc' },
                { label: '距离分 低-高', value: 'distanceScore-asc' },
                { label: '基础分 高-低', value: 'rating-desc' },
                { label: '基础分 低-高', value: 'rating-asc' },
              ]"
              variant="filter"
              size="small"
              @change="handleSortChange"
            />
          </div>

          <!-- 清除筛选 -->
          <button class="clear-filters-btn" @click="clearFilters">
            清除
          </button>
        </div>
      </div>

      <!-- POI列表 -->
      <div class="poi-list">
        <!-- Loading状态 -->
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner">
            <div class="spinner" />
          </div>
          <div class="loading-text">
            正在加载POI数据...
          </div>
        </div>

        <!-- POI列表项 -->
        <div
          v-for="poi in filteredPOIs"
          v-else
          :key="poi.id"
          class="poi-item flex-col gap-0px!"
          @click="handlePOIClick(poi)"
        >
          <div class="flex shrink-0 gap-14px w-full items-start justify-between">
            <!-- 图标 -->
            <div class="poi-icon">
              📍
            </div>

            <!-- 主要信息 -->
            <div class="poi-main-info">
              <div class="poi-name">
                {{ poi.name }}
              </div>
              <!-- 标签行：打卡状态、打卡人数、分类 -->
              <div class="poi-tags-row">
                <!-- 个人打卡标志 -->
                <span v-if="isPOICheckedIn && isPOICheckedIn(poi.id)" class="personal-checkin-badge">
                  ✓ 已打卡
                </span>
                <!-- 打卡人数 -->
                <span v-if="getPOICheckinUsers(poi.id) > 0" class="checkin-count-badge">
                  {{ getPOICheckinUsers(poi.id) }}人打卡
                </span>
                <!-- 分类标签 -->
                <span class="poi-category-tag">
                  {{ poi.category }}
                </span>
              </div>
            </div>

            <!-- 分数徽章 -->
            <div class="poi-score-badge">
              {{ poi.totalScore || 0 }}分
            </div>
          </div>
          <div class="poi-meta">
            <div class="poi-meta-item poi-distance">
              📍 {{ poi.distance ? formatDistance(poi.distance) : '距离未知' }}
            </div>
            <div class="poi-meta-item poi-rating">
              ⭐ {{ poi.rating || 0 }}分 (难度)
            </div>
            <div class="poi-meta-item poi-distance-score">
              📏 {{ poi.distanceScore || 0 }}分 (距离)
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="!loading && filteredPOIs.length === 0" class="empty-state">
          <div class="empty-icon">
            🔍
          </div>
          <div class="empty-text">
            未找到匹配的POI
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.poi-list-panel {
  position: fixed;
  bottom: calc(20px + env(safe-area-inset-bottom));
  left: calc(20px + env(safe-area-inset-left));
  z-index: 1001;
  min-width: 320px;
  max-width: 400px;
  display: flex;
  flex-direction: column;
}

/* 桌面端确保两个面板不重叠 */
@media (min-width: 769px) {
  .poi-list-panel.active.developer-active {
    max-width: calc(50vw - 60px); /* 限制宽度避免与开发者面板重叠 */
  }
}

.poi-list-toggle {
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px; /* 底部圆角 */
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  font-weight: 600;
  color: #333;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  z-index: 2;
}

.poi-list-panel.active .poi-list-toggle {
  border-radius: 0 0 12px 12px; /* 展开时无圆角 */
  box-shadow: none;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  background: #007bff; /* 展开时蓝色背景 */
  color: white; /* 展开时白色文字 */
}

.poi-list-toggle:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.2);
}

.poi-list-panel.active .poi-list-toggle:hover {
  transform: none;
  box-shadow: none;
  background: #0056b3; /* 展开时悬停更深的蓝色 */
  color: white;
}

.poi-list-toggle.active {
  background: #007bff;
  color: white;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}

.toggle-icon {
  font-size: 16px;
}

.poi-list-content {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px 12px 0 0; /* 顶部圆角 */
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  max-height: calc(100vh - 200px - env(safe-area-inset-bottom)); /* 确保有足够空间显示内容 */
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 0.3s ease;
  position: absolute;
  bottom: 100%; /* 定位到按钮上方 */
  left: 0;
  right: 0;
  z-index: 2;
}

.poi-list-panel.active .poi-list-content {
  transform: translateY(0);
}

.poi-filters {
  padding: 16px;
  border-bottom: 1px solid #eee;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-row {
  width: 100%;
  display: flex;
  gap: 12px;
  align-items: center;
}

.controls-row {
  flex-wrap: wrap;
  justify-content: space-between;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  max-width: 150px;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  transition: border-color 0.3s ease;
}

.search-input:focus {
  outline: none;
  border-color: #007bff;
}

.clear-filters-btn {
  padding: 8px 12px;
  border: 1px solid #dc3545;
  background: white;
  color: #dc3545;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.clear-filters-btn:hover {
  background: #dc3545;
  color: white;
}

.poi-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #fafafa;
}

.poi-item {
  display: flex;
  align-items: center;
  padding: 18px 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: white;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
  gap: 14px;
  flex-shrink: 0;
}

.poi-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: #3b82f6;
}

.poi-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.poi-item:hover::before {
  opacity: 1;
}

.poi-icon {
  font-size: 22px;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
  border-radius: 10px;
  border: 1px solid #bae6fd;
  flex-shrink: 0;
}

.poi-main-info {
  flex: 1;
  min-width: 0;
}

.poi-score-badge {
  padding: 6px 10px;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
  min-width: 45px;
  text-align: center;
  flex-shrink: 0;
}

.poi-name {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 6px;
  font-size: 17px;
  line-height: 1.3;
  letter-spacing: -0.025em;
}

/* 标签行 */
.poi-tags-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.poi-category-tag {
  display: inline-flex;
  align-items: center;
  background: #e5e7eb;
  color: #4b5563;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 12px;
}

.checkin-badge {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
  animation: pulse-success 2s infinite;
}

.personal-checkin-badge {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
}

@keyframes pulse-success {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    opacity: 1;
  }
}

.checkin-count-badge {
  background: #e3f2fd;
  color: #1565c0;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
}

/* 未打卡筛选选择框样式 */
.unchecked-filter {
  flex-shrink: 0;
}

.checkbox-container {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  white-space: nowrap;
  user-select: none;
}

.checkbox-container:hover {
  background-color: rgba(0, 123, 255, 0.05);
}

.checkbox-container input[type='checkbox'] {
  display: none;
}

.checkmark {
  width: 16px;
  height: 16px;
  border: 2px solid #d1d5db;
  border-radius: 3px;
  background: white;
  position: relative;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.checkbox-container input[type='checkbox']:checked + .checkmark {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  border-color: #3b82f6;
}

.checkbox-container input[type='checkbox']:checked + .checkmark::after {
  content: '';
  position: absolute;
  top: 1px;
  left: 4px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  transition: color 0.2s ease;
}

.checkbox-container:hover .checkbox-label {
  color: #1f2937;
}

.poi-meta {
  display: flex;
  gap: 12px;
  flex-wrap: no-wrap;
  align-items: center;
}

.poi-meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
}

/* Loading状态样式 */
.loading-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.loading-spinner {
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .poi-list-panel {
    bottom: calc(10px + env(safe-area-inset-bottom));
    left: calc(10px + env(safe-area-inset-left));
    right: calc(10px + env(safe-area-inset-right));
    transform: none;
    min-width: auto;
    max-width: none;
    width: auto;
    z-index: 1002; /* 确保POI列表在开发者面板之上 */
  }

  .poi-list-content {
    max-height: calc(100vh - 150px - env(safe-area-inset-bottom)); /* 移动端确保内容完整显示 */
  }

  .poi-filters {
    padding: 12px;
    gap: 10px;
  }

  .search-input {
    font-size: 16px; /* 防止iOS缩放 */
  }

  .poi-list {
    padding: 10px 12px;
    gap: 6px;
  }

  .poi-item {
    padding: 14px 12px;
    gap: 12px;
  }

  .poi-name {
    font-size: 16px;
    margin-bottom: 4px;
  }

  .poi-icon {
    width: 36px;
    height: 36px;
    font-size: 20px;
  }

  .poi-meta {
    gap: 10px;
  }

  .poi-meta-item {
    font-size: 12px;
    gap: 3px;
  }

  .poi-score-badge {
    padding: 4px 8px;
    font-size: 13px;
    min-width: 40px;
  }

  /* 当开发者模式开启且POI列表打开时，调整POI列表位置避免重叠 */
  .poi-list-panel.active.developer-active {
    bottom: calc(120px + env(safe-area-inset-bottom)); /* 当开发者面板显示时，POI列表上移 */
  }

  .developer-toggle {
    padding: 10px 14px;
    font-size: 14px;
  }

  .developer-controls {
    padding: 12px;
  }

  .position-info {
    padding: 12px;
  }

  .position-details {
    font-size: 11px;
  }
}

/* 深色模式下的POI列表样式 */
.dark .poi-list-toggle {
  background: rgba(45, 45, 45, 0.95);
  color: #fff;
}

.dark .poi-list-panel.active .poi-list-toggle {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: #007bff; /* 深色模式下展开时也是蓝色 */
  color: white;
}

.dark .poi-list-panel.active .poi-list-toggle:hover {
  background: #0056b3; /* 深色模式下展开悬停时更深的蓝色 */
  color: white;
}

.dark .poi-list-toggle:hover {
  background: rgba(45, 45, 45, 1);
}

.dark .poi-list-content {
  background: rgba(45, 45, 45, 0.95);
}

.dark .poi-filters {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.dark .search-input {
  background: #2d2d2d;
  border-color: #404040;
  color: #fff;
}

.dark .search-input:focus {
  border-color: #007bff;
}

.dark .poi-list {
  background: #2d2d2d;
}

.dark .poi-item {
  background: #2d2d2d;
  border: 1px solid #4b5563;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.dark .poi-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  border-color: #60a5fa;
}

.dark .poi-name {
  color: #f9fafb;
}

/* 深色模式下的选择框样式 */
.dark .checkbox-container:hover {
  background-color: rgba(59, 130, 246, 0.1);
}

.dark .checkmark {
  border-color: #6b7280;
  background: #374151;
}

.dark .checkbox-label {
  color: #d1d5db;
}

.dark .checkbox-container:hover .checkbox-label {
  color: #f9fafb;
}

.dark .poi-meta-item {
  color: #d1d5db;
}

.dark .poi-category-tag {
  background: #4b5563;
  color: #d1d5db;
}

.dark .poi-score-badge {
  background: linear-gradient(135deg, #059669, #047857);
  color: #d1fae5;
  box-shadow: 0 2px 8px rgba(5, 150, 105, 0.4);
}

.dark .poi-icon {
  background: linear-gradient(135deg, #1e40af, #3730a3);
  border: 1px solid #60a5fa;
}

.dark .empty-state {
  color: #666;
}

.dark .clear-filters-btn {
  border-color: #dc3545;
  background: #2d2d2d;
  color: #dc3545;
}

.dark .clear-filters-btn:hover {
  background: #dc3545;
  color: white;
}

/* 深色模式下的Loading状态样式 */
.dark .loading-state {
  color: #aaa;
}

.dark .spinner {
  border: 3px solid #404040;
  border-top: 3px solid #007bff;
}

.dark .loading-text {
  color: #aaa;
}

.dark .checkin-count-badge {
  background: #1e3a8a;
  color: #93c5fd;
}

.dark .personal-checkin-badge {
  background: linear-gradient(135deg, #ea580c, #c2410c);
  color: white;
}
</style>
