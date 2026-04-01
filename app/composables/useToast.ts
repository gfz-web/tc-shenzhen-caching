export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  persistent?: boolean
}

interface ToastState {
  messages: ToastMessage[]
}

// 全局toast状态
const toastState = reactive<ToastState>({
  messages: [],
})

/**
 * 全局Toast管理 Composable
 * 提供统一的消息提示功能
 */
export function useToast() {
  // 生成唯一ID
  const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // 移除toast消息
  const removeToast = (id: string) => {
    const index = toastState.messages.findIndex(msg => msg.id === id)
    if (index > -1) {
      toastState.messages.splice(index, 1)
    }
  }

  // 添加toast消息
  const addToast = (toast: Omit<ToastMessage, 'id'>): string => {
    const id = generateId()
    const newToast: ToastMessage = {
      id,
      duration: 4000, // 默认4秒
      persistent: false,
      ...toast,
    }

    toastState.messages.push(newToast)

    // 如果不是持久化消息，自动移除
    if (!newToast.persistent && newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }

    return id
  }

  // 清空所有toast消息
  const clearAllToasts = () => {
    toastState.messages.length = 0
  }

  // 便捷方法
  const success = (title: string, message?: string, options?: Partial<ToastMessage>) => {
    return addToast({ type: 'success', title, message, ...options })
  }

  const error = (title: string, message?: string, options?: Partial<ToastMessage>) => {
    return addToast({ type: 'error', title, message, ...options })
  }

  const warning = (title: string, message?: string, options?: Partial<ToastMessage>) => {
    return addToast({ type: 'warning', title, message, ...options })
  }

  const info = (title: string, message?: string, options?: Partial<ToastMessage>) => {
    return addToast({ type: 'info', title, message, ...options })
  }

  return {
    // 状态
    messages: readonly(toastState.messages),

    // 方法
    addToast,
    removeToast,
    clearAllToasts,

    // 便捷方法
    success,
    error,
    warning,
    info,
  }
}
