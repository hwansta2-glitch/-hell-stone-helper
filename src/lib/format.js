// 숫자·확률 표시 도우미

export const floorTo = (v, digits) => {
  const m = 10 ** digits
  return Math.floor(v * m + 1e-9) / m
}

export const pct = (v, digits = 2) => `${floorTo(v * 100, digits).toFixed(digits)}%`

const MIN_DIGITS = 4
export function smartPct(v) {
  const p = v * 100
  if (p <= 0) return pct(0, MIN_DIGITS)
  const mag = Math.floor(Math.log10(p) + 1e-9)
  return pct(v, p >= 1 ? Math.max(2, 3 - mag) : Math.max(MIN_DIGITS, 2 - mag))
}
export const cappedPct = (v) => smartPct(Math.min(v, 0.9999))

const sig3 = new Intl.NumberFormat('ko-KR', { maximumSignificantDigits: 3 })
export function chancePct(v) {
  const p = v * 100
  if (p > 0 && p < 1e-4) return '0.0001% 미만'
  const s = sig3.format(p)
  return s === '100' && v < 1 - 1e-12 ? '99.9% 넘음' : `${s}%`
}

export function oneIn(v) {
  if (v <= 0) return '나올 수 없어요'
  if (v >= 1 - 1e-12) return '항상 나와요'
  const n = 1 / v
  const r = Math.round(n)
  if (Math.abs(n - r) < 1e-9 * n) return `${r.toLocaleString('ko-KR')}번에 1번꼴`
  return n < 100
    ? `약 ${(Math.round(n * 10) / 10).toLocaleString('ko-KR')}번에 1번꼴`
    : `약 ${r.toLocaleString('ko-KR')}번에 1번꼴`
}

export const num = (v) => Math.round(v).toLocaleString('ko-KR')
export const signed = (v) => (v > 0 ? `+${v}` : v < 0 ? `${v}` : '±0')
export const signedPlain = (v) => (v > 0 ? `+${v}` : `${v}`)
export const signClass = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero')

// 1억 2345만 6789
export function koreanUnits(v, commas = false) {
  const n = Math.floor(v)
  const f = (x) => (commas ? x.toLocaleString('ko-KR') : String(x))
  const parts = [
    [Math.floor(n / 1e8), '억'],
    [Math.floor(n / 1e4) % 1e4, '만'],
    [n % 1e4, ''],
  ].filter(([x]) => x > 0)
  return parts.length ? parts.map(([x, u]) => `${f(x)}${u}`).join(' ') : '0'
}

export function shortUnits(v) {
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억`
  if (v >= 1e4) return `${Math.round(v / 1e4)}만`
  return v > 0 ? v.toLocaleString('ko-KR') : ''
}

export function hoursText(h) {
  const m = Math.round(h * 60)
  const parts = [
    [Math.floor(m / 1440), '일'],
    [Math.floor(m / 60) % 24, '시간'],
    [m % 60, '분'],
  ].filter(([x]) => x > 0)
  return parts.length ? parts.map(([x, u]) => `${x}${u}`).join(' ') : '0분'
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key)
      return v === null ? fallback : JSON.parse(v)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  },
}
