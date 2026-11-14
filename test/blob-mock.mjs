const store = new Map()
let t = 0
export async function put(pathname, body, opts) {
  if (store.has(pathname) && !opts.allowOverwrite) throw new Error('exists')
  const url = `https://mock.blob/${pathname}`
  store.set(pathname, { url, pathname, body: Buffer.isBuffer(body) ? body : Buffer.from(body), uploadedAt: new Date(Date.now() + t++) })
  return { url, pathname }
}
export async function list({ prefix }) {
  return { blobs: [...store.values()].filter((b) => b.pathname.startsWith(prefix)), hasMore: false }
}
export async function del(urls) {
  for (const [k, v] of store) if (urls.includes(v.url)) store.delete(k)
}
globalThis.fetch = async (u) => {
  const b = [...store.values()].find((x) => u.startsWith(x.url))
  return b ? { ok: true, json: async () => JSON.parse(b.body.toString()) } : { ok: false }
}
