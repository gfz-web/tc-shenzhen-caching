import type { MapConfig, POIData } from '~/types/amap'

// 高德地图配置
export const mapConfig: MapConfig = {
  key: '918ed0b47e9395a2ebdab4906d8efa42',
  securityJsCode: '231f97d07647d081e9ae4e64681f49e8',
  center: [114.061369, 22.570940], // 深圳中心坐标
  zoom: 12,
  mapStyle: 'amap://styles/normal', // 标准样式
}

// 示例 POI 数据 - 深圳地标
export const samplePOIs: POIData[] = [

]

// 中心点配置
export const centerPoint: POIData = {
  id: 'center',
  name: '数睿科技(深圳)',
  description: '数睿科技深圳办公地点',
  position: [114.061369, 22.570940],
  category: '中心点',
}
