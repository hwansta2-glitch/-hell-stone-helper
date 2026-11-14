import { useEffect, useRef, useState } from 'react'
import { expTable, grounds, TIERS, attrText } from '../lib/data'
import {
  applyMoon,
  costs,
  expNeeded,
  GROUND_GROUPS,
  groundLabel,
  hourlyExp,
  MOON_BONUS,
  multiplier,
  niceStep,
  PARTIES,
  perTenMillion,
  ratio,
  route,
  routeHours,
  sellPrice,
  shortNum,
  stoneToVip,
  TOP_PET,
  totalExpAt,
  TRANSFORM_NOTE,
  TRANSFORMS,
  vipToStone,
} from '../lib/exp'
import { hoursText, koreanUnits, store } from '../lib/format'
import { growthBetween, statAtLevel } from '../lib/hwan'
import { poisonDamage, poisonTable } from '../lib/battle'
import { NumInput, Note, Panel, PetImg, PetPicker, RecentPets, Seg, Stat, useRecent } from '../components/ui'

/* ---------- 공통: 사냥 조건 ---------- */
export function GroundSelect({ value, onChange, label = '사냥터' }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => box.current?.contains(e.target) || setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div className="dropdown" ref={box}>
      <button type="button" className="dropdown-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${groundLabel(value)}`} onClick={() => setOpen(!open)}>
        <span>{groundLabel(value)}</span>
        <i>▾</i>
      </button>
      {open && (
        <div className="dropdown-list" role="listbox" aria-label={label}>
          {GROUND_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="dropdown-group">{g.label}</p>
              {g.grounds.map((x) => (
                <button
                  key={x.name}
                  type="button"
                  role="option"
                  aria-selected={x.name === value}
                  onClick={() => {
                    onChange(x.name)
                    setOpen(false)
                  }}
                >
                  {groundLabel(x.name)}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
export function HuntOptions({ value, onChange, showRate }) {
  return (
    <div className="opt-grid">
      <fieldset>
        <legend>파티 인원</legend>
        <Seg options={PARTIES} value={value.party} onChange={(party) => onChange({ ...value, party })} label="파티 인원" />
      </fieldset>
      <fieldset>
        <legend>경구</legend>
        <Seg options={[false, true]} value={value.boost} render={(b) => (b ? 'ON' : 'OFF')} onChange={(boost) => onChange({ ...value, boost })} label="경구" />
      </fieldset>
      <fieldset>
        <legend>변신</legend>
        <Seg
          options={TRANSFORMS}
          value={value.transform}
          render={(t) => (showRate && TRANSFORM_NOTE[t] ? `${t} (${TRANSFORM_NOTE[t]})` : t)}
          onChange={(transform) => onChange({ ...value, transform })}
          label="변신"
        />
      </fieldset>
    </div>
  )
}
const DEFAULT_HUNT = { party: '2인', transform: '없음', boost: false }
const LEVEL_MAX = 140

/* ---------- 경험치 계산기 ---------- */
export function ExpPage() {
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(140)
  const [unit, setUnit] = useState('percent')
  const [done, setDone] = useState(0)
  const [auto, setAuto] = useState(true)
  const [cycle, setCycle] = useState('고순')
  const [groundName, setGroundName] = useState('강인함의 동굴 고순')
  const [moon, setMoon] = useState(0)
  const [hunt, setHunt] = useState(DEFAULT_HUNT)
  const stepExp = totalExpAt(expTable, from + 1) - totalExpAt(expTable, from)
  const pctDone = Math.min(100, unit === 'percent' ? done : stepExp > 0 ? (done / stepExp) * 100 : 0)
  const need = expNeeded(expTable, from, to, pctDone)
  const valid = to > from
  const ground = grounds.find((g) => g.name === groundName)
  const rateOf = (name) => hourlyExp(grounds.find((g) => g.name === name), hunt)
  const doneExp = valid ? (stepExp * pctDone) / 100 : 0
  const legs = routeHours(expTable, route(cycle), from, to, rateOf, doneExp)
  const hourly = hourlyExp(ground, hunt)
  const mult = multiplier(hunt)
  const hours = applyMoon(auto ? legs.map((l) => l.hours) : [need / hourly], moon, (mult + MOON_BONUS) / mult)
  const total = hours.reduce((s, h) => s + h, 0)
  return (
    <div className="two-col">
      <Panel title="설정" icon="⚙️">
        <fieldset>
          <legend>레벨 구간</legend>
          <div className="range-row">
            <NumInput min={1} max={LEVEL_MAX} aria-label="현재 레벨" value={from} onValue={setFrom} />
            <span>→</span>
            <NumInput min={1} max={LEVEL_MAX} aria-label="목표 레벨" value={to} onValue={setTo} />
          </div>
        </fieldset>
        <fieldset>
          <legend>현재 경험치</legend>
          <div className="range-row">
            <NumInput min={0} step="any" aria-label="현재 경험치" value={done} onValue={setDone} />
            <Seg options={['percent', 'value']} value={unit} onChange={setUnit} render={(u) => (u === 'percent' ? '%' : '수치')} label="단위" />
          </div>
        </fieldset>
        <fieldset>
          <legend>계산 방식</legend>
          <Seg options={[true, false]} value={auto} onChange={setAuto} render={(a) => (a ? '레벨별 추천 사냥터' : '사냥터 고정')} label="계산 방식" />
        </fieldset>
        {auto ? (
          <fieldset>
            <legend>순환</legend>
            <Seg options={['고순', '저순']} value={cycle} onChange={setCycle} label="순환" />
          </fieldset>
        ) : (
          <fieldset>
            <legend>사냥터</legend>
            <GroundSelect value={groundName} onChange={setGroundName} />
          </fieldset>
        )}
        <HuntOptions value={hunt} onChange={setHunt} showRate />
        <fieldset>
          <legend>월경</legend>
          <label className="range-row">
            <NumInput min={0} step="any" aria-label="월경 시간" value={moon} onValue={setMoon} />
            <small>시간</small>
          </label>
        </fieldset>
      </Panel>
      <div className="col">
        <Panel title="결과" icon="⏳">
          {valid ? (
            <>
              <div className="tiles two">
                <Stat label="소요 시간" value={hoursText(total)} tone="fire" />
                <Stat label="탑펫 소요" value={hoursText(total / TOP_PET)} />
                <Stat label="필요 경험치" value={koreanUnits(need)} />
                <Stat label="탑펫 경험치" value={koreanUnits(need * TOP_PET)} />
                {!auto && <Stat label="시간당 경험치" value={`${shortNum(hourly)}/hr`} />}
                {costs(total, hunt).map((c) => (
                  <Stat key={c.label} label={`비용 (${c.label})`} value={`${c.amount.toLocaleString('ko-KR')} ${c.unit}`} />
                ))}
              </div>
              <p className="pill-line">
                적용 배율 <b>×{mult.toFixed(2)}</b>
                {moon > 0 && ` (월경 ×${(mult + MOON_BONUS).toFixed(2)} · ${hoursText(moon)})`}
              </p>
            </>
          ) : (
            <p className="empty">목표 레벨은 현재 레벨보다 높아야 합니다</p>
          )}
        </Panel>
        {valid && auto && legs.length > 0 && (
          <details className="panel fold" open>
            <summary>사냥터별 상세</summary>
            <div className="table-wrap">
              <table className="table center">
                <thead>
                  <tr>
                    <th>사냥터</th>
                    <th>레벨 구간</th>
                    <th>소요 시간</th>
                  </tr>
                </thead>
                <tbody>
                  {legs.map((l, i) => (
                    <tr key={l.ground}>
                      <th>{l.ground}</th>
                      <td>
                        {l.from} → {l.to}
                      </td>
                      <td>{hoursText(hours[i])}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <th>총합</th>
                    <td>
                      {from} → {to}
                    </td>
                    <td>{hoursText(total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        )}
        <details className="panel fold">
          <summary>레벨별 경험치 표</summary>
          <div className="table-wrap tall">
            <table className="table center">
              <thead>
                <tr>
                  <th>레벨</th>
                  <th>필요 경험치</th>
                  <th>누적 경험치</th>
                </tr>
              </thead>
              <tbody>
                {expTable.slice(0, -1).map((r, i) => (
                  <tr key={r.level}>
                    <th>
                      {r.level} → {r.level + 1}
                    </th>
                    <td>{(expTable[i + 1].total - r.total).toLocaleString('ko-KR')}</td>
                    <td>{expTable[i + 1].total.toLocaleString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  )
}

/* ---------- 독딜 계산기 ---------- */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
const HWAN = 8
export function PoisonPage() {
  const [pet, setPet] = useState(null)
  const [maxHp, setMaxHp] = useState(0)
  const [hits, setHits] = useState([])
  const [slots, setSlots] = useState(KEYS.map(() => 0))
  const [cur, setCur] = useState(0)
  const [step, setStep] = useState(1)
  const [poison, setPoison] = useState(0)
  const { recent, remember } = useRecent()
  const pick = (p) => {
    setPet(p)
    setMaxHp(statAtLevel(p.hp, 1))
    setPoison(poisonDamage(p, HWAN))
    setHits([])
    remember(p.name)
  }
  const left = Math.max(0, maxHp - hits.reduce((s, x) => s + x, 0))
  const act = useRef({})
  act.current = {
    strike: () => setHits([...hits, slots[cur]]),
    tick: () => setHits([...hits, poison]),
    undo: () => setHits(hits.slice(0, -1)),
    reset: () => setHits([]),
  }
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t.closest('input, select, textarea') || (e.key === 'Enter' && t.closest('button, a'))) return
      const k = KEYS.indexOf(e.key)
      if (k >= 0) setCur(k)
      else if (e.key === 'Enter' || e.key === '=') act.current.strike()
      else if (e.key === '+') act.current.tick()
      else if (e.key === '-') act.current.undo()
      else if (e.key === 'Delete') act.current.reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="stack wide">
      <Panel title="펫 선택" icon="🔍">
        <PetPicker label="펫 이름 검색" placeholder="펫 이름을 검색하세요 (초성 가능)" selected={pet?.name} onPick={pick} />
        {pet ? (
          <div className="picked">
            <div className="pet-frame">
              <PetImg pet={pet} />
            </div>
            <div>
              <h3>{pet.name}</h3>
              <div className="tags">
                <span className="tag">{pet.ride ? '🐎 탑승' : '🚫 탑승X'}</span>
                {pet.skillSlots != null && <span className="tag">⚔️ 기술창 {pet.skillSlots}</span>}
                <span className="tag">{attrText(pet.attrs)}</span>
                <span className="tag">
                  S랭크 초기치 — 체 <b>{statAtLevel(pet.hp, 1)}</b> 공 <b>{statAtLevel(pet.atk, 1)}</b> 방 <b>{statAtLevel(pet.def, 1)}</b> 순 <b>{statAtLevel(pet.agi, 1)}</b>
                </span>
              </div>
            </div>
          </div>
        ) : (
          <RecentPets recent={recent} onPick={pick} />
        )}
      </Panel>
      {pet && (
        <div className="two-col">
          <Panel title="남은 체력" icon="❤️">
            <div className="hp-line">
              남은 체력 <b>{left}</b>
              <label>
                / <NumInput min={0} aria-label="최대 체력" value={maxHp} onValue={setMaxHp} />
              </label>
            </div>
            <div className="hp-bar">
              <i style={{ width: `${maxHp > 0 ? (left / maxHp) * 100 : 0}%` }} />
            </div>
            <div className="range-row">
              <span>타격 데미지</span>
              <span className="grow" />
              <label>
                +<NumInput min={0} aria-label="칸마다 더할 값" value={step} onValue={setStep} />
              </label>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSlots(slots.map((_, i) => slots[0] + step * i))}>
                채우기
              </button>
            </div>
            <Note>⌨️ 1~0 칸 선택 · Enter/= 타격 · + 독턴 · - 되돌리기 · Del 초기화</Note>
            <div className="slot-grid">
              {slots.map((v, i) => (
                <label key={i} className={cur === i ? 'slot is-cur' : 'slot'}>
                  <small>{KEYS[i]}</small>
                  <NumInput min={0} aria-label={`${KEYS[i]}번 칸 데미지`} value={v} onFocus={() => setCur(i)} onValue={(x) => setSlots(slots.map((y, k) => (k === i ? x : y)))} />
                </label>
              ))}
            </div>
            <button type="button" className="btn btn-fire btn-block" onClick={() => act.current.strike()}>
              타격! ({slots[cur]})
            </button>
            <div className="range-row">
              <span>독딜</span>
              <NumInput min={0} aria-label="독딜" value={poison} onValue={setPoison} />
              <button type="button" className="btn btn-poison" onClick={() => act.current.tick()}>
                독턴!
              </button>
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-ghost" disabled={hits.length === 0} onClick={() => act.current.undo()}>
                ↩ 되돌리기
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => act.current.reset()}>
                HP 초기화
              </button>
            </div>
          </Panel>
          <Panel title="독딜 (1레벨 · 필드포획)" icon="☠️">
            <div className="gold-box">
              <div>
                <b>S랭크(환각) 독딜</b>
                <small>매 턴 HP 감소</small>
              </div>
              <strong>{poisonDamage(pet, HWAN)}</strong>
            </div>
            <div className="table-wrap">
              <table className="table center">
                <thead>
                  <tr>
                    <th>등급</th>
                    <th>독딜</th>
                  </tr>
                </thead>
                <tbody>
                  {poisonTable(pet).map(({ grade, damage }) => (
                    <tr key={grade} className={grade === HWAN ? 'hot' : undefined}>
                      <th>{grade === HWAN ? '8 (환각)' : grade === 0 ? '0 (평균)' : grade}</th>
                      <td>{damage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setPet(null)}>
              펫 다시 고르기
            </button>
          </Panel>
        </div>
      )}
    </div>
  )
}

/* ---------- 판매 계산기 ---------- */
const BASELINE = { tier: '일반', level: 51, cost: 0, vipCost: 0 }
const VIP_KEY = 'hellstone-vip-rate'
const CHART = { width: 420, height: 290, left: 44, right: 14, top: 10, bottom: 28 }
const CHART_FROM = 30
const CHART_TO = 140
const TICKS = [30, 50, 70, 90, 100, 110, 120, 130, 140]
const COLORS = { a: 'var(--fire)', b: 'var(--gold)' }
function evaluate(slot, rate) {
  const base = expTable.find((r) => r.level === slot.level)?.price ?? 0
  const price = sellPrice(slot.tier, slot.level, base)
  const exp = totalExpAt(expTable, slot.level)
  const cost = slot.cost + vipToStone(slot.vipCost, rate)
  const net = price - cost
  return { price, exp, cost, net, value: perTenMillion(net, exp) }
}
const fmt = (v) => v.toLocaleString('ko-KR')
const vipFmt = (v) => v.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
const VipNote = ({ stone, rate }) => (rate > 0 ? <small className="muted">≈ {vipFmt(stoneToVip(stone, rate))}빕</small> : null)
function SellCard({ title, tone, slot, top, rate }) {
  const { price, exp, cost, net, value } = evaluate(slot, rate)
  return (
    <div className={`sell-card ${tone}`}>
      <h3>{title}</h3>
      <div className="kv">
        판매가 <b>{fmt(price)} 스톤</b>
        <VipNote stone={price} rate={rate} />
      </div>
      {cost > 0 && (
        <div className="kv">
          구매가 <b>{fmt(cost)} 스톤</b>
          <VipNote stone={cost} rate={rate} />
        </div>
      )}
      <div className="kv">
        필요 경험치 <b>{koreanUnits(exp, true)}</b>
      </div>
      <div className="kv">
        순수익 <b>{fmt(net)} 스톤</b>
        <VipNote stone={net} rate={rate} />
      </div>
      <div className="kv">
        효율 <b className="accent">{fmt(value)} 스톤/천만exp</b>
      </div>
      <div className="meter">
        <i style={{ width: `${Math.min(100, ratio(value, top) * 100)}%` }} />
      </div>
    </div>
  )
}
function SellChart({ slots, rate }) {
  const lines = slots.map((s) =>
    expTable.filter((r) => r.level >= CHART_FROM && r.level <= CHART_TO).map((r) => ({ level: r.level, value: evaluate({ ...s, level: r.level }, rate).value })),
  )
  const peak = Math.max(...lines.flat().map((p) => p.value), 1)
  const step = niceStep(peak)
  const top = Math.ceil(peak / step) * step
  const x = (lv) => CHART.left + ((lv - CHART_FROM) / (CHART_TO - CHART_FROM)) * (CHART.width - CHART.left - CHART.right)
  const y = (v) => CHART.height - CHART.bottom - (Math.max(v, 0) / top) * (CHART.height - CHART.top - CHART.bottom)
  const grid = Array.from({ length: top / step + 1 }, (_, i) => i * step)
  return (
    <div className="chart">
      <div className="legend">
        <span>
          <i style={{ background: COLORS.a }} />A · {slots[0].tier}
        </span>
        <span>
          <i style={{ background: COLORS.b }} />B · {slots[1].tier}
        </span>
      </div>
      <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label="레벨별 효율 그래프">
        {grid.map((v) => (
          <g key={v}>
            <line x1={CHART.left} x2={CHART.width - CHART.right} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={CHART.left - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">
              {v === 0 ? 0 : `${v / 1e4}만`}
            </text>
          </g>
        ))}
        {TICKS.map((lv) => (
          <text key={lv} x={x(lv)} y={CHART.height - 8} textAnchor="middle" fontSize="9" fill="var(--muted)">
            {lv}
          </text>
        ))}
        {lines.map((pts, i) => (
          <polyline key={i} fill="none" stroke={i === 0 ? COLORS.a : COLORS.b} strokeWidth="2" points={pts.map((p) => `${x(p.level)},${y(p.value)}`).join(' ')} />
        ))}
        {slots.map((s, i) => (
          <g key={i}>
            <line x1={x(s.level)} x2={x(s.level)} y1={CHART.top} y2={CHART.height - CHART.bottom} stroke={i === 0 ? COLORS.a : COLORS.b} strokeDasharray="3 3" />
            <circle cx={x(s.level)} cy={y(evaluate(s, rate).value)} r="3.5" fill={i === 0 ? COLORS.a : COLORS.b} />
          </g>
        ))}
      </svg>
      <p className="muted small center">높을수록 효율이 좋고, 꼭대기가 최적 레벨입니다</p>
    </div>
  )
}
export function SellPage() {
  const [slots, setSlots] = useState([
    { tier: '일반', level: 50, cost: 0, vipCost: 0 },
    { tier: '일반', level: 101, cost: 0, vipCost: 0 },
  ])
  const [rate, setRate] = useState(() => Math.max(0, Number(store.get(VIP_KEY, 0)) || 0))
  const [goal, setGoal] = useState('')
  const [groundName, setGroundName] = useState('강인함의 동굴 고순')
  const [hunt, setHunt] = useState(DEFAULT_HUNT)
  const patch = (i, p) => setSlots(slots.map((s, k) => (k === i ? { ...s, ...p } : s)))
  const hourly = hourlyExp(grounds.find((g) => g.name === groundName), hunt)
  const [A, B] = slots.map((s) => evaluate(s, rate))
  const base = evaluate(BASELINE, rate)
  const top = Math.max(A.value, B.value, base.value, 1)
  const winner = A.value >= B.value ? 'A' : 'B'
  const low = Math.min(A.value, B.value)
  const goalLv = Math.min(140, Math.max(1, Number(goal) || 0))
  const goalExp = goal ? totalExpAt(expTable, goalLv) : 0
  return (
    <div className="two-col">
      <div className="col">
        <Panel title="설정" icon="⚙️">
          <label className="inline-field">
            <span>VIP 시세 (100만 스톤당)</span>
            <NumInput
              min={0}
              step="any"
              aria-label="VIP 시세"
              value={rate}
              onValue={(v) => {
                setRate(v)
                store.set(VIP_KEY, v)
              }}
            />
            <small>빕</small>
          </label>
          <Note>시세를 넣으면 VIP 구매가를 스톤으로 바꿔 계산하고, 결과도 빕으로 함께 보여 줍니다.</Note>
          {slots.map((s, i) => (
            <div key={i} className={i === 0 ? 'slot-box is-a' : 'slot-box is-b'}>
              <p className="slot-title">
                <span className="slot-mark">{i === 0 ? 'A' : 'B'}</span> 슬롯 {i === 0 ? 'A' : 'B'}
              </p>
              <Seg
                options={TIERS}
                value={s.tier}
                onChange={(t) => patch(i, { tier: t, cost: t === '일반' ? 0 : s.cost, vipCost: t === '일반' ? 0 : s.vipCost })}
                label={`슬롯 ${i === 0 ? 'A' : 'B'} 등급`}
              />
              <div className="field-row">
                <label>
                  <span>판매 레벨</span>
                  <NumInput min={1} max={140} value={s.level} onValue={(v) => patch(i, { level: v })} />
                </label>
                {s.tier !== '일반' && (
                  <>
                    <label>
                      <span>구매가 (스톤)</span>
                      <NumInput min={0} value={s.cost} onValue={(v) => patch(i, { cost: v })} />
                    </label>
                    <label>
                      <span>구매가 (VIP)</span>
                      <NumInput min={0} step="any" value={s.vipCost} onValue={(v) => patch(i, { vipCost: v })} />
                    </label>
                  </>
                )}
              </div>
              {s.tier !== '일반' && s.vipCost > 0 && (
                <Note warn={rate <= 0}>
                  {rate > 0 ? `VIP ${vipFmt(s.vipCost)}빕 = ${fmt(vipToStone(s.vipCost, rate))} 스톤으로 계산합니다` : 'VIP 시세를 넣어야 VIP 구매가를 스톤으로 바꿔 계산합니다'}
                </Note>
              )}
            </div>
          ))}
        </Panel>
        <Panel title="육성 시간" icon="⏳">
          <label className="inline-field">
            <span>목표 레벨</span>
            <input className="num" type="number" min={1} max={140} placeholder="레벨" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </label>
          <fieldset>
            <legend>사냥터</legend>
            <GroundSelect value={groundName} onChange={setGroundName} />
          </fieldset>
          <HuntOptions value={hunt} onChange={setHunt} />
          {goal ? (
            <div className="tiles two">
              <Stat label="소요 시간" value={hoursText(goalExp / hourly)} tone="fire" />
              <Stat label="탑펫 소요" value={hoursText(goalExp / (hourly * TOP_PET))} />
              <Stat label="필요 경험치" value={fmt(goalExp)} />
              <Stat label="시간당 경험치" value={`${fmt(hourly)}/hr`} />
            </div>
          ) : (
            <p className="muted small center">결과의 A/B 카드를 누르거나 목표 레벨을 넣으세요</p>
          )}
        </Panel>
      </div>
      <Panel title="결과" icon="💰">
        <div className="sell-cards">
          {slots.map((s, i) => (
            <button key={i} type="button" className="card-btn" aria-label={`목표 레벨에 ${s.level} 넣기`} onClick={() => setGoal(String(s.level))}>
              <SellCard title={`Lv.${s.level}`} tone={i === 0 ? 'is-a' : 'is-b'} slot={s} top={top} rate={rate} />
            </button>
          ))}
        </div>
        {low > 0 && A.value === B.value && <p className="verdict-msg">⚡ A와 B의 효율이 같습니다</p>}
        {low > 0 && A.value !== B.value && (
          <p className="verdict-msg">
            ⚡ {winner}가 {winner === 'A' ? 'B' : 'A'}보다 <b>{((Math.max(A.value, B.value) / low - 1) * 100).toFixed(1)}%</b> 효율적
          </p>
        )}
        <SellCard title={`기준: 일반 Lv.${BASELINE.level}`} tone="is-base" slot={BASELINE} top={top} rate={rate} />
        <p className="verdict-msg">
          일반 Lv.{BASELINE.level} 대비 A <b>×{ratio(A.value, base.value).toFixed(2)}</b>, B <b>×{ratio(B.value, base.value).toFixed(2)}</b>
        </p>
        <details className="fold" open>
          <summary>레벨별 효율 그래프</summary>
          <SellChart slots={slots} rate={rate} />
        </details>
      </Panel>
    </div>
  )
}

/* ---------- 성장률 계산기 ---------- */
const G_STATS = [
  { key: 'hp', label: '체력', color: 'var(--fire)' },
  { key: 'atk', label: '공격', color: 'var(--blood)' },
  { key: 'def', label: '방어', color: 'var(--ash)' },
  { key: 'agi', label: '순발', color: 'var(--gold)' },
]
const LEVEL_ROWS = [1, 5, 10, 20, 30, 50, 70, 100, 120, 140]
const at = (pet, level) => ({
  initial: G_STATS.map(({ key }) => statAtLevel(pet[key], 1)),
  current: G_STATS.map(({ key }) => statAtLevel(pet[key], level)),
})
function Diff({ value }) {
  const v = Math.round(value * 100) / 100
  return <span className={v < 0 ? 'diff neg' : 'diff pos'}>{v === 0 ? 0 : v.toFixed(2)}</span>
}
export function GrowthPage() {
  const [pet, setPet] = useState(null)
  const [level, setLevel] = useState(140)
  const [initial, setInitial] = useState([])
  const [current, setCurrent] = useState([])
  const [edited, setEdited] = useState(false)
  const pick = (p) => {
    const s = at(p, level)
    setPet(p)
    setInitial(s.initial)
    setCurrent(s.current)
    setEdited(false)
  }
  const setAt = (arr, i, v) => arr.map((x, k) => (k === i ? v : x))
  const rates = current.map((c, i) => growthBetween(initial[i], c, level))
  const total = rates.slice(1).reduce((s, x) => s + x, 0)
  return (
    <div className="stack">
      <section className="hero small">
        <div className="hero-glow" aria-hidden="true" />
        <h1>
          내 펫, <em>S랭크</em>와 얼마나 가까울까?
        </h1>
        <p>현재 스탯을 넣으면 S랭크 대비 성장률을 분석해 드려요</p>
        <div className="hero-search">
          <PetPicker big label="펫 이름 검색" placeholder="펫 이름을 검색하세요" onPick={pick} />
        </div>
        {pet && (
          <div className="picked compact">
            <PetImg pet={pet} />
            <div>
              <b>{pet.name}</b>
              <small>{attrText(pet.attrs)}</small>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPet(null)}>
              변경
            </button>
          </div>
        )}
      </section>
      {pet && (
        <div className="two-col">
          <Panel title="입력" icon="✍️">
            <label className="inline-field">
              <span>현재 레벨</span>
              <NumInput
                min={1}
                max={140}
                value={level}
                onValue={(v) => {
                  setLevel(v)
                  if (!edited) setCurrent(at(pet, v).current)
                }}
              />
            </label>
            <details className="fold">
              <summary>1레벨 초기치 고치기</summary>
              <Note>기본값은 S랭크 스탯입니다. 실제 값을 알면 고치세요.</Note>
              <div className="field-row four">
                {G_STATS.map(({ key, label }, i) => (
                  <label key={key}>
                    <span>{label}</span>
                    <NumInput value={initial[i] ?? 0} onValue={(v) => setInitial(setAt(initial, i, v))} />
                  </label>
                ))}
              </div>
            </details>
            <h3 className="sub">내 펫 스탯</h3>
            <div className="field-row four">
              {G_STATS.map(({ key, label }, i) => {
                const d = (current[i] ?? 0) - statAtLevel(pet[key], level)
                return (
                  <label key={key}>
                    <span>
                      {label} <small className={`diff ${d > 0 ? 'pos' : d < 0 ? 'neg' : 'zero'}`}>{d >= 0 ? `+${d}` : d}</small>
                    </span>
                    <NumInput
                      value={current[i] ?? 0}
                      onValue={(v) => {
                        setEdited(true)
                        setCurrent(setAt(current, i, v))
                      }}
                    />
                  </label>
                )
              })}
            </div>
          </Panel>
          <Panel title="분석 결과" icon="📈">
            <div className="big-number">
              <span>전체 성장률 (공+방+순)</span>
              <b>{total.toFixed(3)}</b>
            </div>
            <ul className="rate-bars">
              {G_STATS.map(({ key, label, color }, i) => (
                <li key={key}>
                  <div>
                    <span>{label}</span>
                    <span>
                      <b>{rates[i].toFixed(3)}</b> / {pet[key][1].toFixed(2)} <Diff value={rates[i] - pet[key][1]} />
                    </span>
                  </div>
                  <i style={{ background: color, width: `${Math.max(0, Math.min(100, pet[key][1] > 0 ? (rates[i] / pet[key][1]) * 100 : 0))}%` }} />
                </li>
              ))}
            </ul>
            <div className="table-wrap">
              <table className="table center">
                <thead>
                  <tr>
                    <th aria-label="항목" />
                    <th>내 성장률</th>
                    <th>S랭크</th>
                    <th>차이</th>
                  </tr>
                </thead>
                <tbody>
                  {G_STATS.map(({ key, label }, i) => (
                    <tr key={key}>
                      <th>{label}</th>
                      <td className="accent">{rates[i].toFixed(3)}</td>
                      <td>{pet[key][1].toFixed(2)}</td>
                      <td>
                        <Diff value={rates[i] - pet[key][1]} />
                      </td>
                    </tr>
                  ))}
                  <tr className="total">
                    <th>전체(공방순)</th>
                    <td className="accent">{total.toFixed(3)}</td>
                    <td>{pet.total.toFixed(2)}</td>
                    <td>
                      <Diff value={total - pet.total} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <details className="fold">
              <summary>레벨별 S랭크 예상 스탯</summary>
              <div className="table-wrap">
                <table className="table center">
                  <thead>
                    <tr>
                      <th>레벨</th>
                      {G_STATS.map((s) => (
                        <th key={s.key}>{s.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {LEVEL_ROWS.map((lv) => (
                      <tr key={lv}>
                        <th>{lv}</th>
                        {G_STATS.map(({ key }) => (
                          <td key={key}>{statAtLevel(pet[key], lv).toLocaleString('ko-KR')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Panel>
        </div>
      )}
    </div>
  )
}
