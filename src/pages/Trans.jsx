import { useEffect, useRef, useState } from 'react'
import { pets } from '../lib/data'
import { runGrid, searchPlans, searchPlansSync } from '../lib/trans'
import { shortUnits, store } from '../lib/format'
import { Modal, NumInput, Note, Panel, PetImg, Seg, Stat } from '../components/ui'

const STAGES = ['0→1환', '1→2환', '2→3환', '3→4환', '4→5환']
const STATS = ['체력', '완력', '건강', '순발']
const TYPES = [
  { label: '순캐', main: 3 },
  { label: '완캐', main: 1 },
  { label: '건캐', main: 2 },
  { label: '체캐', main: 0 },
]
const QUESTS = [10, 20, 30, 40, 50]
const QUEST_MAX = 50
const SAVE_KEY = 'hellstone-trans'
const LAST_KEY = 'hellstone-trans-last'
const FAIL = '목표 환포를 달성하는 플랜을 찾지 못했습니다. 목표를 낮추거나 고정 값을 조정하세요.'
const SLICE_MS = 30
const EMPTY = { value: null, auto: false }
const DEFAULTS = { type: 0, target: 179, mins: [0, 0, 0, 0] }

const blankGrid = () => ({
  levels: Array.from({ length: 5 }, () => EMPTY),
  allocs: Array.from({ length: 5 }, () => Array.from({ length: 4 }, () => EMPTY)),
  quests: [...QUESTS],
})
const fixedOf = (c) => (c.auto ? null : c.value)
const toInput = ({ settings, grid }) => ({
  main: TYPES[settings.type].main,
  target: settings.target,
  mins: settings.mins,
  stages: grid.levels.map((l, i) => ({ level: fixedOf(l), alloc: grid.allocs[i].map(fixedOf), quest: grid.quests[i] })),
})
const fillAuto = (grid, plan) => {
  const fill = (c, v) => (c.auto || c.value === null ? { value: v, auto: true } : c)
  return {
    levels: grid.levels.map((c, i) => fill(c, plan.levels[i])),
    allocs: grid.allocs.map((row, i) => row.map((c, k) => fill(c, plan.allocs[i][k]))),
    quests: grid.quests,
  }
}
const clearAuto = (grid) => ({
  levels: grid.levels.map((c) => (c.auto ? EMPTY : c)),
  allocs: grid.allocs.map((row) => row.map((c) => (c.auto ? EMPTY : c))),
  quests: grid.quests,
})
const isCell = (c) => typeof c === 'object' && !!c && 'auto' in c && 'value' in c
const load = (key) => {
  const v = store.get(key, null)
  return v?.settings && v.grid && v.grid.levels?.every(isCell) ? { settings: v.settings, grid: v.grid, plans: v.plans ?? null } : null
}
function firstState() {
  const last = load(LAST_KEY)
  if (last) return { ...last, settings: DEFAULTS }
  const s = { settings: DEFAULTS, grid: blankGrid(), plans: null }
  const { exp, balanced } = searchPlansSync(toInput(s))
  return exp ? { settings: DEFAULTS, grid: fillAuto(s.grid, exp), plans: { exp, balanced, mode: 'exp' } } : s
}
const resetText = (n) => `${n}회 (${(n * 500).toLocaleString('ko-KR')}빕)`
const planText = (p) => `${p.total}포 · ${shortUnits(p.exp)} · ${p.resets > 0 ? `리셋 ${resetText(p.resets)}` : '리셋 0'}`

function Cell({ cell, onValue, label, max }) {
  const [draft, setDraft] = useState(null)
  return (
    <input
      type="number"
      className={cell.auto ? 'grid-in is-auto' : 'grid-in'}
      aria-label={label}
      min={0}
      max={max}
      value={draft ?? cell.value ?? ''}
      onChange={(e) => {
        const t = e.target.value
        setDraft(t)
        if (t === '') onValue(null)
        else if (Number.isFinite(Number(t))) onValue(Math.min(max ?? Infinity, Math.max(0, Math.floor(Number(t)))))
      }}
      onBlur={() => setDraft(null)}
    />
  )
}

export default function TransPage() {
  const [state, setState] = useState(firstState)
  const [showSettings, setShowSettings] = useState(true)
  const [showDetail, setShowDetail] = useState(true)
  const [help, setHelp] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [error, setError] = useState('')
  const [toasts, setToasts] = useState([])
  const [search, setSearch] = useState(null)
  const timer = useRef(0)
  const toastId = useRef(0)
  const { settings, grid, plans } = state
  const rows = runGrid(grid.levels.map((l, i) => ({ level: l.value, alloc: grid.allocs[i].map((c) => c.value), quest: grid.quests[i] })))
  const plan = plans ? (plans.mode === 'balanced' && plans.balanced ? plans.balanced : plans.exp) : null

  // 탐색 중에는 펫 그림을 돌려 보여 준다
  useEffect(() => {
    if (!search) return
    const id = setInterval(() => setSearch((s) => s && { ...s, pet: pets[Math.floor(Math.random() * pets.length)] }), 2500)
    return () => clearInterval(id)
  }, [search !== null]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), [])

  const toast = (text) => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }
  const setSettings = (patch) => setState({ ...state, settings: { ...settings, ...patch } })
  const setCell = (stat, stage, value) => {
    const cell = { value, auto: false }
    setState({
      ...state,
      grid:
        stat === 'level'
          ? { ...grid, levels: grid.levels.map((c, i) => (i === stage ? cell : c)) }
          : { ...grid, allocs: grid.allocs.map((row, i) => (i === stage ? row.map((c, k) => (k === stat ? cell : c)) : row)) },
    })
  }
  const setQuest = (i, v) => setState({ ...state, grid: { ...grid, quests: grid.quests.map((q, k) => (k === i ? v : q)) } })
  const finish = (from, res) => {
    setSearch(null)
    if (!res.exp) {
      setError(FAIL)
      setState({ ...from, grid: clearAuto(from.grid), plans: null })
      return
    }
    const next = { ...from, grid: fillAuto(clearAuto(from.grid), res.exp), plans: { exp: res.exp, balanced: res.balanced, mode: 'exp' } }
    setState(next)
    store.set(LAST_KEY, next)
  }
  const autoCalc = () => {
    const from = state
    const it = searchPlans(toInput(from))
    setError('')
    setSearch({ checked: 0, pet: pets[Math.floor(Math.random() * pets.length)] })
    const step = () => {
      const until = performance.now() + SLICE_MS
      let r = it.next()
      while (!r.done && performance.now() < until) r = it.next()
      if (r.done) return finish(from, r.value)
      setSearch((s) => s && { ...s, checked: r.value })
      timer.current = setTimeout(step, 0)
    }
    timer.current = setTimeout(step, 30)
  }
  const cancel = () => {
    clearTimeout(timer.current)
    setSearch(null)
  }
  const switchPlan = (mode) => {
    if (!plans) return
    const p = mode === 'balanced' && plans.balanced ? plans.balanced : plans.exp
    const next = { ...state, grid: fillAuto(grid, p), plans: { ...plans, mode } }
    setState(next)
    store.set(LAST_KEY, next)
  }

  return (
    <div className="stack wide">
      <Panel
        title="설정"
        icon="⚙️"
        aside={
          <div className="head-tools">
            <span className="pill">{TYPES[settings.type].label}</span>
            <span className="pill">{settings.target}포</span>
            <button type="button" className="btn btn-ghost btn-sm" aria-expanded={showSettings} onClick={() => setShowSettings(!showSettings)}>
              {showSettings ? '접기' : '펴기'}
            </button>
          </div>
        }
      >
        {showSettings && (
          <div className="form-rows">
            <div className="form-row">
              <span>캐릭터 타입</span>
              <Seg options={TYPES.map((_, i) => i)} value={settings.type} render={(i) => TYPES[i].label} onChange={(t) => setSettings({ type: t })} label="캐릭터 타입" />
            </div>
            <label className="form-row">
              <span>목표 환포</span>
              <NumInput min={0} value={settings.target} onValue={(v) => setSettings({ target: v })} />
              <small>포</small>
            </label>
            <div className="form-row">
              <span>최소 스탯</span>
              <div className="mins">
                {STATS.map((s, i) => (
                  <label key={s}>
                    <small>{s}</small>
                    <NumInput min={0} value={settings.mins[i]} onValue={(v) => setSettings({ mins: settings.mins.map((x, k) => (k === i ? v : x)) })} />
                  </label>
                ))}
              </div>
            </div>
            <Note>0이면 제한 없음. 그리드에 직접 입력한 값이 우선합니다.</Note>
          </div>
        )}
      </Panel>

      <Panel
        title="환포 시뮬레이션"
        icon="🧮"
        aside={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHelp(true)}>
            ❓ 사용법
          </button>
        }
      >
        <Note>값을 넣으면 바로 계산됩니다. 비워 둔 칸은 자동 계산이 최적값으로 채웁니다(금색).</Note>
        <div className="table-wrap">
          <table className="table trans-grid">
            <thead>
              <tr>
                <th aria-label="항목" />
                {STAGES.map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>초기 스탯</th>
                {rows.map((r, i) => (
                  <td key={i} className="accent">
                    {r.start}
                  </td>
                ))}
              </tr>
              <tr className="soft">
                <th>레벨</th>
                {grid.levels.map((c, i) => (
                  <td key={i}>
                    <Cell cell={c} label={`${STAGES[i]} 레벨`} max={140} onValue={(v) => setCell('level', i, v)} />
                  </td>
                ))}
              </tr>
              {STATS.map((s, k) => (
                <tr key={s} className="soft">
                  <th>{s}</th>
                  {grid.allocs.map((row, i) => (
                    <td key={i}>
                      <Cell cell={row[k]} label={`${STAGES[i]} ${s}`} onValue={(v) => setCell(k, i, v)} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th>총스탯</th>
                {rows.map((r, i) => (
                  <td key={i}>{r.available > 0 ? r.available : ''}</td>
                ))}
              </tr>
              <tr>
                <th>남은스탯</th>
                {rows.map((r, i) => (
                  <td key={i} className={r.available > 0 && r.left !== 0 ? 'bad' : undefined}>
                    {r.available > 0 ? r.left : ''}
                  </td>
                ))}
              </tr>
              <tr className="soft divider">
                <th>환포퀘</th>
                {grid.quests.map((q, i) => (
                  <td key={i}>
                    <Cell cell={{ value: q, auto: false }} label={`${STAGES[i]} 환포퀘`} max={QUEST_MAX} onValue={(v) => setQuest(i, v)} />
                  </td>
                ))}
              </tr>
              <tr>
                <th>환포값</th>
                {rows.map((r, i) => (
                  <td key={i} className="accent">
                    {r.value ?? ''}
                  </td>
                ))}
              </tr>
              {showDetail &&
                STATS.map((s, k) => (
                  <tr key={s} className="detail">
                    <th>결과 {s}</th>
                    {rows.map((r, i) => (
                      <td key={i}>
                        {r.results && (
                          <>
                            {Math.floor(r.results[k] / 100)}
                            <small>.{String(r.results[k] % 100).padStart(2, '0')}</small>
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              <tr className="total">
                <th>총 환포</th>
                {rows.map((r, i) => (
                  <td key={i}>{r.total ?? ''}</td>
                ))}
              </tr>
              <tr>
                <th>경험치</th>
                {rows.map((r, i) => (
                  <td key={i} className="accent" title={r.exp ? r.exp.toLocaleString('ko-KR') : undefined}>
                    {r.exp ? shortUnits(r.exp) : ''}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowDetail(!showDetail)}>
          {showDetail ? '▾' : '▸'} 결과 스탯 상세
        </button>
        {plans && plan && (
          <>
            <div className="plan-toggle">
              <Seg
                options={['exp', 'balanced']}
                value={plans.mode}
                onChange={(m) => (m === 'balanced' && !plans.balanced ? null : switchPlan(m))}
                render={(m) => (m === 'exp' ? '경험치 최적' : plans.balanced ? '리셋 절약' : '리셋 절약 (같음)')}
                label="플랜"
              />
              <span className="muted small">{planText(plan)}</span>
            </div>
            <div className="tiles">
              <Stat label="총 환포" value={`${plan.total}포`} tone="fire" />
              <Stat label="총 경험치" value={shortUnits(plan.exp)} />
              <Stat label="리셋" value={plan.resets > 0 ? resetText(plan.resets) : '없음'} />
            </div>
          </>
        )}
        <div className="btn-row">
          <button type="button" className="btn btn-gold" onClick={autoCalc} disabled={search !== null}>
            자동 계산
          </button>
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={() => toast(store.set(SAVE_KEY, state) ? '저장했습니다' : '이 브라우저에서는 저장할 수 없습니다')}>
            저장
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const v = load(SAVE_KEY)
              if (v) {
                setState(v)
                setError('')
                toast('불러왔습니다')
              } else toast('저장된 값이 없습니다')
            }}
          >
            불러오기
          </button>
          <button type="button" className="btn btn-ghost danger" onClick={() => setConfirmReset(true)}>
            초기화
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </Panel>

      {toasts.length > 0 && (
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="toast">
              {t.text}
            </div>
          ))}
        </div>
      )}
      {confirmReset && (
        <Modal label="초기화 확인" onClose={() => setConfirmReset(false)}>
          <p className="center">모든 입력값을 초기화할까요?</p>
          <div className="btn-row center">
            <button
              type="button"
              className="btn btn-fire"
              onClick={() => {
                setConfirmReset(false)
                setError('')
                setState({ settings, grid: blankGrid(), plans: null })
              }}
            >
              확인
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
              취소
            </button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal label="사용법" onClose={() => setHelp(false)} wide>
          <h2>📖 사용법</h2>
          <div className="prose">
            <p>
              <b>캐릭터 타입</b>: 주력 스탯을 고릅니다. 순캐=순발, 완캐=완력, 건캐=건강, 체캐=체력
            </p>
            <p>
              <b>목표 환포</b>: 5환까지 모을 총 환생포인트 (만포=179)
            </p>
            <p>
              <b>최소 스탯</b>: 매 환생마다 이 값 이상 보장합니다. 0이면 제한 없음.
            </p>
            <p>
              <b>그리드 직접 입력</b>: 특정 환생의 레벨·스탯을 고정합니다. 최소 스탯보다 우선합니다.
            </p>
            <p>
              <b>자동 계산</b>: 설정에 맞는 최적 플랜을 찾아 비어 있는 칸을 채웁니다. 이전 환생 결과가 다음 환생 시작 스탯이 됩니다. 리셋은 500빕으로 스탯 3개를 깎는 것입니다.
            </p>
            <p>
              <b>경험치 최적 / 리셋 절약</b>: 경험치가 가장 적은 플랜과, 리셋 비용을 줄인 플랜을 비교합니다.
            </p>
            <p>
              <b>저장/불러오기</b>: 그리드를 이 브라우저에 저장합니다. 마지막 자동 계산 결과는 다시 열어도 복원됩니다.
            </p>
          </div>
        </Modal>
      )}
      {search && (
        <div className="loading" role="status" aria-live="polite">
          <div className="loading-box">
            <PetImg pet={search.pet} className="spin-in" key={search.pet.name} />
            <b>{search.pet.name}</b>
            <div className="loading-bar" />
            <p>{search.checked > 0 ? `탐색 중… (${search.checked.toLocaleString('ko-KR')}개 조합 확인)` : '탐색 준비 중…'}</p>
            <button type="button" className="btn btn-ghost danger" onClick={cancel}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
