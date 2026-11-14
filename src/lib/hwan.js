// 펫 등급(환각) 계산 핵심
// 초기치 = (기본 배분 + 등급 보정 -2~+2 + 보너스 10점 랜덤 배분) × 초기 계수 / 100 을
// 체·공·방·순 변환식에 넣어 얻는다.

export const GRADE_MIN = -2
export const GRADE_MAX = 2
export const BONUS_POINTS = 10
export const HWAN_GRADE = 8
const AVG_BONUS = BONUS_POINTS / 4

// 보너스 10점을 4칸에 나누는 모든 경우
export const BONUS_SPLITS = (() => {
  const out = []
  for (let a = 0; a <= BONUS_POINTS; a++)
    for (let b = 0; a + b <= BONUS_POINTS; b++)
      for (let c = 0; a + b + c <= BONUS_POINTS; c++) out.push([a, b, c, BONUS_POINTS - a - b - c])
  return out
})()
export const TOTAL_CASES = 625 * BONUS_SPLITS.length

const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1))
// 보너스가 한 점씩 무작위 칸으로 갈 때 이 배분이 나올 경우의 수
export const splitWeight = (split) => fact(BONUS_POINTS) / split.reduce((m, x) => m * fact(x), 1)

// 표시 스탯(체공방순) → 내부 포인트(체력·완력·건강·순발)
export function statsToPoints([hp, atk, def, agi]) {
  const s = agi
  const a = atk - 0.05 * s
  const d = def - 0.05 * s
  const h = hp - s
  const c = (a - d) / 0.9
  const dd = (a - c - (0.1 * (h - c)) / 4) / 1.05
  return [(h - c - 2 * dd) / 4, dd + c, dd, s]
}

// 포인트 → 표시 스탯
export function pointsToStats([h, a, d, s]) {
  return [h * 4 + a + d + s, h * 0.1 + a + d * 0.1 + s * 0.05, h * 0.1 + a * 0.1 + d + s * 0.05, s]
}
const scaledPointsToStats = (pts, init) => pointsToStats(pts.map((p) => (p * init) / 100))

// 펫의 S랭크 초기치에서 초기 계수와 기본 배분을 찾는다
const fitCache = new WeakMap()
export function fitBase(pet) {
  const hit = fitCache.get(pet)
  if (hit) return hit
  const pts = statsToPoints([pet.hp[0], pet.atk[0], pet.def[0], pet.agi[0]])
  let best = null
  for (let init = 10; init <= 30; init++) {
    const raw = pts.map((p) => (p * 100) / init - GRADE_MAX - AVG_BONUS)
    const err = Math.max(...raw.map((x) => Math.abs(x - Math.round(x))))
    if (!best || err < best.error - 1e-9) best = { init, alloc: raw.map(Math.round), error: err }
  }
  fitCache.set(pet, best)
  return best
}

// 1레벨 스탯으로 나올 수 있는 모든 조합을 찾는다. offsets = 입력 스탯 - S랭크 초기치(내림)
export function calcHwan(pet, offsets) {
  const { init, alloc } = fitBase(pet)
  const target = [pet.hp[0], pet.atk[0], pet.def[0], pet.agi[0]].map((v, i) => Math.floor(v) + offsets[i])
  const rows = []
  const gradeCount = new Map()
  let weightAll = 0
  let weightHwan = 0
  for (let a = GRADE_MIN; a <= GRADE_MAX; a++)
    for (let b = GRADE_MIN; b <= GRADE_MAX; b++)
      for (let c = GRADE_MIN; c <= GRADE_MAX; c++)
        for (let d = GRADE_MIN; d <= GRADE_MAX; d++) {
          const base = [a, b, c, d]
          const grade = a + b + c + d
          for (const bonus of BONUS_SPLITS) {
            const values = scaledPointsToStats(alloc.map((x, i) => x + base[i] + bonus[i]), init)
            if (values.some((v, i) => Math.floor(v) !== target[i])) continue
            rows.push({ grade, values, base, bonus })
            gradeCount.set(grade, (gradeCount.get(grade) ?? 0) + 1)
            const w = splitWeight(bonus)
            weightAll += w
            if (grade === HWAN_GRADE) weightHwan += w
          }
        }
  const total = rows.length
  const hwanCount = gradeCount.get(HWAN_GRADE) ?? 0
  const grades = [...gradeCount.entries()]
    .sort(([x], [y]) => y - x)
    .map(([grade, count]) => ({ grade, count, share: count / total }))
  return {
    total,
    grades,
    bestGrade: grades[0]?.grade ?? null,
    hwanCount,
    hwanRate: total > 0 ? hwanCount / total : 0,
    weightedHwanRate: weightAll > 0 ? weightHwan / weightAll : 0,
    appearRate: total / TOTAL_CASES,
    rows: rows.sort((x, y) => y.grade - x.grade),
  }
}

export const HWAN_MESSAGES = [
  { min: 0.1, tone: 'success', prob: 'high', message: '✨ 환상적인 확률! 기대해도 좋습니다!' },
  { min: 0.05, tone: 'success', prob: 'high', message: '매우 좋은 확률입니다! 충분히 도전해 볼 만해요 ✨' },
  { min: 0.01, tone: 'encourage', prob: 'high', message: '기운이 좋습니다! 꾸준히 도전하면 빛을 볼 수 있어요 💪' },
  { min: 0.001, tone: 'encourage', prob: 'mid', message: '쉽지 않은 도전이지만, 불가능은 아닙니다! 🌟' },
  { min: Number.MIN_VALUE, tone: 'encourage', prob: 'low', message: '확률은 낮지만 0%는 아닙니다. 전설은 여기서 탄생합니다 🌠' },
]
export function hwanMessage(rate, best) {
  return HWAN_MESSAGES.find((m) => rate >= m.min) ?? { tone: 'fail', prob: 'low', message: `${best}등급 — 환각이 아닙니다` }
}

// 레벨별 S랭크 스탯 (도감 성장률 단순 적용)
export const statAtLevel = ([init, growth], level) => Math.floor(init + growth * (level - 1))
export const growthBetween = (initial, current, level) => (level > 1 ? (current - initial) / (level - 1) : 0)

// 총성장(공+방+순)
export const totalGrowth = (p) => Math.round((p.atk[1] + p.def[1] + p.agi[1]) * 100) / 100

/* ---------- 레벨업 성장 모델 ---------- */
const KEYS = ['hp', 'atk', 'def', 'agi']
const GROWTH_RATES = [435, 455, 475, 495, 515, 535, 555, 575]
export const POINT_MATRIX = [
  [4, 1, 1, 1],
  [0.1, 1, 0.1, 0.05],
  [0.1, 0.1, 1, 0.05],
  [0, 0, 0, 1],
]
const applyMatrix = (v) => POINT_MATRIX.map((row) => row.reduce((s, m, i) => s + m * v[i], 0))

const growthMatches = (pet, g) => KEYS.every((k, i) => Math.abs(Math.round(g[i] * 100) / 100 - pet[k][1]) < 1e-9)

function findGrowthModel(pet, points) {
  const direct = GROWTH_RATES.map((rate) => ({
    growth: applyMatrix(points.map((p) => (p * rate) / 1e4)),
    points,
    rate,
  })).filter(({ growth }) => growthMatches(pet, growth))
  if (direct.length === 1) return direct[0]
  if (direct.length > 1) return null
  const g = KEYS.map((k) => pet[k][1])
  const found = []
  const det3 = (m) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  const M3 = [
    [4, 1, 1],
    [0.1, 1, 0.1],
    [0.1, 0.1, 1],
  ]
  for (const rate of GROWTH_RATES) {
    const r = rate / 1e4
    for (let s = Math.ceil(((g[3] - 0.005) / r) * 2) / 2; s * r < g[3] + 0.005; s += 0.5) {
      const rhs = [g[0] / r - s, g[1] / r - 0.05 * s, g[2] / r - 0.05 * s]
      const D = det3(M3)
      const [x, y, z] = [0, 1, 2].map((col) => det3(M3.map((row, ri) => row.map((v, ci) => (ci === col ? rhs[ri] : v)))) / D)
      const around = (v) => Array.from({ length: 13 }, (_, i) => Math.round(v * 2) / 2 - 3 + i * 0.5)
      for (const a of around(x))
        for (const b of around(y))
          for (const c of around(z)) {
            const growth = applyMatrix([a, b, c, s].map((v) => v * r))
            if (growthMatches(pet, growth)) found.push({ growth, points: [a, b, c, s], rate })
          }
    }
  }
  const same = (p, q) => p.growth.every((v, i) => Math.abs(v - q.growth[i]) < 1e-12)
  const uniq = found.filter((f, i) => found.findIndex((o) => same(f, o)) === i)
  return uniq.length === 1 ? uniq[0] : null
}

const modelCache = new WeakMap()
function growthModel(pet) {
  if (modelCache.has(pet)) return modelCache.get(pet)
  const { init, alloc } = fitBase(pet)
  const pts = alloc.map((a) => a + 4.5)
  const initial = applyMatrix(pts.map((p) => (init * p) / 100))
  const ok = KEYS.every((k, i) => Math.floor(initial[i] * 100 + 1e-6) / 100 === pet[k][0])
  const m = ok ? findGrowthModel(pet, pts) : null
  const res = m ? { initial, ...m } : null
  modelCache.set(pet, res)
  return res
}

export function growthAlloc(pet) {
  const m = growthModel(pet)
  return m ? { alloc: m.points.map((p) => p - 4.5), center: m.rate / 100 } : null
}

// 레벨별 S랭크 평균 스탯 (성장 모델을 찾으면 그것으로, 못 찾으면 도감 성장률로)
export function standardStats(pet, level) {
  const m = growthModel(pet)
  const at = (i) => {
    const [init, g] = pet[KEYS[i]]
    return Math.floor(m ? m.initial[i] + m.growth[i] * (level - 1) + 1e-9 : init + g * (level - 1))
  }
  return { hp: at(0), atk: at(1), def: at(2), agi: at(3) }
}

/* ---------- 레벨업 환각 (확률 분포) ---------- */
const SPLIT_COUNT = 10
const RATE_HALF = 0.25
const RATE_STEP = 0.01
const CENTER_BASE = 4.35
const CENTER_STEP = 0.2
const CENTER_TOL = 0.03
const ROUND_VAR = 1 / 12
const GRADE_STEPS = 5
const SPLIT_N = 11

export const LEVEL_SPLITS = (() => {
  const out = []
  const all = 4 ** SPLIT_COUNT
  for (let a = 0; a <= SPLIT_COUNT; a++)
    for (let b = 0; a + b <= SPLIT_COUNT; b++)
      for (let c = 0; a + b + c <= SPLIT_COUNT; c++) {
        const split = [a, b, c, SPLIT_COUNT - a - b - c]
        out.push({ split, weight: splitWeight(split) / all })
      }
  return out
})()

export function growthCenter(pet) {
  const { alloc } = fitBase(pet)
  const r = statsToPoints([pet.hp[1], pet.atk[1], pet.def[1], pet.agi[1]]).map((v, i) => (v * 100) / (alloc[i] + 4.5))
  const avg = r.reduce((s, x) => s + x, 0) / r.length
  const snapped = CENTER_BASE + Math.round((avg - CENTER_BASE) / CENTER_STEP) * CENTER_STEP
  return Math.abs(snapped - avg) <= CENTER_TOL ? Math.round(snapped * 100) / 100 : avg
}

const binom1 = Array.from({ length: SPLIT_N }, (_, k) => (fact(SPLIT_COUNT) / (fact(k) * fact(SPLIT_COUNT - k))) * 0.25 ** k * 0.75 ** (SPLIT_COUNT - k))
const binom2 = Array.from({ length: SPLIT_N }, (_, i) =>
  Array.from({ length: SPLIT_N }, (_, j) =>
    i + j > SPLIT_COUNT ? 0 : (fact(SPLIT_COUNT) / (fact(i) * fact(j) * fact(SPLIT_COUNT - i - j))) * 0.25 ** (i + j) * 0.5 ** (SPLIT_COUNT - i - j),
  ),
)

// 한 번 레벨업할 때 오르는 포인트의 평균과 공분산 (등급 보정별)
export function levelUpMoments(alloc, center) {
  const lo = Math.round((center - RATE_HALF) * 100)
  const hi = Math.round((center + RATE_HALF) * 100)
  const rates = Array.from({ length: hi - lo + 1 }, (_, i) => Math.fround((lo + i) * RATE_STEP))
  const gains = alloc.map((a) =>
    Array.from({ length: GRADE_STEPS }, (_, g) =>
      rates.map((r) => Array.from({ length: SPLIT_N }, (_, k) => Math.trunc(Math.fround(Math.fround((a + GRADE_MIN + g) * r) + Math.fround(k * r))))),
    ),
  )
  const pr = 1 / rates.length
  const mean = gains.map((s) => s.map((byRate) => byRate.reduce((acc, row) => acc + row.reduce((x, v, k) => x + binom1[k] * v, 0), 0) * pr))
  const sq = gains.map((s) => s.map((byRate) => byRate.reduce((acc, row) => acc + row.reduce((x, v, k) => x + binom1[k] * v * v, 0), 0) * pr))
  const cross = [0, 1, 2, 3].map(() => [0, 1, 2, 3].map(() => []))
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++) {
      const tab = []
      for (let gi = 0; gi < GRADE_STEPS; gi++) {
        const row = []
        for (let gj = 0; gj < GRADE_STEPS; gj++) {
          let acc = 0
          for (let r = 0; r < rates.length; r++) {
            const A = gains[i][gi][r]
            const B = gains[j][gj][r]
            for (let x = 0; x < SPLIT_N; x++) for (let y = 0; x + y <= SPLIT_COUNT; y++) acc += binom2[x][y] * A[x] * B[y]
          }
          row.push(acc * pr)
        }
        tab.push(row)
      }
      cross[i][j] = tab
    }
  return (grade) => {
    const g = grade.map((x) => x - GRADE_MIN)
    const m = g.map((gi, i) => mean[i][gi])
    return {
      mean: m,
      cov: [0, 1, 2, 3].map((i) =>
        [0, 1, 2, 3].map((j) => {
          if (i === j) return sq[i][g[i]] - m[i] * m[i]
          const [a, b] = i < j ? [i, j] : [j, i]
          return cross[a][b][g[a]][g[b]] - m[i] * m[j]
        }),
      ),
    }
  }
}

const matMul = (A, B) => A.map((row) => B[0].map((_, c) => row.reduce((s, v, k) => s + v * B[k][c], 0)))
const transpose = (A) => A[0].map((_, c) => A.map((row) => row[c]))
function cholesky(A) {
  const n = A.length
  const L = A.map(() => Array(n).fill(0))
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i][j]
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]
      if (i === j) {
        if (s <= 0) return null
        L[i][i] = Math.sqrt(s)
      } else L[i][j] = s / L[j][j]
    }
  return L
}
function mahalanobis(L, v) {
  const y = []
  for (let i = 0; i < v.length; i++) {
    let s = v[i]
    for (let k = 0; k < i; k++) s -= L[i][k] * y[k]
    y.push(s / L[i][i])
  }
  return y.reduce((s, x) => s + x * x, 0)
}

export const LEVEL_MIN_SHARE = 0.001
const PLAUSIBLE_DIST = 30

function summarize(weights, total, plausible) {
  if (total <= 0 || !Number.isFinite(total)) return { grades: [], hwanRate: 0, bestGrade: null, plausible: false }
  const grades = [...weights.entries()]
    .map(([grade, w]) => ({ grade, share: w / total }))
    .filter(({ share }) => share >= LEVEL_MIN_SHARE)
    .sort((a, b) => b.grade - a.grade)
  const top = [...grades].sort((a, b) => b.share - a.share)[0]
  return { grades, hwanRate: (weights.get(HWAN_GRADE) ?? 0) / total, bestGrade: top?.grade ?? null, plausible }
}

// 등급 보정×보너스 배분별로 레벨 L의 스탯 분포(정규 근사)를 만든다
export function levelDistribution(pet, level) {
  const { init, alloc } = fitBase(pet)
  const ga = growthAlloc(pet)
  const moments = levelUpMoments(ga?.alloc ?? alloc, ga?.center ?? growthCenter(pet))
  const ups = Math.max(0, level - 1)
  const gw = 1 / GRADE_STEPS ** 4
  const parts = []
  for (let a = GRADE_MIN; a <= GRADE_MAX; a++)
    for (let b = GRADE_MIN; b <= GRADE_MAX; b++)
      for (let c = GRADE_MIN; c <= GRADE_MAX; c++)
        for (let d = GRADE_MIN; d <= GRADE_MAX; d++) {
          const g = [a, b, c, d]
          const pts = alloc.map((x, i) => x + g[i])
          const { mean, cov } = moments(g)
          const C = matMul(matMul(POINT_MATRIX, cov.map((r) => r.map((v) => (v * ups) / 1e4))), transpose(POINT_MATRIX)).map((r, i) =>
            r.map((v, j) => v + (i === j ? ROUND_VAR : 0)),
          )
          for (const { split, weight } of LEVEL_SPLITS) {
            const p = pts.map((x, i) => (init * (x + split[i]) + ups * mean[i]) / 100)
            parts.push({ weight: weight * gw, grade: a + b + c + d, mean: POINT_MATRIX.map((row) => row.reduce((s, m, k) => s + m * p[k], 0)), cov: C })
          }
        }
  return parts
}

export function calcLevelHwan(pet, level, stats) {
  if (level <= 1) {
    const base = [pet.hp[0], pet.atk[0], pet.def[0], pet.agi[0]].map(Math.floor)
    const r = calcHwan(pet, stats.map((v, i) => v - base[i]))
    const w = new Map()
    let sum = 0
    for (const { grade, bonus } of r.rows) {
      const x = splitWeight(bonus)
      w.set(grade, (w.get(grade) ?? 0) + x)
      sum += x
    }
    return summarize(w, sum, r.total > 0)
  }
  const { init, alloc } = fitBase(pet)
  const ga = growthAlloc(pet)
  const moments = levelUpMoments(ga?.alloc ?? alloc, ga?.center ?? growthCenter(pet))
  const ups = level - 1
  const obs = stats.map((v) => v + 0.5)
  const w = new Map()
  let sum = 0
  let nearest = Infinity
  for (let a = GRADE_MIN; a <= GRADE_MAX; a++)
    for (let b = GRADE_MIN; b <= GRADE_MAX; b++)
      for (let c = GRADE_MIN; c <= GRADE_MAX; c++)
        for (let d = GRADE_MIN; d <= GRADE_MAX; d++) {
          const g = [a, b, c, d]
          const pts = alloc.map((x, i) => x + g[i])
          const { mean, cov } = moments(g)
          const L = cholesky(
            matMul(matMul(POINT_MATRIX, cov.map((r) => r.map((v) => (v * ups) / 1e4))), transpose(POINT_MATRIX)).map((r, i) =>
              r.map((v, j) => v + (i === j ? ROUND_VAR : 0)),
            ),
          )
          if (!L) continue
          const logDet = 2 * L.reduce((s, row, i) => s + Math.log(row[i]), 0)
          let acc = 0
          for (const { split, weight } of LEVEL_SPLITS) {
            const p = pts.map((x, i) => (init * (x + split[i]) + ups * mean[i]) / 100)
            const mu = POINT_MATRIX.map((row) => row.reduce((s, m, k) => s + m * p[k], 0))
            const dist = mahalanobis(L, obs.map((o, i) => o - mu[i]))
            nearest = Math.min(nearest, dist)
            acc += weight * Math.exp(-0.5 * dist - 0.5 * logDet)
          }
          const grade = a + b + c + d
          w.set(grade, (w.get(grade) ?? 0) + acc)
          sum += acc
        }
  return summarize(w, sum, nearest <= PLAUSIBLE_DIST)
}

export const LEVEL_MESSAGES = [
  { min: 0.9, tone: 'success', prob: 'high', message: '✨ 거의 확실한 환각입니다!' },
  { min: 0.5, tone: 'success', prob: 'high', message: '환각일 가능성이 높아요! ✨' },
  { min: 0.1, tone: 'encourage', prob: 'mid', message: '환각일 수도 있어요. 레벨을 더 올린 뒤 다시 확인해 보세요 🌟' },
  { min: LEVEL_MIN_SHARE, tone: 'encourage', prob: 'low', message: '환각일 가능성은 낮아요' },
]
export const levelMessage = (rate, best) =>
  LEVEL_MESSAGES.find((m) => rate >= m.min) ?? { tone: 'fail', prob: 'low', message: `${best}등급으로 보여요 — 환각이 아닙니다` }
