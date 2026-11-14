// 도감 제출 검사 — 화면과 서버(api/)가 같이 쓴다. 다른 파일을 불러오지 않는다.
export const V_ATTRS = ['지', '수', '화', '풍']
export const V_TIERS = ['일반', '2등급', '1등급']
export const V_SOURCE_TYPES = ['필드포획', '퀘스트', '코스', '운영지원', '기타']
export const V_CATEGORIES = ['무기', '투구', '갑옷', '악세서리', '삼위일체', '보조', '전리품']
export const V_STATS = ['공격', '방어', '순발', '내구', '크리', '회피']
export const MAX_IMAGE_BYTES = 1048576
export const IMAGE_TOO_BIG = '그림은 1MB까지 올릴 수 있습니다.'
const BAD_NAME = /[/\\:*?"<>|]|\.\./
const NAME_MAX = 30

function nameErrors(name, taken, overwrite) {
  if (typeof name !== 'string' || !name.trim()) return ['이름을 넣으세요.']
  if (name.length > NAME_MAX) return [`이름은 ${NAME_MAX}자까지 쓸 수 있습니다.`]
  if (BAD_NAME.test(name)) return ['이름에 / \\ : * ? " < > | 와 ..은 쓸 수 없습니다.']
  if (taken.includes(name) && !overwrite) return ['이미 있는 이름입니다.']
  return []
}
const isPair = (v) => Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number' && Number.isFinite(x))

export function petErrors(pet, taken = [], overwrite = false) {
  const errs = nameErrors(pet?.name, taken, overwrite)
  const attrs = Object.entries(pet?.attrs ?? {})
  if (attrs.some(([k, v]) => !V_ATTRS.includes(k) || !Number.isInteger(v) || v <= 0) || attrs.reduce((s, [, v]) => s + v, 0) !== 10)
    errs.push('속성 칸 수의 합은 10이어야 합니다.')
  if (!V_TIERS.includes(pet?.tier)) errs.push('등급을 고르세요.')
  if (!V_SOURCE_TYPES.includes(pet?.sourceType)) errs.push('획득 종류를 고르세요.')
  if (typeof pet?.source !== 'string' || !pet.source.trim()) errs.push('획득처를 넣으세요.')
  if (!['hp', 'atk', 'def', 'agi'].every((k) => isPair(pet?.[k]) && pet[k][0] > 0 && pet[k][1] > 0)) errs.push('초기값과 성장률은 0보다 커야 합니다.')
  if (pet?.skillSlots != null && !(Number.isInteger(pet.skillSlots) && pet.skillSlots >= 0 && pet.skillSlots <= 10)) errs.push('기술창 수를 확인하세요.')
  return errs
}

export function itemErrors(item, taken = [], overwrite = false) {
  const errs = nameErrors(item?.name, taken, overwrite)
  if (!V_CATEGORIES.includes(item?.category)) errs.push('부위를 고르세요.')
  const stats = Array.isArray(item?.stats) ? item.stats : []
  if (stats.length === 0 && !item?.note) errs.push('능력치를 하나 이상 넣으세요.')
  if (stats.some((s) => !V_STATS.includes(s?.stat) || !Number.isInteger(s?.value))) errs.push('능력치 값은 정수여야 합니다.')
  return errs
}

// 서버에 저장할 때 모르는 필드는 버린다
export function cleanPet(p) {
  const out = {
    name: p.name.trim(),
    tier: p.tier,
    isNew: true,
    attrs: Object.fromEntries(V_ATTRS.filter((a) => p.attrs[a] > 0).map((a) => [a, p.attrs[a]])),
    source: p.source.trim(),
    sourceType: p.sourceType,
    ride: !!p.ride,
    skillSlots: p.skillSlots ?? null,
    total: Math.round((p.atk[1] + p.def[1] + p.agi[1]) * 100) / 100,
    hp: p.hp,
    atk: p.atk,
    def: p.def,
    agi: p.agi,
  }
  if (typeof p.image === 'string' && p.image) out.image = p.image
  return out
}
export function cleanItem(it) {
  const out = {
    name: it.name.trim(),
    category: it.category,
    stats: it.stats.map(({ stat, value, min, max }) => (Number.isInteger(min) && Number.isInteger(max) ? { stat, value, min, max } : { stat, value })),
  }
  if (typeof it.source === 'string' && it.source.trim()) out.source = it.source.trim()
  if (typeof it.note === 'string' && it.note.trim()) out.note = it.note.trim()
  if (typeof it.image === 'string' && it.image) out.image = it.image
  return out
}
