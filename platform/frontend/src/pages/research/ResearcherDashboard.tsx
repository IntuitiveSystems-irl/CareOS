import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3, Download, Users, CheckCircle2, Loader2, ArrowLeft,
  Gauge, Target, Timer, MousePointerClick, Lock, LogOut,
} from 'lucide-react'
import { researchApi, setResearchKey, getResearchKey, clearResearchKey } from './researchApi'
import type { PairedStat, Summary } from './types'
import QualCodingBoard from './QualCodingBoard'
import ParticipantRoster from './ParticipantRoster'
import UsabilityPanel from './UsabilityPanel'
import ExplorationPanel from './ExplorationPanel'

const SUBSCALES = [
  ['mental_demand', 'Mental Demand'], ['physical_demand', 'Physical Demand'],
  ['temporal_demand', 'Temporal Demand'], ['performance', 'Performance'],
  ['effort', 'Effort'], ['frustration', 'Frustration'],
]

export default function ResearcherDashboard() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [s, setS] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'roster' | 'quant' | 'qual' | 'usability' | 'explore'>('roster')

  useEffect(() => {
    const k = getResearchKey()
    if (!k) { setChecking(false); return }
    researchApi.checkAuth(k)
      .then(() => setAuthed(true))
      .catch(() => clearResearchKey())
      .finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    researchApi.getSummary().then(setS).finally(() => setLoading(false))
  }, [authed])

  if (checking) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-teal-500 animate-spin" />
      </div>
    )
  }
  if (!authed) {
    return <ResearcherLogin onAuthed={() => setAuthed(true)} />
  }

  return (
    <div className="min-h-screen bg-warm-50 py-8 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <Link to="/research" className="text-[12px] text-gray-400 hover:text-teal-600 inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Study home
            </Link>
            <h1 className="flex items-center gap-2 text-[24px] font-bold text-gray-900">
              <BarChart3 className="w-6 h-6 text-teal-600" /> Researcher Dashboard
            </h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => researchApi.downloadCsv()} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-teal-700 border border-teal-200 hover:bg-teal-50 transition-all">
              <Download className="w-4 h-4" /> CSV
            </button>
            <button onClick={() => researchApi.downloadJson()} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-teal-700 border border-teal-200 hover:bg-teal-50 transition-all">
              <Download className="w-4 h-4" /> JSON
            </button>
            <button onClick={() => { clearResearchKey(); setAuthed(false) }} title="Lock dashboard" className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold text-gray-500 border border-sage-200 hover:bg-sage-50 transition-all">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading || !s ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 text-teal-500 animate-spin" /></div>
        ) : (
          <>
            {/* Counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Stat icon={Users} label="Participants" value={s.n_participants} />
              <Stat icon={CheckCircle2} label="Completed" value={s.n_completed} />
              <Stat icon={Gauge} label="Raw TLX Δ" value={fmtDiff(s.paired.raw_tlx, true)} hint="relational vs traditional" />
              <Stat icon={Target} label="Accuracy Δ" value={fmtDiff(s.paired.accuracy_pct, false, '%')} hint="relational vs traditional" />
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 mb-5">
              {(['roster', 'quant', 'explore', 'usability', 'qual'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                    tab === t ? 'bg-teal-500 text-white shadow-glow-teal' : 'bg-white text-gray-500 border border-sage-200 hover:bg-teal-50'
                  }`}
                >
                  {({ roster: 'Participants', quant: 'Quantitative', explore: 'Exploration', usability: 'Usability', qual: 'Qualitative' } as const)[t]}
                </button>
              ))}
            </div>

            {tab === 'roster' ? <ParticipantRoster /> : tab === 'qual' ? <QualCodingBoard /> : tab === 'usability' ? <UsabilityPanel /> : tab === 'explore' ? <ExplorationPanel /> : (
              <div className="space-y-6">
                {/* Headline comparisons */}
                <Card title="Interface comparison" icon={BarChart3}>
                  <CompareRow label="Cognitive workload (Raw TLX)" icon={Gauge}
                    trad={s.by_interface.traditional.tlx.raw_tlx_mean} rel={s.by_interface.relational.tlx.raw_tlx_mean}
                    max={100} betterLower />
                  <CompareRow label="Task accuracy" icon={Target}
                    trad={s.by_interface.traditional.accuracy_pct} rel={s.by_interface.relational.accuracy_pct}
                    max={100} unit="%" />
                  <CompareRow label="Mean time on task" icon={Timer}
                    trad={s.by_interface.traditional.mean_duration_sec} rel={s.by_interface.relational.mean_duration_sec}
                    max={maxOf(s.by_interface.traditional.mean_duration_sec, s.by_interface.relational.mean_duration_sec)} unit="s" betterLower />
                  <CompareRow label="Mean interactions" icon={MousePointerClick}
                    trad={s.by_interface.traditional.mean_clicks} rel={s.by_interface.relational.mean_clicks}
                    max={maxOf(s.by_interface.traditional.mean_clicks, s.by_interface.relational.mean_clicks)} betterLower />
                </Card>

                {/* NASA-TLX subscales */}
                <Card title="NASA-TLX subscales" icon={Gauge}>
                  {SUBSCALES.map(([k, label]) => (
                    <CompareRow key={k} label={label}
                      trad={s.by_interface.traditional.tlx[k]} rel={s.by_interface.relational.tlx[k]}
                      max={100} betterLower={k !== 'performance' ? true : true} />
                  ))}
                </Card>

                {/* Paired stats */}
                <Card title="Paired comparison (within-subject)" icon={Target}>
                  <p className="text-[12px] text-gray-400 mb-4">
                    Δ = relational − traditional, for participants who completed both arms.
                    95% CI is a normal approximation; compute exact p-values from the CSV export.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <PairedCard title="Raw TLX" stat={s.paired.raw_tlx} unit="" betterLower />
                    <PairedCard title="Time on task" stat={s.paired.duration_sec} unit="s" betterLower />
                    <PairedCard title="Accuracy" stat={s.paired.accuracy_pct} unit="%" betterLower={false} />
                  </div>
                </Card>

                {/* Per-task */}
                <Card title="Per-task breakdown" icon={BarChart3}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-sage-200">
                          <th className="text-left py-2 pr-3">Task</th>
                          <th className="text-right px-3">Trad. acc</th>
                          <th className="text-right px-3">Rel. acc</th>
                          <th className="text-right px-3">Trad. time</th>
                          <th className="text-right px-3">Rel. time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.tasks.map((t) => (
                          <tr key={t.key} className="border-b border-sage-100">
                            <td className="py-2 pr-3 text-gray-700 font-medium">{t.title}</td>
                            <td className="text-right px-3 tabular-nums">{pct(t.traditional.accuracy_pct)}</td>
                            <td className="text-right px-3 tabular-nums text-teal-700 font-semibold">{pct(t.relational.accuracy_pct)}</td>
                            <td className="text-right px-3 tabular-nums">{sec(t.traditional.mean_duration_sec)}</td>
                            <td className="text-right px-3 tabular-nums text-teal-700 font-semibold">{sec(t.relational.mean_duration_sec)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Helpers / sub-components ──

const maxOf = (a: number | null, b: number | null) => Math.max(a || 0, b || 0, 1)
const pct = (v: number | null) => (v == null ? '—' : `${v}%`)
const sec = (v: number | null) => (v == null ? '—' : `${v}s`)

function fmtDiff(stat: PairedStat, lowerBetter: boolean, unit = '') {
  if (!stat.n || stat.mean_diff == null) return '—'
  const d = stat.mean_diff
  const sign = d > 0 ? '+' : ''
  return `${sign}${d}${unit}`
}

function Stat({ icon: Icon, label, value, hint }: { icon: any; label: string; value: any; hint?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-sage-200/70 p-4 shadow-soft">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-400 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-teal-600" /> {label}
      </div>
      <div className="text-[24px] font-bold text-gray-900 tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-gray-400 mt-0.5">{hint}</div>}
    </div>
  )
}

function Card({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-sage-200/70 p-5 shadow-soft">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900 mb-4">
        <Icon className="w-4.5 h-4.5 text-teal-600" /> {title}
      </h3>
      {children}
    </div>
  )
}

function CompareRow({
  label, trad, rel, max, unit = '', betterLower = false, icon: Icon,
}: {
  label: string; trad: number | null; rel: number | null; max: number
  unit?: string; betterLower?: boolean; icon?: any
}) {
  const tw = trad == null ? 0 : Math.min(100, (trad / max) * 100)
  const rw = rel == null ? 0 : Math.min(100, (rel / max) * 100)
  const relWins = trad != null && rel != null
    ? (betterLower ? rel < trad : rel > trad)
    : false
  return (
    <div className="mb-3.5 last:mb-0">
      <div className="flex items-center gap-1.5 text-[13px] text-gray-600 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-gray-400" />} {label}
        {relWins && <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">relational better</span>}
      </div>
      <div className="space-y-1">
        <Bar value={trad} width={tw} unit={unit} colorClass="bg-slate-400" tag="Traditional" />
        <Bar value={rel} width={rw} unit={unit} colorClass="bg-teal-500" tag="Relational" />
      </div>
    </div>
  )
}

function Bar({ value, width, unit, colorClass, tag }: { value: number | null; width: number; unit: string; colorClass: string; tag: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[78px] text-[11px] text-gray-400">{tag}</span>
      <div className="flex-1 h-5 rounded-md bg-sage-50 overflow-hidden">
        <div className={`h-full ${colorClass} rounded-md transition-all`} style={{ width: `${width}%` }} />
      </div>
      <span className="w-12 text-right text-[12px] font-semibold text-gray-700 tabular-nums">
        {value == null ? '—' : `${value}${unit}`}
      </span>
    </div>
  )
}

function PairedCard({ title, stat, unit, betterLower }: { title: string; stat: PairedStat; unit: string; betterLower: boolean }) {
  if (!stat.n || stat.mean_diff == null) {
    return (
      <div className="rounded-xl border border-sage-200/70 p-4 bg-sage-50/40">
        <div className="text-[13px] font-semibold text-gray-700 mb-1">{title}</div>
        <p className="text-[12px] text-gray-400">Needs ≥1 participant who completed both arms.</p>
      </div>
    )
  }
  const d = stat.mean_diff
  const favorsRel = betterLower ? d < 0 : d > 0
  return (
    <div className="rounded-xl border border-sage-200/70 p-4">
      <div className="text-[13px] font-semibold text-gray-700 mb-2">{title}</div>
      <div className="text-[22px] font-bold tabular-nums mb-1" style={{ color: favorsRel ? '#267a7d' : '#475569' }}>
        {d > 0 ? '+' : ''}{d}{unit}
      </div>
      <div className={`text-[11px] font-medium mb-2.5 ${favorsRel ? 'text-teal-600' : 'text-slate-500'}`}>
        favors {favorsRel ? 'relational' : 'traditional'}
      </div>
      <dl className="text-[11px] text-gray-500 space-y-0.5">
        <Row k="Trad. mean" v={`${stat.mean_traditional}${unit}`} />
        <Row k="Rel. mean" v={`${stat.mean_relational}${unit}`} />
        {stat.t != null && <Row k="t" v={`${stat.t} (df ${stat.df})`} />}
        {stat.cohens_dz != null && <Row k="Cohen's dz" v={`${stat.cohens_dz}`} />}
        {stat.ci95_approx && <Row k="95% CI" v={`[${stat.ci95_approx[0]}, ${stat.ci95_approx[1]}]`} />}
        <Row k="n pairs" v={`${stat.n}`} />
      </dl>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt>{k}</dt><dd className="text-gray-700 font-medium tabular-nums">{v}</dd>
    </div>
  )
}

function ResearcherLogin({ onAuthed }: { onAuthed: () => void }) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim()) return
    setBusy(true)
    setError('')
    try {
      await researchApi.checkAuth(key.trim())
      setResearchKey(key.trim())
      onAuthed()
    } catch (err: any) {
      setError(
        err?.message?.includes('not configured')
          ? 'Researcher access is not configured on the server.'
          : 'Incorrect passcode.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-warm-50 flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl border border-sage-200/70 shadow-soft p-7">
        <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-teal-600" />
        </div>
        <h1 className="text-[20px] font-bold text-gray-900 mb-1">Researcher access</h1>
        <p className="text-[14px] text-gray-500 mb-5">Enter the study passcode to view results.</p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoFocus
          placeholder="Passcode"
          className="w-full px-4 py-2.5 rounded-xl border border-sage-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none text-[14px] mb-3"
        />
        {error && <p className="text-[13px] text-red-600 mb-3">{error}</p>}
        <button
          type="submit"
          disabled={busy || !key.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 disabled:opacity-40 transition-all shadow-glow-teal"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Unlock'}
        </button>
        <Link to="/research" className="block text-center text-[13px] text-gray-400 hover:text-teal-600 mt-4">
          Back to study home
        </Link>
      </form>
    </div>
  )
}
