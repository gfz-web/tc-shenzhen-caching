// 高德地图 TypeScript 类型定义

declare global {
  interface Window {
    AMap: any
    _AMapSecurityConfig: {
      securityJsCode: string
    }
    closeInfoWindow: () => void
    deletePOI: (id: string) => Promise<void>
    editPOI: (id: string) => void
    openPhotoModal: (photoUrl: string) => void
  }
}

export interface MapConfig {
  key: string
  securityJsCode: string
  center: [number, number]
  zoom: number
  mapStyle: string
}

export interface DateTimeSlot {
  readonly start_datetime: string // YYYY-MM-DDTHH:mm format
  readonly end_datetime: string // YYYY-MM-DDTHH:mm format
}

export interface DailyTimeSlot {
  readonly start_time: string // HH:mm format
  readonly end_time: string // HH:mm format
}

export type TimeSlot = DateTimeSlot | DailyTimeSlot

export interface EasterEgg {
  readonly id: string
  readonly time_slots: readonly TimeSlot[] // 时间段配置
  readonly bonus_score: number
  readonly icon?: string
  readonly description?: string
}

export interface POIData {
  id: string
  name: string
  description?: string
  rating?: number
  position: [number, number]
  category?: string
  referencePhoto?: string // 打卡参考照片URL
  easter_egg?: EasterEgg // 彩蛋配置
  // 距离相关字段 (运行时动态计算)
  distance?: number // 到参考点的距离（公里）
  distanceScore?: number // 基于距离的阶梯评分 (1-5)
  totalScore?: number // 综合分数 (基础评分 + 距离分数)
}

export interface MapMarker {
  id: string
  marker: any // AMap.Marker 实例
  data: POIData
}

export interface InfoWindowData {
  title: string
  content: string
  position: [number, number]
}

export type MapInstance = any // AMap.Map 实例类型
