import { useEffect, useMemo, useState } from 'react'
import { itemImage, items } from '../lib/data'
import { ENHANCE_LEVELS, ENHANCEABLE, enhanceBonus, reverseFields, toBase } from '../lib/enhance'
import { signedPlain } from '../lib/format'
import { matches } from '../lib/search'
import { ItemImg, Note, NumInput, Panel } from '../components/ui'

const SHORT = { 공격: '공', 방어: '방', 순발: '순', 내구: '내' }
const shortName = (s) => SHORT[s] ?? s
const ENHANCE_CATS = Object.keys(ENHANCEABLE)
const CAT_ICON = { 무기: '⚔️', 투구: '🪖', 갑옷: '🛡️' }

// "공격 +9 · 관통 5 · 명중 5"
const bonusText = (kind, level) => {
  if (level === 0) return '없음'
  const b = enhanceBonus(kind, level)
  const map = kind === '무기' ? [['공격', b.atk], ['관통', b.pierce], ['명중', b.hit]] : [['방어', b.def], ['쉴드', b.shield], ['내구', b.hp]]
  return map.filter(([, v]) => v).map(([k, v]) => `${k} +${v}`).join(' · ')
}
const qualityTag = (q) => {
  if (q === null) return null
  if (q >= 0.999) return { label: '맥옵', tone: 'max' }
  if (q <= 0.001) return { label: '최저', tone: 'min' }
  return { label: `상위 ${Math.round((1 - q) * 100)}%`, tone: 'mid' }
}

function ItemSearch({ onPick }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const list = useMemo(() => (q ? items.filter((it) => ENHANCE_CATS.includes(it.category) && matches(it.name, q)).slice(0, 20) : []), [q])
  const choose = (it) => {
    onPick(it)
    setQ('')
    setOpen(false)
  }
  return (
    <div className="picker">
      <div className="picker-field">
        <span className="picker-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          type="search"
          aria-label="아이템 검색"
          placeholder="아이템 이름으로 검색 (무기·투구·갑옷)"
          value={q}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            setOpen(true)
            setQ(e.target.value)
          }}
          onKeyDown={(e) => e.key === 'Enter' && list[0] && choose(list[0])}
        />
      </div>
      {open && q && (
        <div className="picker-list">
          {list.length === 0 ? (
            <p className="picker-empty">강화 가능한 아이템이 없어요</p>
          ) : (
            list.map((it) => (
              <button type="button" key={it.name} className="picker-opt" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(it)}>
                <ItemImg src={it.image ? itemImage(it.image) : ''} fallback={CAT_ICON[it.category]} />
                <b>{it.name}</b>
                <small>{it.category}</small>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function UnenhancePage() {
  const [item, setItem] = useState(null)
  const [level, setLevel] = useState(6)
  const [inputs, setInputs] = useState({}) // stat -> 현재 표시값 (랜덤 옵션만)
  const { kind, fields } = useMemo(() => (item ? reverseFields(item, level) : { kind: null, fields: [] }), [item, level])
  const editable = fields.filter((f) => !f.fixed)

  // 아이템이나 강화수치가 바뀌면 입력값을 맥옵(최대)으로 맞춘다
  useEffect(() => {
    if (!item) return
    setInputs(Object.fromEntries(editable.map((f) => [f.stat, f.rangeMax + f.bonus])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, level])

  const rows = fields.map((f) => toBase(f, f.fixed ? undefined : inputs[f.stat]))
  const setAll = (pickMax) => setInputs(Object.fromEntries(editable.map((f) => [f.stat, (pickMax ? f.rangeMax : f.rangeMin) + f.bonus])))
  const oneLine = (which) => rows.map((r) => `${shortName(r.stat)}${signedPlain(r[which])}`).join(' ')

  // 전체 평가: 랜덤 옵션들의 평균 품질
  const qualities = rows.filter((r) => r.quality !== null).map((r) => r.quality)
  const avgQ = qualities.length ? qualities.reduce((a, b) => a + b, 0) / qualities.length : null
  const verdict = avgQ === null ? null : avgQ >= 0.999 ? '맥옵 아이템 ✨' : avgQ <= 0.001 ? '최저옵 아이템' : `맥옵 대비 상위 ${Math.round((1 - avgQ) * 100)}%`

  return (
    <div className="stack wide">
      <Panel title="아이템 검색" icon="🔍">
        <ItemSearch onPick={setItem} />
        {item && (
          <div className="picked">
            <div className="pet-frame">
              <ItemImg src={item.image ? itemImage(item.image) : ''} fallback={CAT_ICON[item.category]} className="big-item" />
            </div>
            <div>
              <h3>{item.name}</h3>
              <div className="tags">
                <span className="tag">
                  {CAT_ICON[item.category]} {item.category}
                </span>
                <span className="tag">강화 → {kind}</span>
              </div>
              {item.source && <p className="muted small">획득: {item.source}</p>}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setItem(null)}>
              다시 고르기
            </button>
          </div>
        )}
      </Panel>

      {item && (
        <div className="split">
          <Panel title={`강화한 ${item.name}`} icon={CAT_ICON[item.category]}>
            <label className="inline-field">
              <span>강화 수치</span>
              <select value={level} onChange={(e) => setLevel(Number(e.target.value))} aria-label="강화 수치">
                {ENHANCE_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l === 0 ? '+0 (기본)' : `+${l}`}
                  </option>
                ))}
              </select>
              <small className="muted">강화 보너스: {bonusText(kind, level)}</small>
            </label>

            {editable.length > 0 ? (
              <>
                <h3 className="sub">
                  지금 아이템의 랜덤 옵션 <small className="muted">(범위 안에서만 입력)</small>
                </h3>
                <div className="field-row">
                  {editable.map((f) => {
                    const lo = f.rangeMin + f.bonus
                    const hi = f.rangeMax + f.bonus
                    return (
                      <label key={f.stat} className="range-field">
                        <span>
                          {f.stat}
                          {f.affected && <em className="hot-mark"> ★</em>}
                        </span>
                        <NumInput min={lo} max={hi} aria-label={f.stat} value={inputs[f.stat] ?? hi} onValue={(v) => setInputs((p) => ({ ...p, [f.stat]: v }))} />
                        <small className="muted">
                          {lo} ~ {hi}
                        </small>
                      </label>
                    )
                  })}
                </div>
                <div className="btn-row">
                  <button type="button" className="btn btn-gold btn-sm" onClick={() => setAll(true)}>
                    맥옵으로
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAll(false)}>
                    최저옵으로
                  </button>
                </div>
                <Note>★ 표시된 옵션만 강화로 올라가요. 범위를 벗어나는 값은 자동으로 맞춰집니다.</Note>
              </>
            ) : (
              <Note>이 아이템은 옵션이 고정이에요. 강화 수치만 고르면 +0 값이 바로 나옵니다.</Note>
            )}
          </Panel>

          <div className="col">
            <Panel title="강화 전(+0) 옵션" icon="↩️">
              <div className="table-wrap">
                <table className="table center striped">
                  <thead>
                    <tr>
                      <th>옵션</th>
                      <th>현재 (+{level})</th>
                      <th>강화 보너스</th>
                      <th>+0 기본값</th>
                      <th>옵션 평가</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const tag = qualityTag(r.quality)
                      return (
                        <tr key={r.stat} className={r.affected ? 'hot' : undefined}>
                          <th>{r.stat}</th>
                          <td>{signedPlain(r.shown)}</td>
                          <td>{r.bonus ? `−${r.bonus}` : '−'}</td>
                          <td>
                            <b>{signedPlain(r.base)}</b>
                          </td>
                          <td>
                            {r.fixed ? (
                              <span className="muted">고정</span>
                            ) : (
                              <>
                                <span className="muted small">
                                  {r.rangeMin}~{r.rangeMax}
                                </span>{' '}
                                {tag && <span className={`roll-tag is-${tag.tone}`}>{tag.label}</span>}
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title="강화 전(+0) 능력치" icon="📋">
              <p className="one-line accent">{oneLine('base')}</p>
              <p className="one-line gap-line">
                맥옵 {rows.filter((r) => !r.fixed).map((r) => `${shortName(r.stat)} ${signedPlain(r.base - r.rangeMax)}`).join(' / ')}
              </p>
              <div className="cmp-chips">
                {rows.map((r) => {
                  const atMax = !r.fixed && r.base >= r.rangeMax
                  return (
                    <div key={r.stat} className={`cmp-chip${r.fixed ? ' is-fixed' : atMax ? ' is-max' : ''}`}>
                      <span>{r.stat}</span>
                      <b>{signedPlain(r.base)}</b>
                      {!r.fixed && (
                        <small>
                          맥옵 {signedPlain(r.rangeMax)}
                          {atMax && ' ✓'}
                        </small>
                      )}
                    </div>
                  )
                })}
              </div>
              {verdict && (
                <p className={`cmp-verdict ${avgQ >= 0.999 ? 'is-max' : avgQ <= 0.001 ? 'is-min' : ''}`}>
                  맥옵과 비교 — <b>{verdict}</b>
                </p>
              )}
            </Panel>
          </div>
        </div>
      )}

      {!item && <Note>투구·갑옷·무기만 강화할 수 있어요. 아이템을 검색해 고르면 옵션 입력칸이 나옵니다.</Note>}
    </div>
  )
}
