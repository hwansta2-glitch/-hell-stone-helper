// 한글 초성 검색
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

export const toChosung = (s) =>
  [...s]
    .map((ch) => {
      const c = ch.charCodeAt(0)
      return c < HANGUL_START || c > HANGUL_END ? ch : CHO[Math.floor((c - HANGUL_START) / 588)]
    })
    .join('')

const SPLIT = { ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ' }
const SOFTEN = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' }
const noSpace = (s) => s.replace(/\s/g, '')
const isAllCho = (s) => [...s].every((c) => CHO.includes(c))
const splitCho = (s) => [...s].map((c) => SPLIT[c] ?? c).join('')
const looseCho = (s) => [...toChosung(s)].map((c) => SOFTEN[c] ?? c).join('')

// 이름 목록에서 찾고, 앞에서부터 맞는 것 → 짧은 이름 순으로 정렬
export function searchByName(list, query) {
  const q = splitCho(noSpace(query))
  if (!q) return []
  const qLoose = looseCho(q)
  const typed = !isAllCho(q)
  const front = []
  const rest = []
  for (const it of list) {
    const n = noSpace(it.name)
    if (n.includes(q) || looseCho(n).includes(qLoose)) {
      ;(typed && n.startsWith(q) ? front : rest).push(it)
    }
  }
  const byLen = (a, b) => a.name.length - b.name.length
  return [...front.sort(byLen), ...rest.sort(byLen)]
}

export function matches(text, query) {
  const t = noSpace(text)
  const q = splitCho(noSpace(query))
  return isAllCho(q) ? toChosung(t).includes(q) : t.includes(q)
}
