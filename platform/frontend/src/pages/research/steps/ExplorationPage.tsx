import { useEffect, useRef, useState } from 'react'
import { Network, Layers, ArrowRight, MousePointerClick } from 'lucide-react'
import type { Patient } from '../types'
import { VIBRANT, CLINICAL } from '../themes'
import RelationalChart from '../ehr/RelationalChart'
import TraditionalChart from '../ehr/TraditionalChart'

export interface ExplorationMetrics {
  style: 'neon' | 'generic'
  order_index: number
  duration_ms: number
  scroll_depth_pct: number
  click_count: number
  relational_clicks: number
  nonrelational_clicks: number
  relational_attention_ms: number
  nonrelational_attention_ms: number
  mouse_distance_px: number
  gaze_available: boolean
}

interface Props {
  styleName: 'neon' | 'generic'
  orderIndex: number
  totalPages: number
  patient: Patient
  onComplete: (m: ExplorationMetrics) => void
}

const MIN_EXPLORE_MS = 8000
const TICK_MS = 250

// Page-level chrome per condition (the manipulated styling variable).
const PAGE_STYLE = {
  neon: {
    page: { background: '#0f1115', color: '#e6e9ef' },
    accent: '#c4ff4d', sub: 'rgba(230,233,239,0.6)',
    badgeBg: '#c4ff4d', badgeFg: '#111111',
    cardBorder: 'rgba(196,255,77,0.25)',
    label: '#c4ff4d',
    btnBg: '#c4ff4d', btnFg: '#111111',
    chartTheme: VIBRANT,
    name: 'Neon',
  },
  generic: {
    page: { background: '#f4f5f7', color: '#1f2937' },
    accent: '#475569', sub: '#6b7280',
    badgeBg: '#e2e8f0', badgeFg: '#334155',
    cardBorder: '#e2e8f0',
    label: '#475569',
    btnBg: '#334155', btnFg: '#ffffff',
    chartTheme: CLINICAL,
    name: 'Generic',
  },
} as const

/**
 * One instrumented free-exploration page. Renders a non-relational (siloed) and
 * a relational (linked) section in the page's visual style and records clicks,
 * scroll depth, time, per-section attention (viewport + hover dwell), and mouse
 * travel. Gaze is reserved for a future webcam layer (blocked by current CSP).
 */
export default function ExplorationPage({ styleName, orderIndex, totalPages, patient, onComplete }: Props) {
  const cfg = PAGE_STYLE[styleName]
  const [remaining, setRemaining] = useState(Math.ceil(MIN_EXPLORE_MS / 1000))

  // Section order alternates per page to reduce within-page order bias.
  const relationalFirst = orderIndex % 2 === 1

  const start = useRef(Date.now())
  const clicks = useRef({ total: 0, relational: 0, nonrelational: 0 })
  const attention = useRef({ relational: 0, nonrelational: 0 })
  const ratios = useRef({ relational: 0, nonrelational: 0 })
  const hovered = useRef<'relational' | 'nonrelational' | null>(null)
  const maxScroll = useRef(0)
  const mouseDist = useRef(0)
  const lastPt = useRef<{ x: number; y: number } | null>(null)

  const relRef = useRef<HTMLDivElement | null>(null)
  const nonRef = useRef<HTMLDivElement | null>(null)

  // Attention ticker: credit the hovered section, else the most-visible one.
  useEffect(() => {
    const t = setInterval(() => {
      let active = hovered.current
      if (!active) {
        const r = ratios.current
        if (r.relational > 0 || r.nonrelational > 0) {
          active = r.relational >= r.nonrelational ? 'relational' : 'nonrelational'
        }
      }
      if (active) attention.current[active] += TICK_MS
    }, TICK_MS)
    return () => clearInterval(t)
  }, [])

  // Min-explore countdown (gates the Continue button).
  useEffect(() => {
    const t = setInterval(() => {
      const left = Math.max(0, MIN_EXPLORE_MS - (Date.now() - start.current))
      setRemaining(Math.ceil(left / 1000))
      if (left <= 0) clearInterval(t)
    }, 250)
    return () => clearInterval(t)
  }, [])

  // Viewport visibility per section.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.target === relRef.current) ratios.current.relational = e.intersectionRatio
          if (e.target === nonRef.current) ratios.current.nonrelational = e.intersectionRatio
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    if (relRef.current) obs.observe(relRef.current)
    if (nonRef.current) obs.observe(nonRef.current)
    return () => obs.disconnect()
  }, [])

  // Scroll depth + mouse travel (window-level).
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement
      const denom = Math.max(1, doc.scrollHeight - window.innerHeight)
      const pct = Math.min(100, Math.round((window.scrollY / denom) * 100))
      if (pct > maxScroll.current) maxScroll.current = pct
    }
    const onMove = (e: PointerEvent) => {
      const p = lastPt.current
      if (p) mouseDist.current += Math.hypot(e.clientX - p.x, e.clientY - p.y)
      lastPt.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  const finish = () => {
    onComplete({
      style: styleName,
      order_index: orderIndex,
      duration_ms: Date.now() - start.current,
      scroll_depth_pct: maxScroll.current,
      click_count: clicks.current.total,
      relational_clicks: clicks.current.relational,
      nonrelational_clicks: clicks.current.nonrelational,
      relational_attention_ms: attention.current.relational,
      nonrelational_attention_ms: attention.current.nonrelational,
      mouse_distance_px: Math.round(mouseDist.current),
      gaze_available: false,
    })
  }

  const sectionProps = (kind: 'relational' | 'nonrelational') => ({
    ref: (kind === 'relational' ? relRef : nonRef) as any,
    onMouseEnter: () => { hovered.current = kind },
    onMouseLeave: () => { if (hovered.current === kind) hovered.current = null },
    onClickCapture: () => { clicks.current.total += 1; clicks.current[kind] += 1 },
  })

  const Relational = (
    <section {...sectionProps('relational')}>
      <SectionLabel icon={Network} label="Linked view" color={cfg.label} sub={cfg.sub} />
      <RelationalChart patient={patient} theme={cfg.chartTheme} />
    </section>
  )
  const NonRelational = (
    <section {...sectionProps('nonrelational')}>
      <SectionLabel icon={Layers} label="Standard view" color={cfg.label} sub={cfg.sub} />
      <TraditionalChart patient={patient} theme={cfg.chartTheme} />
    </section>
  )

  return (
    <div className="min-h-screen px-5 py-8" style={cfg.page}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: cfg.accent }}>
            Explore · page {orderIndex + 1} of {totalPages}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: cfg.sub }}>
            <MousePointerClick className="w-3.5 h-3.5" /> attention tracked
          </span>
        </div>
        <h2 className="text-[26px] sm:text-[32px] font-bold tracking-tight mb-1.5">Explore this patient chart freely</h2>
        <p className="text-[14px] mb-7 max-w-xl" style={{ color: cfg.sub }}>
          Take a moment to look around both views below — click items, switch tabs, scroll.
          There are no wrong moves; we're studying how you naturally explore.
        </p>

        <div className="space-y-7">
          {relationalFirst ? <>{Relational}{NonRelational}</> : <>{NonRelational}{Relational}</>}
        </div>

        <div className="sticky bottom-0 mt-8 -mx-5 px-5 py-4" style={{ background: `linear-gradient(to top, ${cfg.page.background} 70%, transparent)` }}>
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <span className="text-[12px]" style={{ color: cfg.sub }}>
              {remaining > 0 ? `Keep exploring… (${remaining}s)` : 'Ready when you are.'}
            </span>
            <button
              onClick={finish}
              disabled={remaining > 0}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[14px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: cfg.btnBg, color: cfg.btnFg }}
            >
              {orderIndex + 1 < totalPages ? 'Next page' : 'Continue'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ icon: Icon, label, color, sub }: { icon: any; label: string; color: string; sub: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color }}>
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      <span className="text-[11px]" style={{ color: sub }}>· explore it</span>
    </div>
  )
}
