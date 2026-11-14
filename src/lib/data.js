import pets from '../data/pets.json'
import items from '../data/items.json'
import raids from '../data/raids.json'
import families from '../data/families.json'
import grounds from '../data/grounds.json'
import expTable from '../data/exp.json'
import enhance from '../data/enhance.json'
import quiz from '../data/quiz.json'
import rides from '../data/rides.json'
import embedded from 'virtual:images'

export { pets, items, raids, families, grounds, expTable, enhance, quiz, rides }

export const ATTRS = ['지', '수', '화', '풍']
export const ATTR_ICON = { 지: '🌿', 수: '💧', 화: '🔥', 풍: '🌪️' }
export const TIERS = ['일반', '2등급', '1등급']
export const TIER_ICON = { 일반: '🪙', '2등급': '🥈', '1등급': '🥇' }
export const SOURCE_TYPES = ['필드포획', '퀘스트', '코스', '운영지원', '기타']
export const ITEM_CATEGORIES = ['무기', '투구', '갑옷', '악세서리', '삼위일체', '보조', '전리품']
export const ITEM_STATS = ['공격', '방어', '순발', '내구', '크리', '회피']
export const STAT_KEYS = ['hp', 'atk', 'def', 'agi']

// 그림 파일 위치. 원본 사이트의 그림은 가져오지 않았으니 public/ 아래에 직접 넣으면 나온다.
const IMG_BASE = import.meta.env.BASE_URL ?? '/'
const isUrl = (s) => /^(https?:)?\//.test(s)
// 미리보기용 한 파일 빌드(EMBED=1)에서는 그림이 파일 안에 들어 있다
export const asset = (folder, file) => embedded[`${folder}/${file}`] ?? `${IMG_BASE}${folder}/${encodeURIComponent(file)}`
export const petImage = (pet) => {
  const f = pet.image ?? `${pet.name}.gif`
  return isUrl(f) ? f : asset('pets', f)
}
export const itemImage = (file) => (isUrl(file) ? file : asset('items', file))
export const itemImageByName = (name) => {
  const it = items.find((i) => i.name === name)
  return it?.image ? itemImage(it.image) : ''
}
export const findPet = (name) => pets.find((p) => p.name === name)

export const attrText = (attrs) =>
  ATTRS.filter((a) => attrs[a]).map((a) => `${ATTR_ICON[a]} ${a} (${attrs[a]})`).join(' ')

export const charImage = (name) => asset('chars', `${name}.gif`)

// 승인된 제출을 기본 데이터에 합친다 (같은 이름이면 바꿔 끼운다)
function mergeInto(list, extra) {
  let n = 0
  for (const e of [...extra].reverse()) {
    if (!e?.name) continue
    const i = list.findIndex((x) => x.name === e.name)
    if (i >= 0) list.splice(i, 1)
    list.unshift(e)
    n++
  }
  return n
}
let version = 0
const listeners = new Set()
export function mergeEntries({ pets: p = [], items: it = [] }) {
  const n = mergeInto(pets, p) + mergeInto(items, it)
  if (n > 0) {
    version++
    listeners.forEach((f) => f())
  }
  return n
}
export const subscribeData = (f) => (listeners.add(f), () => listeners.delete(f))
export const dataVersion = () => version
