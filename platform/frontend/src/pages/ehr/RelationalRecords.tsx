import { useEffect, useMemo, useState } from 'react'
import {
  Link2, Table2, Loader2, Database, Wifi, RefreshCw,
  AlertTriangle, GitBranch, Palette, User, Activity,
} from 'lucide-react'
import { api, getClinicianSession } from '../../api'
import RelationalChart from '../research/ehr/RelationalChart'
import TraditionalChart from '../research/ehr/TraditionalChart'
import CdsCards from './CdsCards'
import { CLINICAL, MIDNIGHT, VIBRANT, type RelationalTheme } from '../research/themes'

type ViewMode = 'relational' | 'standard'

interface SourceState {
  kind: 'internal' | 'org'
  id: number
  label: string
}

const THEMES: { theme: RelationalTheme; label: string }[] = [
  { theme: MIDNIGHT, label: 'Midnight' },
  { theme: CLINICAL, label: 'Clinical' },
  { theme: VIBRANT, label: 'Vibrant' },
]

export default function RelationalRecords() {
  const [internalPatients, setInternalPatients] = useState<any[]>([])
  const [connections, setConnections] = useState<any[]>([])
  const [source, setSource] = useState<SourceState | null>(null)
  const [livePatients, setLivePatients] = useState<any[]>([])
  const [livePatientId, setLivePatientId] = useState('')
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [chart, setChart] = useState<any | null>(null)
  const [loadingChart, setLoadingChart] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<ViewMode>('relational')
  const [themeIdx, setThemeIdx] = useState(0)
  const [cdsCards, setCdsCards] = useState<any[]>([])
  const [cdsLoading, setCdsLoading] = useState(false)

  useEffect(() => {
    api.relationalSources().then((res) => {
      setInternalPatients(res.internal_patients || [])
      setConnections(res.connections || [])
      const first = (res.internal_patients || [])[0]
      if (first) {
        setSource({ kind: 'internal', id: first.patient_id, label: first.name })
      }
    }).catch((e) => setError(e.message))
  }, [])

  // Load live patients when an org source is selected.
  useEffect(() => {
    if (source?.kind !== 'org') return
    setLoadingPatients(true)
    setLivePatients([])
    setLivePatientId('')
    api.relationalLivePatients(source.id, 20)
      .then((res) => setLivePatients(res.patients || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingPatients(false))
  }, [source])

  const loadCds = async () => {
    if (!source) return
    if (source.kind === 'org' && !livePatientId) return
    setCdsLoading(true)
    setCdsCards([])
    try {
      const ctx: Record<string, any> = {
        userId: getClinicianSession()?.clinician?.actor_name,
      }
      if (source.kind === 'internal') {
        ctx.patientId = String(source.id)
      } else {
        ctx.patientId = livePatientId
        ctx.careos_org_id = source.id
      }
      const res = await api.cdsInvoke('careos-patient-summary', ctx, 'patient-view')
      setCdsCards(res.cards || [])
    } catch (e) {
      // CDS is advisory — never block the chart on a CDS error.
      console.error('CDS invoke failed:', e)
    }
    setCdsLoading(false)
  }

  const acknowledgeFeedback = async (feedbackId: number) => {
    try {
      await api.updateFeedback(feedbackId, { status: 'acknowledged' })
      loadCds()
    } catch (e) {
      console.error('Acknowledge failed:', e)
    }
  }

  const loadChart = async () => {
    if (!source) return
    setLoadingChart(true)
    setError('')
    setChart(null)
    try {
      const data = source.kind === 'internal'
        ? await api.relationalInternalChart(source.id)
        : await api.relationalLiveChart(source.id, livePatientId)
      setChart(data)
      loadCds()
    } catch (e: any) {
      setError(e.message || 'Failed to load chart')
    }
    setLoadingChart(false)
  }

  // Auto-load internal charts on selection (live needs an explicit patient pick).
  useEffect(() => {
    if (source?.kind === 'internal') loadChart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  const linkStats = useMemo(() => {
    if (!chart) return null
    const meds = chart.medications || []
    const conflicts = meds.filter((m: any) => m.allergy_conflict).length
    const treatLinks = meds.filter((m: any) => m.treats).length
    const labLinks = (chart.labs || []).filter((l: any) => l.encounter_id).length
    return {
      problems: (chart.problems || []).length,
      meds: meds.length,
      allergies: (chart.allergies || []).length,
      labs: (chart.labs || []).length,
      encounters: (chart.encounters || []).length,
      conflicts, treatLinks, labLinks,
      total: conflicts + treatLinks + labLinks,
    }
  }, [chart])

  const theme = THEMES[themeIdx].theme

  return (
    <div className="max-w-6xl animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-white mb-1">Patient Chart</h1>
          <p className="text-[15px] text-white/40 font-light">
            The same record, two ways — <span className="text-emerald-400">Relational</span> (linked) vs <span className="text-white/60">Standard</span> (siloed tabs)
          </p>
        </div>
        {/* View toggle */}
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
          <button
            onClick={() => setView('relational')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
            style={view === 'relational' ? { backgroundColor: '#c4ff4d', color: '#111111' } : { color: 'rgba(255,255,255,0.5)' }}
          >
            <Link2 className="w-4 h-4" /> Relational
          </button>
          <button
            onClick={() => setView('standard')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
            style={view === 'standard' ? { backgroundColor: 'rgba(255,255,255,0.9)', color: '#111111' } : { color: 'rgba(255,255,255,0.5)' }}
          >
            <Table2 className="w-4 h-4" /> Standard
          </button>
        </div>
      </div>

      {/* Source selector */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-6">
        <div className="grid md:grid-cols-2 gap-5">
          {/* Internal demo patients */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4" style={{ color: 'rgba(196,255,77,0.6)' }} />
              <h3 className="text-[12px] font-semibold text-white/70 uppercase tracking-wider">Internal store</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {internalPatients.map((p) => {
                const active = source?.kind === 'internal' && source.id === p.patient_id
                return (
                  <button
                    key={p.patient_id}
                    onClick={() => setSource({ kind: 'internal', id: p.patient_id, label: p.name })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium border transition-all"
                    style={active
                      ? { backgroundColor: 'rgba(196,255,77,0.12)', borderColor: 'rgba(196,255,77,0.3)', color: '#ffffff' }
                      : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }
                    }
                  >
                    <User className="w-3.5 h-3.5" /> {p.name}
                  </button>
                )
              })}
              {internalPatients.length === 0 && <span className="text-[12px] text-white/30">No internal patients.</span>}
            </div>
          </div>

          {/* EHR connections */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <h3 className="text-[12px] font-semibold text-white/70 uppercase tracking-wider">Live EHR connections</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {connections.map((c) => {
                const active = source?.kind === 'org' && source.id === c.org_id
                return (
                  <button
                    key={c.org_id}
                    onClick={() => setSource({ kind: 'org', id: c.org_id, label: c.name })}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium border transition-all ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200'
                        : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.connected ? 'bg-emerald-400' : 'bg-white/30'}`} />
                    {c.name}
                  </button>
                )
              })}
              {connections.length === 0 && <span className="text-[12px] text-white/30">No connections yet.</span>}
            </div>
          </div>
        </div>

        {/* Live patient picker */}
        {source?.kind === 'org' && (
          <div className="mt-5 pt-5 border-t border-white/[0.06]">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[12px] text-white/40">Patient on <span className="text-white/70">{source.label}</span>:</span>
              {loadingPatients ? (
                <span className="inline-flex items-center gap-2 text-[12px] text-white/40"><Loader2 className="w-4 h-4 animate-spin" /> loading patients…</span>
              ) : (
                <>
                  <select
                    value={livePatientId}
                    onChange={(e) => setLivePatientId(e.target.value)}
                    className="bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white focus:border-emerald-500/40 outline-none min-w-[260px]"
                  >
                    <option value="" className="bg-black">Select a patient…</option>
                    {livePatients.map((p) => (
                      <option key={p.id} value={p.id} className="bg-black">
                        {p.name}{p.birthDate ? ` · ${p.birthDate}` : ''} ({p.id})
                      </option>
                    ))}
                  </select>
                  <input
                    value={livePatientId}
                    onChange={(e) => setLivePatientId(e.target.value)}
                    placeholder="or paste a patient id"
                    className="bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white placeholder-white/20 font-mono focus:border-emerald-500/40 outline-none"
                  />
                  <button
                    onClick={loadChart}
                    disabled={!livePatientId || loadingChart}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all disabled:opacity-40"
                    style={{ backgroundColor: '#c4ff4d', color: '#111111' }}
                  >
                    {loadingChart ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Load chart
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl border bg-red-500/10 border-red-500/20 text-red-300 text-[13px]">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Derived-links summary */}
      {chart && linkStats && (
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            <GitBranch className="w-3.5 h-3.5" /> {linkStats.total} relational links derived
          </span>
          {linkStats.conflicts > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-red-500/10 border border-red-500/20 text-red-300">
              <AlertTriangle className="w-3.5 h-3.5" /> {linkStats.conflicts} allergy conflict{linkStats.conflicts > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-[12px] text-white/40">
            {linkStats.problems} problems · {linkStats.meds} meds · {linkStats.allergies} allergies · {linkStats.labs} labs · {linkStats.encounters} encounters
          </span>
          {chart._source && (
            <span className="text-[11px] text-white/30 font-mono ml-auto">source: {chart._source}</span>
          )}
        </div>
      )}

      {chart?._warning && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-300 text-[13px]">
          <AlertTriangle className="w-4 h-4" /> {chart._warning}
        </div>
      )}

      {/* Theme switch (relational view only) */}
      {view === 'relational' && chart && (
        <div className="mb-3 flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-white/30" />
          {THEMES.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setThemeIdx(i)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                i === themeIdx ? 'bg-white/[0.12] text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Decision support (CDS Hooks) — relational cards incl. patient voice */}
      {chart && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-[13px] font-semibold text-white/80 uppercase tracking-wider">Decision Support</h3>
            <span className="text-[11px] text-white/30">CDS Hooks · patient-view · deterministic</span>
            {cdsLoading && <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />}
          </div>
          <CdsCards cards={cdsCards} onAcknowledge={acknowledgeFeedback} />
        </div>
      )}

      {/* Chart */}
      {loadingChart && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
        </div>
      )}

      {!loadingChart && chart && (
        <div>
          {view === 'relational'
            ? <RelationalChart patient={chart} theme={theme} />
            : <TraditionalChart patient={chart} theme={CLINICAL} />}
        </div>
      )}

      {!loadingChart && !chart && !error && (
        <div className="text-center py-20 text-white/30 text-[14px]">
          Select a data source to view the chart.
        </div>
      )}
    </div>
  )
}
