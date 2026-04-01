<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

interface DanmakuItem {
  id: string
  employeeId: string
  employeeName?: string
  poiName: string
  timestamp: number
  top: number
  duration: number
  delay: number
  zIndex: number
}

interface Props {
  checkinRecords: Array<{
    id: string
    employeeId: string
    employeeName?: string
    poiName: string
    timestamp: number
  }>
  enabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  enabled: true,
})

const visibleDanmakus = ref<DanmakuItem[]>([])
const usedPositions = new Set<number>()
const danmakuQueue = ref<DanmakuItem[]>([])
const playedRecords = new Set<string>() // 记录已播放的打卡记录ID

// 弹幕配置
const CONFIG = {
  maxVisible: 5, // 最大同时显示的弹幕数
  minInterval: 2000, // 最小间隔时间(ms)
  duration: 15, // 动画持续时间(s) - 增加到15秒
  speed: 1, // 滚动速度倍数
  topRange: { min: 40, max: 90 }, // 垂直位置范围(百分比) - 距离屏幕顶部40%-90%
  zIndexRange: { min: 1000, max: 1010 }, // z-index范围
  minSpacing: 8, // 最小间距(百分比)
}

// 格式化时间显示
function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) { // 1分钟内
    return '刚刚'
  }
  else if (diff < 3600000) { // 1小时内
    const minutes = Math.floor(diff / 60000)
    return `${minutes}分钟前`
  }
  else if (diff < 86400000) { // 24小时内
    const hours = Math.floor(diff / 3600000)
    return `${hours}小时前`
  }
  else {
    const days = Math.floor(diff / 86400000)
    return `${days}天前`
  }
}

// 生成随机位置，避免重叠
function generatePosition(): number {
  const { min, max } = CONFIG.topRange
  const range = max - min
  let attempts = 0
  const maxAttempts = 50

  while (attempts < maxAttempts) {
    // 在40%-90%范围内生成随机位置（百分比）
    const position = Math.floor(Math.random() * range) + min
    const isOverlapping = Array.from(usedPositions).some(usedPos =>
      usedPos !== undefined && Math.abs(usedPos - position) < CONFIG.minSpacing, // 使用配置的最小间距
    )

    if (!isOverlapping) {
      usedPositions.add(position)
      return position
    }

    attempts++
  }

  // 如果无法找到不重叠的位置，清理一些旧位置并重试
  if (usedPositions.size > 2) {
    const positionsArray = Array.from(usedPositions)
    const toRemove = positionsArray[Math.floor(Math.random() * positionsArray.length)]
    if (toRemove !== undefined) {
      usedPositions.delete(toRemove)
    }

    // 再次尝试
    const newPosition = Math.floor(Math.random() * range) + min
    const stillOverlapping = Array.from(usedPositions).some(usedPos =>
      usedPos !== undefined && Math.abs(usedPos - newPosition) < CONFIG.minSpacing,
    )

    if (!stillOverlapping) {
      usedPositions.add(newPosition)
      return newPosition
    }
  }

  // 最后返回随机位置（在40%-90%范围内）
  return Math.floor(Math.random() * range) + min
}

// 创建弹幕项
function createDanmakuItem(record: any): DanmakuItem {
  const top = generatePosition()
  const duration = CONFIG.duration + Math.random() * 5 // 15-20秒
  const delay = Math.random() * 3 // 0-3秒延迟

  return {
    id: `danmaku_${record.id}_${Date.now()}`,
    employeeId: record.employeeId,
    employeeName: record.employeeName,
    poiName: record.poiName,
    timestamp: record.timestamp,
    top,
    duration,
    delay,
    zIndex: Math.floor(Math.random() * (CONFIG.zIndexRange.max - CONFIG.zIndexRange.min)) + CONFIG.zIndexRange.min,
  }
}

// 添加弹幕到队列
function addDanmakuToQueue(record: any) {
  const danmaku = createDanmakuItem(record)
  danmakuQueue.value.push(danmaku)

  // 如果当前显示的弹幕数量未达到上限，立即显示
  if (visibleDanmakus.value.length < CONFIG.maxVisible) {
    showNextDanmaku()
  }
}

// 显示下一个弹幕
function showNextDanmaku() {
  if (danmakuQueue.value.length === 0)
    return

  const danmaku = danmakuQueue.value.shift()!
  visibleDanmakus.value.push(danmaku)

  // 设置弹幕完成后的清理
  setTimeout(() => {
    removeDanmaku(danmaku.id)
  }, (danmaku.duration + danmaku.delay) * 1000)
}

// 移除弹幕
function removeDanmaku(id: string) {
  const index = visibleDanmakus.value.findIndex(d => d.id === id)
  if (index > -1) {
    const danmaku = visibleDanmakus.value[index]
    if (danmaku) {
      usedPositions.delete(danmaku.top)
      visibleDanmakus.value.splice(index, 1)
    }

    // 显示队列中的下一个弹幕
    if (danmakuQueue.value.length > 0) {
      setTimeout(() => {
        showNextDanmaku()
      }, 500) // 短暂延迟避免过于密集
    }
  }
}

// 处理新的打卡记录
function processNewRecords(records: any[]) {
  if (!props.enabled || records.length === 0)
    return

  // 获取最近10条记录，过滤掉已播放的记录
  const recentRecords = records
    .filter(record => !playedRecords.has(record.id)) // 过滤已播放的记录
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)

  // 为每条记录创建弹幕，增加间隔时间避免重叠
  recentRecords.forEach((record, index) => {
    // 标记为已播放
    playedRecords.add(record.id)

    setTimeout(() => {
      addDanmakuToQueue(record)
    }, index * (CONFIG.minInterval + Math.random() * 500)) // 增加随机延迟
  })
}

// 监听打卡记录变化
watch(() => props.checkinRecords, (newRecords) => {
  if (newRecords && newRecords.length > 0) {
    processNewRecords(newRecords)
  }
}, { immediate: true })

// 组件卸载时清理
onBeforeUnmount(() => {
  visibleDanmakus.value = []
  danmakuQueue.value = []
  usedPositions.clear()
  playedRecords.clear()
})
</script>

<template>
  <div class="danmaku-container">
    <div
      v-for="danmaku in visibleDanmakus"
      :key="danmaku.id"
      class="danmaku-item"
      :style="{
        top: `${danmaku.top}%`,
        animationDuration: `${danmaku.duration}s`,
        animationDelay: `${danmaku.delay}s`,
        zIndex: danmaku.zIndex,
      }"
    >
      <div class="danmaku-content">
        <span class="danmaku-user">{{ danmaku.employeeName }}({{ danmaku.employeeId }})</span>
        <span class="danmaku-time">{{ formatTime(danmaku.timestamp) }}</span>
        <span class="danmaku-location">在{{ danmaku.poiName }}打卡了</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.danmaku-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
  overflow: hidden;
}

.danmaku-item {
  position: absolute;
  right: -100%;
  white-space: nowrap;
  pointer-events: none;
  animation: danmaku-scroll-right-to-left linear forwards;
}

.danmaku-content {
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  gap: 8px;
}

.danmaku-user {
  color: #4ade80;
  font-weight: 600;
}

.danmaku-time {
  color: #94a3b8;
  font-size: 14px;
}

.danmaku-location {
  color: #fbbf24;
  font-weight: 500;
}

@keyframes danmaku-scroll-right-to-left {
  0% {
    right: -100%;
    opacity: 0;
  }
  5% {
    opacity: 1;
  }
  95% {
    opacity: 1;
  }
  100% {
    right: 100%;
    opacity: 0;
  }
}

/* 深色模式适配 */
.dark .danmaku-content {
  background: rgba(255, 255, 255, 0.8);
  color: #1f2937;
}

.dark .danmaku-user {
  color: #059669;
}

.dark .danmaku-time {
  color: #6b7280;
}

.dark .danmaku-location {
  color: #d97706;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .danmaku-content {
    font-size: 12px;
    padding: 6px 12px;
  }

  .danmaku-time {
    font-size: 12px;
  }
}
</style>
