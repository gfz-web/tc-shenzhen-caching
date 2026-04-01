<script setup lang="ts">
import { appName } from '~/constants'

useHead({
  title: appName,
})
</script>

<template>
  <VitePwaManifest />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <!-- 全局Toast容器 -->
  <ToastContainer />
</template>

<style>
html,
body,
#__nuxt {
  height: 100vh;
  margin: 0;
  padding: 0;
}

html.dark {
  color-scheme: dark;
}

/* Driver.js 自定义样式 */
.driver-popover {
  font-family: inherit !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
  max-width: 320px !important;
}

.driver-popover-title {
  font-size: 16px !important;
  font-weight: 600 !important;
  margin-bottom: 8px !important;
  color: #333 !important;
}

.driver-popover-description {
  font-size: 14px !important;
  line-height: 1.5 !important;
  color: #666 !important;
  margin-bottom: 16px !important;
}

.driver-popover-progress-text {
  font-size: 12px !important;
  color: #999 !important;
  margin-bottom: 16px !important;
}

.driver-popover-navigation-btns {
  display: flex !important;
  gap: 8px !important;
  justify-content: flex-end !important;
}

.driver-popover-next-btn {
  background: #007bff !important;
  border: none !important;
  color: white !important;
  padding: 8px 16px !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  font-size: 14px !important;
  transition: background 0.2s ease !important;
}

.driver-popover-next-btn:hover {
  background: #0056b3 !important;
}

.driver-popover-prev-btn {
  background: #f8f9fa !important;
  border: 1px solid #dee2e6 !important;
  color: #6c757d !important;
  padding: 8px 16px !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  font-size: 14px !important;
  transition: all 0.2s ease !important;
}

.driver-popover-prev-btn:hover {
  background: #e9ecef !important;
}

.driver-popover-close-btn {
  background: none !important;
  border: none !important;
  color: #6c757d !important;
  padding: 8px 16px !important;
  cursor: pointer !important;
  font-size: 14px !important;
  transition: color 0.2s ease !important;
}

.driver-popover-close-btn:hover {
  color: #495057 !important;
}

/* 深色模式支持 */
.dark .driver-popover {
  background: #374151 !important;
  border-color: #4b5563 !important;
}

.dark .driver-popover-title {
  color: #f9fafb !important;
}

.dark .driver-popover-description {
  color: #d1d5db !important;
}

.dark .driver-popover-progress-text {
  color: #9ca3af !important;
}

.dark .driver-popover-prev-btn {
  background: #4b5563 !important;
  color: #d1d5db !important;
  border-color: #6b7280 !important;
}

.dark .driver-popover-prev-btn:hover {
  background: #374151 !important;
}

.dark .driver-popover-close-btn {
  color: #9ca3af !important;
}

.dark .driver-popover-close-btn:hover {
  color: #d1d5db !important;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .driver-popover {
    max-width: 280px !important;
    margin: 8px !important;
  }

  .driver-popover-title {
    font-size: 15px !important;
  }

  .driver-popover-description {
    font-size: 13px !important;
  }

  .driver-popover-next-btn,
  .driver-popover-prev-btn,
  .driver-popover-close-btn {
    padding: 6px 12px !important;
    font-size: 13px !important;
  }
}
</style>
