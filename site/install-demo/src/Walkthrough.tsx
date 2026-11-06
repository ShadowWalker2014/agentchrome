import { useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Check,
  Download,
  EllipsisVertical,
  FileText,
  Folder,
  House,
  Menu as MenuIcon,
  Minus,
  Monitor,
  Pin,
  Plus,
  Puzzle,
  RotateCw,
  Search,
  Settings,
  Square,
  Star,
  X,
} from 'lucide-react'
import { Stage } from '../kit/stage'
import { Bar } from '../kit/window'
import { Collapse } from '../kit/motion/Collapse'
import { Popover } from '../kit/motion/Popover'
import { States } from '../kit/motion/States'
import { Swap } from '../kit/motion/Swap'
import { Toggle } from '../kit/controls/Toggle'
import { Spinner } from '../kit/parts/Spinner'
import type { Act } from '../kit/act'
import type { Layout } from '../kit/looks'
import type { Point, Rect } from '../kit/measure'
import { CODE, OSES, type OS, type OSInfo } from './os'
import './walkthrough.css'

// The install, told on one desktop: copy the command from the site, paste it
// into the terminal, the installer shows the extension folder, Developer mode
// goes on, the folder is dragged into chrome://extensions, then Agent Chrome
// is pinned and the pairing code pasted into its popup. One scene, five
// steps: each step's script starts from the picture the last one ended on,
// so stepping forward never cuts, and its end state is the reduced-motion
// poster for that step.

type Ghost = { on: boolean; dropped: boolean; at: Point; off: Point }
type Front = 'chrome' | 'term' | 'files'

type S = {
  /** Stacking order, as the OS keeps it: the last window clicked is on top */
  z: Record<Front, number>
  page: 'site' | 'ext'
  copied: boolean
  front: Front
  pasted: boolean
  ran: number
  files: boolean
  sel: boolean
  dev: boolean
  ghost: Ghost
  over: boolean
  installed: boolean
  menu: boolean
  pinned: boolean
  popup: boolean
  focus: boolean
  code: string
  btn: 'idle' | 'busy' | 'done'
}

const NO_GHOST: Ghost = { on: false, dropped: false, at: { x: 0, y: 0 }, off: { x: 0, y: 0 } }

const S0: S = {
  z: { chrome: 3, term: 2, files: 1 },
  page: 'site',
  copied: false,
  front: 'chrome',
  pasted: false,
  ran: 0,
  files: false,
  sel: false,
  dev: false,
  ghost: NO_GHOST,
  over: false,
  installed: false,
  menu: false,
  pinned: false,
  popup: false,
  focus: false,
  code: '',
  btn: 'idle',
}

/** Bring a window to the front of the stack */
const raise = (s: S, w: Front): Pick<S, 'front' | 'z'> => ({ front: w, z: { ...s.z, [w]: Math.max(...Object.values(s.z)) + 1 } })

const E0: S = { ...S0, ...raise(S0, 'term'), copied: true, pasted: true, ran: 4 }
const E1: S = { ...E0, ...raise(E0, 'files'), files: true, page: 'ext', sel: true }
const E2: S = { ...E1, ...raise(E1, 'chrome'), dev: true }
const E3: S = { ...E2, ...raise({ ...E2, ...raise(E2, 'files') }, 'chrome'), installed: true }
const E4: S = { ...E3, pinned: true, popup: true, focus: true, code: CODE, btn: 'done' }

export const STEP_COUNT = 5
const START: S[] = [S0, E0, E1, E2, E3]
const END: S[] = [E0, E1, E2, E3, E4]

type Box = { x: number; y: number; w: number; h: number }
type Geo = { chrome: Box; term: Box; files: Box; hidden: number; drop: Point; rest: Point }

const GEO: Record<Layout, Geo> = {
  wide: {
    chrome: { x: 40, y: 40, w: 700, h: 600 },
    term: { x: 560, y: 96, w: 400, h: 520 },
    files: { x: 600, y: 300, w: 460, h: 320 },
    hidden: 600,
    drop: { x: 300, y: 456 },
    rest: { x: 470, y: 512 },
  },
  compact: {
    chrome: { x: 12, y: 12, w: 318, h: 520 },
    term: { x: 12, y: 188, w: 318, h: 330 },
    files: { x: 12, y: 232, w: 318, h: 300 },
    hidden: 500,
    drop: { x: 150, y: 176 },
    rest: { x: 286, y: 450 },
  },
}

const inside = (r: Rect, p: Point) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height

type StepScript = (a: Act<S>, os: OSInfo) => Promise<void>

const STEPS: StepScript[] = [
  // 1. Copy the command on the site, paste it into the terminal, run it
  async (a, os) => {
    await a.wait(500)
    await a.move({ at: 'copy', x: 0.62, y: 0.62 })
    await a.wait(150)
    await a.click()
    await a.set({ copied: true })
    await a.wait(650)
    await a.move({ at: 'term-body', x: 0.62, y: 0.42 })
    await a.click()
    await a.set((s) => raise(s, 'term'))
    await a.wait(350)
    a.mark('paste')
    await a.key(os.paste)
    await a.set({ pasted: true })
    await a.wait(550)
    await a.key(os.enter)
    await a.wait(650)
    for (let i = 1; i <= 4; i++) {
      await a.set({ ran: i })
      await a.wait(i === 3 ? 520 : 380)
    }
    await a.move('rest')
    await a.wait(900)
  },
  // 2. The installer shows the folder in the file manager and opens chrome://extensions
  async (a) => {
    await a.wait(500)
    a.mark('files')
    await a.set((s) => ({ ...raise(s, 'files'), files: true, page: 'ext', sel: true }))
    await a.wait(2600)
  },
  // 3. Developer mode on
  async (a) => {
    await a.wait(400)
    await a.move({ at: 'ext-head', x: 0.3, y: 0.5 })
    await a.click()
    await a.set((s) => raise(s, 'chrome'))
    await a.wait(350)
    await a.move({ at: 'dev', x: 0.62, y: 0.55 })
    await a.wait(120)
    await a.click()
    a.mark('dev')
    await a.set({ dev: true })
    await a.wait(1100)
    await a.move('rest')
    await a.wait(700)
  },
  // 4. Drag the folder onto the page
  async (a) => {
    await a.wait(400)
    if (a.layout === 'wide') {
      await a.move({ at: 'files-bar', x: 0.62, y: 0.5 })
      await a.click()
    }
    await a.set((s) => raise(s, 'files'))
    await a.wait(500)
    const icon = a.rect('folder-icon')
    const grab = { x: icon.x + icon.width / 2, y: icon.y + icon.height / 2 + 1 }
    await a.move(grab)
    await a.wait(200)
    const off = { x: grab.x - icon.x, y: grab.y - icon.y }
    const page = a.rect('page')
    const drop = a.center('drop')
    a.mark('drag')
    await a.drag(
      drop,
      (at) => {
        const files = a.rect('files')
        a.put({ ghost: { on: true, dropped: false, at, off }, over: inside(page, at) && !inside(files, at) })
      },
      { duration: 1300, cursor: 'preserve' },
    )
    a.mark('drop')
    await a.set((s) => ({ ghost: { ...s.ghost, dropped: true }, over: false, installed: true }))
    await a.wait(700)
    await a.set({ ghost: NO_GHOST })
    await a.move('page-blank')
    await a.click()
    await a.set((s) => raise(s, 'chrome'))
    await a.wait(900)
    await a.move('rest')
    await a.wait(500)
  },
  // 5. Pin it, open it, paste the pairing code, connect
  async (a, os) => {
    await a.wait(400)
    await a.move({ at: 'puzzle', x: 0.5, y: 0.55 })
    await a.click()
    a.mark('menu')
    await a.set({ menu: true })
    await a.wait(700)
    await a.move({ at: 'pin', x: 0.5, y: 0.5 })
    await a.wait(120)
    await a.click()
    await a.set({ pinned: true })
    await a.wait(800)
    await a.move({ at: 'ac-icon', x: 0.5, y: 0.5 })
    await a.click()
    a.mark('popup')
    await a.set({ menu: false, popup: true })
    await a.wait(700)
    await a.move({ at: 'code', x: 0.86, y: 0.62 })
    await a.click()
    await a.set({ focus: true })
    await a.wait(300)
    await a.key(os.paste)
    await a.set({ code: CODE })
    await a.wait(600)
    await a.move({ at: 'connect', x: 0.84, y: 0.62 })
    await a.click()
    await a.set({ btn: 'busy' })
    await a.wait(900)
    a.mark('connected')
    await a.set({ btn: 'done' })
    await a.wait(500)
    await a.move('rest')
    await a.wait(1800)
  },
]

export function Walkthrough({ os: osId, step, onDone }: { os: OS; step: number; onDone: (step: number) => void }) {
  const os = OSES[osId]
  const done = useRef(onDone)
  done.current = onDone
  const script = useMemo(
    () => async (a: Act<S>) => {
      await STEPS[step](a, os)
      done.current(step)
    },
    [step, os],
  )

  return (
    <Stage<S>
      width={1000}
      height={560}
      compact={{ below: 760, width: 342, height: 480 }}
      initial={START[step]}
      poster={END[step]}
      script={script}
      play="once"
      accent="#2F6BFF"
      cursor={{ at: 'rest', ripple: true }}
      keys="bottom"
      className={`iw iw--${osId}`}
    >
      {(s, _rect, layout) => {
        const g = GEO[layout]
        return (
          <>
            <div className="iw-desk" aria-hidden />
            <ChromeWindow s={s} os={os} g={g} layout={layout} />
            <TerminalWindow s={s} os={os} g={g} layout={layout} />
            <FilesWindow s={s} os={os} g={g} layout={layout} />
            <DragImage ghost={s.ghost} />
            <span className="iw-mark" data-target="rest" style={{ left: g.rest.x, top: g.rest.y }} />
            <span className="iw-mark" data-target="drop" style={{ left: g.drop.x, top: g.drop.y }} />
          </>
        )
      }}
    </Stage>
  )
}

/* ---------- shared chrome ---------- */

const place = (b: Box, y = b.y): CSSProperties => ({ left: b.x, top: b.y, width: b.w, height: b.h, transform: y === b.y ? undefined : `translateY(${y - b.y}px)` })

function Lights() {
  return (
    <span className="iw-lights" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  )
}

/** Windows and GNOME draw their window buttons on the right. */
function Controls({ os }: { os: OSInfo }) {
  const small = os.id === 'linux'
  return (
    <span className="iw-ctrls" data-os={os.id} aria-hidden>
      <span>
        <Minus size={small ? 11 : 13} strokeWidth={1.5} />
      </span>
      <span>
        <Square size={small ? 9 : 11} strokeWidth={1.5} />
      </span>
      <span data-close>
        <X size={small ? 11 : 13} strokeWidth={1.5} />
      </span>
    </span>
  )
}

export function Logo({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 128 128" width={size} height={size} aria-hidden className="iw-logo">
      <rect width="128" height="128" rx="30" fill="#2F6BFF" />
      <path d="M28 46V38a10 10 0 0 1 10-10h8M82 28h8a10 10 0 0 1 10 10v8M100 82v8a10 10 0 0 1-10 10h-8M46 100h-8a10 10 0 0 1-10-10v-8" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
      <path d="M56 50.5v30.2c0 1.3 1.6 1.9 2.5 1l6.9-6.8 5.2 11.6c.4.8 1.3 1.2 2.1.8l3.8-1.7c.8-.4 1.2-1.3.8-2.1l-5.2-11.5h10c1.3 0 2-1.6 1-2.5L58.5 49.5c-.9-.9-2.5-.3-2.5 1z" fill="#fff" />
    </svg>
  )
}

function FolderIcon({ size = 18 }: { size?: number }) {
  return <Folder size={size} strokeWidth={1.4} className="iw-folder" />
}

/* ---------- Chrome ---------- */

function ChromeWindow({ s, os, g, layout }: { s: S; os: OSInfo; g: Geo; layout: Layout }) {
  const wide = layout === 'wide'
  const site = s.page === 'site'
  return (
    <div className="iw-win iw-chrome" data-target="chrome" data-front={s.front === 'chrome' || undefined} style={{ ...place(g.chrome), zIndex: s.z.chrome }}>
      <div className="iw-tabstrip">
        {os.id === 'mac' && <Lights />}
        <span className="iw-tab">
          <Swap id={s.page} className="iw-tab-ic">
            {site ? <Logo size={14} /> : <Puzzle size={14} strokeWidth={1.75} />}
          </Swap>
          <Swap id={s.page} className="iw-tab-t">
            {site ? 'Agent Chrome' : 'Extensions'}
          </Swap>
          <X size={12} strokeWidth={1.75} className="iw-tab-x" />
        </span>
        <span className="iw-newtab">
          <Plus size={14} strokeWidth={1.75} />
        </span>
        <span className="iw-spacer" />
        {os.id === 'mac' ? (
          <span className="iw-tabsearch">
            <ChevronDown size={14} strokeWidth={1.75} />
          </span>
        ) : (
          <Controls os={os} />
        )}
      </div>
      <div className="iw-toolbar">
        <ArrowLeft size={16} strokeWidth={1.75} />
        {wide && <ArrowRight size={16} strokeWidth={1.75} className="iw-off" />}
        <RotateCw size={16} strokeWidth={1.75} />
        <span className="iw-omni">
          <Swap id={s.page}>{site ? 'agentchrome.dev' : 'chrome://extensions'}</Swap>
          <span className="iw-spacer" />
          <Star size={16} strokeWidth={1.75} className="iw-faint" />
        </span>
        <span className="iw-pinslot" data-on={s.pinned || undefined}>
          <span className="iw-tbtn" data-target="ac-icon" data-open={s.popup || undefined}>
            <Logo size={16} />
          </span>
        </span>
        <span className="iw-tbtn" data-target="puzzle" data-open={s.menu || undefined}>
          <Puzzle size={16} strokeWidth={1.75} />
        </span>
        {wide && <span className="iw-avatar" />}
        <span className="iw-tbtn iw-kebab">
          <EllipsisVertical size={16} strokeWidth={1.75} />
        </span>
      </div>
      <div className="iw-page" data-target="page">
        <div className="iw-site" data-show={site || undefined}>
          <SitePage s={s} os={os} />
        </div>
        <div className="iw-ext" data-show={!site || undefined}>
          <ExtensionsPage s={s} wide={wide} />
        </div>
        <div className="iw-dropzone" data-show={s.over || undefined}>
          <span>Drop to install</span>
        </div>
      </div>
      <Popover show={s.menu} origin="top right" className="iw-menu">
        <div className="iw-menu-head">Extensions</div>
        <div className="iw-menu-row">
          <Logo size={16} />
          <span className="iw-menu-name">Agent Chrome</span>
          <span className="iw-pin" data-target="pin" data-on={s.pinned || undefined}>
            <Pin size={14} strokeWidth={1.75} />
          </span>
          <EllipsisVertical size={14} strokeWidth={1.75} className="iw-faint" />
        </div>
        <div className="iw-menu-sep" />
        <div className="iw-menu-row iw-menu-manage">
          <Settings size={14} strokeWidth={1.75} className="iw-faint" />
          <span>Manage extensions</span>
        </div>
      </Popover>
      <Popover show={s.popup} origin="top right" className="iw-popup">
        <Popup s={s} />
      </Popover>
    </div>
  )
}

const DIM: CSSProperties = { background: 'rgba(255, 255, 255, 0.16)' }
const LIT: CSSProperties = { background: 'rgba(255, 255, 255, 0.82)' }

function SitePage({ s, os }: { s: S; os: OSInfo }) {
  return (
    <div className="iw-site-in">
      <div className="iw-site-nav">
        <Logo size={14} />
        <Bar w={56} h={6} style={DIM} />
        <span className="iw-spacer" />
        <Bar w={28} h={5} style={DIM} />
        <Bar w={28} h={5} style={DIM} />
      </div>
      <div className="iw-site-hero">
        <Bar w={260} h={14} r={4} style={LIT} />
        <Bar w={190} h={14} r={4} style={LIT} className="iw-site-h2" />
        <Bar w={300} h={6} style={DIM} className="iw-site-lead" />
        <div className="iw-site-cmd">
          <span className="iw-site-cmd-t">
            <b>{os.id === 'win' ? '>' : '$'}</b>
            {os.command}
          </span>
          <span className="iw-site-copy" data-target="copy" data-on={s.copied || undefined}>
            <States value={s.copied ? 'done' : 'copy'} states={{ copy: 'Copy', done: 'Copied' }} />
          </span>
        </div>
        <div className="iw-site-demo">
          <div className="iw-site-demo-bar">
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    </div>
  )
}

function ExtensionsPage({ s, wide }: { s: S; wide: boolean }) {
  return (
    <div className="iw-ext-in">
      <div className="iw-ext-head" data-target="ext-head">
        <MenuIcon size={16} strokeWidth={1.75} className="iw-faint" />
        <span className="iw-ext-title">Extensions</span>
        {wide && (
          <span className="iw-search">
            <Search size={13} strokeWidth={1.75} />
            <Bar w={92} h={5} tone={2} />
          </span>
        )}
        <span className="iw-spacer" />
        <span className="iw-dev">
          <span>Developer mode</span>
          <Toggle on={s.dev} data-target="dev" />
        </span>
      </div>
      <Collapse open={s.dev}>
        <div className="iw-devbar">
          <span className="iw-devbtn">Load unpacked</span>
          <span className="iw-devbtn">Pack extension</span>
          <span className="iw-devbtn">Update</span>
        </div>
      </Collapse>
      <div className="iw-cards">
        <Collapse open={s.installed} reveal="drop">
          <div className="iw-card iw-card--ours">
            <div className="iw-card-top">
              <Logo size={36} />
              <div className="iw-card-text">
                <div className="iw-card-name">
                  Agent Chrome <span>0.1.3</span>
                </div>
                <div className="iw-card-desc">Your agents, in your own Chrome</div>
              </div>
            </div>
            <div className="iw-card-foot">
              <span className="iw-cardbtn">Details</span>
              <span className="iw-cardbtn">Remove</span>
              <span className="iw-spacer" />
              <Toggle on />
            </div>
          </div>
        </Collapse>
        <div className="iw-card">
          <div className="iw-card-top">
            <span className="iw-card-ic" />
            <div className="iw-card-text">
              <Bar w={96} h={7} tone={3} />
              <Bar w={168} h={5} tone={2} className="iw-card-sub" />
            </div>
          </div>
          <div className="iw-card-foot">
            <Bar w={44} h={22} r={11} tone={1} />
            <Bar w={52} h={22} r={11} tone={1} />
            <span className="iw-spacer" />
            <Toggle on />
          </div>
        </div>
        <span className="iw-blank" data-target="page-blank" />
      </div>
    </div>
  )
}

function Popup({ s }: { s: S }) {
  const connected = s.btn === 'done'
  return (
    <div className="iw-pop">
      <div className="iw-pop-top">
        <Logo size={20} />
        <span className="iw-pop-name">Agent Chrome</span>
        <span className="iw-status" data-on={connected || undefined}>
          <i />
          <Swap id={connected ? 'on' : 'off'}>{connected ? 'Connected' : 'Not connected'}</Swap>
        </span>
      </div>
      <div className="iw-pop-h">Connect this Chrome profile</div>
      <div className="iw-pop-label">Pairing code</div>
      <div className="iw-code" data-target="code" data-cursor="ibeam" data-focus={s.focus || undefined}>
        {s.code ? <span className="iw-code-v">{s.code}</span> : <span className="iw-code-ph">XXXXX-XXXXX</span>}
      </div>
      <div className="iw-connect" data-target="connect" data-state={s.btn}>
        <States
          value={s.btn}
          states={{
            idle: 'Connect',
            busy: <Spinner size={14} />,
            done: (
              <span className="iw-connect-done">
                <Check size={14} strokeWidth={2.25} />
                Connected
              </span>
            ),
          }}
        />
      </div>
    </div>
  )
}

/* ---------- Terminal ---------- */

function TerminalWindow({ s, os, g, layout }: { s: S; os: OSInfo; g: Geo; layout: Layout }) {
  const front = s.front === 'term'
  const y = layout === 'compact' ? (front ? g.term.y : g.hidden) : g.term.y
  const lines: ReactNode[] = [
    <>
      <b>✓</b> Created your account
    </>,
    <>
      <b>✓</b> Added to Claude Code, Codex, Cursor
    </>,
    <>
      <b>✓</b> Saved to {os.folderPath}
    </>,
    <>
      Pairing code <em>{CODE}</em> <i>(copied)</i>
    </>,
  ]
  return (
    <div className="iw-win iw-term" data-os={os.id} data-front={front || undefined} style={{ ...place(g.term, y), zIndex: s.z.term }}>
      <div className="iw-titlebar">
        {os.id === 'mac' && <Lights />}
        <span className="iw-title">{os.termTitle}</span>
        {os.id !== 'mac' && <Controls os={os} />}
      </div>
      <div className="iw-term-body" data-target="term-body" data-cursor="ibeam">
        <div className="iw-line">
          <span className="iw-prompt">{os.prompt}</span> <span className="iw-cmd" data-snap data-on={s.pasted || undefined}>{os.command}</span>
          <span className="iw-caret" data-snap data-on={!s.ran || undefined} />
        </div>
        {lines.map((l, i) => (
          <div key={i} className="iw-line iw-out" data-on={s.ran > i || undefined}>
            {l}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Files ---------- */

const ROWS = [
  { kind: 'folder', w: 64 },
  { kind: 'doc', w: 96 },
  { kind: 'folder', w: 52 },
  { kind: 'doc', w: 84 },
  { kind: 'doc', w: 72 },
  { kind: 'folder', w: 88 },
] as const

function FilesWindow({ s, os, g, layout }: { s: S; os: OSInfo; g: Geo; layout: Layout }) {
  const front = s.front === 'files'
  const wide = layout === 'wide'
  const y = wide ? (s.files ? g.files.y : g.hidden) : front ? g.files.y : g.hidden
  const icons = [
    os.id === 'linux' ? <House key={0} size={14} strokeWidth={1.6} /> : <Monitor key={0} size={14} strokeWidth={1.6} />,
    <FileText key={1} size={14} strokeWidth={1.6} />,
    <Download key={2} size={14} strokeWidth={1.6} />,
  ]
  return (
    <div className="iw-win iw-files" data-os={os.id} data-target="files" data-front={front || undefined} style={{ ...place(g.files, y), zIndex: s.z.files }}>
      <div className="iw-titlebar" data-target="files-bar">
        {os.id === 'mac' && <Lights />}
        <span className="iw-title iw-title--strong">
          {os.id === 'win' && <FileText size={14} strokeWidth={1.6} />}
          {os.filesTitle}
        </span>
        {os.id !== 'mac' && <Controls os={os} />}
      </div>
      <div className="iw-files-body">
        {wide && (
          <div className="iw-side">
            {os.side.map((name, i) => (
              <div key={name} className="iw-side-item" data-current={name === 'Documents' || undefined}>
                {icons[i]}
                {name}
              </div>
            ))}
            <Bar w={52} h={5} tone={2} className="iw-side-bar" />
            <Bar w={64} h={5} tone={2} className="iw-side-bar" />
          </div>
        )}
        <div className="iw-list">
          <div className="iw-row iw-row--ours" data-target="folder" data-sel={s.sel || undefined}>
            <span data-target="folder-icon" className="iw-row-ic">
              <FolderIcon />
            </span>
            Agent Chrome
          </div>
          {ROWS.map((r, i) => (
            <div key={i} className="iw-row">
              <span className="iw-row-ic">{r.kind === 'folder' ? <FolderIcon /> : <FileText size={16} strokeWidth={1.4} className="iw-doc" />}</span>
              <Bar w={r.w} h={6} tone={2} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DragImage({ ghost }: { ghost: Ghost }) {
  return (
    <div
      className="iw-ghost"
      data-on={ghost.on || undefined}
      data-dropped={ghost.dropped || undefined}
      style={{ transform: `translate(${ghost.at.x - ghost.off.x}px, ${ghost.at.y - ghost.off.y}px)` }}
      aria-hidden
    >
      <span className="iw-row-ic">
        <FolderIcon />
      </span>
      <span className="iw-ghost-t">Agent Chrome</span>
    </div>
  )
}
