const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

export default defineEventHandler(async (event) => {
  const rawName = getRouterParam(event, 'name')
  if (!rawName) {
    throw createError({ statusCode: 400, message: 'Missing name' })
  }
  const name = decodeURIComponent(rawName)
  if (!name || name.includes('..') || !/^[\w.-]+$/.test(name)) {
    throw createError({ statusCode: 400, message: 'Invalid filename' })
  }

  const config = useRuntimeConfig(event)
  const base = config.uploadFilesBase?.replace(/\/$/, '')
  if (!base) {
    throw createError({ statusCode: 500, message: 'uploadFilesBase 未配置' })
  }

  const url = `${base}/${name}`
  const upstream = await fetch(url)
  if (!upstream.ok) {
    throw createError({ statusCode: upstream.status === 404 ? 404 : 502 })
  }

  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  const ct = MIME[ext] || upstream.headers.get('content-type') || 'application/octet-stream'
  setHeader(event, 'Content-Type', ct)
  setHeader(event, 'Cache-Control', 'public, max-age=86400')

  return new Uint8Array(await upstream.arrayBuffer())
})
