<script setup lang="ts">
// Props
interface Props {
  developerMode?: boolean
  showDeveloperButton?: boolean
}

const _props = withDefaults(defineProps<Props>(), {
  developerMode: false,
})

// Emits
const emit = defineEmits<{
  resetView: []
  toggleDarkMode: []
  toggleDeveloper: []
  editUserInfo: []
  showRanking: []
  showCoordinateCalibration: []
  showAudit: []
  showEasterEgg: []
  showCheckinMap: []
}>()
</script>

<template>
  <div class="map-controls">
    <button
      id="tour-reset-view"
      class="control-btn"
      title="重置视图"
      @click="emit('resetView')"
    >
      🎯
    </button>
    <button
      id="tour-toggle-dark"
      class="control-btn"
      title="切换深色模式"
      @click="emit('toggleDarkMode')"
    >
      🌓
    </button>
    <button
      v-if="showDeveloperButton"
      id="tour-developer-mode"
      class="control-btn"
      :class="{ active: developerMode }"
      title="开发者模式"
      @click="emit('toggleDeveloper')"
    >
      🔧
    </button>
    <button
      id="tour-edit-user"
      class="control-btn"
      title="编辑用户信息"
      @click="emit('editUserInfo')"
    >
      👤
    </button>
    <button
      id="tour-coordinate-calibration"
      class="control-btn"
      title="位置设置"
      @click="emit('showCoordinateCalibration')"
    >
      📍
    </button>
    <button
      id="tour-ranking"
      class="control-btn"
      title="打卡积分排名"
      @click="emit('showRanking')"
    >
      🏆
    </button>
    <button
      id="tour-easter-egg"
      class="control-btn"
      title="彩蛋时间"
      @click="emit('showEasterEgg')"
    >
      ⏰
    </button>
    <button
      id="tour-checkin-map"
      class="control-btn"
      title="全员打卡地图"
      @click="emit('showCheckinMap')"
    >
      🗺️
    </button>
    <button
      v-if="showDeveloperButton"
      id="tour-audit"
      class="control-btn"
      title="审核打卡记录"
      @click="emit('showAudit')"
    >
      🔍
    </button>
  </div>
</template>

<style scoped>
.map-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1002;
}

.control-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: #ffffff;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.control-btn:hover {
  background: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.control-btn.active {
  background: #667eea;
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* 深色模式下的控制按钮样式 */
.dark .control-btn {
  background: rgba(45, 45, 45);
  color: #e5e5e5;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.dark .control-btn:hover {
  background: rgba(60, 60, 60);
  color: white;
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.dark .control-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .map-controls {
    top: 12px;
    right: 12px;
  }

  .control-btn {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }
}
</style>
