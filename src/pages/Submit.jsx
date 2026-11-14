import { useEffect, useMemo, useState } from 'react'
import { ATTR_ICON, ATTRS, attrText, ITEM_CATEGORIES, ITEM_STATS, itemImage, items, pets, SOURCE_TYPES, TIERS } from '../lib/data'
import { calcHwan, fitBase, totalGrowth } from '../lib/hwan'
import { cappedPct } from '../lib/format'
import { IMAGE_TOO_BIG, itemErrors, MAX_IMAGE_BYTES, petErrors } from '../lib/validate'
import { fetchQueue, isLoggedIn, login, logout, review, submitEntry } from '../lib/api'
import { ItemImg, Note, Panel, PetImg, PetPicker } from '../components/ui'

const STATS = [
  { key: 'hp', label: '내구' },
  { key: 'atk', label: '공격' },
  { key: 'def', label: '방어' },
  { key: 'agi', label: '순발' },
]
const isUrl = (s) => /^(https?:)?\//.test(s)
const hasOwnPicture = (p) => !isUrl(p.image ?? '')

function FilePick({ picked, onPick }) {
  return (
    <label className="block-field">
      <span>그림 파일 (gif, png, jpg, webp · 1MB까지)</span>
      <input
        type="file"
        accept=".gif,.png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          if (picked) URL.revokeObjectURL(picked.url)
          const f = e.target.files?.[0]
          onPick(f ? { file: f, url: URL.createObjectURL(f) } : null)
        }}
      />
    </label>
  )
}

/* ---------- 펫 제출 ---------- */
const EMPTY_STATS = { hp: ['', ''], atk: ['', ''], def: ['', ''], agi: ['', ''] }
function PetForm({ onDone }) {
  const [name, setName] = useState('')
  const [tier, setTier] = useState('일반')
  const [attrs, setAttrs] = useState({ 지: '', 수: '', 화: '', 풍: '' })
  const [source, setSource] = useState('')
  const [sourceType, setSourceType] = useState('필드포획')
  const [ride, setRide] = useState(false)
  const [slots, setSlots] = useState('5')
  const [stats, setStats] = useState(EMPTY_STATS)
  const [file, setFile] = useState(null)
  const [shared, setShared] = useState(undefined)
  const [errors, setErrors] = useState([])
  const [busy, setBusy] = useState(false)
  const pair = (k) => [Number(stats[k][0]) || 0, Number(stats[k][1]) || 0]
  const pet = useMemo(
    () => ({
      name: name.trim(),
      ...(shared ? { image: shared } : {}),
      tier,
      attrs: Object.fromEntries(ATTRS.filter((a) => Number(attrs[a]) > 0).map((a) => [a, Number(attrs[a])])),
      source: source.trim(),
      sourceType,
      ride,
      skillSlots: slots === '' ? null : Number(slots),
      total: totalGrowth({ atk: pair('atk'), def: pair('def'), agi: pair('agi') }),
      hp: pair('hp'),
      atk: pair('atk'),
      def: pair('def'),
      agi: pair('agi'),
    }),
    [name, shared, tier, attrs, source, sourceType, ride, slots, stats], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const filled = STATS.every(({ key }) => pet[key][0] > 0 && pet[key][1] > 0)
  const check = useMemo(() => (filled ? calcHwan(pet, [0, 0, 0, 0]) : null), [pet, filled])
  const names = pets.map((p) => p.name)
  const odd = filled && petErrors(pet, names).length === 0 ? fitBase(pet).error : 0
  const setStat = (k, i, v) => setStats({ ...stats, [k]: i === 0 ? [v, stats[k][1]] : [stats[k][0], v] })
  const send = async () => {
    const errs = petErrors(pet, names)
    if (!file && !shared) errs.push('그림을 올리거나 같이 쓸 펫을 고르세요.')
    if (file && file.file.size > MAX_IMAGE_BYTES) errs.push(IMAGE_TOO_BIG)
    setErrors(errs)
    if (errs.length) return
    setBusy(true)
    const r = await submitEntry('pet', pet, file?.file)
    setBusy(false)
    setErrors(r.errors)
    if (r.ok) onDone(pet.name)
  }
  return (
    <div className="split">
      <Panel title="펫 정보" icon="🐾">
        <div className="field-row">
          <label>
            <span>이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span>등급</span>
            <select value={tier} onChange={(e) => setTier(e.target.value)}>
              {TIERS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="field-row">
          <label>
            <span>획득 종류</span>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              {SOURCE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            <span>획득처</span>
            <input value={source} onChange={(e) => setSource(e.target.value)} />
          </label>
          <label>
            <span>기술창</span>
            <input type="number" min={0} value={slots} onChange={(e) => setSlots(e.target.value)} />
          </label>
        </div>
        <fieldset>
          <legend>속성 (합계 10)</legend>
          <div className="field-row four">
            {ATTRS.map((a) => (
              <label key={a}>
                <span>
                  {ATTR_ICON[a]} {a}
                </span>
                <input type="number" min={0} max={10} value={attrs[a]} onChange={(e) => setAttrs({ ...attrs, [a]: e.target.value })} />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="table-wrap">
          <table className="table center">
            <thead>
              <tr>
                <th>능력치</th>
                <th>초기값</th>
                <th>성장률</th>
              </tr>
            </thead>
            <tbody>
              {STATS.map(({ key, label }) => (
                <tr key={key}>
                  <th>{label}</th>
                  <td>
                    <input className="num" type="number" step="0.01" aria-label={`${label} 초기값`} value={stats[key][0]} onChange={(e) => setStat(key, 0, e.target.value)} />
                  </td>
                  <td>
                    <input className="num" type="number" step="0.01" aria-label={`${label} 성장률`} value={stats[key][1]} onChange={(e) => setStat(key, 1, e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>총성장 {pet.total.toFixed(2)}은 공성·방성·순성을 더해 자동으로 넣습니다. 초기값은 S랭크 초기치를 소수 둘째 자리까지 넣어야 환각 계산이 맞습니다.</Note>
        {check &&
          (check.total === 0 ? (
            <Note warn>이 수치로는 환각 계산이 안 됩니다. 초기값을 소수 둘째 자리까지 넣어 주세요.</Note>
          ) : (
            <Note>
              환각 계산 확인: S랭크 스탯 기준 환각 {cappedPct(check.hwanRate)} (매칭 {check.total}건)
            </Note>
          ))}
        {odd > 0.09 && check?.total !== 0 && <Note warn>초기값이 다른 펫들의 규칙과 맞지 않습니다. 오타가 없는지 확인하세요. 그대로 제출할 수는 있습니다.</Note>}
        <FilePick picked={file} onPick={setFile} />
        <PetPicker
          label="그림이 없으면 같이 쓸 펫"
          placeholder="그림을 같이 쓸 펫 (환생 펫 등)"
          selected={shared ? pets.find((p) => (p.image ?? `${p.name}.gif`) === shared)?.name : ''}
          allow={hasOwnPicture}
          onPick={(p) => setShared(p.image ?? `${p.name}.gif`)}
        />
        <label className="check">
          <input type="checkbox" checked={ride} onChange={(e) => setRide(e.target.checked)} /> 탑승 가능
        </label>
        {errors.length > 0 && <p className="error">{errors.join(' ')}</p>}
        <button type="button" className="btn btn-fire btn-block" disabled={busy} onClick={send}>
          {busy ? '보내는 중…' : '승인 요청하기'}
        </button>
      </Panel>
      <Panel title="미리보기" icon="👀">
        <div className="pet-art">
          <span className="badge-new">NEW</span>
          {file ? <img className="pet-img" src={file.url} alt="" /> : shared ? <PetImg pet={{ ...pet, image: shared }} /> : <span className="muted small">그림 없음</span>}
        </div>
        <div className="pet-info">
          <h3>{name || '새 펫'}</h3>
          <p className="muted small">{attrText(pet.attrs) || '속성 없음'}</p>
          <p className="muted small">
            획득: {source || '-'} ({sourceType}) · {ride ? '탑승 가능' : '탑승 불가'} · 기술창 {slots || '?'} · 총성장 {pet.total.toFixed(2)}
          </p>
        </div>
      </Panel>
    </div>
  )
}

/* ---------- 아이템 제출 ---------- */
const EMPTY_ITEM_STATS = Object.fromEntries(ITEM_STATS.map((s) => [s, { value: '', min: '', max: '' }]))
function ItemForm({ onDone }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('무기')
  const [source, setSource] = useState('')
  const [note, setNote] = useState('')
  const [rows, setRows] = useState(EMPTY_ITEM_STATS)
  const [file, setFile] = useState(null)
  const [errors, setErrors] = useState([])
  const [busy, setBusy] = useState(false)
  const statList = () =>
    ITEM_STATS.flatMap((stat) => {
      const { value, min, max } = rows[stat]
      if (value === '') return []
      const s = { stat, value: Number(value) }
      if (min !== '' && max !== '') Object.assign(s, { min: Number(min), max: Number(max) })
      return [s]
    })
  const set = (stat, field, v) => setRows({ ...rows, [stat]: { ...rows[stat], [field]: v } })
  const send = async () => {
    const item = { name: name.trim(), category, stats: statList(), ...(source.trim() ? { source: source.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}) }
    const errs = itemErrors(
      item,
      items.map((i) => i.name),
    )
    if (!file) errs.push('그림을 올려 주세요.')
    if (file && file.file.size > MAX_IMAGE_BYTES) errs.push(IMAGE_TOO_BIG)
    setErrors(errs)
    if (errs.length) return
    setBusy(true)
    const r = await submitEntry('item', item, file.file)
    setBusy(false)
    setErrors(r.errors)
    if (r.ok) onDone(item.name)
  }
  return (
    <div className="split">
      <Panel title="아이템 정보" icon="🗡️">
        <div className="field-row">
          <label>
            <span>이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span>부위</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {ITEM_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="field-row">
          <label>
            <span>획득처</span>
            <input value={source} onChange={(e) => setSource(e.target.value)} />
          </label>
          <label>
            <span>설명 (선택)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        <div className="table-wrap">
          <table className="table center">
            <thead>
              <tr>
                <th>능력치</th>
                <th>값</th>
                <th>최소 (선택)</th>
                <th>최대 (선택)</th>
              </tr>
            </thead>
            <tbody>
              {ITEM_STATS.map((s) => (
                <tr key={s}>
                  <th>{s}</th>
                  {['value', 'min', 'max'].map((f) => (
                    <td key={f}>
                      <input className="num" type="number" aria-label={`${s} ${f}`} value={rows[s][f]} onChange={(e) => set(s, f, e.target.value)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>옵션이 랜덤이면 최소·최대를 넣으세요. 도감에서 옵션 확률을 계산해 줍니다.</Note>
        <FilePick picked={file} onPick={setFile} />
        {errors.length > 0 && <p className="error">{errors.join(' ')}</p>}
        <button type="button" className="btn btn-fire btn-block" disabled={busy} onClick={send}>
          {busy ? '보내는 중…' : '승인 요청하기'}
        </button>
      </Panel>
      <Panel title="미리보기" icon="👀">
        <div className="item-head">
          {file ? <img className="item-img" src={file.url} alt="" /> : <ItemImg src="" fallback="🎁" />}
          <div>
            <h3>{name || '새 아이템'}</h3>
            <span className="tag">{category}</span>
          </div>
        </div>
        <div className="stat-pills">
          {statList().map((s) => (
            <span key={s.stat} className="stat-pill">
              <span>{s.stat}</span>
              <b className={s.value < 0 ? 'neg' : undefined}>{s.value > 0 ? `+${s.value}` : s.value}</b>
              {s.min !== undefined && (
                <small>
                  ({s.min}~{s.max})
                </small>
              )}
            </span>
          ))}
        </div>
        {note && <p className="item-note">✦ {note}</p>}
        <p className="muted small">📍 {source || '-'}</p>
      </Panel>
    </div>
  )
}

export function SubmitPage({ kind }) {
  const isItem = kind === 'item'
  const [done, setDone] = useState('')
  const [round, setRound] = useState(0)
  const back = isItem ? { href: '#items', label: '아이템 도감' } : { href: '#pets', label: '펫 도감' }
  return (
    <div className="stack wide">
      <div className="btn-row">
        <a className="btn btn-ghost btn-sm" href={back.href}>
          ← {back.label}으로
        </a>
        <span className="grow" />
        <a className={isItem ? 'chip' : 'chip is-on'} aria-pressed={!isItem} href="#submit/pet">
          🐾 펫 추가
        </a>
        <a className={isItem ? 'chip is-on' : 'chip'} aria-pressed={isItem} href="#submit/item">
          🗡️ 아이템 추가
        </a>
      </div>
      <p className="banner">제출한 내용은 관리자가 확인하고 승인한 뒤에 도감에 나옵니다.</p>
      {done ? (
        <section className="panel center">
          <p className="empty big">
            <span aria-hidden="true">📬</span>
            {done} 제출했습니다. 승인되면 {back.label}에 나옵니다.
          </p>
          <div className="btn-row center">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setDone('')
                setRound(round + 1)
              }}
            >
              하나 더 제출하기
            </button>
            <a className="btn btn-fire" href={back.href}>
              {back.label}으로
            </a>
          </div>
        </section>
      ) : isItem ? (
        <ItemForm key={round} onDone={setDone} />
      ) : (
        <PetForm key={round} onDone={setDone} />
      )}
    </div>
  )
}

/* ---------- 승인 관리 ---------- */
const when = (t) => new Date(t).toLocaleString('ko-KR')
function PetReview({ pet }) {
  const r = useMemo(() => calcHwan(pet, [0, 0, 0, 0]), [pet])
  return (
    <>
      <PetImg pet={pet} className="review-img" />
      <div className="review-text">
        <h3>
          {pet.name} <small className="muted">펫 · {pet.tier}</small>
        </h3>
        <p>{attrText(pet.attrs)}</p>
        <p className="muted small">
          획득: {pet.source} ({pet.sourceType}) · {pet.ride ? '탑승 가능' : '탑승 불가'} · 기술창 {pet.skillSlots ?? '모름'} · 총성장 {pet.total.toFixed(2)}
        </p>
        <p className="small">
          {STATS.map(({ key, label }) => (
            <span key={key} className="review-stat">
              {label} <b>{pet[key][0].toFixed(2)}</b> ({pet[key][1].toFixed(2)})
            </span>
          ))}
        </p>
        {r.total === 0 ? (
          <Note warn>이 수치로는 환각 계산이 안 됩니다(매칭 0건). 거절하고 초기값을 소수까지 다시 받으세요.</Note>
        ) : (
          <p className="small">
            환각 계산 확인: 환각 {cappedPct(r.hwanRate)} (매칭 {r.total}건)
            {fitBase(pet).error > 0.09 && <b className="bad"> · 초기값이 다른 펫 규칙과 맞지 않음</b>}
          </p>
        )}
      </div>
    </>
  )
}
function ItemReview({ item }) {
  return (
    <>
      <ItemImg src={item.image ? itemImage(item.image) : ''} className="review-img" />
      <div className="review-text">
        <h3>
          {item.name} <small className="muted">아이템 · {item.category}</small>
        </h3>
        <p className="small">
          {item.stats.map((s) => (
            <span key={s.stat} className="review-stat">
              {s.stat} <b>{s.value > 0 ? `+${s.value}` : s.value}</b>
              {s.min !== undefined && ` (${s.min}~${s.max})`}
            </span>
          ))}
        </p>
        {item.note && <p className="small">설명: {item.note}</p>}
        {item.source && <p className="muted small">획득: {item.source}</p>}
      </div>
    </>
  )
}
function ReviewCard({ sub, actions, onAct }) {
  const [armed, setArmed] = useState(null)
  const [busy, setBusy] = useState(false)
  const act = async (action, danger) => {
    if (danger && armed !== action) return setArmed(action)
    setBusy(true)
    await onAct(action)
    setBusy(false)
    setArmed(null)
  }
  return (
    <li className="panel review-card">
      {sub.kind === 'pet' ? <PetReview pet={sub.entry} /> : <ItemReview item={sub.entry} />}
      <div className="review-actions">
        <small className="muted">{when(sub.createdAt)}</small>
        {actions.map(({ action, label, danger }) => (
          <button key={action} type="button" className={danger ? 'btn btn-ghost btn-sm danger' : 'btn btn-fire btn-sm'} disabled={busy} onClick={() => act(action, danger)}>
            {armed === action ? `정말 ${label}` : label}
          </button>
        ))}
      </div>
    </li>
  )
}
export function ReviewPage() {
  const [stage, setStage] = useState('checking')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [queue, setQueue] = useState({ pending: [], approved: [] })
  const load = async () => {
    const q = await fetchQueue()
    if (!q) return setStage('login')
    setQueue(q)
    setStage('ready')
  }
  useEffect(() => {
    isLoggedIn().then((ok) => (ok ? load() : setStage('login')))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const doLogin = async () => {
    const r = await login(pw)
    setPw('')
    setMsg(r.errors.join(' '))
    if (r.ok) await load()
  }
  const act = async (id, action) => {
    const r = await review(id, action)
    setMsg(r.ok ? (action === 'approve' ? '승인했습니다. 1~10분 안에 모두에게 보입니다.' : '처리했습니다.') : r.errors.join(' '))
    await load()
  }
  if (stage === 'checking') return <p className="empty">확인하는 중입니다.</p>
  if (stage === 'login')
    return (
      <div className="stack">
        <Panel title="관리자 로그인" icon="🔒">
          <form
            className="btn-row"
            onSubmit={(e) => {
              e.preventDefault()
              doLogin()
            }}
          >
            <input type="password" className="text-in grow" aria-label="비밀번호" placeholder="비밀번호" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <button type="submit" className="btn btn-fire" disabled={!pw}>
              로그인
            </button>
          </form>
          {msg && <p className="error">{msg}</p>}
        </Panel>
      </div>
    )
  return (
    <div className="stack wide">
      <div className="btn-row">
        <h2 className="band">📥 승인 대기 {queue.pending.length}건</h2>
        <span className="grow" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
          새로고침
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            await logout()
            setMsg('')
            setStage('login')
          }}
        >
          로그아웃
        </button>
      </div>
      {msg && <p className="info">{msg}</p>}
      {queue.pending.length === 0 ? (
        <p className="empty">승인을 기다리는 제출이 없습니다.</p>
      ) : (
        <ul className="review-list">
          {queue.pending.map((s) => (
            <ReviewCard
              key={s.id}
              sub={s}
              actions={[
                { action: 'approve', label: '승인' },
                { action: 'reject', label: '거절', danger: true },
              ]}
              onAct={(a) => act(s.id, a)}
            />
          ))}
        </ul>
      )}
      <h2 className="band">✅ 승인한 항목 {queue.approved.length}건</h2>
      {queue.approved.length === 0 ? (
        <p className="empty">아직 승인한 항목이 없습니다.</p>
      ) : (
        <ul className="review-list">
          {queue.approved.map((s) => (
            <ReviewCard key={s.id} sub={s} actions={[{ action: 'withdraw', label: '내리기', danger: true }]} onAct={(a) => act(s.id, a)} />
          ))}
        </ul>
      )}
    </div>
  )
}

