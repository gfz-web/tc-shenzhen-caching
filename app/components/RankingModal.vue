<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUserInfo } from '~/composables/useUserInfo'
import UserCheckinRecordsModal from './UserCheckinRecordsModal.vue'

interface Props {
  visible: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { userInfo } = useUserInfo()

// 奖励配置
const rewardConfig = [
  { rank: [1, 5], reward: '冲锋衣', icon: '🧥' },
  { rank: [6, 10], reward: '露营车', icon: '🚗' },
  { rank: [11, 15], reward: '充电宝', icon: '🔋' },
  { rank: [16, 30], reward: '折叠桌椅', icon: '🪑' },
  { rank: [31, 45], reward: '登山杖', icon: '🥾' },
  { rank: [46, 60], reward: '晴雨伞', icon: '☂️' },
  { rank: [61, 75], reward: '充气沙发', icon: '🛋️' },
  { rank: [76, Infinity], reward: '露营灯', icon: '💡' },
]

// 排行榜数据
const userScores = ref<Array<{
  employeeId: string
  employeeName: string
  totalScore: number
  checkinCount: number
  lastCheckinTime: string
}>>([])

const loading = ref(false)
const error = ref<string | null>(null)

// 用户打卡记录弹窗相关状态
const showUserRecordsModal = ref(false)
const selectedUserId = ref('')
const selectedUserName = ref('')

// 获取排行榜数据
async function fetchRankingData() {
  if (loading.value)
    return

  loading.value = true
  error.value = null

  try {
    const response = await $fetch('/api/checkin/ranking')

    if (response.success) {
      userScores.value = response.data
    }
    else {
      throw new Error('获取排行榜数据失败')
    }
  }
  catch (err: any) {
    console.error('获取排行榜失败:', err)
    error.value = err.message || '网络错误，请稍后重试'
    userScores.value = []
  }
  finally {
    loading.value = false
  }
}

// 获取当前用户排名
const currentUserRank = computed(() => {
  if (!userInfo.value.employeeId || userScores.value.length === 0)
    return null

  const index = userScores.value.findIndex(
    user => user.employeeId === userInfo.value.employeeId,
  )
  return index >= 0 ? index + 1 : null
})

// 获取当前用户积分
const currentUserScore = computed(() => {
  if (!userInfo.value.employeeId || userScores.value.length === 0)
    return null

  return userScores.value.find(
    user => user.employeeId === userInfo.value.employeeId,
  ) || null
})

// 获取排名图标
function getRankIcon(rank: number): string {
  switch (rank) {
    case 1: return '🥇'
    case 2: return '🥈'
    case 3: return '🥉'
    default: return '🎖️'
  }
}

// 获取奖励标签
function getRewardTag(rank: number): { reward: string, icon: string } | null {
  for (const config of rewardConfig) {
    if (config.rank && config.rank.length >= 2) {
      const minRank = config.rank[0] ?? 0
      const maxRank = config.rank[1] ?? Infinity
      if (rank >= minRank && rank <= maxRank) {
        return { reward: config.reward, icon: config.icon }
      }
    }
  }
  return null
}

// 格式化时间
function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) {
    return `${diffDays}天前`
  }
  else if (diffHours > 0) {
    return `${diffHours}小时前`
  }
  else {
    return '刚刚'
  }
}

// 关闭弹窗
function onClose() {
  emit('close')
}

// 查看用户打卡记录
function viewUserRecords(user: { employeeId: string, employeeName: string }) {
  selectedUserId.value = user.employeeId
  selectedUserName.value = user.employeeName
  showUserRecordsModal.value = true
}

// 关闭用户打卡记录弹窗
function closeUserRecordsModal() {
  showUserRecordsModal.value = false
  selectedUserId.value = ''
  selectedUserName.value = ''
}

// 监听弹窗显示状态，处理页面滚动和数据获取
watch(() => props.visible, (visible) => {
  if (visible) {
    document.body.style.overflow = 'hidden'
    // 弹窗显示时获取最新排行榜数据
    fetchRankingData()
  }
  else {
    document.body.style.overflow = ''
  }
})

// 组件卸载时恢复页面滚动
onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="ranking-modal-overlay" @click="onClose">
      <div class="ranking-modal" @click.stop>
        <div class="modal-header">
          <h3>🏆 打卡积分排行榜</h3>
          <button class="close-btn" @click="onClose">
            ×
          </button>
        </div>

        <div class="modal-body">
          <!-- 当前用户信息 -->
          <div v-if="currentUserScore" class="current-user-card">
            <div class="user-avatar">
              <span class="avatar-icon">{{ getRankIcon(currentUserRank || 0) }}</span>
            </div>
            <div class="user-info">
              <div class="user-name">
                {{ currentUserScore.employeeName }}({{ currentUserScore.employeeId }})
              </div>
              <div class="user-rank">
                第{{ currentUserRank }}名 · {{ currentUserScore.totalScore }}分 · {{ currentUserScore.checkinCount }}次打卡
              </div>
            </div>
          </div>

          <!-- 积分规则说明 -->
          <div class="score-rules">
            <div class="rules-title">
              💡 积分规则
            </div>
            <div class="rules-list">
              <div class="rule-item">
                POI基础分：1-5分（景点本身评级）
              </div>
              <div class="rule-item">
                距离奖励：0-5分（距离中心越远分越高）
              </div>
              <div class="rule-item">
                结伴加分：2人及以上每多1人加1分，最多5分
              </div>
              <div class="rule-item">
                彩蛋奖励：特定时段额外加分
              </div>
            </div>
          </div>

          <!-- 排行榜 -->
          <div class="ranking-list">
            <div class="ranking-header">
              <div class="ranking-title">
                🎯 全员排行榜
              </div>
              <div class="total-users">
                共{{ userScores.length }}位打卡者
              </div>
            </div>

            <!-- 加载状态 -->
            <div v-if="loading" class="loading-ranking">
              <div class="loading-icon">
                ⏳
              </div>
              <div class="loading-text">
                正在加载排行榜...
              </div>
            </div>

            <!-- 错误状态 -->
            <div v-else-if="error" class="error-ranking">
              <div class="error-icon">
                ⚠️
              </div>
              <div class="error-text">
                {{ error }}
              </div>
              <button class="retry-btn" @click="fetchRankingData">
                🔄 重试
              </button>
            </div>

            <!-- 空状态 -->
            <div v-else-if="userScores.length === 0" class="empty-ranking">
              <div class="empty-icon">
                📊
              </div>
              <div class="empty-text">
                暂无打卡记录
              </div>
              <div class="empty-hint">
                成为第一个打卡的人吧！
              </div>
            </div>

            <div v-else class="ranking-items">
              <div
                v-for="(user, index) in userScores"
                :key="user.employeeId"
                class="ranking-item"
                :class="{
                  'is-current-user': user.employeeId === userInfo.employeeId,
                  'is-top-three': index < 3,
                }"
                @click="viewUserRecords(user)"
              >
                <div class="rank-number">
                  <span class="rank-icon">{{ getRankIcon(index + 1) }}</span>
                  <span class="rank-text">{{ index + 1 }}</span>
                </div>

                <div class="user-info">
                  <div class="user-name">
                    {{ user.employeeName }}({{ user.employeeId }})
                  </div>
                  <div class="user-meta flex gap-1 items-center">
                    <span class="last-checkin">{{ formatTime(user.lastCheckinTime) }}</span>
                    <div v-if="getRewardTag(index + 1)" class="user-reward-tag">
                      <span class="reward-text text-12px!">{{ getRewardTag(index + 1)!.icon }} {{ getRewardTag(index + 1)!.reward }}</span>
                    </div>
                  </div>
                </div>

                <div class="user-stats">
                  <div class="total-score">
                    {{ user.totalScore }}分
                  </div>
                  <div class="checkin-count">
                    {{ user.checkinCount }}次
                  </div>
                </div>

                <div class="view-records-hint">
                  <span class="hint-icon">👁️</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 用户打卡记录弹窗 -->
    <UserCheckinRecordsModal
      :visible="showUserRecordsModal"
      :user-id="selectedUserId"
      :user-name="selectedUserName"
      @close="closeUserRecordsModal"
    />
  </Teleport>
</template>

<style scoped>
/* 弹窗遮罩 */
.ranking-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

/* 弹窗主体 */
.ranking-modal {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

/* 弹窗头部 */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 16px;
  border-bottom: 1px solid var(--gray-border, #e9ecef);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary, #666);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--gray-light, #f8f9fa);
  color: var(--text-primary, #333);
}

/* 弹窗内容 */
.modal-body {
  padding: 20px 24px 24px;
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* 当前用户信息卡片 */
.current-user-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 16px;
  color: white;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2);
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-icon {
  font-size: 24px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-rank {
  font-size: 13px;
  opacity: 0.9;
  font-weight: 400;
}

.user-reward {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  font-size: 14px;
}

.reward-text {
  font-size: 14px;
}

/* 积分规则 */
.score-rules {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.rules-title {
  font-size: 14px;
  font-weight: 600;
  color: #495057;
  margin-bottom: 12px;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rule-item {
  font-size: 13px;
  color: #6c757d;
  padding-left: 16px;
  position: relative;
}

.rule-item::before {
  content: '•';
  position: absolute;
  left: 0;
  color: #007bff;
  font-weight: bold;
}

/* 排行榜 */
.ranking-list {
  background: #f8f9fa;
  border-radius: 8px;
  overflow: hidden;
}

.ranking-header {
  background: white;
  padding: 16px 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ranking-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.total-users {
  font-size: 12px;
  color: #6c757d;
  background: #e9ecef;
  padding: 4px 8px;
  border-radius: 12px;
}

/* 加载状态 */
.loading-ranking {
  padding: 40px 20px;
  text-align: center;
}

.loading-icon {
  font-size: 48px;
  margin-bottom: 16px;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 16px;
  color: #6c757d;
}

/* 错误状态 */
.error-ranking {
  padding: 40px 20px;
  text-align: center;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-text {
  font-size: 16px;
  color: #dc3545;
  margin-bottom: 16px;
}

.retry-btn {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.retry-btn:hover {
  background: #0056b3;
}

/* 空状态 */
.empty-ranking {
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  color: #495057;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 14px;
  color: #6c757d;
}

.ranking-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
}

.ranking-item:hover {
  background: #f8f9fa;
  transform: translateX(2px);
}

.ranking-item:hover .view-records-hint {
  opacity: 1;
}

.ranking-item.is-current-user {
  background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
  border-left: 4px solid #2196f3;
}

.ranking-item.is-top-three {
  background: #f8f9fa;
  border-left: 3px solid #ffd700;
}

.rank-number {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 60px;
  margin-right: 16px;
}

.rank-icon {
  font-size: 20px;
}

.rank-text {
  font-size: 14px;
  font-weight: 600;
  color: #495057;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-info .user-name {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.user-meta {
  font-size: 12px;
  color: #6c757d;
}

.user-stats {
  text-align: right;
  min-width: 80px;
  margin-right: 40px; /* 为眼睛图标留出空间 */
}

.total-score {
  font-size: 18px;
  font-weight: 600;
  color: #007bff;
  margin-bottom: 2px;
}

.checkin-count {
  font-size: 12px;
  color: #6c757d;
}

.user-reward-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
  color: #1976d2;
}

/* 查看记录提示 */
.view-records-hint {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.2s ease;
  background: rgba(0, 123, 255, 0.1);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.hint-icon {
  font-size: 14px;
  color: #007bff;
}

/* 深色模式 */
.dark .ranking-modal {
  background: #1f2937;
  color: #f9fafb;
}

.dark .modal-header {
  border-bottom-color: #374151;
}

.dark .modal-header h3 {
  color: #f9fafb;
}

.dark .close-btn {
  color: #9ca3af;
}

.dark .close-btn:hover {
  background: #374151;
  color: #f9fafb;
}

.dark .score-rules {
  background: #374151;
}

.dark .rules-title {
  color: #e5e7eb;
}

.dark .rule-item {
  color: #9ca3af;
}

.dark .easter-egg-rule {
  background: linear-gradient(135deg, #451a03, #92400e);
  border-color: #f59e0b;
  color: #fbbf24;
}

.dark .ranking-list {
  background: #374151;
}

.dark .ranking-header {
  background: #1f2937;
  border-bottom-color: #4b5563;
}

.dark .ranking-title {
  color: #f9fafb;
}

.dark .total-users {
  background: #4b5563;
  color: #d1d5db;
}

.dark .ranking-item {
  background: #1f2937;
  border-bottom: 1px solid #4b5563;
}

.dark .ranking-item:hover {
  background: #374151;
}

.dark .ranking-item.is-current-user {
  background: linear-gradient(135deg, #1e3a8a, #581c87);
  border-left-color: #3b82f6;
}

.dark .ranking-item.is-top-three {
  background: #374151;
  border-left: 3px solid #fbbf24;
}

.dark .user-info .user-name {
  color: #f9fafb;
}

.dark .user-meta {
  color: #9ca3af;
}

.dark .rank-text {
  color: #d1d5db;
}

.dark .total-score {
  color: #60a5fa;
}

.dark .checkin-count {
  color: #9ca3af;
}

.dark .user-reward-tag {
  background: #1e3a8a;
  color: #93c5fd;
  border-color: #3b82f6;
}

.dark .view-records-hint {
  background: rgba(59, 130, 246, 0.1);
}

.dark .hint-icon {
  color: #60a5fa;
}

.dark .empty-text {
  color: #e5e7eb;
}

.dark .empty-hint {
  color: #9ca3af;
}

.dark .loading-text {
  color: #9ca3af;
}

.dark .error-text {
  color: #ef4444;
}

.dark .retry-btn {
  background: #3b82f6;
}

.dark .retry-btn:hover {
  background: #2563eb;
}

.dark .current-user-card {
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.2);
  position: sticky;
  top: 0;
  z-index: 9;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .ranking-modal-overlay {
    padding: 12px;
    align-items: flex-start;
    padding-top: 5vh;
  }

  .ranking-modal {
    max-height: calc(95vh - 5vh);
  }

  .modal-header {
    padding: 20px 20px 16px;
  }

  .modal-header h3 {
    font-size: 16px;
  }

  .modal-body {
    padding: 16px 20px calc(20px + env(safe-area-inset-bottom));
  }

  .current-user-info {
    padding: 16px;
  }

  .user-rank-icon {
    font-size: 32px;
  }

  .user-name {
    font-size: 18px;
  }

  .current-user-card {
    padding: 14px 16px;
  }

  .user-avatar {
    width: 40px;
    height: 40px;
  }

  .avatar-icon {
    font-size: 20px;
  }

  .user-name {
    font-size: 15px;
  }

  .user-rank {
    font-size: 12px;
  }

  .ranking-item {
    padding: 12px 16px;
  }

  .rank-number {
    min-width: 50px;
    margin-right: 12px;
  }

  .user-stats {
    min-width: 60px;
    margin-right: 32px; /* 移动端减少右边距 */
  }

  .total-score {
    font-size: 16px;
  }
}

/* 小屏幕优化 */
@media (max-width: 480px) {
  .ranking-modal-overlay {
    padding: 8px;
    padding-top: 3vh;
  }

  .ranking-modal {
    max-height: calc(97vh - 3vh);
  }

  .modal-header {
    padding: 16px 16px 12px;
  }

  .modal-body {
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
  }

  .current-user-header {
    gap: 12px;
  }

  .ranking-header {
    padding: 12px 16px;
  }

  .ranking-item {
    padding: 10px 12px;
  }

  .user-stats {
    margin-right: 28px; /* 小屏幕进一步减少右边距 */
  }

  .view-records-hint {
    width: 24px;
    height: 24px;
    right: 6px;
  }

  .hint-icon {
    font-size: 12px;
  }
}
</style>
