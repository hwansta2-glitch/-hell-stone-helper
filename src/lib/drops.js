// 득템 확률·아이템 옵션 확률
export const triesFor = (p, want) => (p <= 0 ? Infinity : Math.max(1, Math.ceil(Math.log(1 - want) / Math.log(1 - p))))
export const atLeastOnce = (p, n) => 1 - (1 - p) ** n

function pick(list, rnd) {
  const sum = list.reduce((s, x) => s + x.rate, 0)
  let r = rnd() * sum
  return list.find((x) => (r -= x.rate) < 0) ?? list[list.length - 1]
}

// "지옥의 반지 50% / 지옥의 투구 50%" 형식의 상자 내용
export function boxContents(desc) {
  return desc.split(' / ').flatMap((part) => {
    const m = part.match(/^(.+?) ([\d.]+)%$/)
    return m ? [{ name: m[1], kind: m[1].endsWith('큐브') ? '큐브' : '장비', desc: '', rate: Number(m[2]) }] : []
  })
}
export function flattenDrops(items) {
  return items.flatMap((it) => {
    const inner = it.kind === '상자' ? boxContents(it.desc) : []
    return inner.length === 0 ? [it] : inner.map((x) => ({ ...x, rate: (it.rate * x.rate) / 100, box: it.name }))
  })
}
export function openOne(items, rnd = Math.random) {
  const it = pick(items, rnd)
  const inner = it.kind === '상자' ? boxContents(it.desc) : []
  return inner.length > 0 ? { ...pick(inner, rnd), box: it.name } : it
}
export function untilHit(p, rnd = Math.random) {
  if (p <= 0) return Infinity
  let n = 1
  while (rnd() >= p) n++
  return n
}
export function limitOf(rule) {
  const m = [...rule.matchAll(/(\d+)회\/(일|주)/g)].pop()
  return m ? { count: Number(m[1]), unit: m[2] } : null
}
const fmt = (n) => n.toLocaleString('ko-KR')
export function costText(raid, n) {
  const c = raid.cost
  if (c?.type === 'entry') return `입장권 약 ${fmt(n * c.stone)} 스톤 (${fmt(n)}회 입장)`
  if (c?.type === 'rotation') return `보스 ${c.bosses}종 로테이션(${c.minutes}분 회복) 기준 약 ${fmt(Math.ceil((n * c.minutes) / c.bosses / 60))}시간`
  if (c?.type === 'trade') {
    const need = n * c.each
    return c.perDay ? `${c.item} ${fmt(need)}개 · 일 ${c.perDay}개 수급 기준 약 ${fmt(Math.ceil(need / c.perDay))}일` : `${c.item} 약 ${fmt(need)}개 (상자 ${fmt(n)}개)`
  }
  const lim = limitOf(raid.rule)
  if (!lim) return ''
  const t = Math.ceil(n / lim.count)
  return `한도 기준 약 ${fmt(t)}${lim.unit} (${lim.unit} ${lim.count}개 × ${fmt(t)})`
}

/* ---------- 아이템 옵션 확률 ---------- */
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1))
const compositions = (n, k) => (k === 1 ? [[n]] : range(0, n).flatMap((x) => compositions(n - x, k - 1).map((r) => [x, ...r])))

export const rangedStats = (item) =>
  item.stats.flatMap(({ stat, min, max }) => (min === undefined || max === undefined || min === max ? [] : [{ stat, min: Math.min(min, max), max: Math.max(min, max) }]))
export const hasRoll = (item) => !!item.pool || rangedStats(item).length > 0

function poolModel({ stats, min, max }) {
  const totals = range(min, max)
  const outcomes = totals.flatMap((t) =>
    compositions(t, stats.length).map((split) => ({
      values: [...split, t],
      chance: fact(t) / split.reduce((m, x) => m * fact(x), 1) / stats.length ** t / totals.length,
    })),
  )
  return { options: [...stats.map((s) => ({ label: s, stat: s, values: range(0, max) })), { label: '합계', values: totals }], outcomes, uniform: false }
}

export function rollModel(item) {
  if (item.pool) return poolModel(item.pool)
  const ranged = rangedStats(item)
  if (ranged.length === 0) return null
  const options = ranged.map(({ stat, min, max }) => ({ label: stat, stat, values: range(min, max) }))
  const combos = options.reduce((acc, o) => acc.flatMap((c) => o.values.map((v) => [...c, v])), [[]])
  return { options, outcomes: combos.map((values) => ({ values, chance: 1 / combos.length })), uniform: true }
}
export function chanceOf(model, picks, mode) {
  return model.outcomes.reduce(
    (s, { values, chance }) =>
      values.every((v, i) => {
        const want = picks[i] ?? null
        return want === null || (mode === 'exact' ? v === want : v >= want)
      })
        ? s + chance
        : s,
    0,
  )
}
export const marginal = (model, i) =>
  model.options[i].values.map((v) => ({ value: v, chance: model.outcomes.reduce((s, o) => (o.values[i] === v ? s + o.chance : s), 0) }))
