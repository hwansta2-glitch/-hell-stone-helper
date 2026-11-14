// 환생 포인트(환포) 계산과 최적 플랜 탐색
import { expTable } from './data'
import { totalExpAt } from './exp'

const PER_LEVEL = 3
const PER_STAGE = 10
const v0 = (x) => x ?? 0
const transValue = (sum, quest, levelSum, stage) => Math.floor((sum + 300 * quest + 300 * (levelSum - 85 * stage)) / 1200)
const share = (part, sum, value) => Math.floor((part / sum * value + 0.5) * 100)

// 그리드에 넣은 값으로 단계별 결과를 계산 (사이트 수동 입력과 같은 방식)
export function runGrid(stages) {
  let start = 20
  let frac = [0, 0, 0, 0]
  let levelSum = 0
  return stages.map((s, i) => {
    const level = v0(s.level)
    levelSum += level
    const available = start + (level - 1) * PER_LEVEL
    const alloc = s.alloc.map(v0)
    const left = available - alloc.reduce((a, b) => a + b, 0)
    const parts = alloc.map((v, k) => v * 100 + frac[k])
    const sum = parts.reduce((a, b) => a + b, 0)
    const row = { start, available, left, done: false, value: null, results: null, total: null, exp: null }
    if (left === 0 && sum > 0) {
      const value = transValue(sum, v0(s.quest), levelSum, i + 1)
      const results = parts.map((p) => share(p, sum, value))
      const total = results.reduce((a, r) => a + Math.floor(r / 100), 0) + PER_STAGE * (i + 1)
      Object.assign(row, { done: true, value, results, total, exp: totalExpAt(expTable, level) })
      start = total
      frac = results.map((r) => r % 100)
    } else {
      start = 0
      frac = [0, 0, 0, 0]
    }
    return row
  })
}

const START = { start: 20, fractions: [0, 0, 0, 0], floors: [0, 0, 0, 0], levelSum: 0 }
const TRICK_MAX = 12
const LEVEL_SLACK = 1
const YIELD_EVERY = 5000
const bits = (n) => {
  let c = 0
  for (let x = n; x; x >>= 1) c += x & 1
  return c
}

class Planner {
  checked = 0
  nextYield = YIELD_EVERY
  constructor(input) {
    this.input = input
    this.quests = input.stages.map((s) => v0(s.quest))
    this.fillers = input.stages.map((_, i) => this.fillerOf(i))
    const last = input.stages[4]
    const lf = this.fillers[4]
    this.trickStats = [0, 1, 2, 3].filter((k) => k !== lf && last.alloc[k] === null)
    const n = 1 << this.trickStats.length
    this.masks = Array.from({ length: n }, (_, i) => i).sort((a, b) => bits(a) - bits(b) || a - b)
  }
  fillerOf(i) {
    const a = this.input.stages[i].alloc
    return a[this.input.main] === null ? this.input.main : ([0, 1, 2, 3].find((k) => a[k] === null) ?? null)
  }
  free(i) {
    return this.input.stages[i].level === null
  }
  levelRange(i) {
    const l = this.input.stages[i].level
    return l === null ? [1, 140] : [l, l]
  }
  stage(carry, i, level) {
    const { input } = this
    const fixed = input.stages[i].alloc
    const levelSum = carry.levelSum + level
    const avail = carry.start + (level - 1) * PER_LEVEL
    const filler = this.fillers[i]
    const sum = avail * 100 + carry.fractions[0] + carry.fractions[1] + carry.fractions[2] + carry.fractions[3]
    if (sum <= 0) return null
    const alloc = [0, 0, 0, 0]
    let used = 0
    for (let k = 0; k < 4; k++)
      if (k !== filler) {
        alloc[k] = fixed[k] ?? Math.max(input.mins[k], carry.floors[k])
        used += alloc[k]
      }
    if (filler === null) {
      if (used !== avail) return null
    } else {
      const rest = avail - used
      if (rest < Math.max(input.mins[filler], carry.floors[filler])) return null
      alloc[filler] = rest
    }
    const value = transValue(sum, this.quests[i], levelSum, i + 1)
    const floors = [0, 0, 0, 0]
    const fractions = [0, 0, 0, 0]
    let start = PER_STAGE * (i + 1)
    for (let k = 0; k < 4; k++) {
      const r = share(alloc[k] * 100 + carry.fractions[k], sum, value)
      floors[k] = Math.floor(r / 100)
      fractions[k] = r % 100
      start += floors[k]
    }
    return { alloc, carry: { start, fractions, floors, levelSum } }
  }
  final(carry, level) {
    const { input } = this
    const fixed = input.stages[4].alloc
    const levelSum = carry.levelSum + level
    const avail = carry.start + (level - 1) * PER_LEVEL
    const sum = avail * 100 + carry.fractions[0] + carry.fractions[1] + carry.fractions[2] + carry.fractions[3]
    this.checked++
    if (sum <= 0) return null
    const value = transValue(sum, this.quests[4], levelSum, 5)
    const filler = this.fillers[4]
    const alloc = [0, 0, 0, 0]
    const got = [0, 0, 0, 0]
    let used = 0
    for (let k = 0; k < 4; k++)
      if (k !== filler) {
        alloc[k] = fixed[k] ?? Math.max(input.mins[k], carry.floors[k])
        used += alloc[k]
        got[k] = Math.floor(share(alloc[k] * 100 + carry.fractions[k], sum, value) / 100)
      }
    // 스탯을 몇 점 더 찍으면 결과가 1 오르는지 (리셋으로 깎는 트릭)
    const extra = this.trickStats.map((k) => {
      for (let n = 1; n <= TRICK_MAX; n++) if (Math.floor(share((alloc[k] + n) * 100 + carry.fractions[k], sum, value) / 100) > got[k]) return n
      return Infinity
    })
    const resetOf = (k, v) => +(k !== input.main && input.mins[k] === 0 && v > 0)
    const totals = []
    const resets = []
    for (const mask of this.masks) {
      let spent = 0
      let total = 50
      let reset = 0
      for (let k = 0; k < 4; k++) {
        if (k === filler) continue
        const ti = this.trickStats.indexOf(k)
        const on = ti >= 0 && !!(mask & (1 << ti))
        if (on) spent += extra[ti]
        const v = got[k] + +on
        total += v
        reset += resetOf(k, v)
      }
      if (!Number.isFinite(spent)) {
        totals.push(-1)
        resets.push(0)
        continue
      }
      if (filler === null) {
        totals.push(used === avail ? total : -1)
        resets.push(reset)
        continue
      }
      const rest = avail - used - spent
      if (rest < Math.max(input.mins[filler], carry.floors[filler])) {
        totals.push(-1)
        resets.push(0)
        continue
      }
      const fv = Math.floor(share(rest * 100 + carry.fractions[filler], sum, value) / 100)
      totals.push(total + fv)
      resets.push(reset + resetOf(filler, fv))
    }
    return {
      totals,
      resets,
      build: (idx) => {
        const mask = this.masks[idx]
        const out = [...alloc]
        let spent = 0
        this.trickStats.forEach((k, ti) => {
          if (mask & (1 << ti)) {
            out[k] += extra[ti]
            spent += extra[ti]
          }
        })
        if (filler !== null) out[filler] = avail - used - spent
        return out
      },
    }
  }
  pick(fin, target, okReset) {
    if (!fin) return -1
    let best = -1
    for (let i = 0; i < fin.totals.length; i++) {
      if (fin.totals[i] < target || !okReset(fin.resets[i])) continue
      if (best < 0 || fin.resets[i] < fin.resets[best]) best = i
    }
    return best
  }
  reach(carry, from, stageIdx = -1, stageLevel = 0, okReset) {
    let c = carry
    const lv = (i) => (i === stageIdx ? stageLevel : this.levelRange(i)[1])
    for (let i = from; i < 4; i++) {
      const s = this.stage(c, i, lv(i))
      if (!s) return -1
      c = s.carry
    }
    const fin = this.final(c, lv(4))
    if (!fin) return -1
    let best = -1
    fin.totals.forEach((t, i) => {
      if (!okReset || okReset(fin.resets[i])) best = Math.max(best, t)
    })
    return best
  }
  ceiling(carry, from) {
    return this.reach(carry, from)
  }
  lowestLevel(carry, from, idx, target, okReset) {
    let [lo, hi] = this.levelRange(idx)
    if (this.reach(carry, from, idx, hi, okReset) < target) return Infinity
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.reach(carry, from, idx, mid, okReset) >= target) hi = mid
      else lo = mid + 1
    }
    return lo
  }
  *best(target, okReset) {
    let best = null
    const levels = []
    const allocs = []
    const [lastLo, lastHi] = this.levelRange(4)
    const better = (exp, resets) => {
      if (!best) return true
      if (exp !== best.exp) return exp < best.exp
      if (resets !== best.resets) return resets < best.resets
      for (let i = 0; i < 5; i++) if (levels[i] !== best.levels[i]) return levels[i] < best.levels[i]
      return false
    }
    const works = (carry, level) => this.pick(this.final(carry, level), target, okReset) >= 0
    const tryFinal = (carry, level, expSoFar) => {
      const exp = expSoFar + totalExpAt(expTable, level)
      if (best && exp > best.exp) return
      const fin = this.final(carry, level)
      const idx = this.pick(fin, target, okReset)
      if (!fin || idx < 0) return
      levels[4] = level
      if (better(exp, fin.resets[idx])) {
        allocs[4] = fin.build(idx)
        best = { levels: [...levels], allocs: allocs.map((a) => [...a]), total: fin.totals[idx], exp, resets: fin.resets[idx] }
      }
    }
    const lowestFinal = (carry, prev) => {
      if (prev === null) {
        if (!works(carry, lastHi)) return null
        let lo = lastLo
        let hi = lastHi
        while (lo < hi) {
          const mid = (lo + hi) >> 1
          if (works(carry, mid)) hi = mid
          else lo = mid + 1
        }
        return lo
      }
      let l = prev
      while (l <= lastHi && !works(carry, l)) l++
      if (l > lastHi) return null
      while (l > lastLo && works(carry, l - 1)) l--
      return l
    }
    // 처음에 모든 단계를 같은 레벨로 두고 상한을 잡는다
    for (let L = 1; L <= 140; L++) {
      let c = START
      let exp = 0
      let ok = true
      for (let i = 0; i < 4 && ok; i++) {
        const [lo, hi] = this.levelRange(i)
        const lv = Math.min(hi, Math.max(lo, L))
        const s = this.stage(c, i, lv)
        if (s) {
          levels[i] = lv
          allocs[i] = s.alloc
          exp += totalExpAt(expTable, lv)
          c = s.carry
        } else ok = false
      }
      if (!ok) continue
      const f = lowestFinal(c, null)
      if (f !== null) tryFinal(c, f, exp)
    }
    const self = this
    function* dive(carry, i, expSoFar) {
      let start = self.lowestLevel(carry, i, i, target, okReset)
      if (start === Infinity) return
      const end = self.levelRange(i)[1]
      if (i > 0 && self.free(i) && self.free(i - 1)) start = Math.max(start, levels[i - 1] - LEVEL_SLACK)
      let prevFinal = null
      for (let lv = start; lv <= end; lv++) {
        const exp = expSoFar + totalExpAt(expTable, lv)
        if (best && exp > best.exp) return
        const s = self.stage(carry, i, lv)
        if (!s) continue
        levels[i] = lv
        allocs[i] = s.alloc
        if (i < 3) yield* dive(s.carry, i + 1, exp)
        else {
          prevFinal = lowestFinal(s.carry, prevFinal)
          if (prevFinal !== null) {
            tryFinal(s.carry, prevFinal, exp)
            if (self.checked >= self.nextYield) {
              self.nextYield = self.checked + YIELD_EVERY
              yield self.checked
            }
          }
        }
      }
    }
    yield* dive(START, 0, 0)
    return best
  }
}

// 제너레이터: 진행 중에는 확인한 조합 수를 내보내고, 끝나면 { exp, balanced } 를 돌려준다
export function* searchPlans(input) {
  const p = new Planner(input)
  const ceiling = p.ceiling(START, 0)
  const target = input.target > 0 ? input.target : ceiling
  if (ceiling < 0 || target > ceiling) return { exp: null, balanced: null, checked: p.checked }
  const exp = yield* p.best(target, () => true)
  let balanced = null
  if (exp && exp.resets > 0) for (let r = 0; r < exp.resets && !balanced; r++) balanced = yield* p.best(target, (x) => x <= r)
  return { exp, balanced, checked: p.checked }
}
export function searchPlansSync(input) {
  const it = searchPlans(input)
  for (;;) {
    const r = it.next()
    if (r.done) return r.value
  }
}
