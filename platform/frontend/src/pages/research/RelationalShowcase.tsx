import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Network, MousePointerClick, ShieldAlert, GitBranch, ArrowRight, ArrowUpRight,
  Sparkles, Palette, Layers, Gauge,
} from 'lucide-react'
import { researchApi } from './researchApi'
import type { Patient } from './types'
import RelationalChart from './ehr/RelationalChart'
import { VIBRANT } from './themes'

/**
 * Vibrant, marketing-style showcase of the Relational EHR model in the CareOS
 * launchflow.tech design language (ink + lime, color-blocked sections, big
 * display type). Standalone from the controlled study.
 */
export default function RelationalShowcase() {
  const [patient, setPatient] = useState<Patient | null>(null)

  useEffect(() => {
    researchApi.getStudy().then((s) => setPatient(s.patient)).catch(() => {})
  }, [])

  return (
    <div className="font-display antialiased text-[#111] bg-[#f7f3eb] selection:bg-[#c4ff4d] selection:text-[#111]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Space Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif; }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#f7f3eb]/85 border-b border-black/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 sm:px-10 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#111] flex items-center justify-center">
              <Network className="w-4 h-4 text-[#c4ff4d]" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold tracking-tight">Relational EHR</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#111]/50 font-semibold">CareOS · by LaunchFlow</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/research/themes" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold text-[#111] hover:bg-black/5">
              <Palette className="w-3.5 h-3.5" /> Themes
            </Link>
            <Link to="/research/study" className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#111] text-[#c4ff4d] rounded-full text-[13px] font-semibold hover:bg-black transition">
              Try the study <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#c4ff4d] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111] text-[#c4ff4d] text-[11px] uppercase tracking-[0.16em] font-bold mb-9 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c4ff4d] animate-pulse" />
            The relational model
          </div>
          <h1 className="text-[44px] sm:text-[72px] lg:text-[92px] leading-[0.93] tracking-[-0.03em] max-w-[1100px]">
            See the whole patient.<br />In a single click.
          </h1>
          <p className="mt-8 max-w-xl text-[18px] sm:text-[20px] leading-relaxed text-[#111]/80">
            Traditional charts scatter a patient across tabs. The Relational chart links every
            record — select a medication and its problem, dose, and allergy conflict surface at once.
            Less hunting, less working memory, fewer misses.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link to="/research/study" className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#111] text-[#c4ff4d] rounded-full text-[14px] font-bold hover:bg-black transition">
              Experience it in the study <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/research/themes" className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/40 hover:bg-white/60 text-[#111] rounded-full text-[14px] font-bold transition border border-[#111]/15">
              <Palette className="w-4 h-4" /> Explore palettes
            </Link>
          </div>
        </div>
      </section>

      {/* Live chart */}
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
              This is the real component, themed in the CareOS palette. Select any item —
              its linked records light up instantly.
            </p>
          </div>
          <div className="rounded-[1.6rem] bg-[#111] p-3 sm:p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)]">
            {patient
              ? <RelationalChart patient={patient} theme={VIBRANT} />
              : <div className="h-[480px] rounded-2xl bg-white/5 animate-pulse" />}
          </div>
        </div>
      </section>

      {/* Why it's different — color-blocked features */}
      <section className="bg-[#111] text-white">
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

      {/* Traditional vs relational strip */}
      <section className="bg-[#9ee3db]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
          <div className="grid lg:grid-cols-2 gap-3">
            <div className="bg-white rounded-3xl px-8 py-9">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-bold text-[#0a3d3a]/60 mb-4">
                <Layers className="w-4 h-4" /> Traditional
              </div>
              <p className="text-[20px] sm:text-[24px] leading-[1.35] font-medium text-[#111]">
                "Which med treats this problem? Let me open the meds tab… now back to problems…
                now allergies to check for a conflict."
              </p>
              <p className="mt-5 text-[14px] text-[#111]/60">Answer assembled from memory across 3–5 tabs.</p>
            </div>
            <div className="bg-[#0a3d3a] text-white rounded-3xl px-8 py-9">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-bold text-[#9ee3db] mb-4">
                <Network className="w-4 h-4" /> Relational
              </div>
              <p className="text-[20px] sm:text-[24px] leading-[1.35] font-medium">
                "Select the medication — its problem, dose, and the allergy conflict are all right there."
              </p>
              <p className="mt-5 text-[14px] text-white/60">Answer surfaced in one click.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#ffd1d1]">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/10 text-[11px] uppercase tracking-[0.16em] font-bold mb-5">
            <Sparkles className="w-3.5 h-3.5" /> Help us measure it
          </div>
          <h2 className="text-[40px] sm:text-[64px] leading-[0.95] tracking-[-0.03em]">
            Put it to the test.
          </h2>
          <p className="mt-5 text-[16px] text-[#111]/75 max-w-xl mx-auto">
            Our usability study compares Traditional and Relational charts on workload, performance,
            and design — and collects your heuristic feedback on CareOS. ~15 minutes.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link to="/research/study" className="inline-flex items-center gap-2 px-7 py-4 bg-[#111] text-[#c4ff4d] rounded-full text-[15px] font-bold hover:bg-black transition">
              Start the study <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link to="/research/themes" className="inline-flex items-center gap-2 px-7 py-4 bg-white/50 hover:bg-white/70 text-[#111] rounded-full text-[15px] font-bold transition border border-[#111]/15">
              <Palette className="w-4 h-4" /> Theme explorer
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
            <span className="font-bold tracking-tight">Relational EHR</span>
            <span className="opacity-50">· CareOS</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/research" className="hover:text-[#c4ff4d]">Research home</Link>
            <Link to="/research/study" className="hover:text-[#c4ff4d]">Study</Link>
            <Link to="/" className="hover:text-[#c4ff4d]">launchflow.tech</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

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
