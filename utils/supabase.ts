import { createClient } from '@supabase/supabase-js'

// 密钥勿入库：.env 中配置 NUXT_SUPABASE_*（服务端）或 NUXT_PUBLIC_SUPABASE_*（与 nuxt runtimeConfig 一致）
const supabaseUrl =
  process.env.NUXT_SUPABASE_URL || process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey =
  process.env.NUXT_SUPABASE_ANON_KEY
  || process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY
  || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// POI数据库表的类型定义
export interface POIRecord {
  id: string
  name: string
  description?: string
  rating?: number
  lng: number
  lat: number
  category?: string
  reference_photo?: string
  easter_egg?: any
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

// 将数据库记录转换为前端POI数据格式
export function dbRecordToPOI(record: POIRecord): import('~/types/amap').POIData {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    rating: record.rating,
    position: [record.lng, record.lat],
    category: record.category,
    referencePhoto: processImageUrl(record.reference_photo),
    easter_egg: record.easter_egg,
  }
}

// 处理图片URL，确保返回完整的URL
function processImageUrl(imageUrl?: string): string | undefined {
  if (!imageUrl) {
    return undefined
  }

  // 如果已经是完整URL，直接返回
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl
  }

  // 如果是Base64数据，直接返回
  if (imageUrl.startsWith('data:')) {
    return imageUrl
  }

  // 如果包含传统COS域名，说明是历史数据，尝试添加https协议
  if (imageUrl.includes('.cos.') && imageUrl.includes('.myqcloud.com')) {
    return `https://${imageUrl}`
  }

  // 对于其他情况，直接返回原始URL
  return imageUrl
}

// 将前端POI数据格式转换为数据库记录
export function poiToDbRecord(poi: import('~/types/amap').POIData): Omit<POIRecord, 'created_at' | 'updated_at'> {
  return {
    id: poi.id,
    name: poi.name,
    description: poi.description,
    rating: poi.rating,
    lng: poi.position[0],
    lat: poi.position[1],
    category: poi.category,
    reference_photo: poi.referencePhoto,
    easter_egg: poi.easter_egg,
  }
}
