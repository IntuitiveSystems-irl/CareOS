import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Brain, Layers, Network, ArrowRight, ArrowUpRight, BarChart3, Gauge, Target,
  MessageSquareText, Clock, ShieldCheck, FlaskConical,
} from 'lucide-react'
import InquireModal from '../../components/InquireModal'
import { researchApi } from './researchApi'
import type { Study } from './types'

export default function ResearchLanding() {
  const [study, setStudy] = useState<Study | null>(null)
  const [inquireOpen, setInquireOpen] = useState(false)

  useEffect(() => {
    researchApi.getStudy().then(setStudy).catch(() => {})
  }, [])

  const meta = study?.meta
  const taskCount = study?.tasks.length ?? 5

  return (
    <div className="min-h-screen bg-warm-50">
      {inquireOpen && <InquireModal onClose={() => setInquireOpen(false)} />}
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#111] border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 sm:px-10 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#c4ff4d] flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-[#111]" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold tracking-tight text-white">CareOS</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-semibold">by LaunchFlow</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-white/70">
            <Link to="/" className="hover:text-white transition">How it works</Link>
            <Link to="/fhir-standards" className="hover:text-white transition">FHIR</Link>
            <Link to="/research" className="text-[#c4ff4d] font-semibold">Research</Link>
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
      <section className="pt-16 pb-12 px-6">
        <div className="max-w-3xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 border border-teal-200/60 rounded-full mb-7">
            <Brain className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-[11px] font-semibold text-teal-700">Convergent Mixed-Methods Usability Study</span>
          </div>
          <h2 className="text-[38px] leading-[1.12] font-bold tracking-tight text-gray-900 mb-5">
            {meta?.title ?? 'Comparing Traditional and Relational EHR Interfaces'}
          </h2>
          <p className="text-[18px] leading-relaxed text-teal-700/80 font-medium max-w-[640px] mx-auto mb-4">
            {meta?.subtitle ?? 'A study of clinician cognitive workload across two chart-review paradigms.'}
          </p>
          {meta && (
            <p className="text-[13px] text-gray-400 mb-9">{meta.principal_investigator} · {meta.institution}</p>
          )}
          <div className="flex items-center justify-center gap-3">
            <Link to="/research/study" className="flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl text-[15px] font-semibold hover:from-teal-400 hover:to-teal-500 transition-all shadow-glow-teal">
              Participate <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/research/dashboard" className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-[15px] font-semibold text-teal-700 border border-teal-200 hover:bg-teal-50 transition-all">
              <BarChart3 className="w-4 h-4" /> View Results
            </Link>
          </div>
          <div className="flex items-center justify-center gap-5 mt-6 text-[12px] text-gray-400">
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> ~15 minutes</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Anonymous · no PHI</span>
          </div>
        </div>
      </section>

      {/* The two arms */}
      <section className="px-6 pb-12">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
          <ArmCard
            icon={Layers} tint="slate"
            title="Traditional Interface"
            desc="A conventional tabbed chart. Problems, medications, allergies, labs, and encounters each live on their own tab — cross-referencing requires manual navigation and memory."
          />
          <ArmCard
            icon={Network} tint="teal"
            title="Relational Interface"
            desc="The same chart, linked. Selecting any record reveals its related records — a medication shows the problem it treats and any allergy conflict in a single click."
          />
        </div>
      </section>

      {/* What we measure */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-center text-[13px] font-semibold uppercase tracking-widest text-gray-400 mb-6">What we measure</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Measure icon={Gauge} title="Cognitive workload" desc="NASA-TLX across six subscales after each interface." />
            <Measure icon={Target} title="Task performance" desc={`Accuracy, time-on-task, and interaction count across ${taskCount} clinical look-ups.`} />
            <Measure icon={MessageSquareText} title="Lived experience" desc="Open-ended reflections, thematically coded and merged with the metrics." />
          </div>
        </div>
      </section>

      <footer className="border-t border-sage-200/60 py-6 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-[12px] text-gray-400">
          <span>CareOS Research · Usability Lab</span>
          <Link to="/" className="hover:text-teal-600">launchflow.tech</Link>
        </div>
      </footer>
    </div>
  )
}

function ArmCard({ icon: Icon, title, desc, tint }: { icon: any; title: string; desc: string; tint: 'slate' | 'teal' }) {
  const isTeal = tint === 'teal'
  return (
    <div className={`rounded-2xl border p-6 ${isTeal ? 'bg-teal-50/40 border-teal-200/70' : 'bg-white border-sage-200/70'}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${isTeal ? 'bg-teal-100' : 'bg-slate-100'}`}>
        <Icon className={`w-6 h-6 ${isTeal ? 'text-teal-600' : 'text-slate-600'}`} />
      </div>
      <h4 className="text-[17px] font-bold text-gray-900 mb-2">{title}</h4>
      <p className="text-[14px] leading-relaxed text-gray-500">{desc}</p>
    </div>
  )
}

function Measure({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-2xl border border-sage-200/70 p-5 shadow-soft">
      <Icon className="w-5 h-5 text-teal-600 mb-3" />
      <h4 className="text-[14px] font-semibold text-gray-900 mb-1.5">{title}</h4>
      <p className="text-[13px] leading-relaxed text-gray-500">{desc}</p>
    </div>
  )
}
