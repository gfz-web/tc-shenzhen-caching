// driver.js 客户端插件
export default defineNuxtPlugin(() => {
  // CSS已通过 nuxt.config.ts 加载，这里只做初始化确认
  if (import.meta.client) {
    console.warn('Driver.js 插件已准备就绪')
  }
})
