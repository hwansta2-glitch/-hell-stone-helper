// 서버 공용: Vercel Blob 저장소, 관리자 세션, 요청 도우미
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { list, put, del } from '@vercel/blob'

const SUB_PREFIX = 'submissions/'
const IMG_PREFIX = 'images/'
const COOKIE = 'hs_admin'
const SESSION_HOURS = 12

export const send = (res, status, body, headers = {}) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(JSON.stringify(body))
}
export const fail = (res, status, ...errors) => send(res, status, { ok: false, errors })
export const onlyPost = (req, res) => {
  if (req.method === 'POST') return true
  fail(res, 405, 'POST로 보내야 합니다.')
  return false
}
export const configured = () => !!process.env.BLOB_READ_WRITE_TOKEN

/* ---------- 관리자 세션 (비밀번호로 서명한 쿠키) ---------- */
const secret = () => `${process.env.ADMIN_PASSWORD ?? ''}|${process.env.SESSION_SECRET ?? 'hellstone'}`
const sign = (v) => createHmac('sha256', secret()).update(v).digest('hex')
export function checkPassword(pw) {
  const want = process.env.ADMIN_PASSWORD
  if (!want || typeof pw !== 'string') return false
  const a = Buffer.from(sign(pw))
  const b = Buffer.from(sign(want))
  return a.length === b.length && timingSafeEqual(a, b)
}
export function sessionCookie() {
  const until = Date.now() + SESSION_HOURS * 3600e3
  const v = `${until}.${sign(String(until))}`
  return `${COOKIE}=${v}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
export function isAdmin(req) {
  if (!process.env.ADMIN_PASSWORD) return false
  const raw = (req.headers.cookie ?? '').split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`))
  if (!raw) return false
  const [until, mac] = raw.slice(COOKIE.length + 1).split('.')
  if (!until || !mac || Number(until) < Date.now()) return false
  const a = Buffer.from(mac)
  const b = Buffer.from(sign(until))
  return a.length === b.length && timingSafeEqual(a, b)
}

/* ---------- 기본 데이터 이름 (중복 검사용) ---------- */
let baseNames = null
export function takenNames(kind) {
  if (!baseNames) {
    const read = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}.json`, import.meta.url), 'utf8')).map((x) => x.name)
    baseNames = { pet: read('pets'), item: read('items') }
  }
  return baseNames[kind]
}

/* ---------- 제출 저장 ---------- */
// 제출 하나 = submissions/<id>.json  { id, kind, entry, status, createdAt, reviewedAt }
export async function allSubmissions() {
  const blobs = []
  let cursor
  do {
    const r = await list({ prefix: SUB_PREFIX, cursor, limit: 1000 })
    blobs.push(...r.blobs)
    cursor = r.hasMore ? r.cursor : undefined
  } while (cursor)
  const rows = await Promise.all(
    blobs.map(async (b) => {
      try {
        const r = await fetch(`${b.url}?v=${new Date(b.uploadedAt).getTime()}`, { cache: 'no-store' })
        return r.ok ? await r.json() : null
      } catch {
        return null
      }
    }),
  )
  return rows.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt)
}
export async function saveSubmission(sub) {
  await put(`${SUB_PREFIX}${sub.id}.json`, JSON.stringify(sub), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  })
}
export async function removeSubmission(id) {
  const r = await list({ prefix: `${SUB_PREFIX}${id}.json` })
  if (r.blobs.length) await del(r.blobs.map((b) => b.url))
}

const IMAGE_TYPES = {
  gif: { magic: [0x47, 0x49, 0x46], type: 'image/gif' },
  png: { magic: [0x89, 0x50, 0x4e, 0x47], type: 'image/png' },
  jpg: { magic: [0xff, 0xd8, 0xff], type: 'image/jpeg' },
  webp: { magic: [0x52, 0x49, 0x46, 0x46], type: 'image/webp' },
}
export async function saveImage(base64, maxBytes) {
  const buf = Buffer.from(base64, 'base64')
  if (buf.length === 0 || buf.length > maxBytes) return { error: '그림은 1MB까지 올릴 수 있습니다.' }
  const ext = Object.keys(IMAGE_TYPES).find((k) => IMAGE_TYPES[k].magic.every((m, i) => buf[i] === m))
  if (!ext) return { error: 'gif, png, jpg, webp 그림만 올릴 수 있습니다.' }
  const blob = await put(`${IMG_PREFIX}${randomUUID()}.${ext}`, buf, { access: 'public', addRandomSuffix: false, contentType: IMAGE_TYPES[ext].type })
  return { url: blob.url }
}
export const newId = () => randomUUID()
