// 서버(api/) 호출
const OFFLINE = { ok: false, errors: ['서버에 연결하지 못했습니다. 잠시 뒤 다시 시도하세요.'] }

async function post(path, body) {
  if (!hasServer()) return { ok: false, errors: ['파일로 열면 제출할 수 없습니다. 사이트를 서버(Vercel)에 올린 뒤 이용하세요.'] }
  try {
    const r = await fetch(`/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json()
    return { ok: !!j.ok, errors: j.errors ?? [] }
  } catch {
    return OFFLINE
  }
}

export const hasServer = () => typeof location !== 'undefined' && location.protocol.startsWith('http')

export async function fetchEntries(retries = [1000, 3000, 8000]) {
  if (!hasServer()) return null
  for (let i = 0; ; i++) {
    try {
      const r = await fetch('/api/entries')
      if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) {
        const j = await r.json()
        return { pets: Array.isArray(j.pets) ? j.pets : [], items: Array.isArray(j.items) ? j.items : [] }
      }
      if (r.status === 404) return null // 서버 없이 여는 경우
    } catch {
      /* 다시 시도 */
    }
    if (i >= retries.length) return null
    await new Promise((res) => setTimeout(res, retries[i]))
  }
}

export const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result).split(',')[1])
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(file)
  })

export const submitEntry = async (kind, entry, file) => post('submit', { kind, entry, image: file ? { base64: await fileToBase64(file) } : undefined })
export const login = (password) => post('login', { password })
export const logout = () => post('logout', {})
export const review = (id, action) => post('review', { id, action })
export async function isLoggedIn() {
  if (!hasServer()) return false
  try {
    return (await (await fetch('/api/session')).json()).ok === true
  } catch {
    return false
  }
}
export async function fetchQueue() {
  try {
    const r = await fetch('/api/queue')
    return r.ok ? await r.json() : null
  } catch {
    return null
  }
}
