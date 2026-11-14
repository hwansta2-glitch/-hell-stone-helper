import submit from '../api/submit.js'
import login from '../api/login.js'
import queue from '../api/queue.js'
import review from '../api/review.js'
import entries from '../api/entries.js'
import session from '../api/session.js'
process.env.BLOB_READ_WRITE_TOKEN = 'x'
process.env.ADMIN_PASSWORD = 'pw1234'
const call = async (h, { method = 'GET', body, cookie } = {}) => {
  const headers = {}
  let out
  const res = { statusCode: 200, setHeader: (k, v) => (headers[k] = v), end: (s) => (out = JSON.parse(s)) }
  await h({ method, body, headers: { cookie } }, res)
  return { status: res.statusCode, body: out, headers }
}
const gif = Buffer.from('47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b', 'hex').toString('base64')
const pet = { name: '테스트펫', tier: '일반', attrs: { 지: 6, 수: 4 }, source: '필드', sourceType: '필드포획', ride: true, skillSlots: 5, hp: [58.37, 10.16], atk: [12.91, 2.25], def: [7.74, 1.35], agi: [8.37, 1.46] }
console.log('bad', (await call(submit, { method: 'POST', body: { kind: 'pet', entry: { ...pet, attrs: { 지: 3 } }, image: { base64: gif } } })).body)
console.log('dup', (await call(submit, { method: 'POST', body: { kind: 'pet', entry: { ...pet, name: '우리' }, image: { base64: gif } } })).body)
console.log('ok', (await call(submit, { method: 'POST', body: { kind: 'pet', entry: pet, image: { base64: gif } } })).body)
console.log('queue anon', (await call(queue)).status)
console.log('wrong pw', (await call(login, { method: 'POST', body: { password: 'no' } })).status)
const L = await call(login, { method: 'POST', body: { password: 'pw1234' } })
const cookie = L.headers['Set-Cookie'].split(';')[0]
console.log('session', (await call(session, { cookie })).body)
const q = (await call(queue, { cookie })).body
console.log('pending', q.pending.length, q.pending[0].entry.image)
console.log('entries before', (await call(entries)).body.pets.length)
console.log('approve', (await call(review, { method: 'POST', body: { id: q.pending[0].id, action: 'approve' }, cookie })).body)
const e = (await call(entries)).body
console.log('entries after', e.pets.map((p) => p.name), e.pets[0].total)
console.log('forged cookie', (await call(queue, { cookie: 'hs_admin=9999999999999.abc' })).status)
