import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Network, MousePointerClick, ShieldAlert, GitBranch, ArrowRight, ArrowUpRight,
  Sparkles, Layers, Gauge, Webhook, Server,
} from 'lucide-react'
import InquireModal from '../components/InquireModal'
import { researchApi } from './research/researchApi'
import type { Patient } from './research/types'
import RelationalChart from './research/ehr/RelationalChart'
import { VIBRANT } from './research/themes'

function Feature({ bg, fg, icon: Icon, title, body }: {
  bg: string; fg: string; icon: any; title: string; body: string
}) {
  return (
    <div className="rounded-3xl p-7 min-h-[230px] flex flex-col" style={{ backgroundColor: bg, color: fg }}>
      <Icon className="w-7 h-7" style={{ color: fg }} />
      <h3 className="mt-6 text-[22px] sm:text-[24px] leading-[1.08] tracking-[-0.015em] font-bold">{title}</h3>
      <p className="mt-3 text-[14px] leading-relaxed" style={{ color: fg, opacity: 0.8 }}>{body}</p>
    </div>
  )
}

export default function RelationalCdsPage() {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [inquireOpen, setInquireOpen] = useState(false)

  useEffect(() => {
    researchApi.getStudy().then((s) => setPatient(s.patient)).catch(() => {})
  }, [])

  return (
    <div className="font-display antialiased text-[#111] bg-[#f7f3eb] selection:bg-[#c4ff4d] selection:text-[#111]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Space Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif; }
      `}</style>

      {inquireOpen && <InquireModal onClose={() => setInquireOpen(false)} />}
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#111] border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 sm:px-10 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#c4ff4d] flex items-center justify-center">
              <Network className="w-4 h-4 text-[#111]" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold tracking-tight text-white">CareOS</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-semibold">by LaunchFlow</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-white/70">
            <Link to="/relational-cds" className="text-[#c4ff4d] font-semibold">CDS</Link>
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

      {/* Hero — lime color-block, matching RelationalShowcase */}
      <section className="bg-[#c4ff4d] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111] text-[#c4ff4d] text-[11px] uppercase tracking-[0.16em] font-bold mb-9">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c4ff4d] animate-pulse" />
            CDS Hooks · Relational View
          </div>
          <h1 className="text-[44px] sm:text-[72px] lg:text-[92px] leading-[0.93] tracking-[-0.03em] max-w-[1100px]">
            EHR data as a<br />connected graph.
          </h1>
          <p className="mt-8 max-w-xl text-[18px] sm:text-[20px] leading-relaxed text-[#111]/80">
            Traditional EHRs scatter a patient across tabs. CareOS builds a relational chart —
            problems linked to meds, allergies cross-referenced with orders, patient voice attached to
            every record — and delivers it as CDS Hooks cards that fire directly in Epic, Cerner, or any FHIR EHR.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link to="/ehr/cds" className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#111] text-[#c4ff4d] rounded-full text-[14px] font-bold hover:bg-black transition">
              Open CDS Console <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/order-flow" className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/40 hover:bg-white/60 text-[#111] rounded-full text-[14px] font-bold transition border border-[#111]/15">
              See Order Flow <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Live chart — same treatment as RelationalShowcase */}
      <section className="bg-[#f7f3eb]">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16 sm:py-24">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 text-[11px] uppercase tracking-[0.16em] font-bold mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-[#111]" /> Live · interactive
              </div>
              <h2 className="text-[34px] sm:text-[52px] leading-[0.96] tracking-[-0.025em] max-w-xl">
                Click a record.<br />Watch it connect.
              </h2>
            </div>
            <p className="text-[15px] text-[#111]/70 max-w-sm">
              This is the same chart the clinician sees in the EHR portal — themed in the CareOS palette.
              Select any item and its linked records light up instantly. CDS cards surface these same links
              as inline alerts inside Epic.
            </p>
          </div>
          <div className="rounded-[1.6rem] bg-[#111] p-3 sm:p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)]">
            {patient
              ? <RelationalChart patient={patient} theme={VIBRANT} />
              : <div className="h-[480px] rounded-2xl bg-white/5 animate-pulse" />}
          </div>
        </div>
      </section>

      {/* How CDS Hooks delivers this into the EHR */}
      <section className="bg-[#111] text-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
          <h2 className="text-[34px] sm:text-[52px] leading-[0.96] tracking-[-0.025em] mb-4 max-w-2xl">
            How it gets into your EHR.
          </h2>
          <p className="text-[16px] text-white/50 max-w-xl mb-12">
            No custom integration. Any EHR that supports CDS Hooks 1.0 can call CareOS — just register the URL.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            {[
              {
                n: '01', icon: Webhook, color: '#c4ff4d',
                title: 'EHR calls CareOS',
                body: 'When the clinician opens a chart or starts an order, the EHR fires a POST to https://launchflow.tech/cds-services/careos-patient-summary — one URL, no custom code.',
              },
              {
                n: '02', icon: GitBranch, color: '#4d80ff',
                title: 'Relational chart built',
                body: 'CareOS resolves the FHIR data into a graph: problems → meds → allergies → labs → patient feedback — and runs deterministic safety checks against the links.',
              },
              {
                n: '03', icon: Server, color: '#ffd23f',
                title: 'Cards delivered inline',
                body: 'The EHR renders CDS cards directly in the workflow — allergy conflicts as critical alerts, untreated problems as info cards, patient concerns as "Patient voice" warnings.',
              },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl p-6 bg-white/[0.03] border border-white/[0.07]">
                <div className="flex items-start gap-4">
                  <span className="text-[32px] font-bold text-white/[0.07] leading-none">{s.n}</span>
                  <div>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3 bg-white/[0.06]">
                      <s.icon className="w-4 h-4" style={{ color: s.color }} />
                    </div>
                    <h3 className="text-[15px] font-semibold text-white mb-2">{s.title}</h3>
                    <p className="text-[13px] text-white/45 leading-relaxed">{s.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* EHR compat row */}
          <div className="flex items-center gap-8 flex-wrap pt-6 border-t border-white/[0.07]">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/30">Compatible with</span>
            {[
              { name: 'Epic', note: 'App Orchard / Interconnect' },
              { name: 'Cerner', note: 'Oracle Health Millennium' },
              { name: 'MEDITECH', note: 'Expanse FHIR R4' },
              { name: 'Any FHIR R4', note: 'CDS Hooks 1.0 spec' },
            ].map((e) => (
              <div key={e.name} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#c4ff4d]" />
                <span className="text-[14px] font-semibold text-white">{e.name}</span>
                <span className="text-[12px] text-white/35">{e.note}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why linked — color-blocked features, same as showcase */}
      <section className="bg-[#f7f3eb]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
          <h2 className="text-[34px] sm:text-[52px] leading-[0.96] tracking-[-0.025em] mb-12 max-w-2xl">
            Why a linked chart<br />changes the work.
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Feature bg="#c4ff4d" fg="#111" icon={MousePointerClick} title="One click, not five tabs"
              body="Cross-domain look-ups collapse from multi-tab navigation into a single selection." />
            <Feature bg="#ff6b5b" fg="#111" icon={ShieldAlert} title="Conflicts surface themselves"
              body="A medication reveals its allergy conflict the moment you select it — no separate reconciliation." />
            <Feature bg="#4d80ff" fg="#fff" icon={GitBranch} title="Relationships are first-class"
              body="Problem → treatment → referral and encounter → labs are modeled as links, not lists." />
            <Feature bg="#ffd23f" fg="#111" icon={Gauge} title="Lower working memory"
              body="The chart holds the connections so the clinician doesn't have to — the basis of our workload study." />
          </div>
        </div>
      </section>

      {/* Traditional vs Relational — aqua section */}
      <section className="bg-[#9ee3db]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
          <div className="grid lg:grid-cols-2 gap-3">
            <div className="bg-white rounded-3xl px-8 py-9">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-bold text-[#0a3d3a]/60 mb-4">
                <Layers className="w-4 h-4" /> Traditional EHR
              </div>
              <p className="text-[20px] sm:text-[24px] leading-[1.35] font-medium text-[#111]">
                "Which med treats this problem? Let me open the meds tab… now back to problems… now allergies to check for a conflict."
              </p>
              <p className="mt-5 text-[14px] text-[#111]/60">Answer assembled from memory across 3–5 tabs.</p>
            </div>
            <div className="bg-[#0a3d3a] text-white rounded-3xl px-8 py-9">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-bold text-[#9ee3db] mb-4">
                <Network className="w-4 h-4" /> CareOS Relational + CDS
              </div>
              <p className="text-[20px] sm:text-[24px] leading-[1.35] font-medium">
                "Select the medication — its problem, dose, and the allergy conflict are right there. And CDS already flagged it before I even clicked."
              </p>
              <p className="mt-5 text-[14px] text-white/60">Answer surfaced in one click, with a safety alert already in the workflow.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA — blush, matching showcase */}
      <section className="bg-[#ffd1d1]">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/10 text-[11px] uppercase tracking-[0.16em] font-bold mb-5">
            <Sparkles className="w-3.5 h-3.5" /> See it in practice
          </div>
          <h2 className="text-[40px] sm:text-[64px] leading-[0.95] tracking-[-0.03em]">
            Live in your EHR today.
          </h2>
          <p className="mt-5 text-[16px] text-[#111]/75 max-w-xl mx-auto">
            Register CareOS as a CDS Hooks provider, open a patient chart, and see relational safety cards appear inline — no rebuild, no custom integration.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link to="/ehr/connections" className="inline-flex items-center gap-2 px-7 py-4 bg-[#111] text-[#c4ff4d] rounded-full text-[15px] font-bold hover:bg-black transition">
              Connect your EHR <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link to="/order-flow" className="inline-flex items-center gap-2 px-7 py-4 bg-white/50 hover:bg-white/70 text-[#111] rounded-full text-[15px] font-bold transition border border-[#111]/15">
              See Order Flow <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#111] text-white/70">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-12 flex flex-wrap items-center justify-between gap-4 text-[13px]">
          <div className="flex items-center gap-2 text-white">
            <div className="w-8 h-8 rounded-2xl bg-[#c4ff4d] flex items-center justify-center">
              <Network className="w-3.5 h-3.5 text-[#111]" />
            </div>
            <span className="font-bold tracking-tight">Relational CDS</span>
            <span className="opacity-50">· CareOS</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/" className="hover:text-[#c4ff4d]">launchflow.tech</Link>
            <Link to="/order-flow" className="hover:text-[#c4ff4d]">Order Flow</Link>
            <Link to="/relational" className="hover:text-[#c4ff4d]">Showcase</Link>
            <Link to="/research" className="hover:text-[#c4ff4d]">Research</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
