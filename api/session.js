// GET /api/session — 관리자로 로그인했는지
import { isAdmin, send } from './_lib.js'

export default function handler(req, res) {
  send(res, 200, { ok: isAdmin(req) }, { 'Cache-Control': 'no-store' })
}
