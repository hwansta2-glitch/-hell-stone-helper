import { useMemo, useState } from 'react'
import { attrText, itemImageByName, quiz, raids } from '../lib/data'
import { binomialHits, capture, shareAtLeast, simulateGrowth, tryUntil, attrMultiplier, guessAttack, guessDefense } from '../lib/battle'
import { calcHwan, statAtLevel } from '../lib/hwan'
import { atLeastOnce, costText, flattenDrops, openOne, triesFor, untilHit } from '../lib/drops'
import { cappedPct, copyText } from '../lib/format'
import { matches } from '../lib/search'
import { ItemImg, NumInput, Note, Panel, PetImg, PetPicker, RecentPets, Seg, Stat, useRecent } from '../components/ui'

/* ---------------- 펫 시뮬레이터 ---------------- */
const SIM_STATS = [
  { key: 'hp', label: '체력' },
  { key: 'atk', label: '공격' },
  { key: 'def', label: '방어' },
  { key: 'agi', label: '순발' },
]
const HWAN = 8
const AUTO_LIMIT = 2e5
const SHOW_LAST = 30
const fmt = (v) => Math.round(v).toLocaleString('ko-KR')

function GrowthSim({ pet }) {
  const [level, setLevel] = useState(140)
  const [count, setCount] = useState(1e4)
  const [mine, setMine] = useState(['', '', '', ''])
  const [res, setRes] = useState(null)
  return (
    <>
      <Panel title="시뮬레이션 설정" icon="📊">
        <div className="field-row">
          <label>
            <span>시뮬 횟수</span>
            <NumInput min={1} max={1e5} value={count} onValue={setCount} />
          </label>
          <label>
            <span>목표 레벨</span>
            <NumInput min={2} max={140} value={level} onValue={setLevel} />
          </label>
          <button type="button" className="btn btn-fire" disabled={!pet} onClick={() => pet && setRes(simulateGrowth(pet, level, count))}>
            시작
          </button>
          <button type="button" className="btn btn-ghost danger" onClick={() => setRes(null)}>
            초기화
          </button>
        </div>
        <details className="fold">
          <summary>🎯 내 펫 스탯 (선택 — 결과와 비교)</summary>
          <div className="field-row four">
            {SIM_STATS.map(({ key, label }, i) => (
              <label key={key}>
                <span>{label}</span>
                <input className="num" type="number" value={mine[i]} onChange={(e) => setMine(mine.map((x, k) => (k === i ? e.target.value : x)))} />
              </label>
            ))}
          </div>
        </details>
      </Panel>
      {res && pet && (
        <Panel title={`${pet.name} Lv.${level} · ${count.toLocaleString('ko-KR')}회`} icon="📈">
          <div className="table-wrap">
            <table className="table center">
              <thead>
                <tr>
                  <th>능력치</th>
                  <th>최소</th>
                  <th>평균</th>
                  <th>상위 1%</th>
                  <th>최대</th>
                  <th>내 펫</th>
                </tr>
              </thead>
              <tbody>
                {res.map((r, i) => (
                  <tr key={r.label}>
                    <th>{r.label}</th>
                    <td>{fmt(r.min)}</td>
                    <td className="accent">{fmt(r.mean)}</td>
                    <td>{fmt(r.top)}</td>
                    <td>{fmt(r.max)}</td>
                    <td>{mine[i] ? `상위 ${(shareAtLeast(r.values, Number(mine[i])) * 100).toFixed(1)}%` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  )
}
function CaptureSim({ pet }) {
  const [n, setN] = useState(5)
  const [log, setLog] = useState([])
  const [total, setTotal] = useState(0)
  const [hits, setHits] = useState(0)
  const add = (list) => {
    setLog([...list.reverse(), ...log].slice(0, SHOW_LAST))
    setTotal(total + list.length)
    setHits(hits + list.filter((x) => x.grade === HWAN).length)
  }
  return (
    <>
      <Panel title="뽑기" icon="🎮">
        <div className="field-row">
          <NumInput min={1} max={1e4} aria-label="뽑는 횟수" value={n} onValue={setN} />
          <button type="button" className="btn btn-fire" disabled={!pet} onClick={() => pet && add(Array.from({ length: n }, () => capture(pet)))}>
            N회 뽑기
          </button>
          <button
            type="button"
            className="btn btn-gold"
            disabled={!pet}
            onClick={() => {
              if (!pet) return
              const out = []
              while (out.length < AUTO_LIMIT) {
                const c = capture(pet)
                out.push(c)
                if (c.grade === HWAN) break
              }
              add(out)
            }}
          >
            환각까지 자동
          </button>
          <button
            type="button"
            className="btn btn-ghost danger"
            onClick={() => {
              setLog([])
              setTotal(0)
              setHits(0)
            }}
          >
            초기화
          </button>
        </div>
        <Note>자동 뽑기는 환각이 나올 때까지 계속 뽑습니다.</Note>
      </Panel>
      {total > 0 && (
        <Panel title="결과" icon="📋">
          <div className="tiles">
            <Stat label="뽑은 횟수" value={total.toLocaleString('ko-KR')} />
            <Stat label="환각" value={hits.toLocaleString('ko-KR')} tone="fire" />
            <Stat label="환각 비율" value={`${((hits / total) * 100).toFixed(2)}%`} />
          </div>
          <div className="table-wrap">
            <table className="table center">
              <thead>
                <tr>
                  <th>등급</th>
                  {SIM_STATS.map((s) => (
                    <th key={s.key}>{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.map((r, i) => (
                  <tr key={i} className={r.grade === HWAN ? 'hot' : undefined}>
                    <th>{r.grade === HWAN ? '8 (환각)' : r.grade}</th>
                    {r.stats.map((v, k) => (
                      <td key={k}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Note>최근 {SHOW_LAST}마리만 보여 줍니다.</Note>
        </Panel>
      )}
    </>
  )
}
function HwanSim({ pet }) {
  const [vals, setVals] = useState(['', '', '', ''])
  const [n, setN] = useState(1)
  const [tally, setTally] = useState({ tries: 0, hits: 0 })
  const [msg, setMsg] = useState('')
  const rate = () => {
    if (!pet) return null
    const r = calcHwan(
      pet,
      SIM_STATS.map(({ key }, i) => (vals[i] === '' ? 0 : Number(vals[i]) - Math.floor(pet[key][0]))),
    )
    return r.total > 0 ? r.hwanRate : null
  }
  const run = (auto) => {
    const p = rate()
    if (p === null) return setMsg('이 스탯이 나오는 조합이 없습니다. 입력한 스탯을 확인하세요.')
    if (p === 0) return setMsg('이 스탯은 환각이 나오지 않습니다.')
    const t = auto ? tryUntil(p) : n
    const h = auto ? 1 : binomialHits(p, n)
    setMsg(`이 스탯의 환각 확률은 ${cappedPct(p)}입니다.`)
    setTally({ tries: tally.tries + t, hits: tally.hits + h })
  }
  return (
    <>
      <Panel title="1레벨 스탯 입력" icon="📊">
        <div className="field-row four">
          {SIM_STATS.map(({ key, label }, i) => (
            <label key={key}>
              <span>{label}</span>
              <input
                className="num"
                type="number"
                placeholder={pet ? String(Math.floor(pet[key][0])) : ''}
                value={vals[i]}
                onChange={(e) => setVals(vals.map((x, k) => (k === i ? e.target.value : x)))}
              />
            </label>
          ))}
        </div>
        <div className="field-row">
          <NumInput min={1} max={1e5} aria-label="시도 횟수" value={n} onValue={setN} />
          <button type="button" className="btn btn-fire" disabled={!pet} onClick={() => run(false)}>
            N회 시도
          </button>
          <button type="button" className="btn btn-gold" disabled={!pet} onClick={() => run(true)}>
            환각까지 자동
          </button>
          <button
            type="button"
            className="btn btn-ghost danger"
            onClick={() => {
              setTally({ tries: 0, hits: 0 })
              setMsg('')
            }}
          >
            초기화
          </button>
        </div>
        {msg && <Note>{msg}</Note>}
      </Panel>
      {tally.tries > 0 && (
        <div className="tiles">
          <Stat label="시도 횟수" value={tally.tries.toLocaleString('ko-KR')} />
          <Stat label="환각 성공" value={tally.hits.toLocaleString('ko-KR')} tone="fire" />
        </div>
      )}
    </>
  )
}
export function SimPage() {
  const [mode, setMode] = useState('growth')
  const [pet, setPet] = useState(null)
  return (
    <div className="stack">
      <p className="banner">⚠️ 실제 확률과 다를 수 있으니 재미로만 써 주세요</p>
      <Seg
        options={['growth', 'capture', 'hwan']}
        value={mode}
        onChange={setMode}
        render={(m) => ({ growth: '성장 시뮬', capture: '포획 시뮬', hwan: '환각 시뮬' })[m]}
        label="시뮬 종류"
      />
      <Panel title="펫 선택" icon="🔍">
        <PetPicker label="펫 이름 검색" placeholder="펫 이름을 검색하세요 (초성 가능)" selected={pet?.name} onPick={setPet} />
      </Panel>
      {mode === 'growth' && <GrowthSim key={pet?.name} pet={pet} />}
      {mode === 'capture' && <CaptureSim key={pet?.name} pet={pet} />}
      {mode === 'hwan' && <HwanSim key={pet?.name} pet={pet} />}
    </div>
  )
}

/* ---------------- 득템 시뮬레이터 ---------------- */
const GROUPS = [...new Set(raids.map((r) => r.group))]
const OPEN_COUNTS = [1, 10, 100, 1000]
const WANTS = [0.5, 0.9, 0.99]
const OPEN_MAX = 1e5
const LOG_MAX = 50
const CHART = { width: 1000, height: 340, left: 60, right: 30, top: 16, bottom: 36 }
const POINTS = 80
const notBasic = (it) => !['기본', '큐브'].includes(it.kind)
const targetsOf = (raid) => flattenDrops(raid.items).filter((it) => it.kind !== '기본')
const ruleTail = (rule) => rule.split(' · ').slice(1).join(' · ')
const splitName = (name) => {
  const w = name.split(' ')
  return w.length < 3 ? [name, ''] : [w.slice(0, -2).join(' '), w.slice(-2).join(' ')]
}
const nounOf = ({ group }) => (group === '엘리트 보스' ? { noun: '처치', count: '회', by: '횟수' } : { noun: group === '교환 상자' ? '상자' : '전리품', count: '개', by: '개수' })
const rateText = (r) => `${r.toFixed(r < 10 ? 2 : 1)}%`
const raidImage = (raid) => raid.items.map((it) => itemImageByName(it.name)).find((x) => x !== '') ?? ''

function DropChart({ rate, unit }) {
  const n = triesFor(rate, 0.99)
  const x = (t) => CHART.left + (t / n) * (CHART.width - CHART.left - CHART.right)
  const y = (p) => CHART.height - CHART.bottom - p * (CHART.height - CHART.top - CHART.bottom)
  const line = Array.from({ length: POINTS + 1 }, (_, i) => (i / POINTS) * n)
    .map((t) => `${x(t)},${y(atLeastOnce(rate, t))}`)
    .join(' ')
  const area = `${x(0)},${y(0)} ${line} ${x(n)},${y(0)}`
  const marks = [0.5, 0.9].map((p) => ({ p, t: triesFor(rate, p) }))
  return (
    <svg className="drop-chart" viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label="누적 득템 확률 그래프">
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <g key={p}>
          <line x1={CHART.left} x2={CHART.width - CHART.right} y1={y(p)} y2={y(p)} stroke="var(--line)" />
          <text x={CHART.left - 8} y={y(p) + 5} textAnchor="end" fontSize="15" fill="var(--muted)">
            {p * 100}%
          </text>
        </g>
      ))}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <text key={f} x={x(n * f)} y={CHART.height - 10} textAnchor="middle" fontSize="15" fill="var(--muted)">
          {Math.round(n * f)}
        </text>
      ))}
      <polygon points={area} fill="var(--fire-soft)" />
      <polyline points={line} fill="none" stroke="var(--fire)" strokeWidth="3" />
      {marks.map(({ p, t }) => (
        <g key={p}>
          <line x1={x(t)} x2={x(t)} y1={y(p)} y2={y(0)} stroke="var(--muted)" strokeDasharray="4 4" />
          <text x={x(t) + 8} y={y(p) + 20} fontSize="15" fontWeight="700" fill="var(--text)">
            {p * 100}% · {t}
            {unit}
          </text>
        </g>
      ))}
    </svg>
  )
}
export function DropsPage() {
  const [raidId, setRaidId] = useState(raids[0].id)
  const [got, setGot] = useState({})
  const [log, setLog] = useState([])
  const [custom, setCustom] = useState('')
  const [last, setLast] = useState(1)
  const [target, setTarget] = useState(targetsOf(raids[0])[0].name)
  const [luck, setLuck] = useState(null)
  const raid = raids.find((r) => r.id === raidId)
  const targets = targetsOf(raid)
  const tgt = targets.find((t) => t.name === target) ?? targets[0]
  const p = tgt.rate / 100
  const words = nounOf(raid)
  const thing = words.noun === '상자' ? '상자' : '전리품'
  const opened = Object.values(got).reduce((s, x) => s + x, 0)
  const rares = flattenDrops(raid.items).filter(notBasic)
  const rareGot = rares.reduce((s, { name }) => s + (got[name] ?? 0), 0)
  const rareExp = rares.reduce((s, it) => s + (it.rate / 100) * opened, 0)
  const half = triesFor(p, 0.5)
  const ninety = triesFor(p, 0.9)
  const halfCost = costText(raid, half)
  const reset = () => {
    setGot({})
    setLog([])
  }
  const choose = (id) => {
    const r = raids.find((x) => x.id === id)
    setRaidId(id)
    reset()
    setLuck(null)
    setTarget(targetsOf(r)[0].name)
  }
  const open = (count) => {
    const next = { ...got }
    const found = []
    const k = Math.min(OPEN_MAX, Math.floor(count))
    for (let i = 1; i <= k; i++) {
      const it = openOne(raid.items)
      next[it.name] = (next[it.name] ?? 0) + 1
      if (notBasic(it)) found.push({ index: opened + i, name: it.name, box: it.box })
    }
    setGot(next)
    setLog([...found.reverse(), ...log].slice(0, LOG_MAX))
  }
  return (
    <div className="stack wide">
      <Panel title="보스 선택" icon="👹">
        {GROUPS.map((g) => {
          const list = raids.filter((r) => r.group === g)
          return (
            <div key={g} className="boss-group">
              <p>
                <b>{g}</b> <small className="muted">{ruleTail(list[0].rule)}</small>
              </p>
              <div className="boss-row">
                {list.map((r) => {
                  const [a, b] = splitName(r.name)
                  return (
                    <button key={r.id} type="button" className="boss" aria-pressed={raidId === r.id} onClick={() => choose(r.id)}>
                      <ItemImg src={raidImage(r)} fallback="🎁" />
                      <b>{a}</b>
                      {b && <small>{b}</small>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        <p className="boss-note">
          🎒 <b>{raid.desc}</b>
          <span>
            ⏳ <b>{raid.group}</b> · {ruleTail(raid.rule)}
          </span>
        </p>
      </Panel>
      <div className="two-col">
        <Panel title="드랍 테이블" icon="📜">
          <ul className="drops">
            {raid.items.map((it) => (
              <li key={it.name}>
                <ItemImg src={itemImageByName(it.name)} />
                <div className="drop-text">
                  <b>{it.name}</b>
                  <span className="kind" data-kind={it.kind}>
                    {it.kind}
                  </span>
                  <small className="muted">{it.desc}</small>
                </div>
                <div className="drop-rate">
                  <b>{rateText(it.rate)}</b>
                  <i>
                    <em style={{ width: `${Math.max(it.rate, 1)}%` }} />
                  </i>
                  {got[it.name] ? <small>{got[it.name]}개 나옴</small> : null}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={`${thing} 열어 보기`} icon="🎲">
          <div className="btn-row">
            {OPEN_COUNTS.map((c) => (
              <button
                key={c}
                type="button"
                className="chip"
                aria-pressed={last === c && custom === ''}
                onClick={() => {
                  setLast(c)
                  setCustom('')
                  open(c)
                }}
              >
                {c === 1 ? '1개 열기' : `${c.toLocaleString('ko-KR')}개`}
              </button>
            ))}
            <input className="num" type="number" min={1} max={OPEN_MAX} aria-label="직접 입력" placeholder="직접" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <button type="button" className="btn btn-fire btn-sm" disabled={!(Number(custom) > 0)} onClick={() => open(Number(custom))}>
              열기
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              초기화
            </button>
          </div>
          <div className="tiles">
            <Stat label={`열어 본 ${thing}`} value={opened.toLocaleString('ko-KR')} />
            <Stat label="희귀 득템" value={rareGot.toLocaleString('ko-KR')} tone="fire" />
            <Stat label="희귀 기대값" value={rareExp.toFixed(2)} sub="큐브 뺀 희귀템 평균" />
          </div>
          {opened === 0 ? (
            <p className="empty">
              {thing}
              {thing === '상자' ? '를' : '을'} 열어 보세요! 결과가 여기에 쌓입니다.
            </p>
          ) : (
            <>
              <ul className="open-results">
                {Object.entries(got).map(([n, c]) => (
                  <li key={n}>
                    {n} <b>×{c.toLocaleString('ko-KR')}</b>
                  </li>
                ))}
              </ul>
              {log.length > 0 && (
                <ol className="log">
                  {log.map((e) => (
                    <li key={e.index}>
                      <b>#{e.index.toLocaleString('ko-KR')}</b>번째에서 <b>{e.name}</b> 획득!{e.box && ` (${e.box})`}
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </Panel>
      </div>
      <Panel title="목표 득템 분석" icon="🎯">
        <div className="btn-row">
          <select
            aria-label="목표 득템"
            value={tgt.name}
            onChange={(e) => {
              setTarget(e.target.value)
              setLuck(null)
            }}
          >
            {targets.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} ({t.rate.toFixed(2)}%)
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-gold" onClick={() => setLuck(untilHit(p))}>
            득템까지 시뮬
          </button>
        </div>
        <div className="tiles four">
          <Stat label="평균 필요" value={`${Math.round(100 / tgt.rate).toLocaleString('ko-KR')}${words.count}`} />
          {WANTS.map((w) => (
            <Stat key={w} label={`${w * 100}% 확률`} value={`${triesFor(p, w).toLocaleString('ko-KR')}${words.count}`} />
          ))}
        </div>
        {luck !== null && (
          <p className="info">
            이번 시뮬에서는 {words.noun}{' '}
            <b>
              {luck.toLocaleString('ko-KR')}
              {words.count}
            </b>{' '}
            만에 {tgt.name}을(를) 얻었습니다.
          </p>
        )}
        <Note>
          {words.noun} {half}
          {words.count}면 절반의 유저가 <b>{tgt.name}</b>을(를) 얻습니다{halfCost && ` — ${halfCost} · 90% 확률 기준 ${costText(raid, ninety)}`}
        </Note>
        <h3 className="sub">
          {tgt.name} — {words.noun} {words.by}별 누적 득템 확률
        </h3>
        <DropChart rate={p} unit={words.count} />
      </Panel>
    </div>
  )
}

/* ---------------- 퀴즈 도우미 ---------------- */
export function QuizPage() {
  const [q, setQ] = useState('')
  const [copied, setCopied] = useState('')
  const [fail, setFail] = useState(false)
  const list = useMemo(() => (q.trim() ? quiz.filter((x) => matches(x.q, q) || matches(x.a, q)) : []), [q])
  const typed = q.trim() !== ''
  return (
    <div className="stack">
      <Panel title="퀴즈 검색" icon="❓">
        <label className="search-box big">
          <span aria-hidden="true">⌕</span>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input type="search" autoFocus aria-label="퀴즈 검색" placeholder="키워드 또는 초성" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <p className="muted small">
          <kbd>ㅂㅅ</kbd> 초성 검색 · 정답으로도 검색 · <b>📋 줄을 누르면 정답 복사</b> · {typed ? `${list.length}건` : `${quiz.length}문제`}
        </p>
        {fail && <Note warn>이 브라우저에서는 복사할 수 없습니다. 정답을 직접 선택해 복사하세요.</Note>}
        {typed ? (
          list.length === 0 ? (
            <p className="empty">검색 결과가 없습니다</p>
          ) : (
            <ul className="quiz">
              {list.map((x) => (
                <li key={x.q}>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyText(x.a)
                      setCopied(ok ? x.q : '')
                      setFail(!ok)
                    }}
                  >
                    <span>{x.q}</span>
                    <b>{copied === x.q ? `${x.a} 복사됨` : x.a}</b>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="empty">키워드를 넣으면 퀴즈 정답을 찾아 드립니다</p>
        )}
      </Panel>
    </div>
  )
}

/* ---------------- 스탯 역산기 ---------------- */
const nonNeg = (v) => Math.max(0, Number(v) || 0)
const rangeText = ([a, b]) => (a === b ? `${a}` : `${a} ~ ${b}`)
function PickedPet({ pet }) {
  return (
    <div className="picked column">
      <div className="pet-frame">
        <PetImg pet={pet} />
      </div>
      <h3>{pet.name}</h3>
      <div className="tags">
        <span className="tag">{attrText(pet.attrs)}</span>
        <span className="tag">
          S랭크 — 체 <b>{statAtLevel(pet.hp, 1)}</b> 공 <b>{statAtLevel(pet.atk, 1)}</b> 방 <b>{statAtLevel(pet.def, 1)}</b> 순 <b>{statAtLevel(pet.agi, 1)}</b>
        </span>
      </div>
    </div>
  )
}
function RangeBox({ title, label, value, answer, onChange }) {
  return (
    <div className="range-box">
      <h3>{title}</h3>
      <div className="field-row">
        <label>
          <span>{label} 최소</span>
          <input className="num" type="number" value={value.low} onChange={(e) => onChange({ ...value, low: e.target.value })} />
        </label>
        <label>
          <span>최대</span>
          <input className="num" type="number" value={value.high} onChange={(e) => onChange({ ...value, high: e.target.value })} />
        </label>
      </div>
      {answer && (
        <p className="answer">
          추정 <b>{answer}</b>
        </p>
      )}
    </div>
  )
}
export function ReversePage() {
  const [foe, setFoe] = useState(null)
  const [mine, setMine] = useState(null)
  const [atk, setAtk] = useState(0)
  const [def, setDef] = useState(0)
  const [dealt, setDealt] = useState({ low: '', high: '' })
  const [taken, setTaken] = useState({ low: '', high: '' })
  const { recent, remember } = useRecent()
  const pickFoe = (p) => {
    setFoe(p)
    remember(p.name)
  }
  const pickMine = (p) => {
    setMine(p)
    setAtk(statAtLevel(p.atk, 1))
    setDef(statAtLevel(p.def, 1))
    remember(p.name)
  }
  const ready = foe && mine
  const out = ready ? attrMultiplier(mine.attrs, foe.attrs) : 1
  const inn = ready ? attrMultiplier(foe.attrs, mine.attrs) : 1
  const dLo = nonNeg(dealt.low)
  const dHi = nonNeg(dealt.high) || dLo
  const tLo = nonNeg(taken.low)
  const tHi = nonNeg(taken.high) || tLo
  return (
    <div className="stack wide">
      <div className="two-col">
        <Panel title="1. 상대 펫 (야생)" icon="🎯">
          <PetPicker label="상대 펫 검색" placeholder="야생 펫 이름 (초성 가능)" selected={foe?.name} onPick={pickFoe} />
          {foe ? <PickedPet pet={foe} /> : <RecentPets recent={recent} columns={2} onPick={pickFoe} />}
        </Panel>
        <Panel title="2. 내 펫" icon="⚔️">
          <PetPicker label="내 펫 검색" placeholder="내 펫 이름 (초성 가능)" selected={mine?.name} onPick={pickMine} />
          {mine ? <PickedPet pet={mine} /> : foe && <RecentPets recent={recent} columns={2} onPick={pickMine} />}
        </Panel>
      </div>
      {ready && (
        <Panel title="3. 데미지로 역산" icon="🔍">
          <div className="tiles">
            <Stat label="내가 줄 때 속성 배율" value={`×${out.toFixed(2)}`} />
            <Stat label="상대가 줄 때 속성 배율" value={`×${inn.toFixed(2)}`} />
          </div>
          <div className="field-row">
            <label>
              <span>내 공격력</span>
              <NumInput min={0} value={atk} onValue={setAtk} />
            </label>
            <label>
              <span>내 방어력</span>
              <NumInput min={0} value={def} onValue={setDef} />
            </label>
          </div>
          <div className="two-col">
            <RangeBox title="상대 방어력" label="내가 준 데미지" value={dealt} onChange={setDealt} answer={dLo > 0 ? rangeText(guessDefense(atk, dLo, dHi, out)) : null} />
            <RangeBox title="상대 공격력" label="상대가 준 데미지" value={taken} onChange={setTaken} answer={tLo > 0 ? rangeText(guessAttack(def, tLo, tHi, inn)) : null} />
          </div>
        </Panel>
      )}
    </div>
  )
}
