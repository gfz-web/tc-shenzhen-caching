<script setup lang="ts">
import type { DailyTimeSlot, DateTimeSlot, EasterEgg } from '~/types/amap'
import { computed, ref, watch } from 'vue'

interface Props {
  visible: boolean
}

interface Emits {
  (e: 'close'): void
}

interface EasterEggTimeSlot {
  startHour: number
  endHour: number
  name: string
  icon: string
  bonus: number
  description: string
  poiName?: string
  mode: 'datetime' | 'daily'
  dateTimeRange?: {
    start: string
    end: string
  }
  dailyTimeRange?: {
    start: string
    end: string
  }
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const now = ref(new Date())
const currentHour = computed(() => now.value.getHours())
const currentMinute = computed(() => now.value.getMinutes())
const loading = ref(false)
const easterEggTimeSlots = ref<EasterEggTimeSlot[]>([])

function formatDateTime(datetime: string): string {
  if (!datetime)
    return ''
  const dateObj = new Date(datetime)
  return dateObj.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function fetchEasterEggData() {
  loading.value = true
  try {
    const response = await $fetch('/api/pois')
    if (response.success && response.data) {
      const slots: EasterEggTimeSlot[] = []

      response.data.forEach((poi: any) => {
        if (poi.easter_egg && poi.easter_egg.time_slots) {
          const easterEgg = poi.easter_egg as EasterEgg

          easterEgg.time_slots.forEach((timeSlot) => {
            // 处理每日时间段（DailyTimeSlot）
            if ('start_time' in timeSlot && 'end_time' in timeSlot) {
              const dailySlot = timeSlot as DailyTimeSlot
              const startParts = dailySlot.start_time.split(':')
              const endParts = dailySlot.end_time.split(':')

              const startHour = Number.parseInt(startParts[0] || '0', 10)
              const endHour = Number.parseInt(endParts[0] || '0', 10)

              slots.push({
                startHour,
                endHour,
                name: poi.name,
                icon: easterEgg.icon || '🎁',
                bonus: easterEgg.bonus_score,
                description: easterEgg.description || `在${poi.name}特定时段打卡`,
                poiName: poi.name,
                mode: 'daily',
                dailyTimeRange: {
                  start: dailySlot.start_time,
                  end: dailySlot.end_time,
                },
              })
            }
            // 处理具体日期时间段（DateTimeSlot）
            else if ('start_datetime' in timeSlot && 'end_datetime' in timeSlot) {
              const dateTimeSlot = timeSlot as DateTimeSlot
              const startDate = new Date(dateTimeSlot.start_datetime)
              const endDate = new Date(dateTimeSlot.end_datetime)

              slots.push({
                startHour: startDate.getHours(),
                endHour: endDate.getHours(),
                name: poi.name,
                icon: easterEgg.icon || '🎁',
                bonus: easterEgg.bonus_score,
                description: easterEgg.description || `在${poi.name}特定时段打卡`,
                poiName: poi.name,
                mode: 'datetime',
                dateTimeRange: {
                  start: dateTimeSlot.start_datetime,
                  end: dateTimeSlot.end_datetime,
                },
              })
            }
          })
        }
      })

      // 按模式和时间排序
      slots.sort((a, b) => {
        // 每日时段排在前面
        if (a.mode === 'daily' && b.mode === 'datetime')
          return -1
        if (a.mode === 'datetime' && b.mode === 'daily')
          return 1
        // 同类型按开始时间排序
        return a.startHour - b.startHour
      })

      easterEggTimeSlots.value = slots
    }
  }
  catch (error) {
    console.error('获取彩蛋数据失败:', error)
  }
  finally {
    loading.value = false
  }
}

const currentEasterEgg = computed(() => {
  const currentTime = now.value

  // 先检查具体日期时间段
  for (const slot of easterEggTimeSlots.value) {
    if (slot.mode === 'datetime' && slot.dateTimeRange) {
      const startTime = new Date(slot.dateTimeRange.start)
      const endTime = new Date(slot.dateTimeRange.end)
      if (currentTime >= startTime && currentTime <= endTime) {
        return slot
      }
    }
  }

  // 再检查每日时间段
  const hour = currentHour.value
  for (const slot of easterEggTimeSlots.value) {
    if (slot.mode === 'daily' && hour >= slot.startHour && hour < slot.endHour) {
      return slot
    }
  }

  return null
})

const nextEasterEgg = computed(() => {
  const currentTime = now.value

  // 查找下一个即将开始的时段
  const upcomingSlots = easterEggTimeSlots.value.filter((slot) => {
    if (slot.mode === 'datetime' && slot.dateTimeRange) {
      const startTime = new Date(slot.dateTimeRange.start)
      return startTime > currentTime
    }
    else if (slot.mode === 'daily') {
      return slot.startHour > currentHour.value
    }
    return false
  })

  if (upcomingSlots.length > 0) {
    return upcomingSlots[0]
  }

  // 如果今天没有了，返回明天的第一个
  return easterEggTimeSlots.value.find(s => s.mode === 'daily')
})

const timeUntilNext = computed(() => {
  if (!nextEasterEgg.value)
    return ''

  const currentTime = now.value

  if (nextEasterEgg.value.mode === 'datetime' && nextEasterEgg.value.dateTimeRange) {
    const startTime = new Date(nextEasterEgg.value.dateTimeRange.start)
    const diffMs = startTime.getTime() - currentTime.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24)
      return `${days}天后`
    }
    else if (diffHours > 0) {
      return `${diffHours}小时${diffMinutes}分钟后`
    }
    else {
      return `${diffMinutes}分钟后`
    }
  }
  else {
    const hour = currentHour.value
    const minute = currentMinute.value
    const nextHour = nextEasterEgg.value.startHour

    let hoursLeft = nextHour - hour
    if (hoursLeft < 0)
      hoursLeft += 24

    const minutesLeft = 60 - minute

    if (hoursLeft === 0) {
      return `${minutesLeft}分钟后`
    }
    else if (minutesLeft === 60) {
      return `${hoursLeft}小时后`
    }
    else {
      return `${hoursLeft}小时${minutesLeft}分钟后`
    }
  }
})

function onClose() {
  emit('close')
}

function getTimeRangeDisplay(slot: EasterEggTimeSlot): string {
  if (slot.mode === 'datetime' && slot.dateTimeRange) {
    return `${formatDateTime(slot.dateTimeRange.start)} - ${formatDateTime(slot.dateTimeRange.end)}`
  }
  else if (slot.mode === 'daily' && slot.dailyTimeRange) {
    return `每日 ${slot.dailyTimeRange.start} - ${slot.dailyTimeRange.end}`
  }
  return ''
}

function isSlotActive(slot: EasterEggTimeSlot): boolean {
  const currentTime = now.value

  if (slot.mode === 'datetime' && slot.dateTimeRange) {
    const startTime = new Date(slot.dateTimeRange.start)
    const endTime = new Date(slot.dateTimeRange.end)
    return currentTime >= startTime && currentTime <= endTime
  }
  else if (slot.mode === 'daily') {
    const hour = currentHour.value
    return hour >= slot.startHour && hour < slot.endHour
  }

  return false
}

watch(() => props.visible, (visible) => {
  if (visible) {
    document.body.style.overflow = 'hidden'
    now.value = new Date()

    fetchEasterEggData()

    const interval = setInterval(() => {
      now.value = new Date()
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }
  else {
    document.body.style.overflow = ''
  }
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="easter-egg-modal-overlay" @click="onClose">
      <div class="easter-egg-modal" @click.stop>
        <div class="modal-header">
          <h3>⏰ 彩蛋时间表</h3>
          <button class="close-btn" @click="onClose">
            ×
          </button>
        </div>

        <div class="modal-body">
          <div v-if="loading" class="loading-state">
            <div class="loading-icon">
              ⏳
            </div>
            <div class="loading-text">
              正在加载彩蛋数据...
            </div>
          </div>

          <template v-else-if="easterEggTimeSlots.length > 0">
            <div v-if="currentEasterEgg" class="current-time-slot">
              <div class="slot-icon active">
                {{ currentEasterEgg.icon }}
              </div>
              <div class="slot-info">
                <div class="slot-name">
                  {{ currentEasterEgg.name }}
                </div>
                <div class="slot-bonus active">
                  +{{ currentEasterEgg.bonus }}分 彩蛋加成
                </div>
                <div class="slot-description">
                  {{ currentEasterEgg.description }}
                </div>
                <div class="slot-time-info">
                  {{ getTimeRangeDisplay(currentEasterEgg) }}
                </div>
              </div>
              <div class="active-badge">
                当前生效
              </div>
            </div>

            <div v-else class="no-active-slot">
              <div class="empty-icon">
                ⏳
              </div>
              <div class="empty-text">
                当前无彩蛋时段
              </div>
              <div v-if="nextEasterEgg" class="next-hint">
                下一个彩蛋时段：{{ nextEasterEgg.name }}
              </div>
              <div v-if="nextEasterEgg" class="countdown">
                {{ timeUntilNext }}开始
              </div>
            </div>

            <div class="time-slots-list">
              <div class="list-title">
                📅 完整时间表
              </div>
              <div
                v-for="(slot, index) in easterEggTimeSlots"
                :key="`${slot.poiName}-${index}`"
                class="time-slot-item"
                :class="{ active: isSlotActive(slot) }"
              >
                <div class="slot-icon">
                  {{ slot.icon }}
                </div>
                <div class="slot-details">
                  <div class="slot-header-row">
                    <div class="slot-name">
                      {{ slot.name }}
                    </div>
                    <div class="slot-mode-badge" :class="slot.mode">
                      {{ slot.mode === 'daily' ? '每日' : '限时' }}
                    </div>
                  </div>
                  <div class="slot-time">
                    {{ getTimeRangeDisplay(slot) }}
                  </div>
                  <div class="slot-description">
                    {{ slot.description }}
                  </div>
                </div>
                <div class="slot-bonus">
                  +{{ slot.bonus }}分
                </div>
              </div>
            </div>

            <div class="tips-section">
              <div class="tips-title">
                💡 温馨提示
              </div>
              <ul class="tips-list">
                <li>在彩蛋时段内打卡可获得额外积分加成</li>
                <li>彩蛋加成会叠加到基础积分上</li>
                <li>每日时段：每天该时间段内都可获得奖励</li>
                <li>限时时段：仅在特定日期时间段内有效</li>
              </ul>
            </div>
          </template>

          <div v-else class="empty-state">
            <div class="empty-icon">
              🎁
            </div>
            <div class="empty-text">
              暂无彩蛋时段配置
            </div>
            <div class="empty-hint">
              敬请期待更多彩蛋活动
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.easter-egg-modal-overlay {
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

.easter-egg-modal {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 16px;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
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
  background: #f8f9fa;
  color: #333;
}

.modal-body {
  padding: 20px 24px 24px;
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.loading-state {
  padding: 40px 20px;
  text-align: center;
}

.loading-icon {
  font-size: 48px;
  margin-bottom: 16px;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 16px;
  color: #6c757d;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  color: #495057;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 14px;
  color: #6c757d;
}

.current-time-slot {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  color: white;
  box-shadow: 0 4px 16px rgba(251, 191, 36, 0.3);
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 4px 16px rgba(251, 191, 36, 0.3);
  }
  50% {
    box-shadow: 0 4px 24px rgba(251, 191, 36, 0.5);
  }
}

.slot-icon {
  font-size: 48px;
  flex-shrink: 0;
}

.slot-icon.active {
  animation: bounce 1s ease-in-out infinite;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.slot-info {
  flex: 1;
  min-width: 0;
}

.slot-name {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.slot-bonus {
  font-size: 14px;
  font-weight: 500;
  opacity: 0.9;
  margin-bottom: 4px;
}

.slot-bonus.active {
  font-weight: 600;
  font-size: 16px;
}

.slot-description {
  font-size: 13px;
  opacity: 0.85;
  margin-bottom: 4px;
}

.slot-time-info {
  font-size: 12px;
  opacity: 0.8;
  font-family: 'Monaco', 'Menlo', monospace;
  margin-top: 6px;
}

.active-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(255, 255, 255, 0.25);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(10px);
}

.no-active-slot {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 32px 20px;
  margin-bottom: 24px;
  text-align: center;
}

.next-hint {
  font-size: 14px;
  color: #6c757d;
  margin-bottom: 4px;
}

.countdown {
  font-size: 14px;
  color: #007bff;
  font-weight: 500;
}

.time-slots-list {
  background: #f8f9fa;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
}

.list-title {
  background: white;
  padding: 16px 20px;
  border-bottom: 1px solid #e9ecef;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.time-slot-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  transition: all 0.2s ease;
}

.time-slot-item:last-child {
  border-bottom: none;
}

.time-slot-item.active {
  background: linear-gradient(135deg, #fff9e6, #fffbf0);
  border-left: 4px solid #fbbf24;
}

.time-slot-item .slot-icon {
  font-size: 32px;
  margin-right: 16px;
  flex-shrink: 0;
}

.slot-details {
  flex: 1;
  min-width: 0;
}

.slot-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.slot-details .slot-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.slot-mode-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.slot-mode-badge.daily {
  background: #e3f2fd;
  color: #1976d2;
}

.slot-mode-badge.datetime {
  background: #fce4ec;
  color: #c2185b;
}

.slot-time {
  font-size: 12px;
  color: #6c757d;
  margin-bottom: 2px;
  font-family: 'Monaco', 'Menlo', monospace;
}

.slot-details .slot-description {
  font-size: 12px;
  color: #6c757d;
}

.time-slot-item .slot-bonus {
  font-size: 16px;
  font-weight: 600;
  color: #007bff;
  margin-left: 16px;
}

.tips-section {
  background: #e7f3ff;
  border-radius: 8px;
  padding: 16px;
  border-left: 3px solid #007bff;
}

.tips-title {
  font-size: 14px;
  font-weight: 600;
  color: #004085;
  margin-bottom: 12px;
}

.tips-list {
  margin: 0;
  padding-left: 20px;
  list-style-type: disc;
}

.tips-list li {
  font-size: 13px;
  color: #004085;
  margin-bottom: 6px;
  line-height: 1.5;
}

.tips-list li:last-child {
  margin-bottom: 0;
}

.dark .easter-egg-modal {
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

.dark .loading-text {
  color: #9ca3af;
}

.dark .empty-text {
  color: #e5e7eb;
}

.dark .empty-hint {
  color: #9ca3af;
}

.dark .no-active-slot {
  background: #374151;
}

.dark .next-hint {
  color: #9ca3af;
}

.dark .countdown {
  color: #60a5fa;
}

.dark .time-slots-list {
  background: #374151;
}

.dark .list-title {
  background: #1f2937;
  border-bottom-color: #4b5563;
  color: #f9fafb;
}

.dark .time-slot-item {
  background: #1f2937;
  border-bottom: 1px solid #4b5563;
}

.dark .time-slot-item.active {
  background: linear-gradient(135deg, #451a03, #78350f);
  border-left-color: #f59e0b;
}

.dark .slot-details .slot-name {
  color: #f9fafb;
}

.dark .slot-mode-badge.daily {
  background: #1e3a8a;
  color: #93c5fd;
}

.dark .slot-mode-badge.datetime {
  background: #831843;
  color: #f9a8d4;
}

.dark .slot-time,
.dark .slot-details .slot-description {
  color: #9ca3af;
}

.dark .time-slot-item .slot-bonus {
  color: #60a5fa;
}

.dark .tips-section {
  background: rgba(59, 130, 246, 0.1);
  border-left-color: #3b82f6;
}

.dark .tips-title {
  color: #93c5fd;
}

.dark .tips-list li {
  color: #bfdbfe;
}

@media (max-width: 768px) {
  .easter-egg-modal-overlay {
    padding: 12px;
    align-items: flex-start;
    padding-top: 5vh;
  }

  .easter-egg-modal {
    max-height: calc(95vh - 5vh);
  }

  .modal-header {
    padding: 20px 20px 16px;
  }

  .modal-header h3 {
    font-size: 16px;
  }

  .modal-body {
    padding: 16px 20px calc(20px + env(safe-area-inset-bottom));
  }

  .current-time-slot {
    padding: 16px;
  }

  .slot-icon {
    font-size: 40px;
  }

  .slot-name {
    font-size: 16px;
  }

  .time-slot-item {
    padding: 12px 16px;
  }

  .time-slot-item .slot-icon {
    font-size: 28px;
    margin-right: 12px;
  }

  .slot-header-row {
    flex-wrap: wrap;
  }
}
</style>
