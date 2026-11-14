import { useEffect, useMemo, useRef, useState } from 'react'
import { ATTRS, ATTR_ICON, attrText, petImage, pets } from '../lib/data'
import { searchByName } from '../lib/search'
import { store } from '../lib/format'

// 숫자 입력: 입력 중에는 빈 칸을 허용하고, 벗어나면 정리한다
export function NumInput({ value, min, max, onValue, onBlur, className = '', ...rest }) {
  const [draft, setDraft] = useState(null)
  const clamp = (v) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v))
  return (
    <input
      {...rest}
      className={`num ${className}`}
      type="number"
      min={min}
      max={max}
      value={draft ?? value}
      onChange={(e) => {
        const t = e.target.value
        setDraft(t)
        if (t !== '' && Number.isFinite(Number(t))) onValue(clamp(Number(t)))
      }}
      onBlur={(e) => {
        if (draft === '') onValue(min ?? 0)
        setDraft(null)
        onBlur?.(e)
      }}
    />
  )
}

// 그림이 없으면 속성색 동그라미에 이름 첫 글자를 보여 준다
export function PetImg({ pet, className = '' }) {
  const [broken, setBroken] = useState(false)
  if (!pet) return <span className={`pet-img is-empty ${className}`} />
  const main = ATTRS.reduce((a, b) => ((pet.attrs[b] ?? 0) > (pet.attrs[a] ?? 0) ? b : a), ATTRS[0])
  if (broken)
    return (
      <span className={`pet-img is-fallback attr-${main} ${className}`} aria-hidden="true">
        {pet.name.replace(/\(.*\)/, '').slice(0, 1)}
      </span>
    )
  return <img className={`pet-img ${className}`} src={petImage(pet)} alt="" loading="lazy" onError={() => setBroken(true)} />
}

export function ItemImg({ src, fallback = '🎁', className = '' }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return <span className={`item-img is-fallback ${className}`}>{fallback}</span>
  return <img className={`item-img ${className}`} src={src} alt="" loading="lazy" onError={() => setBroken(true)} />
}

export function AttrLine({ attrs }) {
  return (
    <span className="attr-line">
      {ATTRS.filter((a) => attrs[a]).map((a) => (
        <span key={a} className={`attr-chip attr-${a}`}>
          {ATTR_ICON[a]} {a} {attrs[a]}
        </span>
      ))}
    </span>
  )
}

const MAX_HITS = 20
export function PetPicker({ label, placeholder = '펫 이름 또는 초성으로 검색', selected = '', big, button, allow, onPick }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [cur, setCur] = useState(0)
  const listRef = useRef(null)
  const hits = useMemo(() => (q ? searchByName(allow ? pets.filter(allow) : pets, q).slice(0, MAX_HITS) : []), [q, allow])
  useEffect(() => {
    listRef.current?.children[cur]?.scrollIntoView({ block: 'nearest' })
  }, [cur])
  const choose = (p) => {
    if (!p) return
    onPick(p)
    setQ('')
    setOpen(false)
  }
  return (
    <div className={big ? 'picker is-big' : 'picker'}>
      <div className="picker-field">
        <span className="picker-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          type="search"
          aria-label={label}
          placeholder={placeholder}
          value={open ? q : selected}
          onFocus={() => {
            setOpen(true)
            setQ('')
            setCur(0)
          }}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            setOpen(true)
            setQ(e.target.value)
            setCur(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') choose(hits[cur])
            else if (e.key === 'Escape') setQ('')
            else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCur(Math.min(cur + 1, hits.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCur(Math.max(cur - 1, 0))
            }
          }}
        />
        {button && (
          <button type="button" className="btn btn-fire" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(hits[cur])}>
            검색
          </button>
        )}
      </div>
      {open && q && hits.length === 0 && (
        <div className="picker-list">
          <p className="picker-empty">결과 없음</p>
        </div>
      )}
      {open && hits.length > 0 && (
        <div className="picker-list" ref={listRef} role="listbox" aria-label={`${label} 결과`}>
          {hits.map((p, i) => (
            <button
              type="button"
              key={p.name}
              className={i === cur ? 'picker-opt is-cur' : 'picker-opt'}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setCur(i)}
              onClick={() => choose(p)}
            >
              <PetImg pet={p} />
              <b>{p.name}</b>
              <small>{attrText(p.attrs)}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// 최근 검색한 펫
const RECENT_KEY = 'hellstone-recent'
const RECENT_MAX = 6
export function useRecent() {
  const [recent, setRecent] = useState(() => {
    const v = store.get(RECENT_KEY, [])
    return Array.isArray(v) ? v : []
  })
  return {
    recent,
    remember: (name) => {
      const next = [name, ...recent.filter((n) => n !== name)].slice(0, RECENT_MAX)
      setRecent(next)
      store.set(RECENT_KEY, next)
    },
  }
}
export function RecentPets({ recent, columns = 3, onPick }) {
  const list = recent.flatMap((n) => pets.filter((p) => p.name === n))
  if (list.length === 0) return null
  return (
    <div className="recent">
      <p className="recent-title">최근 찾은 펫</p>
      <div className="recent-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {list.map((p) => (
          <button key={p.name} type="button" className="recent-card" onClick={() => onPick(p)}>
            <PetImg pet={p} />
            <b>{p.name}</b>
            <small>{attrText(p.attrs)}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

export function Modal({ label, onClose, children, wide }) {
  const closeRef = useRef(null)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    closeRef.current?.focus()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div className="backdrop" onClick={onClose}>
      <div className={wide ? 'modal is-wide' : 'modal'} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-x" aria-label="닫기" ref={closeRef} onClick={onClose}>
          ×
        </button>
        {children}
      </div>
    </div>
  )
}

export function paginate(list, page, size) {
  const count = Math.max(1, Math.ceil(list.length / size))
  const p = Math.min(page, count)
  return { rows: list.slice((p - 1) * size, (p - 1) * size + size), page: p, pageCount: count }
}
function pageNumbers(cur, count) {
  const set = [...new Set([1, count, cur - 1, cur, cur + 1])].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b)
  return set.flatMap((n, i) => (i > 0 && n - set[i - 1] > 1 ? [null, n] : [n]))
}
export function Pager({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null
  return (
    <nav className="pager" aria-label="쪽 이동">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="이전 쪽">
        ‹
      </button>
      {pageNumbers(page, pageCount).map((n, i) =>
        n === null ? (
          <span key={`g${i}`}>…</span>
        ) : (
          <button key={n} type="button" aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)}>
            {n}
          </button>
        ),
      )}
      <button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)} aria-label="다음 쪽">
        ›
      </button>
    </nav>
  )
}

export function Seg({ options, value, onChange, label, render }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o)} type="button" aria-pressed={value === o} onClick={() => onChange(o)}>
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value, sub, tone }) {
  return (
    <div className={tone ? `stat-tile is-${tone}` : 'stat-tile'}>
      <span>{label}</span>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  )
}

export function Panel({ title, icon, children, className = '', aside }) {
  return (
    <section className={`panel ${className}`} aria-label={title}>
      {title && (
        <header className="panel-head">
          <h2>
            {icon && <span aria-hidden="true">{icon}</span>} {title}
          </h2>
          {aside}
        </header>
      )}
      {children}
    </section>
  )
}

export function PageHead({ title, sub }) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
    </div>
  )
}

export const Note = ({ children, warn }) => <p className={warn ? 'note is-warn' : 'note'}>{children}</p>
