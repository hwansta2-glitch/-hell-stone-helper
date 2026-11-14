import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { asset, ATTR_ICON, ATTRS, attrText, charImage, enhance, families, findPet, ITEM_CATEGORIES, ITEM_STATS, itemImage, items, pets, rides, TIER_ICON } from '../lib/data'
import { matches } from '../lib/search'
import { statAtLevel } from '../lib/hwan'
import { chanceOf, hasRoll, marginal, rollModel } from '../lib/drops'
import { chancePct, oneIn } from '../lib/format'
import { AttrLine, ItemImg, Modal, Note, NumInput, paginate, Pager, Panel, PetImg, PetPicker, Seg } from '../components/ui'

/* ---------------- 펫 도감 ---------------- */
const SORTS = [
  { key: 'default', label: '기본 순서' },
  { key: 'hp', label: '피성' },
  { key: 'atk', label: '공성' },
  { key: 'def', label: '방성' },
  { key: 'agi', label: '순성' },
  { key: 'total', label: '총성장' },
]
const DEX_STATS = [
  { key: 'hp', label: '내구' },
  { key: 'atk', label: '공격' },
  { key: 'def', label: '방어' },
  { key: 'agi', label: '순발' },
]
const SOURCES = [
  { type: '필드포획', label: '🌾 필드포획' },
  { type: '퀘스트', label: '📜 퀘스트' },
  { type: '코스', label: '🏁 코스' },
  { type: '운영지원', label: '🛡️ 운영지원' },
]
const NO_FILTER = { query: '', attrs: {}, rideOnly: false, paidOnly: false, sourceTypes: [] }
const PER_PAGE = 12

function filterPets(list, f) {
  return list.filter((p) => {
    if (!matches(p.name, f.query)) return false
    if (f.rideOnly && !p.ride) return false
    if (f.paidOnly && p.tier === '일반') return false
    if (f.sourceTypes.length > 0 && !f.sourceTypes.includes(p.sourceType)) return false
    return ATTRS.every((a) => {
      const min = f.attrs[a]
      return min === undefined || (p.attrs[a] ?? 0) >= Math.max(min, 1)
    })
  })
}
const sortPets = (list, key) => (key === 'default' ? list : [...list].sort((a, b) => (key === 'total' ? b.total - a.total : b[key][1] - a[key][1])))

function PetArt({ pet }) {
  return (
    <div className="pet-art">
      {pet.isNew && <span className="badge-new">NEW</span>}
      <span className="badge-tier" data-tier={pet.tier}>
        {TIER_ICON[pet.tier]} {pet.tier}
      </span>
      <PetImg pet={pet} />
    </div>
  )
}
function PetInfo({ pet }) {
  return (
    <div className="pet-info">
      <h3>{pet.name}</h3>
      <AttrLine attrs={pet.attrs} />
      <p className="muted small">획득: {pet.source}</p>
      <div className="tags">
        <span className="tag">{pet.ride ? '🐎 탑승' : '🚫 탑승X'}</span>
        {pet.skillSlots != null && <span className="tag">⚔️ {pet.skillSlots}</span>}
        <span className="tag hot">📈 {pet.total.toFixed(2)}</span>
      </div>
      <div className="mini-stats">
        {DEX_STATS.map(({ key, label }) => {
          const [i, d] = pet[key][0].toFixed(2).split('.')
          return (
            <div key={key}>
              <span>{label}</span>
              <strong>
                <b>{i}</b>.{d}
              </strong>
              <em>({pet[key][1].toFixed(2)})</em>
            </div>
          )
        })}
      </div>
    </div>
  )
}
function PetModal({ pet, onClose }) {
  const base = pet.name.replace('(환생)', '')
  const fam = families.find((f) => f.pets.includes(base))
  const kin = fam?.pets.filter((n) => n !== base) ?? []
  return (
    <Modal label={`${pet.name} 상세`} onClose={onClose}>
      <PetArt pet={pet} />
      <PetInfo pet={pet} />
      <div className="modal-sec">
        <p className="sub">📦 {fam?.name ?? pet.name} 계열</p>
        {kin.length === 0 ? (
          <p className="muted small">같은 계열 펫이 없습니다</p>
        ) : (
          <div className="mini-pets">
            {kin.map((n) => (
              <div key={n} className="mini-pet">
                <PetImg pet={findPet(n)} />
                <span>{n}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <a className="btn btn-fire btn-block" href={`#hwan/${encodeURIComponent(pet.name)}`}>
        🔍 등급 계산하기
      </a>
    </Modal>
  )
}

export function PetsPage() {
  const [f, setF] = useState(NO_FILTER)
  const [sort, setSort] = useState('default')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(null)
  const list = useMemo(() => sortPets(filterPets(pets, f), sort), [f, sort])
  const pg = paginate(list, page, PER_PAGE)
  const sum = ATTRS.reduce((s, a) => s + (f.attrs[a] ?? 0), 0)
  const close = useCallback(() => setOpen(null), [])
  const patch = (p) => {
    setF({ ...f, ...p })
    setPage(1)
  }
  const toggleAttr = (a) => {
    const next = { ...f.attrs }
    if (next[a] === undefined) next[a] = 0
    else delete next[a]
    patch({ attrs: next })
  }
  return (
    <div className="stack wide">
      <section className="panel filters" aria-label="펫 필터">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input type="search" placeholder="펫 이름 또는 초성" aria-label="펫 검색" value={f.query} onChange={(e) => patch({ query: e.target.value })} />
        </label>
        <div className="attr-filter">
          {ATTRS.map((a) => {
            const v = f.attrs[a]
            return (
              <div key={a} className={`attr-pick attr-${a}`}>
                <button type="button" aria-pressed={v !== undefined} onClick={() => toggleAttr(a)}>
                  {ATTR_ICON[a]} {a}
                </button>
                <NumInput min={0} max={10} aria-label={`${a} 최소 칸 수`} disabled={v === undefined} value={v ?? 0} onValue={(x) => patch({ attrs: { ...f.attrs, [a]: x } })} />
              </div>
            )
          })}
          <span className="muted small">
            합계 <b>{sum}</b> / 10
          </span>
        </div>
        <div className="chip-row">
          <button type="button" className="chip" aria-pressed={f.rideOnly} onClick={() => patch({ rideOnly: !f.rideOnly })}>
            🐎 탑승
          </button>
          <button type="button" className="chip" aria-pressed={f.paidOnly} onClick={() => patch({ paidOnly: !f.paidOnly })}>
            💰 돈펫
          </button>
          {SOURCES.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              className="chip"
              aria-pressed={f.sourceTypes.includes(type)}
              onClick={() => patch({ sourceTypes: f.sourceTypes.includes(type) ? f.sourceTypes.filter((t) => t !== type) : [...f.sourceTypes, type] })}
            >
              {label}
            </button>
          ))}
          <span className="grow" />
          <select
            aria-label="정렬"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value)
              setPage(1)
            }}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setF(NO_FILTER)
              setSort('default')
              setPage(1)
            }}
          >
            초기화
          </button>
          <span className="count">{list.length}마리</span>
          <a className="btn btn-fire btn-sm" href="#submit/pet">
            ➕ 추가하기
          </a>
        </div>
      </section>
      {list.length === 0 ? (
        <p className="empty">조건에 맞는 펫이 없습니다. 속성 칸 수를 낮추거나 초기화하세요.</p>
      ) : (
        <ul className="pet-grid">
          {pg.rows.map((p) => (
            <li key={p.name}>
              <button type="button" className="pet-card" onClick={() => setOpen(p)}>
                <PetArt pet={p} />
                <PetInfo pet={p} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Pager page={pg.page} pageCount={pg.pageCount} onChange={setPage} />
      {open && <PetModal pet={open} onClose={close} />}
    </div>
  )
}

/* ---------------- 계열 도감 ---------------- */
export function FamiliesPage() {
  const [q, setQ] = useState('')
  const [openSet, setOpenSet] = useState([])
  const list = useMemo(() => families.filter((f) => matches(f.name, q) || f.pets.some((n) => matches(n, q))), [q])
  const allOpen = list.length > 0 && list.every((f) => openSet.includes(f.name))
  const toggle = (n) => setOpenSet(openSet.includes(n) ? openSet.filter((x) => x !== n) : [...openSet, n])
  return (
    <div className="stack wide">
      <div className="panel search-row">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input type="search" placeholder="계열 또는 펫 이름" aria-label="계열 또는 펫 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenSet(allOpen ? [] : list.map((f) => f.name))}>
          {allOpen ? '전체 접기' : '전체 펼치기'}
        </button>
        <span className="count">{list.length}개 계열</span>
      </div>
      {list.length === 0 ? (
        <p className="empty">맞는 계열이 없습니다.</p>
      ) : (
        <ul className="family-grid">
          {list.map((f) => (
            <li key={f.name} className={openSet.includes(f.name) ? 'is-open' : undefined}>
              <button type="button" className="family-card" aria-expanded={openSet.includes(f.name)} onClick={() => toggle(f.name)}>
                <PetImg pet={findPet(f.pets[0])} />
                <b>{f.name} 계열</b>
                <small>{f.pets.length}마리</small>
              </button>
              {openSet.includes(f.name) && (
                <div className="mini-pets">
                  {f.pets.map((n) => (
                    <div key={n} className="mini-pet">
                      <PetImg pet={findPet(n)} />
                      <span>{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------------- 탑승 도감 ---------------- */
const evolvedName = (n) => n.replace('(진)', '(진화)')
function byPet(list) {
  const m = new Map()
  for (const { character, pets: ps } of list)
    for (const p of ps) {
      const e = m.get(p.name)
      if (e) e.characters.push(character)
      else m.set(p.name, { ...p, characters: [character] })
    }
  return [...m.values()]
}
export function RidesPage() {
  const [view, setView] = useState('character')
  const [char, setChar] = useState(rides[0].character)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const all = useMemo(() => byPet(rides).sort((a, b) => a.name.localeCompare(b.name, 'ko')), [])
  const mine = rides.find((r) => r.character === char)?.pets ?? []
  const shownChar = mine.filter((p) => matches(p.name, q))
  const shownPet = all.filter((p) => matches(p.name, q))
  const shown = view === 'character' ? shownChar : shownPet
  return (
    <div className="stack wide">
      <Seg options={['character', 'pet']} value={view} onChange={setView} render={(v) => (v === 'character' ? '캐릭터별' : '펫별')} label="보기" />
      {view === 'character' && (
        <div className="char-bar" role="group" aria-label="캐릭터">
          {rides.map((r) => (
            <button key={r.character} type="button" className="char-card" aria-pressed={char === r.character} onClick={() => setChar(r.character)}>
              <ItemImg src={charImage(r.character)} fallback="🧑" />
              {r.character}
            </button>
          ))}
        </div>
      )}
      <div className="panel search-row">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input type="search" placeholder={view === 'character' ? '탑승 펫 검색' : '펫 이름 검색'} aria-label="펫 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span className="count">{view === 'character' ? `${shownChar.length}/${mine.length}` : `${shownPet.length}/${all.length}`}마리</span>
      </div>
      {shown.length === 0 && <p className="empty">맞는 펫이 없습니다.</p>}
      {view === 'pet' && sel && (
        <section className="panel" aria-label={`${sel.name}을 탈 수 있는 캐릭터`}>
          <p className="sub">{sel.name} — 탈 수 있는 캐릭터</p>
          <div className="chip-row">
            {sel.characters.map((c) => (
              <span key={c} className="char-card">
                <ItemImg src={charImage(c)} fallback="🧑" />
                {c}
              </span>
            ))}
          </div>
        </section>
      )}
      <ul className="ride-grid">
        {shown.map((p) => {
          const inner = (
            <>
              <PetImg pet={findPet(evolvedName(p.name)) ?? { name: p.name, attrs: {} }} />
              <span>{p.name}</span>
              {view === 'pet' ? <small>{p.released ? `${p.characters.length}캐릭` : '미출시'}</small> : !p.released && <small>미출시</small>}
            </>
          )
          return (
            <li key={p.name}>
              {view === 'pet' ? (
                <button type="button" className={p.released ? 'ride' : 'ride is-off'} aria-pressed={sel?.name === p.name} onClick={() => setSel(sel?.name === p.name ? null : p)}>
                  {inner}
                </button>
              ) : (
                <div className={p.released ? 'ride' : 'ride is-off'}>{inner}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ---------------- 아이템 도감 ---------------- */
const CAT_ICON = { 무기: '⚔️', 투구: '🪖', 갑옷: '🛡️', 악세서리: '💍', 삼위일체: '💎', 보조: '🎒', 전리품: '🏆' }
const ENH_KIND = { 무기: '무기', 투구: '방어구', 갑옷: '방어구' }
const sgn = (v) => (v > 0 ? `+${v}` : `${v}`)
const statText = ({ value, min, max }) => (min === undefined || max === undefined ? sgn(value) : `${sgn(value)} (${sgn(min)}~${sgn(max)})`)
const filterItems = (cat, q) => items.filter((it) => (cat === '전체' || it.category === cat) && matches(it.name, q))
const ROLL_RULE = '아이템이 생길 때 옵션마다 따로, 범위 안의 모든 값이 같은 확률로 나온다는 규칙 기준이에요.'

function StatPills({ item }) {
  return (
    <div className="stat-pills">
      {item.stats.map((s) => {
        const [v, range] = statText(s).split(' ')
        return (
          <span key={s.stat} className="stat-pill" data-stat={s.stat}>
            <span>{s.stat}</span>
            <b className={s.value < 0 ? 'neg' : undefined}>{v}</b>
            {range && <small>{range}</small>}
          </span>
        )
      })}
    </div>
  )
}
function ItemHead({ item }) {
  return (
    <div className="item-head">
      <ItemImg src={item.image ? itemImage(item.image) : ''} fallback={CAT_ICON[item.category]} />
      <div>
        <h3>{item.name}</h3>
        <span className="tag">
          {CAT_ICON[item.category]} {item.category}
        </span>
      </div>
    </div>
  )
}
function spreadText(dist, signedVals) {
  const first = dist[0]
  if (dist.every(({ chance }) => Math.abs(chance - first.chance) < 1e-9)) return `${dist.length}가지 · 값마다 ${chancePct(first.chance)}`
  const top = dist.reduce((a, b) => (b.chance > a.chance ? b : a))
  const f = (v) => (signedVals ? sgn(v) : String(v))
  return `${f(first.value)}~${f(dist[dist.length - 1].value)} · 가장 흔한 값 ${f(top.value)} (${chancePct(top.chance)})`
}
function RollPanel({ model, rule }) {
  const [picks, setPicks] = useState(() => model.options.map(() => null))
  const [mode, setMode] = useState('exact')
  const dists = useMemo(() => model.options.map((_, i) => marginal(model, i)), [model])
  const allMax = model.uniform ? chanceOf(model, model.options.map((o) => o.values[o.values.length - 1]), 'exact') : null
  const any = picks.some((p) => p !== null)
  const p = chanceOf(model, picks, mode)
  const on = (i, v) => {
    const w = picks[i]
    return w !== null && (mode === 'exact' ? v === w : v >= w)
  }
  return (
    <section className="roll" aria-label="옵션 확률">
      <p className="sub">🎲 옵션 확률</p>
      {allMax !== null && (
        <p className="roll-best">
          전부 최대가 나올 확률 <b>{chancePct(allMax)}</b> <small>{oneIn(allMax)}</small>
        </p>
      )}
      <div className="roll-head">
        <p className="muted small">원하는 옵션 값을 누르세요. 하나만 골라도 돼요.</p>
        <Seg options={['exact', 'atLeast']} value={mode} onChange={setMode} render={(m) => (m === 'exact' ? '딱 그 값' : '그 값 이상')} label="고르는 방식" />
      </div>
      {model.options.map((o, i) => (
        <div key={o.label} className="roll-row">
          <p>
            <span>{o.label}</span> <small className="muted">{spreadText(dists[i], !!o.stat)}</small>
          </p>
          <div className="chip-row">
            <button type="button" className="chip" aria-pressed={picks[i] === null} onClick={() => setPicks(picks.map((x, k) => (k === i ? null : x)))}>
              상관없음
            </button>
            {o.values.map((v) => (
              <button key={v} type="button" className="chip" aria-pressed={on(i, v)} onClick={() => setPicks(picks.map((x, k) => (k === i ? (x === v ? null : v) : x)))}>
                {o.stat ? sgn(v) : v}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="roll-total" aria-live="polite">
        {any ? (
          <>
            <span>{mode === 'exact' ? '고른 값이 딱 나올 확률' : '고른 값 이상이 나올 확률'}</span>
            <b>{chancePct(p)}</b>
            <small>{oneIn(p)}</small>
          </>
        ) : (
          <span>값을 누르면 그 값이 나올 확률을 보여 줘요</span>
        )}
      </div>
      <p className="muted small">{rule}</p>
    </section>
  )
}
function ItemModal({ item, onClose }) {
  const model = useMemo(() => rollModel(item), [item])
  const rule = item.pool
    ? `합계 ${item.pool.min}~${item.pool.max} 중 하나를 같은 확률로 정하고, 한 점씩 ${item.pool.stats.join('·')} 중 하나에 같은 확률로 나눈다고 보고 계산한 추정이에요.`
    : ROLL_RULE
  return (
    <Modal label={`${item.name} 옵션 확률`} onClose={onClose} wide>
      <ItemHead item={item} />
      <StatPills item={item} />
      {item.note && <p className="item-note">✦ {item.note}</p>}
      {model && <RollPanel model={model} rule={rule} />}
    </Modal>
  )
}
function ItemList() {
  const [cat, setCat] = useState('전체')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const list = useMemo(() => filterItems(cat, q), [cat, q])
  const close = useCallback(() => setOpen(null), [])
  return (
    <>
      <div className="panel search-row">
        <div className="chip-row" role="group" aria-label="부위">
          {['전체', ...ITEM_CATEGORIES].map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
              {CAT_ICON[c] ?? ''} {c}
            </button>
          ))}
        </div>
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input type="search" placeholder="아이템 검색 (초성 가능)" aria-label="아이템 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span className="count">{list.length}개</span>
        <a className="btn btn-fire btn-sm" href="#submit/item">
          ➕ 추가하기
        </a>
      </div>
      {list.length === 0 ? (
        <p className="empty">조건에 맞는 아이템이 없습니다.</p>
      ) : (
        <ul className="item-grid">
          {list.map((it) => {
            const roll = hasRoll(it)
            return (
              <li key={it.name} className={roll ? 'item-card is-roll' : 'item-card'}>
                <ItemHead item={it} />
                <StatPills item={it} />
                {it.note && <p className="item-note">✦ {it.note}</p>}
                {it.source && (
                  <p className="muted small" title={it.source}>
                    📍 {it.source}
                  </p>
                )}
                {roll && (
                  <button type="button" className="roll-btn" aria-label={`${it.name} 옵션 확률 보기`} onClick={() => setOpen(it)}>
                    🎲 옵션 확률
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {open && <ItemModal item={open} onClose={close} />}
    </>
  )
}
function bestIndex(vals) {
  const nums = vals.flatMap((v) => (v ? [v.value] : []))
  if (nums.length < 2) return null
  const m = Math.max(...nums)
  return nums.filter((x) => x === m).length > 1 ? null : vals.findIndex((v) => v?.value === m)
}
function ItemCompare() {
  const [cat, setCat] = useState('무기')
  const [picked, setPicked] = useState([])
  const [enh, setEnh] = useState(0)
  const list = useMemo(() => filterItems(cat, ''), [cat])
  const chosen = list.filter((it) => picked.includes(it.name))
  const rows = ITEM_STATS.flatMap((stat) => {
    const vals = chosen.map((it) => it.stats.find((s) => s.stat === stat) ?? null)
    return vals.every((v) => v === null) ? [] : [{ stat, vals, best: bestIndex(vals) }]
  })
  const kind = ENH_KIND[cat]
  return (
    <>
      <Panel>
        <p className="sub">부위</p>
        <div className="chip-row">
          {ITEM_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className="chip"
              aria-pressed={cat === c}
              onClick={() => {
                setCat(c)
                setPicked([])
              }}
            >
              {CAT_ICON[c]} {c}
            </button>
          ))}
        </div>
        {kind && (
          <>
            <p className="sub">강화 수치 (모두 같이 적용)</p>
            <div className="chip-row">
              {Array.from({ length: 11 }, (_, i) => (
                <button key={i} type="button" className="chip" aria-pressed={enh === i} onClick={() => setEnh(i)}>
                  {i === 0 ? '없음' : `+${i}`}
                </button>
              ))}
            </div>
          </>
        )}
        <p className="sub">아이템</p>
        <div className="chip-row">
          {list.map((it) => (
            <button
              key={it.name}
              type="button"
              className="chip"
              aria-pressed={picked.includes(it.name)}
              onClick={() => setPicked(picked.includes(it.name) ? picked.filter((n) => n !== it.name) : [...picked, it.name])}
            >
              {it.name}
            </button>
          ))}
        </div>
      </Panel>
      {chosen.length < 2 ? (
        <p className="empty">같은 부위 아이템을 2개 이상 고르면 옵션을 나란히 비교해요.</p>
      ) : (
        <div className="panel table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>능력치</th>
                {chosen.map((it) => (
                  <th key={it.name}>{it.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.stat}>
                  <th>{r.stat}</th>
                  {r.vals.map((v, i) => (
                    <td key={chosen[i].name} className={r.best === i ? 'best' : undefined}>
                      {v ? statText(v) : '없음'}
                    </td>
                  ))}
                </tr>
              ))}
              {kind && enh > 0 && (
                <tr>
                  <th>+{enh} 강화</th>
                  {chosen.map((it) => (
                    <td key={it.name}>{enhance.bonus[kind][enh - 1]}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
export function ItemsPage() {
  const [view, setView] = useState('list')
  return (
    <div className="stack wide">
      <Seg options={['list', 'compare']} value={view} onChange={setView} render={(v) => (v === 'list' ? `📖 도감 ${items.length}` : '⚖️ 아이템 비교')} label="보기" />
      {view === 'list' ? <ItemList /> : <ItemCompare />}
    </div>
  )
}

/* ---------------- 펫 비교 ---------------- */
const MIN_SLOTS = 2
const MAX_SLOTS = 4
const SLOT_COLORS = ['var(--fire)', 'var(--gold)', 'var(--ash)', '#4fb3a6']
const CMP_STATS = [
  { key: 'hp', label: '체력' },
  { key: 'atk', label: '공격' },
  { key: 'def', label: '방어' },
  { key: 'agi', label: '순발' },
]
const uniqueMax = (vals) => {
  const m = Math.max(...vals)
  return vals.filter((v) => v === m).length === 1 ? vals.indexOf(m) : -1
}
export function ComparePage() {
  const [slots, setSlots] = useState([null, null])
  const [level, setLevel] = useState(140)
  const chosen = slots.filter((s) => s !== null)
  const setAt = (i, p) => setSlots(slots.map((s, k) => (k === i ? p : s)))
  const remove = (i) => (slots.length > MIN_SLOTS ? setSlots(slots.filter((_, k) => k !== i)) : setAt(i, null))
  const row = (label, vals, fmt) => {
    const b = uniqueMax(vals)
    return (
      <tr key={label}>
        <th>{label}</th>
        {vals.map((v, i) => (
          <td key={i} className={b === i ? 'best' : undefined}>
            {fmt(v)}
          </td>
        ))}
      </tr>
    )
  }
  return (
    <div className="stack wide">
      <section className="hero small">
        <div className="hero-glow" aria-hidden="true" />
        <h1>
          어떤 펫을 <em>키울까?</em>
        </h1>
        <p>최대 4마리를 나란히 두고 성장률과 스탯을 비교하세요</p>
      </section>
      <Panel
        title="비교할 펫"
        icon="⚖️"
        aside={
          <div className="head-tools">
            <label className="inline-field">
              <span>목표 레벨</span>
              <NumInput min={1} max={140} value={level} onValue={setLevel} />
            </label>
            <button type="button" className="btn btn-ghost btn-sm" disabled={slots.length >= MAX_SLOTS} onClick={() => setSlots([...slots, null])}>
              + 펫 추가
            </button>
          </div>
        }
      >
        <div className="cmp-slots">
          {slots.map((p, i) => (
            <div key={i} className="cmp-slot" style={{ borderTopColor: SLOT_COLORS[i] }}>
              <div className="cmp-slot-head">
                슬롯 {i + 1}
                <button type="button" className="x-btn" aria-label={`슬롯 ${i + 1} 비우기`} onClick={() => remove(i)}>
                  ×
                </button>
              </div>
              <PetPicker label={`슬롯 ${i + 1} 펫 검색`} placeholder="펫 이름 검색" selected={p?.name} onPick={(x) => setAt(i, x)} />
              {p ? (
                <div className="cmp-pet">
                  <PetImg pet={p} />
                  <small>{attrText(p.attrs)}</small>
                </div>
              ) : (
                <p className="muted small">초성 검색 가능</p>
              )}
            </div>
          ))}
        </div>
        <Note>기준: S랭크(환각)</Note>
      </Panel>
      <section className="panel" aria-label="비교 결과">
        {chosen.length < MIN_SLOTS ? (
          <p className="empty big">
            <span aria-hidden="true">🐾</span>2마리 이상 고르면 여기에 비교 결과가 나옵니다
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table center">
              <thead>
                <tr>
                  <th>항목</th>
                  {chosen.map((p, i) => (
                    <th key={i}>
                      <PetImg pet={p} className="th-img" />
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CMP_STATS.map(({ key, label }) => row(`${label} (Lv.${level})`, chosen.map((p) => statAtLevel(p[key], level)), (v) => v.toLocaleString('ko-KR')))}
                {CMP_STATS.map(({ key, label }) => row(`${label} 성장`, chosen.map((p) => p[key][1]), (v) => v.toFixed(2)))}
                {row('총성장', chosen.map((p) => p.total), (v) => v.toFixed(2))}
                <tr>
                  <th>속성</th>
                  {chosen.map((p, i) => (
                    <td key={i}>{attrText(p.attrs)}</td>
                  ))}
                </tr>
                <tr>
                  <th>획득처</th>
                  {chosen.map((p, i) => (
                    <td key={i}>{p.source}</td>
                  ))}
                </tr>
                <tr>
                  <th>등급</th>
                  {chosen.map((p, i) => (
                    <td key={i}>{p.tier}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

/* ---------------- 월드맵 ---------------- */
const REGIONS = [
  { name: '사이너스', file: 'sainus' },
  { name: '쟈루', file: 'zaru' },
  { name: '가우린', file: 'gaurin' },
  { name: '세르노스', file: 'sernos' },
  { name: '포우렌', file: 'pouren' },
  { name: '하이하모', file: 'hihamo' },
  { name: '에레보스', file: 'erevos' },
  { name: '해저/인어섬', file: 'aqua' },
  { name: '기타', file: 'poru' },
]
const ZOOM_MIN = 50
const ZOOM_MAX = 300
const ZOOM_STEP = 15
export function MapPage() {
  const [region, setRegion] = useState(REGIONS[0])
  const [zoom, setZoom] = useState(null)
  const [natural, setNatural] = useState({ width: 0, height: 0 })
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [missing, setMissing] = useState(false)
  const frame = useRef(null)
  useEffect(() => {
    const measure = () => {
      const el = frame.current
      if (!el) return
      const cs = getComputedStyle(el)
      setBox({ width: el.clientWidth, height: parseFloat(cs.maxHeight) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth) })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  const fit = natural.width > 0 && box.width > 0 ? Math.min(box.width / natural.width, box.height / natural.height) : 1
  const scale = zoom ?? fit
  const pctNow = Math.round(scale * 100)
  const nudge = (d) => setZoom(Math.min(ZOOM_MAX, Math.max(Math.min(ZOOM_MIN, pctNow), pctNow + d)) / 100)
  return (
    <div className="stack wide">
      <div className="chip-row" role="group" aria-label="지역">
        {REGIONS.map((r) => (
          <button
            key={r.file}
            type="button"
            className="chip"
            aria-pressed={region === r}
            onClick={() => {
              setRegion(r)
              setZoom(null)
              setMissing(false)
            }}
          >
            {r.name}
          </button>
        ))}
      </div>
      <div className="map-frame" ref={frame}>
        {missing ? (
          <p className="empty big">
            <span aria-hidden="true">🗺️</span>
            지도 그림이 없습니다. <code>public/maps/{region.file}.gif</code> 에 넣으면 여기에 나옵니다.
          </p>
        ) : (
          <img
            key={region.file}
            src={asset('maps', `${region.file}.gif`)}
            alt={`${region.name} 지도`}
            style={natural.width > 0 ? { width: Math.floor(natural.width * scale) } : { visibility: 'hidden' }}
            onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
            onError={() => setMissing(true)}
          />
        )}
      </div>
      {!missing && (
        <div className="zoom" role="group" aria-label="확대">
          <button type="button" aria-label="축소" onClick={() => nudge(-ZOOM_STEP)}>
            −
          </button>
          <span>{pctNow}%</span>
          <button type="button" aria-label="확대" onClick={() => nudge(ZOOM_STEP)}>
            +
          </button>
          <button type="button" aria-label="화면에 맞추기" onClick={() => setZoom(null)}>
            ↺
          </button>
        </div>
      )}
    </div>
  )
}
