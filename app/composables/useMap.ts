import type { MapInstance } from '~/types/amap'
import { mapConfig } from '~/config/map'

/**
 * 地图实例管理 Composable
 * 提供地图操作的封装方法
 */
export function useMap() {
  const mapInstance = ref<MapInstance>()
  const isMapReady = ref(false)

  // 初始化地图
  const initializeMap = (containerId: string) => {
    return new Promise((resolve, reject) => {
      if (!window.AMap) {
        reject(new Error('高德地图API未加载'))
        return
      }

      try {
        // 设置安全密钥
        window._AMapSecurityConfig = {
          securityJsCode: mapConfig.securityJsCode,
        }

        // 创建地图实例
        const map = new window.AMap.Map(containerId, {
          center: mapConfig.center,
          zoom: mapConfig.zoom,
          mapStyle: 'amap://styles/normal',
          viewMode: '3D',
          features: ['bg', 'road', 'building', 'point'],
          resizeEnable: true,
        })

        mapInstance.value = map
        isMapReady.value = true
        resolve(map)
      }
      catch (error) {
        reject(error)
      }
    })
  }

  // 设置地图中心点
  const setCenter = (position: [number, number]) => {
    if (mapInstance.value) {
      mapInstance.value.setCenter(position)
    }
  }

  // 设置地图缩放级别
  const setZoom = (zoom: number) => {
    if (mapInstance.value) {
      mapInstance.value.setZoom(zoom)
    }
  }

  // 设置地图样式
  const setMapStyle = (style: string) => {
    if (mapInstance.value) {
      mapInstance.value.setMapStyle(style)
    }
  }

  // 适应视野显示所有标记
  const fitView = (markers: any[]) => {
    if (mapInstance.value && markers.length > 0) {
      mapInstance.value.setFitView(markers)
    }
  }

  // 添加控件
  const addControl = (control: any) => {
    if (mapInstance.value) {
      mapInstance.value.addControl(control)
    }
  }

  // 移除控件
  const removeControl = (control: any) => {
    if (mapInstance.value) {
      mapInstance.value.removeControl(control)
    }
  }

  // 添加覆盖物
  const addOverlay = (overlay: any) => {
    if (mapInstance.value) {
      mapInstance.value.add(overlay)
    }
  }

  // 移除覆盖物
  const removeOverlay = (overlay: any) => {
    if (mapInstance.value) {
      mapInstance.value.remove(overlay)
    }
  }

  // 清除所有覆盖物
  const clearOverlays = () => {
    if (mapInstance.value) {
      mapInstance.value.clearMap()
    }
  }

  // 销毁地图
  const destroyMap = () => {
    if (mapInstance.value) {
      mapInstance.value.destroy()
      mapInstance.value = undefined
      isMapReady.value = false
    }
  }

  // 获取地图边界
  const getBounds = () => {
    if (mapInstance.value) {
      return mapInstance.value.getBounds()
    }
    return null
  }

  // 获取当前中心点
  const getCenter = () => {
    if (mapInstance.value) {
      return mapInstance.value.getCenter()
    }
    return null
  }

  // 获取当前缩放级别
  const getZoom = () => {
    if (mapInstance.value) {
      return mapInstance.value.getZoom()
    }
    return mapConfig.zoom
  }

  return {
    // 状态
    mapInstance: readonly(mapInstance),
    isMapReady: readonly(isMapReady),

    // 初始化
    initializeMap,

    // 视图控制
    setCenter,
    setZoom,
    setMapStyle,
    fitView,

    // 控件管理
    addControl,
    removeControl,

    // 覆盖物管理
    addOverlay,
    removeOverlay,
    clearOverlays,

    // 信息获取
    getBounds,
    getCenter,
    getZoom,

    // 销毁
    destroyMap,
  }
}
