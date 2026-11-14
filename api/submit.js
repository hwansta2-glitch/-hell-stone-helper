// POST /api/submit { kind: 'pet'|'item', entry, image?: { base64 } } — 승인 대기에 올린다
import { allSubmissions, configured, fail, newId, onlyPost, saveImage, saveSubmission, send, takenNames } from './_lib.js'
import { cleanItem, cleanPet, itemErrors, MAX_IMAGE_BYTES, petErrors } from '../src/lib/validate.js'

const MAX_PENDING = 200

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return
  if (!configured()) return fail(res, 503, '저장소가 아직 연결되지 않았습니다. 관리자에게 알려 주세요.')
  const { kind, entry, image } = req.body ?? {}
  if (kind !== 'pet' && kind !== 'item') return fail(res, 400, '종류가 잘못되었습니다.')
  try {
    const subs = await allSubmissions()
    const approved = subs.filter((s) => s.status === 'approved' && s.kind === kind).map((s) => s.entry.name)
    const taken = [...takenNames(kind), ...approved]
    const errors = kind === 'pet' ? petErrors(entry, taken) : itemErrors(entry, taken)
    if (!image?.base64 && !entry?.image) errors.push(kind === 'pet' ? '그림을 올리거나 같이 쓸 펫을 고르세요.' : '그림을 올려 주세요.')
    if (errors.length) return fail(res, 400, ...errors)
    if (subs.filter((s) => s.status === 'pending').length >= MAX_PENDING) return fail(res, 429, '승인 대기가 너무 많습니다. 잠시 뒤 다시 시도하세요.')
    let picture = entry.image
    if (image?.base64) {
      const saved = await saveImage(image.base64, MAX_IMAGE_BYTES)
      if (saved.error) return fail(res, 400, saved.error)
      picture = saved.url
    }
    const clean = kind === 'pet' ? cleanPet({ ...entry, image: picture }) : cleanItem({ ...entry, image: picture })
    await saveSubmission({ id: newId(), kind, entry: clean, status: 'pending', createdAt: Date.now() })
    send(res, 200, { ok: true, errors: [] })
  } catch {
    fail(res, 500, '저장하지 못했습니다. 잠시 뒤 다시 시도하세요.')
  }
}
