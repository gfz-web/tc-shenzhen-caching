interface UpstreamJson {
  code?: number
  message?: string
  data?: string
  url?: string
  success?: boolean
  error?: string
}

function rewriteToSameOrigin(data: string, filesBase: string): string {
  const base = filesBase.replace(/\/$/, '')
  if (!data.startsWith(`${base}/`))
    return data
  const name = data.slice(base.length + 1).split(/[?#]/)[0]
  if (!name || name.includes('..') || !/^[\w.-]+$/.test(name))
    return data
  return `/api/upload-file/${encodeURIComponent(name)}`
}

export default defineEventHandler(async (event) => {
  assertMethod(event, 'POST')

  const config = useRuntimeConfig(event)
  const upstream = config.uploadUpstream
  if (!upstream) {
    throw createError({
      statusCode: 500,
      message: 'uploadUpstream 未配置',
    })
  }

  const body = await readBody<{ image?: string, filename?: string }>(event)
  if (!body?.image || !body?.filename) {
    throw createError({ statusCode: 400, message: 'Invalid body' })
  }

  const res = await $fetch<UpstreamJson>(upstream, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body as Record<string, string>,
  })

  const filesBase = config.uploadFilesBase
  if (filesBase && res && typeof res.data === 'string' && res.code === 200) {
    return {
      ...res,
      data: rewriteToSameOrigin(res.data, filesBase),
    }
  }

  return res
})
