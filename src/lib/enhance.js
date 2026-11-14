// 장비 강화·삼위일체 재련
const SAFE_FROM = 5
const SAFE_SHIFT = 10

// 유지 옵션·큐브를 적용한 한 단계 확률
export function stepOdds(step, { keep, cubeBonus }) {
  const safe = keep && step.to >= SAFE_FROM
  const stay = step.stay + (safe ? SAFE_SHIFT : 0)
  const destroy = step.destroy - (safe ? SAFE_SHIFT : 0)
  const moved = destroy > 0 ? Math.min(cubeBonus, destroy) : 0
  return { success: step.success + moved, stay, destroy: destroy - moved, stone: step.stone * (safe ? 2 : 1) }
}

const outcome = (success, stay, roll) => (roll < success ? '성공' : roll < success + stay ? '유지' : '파괴')

// from → to 기대 비용(스톤)과 기대 파괴 횟수
export function expectedCost(steps, from, to, optsOf, lossValue) {
  if (to <= from) return { stone: 0, destroys: 0 }
  const memo = new Map([[to, { cost: 0, ruin: 0, loss: 0 }]])
  for (let lv = to - 1; lv >= 0; lv--) {
    const step = steps.find((s) => s.to === lv + 1)
    const o = optsOf(step.to)
    const odds = stepOdds(step, o)
    const next = memo.get(lv + 1)
    const retry = 100 / (100 - odds.stay)
    const ps = odds.success / 100
    const pd = odds.destroy / 100
    memo.set(lv, {
      cost: (odds.stone + (o.cubePrice ?? 0)) * retry + ps * retry * next.cost,
      ruin: retry * (ps * next.ruin + pd),
      loss: retry * (ps * next.loss + pd),
    })
  }
  const zero = memo.get(0)
  const restart = zero.ruin < 1 ? 1 / (1 - zero.ruin) : Infinity
  const full = (zero.cost + zero.loss * lossValue) * restart
  const here = memo.get(from)
  return { stone: here.cost + here.loss * lossValue + here.ruin * full, destroys: here.loss + here.ruin * zero.loss * restart }
}

export function tryOnce(steps, level, optsOf, rnd = Math.random) {
  const step = steps.find((s) => s.to === level + 1)
  const o = optsOf(step.to)
  const odds = stepOdds(step, o)
  const result = outcome(odds.success, odds.stay, rnd() * 100)
  return { level: result === '성공' ? level + 1 : result === '유지' ? level : 0, result, stone: odds.stone + (o.cubePrice ?? 0) }
}

const MAX_TRIES = 5e6
export function runUntil(steps, from, to, optsOf, cubeBipOf, gearBip, rnd = Math.random) {
  const table = new Map(
    steps.map((s) => {
      const o = optsOf(s.to)
      const odds = stepOdds(s, o)
      return [s.to, { ...odds, cost: odds.stone + (o.cubePrice ?? 0), bip: cubeBipOf(s.to) }]
    }),
  )
  let lv = from
  let tries = 0
  let destroys = 0
  let stone = 0
  let bip = 0
  while (lv < to && tries < MAX_TRIES) {
    const s = table.get(lv + 1)
    const r = outcome(s.success, s.stay, rnd() * 100)
    tries++
    stone += s.cost
    bip += s.bip
    if (r === '성공') lv++
    else if (r === '파괴') {
      destroys++
      bip += gearBip
      lv = 0
    }
  }
  return { tries, destroys, stone, bip }
}

// 파괴가 있는 단계마다 큐브를 바꿔 가장 싼 조합을 찾는다
export function cheapestCubes(steps, cubes, from, to, keep, cubeStonePrice, gearStone) {
  const levels = steps
    .filter((s) => s.to > from && s.to <= to)
    .filter((s) => stepOdds(s, { keep, cubeBonus: 0 }).destroy > 0)
    .map((s) => s.to)
  let best = { picks: {}, cost: Infinity }
  const walk = (i, picks) => {
    if (i === levels.length) {
      const { stone } = expectedCost(
        steps,
        from,
        to,
        (lv) => {
          const c = picks[lv] ?? 0
          return { keep, cubeBonus: cubes[c].bonus, cubePrice: cubeStonePrice[c] }
        },
        gearStone,
      )
      if (stone < best.cost) best = { picks, cost: stone }
    } else cubes.forEach((_, c) => walk(i + 1, c === 0 ? picks : { ...picks, [levels[i]]: c }))
  }
  walk(0, {})
  return best
}

// 강화 수치별 추가 옵션
const MAIN = [1, 2, 3, 5, 7, 9, 11, 14, 17, 20]
const PIERCE = [0, 0, 0, 0, 0, 5, 5, 15, 15, 30]
const HIT = [0, 0, 0, 0, 0, 5, 5, 5, 5, 10]
const SHIELD = [0, 0, 0, 0, 0, 5, 5, 10, 10, 15]
const HP = [0, 0, 0, 0, 0, 5, 5, 10, 10, 20]
export function enhanceBonus(kind, level) {
  if (level <= 0) return {}
  const i = level - 1
  return kind === '무기' ? { atk: MAIN[i], pierce: PIERCE[i], hit: HIT[i] } : { def: MAIN[i], shield: SHIELD[i], hp: HP[i] }
}

/* ---------- 삼위일체 재련 ---------- */
export const REFINES = [
  { from: '삼위일체', result: '삼위일체(改)', rate: 30, stone: 3e5, material: '삼위일체의 구슬', place: '스라인 마을 · 신비한 대장장이' },
  { from: '삼위일체(改)', result: '삼위일체(眞)', rate: 20, stone: 3e5, material: '삼위일체의 심장', place: '정령의 마을 · 천공의 대장장이' },
]
export const REFINE_STAGES = [REFINES[0].from, ...REFINES.map((r) => r.result)]

export function refineOnce(stage, rnd = Math.random) {
  const { rate, stone, material } = REFINES[stage]
  const ok = rnd() * 100 < rate
  return { stage: ok ? stage + 1 : stage, success: ok, stone, material }
}
export function refineUntil(from, to, rnd = Math.random) {
  const materials = {}
  let stage = from
  let tries = 0
  let failures = 0
  let stone = 0
  while (stage < to) {
    const r = refineOnce(stage, rnd)
    tries++
    stone += r.stone
    materials[r.material] = (materials[r.material] ?? 0) + 1
    if (!r.success) failures++
    stage = r.stage
  }
  return { tries, failures, stone, materials }
}
