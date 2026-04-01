# 文件上传配置指南 📤

## ✅ 已完成功能

✅ **打卡照片上传到云函数**
✅ 自动文件格式验证
✅ 文件大小限制(5MB)
✅ **智能图片压缩** - 无损压缩，减少上传时间
✅ 上传进度显示
✅ 支持拍照和相册选择
✅ Base64编码传输
✅ 深色模式支持

## 配置说明

系统已配置为使用云函数进行文件上传，无需额外配置。

### 上传服务端点配置

在 `nuxt.config.ts` 中配置：

```typescript
runtimeConfig: {
  public: {
    // 文件上传配置
    uploadEndpoint: 'https://fc-mp-729b36f8-00b6-4256-a4f1-18f567945edd.next.bspapp.com/upload',
  },
}
```

### 支持的功能特性

- ✅ 自动文件格式验证 (JPEG, PNG, WebP, GIF)
- ✅ 文件大小限制 (5MB)
- ✅ **智能图片压缩** (最大1920x1920，质量80%，目标2MB)
- ✅ 上传进度显示
- ✅ 支持拍照和相册选择
- ✅ Base64编码安全传输
- ✅ 错误处理和重试机制

## 使用方法

### 在组件中使用

```typescript
import { uploadImage } from '~/utils/fileUpload'

// 上传文件
async function handleFileUpload(file: File) {
  try {
    const result = await uploadImage(file, {
      userId: 'user123', // 可选的用户ID
      onProgress: (progress) => {
        console.log(`上传进度: ${progress.percent}%`)
      }
    })

    console.log('上传成功:', result.url)
  }
  catch (error) {
    console.error('上传失败:', error)
  }
}
```

### API 接口

上传接口期望的数据格式：

```json
{
  "image": "base64_encoded_string",
  "filename": "generated_filename.jpg"
}
```

返回格式：

```json
{
  "code": 200,
  "message": "图片上传成功",
  "data": "https://mp-729b36f8-00b6-4256-a4f1-18f567945edd.cdn.bspapp.com/cloudstorage/03b48916-13bf-4969-b2eb-ceaa0f2448e2.png"
}
```

错误响应格式：

```json
{
  "code": 400,
  "message": "上传失败的具体原因",
  "data": null
}
```

## 技术特点

1. **智能压缩**: 使用Canvas API进行无损图片压缩
2. **Base64编码**: 文件转换为Base64格式进行传输
3. **云函数上传**: 使用云函数处理文件上传和存储
4. **进度监控**: 实时显示上传进度
5. **错误处理**: 完善的错误处理和用户提示
6. **文件验证**: 上传前验证文件格式和大小

## 图片压缩配置

```typescript
export const COMPRESSION_CONFIG = {
  maxWidth: 1920,        // 最大宽度
  maxHeight: 1920,       // 最大高度
  quality: 0.8,          // JPEG质量 (0-1)
  maxSize: 2 * 1024 * 1024, // 压缩后最大文件大小 (2MB)
}
```

### 压缩特性

- **智能缩放**: 超过1920x1920的图片自动按比例缩放
- **质量优化**: JPEG质量设为80%，平衡文件大小和图片质量
- **二次压缩**: 如果压缩后仍超过2MB，自动降低质量再次压缩
- **格式保持**: 保持原始图片格式(JPEG/PNG/WebP)
- **无损处理**: 使用Canvas API确保压缩质量

## 故障排除

### 上传失败

1. 检查网络连接
2. 确认文件格式是否支持
3. 确认文件大小是否超过5MB
4. 查看浏览器控制台错误信息

### 文件格式错误

支持的格式：

- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- GIF (.gif)

### 大小限制

- 最大文件大小：5MB
- 建议在上传前压缩大型图片

## 安全性

1. 文件类型验证确保只能上传图片
2. 文件大小限制防止大文件攻击
3. Base64编码确保传输安全
4. 服务端验证防止恶意文件上传
