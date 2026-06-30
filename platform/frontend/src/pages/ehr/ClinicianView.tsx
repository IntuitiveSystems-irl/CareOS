import { useEffect, useState, useCallback } from 'react'
import { Wifi, RefreshCw, Loader2 } from 'lucide-react'
import { api } from '../../api'
import type { AccessRequest, FulfillmentPacket } from '../../types'

const USE_TYPE_LABELS: Record<string, string> = {
  primary_care: 'Primary Care',
  secondary_use: 'Secondary Use',
}

const PURPOSE_LABELS: Record<string, string> = {
  research: 'Research',
  quality_improvement: 'Quality Improvement',
  public_health: 'Public Health',
  operations_analytics: 'Operations Analytics',
  care_pattern_comparison: 'Care Pattern Comparison',
}

interface FhirSummary {
  conditions: number
  medications: number
  allergies: number
  observations: number
  encounters: number
}

const TASK_TYPE_LABELS: Record<string, string> = {
  lab_order: 'Labs',
  pharmacy_rx: 'Rx',
  referral: 'Referral',
  insurance_packet: 'Prior Auth',
  record_request: 'Records',
}

const TASK_STATUS_DOT: Record<string, string> = {
  queued: 'bg-gray-400',
  sent: 'bg-blue-400',
  acknowledged: 'bg-indigo-400',
  completed: 'bg-green-400',
  failed: 'bg-red-400',
  needs_patient_input: 'bg-yellow-400',
}

export default function ClinicianView() {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(true)
  const [fetching, setFetching] = useState<number | null>(null)
  const [summaries, setSummaries] = useState<Record<number, FhirSummary>>({})
  const [packets, setPackets] = useState<FulfillmentPacket[]>([])

  const loadRequests = useCallback(() => {
    api.getAccessRequests().then((r) => {
      setRequests(r)
      setLoading(false)
    }).catch(() => setLoading(false))
    // Also load fulfillment packets for patient 1 (demo)
    api.getClinicianPackets(1).then(setPackets).catch(() => {})
  }, [])

  useEffect(() => {
    loadRequests()
    if (!polling) return
    const interval = setInterval(loadRequests, 3000)
    return () => clearInterval(interval)
  }, [loadRequests, polling])

  const handleFetchRecords = async (ar: AccessRequest) => {
    if (ar.status !== 'approved') return
    setFetching(ar.id)
    try {
      const orgId = ar.requesting_org_id
      const patientId = ar.patient_id
      const [conds, meds, allergies, obs, encs] = await Promise.all([
        api.getFhirConditions(patientId, orgId).catch(() => ({ entry: [] })),
        api.getFhirMedications(patientId, orgId).catch(() => ({ entry: [] })),
        api.getFhirAllergies(patientId, orgId).catch(() => ({ entry: [] })),
        api.getFhirObservations(patientId, orgId).catch(() => ({ entry: [] })),
        api.getFhirEncounters(patientId, orgId).catch(() => ({ entry: [] })),
      ])
      setSummaries((p) => ({
        ...p,
        [ar.id]: {
          conditions: conds.entry?.length || 0,
          medications: meds.entry?.length || 0,
          allergies: allergies.entry?.length || 0,
          observations: obs.entry?.length || 0,
          encounters: encs.entry?.length || 0,
        },
      }))
    } finally {
      setFetching(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(196,255,77,0.2)', borderTopColor: '#c4ff4d' }} />
    </div>
  )

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-white mb-1">Clinician View</h1>
          <p className="text-[15px] text-white/30 font-light">Monitor access requests in real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPolling(!polling)}
            className={`inline-flex items-center gap-1.5 text-[11px] px-3.5 py-2 rounded-xl font-semibold border transition-all ${
              polling ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' : 'bg-white/[0.06] text-white/40 border-white/[0.06]'
            }`}
          >
            <Wifi className="w-3 h-3" />
            {polling ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={loadRequests}
            className="inline-flex items-center gap-1.5 text-[11px] px-3.5 py-2 rounded-xl font-medium bg-white/[0.06] text-white/40 border border-white/[0.06] hover:bg-white/[0.1] hover:text-white/60 transition-all"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {requests.length === 0 ? (
          <div className="bg-white/[0.04] rounded-2xl border border-white/[0.06] p-12 text-center text-white/20 text-[13px]">
            No access requests yet
          </div>
        ) : requests.map((ar) => (
          <div key={ar.id} className="bg-white/[0.04] backdrop-blur-sm rounded-xl border border-white/[0.06] overflow-hidden hover:bg-white/[0.06] transition-all">
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-white">
                  {ar.organization?.name || `Org #${ar.requesting_org_id}`}
                  {ar.organization?.ehr_vendor && (
                    <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-lg font-semibold ${
                      ar.organization.ehr_vendor === 'epic' ? 'bg-orange-500/15 text-orange-300' :
                      ar.organization.ehr_vendor === 'cerner' ? 'bg-cyan-500/15 text-cyan-300' :
                      ar.organization.ehr_vendor === 'meditech' ? 'bg-emerald-500/15 text-emerald-300' :
                      'bg-white/[0.06] text-white/40'
                    }`}>
                      {ar.organization.ehr_vendor === 'epic' ? 'Epic' :
                       ar.organization.ehr_vendor === 'cerner' ? 'Cerner' :
                       ar.organization.ehr_vendor === 'meditech' ? 'MEDITECH' :
                       ar.organization.ehr_vendor}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-white/25 mt-0.5">
                  Patient #{ar.patient_id} &middot; {new Date(ar.created_at).toLocaleString()}
                  {ar.organization?.fhir_profile && (
                    <span className="ml-1 text-white/15">({ar.organization.fhir_profile.toUpperCase()})</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold ${
                  ar.use_type === 'secondary_use' ? 'bg-violet-500/15 text-violet-300' : 'bg-sky-500/15 text-sky-300'
                }`}>
                  {USE_TYPE_LABELS[ar.use_type] || ar.use_type}
                </span>
                <span className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold ${
                  ar.status === 'approved' ? 'bg-emerald-500/15 text-emerald-300' :
                  ar.status === 'denied' ? 'bg-red-500/15 text-red-300' :
                  'bg-amber-500/15 text-amber-300'
                }`}>
                  {ar.status}
                </span>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-white/[0.04] text-[11px] text-white/25 space-y-1">
              <p><span className="text-white/15">Purpose:</span> {ar.purpose || 'Not specified'}</p>
              {ar.secondary_purpose && (
                <p><span className="text-white/15">Secondary Purpose:</span> {PURPOSE_LABELS[ar.secondary_purpose] || ar.secondary_purpose}</p>
              )}
              <p><span className="text-white/15">Scopes:</span> <code className="text-white/40 font-mono">{ar.scopes}</code></p>
              {ar.approved_time_window && (
                <p><span className="text-white/15">Time Window:</span> {ar.approved_time_window}</p>
              )}
              {ar.approved_duration && (
                <p><span className="text-white/15">Duration:</span> {ar.approved_duration}</p>
              )}
              {ar.approved_categories && (
                <p><span className="text-white/15">Categories:</span> {ar.approved_categories}</p>
              )}
            </div>

            {ar.status === 'approved' && (
              <div className="px-5 py-3 border-t border-white/[0.04]">
                {summaries[ar.id] ? (
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(summaries[ar.id]).map(([key, count]) => (
                      <div key={key} className="bg-white/[0.04] rounded-xl p-3 text-center">
                        <p className="text-lg font-semibold text-white">{count}</p>
                        <p className="text-[10px] text-white/25 capitalize font-medium">{key}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => handleFetchRecords(ar)}
                    disabled={fetching === ar.id}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-[12px] font-semibold rounded-xl transition-all disabled:opacity-40"
                    style={{ backgroundColor: '#c4ff4d', color: '#111111' }}
                  >
                    {fetching === ar.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Fetch FHIR Records
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Fulfillment Status */}
      {packets.length > 0 && (
        <div className="mt-10">
          <h2 className="text-[16px] font-semibold text-white mb-1">Fulfillment Status</h2>
          <p className="text-[12px] text-white/20 mb-4">
            Post-visit task routing reduces follow-up messaging and admin churn.
          </p>
          {packets.map((pkt) => (
            <div key={pkt.id} className="bg-white/[0.04] backdrop-blur-sm rounded-xl border border-white/[0.06] mb-3 overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between border-b border-white/[0.04]">
                <span className="text-[13px] font-medium text-white">Packet #{pkt.id}</span>
                <span className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold ${
                  pkt.status === 'completed' ? 'bg-emerald-500/15 text-emerald-300' :
                  pkt.status === 'blocked' ? 'bg-red-500/15 text-red-300' :
                  pkt.status === 'in_progress' ? 'bg-sky-500/15 text-sky-300' :
                  'bg-white/[0.06] text-white/40'
                }`}>
                  {pkt.status.replace('_', ' ')}
                </span>
              </div>
              <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {pkt.tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${TASK_STATUS_DOT[task.status] || 'bg-white/20'}`} />
                    <span className="text-[11px] text-white/50">
                      {TASK_TYPE_LABELS[task.type] || task.type}
                    </span>
                    <span className="text-[11px] text-white/20">{task.status}</span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-2 border-t border-white/[0.04] text-[11px] text-white/15">
                {new Date(pkt.created_at).toLocaleString()}
                {pkt.encounter_id && <span> &middot; Encounter #{pkt.encounter_id}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
