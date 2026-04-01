// 文件上传工具类 - 使用云函数上传

interface UploadProgress {
  loaded: number
  total: number
  speed: number
  percent: number
  compressedSize?: number // 压缩后的文件大小
}

interface UploadResult {
  url: string
  filename: string
  success: boolean
}

interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void
  userId?: string
}

// 支持的图片格式
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]

// 图片压缩配置
export const COMPRESSION_CONFIG = {
  maxWidth: 1280, // 最大宽度（从1920降到1280）
  maxHeight: 1280, // 最大高度（从1920降到1280）
  quality: 0.7, // JPEG质量 (0-1)（从0.8降到0.7）
  maxSize: 500 * 1024, // 压缩后最大文件大小 (500KB，从1MB降到500KB)
}

// 图片压缩函数
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('无法创建Canvas上下文'))
      return
    }

    img.onload = () => {
      // 计算压缩后的尺寸
      let { width, height } = img
      const { maxWidth, maxHeight } = COMPRESSION_CONFIG

      // 按比例缩放
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width *= ratio
        height *= ratio
      }

      // 设置canvas尺寸
      canvas.width = width
      canvas.height = height

      // 绘制压缩后的图片
      ctx.drawImage(img, 0, 0, width, height)

      // 转换为Blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('图片压缩失败'))
            return
          }

          // 如果压缩后仍然太大，进一步降低质量
          if (blob.size > COMPRESSION_CONFIG.maxSize) {
            // 计算需要的质量系数
            const targetQuality = Math.max(0.3, COMPRESSION_CONFIG.quality * 0.6)
            canvas.toBlob(
              (finalBlob) => {
                if (!finalBlob) {
                  reject(new Error('图片压缩失败'))
                  return
                }

                // 如果还是太大，再降低一次
                if (finalBlob.size > COMPRESSION_CONFIG.maxSize) {
                  const lowestQuality = Math.max(0.2, COMPRESSION_CONFIG.quality * 0.4)
                  canvas.toBlob(
                    (lastBlob) => {
                      if (!lastBlob) {
                        reject(new Error('图片压缩失败'))
                        return
                      }
                      const compressedFile = new File([lastBlob], file.name, {
                        type: file.type,
                        lastModified: Date.now(),
                      })
                      resolve(compressedFile)
                    },
                    file.type,
                    lowestQuality,
                  )
                }
                else {
                  const compressedFile = new File([finalBlob], file.name, {
                    type: file.type,
                    lastModified: Date.now(),
                  })
                  resolve(compressedFile)
                }
              },
              file.type,
              targetQuality,
            )
          }
          else {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          }
        },
        file.type,
        COMPRESSION_CONFIG.quality,
      )
    }

    img.onerror = () => {
      reject(new Error('图片加载失败'))
    }

    img.src = URL.createObjectURL(file)
  })
}

// 将文件转换为Base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] // 移除 data:image/...;base64, 前缀
      if (base64) {
        resolve(base64)
      }
      else {
        reject(new Error('Base64转换失败'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 验证文件格式和大小
function validateFile(file: File): { valid: boolean, error?: string } {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `不支持的文件格式。支持的格式：${SUPPORTED_IMAGE_TYPES.join(', ')}`,
    }
  }

  return { valid: true }
}

// 生成唯一文件名
function generateFileName(originalName: string, userId?: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = originalName.split('.').pop()
  const userPrefix = userId ? `${userId}_` : 'anonymous_'

  return `${userPrefix}${timestamp}_${random}.${ext}`
}

class FileUploader {
  private getUploadEndpoint(): string {
    const config = useRuntimeConfig()
    return config.public.uploadEndpoint || '/api/upload'
  }

  // 上传文件
  async uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
    // 验证文件
    const validation = validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    // 开始上传进度
    if (options.onProgress) {
      options.onProgress({
        loaded: 0,
        total: file.size,
        speed: 0,
        percent: 0,
      })
    }

    try {
      // 图片压缩
      let processedFile = file
      const originalSize = file.size

      if (file.type.startsWith('image/')) {
        try {
          processedFile = await compressImage(file)
          const compressionRatio = ((1 - processedFile.size / originalSize) * 100).toFixed(1)
          console.warn(`图片压缩完成: ${(originalSize / 1024).toFixed(1)}KB -> ${(processedFile.size / 1024).toFixed(1)}KB (节省${compressionRatio}%)`)
        }
        catch (compressError) {
          console.warn('图片压缩失败，使用原文件:', compressError)
          processedFile = file
        }
      }

      // 转换为Base64
      const base64 = await fileToBase64(processedFile)

      // 模拟进度更新到50%，传递压缩后的文件大小
      if (options.onProgress) {
        options.onProgress({
          loaded: processedFile.size * 0.5,
          total: processedFile.size,
          speed: 0,
          percent: 50,
          compressedSize: processedFile.size,
        })
      }

      // 生成文件名
      const filename = generateFileName(processedFile.name, options.userId)

      // 上传到云函数
      const response = await $fetch<{
        code?: number
        message?: string
        data?: string
        // 兼容旧格式
        url?: string
        success?: boolean
        error?: string
      }>(this.getUploadEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          image: base64,
          filename,
        },
      })

      // 完成进度
      if (options.onProgress) {
        options.onProgress({
          loaded: processedFile.size,
          total: processedFile.size,
          speed: 0,
          percent: 100,
          compressedSize: processedFile.size,
        })
      }

      // 处理新的响应格式
      if (response.code !== undefined) {
        // 新格式: { code, message, data }
        if (response.code !== 200) {
          throw new Error(response.message || '上传失败')
        }

        return {
          url: response.data || '',
          filename,
          success: true,
        }
      }
      else {
        // 兼容旧格式: { success, url, error }
        if (!response.success && response.error) {
          throw new Error(response.error)
        }

        return {
          url: response.url || '',
          filename,
          success: response.success || false,
        }
      }
    }
    catch (error) {
      console.error('文件上传失败:', error)
      throw new Error(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 检查上传服务是否可用
  async isAvailable(): Promise<boolean> {
    try {
      // 这里可以实现一个健康检查接口
      // 暂时返回true，假设服务总是可用的
      return true
    }
    catch {
      return false
    }
  }

  // 删除文件（如果云函数支持的话）
  async deleteFile(filename: string): Promise<void> {
    // 如果云函数支持删除文件，可以在这里实现
    console.warn('文件删除功能暂未实现:', filename)
  }

  // 获取文件URL（如果需要特殊处理的话）
  getFileUrl(url: string): string {
    return url
  }
}

// 导出单例实例
export const fileUploader = new FileUploader()

// 导出便捷函数
export async function uploadImage(
  file: File,
  options: UploadOptions = {},
): Promise<UploadResult> {
  return fileUploader.uploadFile(file, options)
}

export async function deleteImage(filename: string): Promise<void> {
  return fileUploader.deleteFile(filename)
}

export function getImageUrl(url: string): string {
  return fileUploader.getFileUrl(url)
}

// 测试上传服务连接
export async function testUploadConnection(): Promise<{ success: boolean, message: string }> {
  try {
    const isAvailable = await fileUploader.isAvailable()
    return {
      success: isAvailable,
      message: isAvailable ? '上传服务连接正常' : '上传服务不可用',
    }
  }
  catch (error) {
    return {
      success: false,
      message: `连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
    }
  }
}

// 手动压缩图片（供外部调用）
export async function compressImageFile(file: File): Promise<File> {
  return compressImage(file)
}
