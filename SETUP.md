# 深圳地图项目设置指南

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动开发服务器

```bash
pnpm dev
```

### 3. 访问应用

打开浏览器访问 `http://localhost:3000`

## 📱 功能特性

### ✅ 已完成功能

- [x] 高德地图集成
- [x] 中心点标记显示
- [x] 多个POI地点标记
- [x] 点击标记显示信息弹窗
- [x] 响应式设计（支持手机和电脑）
- [x] 地图控件（重置视图、切换样式）
- [x] 深色模式支持
- [x] 地点数据管理系统

### 🗺️ 地图配置

#### 高德地图密钥

- **Key**: `87c84b874953cfe095bceaf58148f1b1`
- **密钥**: `142349eb5a7b8870dd75c1378faed068`

#### 中心点配置

- **位置**: 深圳市中心 (113.94016, 22.5329)
- **缩放级别**: 12

### 📍 默认POI地点

项目预设了以下深圳地标：

1. 深圳湾公园
2. 平安金融中心
3. 深圳北站
4. 华强北商业街
5. 深圳大学

## 🏗️ 项目结构

```
app/
├── components/
│   └── AMapContainer.vue     # 地图主组件
├── composables/
│   ├── useMap.ts            # 地图实例管理
│   └── useMapData.ts        # POI数据管理
├── config/
│   └── map.ts               # 地图配置和示例数据
├── types/
│   └── amap.ts              # TypeScript类型定义
└── pages/
    └── index.vue            # 首页
```

## 🔧 自定义配置

### 修改中心点

编辑 `app/config/map.ts` 文件中的 `mapConfig.center`：

```typescript
export const mapConfig: MapConfig = {
  center: [经度, 纬度], // 修改为你的中心点坐标
  zoom: 12,
  // ...
}
```

### 添加新的POI

在 `app/config/map.ts` 中的 `samplePOIs` 数组添加新地点：

```typescript
{
  id: 'poi-new',
  name: '新地点名称',
  description: '地点描述',
  position: [经度, 纬度],
  category: '分类',
  contact: {
    address: '详细地址',
    phone: '联系电话',
  },
}
```

### 修改地图样式

支持的地图样式：

- `amap://styles/normal` - 标准样式
- `amap://styles/dark` - 深色样式
- `amap://styles/satellite` - 卫星图

## 📱 响应式设计

### 断点设置

- **移动端**: < 768px
- **平板**: 768px - 1024px
- **桌面端**: > 1024px

### 移动端优化

- 地图高度自动调整为 400px
- 控制按钮尺寸适配
- 信息弹窗大小优化
- 触摸手势支持

## 🎨 主题支持

项目支持明亮和深色主题：

- 使用 `@nuxtjs/color-mode` 模块
- 自动检测系统主题偏好
- 地图样式随主题切换

## 🔧 开发工具

### 可用脚本

```bash
pnpm dev          # 开发模式
pnpm build        # 生产构建
pnpm preview      # 预览构建结果
pnpm lint         # 代码检查
pnpm typecheck    # 类型检查
```

### 代码质量

- ESLint + TypeScript
- Vue 3 Composition API
- UnoCSS 样式框架

## 🚀 部署

### 静态部署

```bash
pnpm generate
```

生成的静态文件在 `.output/public` 目录

### 服务器部署

```bash
pnpm build
pnpm start
```

## 🛠️ 故障排除

### 地图无法加载

1. 检查网络连接
2. 确认高德地图API密钥有效
3. 查看浏览器控制台错误信息

### 标记点不显示

1. 检查POI数据格式
2. 确认坐标范围正确
3. 验证地图初始化完成

### 移动端显示异常

1. 检查视口设置
2. 确认响应式样式
3. 测试触摸事件

## 📞 技术支持

如遇问题，请检查：

1. 高德地图开发文档
2. Vue 3 官方文档
3. Nuxt 3 官方文档

## 🎯 后续扩展建议

1. **数据持久化**: 添加本地存储或数据库
2. **用户系统**: 支持用户添加自定义POI
3. **路径规划**: 集成导航功能
4. **地点搜索**: 添加搜索和筛选功能
5. **数据导入**: 支持Excel/CSV批量导入POI
6. **地点分享**: 添加分享功能
7. **离线支持**: PWA离线地图缓存
