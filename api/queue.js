// GET /api/queue — 승인 대기·승인한 제출 (관리자만)
import { allSubmissions, configured, fail, isAdmin, send } from './_lib.js'

export default async function handler(req, res) {
  if (!isAdmin(req)) return fail(res, 401, '로그인이 필요합니다.')
  if (!configured()) return fail(res, 503, '저장소가 아직 연결되지 않았습니다.')
  const subs = await allSubmissions()
  send(res, 200, { pending: subs.filter((s) => s.status === 'pending'), approved: subs.filter((s) => s.status === 'approved') }, { 'Cache-Control': 'no-store' })
}
