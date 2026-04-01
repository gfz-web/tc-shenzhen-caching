<script setup lang="ts">
interface Option {
  label: string
  value: string | number
}

interface Props {
  modelValue: string | number
  options: Option[] | string[]
  placeholder?: string
  disabled?: boolean
  size?: 'small' | 'medium' | 'large'
  variant?: 'default' | 'filter' | 'compact'
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请选择',
  disabled: false,
  size: 'medium',
  variant: 'default',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  'change': [value: string | number]
}>()

// 下拉状态
const isOpen = ref(false)
const dropdownRef = ref<HTMLElement>()
const triggerRef = ref<HTMLElement>()

// 处理选项数据，统一转换为 Option[] 格式
const normalizedOptions = computed(() => {
  return props.options.map((option) => {
    if (typeof option === 'string') {
      return { label: option, value: option }
    }
    return option
  })
})

// 获取当前选中项的显示文本
const selectedLabel = computed(() => {
  const selected = normalizedOptions.value.find(option => option.value === props.modelValue)
  return selected?.label || props.placeholder
})

// 切换下拉状态
function toggle() {
  if (props.disabled)
    return
  isOpen.value = !isOpen.value
}

// 选择选项
function selectOption(option: Option) {
  if (props.disabled)
    return

  const convertedValue = typeof props.modelValue === 'number' ? Number(option.value) : option.value

  emit('update:modelValue', convertedValue)
  emit('change', convertedValue)
  isOpen.value = false
}

// 处理键盘事件
function handleKeydown(event: KeyboardEvent) {
  if (props.disabled)
    return

  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      toggle()
      break
    case 'Escape':
      isOpen.value = false
      break
    case 'ArrowDown':
      event.preventDefault()
      if (!isOpen.value) {
        isOpen.value = true
      }
      else {
        // TODO: 导航到下一个选项
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      if (isOpen.value) {
        // TODO: 导航到上一个选项
      }
      break
  }
}

// 点击外部关闭
function handleClickOutside(event: Event) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

// 计算样式类名
const wrapperClasses = computed(() => [
  'base-select',
  `base-select--${props.size}`,
  `base-select--${props.variant}`,
  {
    'base-select--disabled': props.disabled,
    'base-select--open': isOpen.value,
  },
])

// 监听外部点击
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div
    ref="dropdownRef"
    :class="wrapperClasses"
    class="base-select-wrapper"
  >
    <!-- 触发器 -->
    <div
      ref="triggerRef"
      class="base-select-trigger"
      :tabindex="disabled ? -1 : 0"
      role="combobox"
      :aria-expanded="isOpen"
      :aria-disabled="disabled"
      @click="toggle"
      @keydown="handleKeydown"
    >
      <span class="base-select-value">
        {{ selectedLabel }}
      </span>

      <!-- 下拉箭头 -->
      <div class="base-select-arrow" :class="{ 'base-select-arrow--rotated': isOpen }">
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
          <path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    </div>

    <!-- 下拉选项 -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="base-select-dropdown">
        <div class="base-select-options">
          <div
            v-for="option in normalizedOptions"
            :key="option.value"
            class="base-select-option"
            :class="{
              'base-select-option--selected': option.value === modelValue,
            }"
            @click="selectOption(option)"
          >
            {{ option.label }}
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 引用全局颜色变量 */
:root {
  --primary-color: #007bff;
  --primary-hover: #0056b3;
  --primary-light: #e7f3ff;
  --primary-lighter: #f8f9ff;
  --gray-light: #f8f9fa;
  --gray-border: #e9ecef;
  --gray-border-light: #ddd;
  --text-primary: #333;
  --text-secondary: #666;
  --text-muted: #999;
  --bg-white: #ffffff;
  --bg-card: #ffffff;
  --shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.base-select-wrapper {
  position: relative;
  display: inline-block;
  width: 100%;
}

/* 触发器样式 */
.base-select-trigger {
  width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--gray-border-light);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
}

.base-select-trigger:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.base-select-value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 尺寸变体 */
.base-select--small .base-select-trigger {
  padding: 6px 10px;
  font-size: 12px;
}

.base-select--medium .base-select-trigger {
  padding: 8px 12px;
  font-size: 14px;
}

.base-select--large .base-select-trigger {
  padding: 12px 16px;
  font-size: 16px;
}

/* 样式变体 */
.base-select--filter .base-select-trigger {
  border-color: var(--gray-border);
  background: var(--gray-light);
  font-size: 13px;
}

.base-select--filter.base-select--open .base-select-trigger,
.base-select--filter .base-select-trigger:focus {
  background: var(--bg-card);
  border-color: var(--primary-color);
}

.base-select--compact .base-select-trigger {
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
}

/* 禁用状态 */
.base-select--disabled .base-select-trigger {
  background: #f5f5f5;
  color: var(--text-muted);
  cursor: not-allowed;
  border-color: #e0e0e0;
}

.base-select--disabled .base-select-trigger:focus {
  box-shadow: none;
  border-color: #e0e0e0;
}

/* 箭头样式 */
.base-select-arrow {
  margin-left: 8px;
  color: var(--text-secondary);
  transition: transform 0.3s ease;
  display: flex;
  align-items: center;
}

.base-select-arrow--rotated {
  transform: rotate(180deg);
}

.base-select--open .base-select-arrow {
  color: #007bff;
}

.base-select--disabled .base-select-arrow {
  color: #ccc;
}

/* 下拉选项容器 */
.base-select-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1050;
  background: var(--bg-card);
  border: 1px solid var(--gray-border-light);
  border-top: none;
  border-radius: 0 0 6px 6px;
  box-shadow: var(--shadow-hover);
  max-height: 200px;
  overflow-y: auto;
}

.base-select-options {
  padding: 4px 0;
}

.base-select-option {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-size: inherit;
}

.base-select-option:hover {
  background: var(--gray-light);
}

.base-select-option--selected {
  background: #e3f2fd;
  color: #1976d2;
  font-weight: 500;
}

.base-select-option--selected:hover {
  background: #bbdefb;
}

/* 打开状态的触发器样式 */
.base-select--open .base-select-trigger {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-color: var(--primary-color);
}

/* 下拉动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.3s ease;
  transform-origin: top;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scaleY(0.8) translateY(-10px);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: scaleY(1) translateY(0);
}

/* 深色模式支持 */
.dark .base-select-trigger {
  background: #2d2d2d;
  border-color: #404040;
  color: #fff;
}

.dark .base-select-trigger:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.dark .base-select--filter .base-select-trigger {
  background: #1a1a1a;
  border-color: #404040;
}

.dark .base-select--filter.base-select--open .base-select-trigger,
.dark .base-select--filter .base-select-trigger:focus {
  background: #2d2d2d;
}

.dark .base-select--disabled .base-select-trigger {
  background: #1a1a1a;
  color: var(--text-secondary);
  border-color: var(--text-primary);
}

.dark .base-select-arrow {
  color: var(--text-muted);
}

.dark .base-select--open .base-select-arrow {
  color: #007bff;
}

.dark .base-select--disabled .base-select-arrow {
  color: #555;
}

.dark .base-select-dropdown {
  background: #2d2d2d;
  border-color: #404040;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.dark .base-select-option:hover {
  background: #3d3d3d;
}

.dark .base-select-option--selected {
  background: #1565c0;
  color: #e3f2fd;
}

.dark .base-select-option--selected:hover {
  background: #1976d2;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .base-select--medium .base-select-trigger,
  .base-select--large .base-select-trigger {
    font-size: 16px; /* 防止iOS缩放 */
  }

  .base-select-dropdown {
    max-height: 150px; /* 移动端限制高度 */
  }
}
</style>
