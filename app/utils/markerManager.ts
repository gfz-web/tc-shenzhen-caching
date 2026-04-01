/**
 * 地图标记管理器
 * 统一管理地图上的各种标记
 */
import type { MapInstance, MapMarker, POIData } from '~/types/amap'
import { centerPoint } from '~/config/map'
import { createInfoWindowContent, setupInfoWindowGlobalMethods } from '~/utils/infoWindow'
import {
  createCenterIcon,
  createPickedIcon,
  createPOIIcon,
  createUserLocationIcon,
  ICON_SIZES,
} from '~/utils/mapIcons'
import { isEasterEggActive } from '~/utils/scoreCalculation'

export interface MarkerManagerOptions {
  map: MapInstance
  infoWindow: any
  showCenter?: boolean
  developerMode?: boolean
  isPOICheckedIn?: (poiId: string) => boolean
  getPersonalCheckinCount?: (poiId: string) => number
  editPOI?: (poi: POIData) => void
  deletePOI?: (id: string) => Promise<boolean>
  onPositionSelected?: (position: { lng: number, lat: number }) => void
  onInfoWindowToggle?: (isOpen: boolean) => void
  onPOIClick?: (poi: POIData) => void
  onSuccess?: (message: string) => void
  onError?: (title: string, message?: string) => void
}

export class MarkerManager {
  private map: MapInstance
  private infoWindow: any
  private markers: MapMarker[] = []
  private userLocationMarker: any = null
  private pickedMarker: any = null
  private rangeCircle: any = null
  private currentInfoWindowData: Ref<POIData | null>
  private options: MarkerManagerOptions

  constructor(options: MarkerManagerOptions) {
    this.map = options.map
    this.infoWindow = options.infoWindow
    this.options = options

    // 在构造函数中初始化 ref
    this.currentInfoWindowData = ref(null)

    // 设置全局方法
    this.setupGlobalMethods()

    // 添加地图点击事件监听
    this.map.on('click', this.onMapClick.bind(this))

    // 添加信息窗体关闭事件监听
    this.infoWindow.on('close', () => {
      if (this.currentInfoWindowData) {
        this.currentInfoWindowData.value = null
      }
      // 通知信息窗口已关闭
      if (this.options.onInfoWindowToggle) {
        this.options.onInfoWindowToggle(false)
      }
    })
  }

  // 添加所有标记
  addMarkers(pois: POIData[]) {
    // 清除现有标记
    this.clearMarkers()

    // 更新全局方法，传入最新的POI数据
    this.setupGlobalMethods(pois)

    // 添加中心点标记
    if (this.options.showCenter) {
      this.addCenterMarker()
    }

    // 添加 POI 标记
    pois.forEach((poi) => {
      this.addPOIMarker(poi)
    })
  }

  // 添加中心点标记
  private addCenterMarker() {
    const centerMarker = new window.AMap.Marker({
      position: centerPoint.position,
      icon: new window.AMap.Icon({
        image: createCenterIcon(),
        size: new window.AMap.Size(ICON_SIZES.center.width, ICON_SIZES.center.height),
        imageSize: new window.AMap.Size(ICON_SIZES.center.width, ICON_SIZES.center.height),
      }),
      title: centerPoint.name,
      anchor: 'center',
    })

    centerMarker.on('click', () => {
      if (this.options.onPOIClick) {
        this.options.onPOIClick(centerPoint)
      }
      else {
        // 保持向后兼容
        this.showInfoWindow(centerPoint, centerPoint.position)
      }
    })

    this.map.add(centerMarker)

    this.markers.push({
      id: centerPoint.id,
      marker: centerMarker,
      data: centerPoint,
    })
  }

  // 添加 POI 标记
  private addPOIMarker(poi: POIData) {
    // 检查是否已打卡
    const isCheckedIn = this.options.isPOICheckedIn ? this.options.isPOICheckedIn(poi.id) : false

    // 检查彩蛋状态
    let easterEggStatus: 'active' | 'inactive' | undefined
    if (poi.easter_egg) {
      easterEggStatus = isEasterEggActive(poi.easter_egg) ? 'active' : 'inactive'
    }

    const poiMarker = new window.AMap.Marker({
      position: poi.position,
      icon: new window.AMap.Icon({
        image: createPOIIcon(poi.category || '景点', isCheckedIn, easterEggStatus),
        size: new window.AMap.Size(ICON_SIZES.poi.width, ICON_SIZES.poi.height),
        imageSize: new window.AMap.Size(ICON_SIZES.poi.width, ICON_SIZES.poi.height),
      }),
      title: poi.name,
      anchor: 'center',
    })

    poiMarker.on('click', () => {
      if (this.options.onPOIClick) {
        this.options.onPOIClick(poi)
      }
      else {
        // 保持向后兼容
        this.showInfoWindow(poi, poi.position)
      }
    })

    this.map.add(poiMarker)

    this.markers.push({
      id: poi.id,
      marker: poiMarker,
      data: poi,
    })
  }

  // 添加用户位置标记
  addUserLocationMarker(position: { lat: number, lng: number }) {
    // 如果已存在用户位置标记，先移除
    this.removeUserLocationMarker()

    const userMarker = new window.AMap.Marker({
      position: [position.lng, position.lat],
      icon: new window.AMap.Icon({
        image: createUserLocationIcon(),
        size: new window.AMap.Size(ICON_SIZES.userLocation.width, ICON_SIZES.userLocation.height),
        imageSize: new window.AMap.Size(ICON_SIZES.userLocation.width, ICON_SIZES.userLocation.height),
      }),
      title: '我的位置',
      anchor: 'center',
      zIndex: 999,
      clickable: false,
    })

    this.map.add(userMarker)
    this.userLocationMarker = userMarker
  }

  // 移除用户位置标记
  removeUserLocationMarker() {
    if (this.userLocationMarker) {
      this.map.remove(this.userLocationMarker)
      this.userLocationMarker = null
    }
  }

  // 添加/更新范围圆圈
  updateRangeCircle(position: { lat: number, lng: number }, range: number, show: boolean = true) {
    // 移除现有的圆圈
    this.removeRangeCircle()

    // 如果不需要显示圆圈，直接返回
    if (!show)
      return

    // 创建新的圆圈
    this.rangeCircle = new window.AMap.Circle({
      center: [position.lng, position.lat],
      radius: range,
      strokeColor: '#3b82f6',
      strokeWeight: 2,
      strokeOpacity: 0.8,
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      zIndex: 10,
    })

    this.map.add(this.rangeCircle)
  }

  // 移除范围圆圈
  removeRangeCircle() {
    if (this.rangeCircle) {
      this.map.remove(this.rangeCircle)
      this.rangeCircle = null
    }
  }

  // 显示信息窗体
  private showInfoWindow(data: POIData, position: [number, number]) {
    if (this.currentInfoWindowData) {
      this.currentInfoWindowData.value = data
    }

    const colorMode = useColorMode()
    const isDark = colorMode.value === 'dark'

    const content = createInfoWindowContent(
      data,
      this.options.developerMode,
      isDark,
      this.options.isPOICheckedIn,
      this.options.getPersonalCheckinCount,
    )

    this.infoWindow.setContent(content)
    this.infoWindow.open(this.map, position)

    // 通知信息窗口已打开
    if (this.options.onInfoWindowToggle) {
      this.options.onInfoWindowToggle(true)
    }
  }

  // 地图点击事件处理
  private onMapClick(e: any) {
    // 如果有信息窗口打开，先关闭它
    if (this.infoWindow && this.currentInfoWindowData && this.currentInfoWindowData.value) {
      this.infoWindow.close()
      this.currentInfoWindowData.value = null
      // 通知信息窗口已关闭
      if (this.options.onInfoWindowToggle) {
        this.options.onInfoWindowToggle(false)
      }
    }

    // 开发者模式下的位置选择逻辑
    if (!this.options.developerMode)
      return

    const position = e.lnglat
    const lng = position.getLng()
    const lat = position.getLat()

    // 发出位置选择事件
    this.options.onPositionSelected?.({ lng, lat })

    // 如果有之前的选择标记，先移除
    if (this.pickedMarker) {
      this.map.remove(this.pickedMarker)
    }

    // 创建选择位置的标记
    this.pickedMarker = new window.AMap.Marker({
      position: [lng, lat],
      icon: new window.AMap.Icon({
        image: createPickedIcon(),
        size: new window.AMap.Size(ICON_SIZES.picked.width, ICON_SIZES.picked.height),
        imageSize: new window.AMap.Size(ICON_SIZES.picked.width, ICON_SIZES.picked.height),
      }),
      title: `选中位置: ${lng.toFixed(6)}, ${lat.toFixed(6)}`,
      anchor: 'center',
    })

    this.map.add(this.pickedMarker)
  }

  // 设置全局方法
  private setupGlobalMethods(pois: POIData[] = []) {
    setupInfoWindowGlobalMethods(
      ref(this.infoWindow),
      this.currentInfoWindowData,
      this.options.editPOI,
      this.options.deletePOI,
      pois,
      this.options.onSuccess,
      this.options.onError,
    )
  }

  // 更新开发者模式
  updateDeveloperMode(developerMode: boolean) {
    console.warn('MarkerManager updateDeveloperMode:', {
      old: this.options.developerMode,
      new: developerMode,
      hasInfoWindow: !!this.infoWindow,
      hasCurrentData: !!this.currentInfoWindowData?.value,
    })

    this.options.developerMode = developerMode

    if (!developerMode && this.pickedMarker) {
      // 退出开发者模式时清除选中标记
      this.map.remove(this.pickedMarker)
      this.pickedMarker = null
    }

    // 如果信息窗口当前是打开的，重新生成内容
    if (this.infoWindow && this.currentInfoWindowData && this.currentInfoWindowData.value) {
      console.warn('重新生成信息窗口内容，开发者模式:', developerMode)
      const colorMode = useColorMode()
      const isDark = colorMode.value === 'dark'
      const newContent = createInfoWindowContent(
        this.currentInfoWindowData.value,
        developerMode,
        isDark,
        this.options.isPOICheckedIn,
        this.options.getPersonalCheckinCount,
      )
      this.infoWindow.setContent(newContent)
    }
  }

  // 更新深色模式
  updateDarkMode() {
    // 如果信息窗口当前是打开的，重新生成内容
    if (this.infoWindow && this.currentInfoWindowData && this.currentInfoWindowData.value) {
      const colorMode = useColorMode()
      const isDark = colorMode.value === 'dark'
      const newContent = createInfoWindowContent(
        this.currentInfoWindowData.value,
        this.options.developerMode,
        isDark,
        this.options.isPOICheckedIn,
        this.options.getPersonalCheckinCount,
      )
      this.infoWindow.setContent(newContent)
    }
  }

  // 清除所有标记
  private clearMarkers() {
    this.markers.forEach(({ marker }) => {
      this.map.remove(marker)
    })
    this.markers = []
  }

  // 销毁管理器
  destroy() {
    this.clearMarkers()
    this.removeUserLocationMarker()
    this.removeRangeCircle()

    if (this.pickedMarker) {
      this.map.remove(this.pickedMarker)
      this.pickedMarker = null
    }

    // 清理全局方法
    if (import.meta.client) {
      delete window.closeInfoWindow
      delete window.editPOI
      delete window.deletePOI
    }
  }

  // 获取当前信息窗口数据
  get currentInfoWindow() {
    return this.currentInfoWindowData
  }
}
