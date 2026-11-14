// 속성 상성·선턴·데미지 역산
import { fitBase, pointsToStats, statsToPoints } from './hwan'

const ATTR_TABLE = {
  화: { 화: 1, 수: 0.6, 지: 1, 풍: 1.5 },
  수: { 화: 1.5, 수: 1, 지: 0.6, 풍: 1 },
  지: { 화: 1, 수: 1.5, 지: 1, 풍: 0.6 },
  풍: { 화: 0.6, 수: 1, 지: 1.5, 풍: 1 },
}
// 공격 속성 → 방어 속성 배율 (칸 수 비율로 섞음)
export function attrMultiplier(attacker, defender) {
  let m = 0
  for (const [a, x] of Object.entries(attacker)) for (const [d, y] of Object.entries(defender)) m += (x / 10) * (y / 10) * ATTR_TABLE[a][d]
  return m
}
export const attrOutlook = (m) => (m >= 1.3 ? '매우 유리' : m > 1.05 ? '유리' : m < 0.8 ? '매우 불리' : m < 0.95 ? '불리' : '보통')

const AGI_PAD = 20
const AGI_SURE = 0.7
export function turnOutlook(mine, theirs) {
  const a = mine + AGI_PAD
  const b = theirs + AGI_PAD
  if (a * AGI_SURE > b) return '확정 선턴'
  if (a < b * AGI_SURE) return '확정 후턴'
  return mine === theirs ? '반반' : mine > theirs ? '유리' : '불리'
}

// 데미지 = (공격×0.7 − 방어/2) × 속성배율 ± 랜덤(15/16~17/15 근사)
const ATK_K = 0.7
const DEF_DIV = 2
const HI = 16 / 15
const LO = 16 / 17
export function guessDefense(myAtk, dmgLow, dmgHigh, mult) {
  const f = (d) => Math.max(0, Math.round((myAtk - d / mult / DEF_DIV) / ATK_K))
  return [f(Math.max(dmgLow, dmgHigh) * HI), f(Math.min(dmgLow, dmgHigh) * LO)]
}
export function guessAttack(myDef, dmgLow, dmgHigh, mult) {
  const f = (d) => Math.round(myDef * ATK_K + d / mult / DEF_DIV)
  return [f(Math.min(dmgLow, dmgHigh) * LO), f(Math.max(dmgLow, dmgHigh) * HI)]
}

/* ---------- 독딜 ---------- */
const BONUS = 10
export function poisonDamage(pet, grade) {
  const { init, alloc } = fitBase(pet)
  const sum = alloc.reduce((s, x) => s + x, 0) + grade + BONUS
  return Math.max(1, Math.trunc((Math.floor((init * sum) / 100) - 20) / 4))
}
export const poisonTable = (pet) => Array.from({ length: 17 }, (_, i) => ({ grade: 8 - i, damage: poisonDamage(pet, 8 - i) }))

/* ---------- 펫 시뮬레이터 ---------- */
const rollGrade = (rnd) => {
  const g = () => Math.floor(rnd() * 5) - 2
  return [g(), g(), g(), g()]
}
const rollBonus = (rnd) => {
  const b = [0, 0, 0, 0]
  for (let i = 0; i < BONUS; i++) b[Math.floor(rnd() * 4)]++
  return b
}

// 1레벨 포획 한 마리
export function capture(pet, rnd = Math.random) {
  const { init, alloc } = fitBase(pet)
  const g = rollGrade(rnd)
  const b = rollBonus(rnd)
  const pts = alloc.map((a, i) => (init * (a + g[i] + b[i])) / 100)
  return { grade: g.reduce((s, x) => s + x, 0), stats: pointsToStats(pts).map(Math.floor) }
}
export const binomialHits = (p, n, rnd = Math.random) => {
  let k = 0
  for (let i = 0; i < n; i++) if (rnd() < p) k++
  return k
}
export const tryUntil = (p, rnd = Math.random) => {
  if (p <= 0) return Infinity
  let n = 1
  while (rnd() >= p) n++
  return n
}

const RATE_SPREAD = 0.25
function centerOf(pet, alloc) {
  const r = statsToPoints([pet.hp[1], pet.atk[1], pet.def[1], pet.agi[1]]).map((v, i) => (v * 100) / (alloc[i] + 4.5))
  return r.reduce((s, x) => s + x, 0) / r.length
}
function growOne({ init, alloc }, center, level, rnd) {
  const g = rollGrade(rnd)
  const base = alloc.map((a, i) => a + g[i])
  const b = rollBonus(rnd)
  const pts = base.map((x, i) => init * (x + b[i]))
  for (let l = 1; l < level; l++) {
    const up = rollBonus(rnd)
    const rate = center - RATE_SPREAD + rnd() * RATE_SPREAD * 2
    for (let i = 0; i < 4; i++) pts[i] += Math.floor((base[i] + up[i]) * rate)
  }
  return pointsToStats(pts.map((p) => p / 100))
}
const SIM_LABELS = ['체력', '공격', '방어', '순발']
export function simulateGrowth(pet, level, count, rnd = Math.random) {
  const fit = fitBase(pet)
  const c = centerOf(pet, fit.alloc)
  const runs = Array.from({ length: count }, () => growOne(fit, c, level, rnd).map(Math.floor))
  return SIM_LABELS.map((label, i) => {
    const v = runs.map((r) => r[i]).sort((a, b) => a - b)
    return {
      label,
      min: v[0],
      mean: v.reduce((s, x) => s + x, 0) / v.length,
      top: v[Math.max(0, Math.ceil(v.length * 0.99) - 1)],
      max: v[v.length - 1],
      values: v,
    }
  })
}
export const shareAtLeast = (sorted, x) => sorted.filter((v) => v >= x).length / sorted.length
