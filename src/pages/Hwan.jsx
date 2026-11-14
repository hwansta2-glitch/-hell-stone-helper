import { useState } from 'react'
import { attrText, pets, TIER_ICON } from '../lib/data'
import { calcHwan, calcLevelHwan, hwanMessage, levelMessage, standardStats, TOTAL_CASES } from '../lib/hwan'
import { cappedPct, floorTo, pct, signClass, signed, smartPct, chancePct, store } from '../lib/format'
import { judgeDragon, TOP_N } from '../lib/dragon'
import { NumInput, Note, paginate, Panel, PetImg, PetPicker, RecentPets, useRecent } from '../components/ui'

const STATS = [
  { key: 'hp', label: '내구력' },
  { key: 'atk', label: '공격력' },
  { key: 'def', label: '방어력' },
  { key: 'agi', label: '순발력' },
]
const toInt = (s) => {
  const n = parseInt(s, 10)
  return Number.isNaN(n) ? 0 : n
}

export function PetCard({ pet }) {
  return (
    <section className="panel pet-card-big" aria-label="펫 정보">
      <div className="pet-card-top">
        <div className="pet-frame">
          <PetImg pet={pet} />
        </div>
        <div>
          <h2>
            {pet.name} <span className="pill">{attrText(pet.attrs)}</span>
          </h2>
          <p className="muted">획득: {pet.source}</p>
          <div className="tags">
            <span className="tag">{pet.ride ? '🐎 탑승' : '🚫 탑승불가'}</span>
            {pet.skillSlots != null && <span className="tag">⚔️ 기술창 {pet.skillSlots}</span>}
            <span className="tag">
              {TIER_ICON[pet.tier]} {pet.tier}
            </span>
            <span className="tag">📈 성장률 {pet.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="pet-stats">
        {STATS.map(({ key, label }) => {
          const [int, dec] = pet[key][0].toFixed(2).split('.')
          return (
            <div key={key}>
              <span>{label}</span>
              <b>
                {int}
                <small>.{dec}</small>
              </b>
              <small>성장 {pet[key][1].toFixed(2)}</small>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function StatSteppers({ values, base, onChange, diffTitle }) {
  return (
    <div className="steppers">
      {STATS.map(({ key, label }, i) => {
        const diff = toInt(values[i]) - base[i]
        return (
          <div key={key} className="stepper-box">
            <div className="stepper-head">
              {label}
              <span className={`diff ${signClass(diff)}`} title={diffTitle}>
                {signed(diff)}
              </span>
            </div>
            <div className="stepper">
              <button type="button" aria-label={`${label} 1 낮추기`} onClick={() => onChange(i, String(toInt(values[i]) - 1))}>
                −
              </button>
              <input type="number" aria-label={label} value={values[i]} onChange={(e) => onChange(i, e.target.value)} />
              <button type="button" aria-label={`${label} 1 높이기`} onClick={() => onChange(i, String(toInt(values[i]) + 1))}>
                +
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Intro({ title, children, onPick, recent }) {
  return (
    <section className="hero">
      <div className="hero-glow" aria-hidden="true" />
      <h1>{title}</h1>
      <p>{children}</p>
      <div className="hero-search">
        <PetPicker big button label="펫 검색" placeholder="펫 이름 또는 초성으로 검색하세요" onPick={onPick} />
        <p className="muted small">
          <kbd>ㅂㄹ</kbd> 초성 검색 · {pets.length}마리 데이터
        </p>
      </div>
      <RecentPets recent={recent} onPick={onPick} />
    </section>
  )
}

/* ---------------- 환각 계산기 ---------------- */
const floorBase = (pet) => STATS.map(({ key }) => Math.floor(pet[key][0]))

export function HwanPage({ petName }) {
  const [pet, setPet] = useState(() => pets.find((p) => p.name === petName) ?? null)
  const [vals, setVals] = useState(() => (pet ? floorBase(pet).map(String) : ['0', '0', '0', '0']))
  const [result, setResult] = useState(null)
  const [round, setRound] = useState(0)
  const { recent, remember } = useRecent()
  const pick = (p) => {
    setPet(p)
    setVals(floorBase(p).map(String))
    setResult(null)
    remember(p.name)
  }
  if (!pet)
    return (
      <Intro title="환각 계산기" onPick={pick} recent={recent}>
        펫을 고르고 1레벨 스탯을 맞춘 뒤 등급과 환각 확률을 확인하세요
      </Intro>
    )
  const base = floorBase(pet)
  const offsets = vals.map((v, i) => toInt(v) - base[i])
  return (
    <div className="split">
      <div className="col">
        <div className="panel pad">
          <PetPicker button label="다른 펫 검색" placeholder="다른 펫 검색" onPick={pick} />
        </div>
        <PetCard pet={pet} />
        <Panel title="1레벨 스탯 입력" icon="⚡">
          <StatSteppers values={vals} base={base} onChange={(i, v) => setVals(vals.map((x, k) => (k === i ? v : x)))} />
          <button
            type="button"
            className="btn btn-fire btn-block"
            onClick={() => {
              setResult(calcHwan(pet, offsets))
              setRound(round + 1)
            }}
          >
            계산하기
          </button>
        </Panel>
      </div>
      <div className="col">{result ? <HwanResult key={round} result={result} /> : <EmptyResult text="스탯을 맞추고 계산하기를 누르세요" />}</div>
    </div>
  )
}

const EmptyResult = ({ text }) => (
  <section className="panel">
    <p className="empty big">
      <span aria-hidden="true">🔥</span>
      {text}
    </p>
  </section>
)

function BigRate({ text, prob }) {
  return <span className={`big-rate is-${prob}`}>{text}</span>
}

function HwanResult({ result: r }) {
  if (r.total === 0)
    return (
      <section className="panel verdict">
        <p className="verdict-none">일치하는 조합을 찾을 수 없습니다.</p>
        <p className="muted">스탯이 이 펫의 1레벨 범위를 벗어났습니다. 입력을 확인하세요.</p>
      </section>
    )
  const hit = r.hwanCount > 0
  const m = hwanMessage(r.hwanRate, r.bestGrade)
  return (
    <>
      <section className="panel verdict" aria-label="환각 확률">
        {hit ? (
          <div className="verdict-line">
            <span className="chip-hot">🌀 8등급 환각</span>
            <BigRate text={cappedPct(r.hwanRate)} prob={m.prob} />
          </div>
        ) : (
          <div className="verdict-line">
            <span className="chip-cold">최고 {r.bestGrade}등급</span>
            <BigRate text="0%" prob="low" />
          </div>
        )}
        {hit && <p className="muted">등장 확률 {smartPct(r.appearRate)}</p>}
        <p className={`verdict-msg is-${m.tone}`}>{m.message}</p>
        {hit ? (
          <>
            <p className="muted small">기대 시도 횟수 약 {floorTo(1 / r.hwanRate, 1).toFixed(1)}회</p>
            <p className="muted small">보너스 배분 확률까지 반영하면 {cappedPct(r.weightedHwanRate)}</p>
          </>
        ) : (
          <p className="muted small">스탯을 S랭크 기준에 가깝게 맞춰 보세요</p>
        )}
        <div className="facts">
          <span>
            최고 등급 <b>{r.bestGrade}등급</b>
          </span>
          <span>
            매칭 <b>{r.total.toLocaleString('ko-KR')}</b>
          </span>
          {hit ? (
            <span>
              환각 <b>{r.hwanCount}</b>
            </span>
          ) : (
            <span>
              등장확률 <b>{smartPct(r.appearRate)}</b>
            </span>
          )}
        </div>
      </section>
      <HwanDetail result={r} />
      <section className="panel total-line">
        <span>총 매칭 건수</span>
        <b>
          {r.total.toLocaleString('ko-KR')} / {TOTAL_CASES.toLocaleString('ko-KR')}건
        </b>
      </section>
    </>
  )
}

const DETAIL_KEY = 'hellstone-hwan-detail'
const ROWS_PER_PAGE = 10
const ROWS_MAX = 300
function GradeBars({ grades, valueOf, labelOf }) {
  const top = Math.max(...grades.map(valueOf))
  return (
    <ul className="grade-bars">
      {grades.map((g) => (
        <li key={g.grade}>
          <span>{g.grade}등급</span>
          <span className="bar-track">
            <i className={`bar-fill g${Math.max(1, Math.min(8, g.grade))}`} style={{ width: `${(valueOf(g) / top) * 100}%` }}>
              {pct(g.share, 1)}
            </i>
          </span>
          <span className="muted small">{labelOf(g)}</span>
        </li>
      ))}
    </ul>
  )
}
function HwanDetail({ result: r }) {
  const [detail, setDetail] = useState(() => store.get(DETAIL_KEY, true))
  const [page, setPage] = useState(1)
  const pg = paginate(r.rows.slice(0, ROWS_MAX), page, ROWS_PER_PAGE)
  return (
    <Panel
      title={detail ? '상세 조합' : '등급 분포'}
      icon={detail ? '🌀' : '📈'}
      aside={
        <label className="switch">
          상세 조합
          <input
            type="checkbox"
            checked={detail}
            onChange={(e) => {
              setDetail(e.target.checked)
              store.set(DETAIL_KEY, e.target.checked)
            }}
          />
          <i />
        </label>
      }
    >
      {detail ? (
        <>
          <p className="legend small">
            <span className="mini base">2</span> 등급 보정 <span className="mini bonus">3</span> 보너스
          </p>
          <div className="table-wrap">
            <table className="table center striped">
              <thead>
                <tr>
                  <th>#</th>
                  <th>등급</th>
                  {STATS.map((s) => (
                    <th key={s.key}>{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pg.rows.map((row, i) => (
                  <tr key={i}>
                    <th>{(pg.page - 1) * ROWS_PER_PAGE + i + 1}</th>
                    <td>{row.grade}</td>
                    {row.values.map((v, k) => (
                      <td key={k}>
                        {floorTo(v, 2).toFixed(2)}
                        <span className="mini base">{row.base[k]}</span>
                        <span className="mini bonus">{row.bonus[k]}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mini-pager">
            <button type="button" disabled={pg.page <= 1} onClick={() => setPage(pg.page - 1)} aria-label="이전 쪽">
              ‹
            </button>
            <span>
              {pg.page} / {pg.pageCount}
            </span>
            <button type="button" disabled={pg.page >= pg.pageCount} onClick={() => setPage(pg.page + 1)} aria-label="다음 쪽">
              ›
            </button>
          </div>
        </>
      ) : (
        <GradeBars grades={r.grades} valueOf={(g) => g.count} labelOf={(g) => `${g.count.toLocaleString('ko-KR')}건`} />
      )}
    </Panel>
  )
}

/* ---------------- 레벨 + 스탯 입력 공통 틀 ---------------- */
const asArray = (pet, level) => {
  const s = standardStats(pet, level)
  return [s.hp, s.atk, s.def, s.agi]
}
function LevelStatTool({ title, intro, submit, empty, compute, Report, defaultLevel = 60 }) {
  const [pet, setPet] = useState(null)
  const [level, setLevel] = useState(defaultLevel)
  const [vals, setVals] = useState(['0', '0', '0', '0'])
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const { recent, remember } = useRecent()
  const pick = (p) => {
    setPet(p)
    setVals(asArray(p, level).map(String))
    setRes(null)
    remember(p.name)
  }
  if (!pet)
    return (
      <Intro title={title} onPick={pick} recent={recent}>
        {intro}
      </Intro>
    )
  const std = asArray(pet, level)
  return (
    <div className="split">
      <div className="col">
        <div className="panel pad">
          <PetPicker button label="다른 펫 검색" placeholder="다른 펫 검색" onPick={pick} />
        </div>
        <PetCard pet={pet} />
        <Panel title="지금 레벨과 스탯" icon="⚡">
          <label className="inline-field">
            <span>현재 레벨</span>
            <NumInput
              min={1}
              max={140}
              aria-label="현재 레벨"
              value={level}
              onValue={(v) => {
                setLevel(v)
                setVals(asArray(pet, v).map(String))
              }}
            />
          </label>
          <Note>레벨을 바꾸면 그 레벨의 S랭크 평균 스탯이 들어갑니다. 레벨을 먼저 넣고 내 펫 스탯으로 고치세요.</Note>
          <StatSteppers values={vals} base={std} diffTitle="S랭크 평균과의 차이" onChange={(i, v) => setVals(vals.map((x, k) => (k === i ? v : x)))} />
          <button
            type="button"
            className="btn btn-fire btn-block"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              setTimeout(() => {
                setRes({ level, data: compute(pet, level, vals.map(toInt)), round: (res?.round ?? 0) + 1 })
                setBusy(false)
              }, 0)
            }}
          >
            {busy ? '계산 중…' : submit}
          </button>
        </Panel>
      </div>
      <div className="col">{res ? <Report key={res.round} level={res.level} result={res.data} /> : <EmptyResult text={empty} />}</div>
    </div>
  )
}

/* ---------------- 레벨업 환각 ---------------- */
export function LevelHwanPage() {
  return (
    <LevelStatTool
      title="레벨업 환각 계산기"
      intro="키운 펫의 지금 레벨과 스탯으로 환각(8등급)일 확률을 알아보세요"
      submit="계산하기"
      empty="레벨과 스탯을 넣고 계산하기를 누르세요"
      compute={calcLevelHwan}
      Report={LevelHwanReport}
    />
  )
}
function LevelHwanReport({ level, result: r }) {
  if (!r.plausible || r.grades.length === 0)
    return (
      <section className="panel verdict">
        <p className="verdict-none">이 레벨에서는 나오기 어려운 스탯입니다.</p>
        <p className="muted">레벨과 스탯을 다시 확인하세요. 환생했거나 스탯 아이템을 쓴 펫은 계산할 수 없습니다.</p>
      </section>
    )
  const hit = r.hwanRate >= 0.001
  const m = levelMessage(r.hwanRate, r.bestGrade)
  const best = r.grades.find((g) => g.grade === r.bestGrade)
  return (
    <>
      <section className="panel verdict">
        {hit ? (
          <div className="verdict-line">
            <span className="chip-hot">🌀 8등급 환각</span>
            <BigRate text={cappedPct(r.hwanRate)} prob={m.prob} />
          </div>
        ) : (
          <div className="verdict-line">
            <span className="chip-cold">가장 유력 {r.bestGrade}등급</span>
            <BigRate text="0%" prob="low" />
          </div>
        )}
        <p className="muted">Lv.{level} 스탯으로 본 환각 확률</p>
        <p className={`verdict-msg is-${m.tone}`}>{m.message}</p>
        {level <= 1 && <p className="muted small">환각 계산기의 &apos;보너스 배분 확률까지 반영&apos; 값과 같습니다</p>}
        <div className="facts">
          <span>
            가장 유력 <b>{r.bestGrade}등급</b>
          </span>
          {best && r.bestGrade !== 8 && (
            <span>
              그 확률 <b>{pct(best.share, 1)}</b>
            </span>
          )}
        </div>
      </section>
      <Panel title="등급별 확률" icon="📈">
        <GradeBars grades={r.grades} valueOf={(g) => g.share} labelOf={(g) => pct(g.share, 1)} />
      </Panel>
      <Note>
        레벨업 때마다 스탯이 랜덤으로 올라서 확률로 보여 줍니다. 레벨이 높을수록 정확해서, 20레벨 무렵이면 환각 펫이 절반쯤, 60레벨이면 대부분 가려집니다. 1레벨로 잡아 환생·스탯 아이템 없이 키운 펫
        기준입니다.
      </Note>
    </>
  )
}

/* ---------------- 멸룡 판독 ---------------- */
export function DragonPage() {
  return (
    <LevelStatTool
      title="멸룡급 판독기"
      intro="키운 펫이 최대 능력치에 얼마나 가까운지 S급 정석과 최대치 사이에서 판독해요"
      defaultLevel={140}
      submit="🐉 판독하기"
      empty="레벨과 스탯을 넣고 판독하기를 누르세요"
      compute={judgeDragon}
      Report={DragonReport}
    />
  )
}
const PROB_OF = { gold: 'high', mint: 'mid', plain: 'low', low: 'low' }
const TONE_OF = { gold: 'success', mint: 'encourage', plain: 'encourage', low: 'fail' }
const closeText = (c) => (c > 1 ? '100%+' : `${Math.round(c * 100)}%`)
function DragonReport({ level, result: r }) {
  if (!r.plausible)
    return (
      <section className="panel verdict">
        <p className="verdict-none">이 레벨에서는 나오기 어려운 스탯입니다.</p>
        <p className="muted">스탯 아이템을 쓴 펫은 판독할 수 없어요. 환생한 펫이면 (환생) 펫을 골라 주세요.</p>
      </section>
    )
  const t = r.tier
  const head = t.name === '멸룡급' ? { text: '멸룡', need: 6 } : t.name === '준멸룡급' ? { text: '준멸룡', need: 3 } : null
  return (
    <>
      <section className="panel verdict">
        <div className="verdict-line">
          <span className={t.tone === 'gold' ? 'chip-hot' : 'chip-cold'}>
            {t.emoji} {t.name}
          </span>
          <BigRate text={head ? head.text : closeText(r.closeness)} prob={PROB_OF[t.tone]} />
        </div>
        <p className="muted">{head ? `Lv.${level} 정석 대비 내구·능력치 합 모두 +${head.need} 이상` : `Lv.${level} 최대 근접도 (S급 정석 0% · 최대 100%)`}</p>
        {r.stats.every((s) => s.value >= s.max) && <p className="max-hit">🏆 최대치 도달!</p>}
        <p className={`verdict-msg is-${TONE_OF[t.tone]}`}>{t.message}</p>
        <div className="facts">
          <span>
            정석 대비 내구 <b>{signed(r.hpGain)}</b>
          </span>
          <span>
            공·방·순 합 <b>{signed(r.statGain)}</b>
          </span>
          <span>
            S급 가운데 <b>상위 {chancePct(r.top)}</b>
          </span>
          {r.rebornFrom && (
            <span>
              환생 보정치 <b>포함</b>
            </span>
          )}
        </div>
        {r.rebornFrom && <p className="muted small">140레벨에 환생한 {r.rebornFrom}의 보정치(S급 정석 초과분)까지 넣어 판독했어요.</p>}
      </section>
      <Panel title="스탯별 판독" icon="📊">
        <div className="table-wrap">
          <table className="table center striped">
            <thead>
              <tr>
                <th>스탯</th>
                <th>내 펫</th>
                <th>정석</th>
                <th>최대</th>
                <th>근접도</th>
                <th>상위%</th>
              </tr>
            </thead>
            <tbody>
              {r.stats.map((s) => (
                <tr key={s.label}>
                  <th>{s.label}</th>
                  <td>
                    <b>{s.value.toLocaleString('ko-KR')}</b>
                  </td>
                  <td>{s.standard.toLocaleString('ko-KR')}</td>
                  <td>{s.max.toLocaleString('ko-KR')}</td>
                  <td className={s.closeness >= 0.5 ? 'good' : s.closeness < 0 ? 'bad' : undefined}>{s.value >= s.max ? '🏆 최대' : closeText(s.closeness)}</td>
                  <td>{chancePct(s.top)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Note>
        정석은 도감 S랭크 성장으로 계산한 값, 최대는 같은 펫을 S급(환각)으로 잡아 이 레벨까지 키웠을 때 {TOP_N.toLocaleString('ko-KR')}마리 중 가장 좋은 한 마리 수준이에요. 정석 대비 내구 +6 이상이면서 공·방·순 합
        +6 이상이면 멸룡급, 둘 다 +3 이상이면 준멸룡급, 둘 다 −3 이상이면 S급 정석이에요. 스탯 아이템 없이 키운 펫 기준입니다.
      </Note>
    </>
  )
}
