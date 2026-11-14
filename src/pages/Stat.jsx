import { useMemo, useState } from 'react'
import { enhance, itemImage, items, rides } from '../lib/data'
import { enhanceBonus } from '../lib/enhance'
import { standardStats } from '../lib/hwan'
import { matches } from '../lib/search'
import { signClass, signed, store } from '../lib/format'
import { ItemImg, NumInput, Note, Panel, PetPicker } from '../components/ui'

const ALLOC = [
  { label: '체력', mark: '체' },
  { label: '완력', mark: '완' },
  { label: '건강', mark: '건' },
  { label: '순발', mark: '순' },
]
const BASE4 = ['공격', '방어', '순발', '내구']
const SLOTS = [
  { label: '악세서리', category: '악세서리', icon: '💍', stats: [...BASE4, '크리', '회피'] },
  { label: '투구', category: '투구', icon: '🪖', stats: BASE4, enhance: '방어구' },
  { label: '악세서리', category: '악세서리', icon: '💍', stats: [...BASE4, '크리', '회피'] },
  { label: '무기', category: '무기', icon: '⚔️', stats: [...BASE4, '크리'], enhance: '무기' },
  { label: '갑옷', category: '갑옷', icon: '🛡️', stats: BASE4, enhance: '방어구' },
  { label: '삼위일체', category: '삼위일체', icon: '💎', stats: BASE4 },
  { label: '보조', category: '보조', icon: '🎒', stats: BASE4 },
  { label: '전리품', category: '전리품', icon: '🏆', stats: BASE4 },
]
const KEY_OF = { 공격: 'atk', 방어: 'def', 순발: 'agi', 내구: 'hp', 크리: 'crit', 회피: 'dodge' }
const ZERO = { hp: 0, atk: 0, def: 0, agi: 0, crit: 0, dodge: 0, pierce: 0, hit: 0, shield: 0 }
const EMPTY_GEAR = { name: '', values: {}, enhance: 0 }
const MAIN = [
  { key: 'hp', label: '내구력' },
  { key: 'atk', label: '공격력' },
  { key: 'def', label: '방어력' },
  { key: 'agi', label: '순발력' },
]
const SUBS = [
  { key: 'crit', label: '크리' },
  { key: 'pierce', label: '관통' },
  { key: 'hit', label: '명중' },
  { key: 'shield', label: '쉴드' },
  { key: 'dodge', label: '회피' },
]
const PRESET_KEY = 'hellstone-stat-presets'
const SHORT = { 공격: '공', 방어: '방', 순발: '순', 내구: '내', 크리: '크', 회피: '회' }
const statLine = (it) => it.stats.map(({ stat, value }) => `${SHORT[stat]}${value >= 0 ? '+' : ''}${value}`).join(' ')
const rideable = new Set(rides.flatMap((c) => c.pets.map((p) => p.name.replace('(진)', '(진화)'))))
const canRide = (p) => p.ride || rideable.has(p.name)

// 체완건순 → 표시 스탯
const fromAlloc = ([h, a, d, s]) => ({ hp: h * 4 + a + d + s + 1, atk: a + (h + d) * 0.1 + s * 0.05, def: d + (h + a) * 0.1 + s * 0.05, agi: s })
// 탑승: 캐릭 70% + 펫 50%
const CHAR_SHARE = 0.7
const PET_SHARE = 0.5
const mount = (c, p) => {
  const f = (k) => Math.round(c[k] * CHAR_SHARE + p[k] * PET_SHARE)
  return { hp: f('hp'), atk: f('atk'), def: f('def'), agi: f('agi') }
}
function gearTotal(gears) {
  const t = { ...ZERO }
  gears.forEach((g, i) => {
    for (const [stat, v] of Object.entries(g.values)) t[KEY_OF[stat]] += v ?? 0
    const kind = SLOTS[i].enhance
    if (kind) for (const [k, v] of Object.entries(enhanceBonus(kind, g.enhance))) t[k] += v ?? 0
  })
  return t
}

function ItemPicker({ category, value, label, onPick }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const list = items.filter((it) => it.category === category && matches(it.name, q))
  const choose = (it) => {
    onPick(it)
    setQ('')
    setOpen(false)
  }
  return (
    <div className="picker">
      <div className="picker-field">
        <input
          type="search"
          aria-label={`${label} 검색`}
          placeholder={`${label} 검색…`}
          value={open ? q : value}
          onFocus={() => {
            setOpen(true)
            setQ('')
          }}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            if (e.target.value === '' && !open) onPick(null)
            setOpen(true)
            setQ(e.target.value)
          }}
          onKeyDown={(e) => e.key === 'Enter' && list[0] && choose(list[0])}
        />
      </div>
      {open && (
        <div className="picker-list">
          {list.length === 0 ? (
            <p className="picker-empty">결과 없음</p>
          ) : (
            list.map((it) => (
              <button key={it.name} type="button" className="picker-opt" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(it)}>
                <ItemImg src={it.image ? itemImage(it.image) : ''} fallback="·" />
                <b>{it.name}</b>
                {it.stats.length > 0 && <small>{statLine(it)}</small>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function GearCard({ slot, gear, onChange }) {
  const set = (stat, v) => onChange({ ...gear, values: { ...gear.values, [stat]: v } })
  const pick = (it) => onChange({ ...gear, name: it?.name ?? '', values: Object.fromEntries((it?.stats ?? []).map(({ stat, value }) => [stat, value])) })
  const img = gear.name ? items.find((i) => i.name === gear.name)?.image : undefined
  return (
    <div className="gear">
      <div className="gear-head">
        <ItemImg src={img ? itemImage(img) : ''} fallback={slot.icon} />
        <ItemPicker category={slot.category} value={gear.name} label={slot.label} onPick={pick} />
        {gear.name && (
          <button type="button" className="x-btn" aria-label={`${slot.label} 비우기`} onClick={() => pick(null)}>
            ×
          </button>
        )}
        {slot.enhance && (
          <label className="gear-enh">
            <small>강화</small>
            <select aria-label={`${slot.label} 강화`} value={gear.enhance} onChange={(e) => onChange({ ...gear, enhance: Number(e.target.value) })}>
              {Array.from({ length: 11 }, (_, i) => (
                <option key={i} value={i}>
                  +{i}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="gear-stats">
        {slot.stats.map((s) => (
          <div key={s} className="gear-stat">
            <span>{s}</span>
            <button type="button" aria-label={`${s} 1 낮추기`} onClick={() => set(s, (gear.values[s] ?? 0) - 1)}>
              −
            </button>
            <NumInput aria-label={`${slot.label} ${s}`} value={gear.values[s] ?? 0} onValue={(v) => set(s, v)} />
            <button type="button" aria-label={`${s} 1 높이기`} onClick={() => set(s, (gear.values[s] ?? 0) + 1)}>
              +
            </button>
          </div>
        ))}
      </div>
      {slot.enhance && <p className="muted small">강화 +{gear.enhance} — {gear.enhance > 0 ? enhance.bonus[slot.enhance][gear.enhance - 1] : '추가 보너스 없음'}</p>}
    </div>
  )
}

export default function StatPage() {
  const [alloc, setAlloc] = useState([0, 0, 0, 0])
  const [gears, setGears] = useState(SLOTS.map(() => EMPTY_GEAR))
  const [ridePet, setRidePet] = useState(null)
  const [rideLv, setRideLv] = useState(140)
  const [petStats, setPetStats] = useState({ hp: 0, atk: 0, def: 0, agi: 0 })
  const [edited, setEdited] = useState(false)
  const [presets, setPresets] = useState(() => store.get(PRESET_KEY, {}))
  const [name, setName] = useState('')
  const [chosen, setChosen] = useState('')
  const base = fromAlloc(alloc)
  const gear = useMemo(() => gearTotal(gears), [gears])
  const final = { ...gear, hp: base.hp + gear.hp, atk: base.atk + gear.atk, def: base.def + gear.def, agi: base.agi + gear.agi }
  const std = ridePet ? standardStats(ridePet, rideLv) : null
  const hasRide = ridePet !== null || MAIN.some(({ key }) => petStats[key] > 0)
  const mounted = hasRide ? mount(final, petStats) : null
  const points = alloc.reduce((s, x) => s + x, 0)
  const pickRide = (p) => {
    setRidePet(p)
    setPetStats(standardStats(p, rideLv))
    setEdited(false)
  }
  const savePresets = (v) => {
    setPresets(v)
    store.set(PRESET_KEY, v)
  }
  return (
    <div className="stack wide">
      <Panel title="프리셋" icon="💾">
        <div className="btn-row">
          <input className="text-in" aria-label="프리셋 이름" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            type="button"
            className="btn btn-fire btn-sm"
            disabled={!name.trim()}
            onClick={() => {
              const n = name.trim()
              savePresets({ ...presets, [n]: { alloc, gear: gears } })
              setChosen(n)
              setName('')
            }}
          >
            저장
          </button>
          <select aria-label="불러올 프리셋" value={chosen} onChange={(e) => setChosen(e.target.value)}>
            <option value="">불러올 프리셋</option>
            {Object.keys(presets).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!chosen}
            onClick={() => {
              const p = presets[chosen]
              if (p) {
                setAlloc(p.alloc)
                setGears(p.gear)
              }
            }}
          >
            불러오기
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!chosen}
            onClick={() => {
              const next = { ...presets }
              delete next[chosen]
              savePresets(next)
              setChosen('')
            }}
          >
            삭제
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm danger"
            onClick={() => {
              setAlloc([0, 0, 0, 0])
              setGears(SLOTS.map(() => EMPTY_GEAR))
              setRidePet(null)
              setPetStats({ hp: 0, atk: 0, def: 0, agi: 0 })
              setEdited(false)
            }}
          >
            초기화
          </button>
        </div>
      </Panel>

      <Panel title="능력치 · 체완건순 → 최종" icon="⚔️">
        <h3 className="sub">찍은 능력치</h3>
        <div className="four">
          {ALLOC.map(({ label, mark }, i) => (
            <label key={label} className="alloc">
              <span>
                {label} <em>{mark}</em>
              </span>
              <NumInput min={0} value={alloc[i]} onValue={(v) => setAlloc(alloc.map((x, k) => (k === i ? v : x)))} />
            </label>
          ))}
        </div>
        <p className="pill-line">
          분배한 포인트 <b>{points.toLocaleString('ko-KR')} pt</b>
        </p>
        <h3 className="sub">
          최종 스탯 <small className="muted">(장비·강화 포함)</small>
        </h3>
        <div className="four">
          {MAIN.map(({ key, label }) => (
            <div key={key} className="final">
              <span>{label}</span>
              <b>{Math.floor(final[key]).toLocaleString('ko-KR')}</b>
              <small>
                기본 {Math.floor(base[key])} · 장비 {signed(gear[key])}
              </small>
            </div>
          ))}
        </div>
        <div className="five">
          {SUBS.map(({ key, label }) => (
            <div key={key}>
              <span>{label}</span>
              <b>{final[key]}</b>
              <small>{signed(gear[key])}</small>
            </div>
          ))}
        </div>
        <Note warn>환생 포인트의 소수점 때문에 ±1 오차가 날 수 있습니다.</Note>
      </Panel>

      <h2 className="band">장비 옵션 · {SLOTS.length}슬롯</h2>
      <div className="gear-grid">
        {SLOTS.map((s, i) => (
          <GearCard key={i} slot={s} gear={gears[i]} onChange={(g) => setGears(gears.map((x, k) => (k === i ? g : x)))} />
        ))}
      </div>

      <Panel title="탑승 · 캐릭 70% + 펫 50%" icon="🐎">
        <div className="ride-bar">
          <PetPicker label="탑승 펫 검색" placeholder="탑승 펫 이름 또는 초성" selected={ridePet?.name} allow={canRide} onPick={pickRide} />
          <label className="inline-field">
            <span>펫 레벨</span>
            <NumInput
              min={1}
              max={140}
              value={rideLv}
              onValue={(v) => {
                setRideLv(v)
                if (ridePet && !edited) setPetStats(standardStats(ridePet, v))
              }}
            />
          </label>
          {hasRide && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setRidePet(null)
                setPetStats({ hp: 0, atk: 0, def: 0, agi: 0 })
                setEdited(false)
              }}
            >
              내리기
            </button>
          )}
        </div>
        <h3 className="sub">
          펫 능력치 <small className="muted">{ridePet ? `${ridePet.name} Lv.${rideLv} S랭크 평균입니다. 내 펫 스탯으로 바꾸세요.` : '펫을 고르거나 직접 넣으세요.'}</small>
          {ridePet && edited && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => pickRide(ridePet)}>
              평균으로 되돌리기
            </button>
          )}
        </h3>
        <div className="four">
          {MAIN.map(({ key, label }) => (
            <label key={key} className="alloc">
              <span>
                {label}
                {std && <span className={`diff ${signClass(petStats[key] - std[key])}`}>{signed(petStats[key] - std[key])}</span>}
              </span>
              <NumInput
                min={0}
                aria-label={`탑승 펫 ${label}`}
                value={petStats[key]}
                onValue={(v) => {
                  setPetStats({ ...petStats, [key]: v })
                  setEdited(true)
                }}
              />
            </label>
          ))}
        </div>
        {mounted && (
          <div className="four">
            {MAIN.map(({ key, label }) => (
              <div key={key} className="final is-hot">
                <span>탑승 후 {label}</span>
                <b>{mounted[key].toLocaleString('ko-KR')}</b>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

