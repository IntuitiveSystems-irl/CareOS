import { useState } from 'react'
import { Link } from 'react-router-dom'
import InquireModal from '../components/InquireModal'
import { ArrowRight, ArrowUpRight, ArrowDown, CheckCircle2, XCircle, Clock, Edit3, Send, ShieldCheck, Stethoscope, User, AlertTriangle, Zap, RefreshCw, FlaskConical, Pill, GitBranch } from 'lucide-react'

const FONT_STYLE = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');`

const ink = '#111111'
const lime = '#c4ff4d'
const bone = '#f7f3eb'

function Step({
  icon: Icon, label, sub, color = 'lime', automated
}: { icon: any; label: string; sub: string; color?: 'lime' | 'sky' | 'coral' | 'amber' | 'white'; automated?: boolean }) {
  const colorMap = {
    lime: { bg: 'rgba(196,255,77,0.12)', border: 'rgba(196,255,77,0.25)', icon: '#c4ff4d', text: '#c4ff4d' },
    sky: { bg: 'rgba(77,128,255,0.12)', border: 'rgba(77,128,255,0.25)', icon: '#6b9eff', text: '#6b9eff' },
    coral: { bg: 'rgba(255,107,91,0.12)', border: 'rgba(255,107,91,0.25)', icon: '#ff6b5b', text: '#ff6b5b' },
    amber: { bg: 'rgba(255,210,63,0.12)', border: 'rgba(255,210,63,0.25)', icon: '#ffd23f', text: '#ffd23f' },
    white: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', icon: 'rgba(255,255,255,0.7)', text: 'rgba(255,255,255,0.7)' },
  }
  const c = colorMap[color]
  return (
    <div
      className="rounded-2xl px-5 py-4 flex items-start gap-3"
      style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, minWidth: 200 }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
        <Icon className="w-4 h-4" style={{ color: c.icon }} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold" style={{ color: '#ffffff' }}>{label}</p>
          {automated && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: 'rgba(196,255,77,0.18)', color: '#c4ff4d', border: '1px solid rgba(196,255,77,0.3)' }}>
              <Zap className="w-2.5 h-2.5" /> auto
            </span>
          )}
        </div>
        <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{sub}</p>
      </div>
    </div>
  )
}

function StepSm({
  icon: Icon, label, sub, color = 'lime',
}: { icon: any; label: string; sub: string; color?: 'lime' | 'sky' | 'coral' | 'amber' | 'white' }) {
  const colorMap = {
    lime: { bg: 'rgba(196,255,77,0.12)', border: 'rgba(196,255,77,0.25)', icon: '#c4ff4d' },
    sky: { bg: 'rgba(77,128,255,0.12)', border: 'rgba(77,128,255,0.25)', icon: '#6b9eff' },
    coral: { bg: 'rgba(255,107,91,0.12)', border: 'rgba(255,107,91,0.25)', icon: '#ff6b5b' },
    amber: { bg: 'rgba(255,210,63,0.12)', border: 'rgba(255,210,63,0.25)', icon: '#ffd23f' },
    white: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', icon: 'rgba(255,255,255,0.7)' },
  }
  const c = colorMap[color]
  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-start gap-2.5 flex-shrink-0"
      style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}
    >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
        <Icon className="w-3.5 h-3.5" style={{ color: c.icon }} />
      </div>
      <div>
        <p className="text-[12px] font-semibold text-white">{label}</p>
        <p className="text-[11px] mt-0.5 max-w-[160px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{sub}</p>
      </div>
    </div>
  )
}

function Arrow({ down }: { down?: boolean }) {
  const Icon = down ? ArrowDown : ArrowRight
  return (
    <div className="flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
      <Icon className="w-5 h-5" />
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
      {children}
    </p>
  )
}

function Branch({
  approved, rejected
}: { approved: React.ReactNode; rejected: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0 w-full">
      {/* horizontal bar */}
      <div className="w-px h-6" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
      <div className="relative flex items-start justify-center gap-12 w-full">
        {/* left arm */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[320px] h-px" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <div className="flex flex-col items-center gap-3 pt-0">
          <div className="w-px h-4" style={{ backgroundColor: 'rgba(196,255,77,0.4)' }} />
          <div className="px-3 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'rgba(196,255,77,0.15)', color: lime, border: `1px solid rgba(196,255,77,0.3)` }}>
            ✓ Approved
          </div>
          <div className="w-px h-4" style={{ backgroundColor: 'rgba(196,255,77,0.4)' }} />
          {approved}
        </div>
        <div className="flex flex-col items-center gap-3 pt-0">
          <div className="w-px h-4" style={{ backgroundColor: 'rgba(255,107,91,0.4)' }} />
          <div className="px-3 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'rgba(255,107,91,0.15)', color: '#ff6b5b', border: `1px solid rgba(255,107,91,0.3)` }}>
            ✗ Rejected / Change
          </div>
          <div className="w-px h-4" style={{ backgroundColor: 'rgba(255,107,91,0.4)' }} />
          {rejected}
        </div>
      </div>
    </div>
  )
}

function AutoDispatch() {
  const destinations = [
    { icon: Pill, label: 'Pharmacy', sub: 'Medication fill' },
    { icon: FlaskConical, label: 'Lab System', sub: 'Diagnostic order' },
    { icon: GitBranch, label: 'Payer / Prior Auth', sub: 'Insurance routing' },
  ]
  return (
    <div className="flex flex-col items-center w-full">
      {/* Trigger node */}
      <div
        className="flex items-center gap-2.5 px-5 py-3 rounded-2xl"
        style={{ backgroundColor: 'rgba(196,255,77,0.15)', border: '1px solid rgba(196,255,77,0.4)', minWidth: 200 }}
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <Zap className="w-4 h-4" style={{ color: lime }} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-white">Auto-dispatched</p>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide animate-pulse" style={{ backgroundColor: 'rgba(196,255,77,0.18)', color: lime, border: '1px solid rgba(196,255,77,0.3)' }}>
              ⚡ instant
            </span>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>CareOS routes to destination automatically</p>
        </div>
      </div>

      {/* Fan-out lines */}
      <div className="relative flex items-start justify-center gap-6 mt-0 pt-0 w-full">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[260px] h-px mt-4" style={{ backgroundColor: 'rgba(196,255,77,0.2)' }} />
        {destinations.map((d) => (
          <div key={d.label} className="flex flex-col items-center gap-2 pt-4">
            <div className="w-px h-4" style={{ backgroundColor: 'rgba(196,255,77,0.3)' }} />
            <div
              className="rounded-xl px-3 py-2.5 flex items-center gap-2"
              style={{ backgroundColor: 'rgba(196,255,77,0.07)', border: '1px solid rgba(196,255,77,0.18)', minWidth: 120 }}
            >
              <d.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: lime }} />
              <div>
                <p className="text-[12px] font-semibold text-white leading-tight">{d.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{d.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function OrderFlowPage() {
  const [inquireOpen, setInquireOpen] = useState(false)
  return (
    <div style={{ backgroundColor: ink, fontFamily: "'Space Grotesk', system-ui, sans-serif", minHeight: '100vh' }}>
      <style>{FONT_STYLE}</style>

      {inquireOpen && <InquireModal onClose={() => setInquireOpen(false)} />}
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-[#111] border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 sm:px-10 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#c4ff4d] flex items-center justify-center">
              <span style={{ color: ink, fontSize: 14, fontWeight: 700 }}>C</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold text-white">CareOS</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-semibold">by LaunchFlow</span>
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
          <button onClick={() => setInquireOpen(true)} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-semibold text-[#111] bg-[#c4ff4d] hover:bg-[#d4ff6d] transition">
            Inquire now <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-12">
        <div className="max-w-2xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6" style={{ backgroundColor: 'rgba(196,255,77,0.1)', border: '1px solid rgba(196,255,77,0.2)' }}>
            <Zap className="w-3.5 h-3.5" style={{ color: lime }} />
            <span style={{ color: lime, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Order & Decision Routing</span>
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 700, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Orders routed through<br />
            <span style={{ color: lime }}>the patient's voice</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 17, marginTop: 16, lineHeight: 1.6 }}>
            Every clinical order — medication, lab, referral — routes through CareOS for patient approval before it reaches the payer or fulfillment system. No surprise bills. No ignored preferences.
          </p>
        </div>

        {/* Main flow diagram */}
        <div className="flex flex-col items-center gap-0">

          {/* Row 1 — Clinician side */}
          <div className="w-full mb-2">
            <SectionLabel>1 · Clinician composes &amp; submits</SectionLabel>
            <div className="flex items-center gap-3 flex-wrap">
              <Step icon={Stethoscope} label="Clinician" sub="Opens order composer in EHR portal" color="white" />
              <Arrow />
              <Step icon={Edit3} label="Draft Order" sub="Medication, lab, referral, imaging, or prior auth" color="white" />
              <Arrow />
              <Step icon={ShieldCheck} label="CDS Hooks Check" sub="Allergy conflicts + patient feedback surfaced inline" color="lime" />
              <Arrow />
              <Step icon={Send} label="Send to Patient" sub="Order packet pushed to patient portal via CareOS" color="sky" />
            </div>
          </div>

          <div className="w-px h-10 mx-auto" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />

          {/* Row 2 — Patient decision */}
          <div className="w-full mb-2">
            <SectionLabel>2 · Patient reviews &amp; decides</SectionLabel>
            <div className="flex items-center gap-3 overflow-x-auto">
              <StepSm icon={User} label="Patient notified" sub="Push notification + portal alert" color="white" />
              <Arrow />
              <StepSm icon={Clock} label="Order Review" sub="Full order detail, rationale &amp; constraints" color="amber" />
              <Arrow />
              <StepSm icon={AlertTriangle} label="Patient Voice CDS" sub="Prior feedback surfaces as guidance cards" color="amber" />
            </div>
          </div>

          <div className="w-full my-8 flex justify-center">
            <Branch
              approved={
                <div className="flex flex-col items-center gap-3">
                  <Step icon={CheckCircle2} label="Approved" sub="Patient approves — with or without constraints" color="lime" />
                  <Arrow down />
                  <AutoDispatch />
                  <Arrow down />
                  <Step icon={CheckCircle2} label="Fulfilled" sub="Result or confirmation returned to chart" color="sky" />
                </div>
              }
              rejected={
                <div className="flex flex-col items-center gap-3">
                  <Step icon={XCircle} label="Declined or Change Requested" sub="Patient states concern, preference, or hard decline" color="coral" />
                  <Arrow down />
                  <Step icon={RefreshCw} label="Routed back to Clinician" sub="Order status set to 'Change Requested' with patient's note" color="amber" />
                  <Arrow down />
                  <Step icon={Edit3} label="Clinician revises" sub="Adjusts order, acknowledges feedback, or documents refusal" color="white" />
                  <Arrow down />
                  <Step icon={Send} label="Re-sent to Patient" sub="New review cycle begins" color="sky" />
                </div>
              }
            />
          </div>
        </div>

        {/* Status lifecycle strip */}
        <div className="mt-16 mb-6">
          <SectionLabel>Order status lifecycle</SectionLabel>
          <div className="flex items-center gap-0 flex-wrap">
            {[
              { label: 'Drafted', color: 'rgba(255,255,255,0.15)', text: 'rgba(255,255,255,0.5)', auto: false },
              { label: 'Awaiting Patient', color: 'rgba(255,210,63,0.2)', text: '#ffd23f', auto: false },
              { label: 'Patient Approved', color: 'rgba(196,255,77,0.2)', text: lime, auto: false },
              { label: 'Auto-dispatched ⚡', color: 'rgba(196,255,77,0.25)', text: lime, auto: true },
              { label: 'Change Requested', color: 'rgba(255,150,80,0.2)', text: '#ff9650', auto: false },
              { label: 'Submitted', color: 'rgba(167,139,250,0.2)', text: '#c4b5fd', auto: false },
              { label: 'Fulfilled', color: 'rgba(196,255,77,0.2)', text: lime, auto: false },
            ].map((s, i, arr) => (
              <div key={s.label} className="flex items-center">
                <div
                  className="px-4 py-2.5 rounded-xl text-[12px] font-semibold"
                  style={{
                    backgroundColor: s.color,
                    color: s.text,
                    border: s.auto ? '1px solid rgba(196,255,77,0.35)' : '1px solid transparent',
                  }}
                >
                  {s.label}
                </div>
                {i < arr.length - 1 && <ArrowRight className="w-4 h-4 mx-1" style={{ color: 'rgba(255,255,255,0.15)' }} />}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            ⚡ Auto-dispatched fires the moment the patient approves — no clinician action required.
          </p>
        </div>

        {/* Key features grid */}
        <div className="grid md:grid-cols-3 gap-5 mt-16 mb-24">
          {[
            {
              icon: ShieldCheck,
              color: lime,
              title: 'CDS at compose time',
              body: 'Before the order ever leaves the EHR, CareOS checks allergy conflicts and surfaces the patient\'s own recorded preferences — inline, as CDS Hooks cards.',
            },
            {
              icon: User,
              color: '#6b9eff',
              title: 'Patient approval loop',
              body: 'The patient sees the full clinical rationale before any order is submitted to a payer or pharmacy. They can approve, request changes, or decline with a note.',
            },
            {
              icon: Zap,
              color: '#ffd23f',
              title: 'Auto-dispatch on approval',
              body: 'The moment the patient approves, CareOS automatically routes the order — to the pharmacy for medications, the lab system for diagnostics, or the payer for prior auth. No clinician needs to press send.',
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl p-6" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.6 }}>{f.body}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="rounded-3xl p-10 mb-16 text-center" style={{ backgroundColor: lime }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: ink, marginBottom: 8 }}>See it live</h2>
          <p style={{ color: 'rgba(17,17,17,0.6)', fontSize: 15, marginBottom: 24 }}>Compose an order, send it to a demo patient, and watch the approval loop in action.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a href="/login/clinician" className="px-6 py-3 rounded-xl text-[14px] font-bold transition-all" style={{ backgroundColor: ink, color: lime }}>
              Open Clinician Portal
            </a>
            <a href="/relational-cds" className="px-6 py-3 rounded-xl text-[14px] font-bold transition-all" style={{ backgroundColor: 'rgba(17,17,17,0.12)', color: ink }}>
              See Relational CDS →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
