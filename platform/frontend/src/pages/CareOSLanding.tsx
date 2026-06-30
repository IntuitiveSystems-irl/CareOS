/**
 * CareOS landing page — adelt.io flavor.
 *
 * Visual language references:
 *   - https://www.adelt.io/#approach (color-blocked sections, big rounded
 *     sans, numbered steps, simple layouts, pill CTAs, lots of air)
 *   - https://vibrant.noomoagency.com (motion / live data choreography)
 *   - https://www.farmminerals.com/promo (numerical claim hero pattern)
 *
 * Palette (CSS variables — see <style/> at bottom):
 *   ink           #111111  primary text + dark sections
 *   bone          #f7f3eb  off-white baseline
 *   lime          #c4ff4d  vibrant green — "live", "action"
 *   coral         #ff6b5b  warm coral — burden / clinician overflow
 *   sky           #4d80ff  electric blue — cloud / interop
 *   sunny         #ffd23f  yellow — proof / evidence
 *   blush         #ffd1d1  pastel pink — soft accents
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import {
  ArrowRight, ArrowUpRight, Cloud, Cpu, Eye, Lock,
} from 'lucide-react'
import { api } from '../api'
import careosLogo from '../assets/careos-logo.png'
import InquireModal from '../components/InquireModal'

// ── Live data hooks ────────────────────────────────────────────────────────

type RelayStatus = {
  ok: boolean
  kek_fingerprint?: string
  started?: boolean
  listeners?: { listener_id: string; running: boolean; stats: { received: number; acked: number; errored: number } }[]
  pipelines?: Record<string, { dispatched: number; completed: number; failed: number }>
}

type AuditEntry = {
  id: number; ts: string; actor: string; action: string
  resource_type?: string | null; resource_id?: string | null
  hash_self: string
}

type BurdenStats = {
  total_runs: number
  actions_replaced: number
  hours_saved_est: number
  per_agent: Record<string, { runs: number; actions_replaced: number; minutes_saved_est: number }>
}

function useRelayStatus() {
  const [data, setData] = useState<RelayStatus | null>(null)
  useEffect(() => {
    let cancelled = false
    const fetchOnce = async () => {
      try {
        const r = await fetch('/api/relay/status')
        if (!r.ok) return
        const json = await r.json()
        if (!cancelled) setData(json)
      } catch { /* fail quiet */ }
    }
    fetchOnce()
    const t = setInterval(fetchOnce, 5000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])
  return data
}

function useRecentAudit(limit = 12) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  useEffect(() => {
    let cancelled = false
    const fetchOnce = async () => {
      try {
        const r = await fetch(`/api/relay/audit/recent?limit=${limit}`)
        if (!r.ok) return
        const json = await r.json()
        if (!cancelled) setEntries(json.entries || [])
      } catch { /* */ }
    }
    fetchOnce()
    const t = setInterval(fetchOnce, 4000)
    return () => { cancelled = true; clearInterval(t) }
  }, [limit])
  return entries
}

function useBurdenStats() {
  const [data, setData] = useState<BurdenStats | null>(null)
  useEffect(() => {
    let cancelled = false
    const fetchOnce = async () => {
      try {
        const r = await fetch('/api/careos/burden')
        if (!r.ok) return
        const json = await r.json()
        if (!cancelled) setData(json)
      } catch { /* */ }
    }
    fetchOnce()
    const t = setInterval(fetchOnce, 10000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])
  return data
}

// ── Tiny count-up helper ────────────────────────────────────────────────────

function CountUp({
  to, durationMs = 1400, suffix = '', start = true,
}: { to: number; durationMs?: number; suffix?: string; start?: boolean }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!start) return
    const t0 = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(Math.round(eased * to))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [to, durationMs, start])
  return <span>{n.toLocaleString()}{suffix}</span>
}

// ── Section heading helper ──────────────────────────────────────────────────

function Eyebrow({ children, color = '#111' }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-[0.16em] font-semibold"
         style={{ backgroundColor: 'rgba(0,0,0,0.06)', color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </div>
  )
}

// ── CareOS Logo Mark (arc + heart + speed lines) ───────────────────────────

function CareOSMark({ size = 36, bg = 'none', invert = false, className = '' }: {
  size?: number; bg?: string; invert?: boolean; className?: string
}) {
  // Renders the real CareOS logo PNG (black on transparent). On a colored
  // `bg` tile it sits with a little padding; `invert` flips it to white for
  // dark backgrounds.
  const hasTile = bg !== 'none'
  const pad = hasTile ? Math.round(size * 0.18) : 0
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: hasTile ? bg : 'transparent',
        borderRadius: hasTile ? size * 0.28 : 0,
        padding: pad,
        boxSizing: 'border-box',
      }}
    >
      <img
        src={careosLogo}
        alt="CareOS"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          filter: invert ? 'brightness(0) invert(1)' : undefined,
        }}
      />
    </span>
  )
}

// ── Header ───────────────────────────────────────────────────────────────────

function Header({ onInquire }: { onInquire: () => void }) {
  return (
    <header className="sticky top-0 z-50 bg-[#111] border-b border-white/10">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 sm:px-10 py-4">
        <Link to="/" className="flex items-center gap-3">
          <CareOSMark size={38} bg="#c4ff4d" />
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold tracking-tight text-white">CareOS</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/50 font-semibold">by LaunchFlow</span>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-white/70">
          <Link to="/relational-cds" className="hover:text-white transition">CDS</Link>
          <Link to="/fhir-standards" className="hover:text-white transition">FHIR</Link>
          <Link to="/research" className="hover:text-white transition">Research</Link>
          <Link to="/live" className="hover:text-white transition flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c4ff4d] animate-pulse"/>Live
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <button onClick={onInquire} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-semibold text-[#111] bg-[#c4ff4d] hover:bg-[#d4ff6d] transition">
            Inquire now <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}

// ── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  const status = useRelayStatus()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })
  return (
    <section ref={ref} className="relative bg-[#c4ff4d] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="grid lg:grid-cols-[1fr_auto] gap-10 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111] text-[#c4ff4d] text-[11px] uppercase tracking-[0.16em] font-bold mb-8"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#c4ff4d] animate-pulse" />
              Live · KEK {status?.kek_fingerprint?.slice(0, 8) || 'UNSET'}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="font-display text-[52px] sm:text-[80px] lg:text-[96px] leading-[0.9] tracking-[-0.03em] text-[#111] font-bold"
            >
              Clinical work that<br />works itself.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.18 }}
              className="mt-7 max-w-lg text-[18px] leading-relaxed text-[#111]/75"
            >
              Front-desk coordinators spend 4 hours re-entering data that already exists in other EHRs.
              CareOS connects those systems and assembles one complete patient record — before the coordinator arrives.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <a href="#cta" className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#111] text-white rounded-full text-[15px] font-bold hover:bg-black transition">
                Request access <ArrowRight className="w-4 h-4" />
              </a>
              <a href="#how" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/50 hover:bg-white/70 text-[#111] rounded-full text-[15px] font-bold transition border border-[#111]/20">
                See how it works
              </a>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 1, delay: 0.1 }}
            className="hidden lg:flex items-center justify-end pr-4"
          >
            <CareOSMark size={360} bg="none" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}


// ── Burden math ─────────────────────────────────────────────────────────────

function BurdenSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-25%' })
  const rows = [
    { count: 16000, label: 'Intake documents per year', detail: '4 docs × 4,000 visits — 30 min each' },
    { count: 8400, label: 'Lab order/result/chart actions', detail: '70% of patients × 3 actions per cycle' },
    { count: 5600, label: 'Rx send/fill actions', detail: '70% of patients × 2 actions per cycle' },
  ]
  return (
    <section id="problem" ref={ref} className="bg-[#ff6b5b]">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-24 sm:py-36">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <Eyebrow color="#111">The problem</Eyebrow>
            <h2 className="mt-5 font-display text-[42px] sm:text-[60px] leading-[0.95] tracking-[-0.025em] text-[#111]">
              The math<br/>doesn’t add up.
            </h2>
            <p className="mt-6 text-[16px] leading-relaxed text-[#111]/85 max-w-md">
              A 4,000-visit clinic produces ~30,000 administrative actions a
              year. Two full-time admins cover ~4,160 hours. The other
              <span className="font-bold"> 11,440 hours </span>
              fall on clinicians as overflow — the documented driver of burnout.
            </p>
          </div>
          <div className="lg:col-span-7 space-y-3">
            {rows.map((row, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.12 * i }}
                className="bg-white rounded-3xl px-7 py-7 sm:px-9 sm:py-8 flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-8"
              >
                <div className="font-display text-[60px] sm:text-[84px] leading-none tabular-nums text-[#111] tracking-[-0.035em] min-w-[200px]">
                  <CountUp to={row.count} start={inView} durationMs={1400 + i * 200} />
                </div>
                <div className="flex-1">
                  <div className="text-[16px] sm:text-[18px] font-bold text-[#111]">{row.label}</div>
                  <div className="text-[13px] text-[#111]/60 mt-1">{row.detail}</div>
                </div>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.7, delay: 0.6 }}
              className="bg-[#111] text-[#c4ff4d] rounded-3xl px-7 sm:px-9 py-7 flex items-center justify-between flex-wrap gap-3"
            >
              <div className="text-[12px] uppercase tracking-[0.18em] font-bold opacity-80">Total / year / clinic</div>
              <div className="font-display text-[40px] sm:text-[56px] tabular-nums tracking-[-0.025em]">
                <CountUp to={30000} start={inView} durationMs={2000} suffix=" actions" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── How it works (numbered steps, adelt.io style) ──────────────────────────

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15%' })
  const steps = [
    {
      n: '01',
      title: 'One record from every EHR',
      copy: 'CareOS connects to Epic, Cerner, and legacy HL7 systems simultaneously. Staff see one complete, reconciled patient record — not three portals.',
      color: '#ffd23f',  // sunny
    },
    {
      n: '02',
      title: 'Every touch is recorded',
      copy: 'Every time a record is accessed or changed, it\'s logged in a chain that can\'t be quietly edited. HIPAA-grade. Cryptographically verifiable.',
      color: '#4d80ff',  // sky
    },
    {
      n: '03',
      title: 'Workflow agents act',
      copy: 'Intake summaries, lab loop closure, Rx fulfillment — autonomous, audited, reversible.',
      color: '#ffd1d1',  // blush
    },
    {
      n: '04',
      title: 'Patient gets it back',
      copy: 'Cures-Act-compliant, USCDI v3, signed cloud-archive URLs. Patient owns the record.',
      color: '#c4ff4d',  // lime
    },
  ]
  return (
    <section id="how" ref={ref} className="bg-[#f7f3eb]">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-24 sm:py-32">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
          <div>
            <Eyebrow color="#111">The platform</Eyebrow>
            <h2 className="mt-5 font-display text-[42px] sm:text-[60px] leading-[0.95] tracking-[-0.025em] text-[#111] max-w-3xl">
              From every EHR <span className="italic">→</span> to every patient,<br />in 4 steps.
            </h2>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 * i }}
              className="rounded-3xl p-7 min-h-[260px] flex flex-col"
              style={{ backgroundColor: s.color }}
            >
              <div className="text-[14px] font-bold text-[#111]/70 tracking-tight">{s.n}</div>
              <h3 className="mt-6 font-display text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.02em] text-[#111]">
                {s.title}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-[#111]/75">{s.copy}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Patient Fishbowl™ (coined term) ────────────────────────────────────────

function FishbowlSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15%' })
  const facets = [
    {
      n: '01',
      label: 'Status',
      copy: 'Where each request, order, and result currently sits — open, in motion, blocked, or completed.',
    },
    {
      n: '02',
      label: 'Progression',
      copy: 'Sequenced events as they unfold: ordered → routed → fulfilled → reconciled.',
    },
    {
      n: '03',
      label: 'Coordination',
      copy: 'Who handed what to whom, when, and what is still owed across teams.',
    },
  ]
  return (
    <section id="fishbowl" ref={ref} className="bg-[#9ee3db]">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-24 sm:py-36">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <Eyebrow color="#0a3d3a">Coined term</Eyebrow>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7 }}
              className="mt-5 font-display text-[44px] sm:text-[68px] lg:text-[84px] leading-[0.92] tracking-[-0.03em] text-[#0a3d3a]"
            >
              Patient<br/>Fishbowl<sup className="text-[20px] sm:text-[28px] lg:text-[32px] align-super font-bold opacity-70 ml-1">™</sup>
            </motion.h2>
            <p className="mt-6 text-[17px] sm:text-[19px] leading-[1.5] text-[#0a3d3a]/85 max-w-md font-medium">
              A patient-visible workflow transparency model for healthcare coordination.
            </p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="mt-7 flex flex-wrap items-center gap-2"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#0a3d3a] text-[#9ee3db] text-[11px] uppercase tracking-[0.16em] font-bold">
                <Eye className="w-3 h-3" />
                Read-only · canonical record untouched
              </span>
              <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white text-[#0a3d3a] border border-[#0a3d3a]/20 text-[11px] uppercase tracking-[0.16em] font-bold">
                <Cpu className="w-3 h-3" />
                Deterministic · no LLM
              </span>
            </motion.div>
          </div>
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="bg-white rounded-3xl px-8 py-9 sm:px-10 sm:py-10"
            >
              <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#0a3d3a]/60 mb-4">Definition</div>
              <p className="text-[19px] sm:text-[23px] leading-[1.45] text-[#111] font-medium">
                The <span className="font-bold">Patient Fishbowl</span> is a visibility framework in
                which patients can observe the <span className="font-bold">status</span>,{' '}
                <span className="font-bold">progression</span>, and{' '}
                <span className="font-bold">coordination</span> of their care processes{' '}
                <span className="italic">in near real time</span> without altering the
                canonical clinical record.
              </p>
            </motion.div>
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              {facets.map((f, i) => (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, y: 18 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.55, delay: 0.18 + 0.1 * i }}
                  className="bg-[#0a3d3a] text-white rounded-3xl px-6 py-7 flex flex-col gap-2 min-h-[180px]"
                >
                  <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-[#9ee3db]">{f.n}</div>
                  <div className="font-display text-[26px] tracking-[-0.015em] mt-1">{f.label}</div>
                  <p className="text-[13px] leading-relaxed text-white/80">{f.copy}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Networks grid ───────────────────────────────────────────────────────────

function NetworksSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15%' })
  const networks = [
    { name: 'Epic on FHIR',           status: 'live',        kind: 'EHR' },
    { name: 'Cerner / Oracle Health', status: 'live',        kind: 'EHR' },
    { name: 'MEDITECH',               status: 'live',        kind: 'EHR' },
    { name: 'VA Lighthouse',          status: 'in-progress', kind: 'EHR' },
    { name: 'athenahealth',           status: 'in-progress', kind: 'EHR' },
    { name: 'TEFCA / QHIN',           status: 'planned',     kind: 'Network' },
    { name: 'CommonWell',             status: 'planned',     kind: 'Network' },
    { name: 'Carequality',            status: 'planned',     kind: 'Network' },
  ]
  const dotColor = (s: string) => s === 'live' ? '#22a06b' : s === 'in-progress' ? '#ffd23f' : '#bbb'
  const labelText = (s: string) => s === 'live' ? 'Live' : s === 'in-progress' ? 'In progress' : 'Planned'
  return (
    <section ref={ref} className="bg-[#ffd23f]">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-24">
        <div className="mb-12">
          <Eyebrow color="#111">Intelligence layer</Eyebrow>
          <h2 className="mt-5 font-display text-[42px] sm:text-[60px] leading-[0.95] tracking-[-0.025em] text-[#111] max-w-3xl">
            Decisions surface<br />where clinicians work.
          </h2>
          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            <div className="bg-[#111] rounded-3xl px-7 py-8">
              <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/40 mb-3">CDS Hooks</div>
              <h3 className="text-white font-bold text-[22px] leading-tight mb-3">Cards fire inside Epic &amp; Cerner</h3>
              <p className="text-white/60 text-[14px] leading-relaxed">CareOS registers as a CDS Hooks provider. When a clinician opens a chart or selects an order, relational safety cards appear inline — no tab-switching, no separate portal.</p>
              <a href="/relational-cds" className="inline-flex items-center gap-1.5 mt-5 text-[#c4ff4d] text-[13px] font-semibold hover:opacity-80 transition">
                See CDS console <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="bg-white rounded-3xl px-7 py-8">
              <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#111]/40 mb-3">Relational View</div>
              <h3 className="text-[#111] font-bold text-[22px] leading-tight mb-3">Cross-domain links, not tabs</h3>
              <p className="text-[#111]/60 text-[14px] leading-relaxed">Medications, allergies, labs, and problems are linked relationally. A conflict surfaces the moment you select a drug — not after you navigate to a separate reconciliation screen.</p>
              <a href="/relational-cds" className="inline-flex items-center gap-1.5 mt-5 text-[#111] text-[13px] font-semibold hover:opacity-60 transition">
                Open relational view <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
        <Eyebrow color="#111">EHR coverage</Eyebrow>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {networks.map((n, i) => (
            <motion.div
              key={n.name}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.05 * i }}
              className="bg-white rounded-3xl px-5 py-6 flex flex-col gap-3 min-h-[148px]"
            >
              <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#111]/50">{n.kind}</div>
              <div className="text-[17px] font-bold text-[#111] leading-tight">{n.name}</div>
              <div className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#111]/70">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor(n.status) }} />
                {labelText(n.status)}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Patient-mediated exchange ────────────────────────────────────────────────

function InteropSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15%' })
  const items = [
    {
      title: 'Patient Data Portability',
      detail: 'Export complete patient records using standardized FHIR Bulk Data and USCDI bundles. Compatible with leading cloud healthcare platforms.',
    },
    {
      title: 'Cures Act–Ready Data Exchange',
      detail: 'Deliver complete patient-authorized health records through standardized APIs that align with modern interoperability requirements.',
    },
    {
      title: 'Secure Cloud Archive',
      detail: 'Store encrypted clinical records in your preferred cloud provider — AWS, GCP, Azure, or self-hosted — with signed retrieval and key rotation.',
    },
    {
      title: 'National Exchange Ready',
      detail: 'Designed to integrate with emerging nationwide interoperability networks as health systems adopt them.',
    },
    {
      title: 'Decision Support in Workflow',
      detail: 'Deliver deterministic clinical guidance directly inside the EHR at the moment clinicians need it — without relying on generative AI.',
    },
  ]
  return (
    <section id="interop" ref={ref} className="bg-[#4d80ff]">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-24 sm:py-32">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <Eyebrow color="#fff">Patient-mediated exchange</Eyebrow>
            <h2 className="mt-5 font-display text-[42px] sm:text-[60px] leading-[0.95] tracking-[-0.025em] text-white">
              Built for the<br />patient-mediated<br />exchange era.
            </h2>
            <p className="mt-6 text-[16px] leading-relaxed text-white/85 max-w-md">
              The cloud is the enabling technology. The patient-controlled workflow is the innovation.
              CareOS is designed around modern interoperability standards from day one — so clinics can
              exchange data, automate workflows, support research, and deliver decision support without
              custom integrations.
            </p>
            <div className="mt-6 space-y-2 text-[14px] text-white">
              {['Patient-mediated exchange', 'Standards-native interoperability', 'Cloud-ready architecture', 'Research-ready infrastructure'].map(b => (
                <div key={b} className="flex items-center gap-2">
                  <span className="text-[#c4ff4d] font-bold">✓</span> {b}
                </div>
              ))}
            </div>
            <div className="mt-7">
              <Link to="/fhir-standards" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#c4ff4d] text-[#111] text-[11px] font-bold uppercase tracking-[0.14em] hover:bg-white transition-colors">
                <span>Explore Standards Conformance →</span>
              </Link>
            </div>
          </div>
          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-3">
            {items.map((it, i) => (
              <motion.div
                key={it.title}
                initial={{ opacity: 0, y: 18 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.08 * i }}
                className="bg-white rounded-3xl p-7 flex flex-col gap-3 min-h-[180px]"
              >
                <Cloud className="w-5 h-5 text-[#4d80ff]" />
                <h3 className="font-display text-[22px] tracking-[-0.015em] text-[#111] leading-tight">{it.title}</h3>
                <p className="text-[13px] leading-relaxed text-[#111]/70">{it.detail}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Live audit chain (developer/CIO page only — removed from landing) ────────

function AuditTicker() {
  return null
}

function _AuditTickerFull() {
  const entries = useRecentAudit(15)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15%' })
  return (
    <section id="evidence" ref={ref} className="bg-[#111] text-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-24 sm:py-32">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-[11px] uppercase tracking-[0.16em] font-bold">
              <Lock className="w-3 h-3" /> Evidence
            </div>
            <h2 className="mt-5 font-display text-[42px] sm:text-[60px] leading-[0.95] tracking-[-0.025em]">
              A receipt for<br />every PHI event.
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-white/70 max-w-md">
              Each row's hash depends on the previous row's hash. Silent edits
              break the chain. This is the live feed from the production relay.
            </p>
            <div className="mt-7 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#c4ff4d] text-[#111] text-[11px] font-bold uppercase tracking-[0.14em]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#111] animate-pulse" />
              {entries.length} entries · refreshing every 4s
            </div>
          </div>
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7 }}
              className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-white/10 text-[10px] uppercase tracking-[0.16em] font-bold text-white/50 grid grid-cols-12 gap-4">
                <div className="col-span-1">id</div>
                <div className="col-span-3">action</div>
                <div className="col-span-4">actor</div>
                <div className="col-span-4">hash</div>
              </div>
              <div className="max-h-[420px] overflow-y-auto font-mono text-[12px]">
                {entries.length === 0 ? (
                  <div className="px-5 py-8 text-white/40 text-center">Waiting for relay activity…</div>
                ) : entries.map((e, i) => (
                  <motion.div
                    key={e.id}
                    initial={i === 0 ? { opacity: 0, y: -8, backgroundColor: 'rgba(196,255,77,0.18)' } : false}
                    animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(0,0,0,0)' }}
                    transition={{ duration: 0.5 }}
                    className="px-5 py-2.5 border-b border-white/5 grid grid-cols-12 gap-4 items-center"
                  >
                    <div className="col-span-1 text-white/50 tabular-nums">{e.id}</div>
                    <div className="col-span-3 text-white/90">{e.action}</div>
                    <div className="col-span-4 text-white/60 truncate">{e.actor}</div>
                    <div className="col-span-4 text-[#c4ff4d]/80 truncate">{e.hash_self.slice(0, 24)}…</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Burden saved (hidden until data is real) ─────────────────────────────────

function BurdenSavedSection() {
  return null
}

// ── CTA ─────────────────────────────────────────────────────────────────────

function CtaSection() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    try {
      await api.subscribe({ email, name, role: 'general' })
      setStatus('success')
      setMsg('Welcome email sent — check your inbox.')
      setEmail(''); setName('')
    } catch (err: any) {
      setStatus('error')
      setMsg(err?.message || 'Something went wrong. Try again in a moment.')
    }
  }

  return (
    <section id="cta" className="bg-[#ffd1d1]">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-24 sm:py-32">
        <div className="text-center">
          <Eyebrow color="#111">Early access</Eyebrow>
          <h2 className="mt-5 font-display text-[44px] sm:text-[72px] leading-[0.92] tracking-[-0.03em] text-[#111]">
            Want your<br />clinicians back?
          </h2>
          <p className="mt-5 text-[16px] text-[#111]/75 max-w-xl mx-auto">
            Pilot slots opening for clinics that want their evenings back.
            Drop your details and we'll be in touch.
          </p>
        </div>
        <form onSubmit={submit} className="mt-12 max-w-2xl mx-auto grid sm:grid-cols-3 gap-3">
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="sm:col-span-1 px-5 py-3.5 rounded-full bg-white text-[#111] placeholder-[#111]/40 outline-none border border-[#111]/10 focus:border-[#111]/30"
          />
          <input
            value={email} onChange={(e) => setEmail(e.target.value)}
            type="email" required placeholder="you@clinic.com"
            className="sm:col-span-2 px-5 py-3.5 rounded-full bg-white text-[#111] placeholder-[#111]/40 outline-none border border-[#111]/10 focus:border-[#111]/30"
          />
          <button
            type="submit" disabled={status === 'loading'}
            className="sm:col-span-3 mt-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#111] text-[#c4ff4d] rounded-full text-[14px] font-bold hover:bg-black transition disabled:opacity-50"
          >
            {status === 'loading' ? 'Submitting…' : <>Request access <ArrowUpRight className="w-4 h-4" /></>}
          </button>
          {msg && (
            <div className={`sm:col-span-3 text-center text-[13px] mt-2 ${status === 'success' ? 'text-emerald-700' : status === 'error' ? 'text-rose-700' : 'text-[#111]/70'}`}>
              {msg}
            </div>
          )}
        </form>
      </div>
    </section>
  )
}

// ── OS Layer ────────────────────────────────────────────────────────────────

const OS_ROWS = [
  { os: 'User',      careos: 'Patient',                color: '#c4ff4d' },
  { os: 'Permissions', careos: 'Consent (FHIR Consent)', color: '#4d80ff' },
  { os: 'Files',     careos: 'FHIR Resources',           color: '#ffd23f' },
  { os: 'Processes', careos: 'Clinical Workflows',       color: '#ff6b5b' },
  { os: 'Scheduler', careos: 'Workflow Agents',          color: '#9ee3db' },
  { os: 'Network',   careos: 'SMART on FHIR / TEFCA',   color: '#c084fc' },
  { os: 'Security',  careos: 'HIPAA + Audit Chain',      color: '#fb923c' },
  { os: 'Event log', careos: 'AuditEvent + Provenance',  color: '#34d399' },
]

function OsLayerSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })
  return (
    <section ref={ref} className="bg-[#111] border-t border-white/8">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <Eyebrow color="#c4ff4d">Architecture</Eyebrow>
            <h2 className="mt-5 font-display text-[42px] sm:text-[58px] leading-[0.95] tracking-[-0.025em] text-white">
              CareOS is an<br />operating system
            </h2>
            <p className="mt-6 text-[16px] leading-relaxed text-white/60 max-w-md">
              Every OS manages identity, permissions, files, processes, networking, and security.
              CareOS does the same — for healthcare interactions.
              The patient is the user. Consent is the permission layer. FHIR resources are the files.
            </p>
            <p className="mt-4 text-[14px] leading-relaxed text-white/40 max-w-md">
              That is why the name fits. CareOS is not just an app.
              It is an orchestration layer for every clinical interaction.
            </p>
          </div>
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-1 mb-2">
              <div className="px-4 py-2 rounded-xl bg-white/6 text-[11px] font-bold uppercase tracking-widest text-white/30 text-center">Operating System</div>
              <div className="px-4 py-2 rounded-xl bg-[#c4ff4d]/10 text-[11px] font-bold uppercase tracking-widest text-[#c4ff4d] text-center">CareOS</div>
            </div>
            {OS_ROWS.map((row, i) => (
              <motion.div
                key={row.os}
                initial={{ opacity: 0, x: 20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.06 * i }}
                className="grid grid-cols-2 gap-1"
              >
                <div className="px-4 py-3 rounded-xl bg-white/4 border border-white/6 text-[13px] text-white/50 font-medium">{row.os}</div>
                <div className="px-4 py-3 rounded-xl bg-white/6 border border-white/10 text-[13px] font-semibold" style={{ color: row.color }}>{row.careos}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── CIO Section ───────────────────────────────────────────────────────────────

function CioSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })
  const WORKFLOW = [
    { n: '01', label: 'Patient arrives', detail: 'Scans QR code at reception. No paper. No verbal insurance recitation.' },
    { n: '02', label: 'Digital intake fires', detail: 'Patient approves what to share on their phone. Coverage, meds, allergies, consent.' },
    { n: '03', label: 'FHIR bundle delivered', detail: 'Structured FHIR R4 bundle arrives in the EHR via SMART on FHIR. Staff clicks Accept.' },
    { n: '04', label: 'CDS prompt appears', detail: 'CareOS CDS Hooks card surfaces in the EHR: research eligibility, missing data, follow-up signals.' },
    { n: '05', label: 'Record updated automatically', detail: 'Patient/Coverage/Consent/Provenance written to EHR. Audit logged. No manual entry.' },
    { n: '06', label: 'Research credit issued', detail: '$10 health wallet credit released automatically if patient authorized research participation.' },
  ]
  const SECURITY = [
    { label: 'HIPAA §164.312(a)(2)(iv)', detail: 'AES-256 envelope encryption for every FHIR resource in transit and at rest.' },
    { label: 'SHA-256 audit chain', detail: 'Every event hashed and chained. Tamper-evident. Verifiable at /api/relay/audit/verify.' },
    { label: 'Zero PHI on blockchain', detail: 'Only consent hashes and agreement IDs go on-chain. Patient data never leaves the vault.' },
    { label: 'Patient-controlled consent', detail: 'FHIR Consent resource created for every authorization. Revocable at any time.' },
    { label: 'SMART on FHIR scopes', detail: 'Minimum-necessary access enforced per resource type. No broad data pulls.' },
    { label: 'TEFCA / QHIN aligned', detail: 'Patient discovery and document query stubs aligned to the Common Agreement.' },
  ]
  const ROI = [
    { value: '~30,000', label: 'Admin actions/yr automated', sub: 'per 4,000-visit clinic' },
    { value: '< 90s', label: 'Average intake time', sub: 'vs 15+ min paper' },
    { value: '$0', label: 'Manual insurance entry', sub: 'Coverage via FHIR' },
    { value: '$10', label: 'Research credit per visit', sub: 'released automatically' },
  ]
  return (
    <section ref={ref} className="bg-[#0a0a0a] border-t border-white/6">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-24 space-y-20">
        <div className="text-center">
          <Eyebrow color="#c4ff4d">For the hospital CIO</Eyebrow>
          <h2 className="mt-5 font-display text-[42px] sm:text-[58px] leading-[0.95] tracking-[-0.025em] text-white">
            Workflow. Security. ROI.
          </h2>
        </div>

        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-6">The Workflow</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {WORKFLOW.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.45, delay: 0.07 * i }}
                className="rounded-2xl border border-white/8 bg-white/4 p-5"
              >
                <div className="text-[11px] font-bold text-[#c4ff4d] mb-2">{s.n}</div>
                <div className="text-[15px] font-bold text-white mb-1.5">{s.label}</div>
                <div className="text-[13px] text-white/45 leading-relaxed">{s.detail}</div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-10">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-6">Security</div>
            <div className="space-y-3">
              {SECURITY.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, x: -12 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.06 * i }}
                  className="flex gap-3 rounded-xl border border-white/6 bg-white/3 px-4 py-3.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c4ff4d] shrink-0 mt-1.5" />
                  <div>
                    <div className="text-[13px] font-bold text-white">{s.label}</div>
                    <div className="text-[12px] text-white/40 mt-0.5">{s.detail}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-6">ROI</div>
            <div className="grid grid-cols-2 gap-3">
              {ROI.map((r, i) => (
                <motion.div
                  key={r.label}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.4, delay: 0.08 * i }}
                  className="rounded-2xl border border-white/8 bg-white/4 p-5"
                >
                  <div className="text-[32px] font-bold text-[#c4ff4d] leading-none mb-2">{r.value}</div>
                  <div className="text-[13px] font-semibold text-white">{r.label}</div>
                  <div className="text-[11px] text-white/35 mt-0.5">{r.sub}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Products tree ─────────────────────────────────────────────────────────────

const PRODUCTS = [
  {
    id: 'ops', color: '#c4ff4d', textColor: '#111',
    title: 'Clinical Operations',
    tag: 'Hospitals / Clinics',
    items: ['Workflow automation', 'Admin burden reduction', 'Prior auth + scheduling', 'Audit-grade event log'],
    link: '/order-flow',
  },
  {
    id: 'px', color: '#4d80ff', textColor: '#fff',
    title: 'Patient Experience',
    tag: 'Patients',
    items: ['QR digital intake', 'SMART on FHIR portal', 'Health wallet', 'Consent management'],
    link: '/patient/qr/1',
  },
  {
    id: 'research', color: '#ffd23f', textColor: '#111',
    title: 'Research Network',
    tag: 'Research Sponsors / IRBs',
    items: ['Patient recruitment', 'HIPAA-authorized data use', 'PRO collection', 'Research compensation'],
    link: '/web3',
  },
  {
    id: 'wallet', color: '#ff6b5b', textColor: '#fff',
    title: 'Health Wallet',
    tag: 'Patients',
    items: ['Research participation credits', 'Copay + deductible tracking', 'Prescription spend', 'ACH / card payout'],
    link: '/patient/qr/1',
  },
  {
    id: 'learning', color: '#9ee3db', textColor: '#111',
    title: 'Global Learning Network',
    tag: 'Clinicians / Health Systems',
    items: ['De-identified data pool', 'Clinician-validated signals', 'Waiting room board', 'CDS evidence updates'],
    link: '/live',
  },
  {
    id: 'ai', color: '#c084fc', textColor: '#fff',
    title: 'Clinical AI',
    tag: 'Clinicians',
    items: ['Similar case matching', 'Treatment outcome signals', 'Complication rate surfacing', 'Follow-up compliance'],
    link: '/relational-cds',
  },
]

function ProductsSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })
  return (
    <section ref={ref} className="bg-[#f7f3eb] border-t border-[#111]/8">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-24">
        <div className="text-center mb-14">
          <Eyebrow color="#111">Platform products</Eyebrow>
          <h2 className="mt-5 font-display text-[42px] sm:text-[58px] leading-[0.95] tracking-[-0.025em] text-[#111]">
            One OS.<br />Six products.
          </h2>
          <p className="mt-5 text-[16px] text-[#111]/55 max-w-xl mx-auto leading-relaxed">
            CareOS sits underneath every product as the identity, consent, and interoperability layer.
            Each product can be adopted independently and grows more powerful together.
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="px-6 py-3 rounded-2xl bg-[#111] text-[#c4ff4d] text-[15px] font-bold font-display tracking-tight">
            CareOS — The Operating System
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PRODUCTS.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 18 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.07 * i }}
            >
              <Link
                to={p.link}
                className="block rounded-2xl p-6 h-full transition-transform hover:-translate-y-1"
                style={{ background: p.color }}
              >
                <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: p.textColor, opacity: 0.5 }}>{p.tag}</div>
                <h3 className="font-display text-[22px] leading-tight mb-4" style={{ color: p.textColor }}>{p.title}</h3>
                <ul className="space-y-1.5">
                  {p.items.map(item => (
                    <li key={item} className="flex items-center gap-2 text-[13px]" style={{ color: p.textColor, opacity: 0.75 }}>
                      <span className="w-1 h-1 rounded-full" style={{ background: p.textColor, opacity: 0.4 }} />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex items-center gap-1 text-[12px] font-bold" style={{ color: p.textColor }}>
                  Explore <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-[#111] text-white/70">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-14 grid md:grid-cols-3 gap-10 text-[13px]">
        <div>
          <div className="flex items-center gap-2 text-white">
            <CareOSMark size={32} bg="#c4ff4d" />
            <span className="font-bold tracking-tight">CareOS</span>
            <span className="opacity-50">by LaunchFlow</span>
          </div>
          <p className="mt-4 max-w-xs leading-relaxed">
            The patient-controlled operating system for modern healthcare — FHIR-native, HIPAA-grade, research-ready.
          </p>
        </div>
        <div>
          <div className="text-white font-bold mb-3">Endpoints</div>
          <ul className="space-y-1.5">
            <li><a className="hover:text-[#c4ff4d]" href="/.well-known/jwks.json">/.well-known/jwks.json</a></li>
            <li><a className="hover:text-[#c4ff4d]" href="/api/relay/status">/api/relay/status</a></li>
            <li><a className="hover:text-[#c4ff4d]" href="/api/relay/audit/verify">/api/relay/audit/verify</a></li>
            <li><a className="hover:text-[#c4ff4d]" href="/api/careos/agents">/api/careos/agents</a></li>
            <li><a className="hover:text-[#c4ff4d]" href="/api/careos/burden">/api/careos/burden</a></li>
          </ul>
        </div>
        <div>
          <div className="text-white font-bold mb-3">Standards</div>
          <ul className="space-y-1.5 opacity-80">
            <li>HIPAA §164.312(a)(2)(iv) · §164.312(b)</li>
            <li>SMART on FHIR · Backend Services · Bulk Data IG v2</li>
            <li>USCDI v3 · TEFCA Common Agreement · HTI-1</li>
            <li>HL7 v2.5 · MLLP · FHIR R4</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 sm:px-10 py-5 max-w-7xl mx-auto flex justify-between text-[11px] uppercase tracking-[0.16em] opacity-50">
        <span>© {new Date().getFullYear()} LaunchFlow</span>
        <span>launchflow.tech</span>
      </div>
    </footer>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function CareOSLanding() {
  const [inquireOpen, setInquireOpen] = useState(false)
  return (
    <div className="font-sans antialiased text-[#111] bg-[#f7f3eb] selection:bg-[#c4ff4d] selection:text-[#111]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Space Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif; font-weight: 700; letter-spacing: -0.02em; }
      `}</style>
      {inquireOpen && <InquireModal onClose={() => setInquireOpen(false)} />}
      <Header onInquire={() => setInquireOpen(true)} />
      <main>
        <Hero />
        <BurdenSection />
        <FishbowlSection />
        <HowItWorks />
        <NetworksSection />
        <InteropSection />
        <ProductsSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  )
}
