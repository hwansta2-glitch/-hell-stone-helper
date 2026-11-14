// POST /api/logout
import { clearCookie, onlyPost, send } from './_lib.js'

export default function handler(req, res) {
  if (!onlyPost(req, res)) return
  send(res, 200, { ok: true, errors: [] }, { 'Set-Cookie': clearCookie() })
}
