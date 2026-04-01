import { computed, onBeforeUnmount, onMounted, readonly, ref } from 'vue'
import { ACTIVITY_END_TIME } from '~/constants'

export interface CountdownTime {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number // 剩余毫秒数
}

export function useActivityCountdown() {
  const now = ref(Date.now())
  let intervalId: ReturnType<typeof setInterval> | null = null

  // 计算剩余时间
  const countdown = computed<CountdownTime>(() => {
    const total = Math.max(0, ACTIVITY_END_TIME - now.value)
    const seconds = Math.floor((total / 1000) % 60)
    const minutes = Math.floor((total / 1000 / 60) % 60)
    const hours = Math.floor((total / 1000 / 60 / 60) % 24)
    const days = Math.floor(total / 1000 / 60 / 60 / 24)

    return {
      days,
      hours,
      minutes,
      seconds,
      total,
    }
  })

  // 活动是否已结束
  const isActivityEnded = computed(() => countdown.value.total <= 0)

  // 格式化倒计时文本
  const countdownText = computed(() => {
    const { days, hours, minutes, seconds } = countdown.value

    if (isActivityEnded.value) {
      return '活动已结束'
    }

    if (days > 0) {
      return `${days}天${hours}小时${minutes}分${seconds}秒`
    }
    if (hours > 0) {
      return `${hours}小时${minutes}分${seconds}秒`
    }
    if (minutes > 0) {
      return `${minutes}分${seconds}秒`
    }
    return `${seconds}秒`
  })

  // 简短的倒计时文本（用于空间受限的地方）
  const shortCountdownText = computed(() => {
    const { days, hours, minutes } = countdown.value

    if (isActivityEnded.value) {
      return '已结束'
    }

    if (days > 0) {
      return `剩余${days}天`
    }
    if (hours > 0) {
      return `剩余${hours}小时`
    }
    return `剩余${minutes}分钟`
  })

  // 获取紧迫程度（用于样式控制）
  const urgencyLevel = computed<'normal' | 'warning' | 'danger'>(() => {
    const { total } = countdown.value
    const hours = total / 1000 / 60 / 60

    if (hours <= 24) {
      return 'danger' // 最后24小时
    }
    if (hours <= 72) {
      return 'warning' // 最后3天
    }
    return 'normal'
  })

  // 启动倒计时
  function startCountdown() {
    // 每秒更新一次
    intervalId = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  }

  // 停止倒计时
  function stopCountdown() {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  // 生命周期管理
  onMounted(() => {
    startCountdown()
  })

  onBeforeUnmount(() => {
    stopCountdown()
  })

  return {
    countdown: readonly(countdown),
    isActivityEnded: readonly(isActivityEnded),
    countdownText: readonly(countdownText),
    shortCountdownText: readonly(shortCountdownText),
    urgencyLevel: readonly(urgencyLevel),
    startCountdown,
    stopCountdown,
  }
}

