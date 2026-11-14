// 경험치·사냥터·판매
import { grounds } from './data'

export const PARTIES = ['2인', '3인', '4인', '5인']
export const TRANSFORMS = ['없음', '꼬미', '풍백']
export const TRANSFORM_NOTE = { 꼬미: '+15%', 풍백: '+20%' }
const PARTY_BONUS = { '2인': 0, '3인': 0.15, '4인': 0.2, '5인': 0.25 }
const TRANSFORM_BONUS = { 없음: 0, 꼬미: 0.15, 풍백: 0.2 }
const BOOST_BONUS = 1
export const MOON_BONUS = 1 // 월경

// 사냥터의 시간당 경험치
export const hourlyExp = (ground, { party, transform, boost }) => ground.rates[party][transform][boost ? 1 : 0]
export const multiplier = ({ party, transform, boost }) => 1 + PARTY_BONUS[party] + (boost ? BOOST_BONUS : 0) + TRANSFORM_BONUS[transform]

// 들어가는 돈: 경구 300원/시간, 꼬미 2000원/168시간, 풍백 50만 캐시/336시간
export function costs(hours, { transform, boost }) {
  const out = []
  if (boost) out.push({ label: '경구', amount: Math.ceil(hours) * 300, unit: '원' })
  if (transform === '꼬미') out.push({ label: '꼬미', amount: Math.ceil(hours / 168) * 2000, unit: '원' })
  if (transform === '풍백') out.push({ label: '풍백', amount: Math.ceil(hours / 336) * 5e5, unit: '캐시' })
  return out
}
export const shortNum = (v) => (v >= 1e4 ? `${Math.round(v / 1e4).toLocaleString('ko-KR')}만` : Math.round(v).toLocaleString('ko-KR'))

// 레벨대별 추천 사냥터 경로 (고순/저순)
export const route = (cycle) => [
  { name: '아부굴', from: 1, to: 5 },
  { name: '무이굴', from: 5, to: 25 },
  { name: '채석장', from: 25, to: 40 },
  { name: '폐허', from: 40, to: 60 },
  { name: `알 수 없는 지하 ${cycle}`, from: 60, to: 80 },
  { name: `눈물의 동굴 ${cycle}`, from: 80, to: 100 },
  { name: `콧구멍동굴 ${cycle}`, from: 100, to: 120 },
  { name: `강인함의 동굴 ${cycle}`, from: 120, to: 140 },
]
export const TOP_PET = 0.6 // 탑펫은 경험치 60%

export const totalExpAt = (table, level) => table.find((r) => r.level === level)?.total ?? 0
export function expNeeded(table, from, to, pctDone) {
  if (to <= from) return 0
  const base = totalExpAt(table, from)
  const done = ((totalExpAt(table, from + 1) - base) * pctDone) / 100
  return Math.max(0, totalExpAt(table, to) - base - done)
}
export function routeHours(table, legs, from, to, rateOf, done = 0) {
  return legs.flatMap((leg) => {
    const a = Math.max(from, leg.from)
    const b = Math.min(to, leg.to)
    if (a >= b) return []
    const need = totalExpAt(table, b) - totalExpAt(table, a) - (a === from ? done : 0)
    return [{ ground: leg.name, from: a, to: b, hours: need / rateOf(leg.name) }]
  })
}
// 월경 시간만큼 배율이 올라 시간이 줄어든다
export function applyMoon(hoursList, moonHours, ratio = 2) {
  let left = moonHours
  return hoursList.map((h) => {
    if (ratio <= 1) return h
    const saved = Math.min(left * (ratio - 1), h * (1 - 1 / ratio))
    left -= saved / (ratio - 1)
    return h - saved
  })
}

export const GROUND_GROUPS = [
  { label: '60+ 사냥터', grounds: grounds.filter((g) => g.level >= 60) },
  { label: '일반 사냥터', grounds: grounds.filter((g) => g.level < 60) },
]
export const groundLabel = (name) => {
  const g = grounds.find((x) => x.name === name)
  return g ? `${g.name} (Lv.${g.level})` : name
}

/* ---------- 판매 ---------- */
export function sellPrice(tier, level, base) {
  if (tier === '일반') return base
  const low = level <= 100
  return tier === '2등급' ? base * (low ? 6 : 3) : base * (low ? 10 : 5)
}
export const perTenMillion = (stone, exp) => (exp > 0 ? Math.round((stone / exp) * 1e7) : 0)
export const ratio = (a, b) => (b > 0 ? a / b : 0)
const MILLION = 1e6
export const vipToStone = (vip, rate) => (rate > 0 ? Math.round((vip * MILLION) / rate) : 0)
export const stoneToVip = (stone, rate) => (stone * rate) / MILLION
export function niceStep(max, ticks = 5) {
  const raw = max / ticks
  const p = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 5, 10].find((m) => m * p >= raw) * p
}
