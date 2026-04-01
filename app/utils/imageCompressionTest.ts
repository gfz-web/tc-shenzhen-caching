// 图片压缩测试工具
import { compressImageFile, COMPRESSION_CONFIG } from './fileUpload'

export interface CompressionTestResult {
  originalSize: number
  compressedSize: number
  compressionRatio: number
  timeMs: number
}

// 测试图片压缩
export async function testImageCompression(file: File): Promise<CompressionTestResult> {
  const startTime = Date.now()

  try {
    const compressedFile = await compressImageFile(file)
    const endTime = Date.now()

    const originalSize = file.size
    const compressedSize = compressedFile.size
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100
    const timeMs = endTime - startTime

    return {
      originalSize,
      compressedSize,
      compressionRatio,
      timeMs,
    }
  }
  catch (error) {
    throw new Error(`压缩测试失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

// 获取压缩配置信息
export function getCompressionInfo() {
  return {
    maxWidth: COMPRESSION_CONFIG.maxWidth,
    maxHeight: COMPRESSION_CONFIG.maxHeight,
    quality: COMPRESSION_CONFIG.quality,
    maxSize: COMPRESSION_CONFIG.maxSize,
    maxSizeMB: (COMPRESSION_CONFIG.maxSize / 1024 / 1024).toFixed(1),
  }
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes === 0)
    return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}
