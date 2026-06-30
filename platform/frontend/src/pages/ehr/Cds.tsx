import { useEffect, useState } from 'react'
import {
  Webhook, Loader2, Play, Database, Wifi, User, Pill, Server,
} from 'lucide-react'
import { api, getClinicianSession } from '../../api'
import CdsCards from './CdsCards'

interface Src { kind: 'internal' | 'org'; id: number; label: string }

export default function Cds() {
  const [services, setServices] = useState<any[]>([])
  const [internalPatients, setInternalPatients] = useState<any[]>([])
  const [connections, setConnections] = useState<any[]>([])
  const [source, setSource] = useState<Src | null>(null)
  const [livePatients, setLivePatients] = useState<any[]>([])
  const [livePatientId, setLivePatientId] = useState('')
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [drug, setDrug] = useState('')
  const [hookRun, setHookRun] = useState<string>('')

  useEffect(() => {
    api.cdsDiscovery().then((r) => setServices(r.services || [])).catch(() => {})
    api.relationalSources().then((res) => {
      setInternalPatients(res.internal_patients || [])
      setConnections(res.connections || [])
      const first = (res.internal_patients || [])[0]
      if (first) setSource({ kind: 'internal', id: first.patient_id, label: first.name })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (source?.kind !== 'org') return
    setLivePatients([]); setLivePatientId('')
    api.relationalLivePatients(source.id, 20).then((r) => setLivePatients(r.patients || [])).catch(() => {})
  }, [source])

  const ctx = () => {
    const c: Record<string, any> = { userId: getClinicianSession()?.clinician?.actor_name }
    if (source?.kind === 'internal') c.patientId = String(source.id)
    else if (source) { c.patientId = livePatientId; c.careos_org_id = source.id }
    return c
  }

  const runPatientView = async () => {
    if (!source || (source.kind === 'org' && !livePatientId)) return
    setLoading(true); setCards([]); setHookRun('patient-view')
    try {
      const res = await api.cdsInvoke('careos-patient-summary', ctx(), 'patient-view')
      setCards(res.cards || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const runOrderSelect = async () => {
    if (!source || !drug.trim()) return
    setLoading(true); setCards([]); setHookRun('order-select')
    try {
      const context = { ...ctx(), careos_draft_meds: [{ id: 'draft-1', name: drug.trim() }] }
      const res = await api.cdsInvoke('careos-medication-safety', context, 'order-select')
      setCards(res.cards || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  return (
    <div className="max-w-5xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-white mb-1">Clinical Decision Support</h1>
        <p className="text-[15px] text-white/40 font-light">
          CDS Hooks service any EHR can call — deterministic cards that fold in the patient's own voice
        </p>
      </div>

      {/* Discovery */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Webhook className="w-4 h-4 text-emerald-400" />
          <h3 className="text-[12px] font-semibold text-white/70 uppercase tracking-wider">Discovery</h3>
          <code className="text-[11px] text-white/40 font-mono ml-1">GET /cds-services</code>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {services.map((s, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">{s.hook}</span>
                <code className="text-[11px] text-white/50 font-mono">{s.id}</code>
              </div>
              <div className="text-[13px] font-semibold text-white">{s.title}</div>
              <p className="text-[11px] text-white/40 mt-1">{s.description}</p>
            </div>
          ))}
          {services.length === 0 && <span className="text-[12px] text-white/30">Loading services…</span>}
        </div>
      </div>

      {/* Invoke */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-navy-300" />
          <h3 className="text-[12px] font-semibold text-white/70 uppercase tracking-wider">Invoke against a patient</h3>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {internalPatients.map((p) => {
            const active = source?.kind === 'internal' && source.id === p.patient_id
            return (
              <button key={p.patient_id} onClick={() => setSource({ kind: 'internal', id: p.patient_id, label: p.name })}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium border transition-all ${active ? 'bg-navy-500/30 border-navy-400/40 text-white' : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white'}`}>
                <User className="w-3.5 h-3.5" /> {p.name}
              </button>
            )
          })}
          {connections.map((c) => {
            const active = source?.kind === 'org' && source.id === c.org_id
            return (
              <button key={c.org_id} onClick={() => setSource({ kind: 'org', id: c.org_id, label: c.name })}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium border transition-all ${active ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200' : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white'}`}>
                <Wifi className="w-3.5 h-3.5" /> {c.name}
              </button>
            )
          })}
        </div>

        {source?.kind === 'org' && (
          <div className="mb-3">
            <select value={livePatientId} onChange={(e) => setLivePatientId(e.target.value)}
              className="bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white outline-none min-w-[260px]">
              <option value="" className="bg-navy-900">Select a live patient…</option>
              {livePatients.map((p) => <option key={p.id} value={p.id} className="bg-navy-900">{p.name} ({p.id})</option>)}
            </select>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={runPatientView} disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-navy-950 rounded-lg text-[13px] font-bold hover:bg-emerald-400 transition-all disabled:opacity-50">
            {loading && hookRun === 'patient-view' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            patient-view
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2">
              <Pill className="w-3.5 h-3.5 text-white/30" />
              <input value={drug} onChange={(e) => setDrug(e.target.value)} placeholder="draft med e.g. Amoxicillin"
                className="bg-transparent text-[13px] text-white placeholder-white/25 outline-none w-48" />
            </div>
            <button onClick={runOrderSelect} disabled={loading || !drug.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.06] border border-white/[0.08] rounded-lg text-[13px] font-semibold text-white/80 hover:text-white transition-all disabled:opacity-40">
              {loading && hookRun === 'order-select' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              order-select
            </button>
          </div>
        </div>
      </div>

      {/* Cards */}
      {hookRun && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-emerald-400" />
            <h3 className="text-[13px] font-semibold text-white/80 uppercase tracking-wider">Returned cards</h3>
            <span className="text-[11px] text-white/30">hook: {hookRun}</span>
          </div>
          <CdsCards cards={cards} />
        </div>
      )}
    </div>
  )
}
