import { useEffect, useState } from 'react'
import { pets } from '../lib/data'
import { attrMultiplier, attrOutlook, turnOutlook } from '../lib/battle'
import { statAtLevel } from '../lib/hwan'
import { copyText, store } from '../lib/format'
import { NumInput, Panel, PetImg, PetPicker, Seg } from '../components/ui'

/* ---------------- 듀얼 도우미 ---------------- */
const TEAM = 5
const HITS = [10, 20, 50, 100, 200, 500]
const TEAMS_KEY = 'hellstone-duel-teams'
const emptyTeam = () => Array(TEAM).fill(null)

function TeamBox({ title, team, saved, onChange, onSave }) {
  const [name, setName] = useState('')
  const filled = team.filter(Boolean).length
  const setAt = (i, v) => onChange(team.map((x, k) => (k === i ? v : x)))
  const load = (n) => {
    const t = saved[n]
    if (!t) return
    onChange(
      t.map((s) => {
        const p = s && pets.find((x) => x.name === s.name)
        return p && s ? { pet: p, agi: s.agi } : null
      }),
    )
  }
  return (
    <div className="duel-box">
      <div className="duel-head">
        <h3>{title}</h3>
        <span className="pill">
          {filled}/{TEAM}
        </span>
        <span className="grow" />
        <select aria-label={`${title} 저장된 팀`} value="" onChange={(e) => load(e.target.value)}>
          <option value="">{Object.keys(saved).length > 0 ? '저장된 팀 불러오기' : '저장된 팀 없음'}</option>
          {Object.keys(saved).map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <input className="text-in" aria-label={`${title} 새 팀 이름`} placeholder="새 팀 이름" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          type="button"
          className="btn btn-fire btn-sm"
          disabled={!name.trim() || filled === 0}
          onClick={() => {
            onSave(name.trim())
            setName('')
          }}
        >
          💾 저장
        </button>
      </div>
      <div className="duel-slots">
        {team.map((s, i) =>
          s ? (
            <div key={i} className="duel-tile is-on">
              <button type="button" className="x-btn" aria-label={`${s.pet.name} 빼기`} onClick={() => setAt(i, null)}>
                ×
              </button>
              <PetImg pet={s.pet} />
              <b>{s.pet.name}</b>
              <label>
                순 <NumInput min={0} aria-label={`${s.pet.name} 순발`} value={s.agi} onValue={(v) => setAt(i, { ...s, agi: v })} />
              </label>
            </div>
          ) : (
            <div key={i} className="duel-tile">
              <span className="plus">+</span>
              <PetPicker label={`${title} ${i + 1}번`} placeholder="초성 검색" onPick={(p) => setAt(i, { pet: p, agi: statAtLevel(p.agi, 140) })} />
            </div>
          ),
        )}
      </div>
    </div>
  )
}
function Matrix({ mine, theirs, cell }) {
  return (
    <div className="table-wrap">
      <table className="table center">
        <thead>
          <tr>
            <th>내 펫 / 상대</th>
            {theirs.map((t, i) => (
              <th key={i}>{t.pet.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mine.map((m, r) => (
            <tr key={r}>
              <th>{m.pet.name}</th>
              {theirs.map((t, c) => {
                const { text, outlook } = cell(m, t)
                return (
                  <td key={c} data-outlook={outlook ?? text}>
                    {text}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export function DuelPage() {
  const [foes, setFoes] = useState(emptyTeam)
  const [mine, setMine] = useState(emptyTeam)
  const [shown, setShown] = useState(false)
  const [hits, setHits] = useState([])
  const [target, setTarget] = useState('')
  const [dmg, setDmg] = useState(0)
  const [saved, setSaved] = useState(() => store.get(TEAMS_KEY, {}))
  const f = foes.filter(Boolean)
  const m = mine.filter(Boolean)
  const ready = f.length > 0 && m.length > 0
  const targets = [...Array.from({ length: TEAM }, (_, i) => `캐릭터 ${i + 1}`), ...f.map((s, i) => `${i + 1}번 ${s.pet.name}`)]
  const dealt = (t) => hits.filter((h) => h.target === t).reduce((s, h) => s + h.amount, 0)
  const save = (team, name) => {
    const next = { ...saved, [name]: team.map((s) => (s ? { name: s.pet.name, agi: s.agi } : null)) }
    setSaved(next)
    store.set(TEAMS_KEY, next)
  }
  return (
    <div className="stack xwide">
      <Panel title="팀 입력" icon="👥">
        <TeamBox title="🎯 상대 팀" team={foes} saved={saved} onChange={setFoes} onSave={(n) => save(foes, n)} />
        <TeamBox title="⚔️ 내 팀" team={mine} saved={saved} onChange={setMine} onSave={(n) => save(mine, n)} />
        <div className="btn-row">
          <button type="button" className="btn btn-fire" disabled={!ready} onClick={() => setShown(true)}>
            분석 시작
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setFoes(emptyTeam())
              setMine(emptyTeam())
              setShown(false)
              setHits([])
              setTarget('')
              setDmg(0)
            }}
          >
            전체 초기화
          </button>
        </div>
      </Panel>
      {shown && ready && (
        <>
          <Panel title="속성 상성" icon="🔥">
            <Matrix
              mine={m}
              theirs={f}
              cell={(a, b) => {
                const x = attrMultiplier(a.pet.attrs, b.pet.attrs)
                return { text: `×${x.toFixed(2)} ${attrOutlook(x)}`, outlook: attrOutlook(x) }
              }}
            />
          </Panel>
          <Panel title="선턴 예측" icon="⚡">
            <Matrix mine={m} theirs={f} cell={(a, b) => ({ text: turnOutlook(a.agi, b.agi) })} />
          </Panel>
          <Panel title="HP 트래커" icon="❤️">
            <div className="chip-row" role="group" aria-label="대상">
              {targets.map((t) => (
                <button key={t} type="button" className="chip" aria-pressed={target === t} onClick={() => setTarget(t)}>
                  {t} ({dealt(t)})
                </button>
              ))}
            </div>
            <div className="chip-row" role="group" aria-label="데미지">
              {HITS.map((h) => (
                <button key={h} type="button" className="chip" onClick={() => setDmg(dmg + h)}>
                  +{h}
                </button>
              ))}
            </div>
            <div className="btn-row">
              <NumInput min={0} aria-label="데미지" value={dmg} onValue={setDmg} />
              <button
                type="button"
                className="btn btn-fire"
                disabled={!target || dmg <= 0}
                onClick={() => {
                  setHits([...hits, { target, amount: dmg }])
                  setDmg(0)
                }}
              >
                타격
              </button>
              <button type="button" className="btn btn-ghost" disabled={hits.length === 0} onClick={() => setHits(hits.slice(0, -1))}>
                ↩ 되돌리기
              </button>
              <button type="button" className="btn btn-ghost danger" onClick={() => setHits([])}>
                초기화
              </button>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}

/* ---------------- 듀얼 오더 도우미 ---------------- */
const NUMS = [1, 2, 3, 4, 5]
const CHAR_ACTS = ['일공', '가드']
const PET_ACTS = ['일공', '가드', '배진', '충견', '가블']
const LINE_LIMIT = 50
const ORDER_KEY = 'hellstone-duel-order'
const NONE = { kind: null, target: null }
const emptyOrders = () => NUMS.map(() => ({ char: NONE, pet: NONE }))
const emptyLine = () => NUMS.map(() => '')
// 줄서기 번호 4-2-1-3-5 가 전투 1~5번이 된다
const BATTLE_ORDER = [4, 2, 1, 3, 5]
const toBattle = (line) => BATTLE_ORDER.map((n) => line[n - 1])
const targetKey = (t) => (t ? `${t.unit}:${t.slot}` : '')
const parseTarget = (s) => {
  if (!s) return null
  const [unit, slot] = s.split(':')
  return { unit, slot: Number(slot) }
}
const orderText = ({ kind, target }) => (kind ? (target ? `${target.slot}${target.unit} ${kind}` : kind) : '미입력')
function grouped(orders) {
  const rows = orders.map(({ char, pet }, i) => ({ label: `${i + 1}번`, char: orderText(char), pet: orderText(pet) }))
  const key = (r) => `${r.char}/${r.pet}`
  const count = new Map()
  for (const r of rows) count.set(key(r), (count.get(key(r)) ?? 0) + 1)
  const [topKey, topN] = [...count.entries()].sort(([, a], [, b]) => b - a)[0]
  if (topN === rows.length) return [{ ...rows[0], label: '전원' }]
  if (topN < 2) return rows
  const sample = rows.find((r) => key(r) === topKey)
  return [...rows.filter((r) => key(r) !== topKey), { ...sample, label: '나머지' }]
}
const oneLine = (orders) => grouped(orders).map(({ label, char, pet }) => `${label}: ${char}/${pet}`).join(' | ')
const discordText = (orders) => grouped(orders).map(({ label, char, pet }) => `【${label}】\n캐릭: ${char}\n펫: ${pet}`).join(' ')

function OrderPick({ label, actions, order, enemyNames, onChange }) {
  const aimed = order.kind !== null && order.kind !== '가드'
  return (
    <div className="order-pick">
      <select
        aria-label={`${label} 행동`}
        value={order.kind ?? ''}
        onChange={(e) => {
          const k = e.target.value || null
          onChange({ kind: k, target: k && k !== '가드' ? order.target : null })
        }}
      >
        <option value="">미입력</option>
        {actions.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      {aimed && (
        <select aria-label={`${label} 목표`} value={targetKey(order.target)} onChange={(e) => onChange({ ...order, target: parseTarget(e.target.value) })}>
          <option value="">목표</option>
          {['캐릭', '펫'].flatMap((u) =>
            NUMS.map((n, i) => (
              <option key={`${u}${n}`} value={`${u}:${n}`}>
                {n}
                {u}
                {enemyNames[i] ? ` ${enemyNames[i]}` : ''}
              </option>
            )),
          )}
        </select>
      )}
    </div>
  )
}
function LineBoard({ title, side, names, onChange }) {
  const order = side === 'left' ? [...NUMS].reverse() : NUMS
  return (
    <div className={`line-board is-${side}`}>
      <div className="line-head">
        <h3>{title}</h3>
        <span className="muted small">화면 {side === 'left' ? '왼쪽' : '오른쪽'} 줄</span>
      </div>
      <div className="line-slots">
        {order.map((n) => (
          <label key={n}>
            <small className={n === 1 ? 'leader' : undefined}>{n === 1 ? '1번 · 리더' : `${n}번`}</small>
            <input className="text-in" aria-label={`${title} ${n}번`} value={names[n - 1]} onChange={(e) => onChange(names.map((x, k) => (k === n - 1 ? e.target.value : x)))} />
          </label>
        ))}
      </div>
    </div>
  )
}
function Preview({ title, names, tone }) {
  const b = toBattle(names)
  const lines = toBattle(NUMS)
  return (
    <>
      <p className={`preview-title ${tone}`}>{title}</p>
      <div className="preview-row">
        {b.map((n, i) => (
          <div key={i}>
            <b>전투 {i + 1}번</b>
            <small>
              {n || '미입력'} · 줄 {lines[i]}번
            </small>
          </div>
        ))}
      </div>
    </>
  )
}
export function OrderPage() {
  const [step, setStep] = useState('line')
  const [weLeft, setWeLeft] = useState(true)
  const [us, setUs] = useState(emptyLine)
  const [them, setThem] = useState(emptyLine)
  const [orders, setOrders] = useState(emptyOrders)
  const [copied, setCopied] = useState('')
  const [msg, setMsg] = useState('')
  const usB = toBattle(us)
  const themB = toBattle(them)
  const line = oneLine(orders)
  const discord = discordText(orders)
  useEffect(() => {
    if (step === 'battle') store.set(ORDER_KEY, { myLine: us, enemyLine: them, orders })
  }, [step, us, them, orders])
  const setOrder = (i, who, v) => {
    setCopied('')
    setOrders(orders.map((o, k) => (k === i ? { ...o, [who]: v } : o)))
  }
  const copy = async (what, text) => setCopied((await copyText(text)) ? what : '복사 실패')
  const loadLast = (go) => {
    const v = store.get(ORDER_KEY, null)
    if (!v) return setMsg('저장된 명단이 없습니다')
    setUs(v.myLine)
    setThem(v.enemyLine)
    setOrders(v.orders)
    setMsg('')
    if (go) setStep('battle')
  }
  return (
    <div className="stack wide order-page">
      <section className="panel order-title">
        <span className="order-logo">DUEL</span>
        <div>
          <h2>듀얼 오더 도우미</h2>
          <p className="muted">전투 전 명단 치환 · 오더 입력 · 한 줄 출력</p>
        </div>
      </section>
      {step === 'line' ? (
        <Panel title="1. 전투 전 줄서기 명단" icon="📋">
          <p className="muted small">전투 전에 보이는 줄서기 번호대로 넣으세요. 전투에 들어가면 4-2-1-3-5 순서가 왼쪽부터 전투 1~5번이 됩니다.</p>
          <Seg options={[true, false]} value={weLeft} onChange={setWeLeft} render={(l) => (l ? '우리 팀 왼쪽 줄' : '우리 팀 오른쪽 줄')} label="우리 팀 위치" />
          <div className="line-boards">
            {weLeft ? <LineBoard title="우리 팀" side="left" names={us} onChange={setUs} /> : <LineBoard title="상대 팀" side="left" names={them} onChange={setThem} />}
            <b className="vs">VS</b>
            {weLeft ? <LineBoard title="상대 팀" side="right" names={them} onChange={setThem} /> : <LineBoard title="우리 팀" side="right" names={us} onChange={setUs} />}
          </div>
          <p className="muted small">
            왼쪽 팀은 화면처럼 <b>5-4-3-2-1(리더)</b>, 오른쪽 팀은 <b>1(리더)-2-3-4-5</b> 순서로 칸을 놓았습니다.
          </p>
          <div className="preview">
            <h3>전투 번호 미리보기</h3>
            <Preview title="우리 팀" names={us} tone="mine" />
            <Preview title="상대 팀" names={them} tone="foe" />
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-ghost" onClick={() => loadLast(false)}>
              최근 명단 불러오기
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setUs(emptyLine())
                setThem(emptyLine())
              }}
            >
              명단 초기화
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => loadLast(true)}>
              진행 중 전투 이어하기
            </button>
            {msg && <span className="muted small">{msg}</span>}
            <span className="grow" />
            <button type="button" className="btn btn-fire" onClick={() => setStep('battle')}>
              전투 화면으로 →
            </button>
          </div>
        </Panel>
      ) : (
        <Panel
          title="2. 전투 오더"
          icon="⚔️"
          aside={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('line')}>
              ← 명단으로
            </button>
          }
        >
          <p className="muted small">아래 번호는 전투 번호입니다. 행동과 목표를 고르면 인게임 한 줄이 바로 만들어집니다.</p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>전투 번호</th>
                  <th>캐릭</th>
                  <th>펫</th>
                </tr>
              </thead>
              <tbody>
                {NUMS.map((n, i) => (
                  <tr key={n}>
                    <th>
                      {n}번 {usB[i]}
                    </th>
                    <td>
                      <OrderPick label={`${n}번 캐릭`} actions={CHAR_ACTS} order={orders[i].char} enemyNames={themB} onChange={(v) => setOrder(i, 'char', v)} />
                    </td>
                    <td>
                      <OrderPick label={`${n}번 펫`} actions={PET_ACTS} order={orders[i].pet} enemyNames={themB} onChange={(v) => setOrder(i, 'pet', v)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="block-field">
            <span>
              인게임 한 줄 ({line.length} / 약 {LINE_LIMIT}자)
            </span>
            <input className={line.length > LINE_LIMIT ? 'text-in over' : 'text-in'} readOnly value={line} />
          </label>
          <div className="btn-row">
            <button type="button" className="btn btn-fire" onClick={() => copy('한 줄', line)}>
              {copied === '한 줄' ? '한 줄 복사됨' : '한 줄 복사'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => copy('디스코드', discord)}>
              {copied === '디스코드' ? '디스코드 복사됨' : '디스코드용 복사'}
            </button>
            <button
              type="button"
              className="btn btn-ghost danger"
              onClick={() => {
                setCopied('')
                setOrders(emptyOrders())
              }}
            >
              오더 초기화
            </button>
            {copied === '복사 실패' && <span className="muted small">이 브라우저에서는 복사할 수 없습니다</span>}
          </div>
          <pre className="order-detail">{discord}</pre>
        </Panel>
      )}
    </div>
  )
}
