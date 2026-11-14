// POST /api/review { id, action: 'approve'|'reject'|'withdraw' } (관리자만)
import { allSubmissions, fail, isAdmin, onlyPost, removeSubmission, saveSubmission, send } from './_lib.js'

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return
  if (!isAdmin(req)) return fail(res, 401, '로그인이 필요합니다.')
  const { id, action } = req.body ?? {}
  const sub = (await allSubmissions()).find((s) => s.id === id)
  if (!sub) return fail(res, 404, '제출을 찾지 못했습니다.')
  if (action === 'approve' && sub.status === 'pending') await saveSubmission({ ...sub, status: 'approved', reviewedAt: Date.now() })
  else if (action === 'reject' && sub.status === 'pending') await removeSubmission(id)
  else if (action === 'withdraw' && sub.status === 'approved') await saveSubmission({ ...sub, status: 'pending', reviewedAt: Date.now() })
  else return fail(res, 400, '할 수 없는 처리입니다.')
  send(res, 200, { ok: true, errors: [] })
}
