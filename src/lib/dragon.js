// 멸룡급 판독: S급(환각)으로 잡은 펫이 이 레벨까지 컸을 때의 분포와 비교한다
import { pets } from './data'
import { HWAN_GRADE, levelDistribution, standardStats } from './hwan'

export const STAT_LABELS = ['내구력', '공격력', '방어력', '순발력']
const TOP_SHARE = 0.001 // 최대치 = 1000마리 중 최고 수준
export const TOP_N = Math.round(1 / TOP_SHARE)

const TIERS = [
  { hp: 6, sum: 6, tier: { name: '멸룡급', emoji: '🐉', tone: 'gold', message: '내구 +6·능력치 합 +6을 넘긴 멸룡급입니다!' } },
  { hp: 3, sum: 3, tier: { name: '준멸룡급', emoji: '🔥', tone: 'mint', message: '정석보다 확실히 잘 큰, 멸룡급 바로 아래예요' } },
  { hp: -3, sum: -3, tier: { name: 'S급 정석', emoji: '✨', tone: 'plain', message: 'S급 정석 수준이에요. 준멸룡급 바로 아래예요' } },
  { hp: -Infinity, sum: -Infinity, tier: { name: '정석 미만', emoji: '🌱', tone: 'low', message: 'S급 정석보다 아래예요' } },
]
const tierOf = (hp, sum) => TIERS.find((t) => hp >= t.hp && sum >= t.sum).tier

// 정규분포 위쪽 꼬리 P(X >= x)
function upperTail(x, mean, sd) {
  const z = (x - mean) / (sd * Math.SQRT2)
  const a = Math.abs(z)
  const t = 1 / (1 + 0.5 * a)
  const erfc =
    t *
    Math.exp(
      -a * a -
        1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    )
  return 0.5 * (z >= 0 ? erfc : 2 - erfc)
}
const NO_SHIFT = [{ shift: 0, p: 1 }]
const mixTail = (mix, x) => mix.reduce((s, { weight, mean, sd }) => s + weight * upperTail(x, mean, sd), 0)
const shiftedTail = (mix, shifts, x) => shifts.reduce((s, { shift, p }) => s + p * mixTail(mix, x - shift), 0)

function quantile(mix, shifts, p) {
  const maxShift = Math.max(...shifts.map((s) => s.shift))
  let lo = Math.min(...mix.map(({ mean, sd }) => mean - 10 * sd))
  let hi = Math.max(...mix.map(({ mean, sd }) => mean + 10 * sd)) + maxShift
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (shiftedTail(mix, shifts, mid) > p) lo = mid
    else hi = mid
  }
  return hi
}

function hwanDistribution(pet, level) {
  const parts = levelDistribution(pet, level).filter((p) => p.grade === HWAN_GRADE)
  const sum = parts.reduce((s, p) => s + p.weight, 0)
  const norm = parts.map((p) => ({ ...p, weight: p.weight / sum }))
  const st = standardStats(pet, level)
  const standard = [st.hp, st.atk, st.def, st.agi]
  return { parts: norm, standard, weights: standard.map((v) => 1 / Math.max(1, v)) }
}
const statMix = ({ parts }, i) => parts.map(({ weight, mean, cov }) => ({ weight, mean: mean[i], sd: Math.sqrt(cov[i][i]) }))
const scoreMix = ({ parts, weights }) =>
  parts.map(({ weight, mean, cov }) => {
    let v = 0
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) v += weights[i] * weights[j] * cov[i][j]
    return { weight, mean: mean.reduce((s, m, i) => s + m * weights[i], 0), sd: Math.sqrt(v) }
  })
const scoreOf = ({ weights }, stats) => stats.reduce((s, v, i) => s + (v + 0.5) * weights[i], 0)

const baseOfReborn = (pet) => {
  const name = pet.name.replace(/\(환생\)$/, '').replace(/^환생/, '')
  return name === pet.name ? undefined : pets.find((p) => p.name === name)
}

const SAMPLES = 20000
const BINS = 200
function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 1831565813) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function chol(A) {
  const L = A.map(() => [0, 0, 0, 0])
  for (let i = 0; i < 4; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i][j]
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j]
    }
  return L
}

// 환생 펫: 원래 펫을 140레벨에 환생시켰을 때 넘어오는 보정치(S급 정석 초과분) 분포
function rebornShifts(base, target) {
  const dist = hwanDistribution(base, 140)
  const stats = [0, 1, 2, 3].map((i) => {
    const mix = statMix(dist, i)
    const std = dist.standard[i]
    const out = [{ shift: 0, p: 1 - mixTail(mix, std + 1) }]
    for (let k = 1; ; k++) {
      const p = mixTail(mix, std + k) - mixTail(mix, std + k + 1)
      if (p < 1e-12 && k > 3) break
      out.push({ shift: k, p })
    }
    return out
  })
  const rnd = seeded(140)
  const cum = []
  let acc = 0
  for (const { weight } of dist.parts) cum.push((acc += weight))
  const L = chol(dist.parts[0].cov)
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd())
  const scores = []
  for (let n = 0; n < SAMPLES; n++) {
    const u = rnd() * acc
    const idx = cum.findIndex((c) => c >= u)
    const part = dist.parts[idx < 0 ? dist.parts.length - 1 : idx]
    const z = [gauss(), gauss(), gauss(), gauss()]
    let sc = 0
    for (let i = 0; i < 4; i++) {
      let v = part.mean[i]
      for (let k = 0; k <= i; k++) v += L[i][k] * z[k]
      sc += Math.max(0, Math.floor(v) - dist.standard[i]) * target.weights[i]
    }
    scores.push(sc)
  }
  const top = Math.max(...scores)
  const step = top > 0 ? top / BINS : 1
  const bins = new Map()
  for (const s of scores) {
    const b = Math.round(s / step)
    bins.set(b, (bins.get(b) ?? 0) + 1)
  }
  return { stats, score: [...bins.entries()].map(([b, c]) => ({ shift: b * step, p: c / SAMPLES })) }
}

const cache = new Map()
const CACHE_MAX = 20
function prepare(pet, level) {
  const key = `${pet.name}|${level}|${pet.hp.join()}|${pet.atk.join()}|${pet.def.join()}|${pet.agi.join()}`
  if (cache.has(key)) return cache.get(key)
  const dist = hwanDistribution(pet, level)
  const base = baseOfReborn(pet)
  const reborn = base ? rebornShifts(base, dist) : undefined
  const statLines = [0, 1, 2, 3].map((i) => statMix(dist, i))
  const statShifts = [0, 1, 2, 3].map((i) => reborn?.stats[i] ?? NO_SHIFT)
  const res = {
    dist,
    base,
    statLines,
    statShifts,
    maxes: [0, 1, 2, 3].map((i) => Math.max(dist.standard[i] + 1, Math.floor(quantile(statLines[i], statShifts[i], TOP_SHARE)))),
    line: scoreMix(dist),
    shifts: reborn?.score ?? NO_SHIFT,
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
  cache.set(key, res)
  return res
}

const closeness = (v, std, max) => (max > std ? (v - std) / (max - std) : 0)

export function judgeDragon(pet, level, values) {
  const { dist, base, statLines, statShifts, maxes, line, shifts } = prepare(pet, level)
  const stats = STAT_LABELS.map((label, i) => ({
    label,
    value: values[i],
    standard: dist.standard[i],
    max: maxes[i],
    closeness: closeness(values[i], dist.standard[i], maxes[i]),
    top: shiftedTail(statLines[i], statShifts[i], values[i]),
  }))
  const score = scoreOf(dist, values)
  const avgClose = stats.reduce((s, x) => s + Math.min(1, Math.max(-1, x.closeness)), 0) / stats.length
  const hpGain = values[0] - dist.standard[0]
  const statGain = [1, 2, 3].reduce((s, i) => s + values[i] - dist.standard[i], 0)
  return {
    stats,
    closeness: avgClose,
    top: shiftedTail(line, shifts, score),
    hpGain,
    statGain,
    tier: tierOf(hpGain, statGain),
    plausible: stats.every((s) => s.top > 1e-9),
    rebornFrom: base?.name,
  }
}
