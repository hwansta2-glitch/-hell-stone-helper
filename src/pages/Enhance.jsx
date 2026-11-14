import { useState } from 'react'
import { enhance, itemImageByName } from '../lib/data'
import { cheapestCubes, enhanceBonus, expectedCost, REFINE_STAGES, REFINES, refineOnce, refineUntil, runUntil, stepOdds, tryOnce } from '../lib/enhance'
import { ItemImg, NumInput, Note, Panel, Seg, Stat } from '../components/ui'

const LEVELS = enhance.steps.map((s) => s.to)
const FROM_PINS = [0, ...LEVELS.slice(0, -1)]
const n0 = (v) => Math.round(v).toLocaleString('ko-KR')
const pctOr = (v) => (v > 0 ? `${v}%` : '-')
const ZERO = { tries: 0, stone: 0, bip: 0, destroys: 0 }
const LOG_MAX = 50
const MC_DEFAULT = 1000
const MC_MAX = 2e4
const BALANCED = { 2: 1, 5: 1, 6: 1, 7: 1, 8: 1 }
const PRESETS = [
  { label: '💰 절약', picks: {} },
  { label: '⚖️ 균형', picks: BALANCED },
  { label: '🛡️ 안정', picks: { 5: 2, 6: 2, 7: 2, 8: 2, 9: 1, 10: 1 } },
  { label: '🔥 올인', picks: { 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 3 } },
]
const CUBE_LOOK = [
  { mark: 'N', color: '#8a7f7a', note: '기본' },
  { mark: '+', color: '#d08a3c', note: '성공 +10%' },
  { mark: '+', color: '#3fb8a4', note: '성공 +15%' },
  { mark: '+', color: '#e0453a', note: '성공 +20%' },
]
const MODES = [
  { id: 'manual', label: '🎲 수동' },
  { id: 'auto', label: '⚡ 자동' },
  { id: 'mc', label: '📊 몬테카를로' },
  { id: 'opt', label: '🎯 최적화' },
]

function Tally({ t, bipLabel = '총 빕', lossLabel = '파괴 횟수' }) {
  return (
    <div className="tiles four">
      <Stat label="총 시도" value={n0(t.tries)} />
      <Stat label="총 스톤 (ST)" value={n0(t.stone)} tone="gold" />
      <Stat label={bipLabel} value={n0(t.bip)} tone="fire" />
      <Stat label={lossLabel} value={n0(t.destroys)} tone="fire" />
    </div>
  )
}
function OddsBar({ success, stay, destroy, refine }) {
  return (
    <>
      <div className="odds">
        {success > 0 && (
          <i className="ok" style={{ width: `${success}%` }}>
            성공 {success}%
          </i>
        )}
        {stay > 0 && (
          <i className="stay" style={{ width: `${stay}%` }}>
            {stay}%
          </i>
        )}
        {destroy > 0 && (
          <i className="boom" style={{ width: `${destroy}%` }}>
            {destroy}%
          </i>
        )}
      </div>
      <p className="small">
        <b className="good">성공 {success}%</b> ·{' '}
        {refine ? (
          <b className="bad">실패 {destroy}%</b>
        ) : (
          <>
            <b className="muted">유지 {stay}%</b> · <b className="bad">파괴 {destroy}%</b>
          </>
        )}
      </p>
    </>
  )
}

function Upgrade() {
  const [kind, setKind] = useState('무기')
  const [keep, setKeep] = useState(true)
  const [gearPrice, setGearPrice] = useState({ 무기: 0, 방어구: 0 })
  const [cubePrice, setCubePrice] = useState({ 일반: 0, 고급: 0, 청록: 0, 적색: 0 })
  const [picks, setPicks] = useState(BALANCED)
  const [mode, setMode] = useState('manual')
  const [pin, setPin] = useState(0)
  const [backToPin, setBackToPin] = useState(false)
  const [level, setLevel] = useState(0)
  const [flash, setFlash] = useState({ kind: null, n: 0 })
  const [tally, setTally] = useState(ZERO)
  const [log, setLog] = useState([])
  const [undo, setUndo] = useState([])
  const [goal, setGoal] = useState(10)
  const [autoRes, setAutoRes] = useState(null)
  const [mcN, setMcN] = useState(MC_DEFAULT)
  const [mcRes, setMcRes] = useState(null)
  const [bipStone, setBipStone] = useState(0)
  const [optRes, setOptRes] = useState(null)
  const sig = (p) => JSON.stringify([kind, keep, gearPrice, cubePrice, bipStone, p, pin, goal])
  const now = sig(picks)
  const cubeAt = (lv) => enhance.cubes[picks[lv] ?? 0]
  const optsOf = (lv) => ({ keep, cubeBonus: cubeAt(lv).bonus })
  const cubeBip = (lv) => cubePrice[cubeAt(lv).name] ?? 0
  const gearBip = gearPrice[kind]
  const cycle = (lv) => setPicks({ ...picks, [lv]: ((picks[lv] ?? 0) + 1) % enhance.cubes.length })
  const next = enhance.steps.find((s) => s.to === level + 1)
  const odds = next ? stepOdds(next, optsOf(next.to)) : null
  const bonus = enhanceBonus(kind, level)
  const bonusRows = kind === '무기' ? [['공격력', bonus.atk], ['관통', bonus.pierce], ['명중', bonus.hit]] : [['방어력', bonus.def], ['쉴드', bonus.shield], ['내구', bonus.hp]]
  const avg = expectedCost(enhance.steps, pin, goal, optsOf, 0)

  const attempt = () => {
    if (!next) return
    const r = tryOnce(enhance.steps, level, optsOf)
    const boom = r.result === '파괴'
    setFlash({ kind: boom ? 'boom' : r.result === '성공' ? 'ok' : 'stay', n: flash.n + 1 })
    setUndo([...undo, { level, tally, log }])
    setLevel(boom && backToPin ? pin : r.level)
    setTally({ tries: tally.tries + 1, stone: tally.stone + r.stone, bip: tally.bip + cubeBip(next.to) + (boom ? gearBip : 0), destroys: tally.destroys + (boom ? 1 : 0) })
    setLog([`+${next.to} ${cubeAt(next.to).name} 큐브 — ${r.result}`, ...log].slice(0, LOG_MAX))
  }
  const back = () => {
    const u = undo[undo.length - 1]
    if (!u) return
    setLevel(u.level)
    setTally(u.tally)
    setLog(u.log)
    setUndo(undo.slice(0, -1))
  }
  const clearAll = () => {
    setLevel(pin)
    setTally(ZERO)
    setLog([])
    setUndo([])
  }
  const monteCarlo = () => {
    const sum = { ...ZERO }
    let best = Infinity
    let worst = 0
    for (let i = 0; i < mcN; i++) {
      const r = runUntil(enhance.steps, pin, goal, optsOf, cubeBip, gearBip)
      sum.tries += r.tries
      sum.stone += r.stone
      sum.bip += r.bip
      sum.destroys += r.destroys
      best = Math.min(best, r.stone)
      worst = Math.max(worst, r.stone)
    }
    setMcRes({ avg: { tries: sum.tries / mcN, stone: sum.stone / mcN, bip: sum.bip / mcN, destroys: sum.destroys / mcN }, best, worst, sig: now })
  }
  const optimize = () => {
    const stonePrices = enhance.cubes.map((c) => (cubePrice[c.name] ?? 0) * bipStone)
    const r = cheapestCubes(enhance.steps, enhance.cubes, pin, goal, keep, stonePrices, gearBip * bipStone)
    setPicks(r.picks)
    setOptRes({ cost: r.cost, sig: sig(r.picks) })
  }

  return (
    <>
      <Panel title="강화 설정" icon="⚙️">
        <div className="two-col tight">
          <div>
            <p className="sub">장비 종류</p>
            <Seg options={['무기', '방어구']} value={kind} onChange={setKind} label="장비 종류" />
          </div>
          <div>
            <p className="sub">유지 확률 옵션 (+5강 이후)</p>
            <label className="check">
              <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> 파괴 −10% / 유지 +10% (스톤 ×2)
            </label>
          </div>
        </div>
        <p className="sub">장비 단가 (빕) — 파괴 시 다시 사는 비용</p>
        <div className="field-row">
          {['무기', '방어구'].map((k) => (
            <label key={k}>
              <span>
                {k === '무기' ? '⚔️' : '🛡️'} {k}
              </span>
              <NumInput min={0} value={gearPrice[k]} onValue={(v) => setGearPrice({ ...gearPrice, [k]: v })} />
            </label>
          ))}
        </div>
        <p className="sub">큐브 단가 (빕)</p>
        <div className="cube-cards">
          {enhance.cubes.map((c, i) => (
            <label key={c.name} className="cube-card">
              <span className="cube-mark" style={{ background: CUBE_LOOK[i].color }}>
                {CUBE_LOOK[i].mark}
              </span>
              <b>{c.name}</b>
              <small>{CUBE_LOOK[i].note}</small>
              <NumInput min={0} step="any" aria-label={`${c.name} 큐브 단가`} value={cubePrice[c.name]} onValue={(v) => setCubePrice({ ...cubePrice, [c.name]: v })} />
            </label>
          ))}
        </div>
        <p className="sub">강화별 큐브 — 칸을 누르면 일반 → 고급 → 청록 → 적색</p>
        <div className="btn-row">
          <span className="muted small">빠른 설정:</span>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="chip" onClick={() => setPicks(p.picks)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="cube-strip">
          {LEVELS.map((lv) => {
            const c = picks[lv] ?? 0
            return (
              <button key={lv} type="button" data-cube={c} aria-label={`+${lv} 큐브 바꾸기, 지금 ${enhance.cubes[c].name}`} onClick={() => cycle(lv)}>
                <b>+{lv}</b>
                <span>{enhance.cubes[c].name}</span>
                {enhance.cubes[c].bonus > 0 && <small>+{enhance.cubes[c].bonus}%</small>}
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel title="강화 시뮬레이션" icon="🔨">
        <Seg options={MODES.map((m) => m.id)} value={mode} onChange={setMode} render={(id) => MODES.find((m) => m.id === id).label} label="강화 방식" />
        <p className="sub">시작 강화 수치 (자동·몬테카를로 시작값)</p>
        <div className="chip-row">
          {FROM_PINS.map((lv) => (
            <button
              key={lv}
              type="button"
              className="chip"
              aria-pressed={pin === lv}
              onClick={() => {
                setPin(lv)
                setLevel(lv)
              }}
            >
              +{lv}
            </button>
          ))}
        </div>
        {mode === 'manual' && (
          <>
            <label className="check">
              <input type="checkbox" checked={backToPin} onChange={(e) => setBackToPin(e.target.checked)} /> 파괴되면 +{pin}로 돌아가기 (꺼 두면 게임처럼 +0)
            </label>
            <div className="level-stage">
              <span>현재 강화</span>
              <strong key={flash.n} className={flash.kind ? `flash-${flash.kind}` : undefined}>
                +{level}
              </strong>
              <div className="level-tiles">
                {bonusRows.map(([k, v]) => (
                  <div key={k}>
                    <span>{k}</span>
                    <b>+{v ?? 0}</b>
                  </div>
                ))}
              </div>
            </div>
            {next && odds ? (
              <div className="next-box">
                <p className="sub">
                  다음 강화: +{level} → +{next.to}
                </p>
                <OddsBar {...odds} />
                <p className="small">
                  스톤 <b className="gold">{n0(odds.stone)}</b> · 큐브 <b>{cubeAt(next.to).name} {n0(cubeBip(next.to))}빕</b>
                </p>
              </div>
            ) : (
              <p className="info">최고 강화에 도달했습니다.</p>
            )}
            <div className="btn-row">
              <button type="button" className="btn btn-fire" disabled={!next} onClick={attempt}>
                강화 (+{Math.min(level + 1, 10)})
              </button>
              <button type="button" className="btn btn-ghost" disabled={undo.length === 0} onClick={back}>
                ↶ 되돌리기
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setLevel(0)}>
                +0으로
              </button>
              <button type="button" className="btn btn-ghost danger" onClick={clearAll}>
                전체 초기화
              </button>
            </div>
            <Tally t={tally} />
            <h3 className="sub">📜 강화 로그</h3>
            {log.length === 0 ? (
              <p className="empty">강화 기록이 여기에 쌓입니다</p>
            ) : (
              <ol className="log">
                {log.map((l, i) => (
                  <li key={flash.n - i}>{l}</li>
                ))}
              </ol>
            )}
          </>
        )}
        {mode !== 'manual' && (
          <label className="inline-field">
            <span>목표 강화</span>
            <select value={goal} onChange={(e) => setGoal(Number(e.target.value))}>
              {LEVELS.map((lv) => (
                <option key={lv} value={lv}>
                  +{lv}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode === 'auto' && (
          <>
            <button
              type="button"
              className="btn btn-fire"
              disabled={goal <= pin}
              onClick={() => setAutoRes({ t: runUntil(enhance.steps, pin, goal, optsOf, cubeBip, gearBip), sig: now })}
            >
              +{pin}에서 +{goal}까지 자동 강화
            </button>
            {autoRes?.sig === now && <Tally t={autoRes.t} />}
            <Note>
              평균으로는 {n0(avg.stone)} 스톤, 파괴 {avg.destroys.toFixed(1)}회가 듭니다.
            </Note>
          </>
        )}
        {mode === 'mc' && (
          <>
            <label className="inline-field">
              <span>반복 횟수</span>
              <NumInput min={1} max={MC_MAX} value={mcN} onValue={setMcN} />
            </label>
            <button type="button" className="btn btn-fire" disabled={goal <= pin} onClick={monteCarlo}>
              {n0(mcN)}번 돌려 평균 보기
            </button>
            {mcRes?.sig === now && (
              <>
                <Tally t={mcRes.avg} />
                <Note>
                  스톤이 가장 적게 든 경우 {n0(mcRes.best)}, 가장 많이 든 경우 {n0(mcRes.worst)}입니다.
                </Note>
              </>
            )}
          </>
        )}
        {mode === 'opt' && (
          <>
            <label className="inline-field">
              <span>1빕의 스톤 값</span>
              <NumInput min={0} value={bipStone} onValue={setBipStone} />
              <small>스톤</small>
            </label>
            <Note>큐브 단가와 1빕의 스톤 값을 넣어야 비용을 제대로 비교합니다. 비워 두면 큐브를 공짜로 봅니다.</Note>
            <button type="button" className="btn btn-fire" disabled={goal <= pin} onClick={optimize}>
              가장 싼 큐브 조합 찾기
            </button>
            {optRes?.sig === now && <p className="info">위 큐브 전략에 적용했습니다. 평균 비용은 스톤 환산 {n0(optRes.cost)}입니다.</p>}
          </>
        )}
        <div className="table-wrap">
          <table className="table center">
            <thead>
              <tr>
                <th>강화</th>
                <th>큐브</th>
                <th>성공</th>
                <th>유지</th>
                <th>파괴</th>
                <th>스톤</th>
                <th>큐브 빕</th>
              </tr>
            </thead>
            <tbody>
              {enhance.steps.map((s) => {
                const o = stepOdds(s, optsOf(s.to))
                return (
                  <tr key={s.to} className={s.to === level + 1 ? 'hot' : undefined}>
                    <th>+{s.to}</th>
                    <td>{cubeAt(s.to).name}</td>
                    <td className="good">{pctOr(o.success)}</td>
                    <td className="muted">{pctOr(o.stay)}</td>
                    <td className="bad">{pctOr(o.destroy)}</td>
                    <td>{n0(o.stone)}</td>
                    <td>{n0(cubeBip(s.to))}빕</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}

const RZERO = { tries: 0, stone: 0, failures: 0, materials: {} }
function Refine() {
  const [mode, setMode] = useState('manual')
  const [stage, setStage] = useState(0)
  const [prices, setPrices] = useState({ '삼위일체의 구슬': 0, '삼위일체의 심장': 0 })
  const [t, setT] = useState(RZERO)
  const [log, setLog] = useState([])
  const [goal, setGoal] = useState(2)
  const [mcN, setMcN] = useState(MC_DEFAULT)
  const [mc, setMc] = useState(null)
  const cur = REFINES[stage]
  const bip = Object.entries(t.materials).reduce((s, [k, n]) => s + n * (prices[k] ?? 0), 0)
  const add = (r) => {
    const m = { ...t.materials }
    for (const [k, n] of Object.entries(r.materials)) m[k] = (m[k] ?? 0) + n
    setT({ tries: t.tries + r.tries, stone: t.stone + r.stone, failures: t.failures + r.failures, materials: m })
  }
  const once = () => {
    const r = refineOnce(stage)
    add({ tries: 1, stone: r.stone, failures: r.success ? 0 : 1, materials: { [r.material]: 1 } })
    setStage(r.stage)
    setLog([`${cur.result} ${r.success ? '성공' : '실패'}`, ...log].slice(0, LOG_MAX))
  }
  const auto = () => {
    add(refineUntil(stage, goal))
    setStage(goal)
    setLog([`${REFINE_STAGES[goal]}까지 자동 재련 완료`, ...log].slice(0, LOG_MAX))
  }
  const monteCarlo = () => {
    const s = { ...RZERO, materials: {} }
    for (let i = 0; i < mcN; i++) {
      const r = refineUntil(stage, goal)
      s.tries += r.tries
      s.stone += r.stone
      s.failures += r.failures
      for (const [k, n] of Object.entries(r.materials)) s.materials[k] = (s.materials[k] ?? 0) + n
    }
    setMc({ tries: s.tries / mcN, stone: s.stone / mcN, materials: Object.fromEntries(Object.entries(s.materials).map(([k, n]) => [k, n / mcN])) })
  }
  const clear = () => {
    setStage(0)
    setT(RZERO)
    setLog([])
    setMc(null)
  }
  return (
    <>
      <Panel title="삼위일체 재련 정보" icon="💎">
        <div className="two-col tight">
          {REFINES.map((r, i) => (
            <div key={r.result} className="refine-card">
              <ItemImg src={itemImageByName(r.result)} fallback="💎" />
              <div>
                <h3>{r.result}</h3>
                <p className="muted small">{r.place}</p>
                <div className="tags">
                  <span className={i === 0 ? 'tag good' : 'tag warn'}>성공 {r.rate}%</span>
                  <span className="tag">{n0(r.stone)} ST</span>
                  <span className="tag">+ {r.material}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="info">ℹ️ 재련에 실패하면 재료(구슬/심장)는 사라지지만 본체(삼위일체/改)는 남습니다.</p>
      </Panel>
      <Panel title="재료 단가 (빕)" icon="🔮">
        <div className="field-row">
          {REFINES.map((r) => (
            <label key={r.material}>
              <span>{r.material}</span>
              <NumInput min={0} value={prices[r.material]} onValue={(v) => setPrices({ ...prices, [r.material]: v })} />
            </label>
          ))}
        </div>
      </Panel>
      <Panel title="재련 시뮬레이션" icon="🔨">
        <Seg options={['manual', 'auto', 'mc']} value={mode} onChange={setMode} render={(m) => ({ manual: '🎲 수동', auto: '⚡ 자동', mc: '📊 몬테카를로' })[m]} label="재련 방식" />
        <p className="sub">지금 단계</p>
        <Seg options={[0, 1, 2]} value={stage} onChange={setStage} render={(i) => REFINE_STAGES[i]} label="지금 단계" />
        <div className="level-stage">
          <span>현재 단계</span>
          <ItemImg src={itemImageByName(REFINE_STAGES[stage])} fallback="💎" />
          <strong className="name">{REFINE_STAGES[stage]}</strong>
        </div>
        {mode === 'manual' &&
          (cur ? (
            <>
              <div className="next-box">
                <p className="sub">다음 재련: {cur.result}</p>
                <OddsBar success={cur.rate} stay={0} destroy={100 - cur.rate} refine />
                <p className="small">
                  스톤 <b className="gold">{n0(cur.stone)}</b> · 재료 <b>{cur.material}</b> · 재료 단가 <b>{n0(prices[cur.material])}빕</b>
                </p>
              </div>
              <div className="btn-row">
                <button type="button" className="btn btn-fire" onClick={once}>
                  {cur.result} 재련
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setStage(0)}>
                  ↺ 처음으로
                </button>
                <button type="button" className="btn btn-ghost danger" onClick={clear}>
                  전체 초기화
                </button>
              </div>
            </>
          ) : (
            <div className="btn-row">
              <p className="info">마지막 단계입니다.</p>
              <button type="button" className="btn btn-ghost" onClick={() => setStage(0)}>
                ↺ 처음으로
              </button>
              <button type="button" className="btn btn-ghost danger" onClick={clear}>
                전체 초기화
              </button>
            </div>
          ))}
        {mode !== 'manual' && (
          <label className="inline-field">
            <span>목표 단계</span>
            <select value={goal} onChange={(e) => setGoal(Number(e.target.value))}>
              <option value={1}>{REFINE_STAGES[1]}</option>
              <option value={2}>{REFINE_STAGES[2]}</option>
            </select>
          </label>
        )}
        {mode === 'auto' && (
          <button type="button" className="btn btn-fire" disabled={goal <= stage} onClick={auto}>
            {REFINE_STAGES[goal]}까지 자동 재련
          </button>
        )}
        {mode === 'mc' && (
          <>
            <label className="inline-field">
              <span>반복 횟수</span>
              <NumInput min={1} max={MC_MAX} value={mcN} onValue={setMcN} />
            </label>
            <button type="button" className="btn btn-fire" disabled={goal <= stage} onClick={monteCarlo}>
              {n0(mcN)}번 돌려 평균 보기
            </button>
            {mc && (
              <p className="info">
                평균 {mc.tries.toFixed(1)}회 시도, 스톤 {n0(mc.stone)}, 구슬 {(mc.materials['삼위일체의 구슬'] ?? 0).toFixed(1)}개, 심장 {(mc.materials['삼위일체의 심장'] ?? 0).toFixed(1)}개
              </p>
            )}
          </>
        )}
        <Tally t={{ tries: t.tries, stone: t.stone, bip, destroys: t.failures }} bipLabel="총 빕 (재료)" lossLabel="실패 횟수" />
        <div className="tiles">
          {REFINES.map(({ material }) => (
            <Stat key={material} label={`소모 ${material}`} value={t.materials[material] ?? 0} />
          ))}
        </div>
        <h3 className="sub">📜 재련 로그</h3>
        {log.length === 0 ? (
          <p className="empty">재련 기록이 여기에 쌓입니다</p>
        ) : (
          <ol className="log">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  )
}

export default function EnhancePage() {
  const [refine, setRefine] = useState(false)
  return (
    <div className="stack wide">
      <p className="banner">⚠️ 실제 확률과 다를 수 있으니 재미로만 써 주세요</p>
      <Seg options={[false, true]} value={refine} onChange={setRefine} render={(r) => (r ? '💎 삼위일체 재련' : '⚔️ 일반 강화')} label="강화 종류" />
      {refine ? <Refine /> : <Upgrade />}
    </div>
  )
}
