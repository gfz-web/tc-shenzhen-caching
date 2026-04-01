<script setup lang="ts">
import type { ToastMessage } from '~/composables/useToast'

// Props
interface Props {
  message: ToastMessage
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  remove: [id: string]
}>()

// 图标映射
const iconMap = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
}

// 样式映射
const styleMap = {
  success: 'toast-success',
  error: 'toast-error',
  warning: 'toast-warning',
  info: 'toast-info',
}

// 移除toast
function handleRemove() {
  emit('remove', props.message.id)
}

// 组件挂载时的动画
const toastRef = ref<HTMLElement>()

onMounted(() => {
  if (toastRef.value) {
    // 入场动画
    toastRef.value.classList.add('toast-enter')
    setTimeout(() => {
      if (toastRef.value) {
        toastRef.value.classList.remove('toast-enter')
        toastRef.value.classList.add('toast-visible')
      }
    }, 50)
  }
})

// 离场动画
function animateOut() {
  if (toastRef.value) {
    toastRef.value.classList.add('toast-leave')
    setTimeout(() => {
      handleRemove()
    }, 300)
  }
}
</script>

<template>
  <div
    ref="toastRef"
    class="toast"
    :class="styleMap[message.type]"
  >
    <div class="toast-content">
      <div class="toast-icon">
        {{ iconMap[message.type] }}
      </div>
      <div class="toast-body">
        <div class="toast-title">
          {{ message.title }}
        </div>
        <div v-if="message.message" class="toast-message">
          {{ message.message }}
        </div>
      </div>
      <button
        class="toast-close"
        @click="animateOut"
      >
        ×
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast {
  min-width: 320px;
  max-width: 500px;
  margin-bottom: 12px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  border: 1px solid #e9ecef;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateX(100%);
  opacity: 0;
}

.toast-enter {
  transform: translateX(100%);
  opacity: 0;
}

.toast-visible {
  transform: translateX(0);
  opacity: 1;
}

.toast-leave {
  transform: translateX(100%);
  opacity: 0;
}

.toast-content {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  gap: 12px;
}

.toast-icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}

.toast-body {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 4px;
  color: var(--toast-title-color);
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

.toast-message {
  font-size: 13px;
  line-height: 1.4;
  color: var(--toast-message-color);
  opacity: 0.9;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

.toast-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--toast-close-color);
  opacity: 0.6;
  transition: opacity 0.2s ease;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}

.toast-close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.1);
}

/* Success样式 */
.toast-success {
  background: linear-gradient(135deg, rgba(46, 125, 50, 0.95) 0%, rgba(76, 175, 80, 0.95) 100%);
  --toast-title-color: #fff;
  --toast-message-color: #fff;
  --toast-close-color: #fff;
}

/* Error样式 */
.toast-error {
  background: linear-gradient(135deg, rgba(198, 40, 40, 0.95) 0%, rgba(244, 67, 54, 0.95) 100%);
  --toast-title-color: #fff;
  --toast-message-color: #fff;
  --toast-close-color: #fff;
}

/* Warning样式 */
.toast-warning {
  background: linear-gradient(135deg, rgba(245, 124, 0, 0.95) 0%, rgba(255, 152, 0, 0.95) 100%);
  --toast-title-color: #fff;
  --toast-message-color: #fff;
  --toast-close-color: #fff;
}

/* Info样式 */
.toast-info {
  background: linear-gradient(135deg, rgba(25, 118, 210, 0.95) 0%, rgba(33, 150, 243, 0.95) 100%);
  --toast-title-color: #fff;
  --toast-message-color: #fff;
  --toast-close-color: #fff;
}

/* 深色模式适配 */
.dark .toast {
  border-color: rgba(255, 255, 255, 0.1);
}

.dark .toast-close:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .toast {
    min-width: 280px;
    max-width: calc(100vw - 32px);
    margin-bottom: 8px;
  }

  .toast-content {
    padding: 12px;
    gap: 10px;
  }

  .toast-icon {
    font-size: 18px;
  }

  .toast-title {
    font-size: 13px;
    line-height: 1.3;
    word-break: break-word;
    hyphens: auto;
  }

  .toast-message {
    font-size: 12px;
    line-height: 1.3;
    word-break: break-word;
    hyphens: auto;
  }
}

/* 小屏幕手机优化 */
@media (max-width: 480px) {
  .toast {
    min-width: 260px;
    max-width: calc(100vw - 20px);
    margin-bottom: 6px;
    border-radius: 8px;
  }

  .toast-content {
    padding: 10px;
    gap: 8px;
  }

  .toast-icon {
    font-size: 16px;
    margin-top: 1px;
  }

  .toast-title {
    font-size: 12px;
    line-height: 1.2;
    margin-bottom: 2px;
  }

  .toast-message {
    font-size: 11px;
    line-height: 1.2;
  }

  .toast-close {
    width: 18px;
    height: 18px;
    font-size: 16px;
  }
}

/* 超小屏幕优化 */
@media (max-width: 320px) {
  .toast {
    min-width: 240px;
    max-width: calc(100vw - 16px);
  }

  .toast-content {
    padding: 8px;
    gap: 6px;
  }

  .toast-title {
    font-size: 11px;
  }

  .toast-message {
    font-size: 10px;
  }
}
</style>
