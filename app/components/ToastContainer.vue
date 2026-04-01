<script setup lang="ts">
import { useToast } from '~/composables/useToast'

const { messages, removeToast } = useToast()

// 处理移除toast
function handleRemove(id: string) {
  removeToast(id)
}

// 防止SSR水合不匹配
const isMounted = ref(false)

onMounted(() => {
  isMounted.value = true
})
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <div v-if="isMounted" class="toast-container">
        <TransitionGroup name="toast-list" tag="div">
          <Toast
            v-for="message in messages"
            :key="message.id"
            :message="message"
            @remove="handleRemove"
          />
        </TransitionGroup>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000001;
  pointer-events: none;
  max-height: calc(100vh - 40px);
  overflow: hidden;
}

.toast-container > * {
  pointer-events: auto;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .toast-container {
    top: calc(10px + env(safe-area-inset-top));
    left: calc(10px + env(safe-area-inset-left));
    right: calc(10px + env(safe-area-inset-right));
    max-height: calc(100vh - 20px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  }
}

/* 小屏幕手机优化 */
@media (max-width: 480px) {
  .toast-container {
    top: calc(5px + env(safe-area-inset-top));
    left: calc(5px + env(safe-area-inset-left));
    right: calc(5px + env(safe-area-inset-right));
    max-height: calc(100vh - 10px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  }
}

/* TransitionGroup动画 */
.toast-list-enter-active,
.toast-list-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-list-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-list-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-list-move {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
