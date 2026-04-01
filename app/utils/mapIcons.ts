/**
 * 地图图标工具函数
 * 创建各种类型的地图标记图标
 */

// 创建中心点图标
export function createCenterIcon(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="12" fill="#ff4757" stroke="#fff" stroke-width="2"/>
      <circle cx="16" cy="16" r="4" fill="#fff"/>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// 创建公园图标
export function createParkIcon(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle transform="translate(3, 3)" cx="14" cy="14" r="14" fill="#F76560" stroke="#fff" stroke-width="2"/>
      <path transform="scale(0.8) translate(9, 9)" fill="#fff" d="M17.9 22a4 4 0 1 0 0-8h-.22l-5.802 5.798a1.22 1.22 0 0 0-.378.883c0 .713.577 1.319 1.29 1.319zM13.284 4.959l-1.055 1.055a2.5 2.5 0 0 0-.729 1.76v8.238c0 1.055 0 1.582.313 1.708c.314.126.679-.255 1.409-1.016l5.838-6.09a4.042 4.042 0 0 0-5.776-5.655"/>
      <path transform="scale(0.8) translate(9, 9)" fill="#fff" fill-rule="evenodd" d="M10 6v12a4 4 0 0 1-8 0V6a4 4 0 1 1 8 0M6 19a1 1 0 1 0 0-2a1 1 0 0 0 0 2" clip-rule="evenodd"/>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// 创建景点图标
export function createAttractionIcon(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle transform="translate(3, 3)" cx="14" cy="14" r="14" fill="#155DFF" stroke="#fff" stroke-width="2"/>
      <g fill="#fff" transform="scale(0.52) translate(9, 8)">
        <path d="M35 9.5a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0"/>
        <path fill-rule="evenodd" d="M31.5 11a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3m0 2a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7M19 16a2 2 0 1 0 0 4h7v20a2 2 0 1 0 4 0v-9h3v9a2 2 0 1 0 4 0V27.917A6.002 6.002 0 0 0 36 16zm20 6a2 2 0 0 0-2-2v4a2 2 0 0 0 2-2" clip-rule="evenodd"/>
        <path fill-rule="evenodd" d="M6 32a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zm4 7v-6h2v6zm7-6v6h2v-6zm-6-5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2h-2v-2h-3v2h-2z" clip-rule="evenodd"/>
      </g>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// 创建山图标
export function createMountainIcon(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle transform="translate(3, 3)" cx="14" cy="14" r="14" fill="#FF9A2F" stroke="#fff" stroke-width="2"/>
      <path transform="scale(0.8) translate(9, 9)" fill="#fff" d="m6.18 10.95l2.54 3.175l.084.093a1 1 0 0 0 1.403-.01l1.637-1.638l1.324 1.985a1 1 0 0 0 1.457.226l3.632-2.906l3.647 7.697A1 1 0 0 1 21 21H3a1 1 0 0 1-.904-1.428zM12 3.072a3.3 3.3 0 0 1 2.983 1.888l2.394 5.057l-3.15 2.52l-1.395-2.092l-.075-.099a1 1 0 0 0-1.464-.053l-1.711 1.709l-1.301-1.627L7.13 8.94l1.888-3.98A3.3 3.3 0 0 1 12 3.072"/>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// 创建用户位置图标
export function createUserLocationIcon(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <!-- 外圈脉冲效果 -->
      <circle cx="18" cy="18" r="16" fill="#007bff" opacity="0.3">
        <animate attributeName="r" values="12;18;12" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2s" repeatCount="indefinite"/>
      </circle>
      <!-- 中间圈 -->
      <circle cx="18" cy="18" r="12" fill="#007bff" stroke="#fff" stroke-width="3"/>
      <!-- 内圈指示器 -->
      <circle cx="18" cy="18" r="4" fill="#fff"/>
      <!-- 中心点 -->
      <circle cx="18" cy="18" r="2" fill="#007bff"/>
      <!-- 方向指示箭头 -->
      <path d="M18 8 L22 14 L18 12 L14 14 Z" fill="#fff" opacity="0.9"/>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// 创建已打卡的旗帜图标
export function createCheckedInIcon(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#FFD700" stroke="#fff" stroke-width="2"/>
      <g fill="#fff" transform="scale(0.9) translate(7, 6)">
        <path d="M3 5a1 1 0 0 1 1-1h12a1 1 0 0 1 .8.4l3 4a1 1 0 0 1 0 1.2l-3 4a1 1 0 0 1-.8.4H4a1 1 0 0 1-1-1V5Z"/>
        <path d="M3 14v6a1 1 0 0 0 2 0v-6"/>
      </g>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// 创建选中位置的图标
export function createPickedIcon(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#ffd700" stroke="#ff6b00" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="#ff6b00"/>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// 创建彩蛋激活状态图标
export function createEasterEggActiveIcon(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#eebbc9" stroke="#fff" stroke-width="2"/>
      <text x="16" y="22" text-anchor="middle" font-size="14" fill="#eebbc9">🎁</text>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// 根据类型创建POI图标
export function createPOIIcon(category: string, isCheckedIn: boolean = false, easterEggStatus?: 'active' | 'inactive'): string {
  // 如果已打卡，显示金色旗帜
  if (isCheckedIn) {
    return createCheckedInIcon()
  }

  // 如果有彩蛋状态
  if (easterEggStatus === 'active') {
    return createEasterEggActiveIcon()
  }

  // 否则根据类型显示对应图标
  return getBasePOIIcon(category)
}

// 获取基础POI图标
function getBasePOIIcon(category: string): string {
  switch (category) {
    case '公园':
      return createParkIcon()
    case '景点':
      return createAttractionIcon()
    case '山脉':
      return createMountainIcon()
    default:
      return createAttractionIcon()
  }
}

// 为POI图标添加彩蛋提示
function createPOIWithEasterEggHint(baseIcon: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <!-- 淡化的彩蛋提示环 -->
      <circle cx="16" cy="16" r="13" fill="none" stroke="#ffc107" stroke-width="1" stroke-dasharray="2,2" opacity="0.4"/>
      <!-- 小彩蛋提示图标 -->
      <text x="24" y="10" text-anchor="middle" font-size="8" fill="#ffc107" opacity="0.6">🎁</text>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// 图标尺寸配置
export const ICON_SIZES = {
  center: { width: 32, height: 32 },
  poi: { width: 28, height: 28 },
  userLocation: { width: 36, height: 36 },
  picked: { width: 24, height: 24 },
} as const
