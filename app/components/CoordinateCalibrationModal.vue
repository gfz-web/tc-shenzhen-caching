<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useSearchRange } from '~/composables/useSearchRange'

import { useToast } from '~/composables/useToast'
import { useUserInfo } from '~/composables/useUserInfo'

// Props
const _props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
})

// Emits
const emit = defineEmits(['close'])

// Composables
const { userInfo, saveCoordinateOffset } = useUserInfo()
const { searchRange, minRange, maxRange, setSearchRange, formatRange, getRangeLevel } = useSearchRange()
const { success: showSuccessToast } = useToast()

// State
const activeTab = ref('range') // 'range' | 'calibration'
const offsetLat = ref(-290) // 默认纬度偏移-290米
const offsetLng = ref(500) // 默认经度偏移+500米
const maxOffset = 800

// Computed
const hasCoordinateOffset = computed(() => {
  return userInfo.value.coordinateOffset
    && typeof userInfo.value.coordinateOffset.lat === 'number'
    && typeof userInfo.value.coordinateOffset.lng === 'number'
})

// 初始化偏移值
watchEffect(() => {
  if (hasCoordinateOffset.value) {
    offsetLat.value = userInfo.value.coordinateOffset.lat || 0
    offsetLng.value = userInfo.value.coordinateOffset.lng || 0
  }
  else {
    // 如果没有保存的校准值，应用默认校准值
    const defaultLat = -290
    const defaultLng = 500
    if (offsetLat.value !== defaultLat || offsetLng.value !== defaultLng) {
      offsetLat.value = defaultLat
      offsetLng.value = defaultLng
      // 自动保存默认校准值
      saveCoordinateOffset(defaultLat, defaultLng)
    }
  }
})

// 自动保存校准值
watchEffect(() => {
  if (offsetLat.value !== 0 || offsetLng.value !== 0) {
    saveCoordinateOffset(offsetLat.value, offsetLng.value)
  }
})

// Methods
function closeModal() {
  emit('close')
}

function resetCalibration() {
  offsetLat.value = 0
  offsetLng.value = 0
  saveCoordinateOffset(0, 0)
  showSuccessToast('坐标校准已重置')
}

function clampOffset(value) {
  return Math.max(-maxOffset, Math.min(maxOffset, value))
}

function handleLatOffsetChange(event) {
  offsetLat.value = clampOffset(Number.parseInt(event.target.value) || 0)
}

function handleLngOffsetChange(event) {
  offsetLng.value = clampOffset(Number.parseInt(event.target.value) || 0)
}

function handleLatSliderChange(event) {
  offsetLat.value = clampOffset(Number.parseInt(event.target.value) || 0)
}

function handleLngSliderChange(event) {
  offsetLng.value = clampOffset(Number.parseInt(event.target.value) || 0)
}

function formatOffset(offset) {
  if (offset > 0) {
    return `+${offset}m`
  }
  else if (offset < 0) {
    return `${offset}m`
  }
  else {
    return '0m'
  }
}

// 标签页切换
function switchTab(tab) {
  activeTab.value = tab
  if (tab === 'calibration') {
    document.querySelector('button[title="重置视图"]').click()
  }
}

// 打卡范围调整方法
function handleRangeInput(event) {
  const target = event.target
  setSearchRange(Number.parseInt(target.value))
}

// 设置预设范围
function setPresetRange(range) {
  setSearchRange(range)
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal-content" :class="{ 'op-70': activeTab === 'calibration' }" @click.stop>
      <div class="modal-header">
        <h3>位置设置</h3>
        <button class="close-btn" @click="closeModal">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- 标签页导航 -->
        <div class="tabs-nav">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'range' }"
            @click="switchTab('range')"
          >
            <span class="tab-icon">🔍</span>
            打卡范围
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'calibration' }"
            @click="switchTab('calibration')"
          >
            <span class="tab-icon">📍</span>
            坐标校准
          </button>
        </div>

        <!-- 打卡范围调整标签页 -->
        <div v-if="activeTab === 'range'" class="tab-content">
          <div class="range-section">
            <div class="info-section">
              <div class="info-icon">
                🔍
              </div>
              <div class="info-content">
                <h4>打卡范围设置</h4>
                <p>调整您的打卡检测范围，范围越大越容易找到可打卡的地点。</p>
              </div>
            </div>

            <div class="range-display">
              <span class="current-range">{{ formatRange(searchRange) }}</span>
              <span class="range-level">{{ getRangeLevel(searchRange) }}</span>
            </div>

            <div class="slider-container">
              <input
                type="range"
                :min="minRange"
                :max="maxRange"
                :value="searchRange"
                step="100"
                class="range-slider"
                @input="handleRangeInput"
              >
              <div class="slider-labels">
                <span class="label-min">{{ formatRange(minRange) }}</span>
                <span class="label-max">{{ formatRange(maxRange) }}</span>
              </div>
            </div>

            <div class="range-actions">
              <button class="preset-btn" @click="setPresetRange(1000)">
                1km
              </button>
              <button class="preset-btn" @click="setPresetRange(2000)">
                2km
              </button>
              <button class="preset-btn" @click="setPresetRange(3000)">
                3km
              </button>
            </div>

            <div class="range-info">
              <div class="info-note">
                <div class="note-icon">
                  💡
                </div>
                <div class="note-text">
                  <p>• 范围越小，定位越精确</p>
                  <p>• 范围越大，可打卡地点越多</p>
                  <p>• 建议根据实际需要调整</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 坐标校准标签页 -->
        <div v-if="activeTab === 'calibration'" class="tab-content">
          <div class="calibration-info">
            <div class="info-section">
              <div class="info-icon">
                📍
              </div>
              <div class="info-content">
                <h4>坐标校准功能</h4>
                <p>手动调整您的位置坐标，允许在±800米范围内进行微调。调整后的坐标将用于打卡和距离计算。</p>
              </div>
            </div>

            <div v-if="hasCoordinateOffset" class="current-offset">
              <div class="offset-status">
                <div class="status-icon">
                  ✅
                </div>
                <div class="status-text">
                  <strong>当前校准状态</strong>
                  <p>纬度偏移: {{ formatOffset(offsetLat) }}</p>
                  <p>经度偏移: {{ formatOffset(offsetLng) }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="calibration-interface">
            <div class="position-info">
              <div class="position-row">
                <span class="label">当前偏移状态:</span>
                <span class="value">
                  <span v-if="offsetLat === 0 && offsetLng === 0" class="no-offset-text">无偏移（使用原始GPS坐标）</span>
                  <span v-else class="offset-text">
                    纬度: {{ formatOffset(offsetLat) }}, 经度: {{ formatOffset(offsetLng) }}
                  </span>
                </span>
              </div>
            </div>

            <div class="offset-controls">
              <div class="offset-group">
                <label>纬度偏移 (北/南方向)</label>
                <div class="offset-direction-hint">
                  正值向北移动，负值向南移动
                </div>
                <div class="slider-container">
                  <div class="slider-labels">
                    <span class="slider-label">南 -{{ maxOffset }}m</span>
                    <span class="slider-label">北 +{{ maxOffset }}m</span>
                  </div>
                  <input
                    :value="offsetLat"
                    type="range"
                    :min="-maxOffset"
                    :max="maxOffset"
                    step="10"
                    class="offset-slider lat-slider"
                    @input="handleLatSliderChange"
                  >
                  <div class="slider-value">
                    {{ formatOffset(offsetLat) }}
                  </div>
                </div>
                <div class="manual-input">
                  <label class="input-label">精确输入:</label>
                  <input
                    v-model.number="offsetLat"
                    type="number"
                    :min="-maxOffset"
                    :max="maxOffset"
                    class="offset-input"
                    placeholder="0"
                    @input="handleLatOffsetChange"
                  >
                  <span class="input-unit">米</span>
                </div>
              </div>

              <div class="offset-group">
                <label>经度偏移 (东/西方向)</label>
                <div class="offset-direction-hint">
                  正值向东移动，负值向西移动
                </div>
                <div class="slider-container">
                  <div class="slider-labels">
                    <span class="slider-label">西 -{{ maxOffset }}m</span>
                    <span class="slider-label">东 +{{ maxOffset }}m</span>
                  </div>
                  <input
                    :value="offsetLng"
                    type="range"
                    :min="-maxOffset"
                    :max="maxOffset"
                    step="10"
                    class="offset-slider lng-slider"
                    @input="handleLngSliderChange"
                  >
                  <div class="slider-value">
                    {{ formatOffset(offsetLng) }}
                  </div>
                </div>
                <div class="manual-input">
                  <label class="input-label">精确输入:</label>
                  <input
                    v-model.number="offsetLng"
                    type="number"
                    :min="-maxOffset"
                    :max="maxOffset"
                    class="offset-input"
                    placeholder="0"
                    @input="handleLngOffsetChange"
                  >
                  <span class="input-unit">米</span>
                </div>
              </div>
            </div>

            <div class="calibration-note">
              <div class="note-icon">
                💡
              </div>
              <div class="note-text">
                <p>• 正值表示向北/向东偏移，负值表示向南/向西偏移</p>
                <p>• 偏移量限制在±800米范围内</p>
                <p>• 校准后的坐标将用于签到和距离计算</p>
              </div>
            </div>

            <div class="modal-actions">
              <button class="btn-secondary" @click="resetCalibration">
                重置校准
              </button>
              <button class="btn-primary" @click="closeModal">
                完成
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 0;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 24px;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.close-btn {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.modal-body {
  padding: 0 24px 24px;
}

.tabs-nav {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 24px;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: none;
  border: none;
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 2px solid transparent;
}

.tab-btn:hover {
  color: #374151;
  background: #f9fafb;
}

.tab-btn.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.tab-icon {
  font-size: 16px;
}

.tab-content {
  min-height: 300px;
}

.range-section {
  text-align: center;
}

.range-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 24px 0;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.current-range {
  font-size: 24px;
  font-weight: 700;
  color: #3b82f6;
}

.range-level {
  font-size: 14px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 4px 8px;
  border-radius: 8px;
}

.slider-container {
  margin-bottom: 20px;
}

.range-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e5e7eb;
  outline: none;
  appearance: none;
  cursor: pointer;
}

.range-slider::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.range-slider::-webkit-slider-thumb:hover {
  background: #2563eb;
  transform: scale(1.1);
}

.range-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: #9ca3af;
}

.range-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.preset-btn {
  flex: 1;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preset-btn:hover {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.range-info {
  margin-top: 16px;
}

.info-note {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #dbeafe;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #3b82f6;
  text-align: left;
}

.calibration-info {
  text-align: center;
}

.info-section {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 32px;
  text-align: left;
}

.info-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.info-content h4 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.info-content p {
  margin: 0;
  color: var(--text-secondary, #6b7280);
  line-height: 1.5;
}

.current-offset,
.no-offset {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.offset-status,
.no-offset {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.status-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.status-text strong {
  display: block;
  font-size: 16px;
  color: var(--text-primary, #111827);
  margin-bottom: 4px;
}

.status-text p {
  margin: 2px 0;
  color: var(--text-secondary, #6b7280);
  font-size: 14px;
}

.calibration-time {
  font-size: 12px !important;
  opacity: 0.8;
}

.offset-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.calibration-interface {
  text-align: left;
}

.position-info {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  border: 1px solid #e9ecef;
}

.position-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.position-row:last-child {
  margin-bottom: 0;
}

.position-row .label {
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
}

.position-row .value {
  font-family: monospace;
  color: var(--text-primary, #111827);
  font-weight: 500;
}

.position-row .value.calibrated {
  color: #3b82f6;
}

.no-offset-text {
  color: #6b7280;
  font-style: italic;
}

.offset-text {
  color: #3b82f6;
  font-weight: 500;
}

.offset-controls {
  margin-bottom: 24px;
}

.offset-group {
  margin-bottom: 32px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.offset-group:last-child {
  margin-bottom: 0;
}

.offset-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #333);
}

.offset-direction-hint {
  font-size: 12px;
  color: var(--text-secondary, #666);
  margin-bottom: 16px;
  font-style: italic;
}

.slider-container {
  margin-bottom: 16px;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.slider-label {
  font-size: 11px;
  color: var(--text-secondary, #666);
  font-weight: 500;
}

.offset-slider {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: #e5e7eb;
  outline: none;
  appearance: none;
  cursor: pointer;
  margin-bottom: 8px;
}

.lat-slider {
  background: linear-gradient(90deg, #ef4444 0%, #f3f4f6 50%, #22c55e 100%);
}

.lng-slider {
  background: linear-gradient(90deg, #f59e0b 0%, #f3f4f6 50%, #3b82f6 100%);
}

.offset-slider::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  border: 3px solid #3b82f6;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
}

.offset-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.lat-slider::-webkit-slider-thumb {
  border-color: #22c55e;
}

.lng-slider::-webkit-slider-thumb {
  border-color: #3b82f6;
}

.offset-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  border: 3px solid #3b82f6;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.lat-slider::-moz-range-thumb {
  border-color: #22c55e;
}

.lng-slider::-moz-range-thumb {
  border-color: #3b82f6;
}

.slider-value {
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: #3b82f6;
  margin-bottom: 8px;
}

.lat-slider + .slider-value {
  color: #22c55e;
}

.lng-slider + .slider-value {
  color: #3b82f6;
}

.manual-input {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.input-label {
  font-size: 13px;
  color: var(--text-secondary, #666);
  font-weight: 500;
  white-space: nowrap;
}

.offset-input {
  width: 80px;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
  background: white;
}

.offset-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.input-unit {
  font-size: 13px;
  color: var(--text-secondary, #666);
  font-weight: 500;
}

.calibration-note {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #dbeafe;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #3b82f6;
  margin-bottom: 24px;
}

.note-icon {
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

.note-text {
  flex: 1;
}

.note-text p {
  margin: 4px 0;
  font-size: 13px;
  color: #1e40af;
  line-height: 1.4;
}

.note-text p:first-child {
  margin-top: 0;
}

.note-text p:last-child {
  margin-bottom: 0;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 12px;
  }

  .modal-content {
    max-height: 95vh;
  }

  .modal-header {
    padding: 20px 20px 0;
    margin-bottom: 20px;
  }

  .modal-body {
    padding: 0 20px 20px;
  }

  .info-section {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .offset-actions {
    flex-direction: column;
  }

  .modal-actions {
    flex-direction: column-reverse;
  }

  .btn-primary,
  .btn-secondary,
  .btn-danger {
    width: 100%;
  }
}

/* Dark mode */
.dark .modal-content {
  background: #1f2937;
}

.dark .tabs-nav {
  border-bottom-color: #374151;
}

.dark .tab-btn {
  color: #9ca3af;
}

.dark .tab-btn:hover {
  color: #d1d5db;
  background: #374151;
}

.dark .tab-btn.active {
  color: #60a5fa;
  border-bottom-color: #60a5fa;
}

.dark .range-display {
  background: #374151;
  border-color: #4b5563;
}

.dark .range-level {
  background: #4b5563;
  color: #d1d5db;
}

.dark .range-slider {
  background: #4b5563;
}

.dark .preset-btn {
  background: #374151;
  border-color: #4b5563;
  color: #d1d5db;
}

.dark .preset-btn:hover {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.dark .info-note {
  background: #1e3a8a;
  border-color: #3b82f6;
}

.dark .note-text p {
  color: #bfdbfe;
}

.dark .modal-header {
  border-color: #374151;
}

.dark .modal-header h3 {
  color: #f9fafb;
}

.dark .close-btn {
  color: #9ca3af;
}

.dark .close-btn:hover {
  background: #374151;
  color: #d1d5db;
}

.dark .info-content h4 {
  color: #f9fafb;
}

.dark .info-content p {
  color: #d1d5db;
}

.dark .current-offset,
.dark .no-offset {
  background: #374151;
  border-color: #4b5563;
}

.dark .status-text strong {
  color: #f9fafb;
}

.dark .status-text p {
  color: #d1d5db;
}

.dark .btn-secondary {
  background: #374151;
  color: #d1d5db;
  border-color: #4b5563;
}

.dark .btn-secondary:hover {
  background: #4b5563;
}

.dark .position-info {
  background: #374151;
  border-color: #4b5563;
}

.dark .position-row .label {
  color: #d1d5db;
}

.dark .position-row .value {
  color: #f9fafb;
}

.dark .offset-group {
  background: #1f2937;
  border-color: #374151;
}

.dark .offset-group label {
  color: #f9fafb;
}

.dark .offset-direction-hint {
  color: #9ca3af;
}

.dark .slider-label {
  color: #9ca3af;
}

.dark .manual-input {
  background: #374151;
  border-color: #4b5563;
}

.dark .input-label {
  color: #d1d5db;
}

.dark .input-unit {
  color: #d1d5db;
}

.dark .offset-input {
  background: #1f2937;
  border-color: #4b5563;
  color: #e5e7eb;
}

.dark .offset-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.dark .lat-slider {
  background: linear-gradient(90deg, #7f1d1d 0%, #374151 50%, #14532d 100%);
}

.dark .lng-slider {
  background: linear-gradient(90deg, #92400e 0%, #374151 50%, #1e3a8a 100%);
}

.dark .calibration-note {
  background: #1e3a8a;
  border-color: #3b82f6;
}

.dark .note-text p {
  color: #bfdbfe;
}
</style>
