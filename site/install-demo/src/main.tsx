import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { useReducedMotion } from '../kit/reduced-motion'
import { STEP_COUNT, Walkthrough } from './Walkthrough'
import type { OS } from './os'
import './host.css'

// The landing page's install walkthrough. The page's own markup carries the
// OS tabs, the command and the written steps (readable without JS); this
// mounts the animated scene and its controls, and drives the step list.

const host = document.getElementById('iw')
const mount = document.getElementById('iw-stage')
const HOLD = 1500

function App({ host }: { host: HTMLElement }) {
  const items = useRef(Array.from(host.querySelectorAll<HTMLElement>('[data-step]')))
  const [os, setOs] = useState<OS>((host.dataset.os as OS) || 'mac')
  const [step, setStep] = useState(0)
  const [auto, setAuto] = useState(true)
  const [ended, setEnded] = useState(false)
  const reduced = useReducedMotion()
  const autoRef = useRef(auto)
  autoRef.current = auto && !reduced
  const timer = useRef(0)
  // The last step whose animation finished, so Play can move on from it
  const finished = useRef(-1)

  const advance = useCallback((k: number, wait: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (!autoRef.current) return
      if (k < STEP_COUNT - 1) setStep(k + 1)
      else {
        setAuto(false)
        setEnded(true)
      }
    }, wait)
  }, [])

  const go = useCallback((i: number) => {
    window.clearTimeout(timer.current)
    finished.current = -1
    setAuto(false)
    setEnded(false)
    setStep(Math.max(0, Math.min(STEP_COUNT - 1, i)))
  }, [])

  // The OS tabs live in the page; a switch starts the walkthrough over
  useEffect(() => {
    const onOs = (e: Event) => {
      window.clearTimeout(timer.current)
      finished.current = -1
      setOs((e as CustomEvent<OS>).detail)
      setStep(0)
      setEnded(false)
      setAuto(true)
    }
    host.addEventListener('iw:os', onOs)
    return () => host.removeEventListener('iw:os', onOs)
  }, [host])

  // The written steps double as the step picker
  useEffect(() => {
    const offs = items.current.map((li, i) => {
      li.tabIndex = 0
      li.setAttribute('role', 'button')
      const click = () => go(i)
      const key = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          go(i)
        }
      }
      li.addEventListener('click', click)
      li.addEventListener('keydown', key)
      return () => {
        li.removeEventListener('click', click)
        li.removeEventListener('keydown', key)
      }
    })
    return () => offs.forEach((off) => off())
  }, [go])

  useEffect(() => {
    items.current.forEach((li, i) => {
      li.toggleAttribute('data-active', i === step)
      li.toggleAttribute('data-done', i < step)
      if (i === step) li.setAttribute('aria-current', 'step')
      else li.removeAttribute('aria-current')
    })
    host.dataset.step = String(step)
  }, [host, step])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onDone = useCallback(
    (k: number) => {
      finished.current = k
      if (autoRef.current) advance(k, HOLD)
    },
    [advance],
  )

  const toggle = () => {
    window.clearTimeout(timer.current)
    if (ended) {
      finished.current = -1
      setEnded(false)
      setStep(0)
      setAuto(true)
      return
    }
    const next = !auto
    setAuto(next)
    autoRef.current = next
    if (next && finished.current === step) advance(step, 300)
  }

  const playing = auto && !reduced
  return (
    <>
      <Walkthrough key={os} os={os} step={step} onDone={onDone} />
      <div className="iwc">
        <button type="button" className="iwc-btn" onClick={() => go(step - 1)} disabled={step === 0} aria-label="Previous step">
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
        <div className="iwc-dots" role="group" aria-label="Steps">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              className="iwc-dot"
              data-active={i === step || undefined}
              data-done={i < step || undefined}
              aria-label={`Step ${i + 1}`}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => go(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button type="button" className="iwc-btn" onClick={() => go(step + 1)} disabled={step === STEP_COUNT - 1} aria-label="Next step">
          <ChevronRight size={16} strokeWidth={2} />
        </button>
        {!reduced && (
          <button type="button" className="iwc-play" onClick={toggle} aria-label={ended ? 'Replay' : playing ? 'Pause' : 'Play'}>
            {ended ? <RotateCcw size={14} strokeWidth={2} /> : playing ? <Pause size={14} strokeWidth={2} /> : <Play size={14} strokeWidth={2} />}
            <span>{ended ? 'Replay' : playing ? 'Pause' : 'Play'}</span>
          </button>
        )}
      </div>
    </>
  )
}

if (host && mount) {
  mount.textContent = ''
  host.setAttribute('data-live', '')
  createRoot(mount).render(<App host={host} />)
}
