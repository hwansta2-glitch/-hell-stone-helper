// GET /api/entries — 승인된 펫·아이템
import { allSubmissions, configured, send } from './_lib.js'

export default async function handler(req, res) {
  if (!configured()) return send(res, 200, { pets: [], items: [] })
  try {
    const subs = (await allSubmissions()).filter((s) => s.status === 'approved')
    send(
      res,
      200,
      { pets: subs.filter((s) => s.kind === 'pet').map((s) => s.entry), items: subs.filter((s) => s.kind === 'item').map((s) => s.entry) },
      { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' },
    )
  } catch {
    send(res, 500, { pets: [], items: [] })
  }
}
