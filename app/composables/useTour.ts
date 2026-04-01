import type { Driver, DriveStep } from 'driver.js'
import { driver } from 'driver.js'

/**
 * 引导组件 Composable
 * 使用 driver.js 提供专业的页面引导功能
 */
export function useTour() {
  let driverInstance: Driver | null = null
  const isDriverReady = ref(false)

  // 检查是否是新用户（首次访问）
  const hasSeenTour = computed(() => {
    if (import.meta.client) {
      return localStorage.getItem('shenzhen-caching-tour-completed') === 'true'
    }
    return false
  })

  // 引导步骤定义
  const getTourSteps = (showDeveloperButton: boolean = false): DriveStep[] => {
    const steps: DriveStep[] = [
      {
        element: '.poi-list-toggle',
        popover: {
          title: '📍 POI列表',
          description: '这里展示附近的兴趣点，可以查看详细信息和打卡状态。点击可以展开完整列表。',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '.checkin-button-container',
        popover: {
          title: '📱 打卡面板',
          description: '这是打卡面板区域，显示当前位置信息和打卡按钮。系统会自动检测您附近的POI，显示距离和打卡状态。',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-reset-view',
        popover: {
          title: '🎯 重置视图',
          description: '点击可以将地图重置到初始位置和缩放级别。',
          side: 'left',
          align: 'center',
        },
      },
      {
        element: '#tour-toggle-dark',
        popover: {
          title: '🌓 深色模式',
          description: '切换浅色/深色主题，保护您的眼睛，适应不同环境。',
          side: 'left',
          align: 'center',
        },
      },
    ]

    // 只有在显示开发者按钮时才添加开发者模式步骤
    if (showDeveloperButton) {
      steps.push({
        element: '#tour-developer-mode',
        popover: {
          title: '🔧 开发者模式',
          description: '开发者专用功能，可以添加、编辑POI点。需要特殊权限访问。',
          side: 'left',
          align: 'center',
        },
      })
    }

    // 添加其他控制按钮
    steps.push(
      {
        element: '#tour-edit-user',
        popover: {
          title: '👤 用户信息',
          description: '编辑您的个人信息，包括工号和昵称。这些信息用于打卡记录。',
          side: 'left',
          align: 'center',
        },
      },
      {
        element: '#tour-coordinate-calibration',
        popover: {
          title: '📍 位置设置',
          description: '校准您的GPS位置，提高定位精度，确保打卡位置准确。',
          side: 'left',
          align: 'center',
        },
      },
      {
        element: '#tour-ranking',
        popover: {
          title: '🏆 积分排名',
          description: '查看打卡积分排行榜，看看您在所有用户中的排名！',
          side: 'left',
          align: 'center',
        },
      },
    )

    return steps
  }

  // 初始化 driver.js
  function initDriver() {
    if (import.meta.client && !driverInstance) {
      driverInstance = driver({
        animate: false, // 禁用动画，可能有冲突
        allowClose: true,
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        nextBtnText: '下一步',
        prevBtnText: '上一步',
        doneBtnText: '完成',
        progressText: '第 {{current}} 步，共 {{total}} 步',
        popoverClass: 'driver-popover-custom',
        stagePadding: 4,
        stageRadius: 8,
        disableActiveInteraction: false, // 确保交互不被禁用
        onDestroyed: () => {
          // 引导完全关闭后的处理
        },
        onDestroyStarted: () => {
          // 检查当前步骤索引和总步骤数
          const currentIndex = driverInstance?.getActiveIndex() || 0
          const totalSteps = driverInstance?.getConfig().steps?.length || 0
          const hasNextStep = driverInstance?.hasNextStep()

          // 如果是最后一步且没有下一步，说明是正常完成
          if (!hasNextStep && currentIndex >= totalSteps - 1) {
            markTourCompleted()
          }
          else {
            // User did not complete tour normally
          }
        },
        onNextClick: (_element: Element | undefined, _step: any, _options: any) => {
          // 获取当前状态
          const currentIndex = driverInstance?.getActiveIndex() ?? -1
          const allSteps = driverInstance?.getConfig().steps || []
          const totalSteps = allSteps.length

          // 检查下一个元素
          const nextIndex = currentIndex + 1
          if (nextIndex < totalSteps) {
            const nextStep = allSteps[nextIndex]
            if (!nextStep?.element) {
              return false
            }

            const nextElement = document.querySelector(String(nextStep.element))
            if (nextElement) {
              // 检查元素是否可见
              const rect = nextElement.getBoundingClientRect()
              const _isVisible = rect.width > 0 && rect.height > 0

              // 手动强制跳转到下一步（解决卡住问题）
              setTimeout(() => {
                manualMoveNext()
              }, 200)

              // 阻止默认行为，我们手动控制
              return false
            }
            else {
              // 强制重启
              setTimeout(() => {
                destroyDriver()
                setTimeout(() => {
                  const showDev = document.querySelector('#tour-developer-mode') !== null
                  initDriver()
                  startTour(showDev)
                }, 200)
              }, 100)
              return false // 阻止默认行为
            }
          }
          else {
            // 手动完成引导
            setTimeout(() => {
              try {
                if (driverInstance) {
                  driverInstance.destroy()
                  markTourCompleted()
                }
              }
              catch {
                // 强制完成
                markTourCompleted()
              }
            }, 200)

            // 阻止默认行为，我们手动控制
            return false
          }
        },
        onPrevClick: () => {
          // Previous button clicked
        },
        onCloseClick: () => {
          // Close button clicked
        },
        onHighlighted: (_element: Element | undefined, _step: any) => {
          // 检查元素状态
          if (_element) {
            const _rect = _element.getBoundingClientRect()
          }
        },
        onPopoverRender: (_popover: any, { config: _config, state: _state }: any) => {
          // 检查按钮是否正确渲染
          setTimeout(() => {
            // 修复：popover可能不是DOM元素，需要通过document查找
            const popoverElement = document.querySelector('.driver-popover')

            if (popoverElement) {
              // 更可靠的按钮查找方法
              const allButtons = popoverElement.querySelectorAll('button')
              let nextBtn = null
              let prevBtn = null
              let closeBtn = null

              // 通过按钮文本内容查找
              allButtons.forEach((btn) => {
                const text = btn.textContent?.trim() || ''
                if (text === '下一步' || text.includes('next')) {
                  nextBtn = btn
                }
                else if (text === '上一步' || text.includes('prev')) {
                  prevBtn = btn
                }
                else if (text === '跳过' || text === '关闭' || text.includes('close')) {
                  closeBtn = btn
                }
              })

              // 备用查找方法
              if (!nextBtn) {
                nextBtn = popoverElement.querySelector('[data-driver-next-btn]')
                  || popoverElement.querySelector('.driver-popover-next-btn')
              }
              if (!prevBtn) {
                prevBtn = popoverElement.querySelector('[data-driver-prev-btn]')
                  || popoverElement.querySelector('.driver-popover-prev-btn')
              }
              if (!closeBtn) {
                closeBtn = popoverElement.querySelector('[data-driver-close-btn]')
                  || popoverElement.querySelector('.driver-popover-close-btn')
              }

              if (nextBtn && nextBtn instanceof HTMLButtonElement) {
                // Log next button details for debugging
                // disabled: nextBtn.disabled, hidden: nextBtn.hidden, etc.

                // 检查按钮事件监听器
                const hasClickListener = nextBtn.onclick !== null

                // 尝试手动绑定点击事件（如果没有的话）
                if (!hasClickListener) {
                  nextBtn.addEventListener('click', () => {
                    if (driverInstance) {
                      try {
                        driverInstance.moveNext()
                      }
                      catch {
                        // Error moving to next step
                      }
                    }
                  })
                }

                // 检查按钮是否被禁用或遮挡
                const _computedStyle = getComputedStyle(nextBtn)
                // Log button computed style for debugging
                // pointerEvents, zIndex, position, opacity, display, visibility
              }
            }
            else {
              // Popover element not found
            }
          }, 100)
        },
      })
      isDriverReady.value = true
    }
  }

  // 启动引导
  function startTour(showDeveloperButton: boolean = false) {
    if (!isDriverReady.value) {
      initDriver()
    }

    if (driverInstance) {
      const steps = getTourSteps(showDeveloperButton)

      // 检查所有元素是否存在
      const missingElements: string[] = []

      steps.forEach((step: DriveStep, _index: number) => {
        const elementSelector = typeof step.element === 'string' ? step.element : ''
        const element = document.querySelector(elementSelector)
        const exists = !!element
        if (!exists) {
          missingElements.push(elementSelector)
        }
      })

      if (missingElements.length > 0) {
        return
      }

      try {
        driverInstance.setSteps(steps)
        driverInstance.drive()
      }
      catch {
        // Error starting main tour
      }
    }
    else {
      // Driver instance not available
    }
  }

  // 手动启动引导（用于测试或手动触发）
  function startManualTour(showDeveloperButton: boolean = false) {
    startTour(showDeveloperButton)
  }

  // 简单测试引导
  function startTestTour() {
    if (!isDriverReady.value) {
      initDriver()
    }

    if (driverInstance) {
      // 两步测试，验证下一步按钮
      const testSteps: DriveStep[] = [
        {
          element: 'body',
          popover: {
            title: '🎉 测试步骤 1/2',
            description: '这是第一步测试。请点击"下一步"按钮测试导航功能。',
            side: 'bottom',
            align: 'center',
          },
        },
        {
          element: '.poi-list-toggle',
          popover: {
            title: '🎉 测试步骤 2/2',
            description: '太好了！下一步按钮工作正常。这是POI列表切换按钮。',
            side: 'top',
            align: 'center',
          },
        },
      ]

      try {
        driverInstance.setSteps(testSteps)
        driverInstance.drive()
      }
      catch {
        // Error starting test tour
      }
    }
  }

  // 标记引导为已完成
  function markTourCompleted() {
    if (import.meta.client) {
      localStorage.setItem('shenzhen-caching-tour-completed', 'true')

      // 检查是否是首次用户完成设置后的引导
      const isAfterUserSetup = sessionStorage.getItem('tour-after-user-setup') === 'true'
      sessionStorage.removeItem('tour-after-user-setup')

      setTimeout(() => {
        if (isAfterUserSetup) {
          // Tour completed after user setup
        }
        else {
          // Regular tour completion
        }
      }, 500)
    }
  }

  // 重置引导状态（用于测试）
  function resetTourState() {
    if (import.meta.client) {
      localStorage.removeItem('shenzhen-caching-tour-completed')
      sessionStorage.removeItem('tour-after-user-setup')
    }
  }

  // 强制重启引导（用于解决卡住问题）
  function forceRestartTour(showDeveloperButton: boolean = false) {
    // 先销毁现有实例
    destroyDriver()

    // 等待一下确保清理完成
    setTimeout(() => {
      // 重新初始化和启动
      initDriver()
      startTour(showDeveloperButton)
    }, 100)
  }

  // 创建最小化配置的引导（用于调试）
  function startMinimalTour() {
    if (import.meta.client) {
      // 销毁现有实例
      if (driverInstance) {
        driverInstance.destroy()
        driverInstance = null
      }

      // 创建最简单的配置
      const minimalDriver = driver({
        // 最基本配置
        showButtons: ['next', 'close'],
        nextBtnText: '下一步',
        animate: false,

        onNextClick: () => {
          return true
        },

        onCloseClick: () => {
          // Close clicked in minimal tour
        },
      })

      const steps: DriveStep[] = [
        {
          element: 'body',
          popover: {
            title: '测试 1/2',
            description: '这是最小化配置测试。点击下一步。',
            side: 'bottom' as const,
            align: 'center' as const,
          },
        },
        {
          element: '.poi-list-toggle',
          popover: {
            title: '测试 2/2',
            description: '成功！下一步按钮工作正常。',
            side: 'top' as const,
            align: 'center' as const,
          },
        },
      ]

      minimalDriver.setSteps(steps)
      minimalDriver.drive()
    }
  }

  // 检查是否应该显示引导
  function shouldShowTour(): boolean {
    return !hasSeenTour.value
  }

  // 手动导航到下一步（当自动导航失败时使用）
  function manualMoveNext() {
    if (!driverInstance) {
      return
    }

    const currentIndex = driverInstance.getActiveIndex() ?? -1
    const allSteps = driverInstance.getConfig().steps || []
    const nextIndex = currentIndex + 1

    if (nextIndex < allSteps.length) {
      const nextStep = allSteps[nextIndex]

      try {
        // 方法1: 使用driver的内置方法
        driverInstance.moveNext()
      }
      catch {
        // Method 1 failed, try method 2
        try {
          // 方法2: 直接高亮下一个元素
          if (nextStep) {
            driverInstance.highlight(nextStep)
          }
        }
        catch {
          // Method 2 failed, try method 3
          try {
            // 方法3: 销毁重建，从下一步开始
            const remainingSteps = allSteps.slice(nextIndex)
            driverInstance.destroy()

            setTimeout(() => {
              const newDriver = driver({
                animate: false,
                allowClose: true,
                showProgress: true,
                showButtons: ['next', 'previous', 'close'],
                nextBtnText: '下一步',
                prevBtnText: '上一步',
                doneBtnText: '完成',
                progressText: `第 {{current}} 步，共 {{total}} 步`,
              })

              newDriver.setSteps(remainingSteps)
              newDriver.drive()

              // 更新实例引用
              driverInstance = newDriver
            }, 100)
          }
          catch {
            // Method 3 failed, force restart
            forceRestartTour(document.querySelector('#tour-developer-mode') !== null)
          }
        }
      }
    }
    else {
      try {
        driverInstance.destroy()
      }
      catch {
        // Error destroying driver instance
      }
      markTourCompleted()
    }
  }

  // 强制完成引导（当完成按钮无响应时）
  function forceCompleteTour() {
    try {
      if (driverInstance) {
        // Forcing tour completion - log driver state for debugging

        driverInstance.destroy()
        driverInstance = null
        isDriverReady.value = false
      }

      markTourCompleted()
    }
    catch {
      // 最后的救援措施
      if (import.meta.client) {
        localStorage.setItem('shenzhen-caching-tour-completed', 'true')
        sessionStorage.removeItem('tour-after-user-setup')
        // 手动移除所有引导相关的DOM元素
        const driverElements = document.querySelectorAll('.driver-overlay, .driver-popover, .driver-stage')
        driverElements.forEach(el => el.remove())
      }
    }
  }

  // 调试页面状态（用于排查问题）
  function debugPageState() {
    if (!import.meta.client)
      return

    // 检查关键元素
    const elements = [
      '.poi-list-toggle',
      '.checkin-button-container',
      '#tour-reset-view',
      '#tour-toggle-dark',
      '#tour-developer-mode',
      '#tour-edit-user',
      '#tour-coordinate-calibration',
      '#tour-ranking',
    ]

    elements.forEach((selector) => {
      const el = document.querySelector(selector)
      if (el) {
        const _rect = el.getBoundingClientRect()
        // Log element state for debugging: exists, visible, position, style
      }
      else {
        // Element not found
      }
    })

    // 检查 CSS 加载
    const stylesheets = Array.from(document.styleSheets)
    const _driverCSS = stylesheets.find(sheet =>
      sheet.href && sheet.href.includes('driver'),
    )

    // 检查 driver 实例
    // Log driver instance status for debugging
  }

  // 自动启动引导（首次访问时）
  function autoStartTour(showDeveloperButton: boolean = false, delay: number = 2000) {
    if (shouldShowTour()) {
      setTimeout(() => {
        startTour(showDeveloperButton)
      }, delay)
    }
  }

  // 在用户信息设置完成后启动引导
  function startTourAfterUserSetup(showDeveloperButton: boolean = false, delay: number = 1000) {
    if (shouldShowTour()) {
      // 标记这是首次用户完成设置后的引导
      if (import.meta.client) {
        sessionStorage.setItem('tour-after-user-setup', 'true')
      }
      setTimeout(() => {
        startTour(showDeveloperButton)
      }, delay)
    }
  }

  // 销毁 driver 实例
  function destroyDriver() {
    if (driverInstance) {
      driverInstance.destroy()
      driverInstance = null
      isDriverReady.value = false
    }
  }

  // 组件卸载时清理
  onBeforeUnmount(() => {
    destroyDriver()
  })

  return {
    // 状态
    isDriverReady: readonly(isDriverReady),
    hasSeenTour,

    // 方法
    initDriver,
    startTour,
    startManualTour,
    startTestTour,
    startMinimalTour,
    autoStartTour,
    startTourAfterUserSetup,
    forceRestartTour,
    forceCompleteTour,
    manualMoveNext,
    shouldShowTour,
    debugPageState,
    markTourCompleted,
    resetTourState,
    destroyDriver,
  }
}
