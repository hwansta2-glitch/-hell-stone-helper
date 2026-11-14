import { useEffect, useRef, useState } from 'react'
import logo from './assets/logo.js'
import { DragonPage, HwanPage, LevelHwanPage } from './pages/Hwan'
import TransPage from './pages/Trans'
import { ExpPage, GrowthPage, PoisonPage, SellPage } from './pages/Calc'
import StatPage from './pages/Stat'
import { ComparePage, FamiliesPage, ItemsPage, MapPage, PetsPage, RidesPage } from './pages/Dex'
import { DropsPage, QuizPage, ReversePage, SimPage } from './pages/Tools'
import EnhancePage from './pages/Enhance'
import { DuelPage, OrderPage } from './pages/Duel'
import { SubmitPage, ReviewPage } from './pages/Submit'
import UnenhancePage from './pages/Unenhance'
import { store } from './lib/format'
import { dataVersion, mergeEntries, subscribeData } from './lib/data'
import { fetchEntries } from './lib/api'
import { useSyncExternalStore } from 'react'

const MENU = [
  {
    label: '계산',
    pages: [
      { id: 'hwan', label: '환각 계산', view: (p) => <HwanPage key={p} petName={p} /> },
      { id: 'levelhwan', label: '레벨업 환각', view: () => <LevelHwanPage /> },
      { id: 'dragon', label: '멸룡 판독', view: () => <DragonPage /> },
      { id: 'trans', label: '환포 계산', view: () => <TransPage /> },
      { id: 'exp', label: '경험치 계산', view: () => <ExpPage /> },
      { id: 'poison', label: '독딜 계산', view: () => <PoisonPage /> },
      { id: 'sell', label: '판매 계산', view: () => <SellPage /> },
      { id: 'growth', label: '성장률 계산', view: () => <GrowthPage /> },
      { id: 'stat', label: '스탯 계산', view: () => <StatPage /> },
    ],
  },
  {
    label: '도감',
    pages: [
      { id: 'pets', label: '펫 도감', view: () => <PetsPage /> },
      { id: 'families', label: '계열 도감', view: () => <FamiliesPage /> },
      { id: 'rides', label: '탑승 도감', view: () => <RidesPage /> },
      { id: 'items', label: '아이템 도감', view: () => <ItemsPage /> },
      { id: 'compare', label: '펫 비교', view: () => <ComparePage /> },
      { id: 'map', label: '월드맵', view: () => <MapPage /> },
    ],
  },
  {
    label: '도구',
    pages: [
      { id: 'sim', label: '펫 시뮬레이터', view: () => <SimPage /> },
      { id: 'enhance', label: '강화 시뮬레이터', view: () => <EnhancePage /> },
      { id: 'drops', label: '득템 시뮬레이터', view: () => <DropsPage /> },
      { id: 'quiz', label: '퀴즈 도우미', view: () => <QuizPage /> },
      { id: 'reverse', label: '스탯 역산', view: () => <ReversePage /> },
      { id: 'unenhance', label: '강화 역산', view: () => <UnenhancePage /> },
      { id: 'duel', label: '듀얼 도우미', view: () => <DuelPage /> },
      { id: 'order', label: '듀얼오더 도우미', view: () => <OrderPage /> },
    ],
  },
]
const HIDDEN = [
  { id: 'submit', label: '도감 추가하기', view: (p) => <SubmitPage key={p} kind={p === 'item' ? 'item' : 'pet'} /> },
  { id: 'review', label: '승인 관리', view: () => <ReviewPage /> },
]
const ALL = [...MENU.flatMap((g) => g.pages), ...HIDDEN]
const THEME_KEY = 'hellstone-theme'
const safeDecode = (s) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return ''
  }
}
function readHash() {
  const [id, param = ''] = window.location.hash.slice(1).split('/')
  return { page: ALL.find((p) => p.id === id) ?? ALL[0], param: safeDecode(param) }
}

export default function App() {
  const [{ page, param }, setRoute] = useState(readHash)
  const [openMenu, setOpenMenu] = useState(null)
  const [mobile, setMobile] = useState(false)
  const [theme, setTheme] = useState(() => store.get(THEME_KEY, 'dark'))
  const [reset, setReset] = useState(0)
  const nav = useRef(null)
  const ver = useSyncExternalStore(subscribeData, dataVersion)
  useEffect(() => {
    fetchEntries().then((e) => e && mergeEntries(e))
  }, [])
  useEffect(() => {
    const onHash = () => {
      setRoute(readHash())
      setOpenMenu(null)
      setMobile(false)
      window.scrollTo(0, 0)
    }
    const onClick = (e) => nav.current?.contains(e.target) || (setOpenMenu(null), setMobile(false))
    const onKey = (e) => e.key === 'Escape' && (setOpenMenu(null), setMobile(false))
    window.addEventListener('hashchange', onHash)
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('hashchange', onHash)
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.title = `${page.label} · 지옥 부족 스톤 헬퍼`
    store.set(THEME_KEY, theme)
  }, [theme, page])
  const group = MENU.find((g) => g.pages.includes(page))
  return (
    <div className="site">
      <div className="embers" aria-hidden="true" />
      <header className="topbar" ref={nav}>
        <a
          className="brand"
          href="#hwan"
          onClick={() => {
            setReset(reset + 1)
            window.scrollTo(0, 0)
          }}
        >
          <img className="brand-mark" src={logo} alt="" />
          <span>
            지옥 부족 <em>스톤 헬퍼</em>
          </span>
        </a>
        <nav className="menu" aria-label="메뉴">
          {MENU.map((g) => (
            <div key={g.label} className="menu-item">
              <button
                type="button"
                className={g === group ? 'menu-btn is-on' : 'menu-btn'}
                aria-haspopup="true"
                aria-expanded={openMenu === g.label}
                onClick={() => setOpenMenu(openMenu === g.label ? null : g.label)}
              >
                {g === group ? page.label : g.label} <i>▾</i>
              </button>
              {openMenu === g.label && (
                <div className="menu-drop">
                  {g.pages.map((p) => (
                    <a key={p.id} href={`#${p.id}`} aria-current={p === page ? 'page' : undefined}>
                      {p.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <button type="button" className={mobile ? 'burger is-open' : 'burger'} aria-label="메뉴 열기" aria-expanded={mobile} onClick={() => setMobile(!mobile)}>
          <span />
          <span />
          <span />
        </button>
        <InstallButton />
        <button type="button" className="theme-btn" aria-label={theme === 'dark' ? '밝은 화면으로' : '어두운 화면으로'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        {mobile && (
          <nav className="mobile-menu" aria-label="메뉴">
            {MENU.map((g) => (
              <div key={g.label} role="group" aria-label={g.label}>
                <p>{g.label}</p>
                {g.pages.map((p) => (
                  <a key={p.id} href={`#${p.id}`} aria-current={p === page ? 'page' : undefined}>
                    {p.label}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        )}
      </header>
      <main className="main" key={`${page.id}${reset}/${ver}`}>
        {page.view(param)}
      </main>
      <footer className="foot">
        스톤에이지 팬 도구 · 수치는 커뮤니티 자료 기준이며 실제와 다를 수 있습니다 · <a href="#submit/pet">도감 추가하기</a> · <a href="#review">관리자</a>
      </footer>
    </div>
  )
}

// PWA 설치 버튼: 크롬/엣지(데스크톱·안드로이드)는 네이티브 설치 프롬프트,
// iOS 사파리는 '홈 화면에 추가' 안내를 띄운다.
function InstallButton() {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [hint, setHint] = useState(false)
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setDeferred(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
      setHint(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || standalone) return null
  // 설치 프롬프트도 없고 iOS도 아니면(이미 설치했거나 미지원 브라우저) 버튼 숨김
  if (!deferred && !isIOS) return null

  const onClick = async () => {
    if (deferred) {
      deferred.prompt()
      try {
        await deferred.userChoice
      } catch (e) {}
      setDeferred(null)
      return
    }
    setHint((v) => !v)
  }

  return (
    <div className="install-wrap">
      <button type="button" className="install-btn" onClick={onClick} aria-haspopup={isIOS ? 'dialog' : undefined} aria-expanded={isIOS ? hint : undefined}>
        <span aria-hidden="true">📥</span> 앱 설치
      </button>
      {isIOS && hint && (
        <div className="install-hint" role="dialog" aria-label="홈 화면에 추가 방법">
          <b>홈 화면에 추가</b>
          <p>
            사파리 아래쪽 <b>공유</b> <span aria-hidden="true">⬆️</span> 버튼을 누르고 <b>‘홈 화면에 추가’</b>를 선택하세요.
          </p>
          <button type="button" className="install-hint-x" onClick={() => setHint(false)}>
            닫기
          </button>
        </div>
      )}
    </div>
  )
}
