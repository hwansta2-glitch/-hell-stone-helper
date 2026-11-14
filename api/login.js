// POST /api/login { password }
import { checkPassword, fail, onlyPost, send, sessionCookie } from './_lib.js'

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return
  if (!process.env.ADMIN_PASSWORD) return fail(res, 503, '관리자 비밀번호(ADMIN_PASSWORD)가 설정되지 않았습니다.')
  if (!checkPassword(req.body?.password)) {
    await new Promise((r) => setTimeout(r, 800))
    return fail(res, 401, '비밀번호가 틀렸습니다.')
  }
  send(res, 200, { ok: true, errors: [] }, { 'Set-Cookie': sessionCookie() })
}
