import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldX, Clock, Sparkles, Loader2, SlidersHorizontal } from 'lucide-react'
import { api } from '../../api'
import type { AccessRequest } from '../../types'

const USE_LABELS: Record<string, string> = { primary_care: 'Primary Care', secondary_use: 'Secondary Use' }
const SEC_LABELS: Record<string, string> = {
  research: 'Research', quality_improvement: 'Quality Improvement',
  public_health: 'Public Health', operations_analytics: 'Operations Analytics',
  care_pattern_comparison: 'Care Pattern Comparison',
}

interface LimitsState { timeWindow: string; duration: string; categories: string[] }
const FHIR_CATEGORIES = ['Condition', 'MedicationRequest', 'AllergyIntolerance', 'Observation', 'Encounter']

export default function Requests() {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [limitsOpen, setLimitsOpen] = useState<number | null>(null)
  const [limits, setLimits] = useState<LimitsState>({ timeWindow: 'all', duration: 'one_time', categories: [...FHIR_CATEGORIES] })
  const [aiExplanations, setAiExplanations] = useState<Record<number, { explanation: string; risk_summary: string; recommendation: string }>>({})
  const [aiLoading, setAiLoading] = useState<number | null>(null)

  useEffect(() => {
    api.getAccessRequests({ patient_id: '1' }).then((r) => { setRequests(r); setLoading(false) })
  }, [])

  const handleDecision = async (id: number, status: 'approved' | 'denied', withLimits?: LimitsState) => {
    const data: any = { status }
    if (withLimits) {
      data.approved_time_window = withLimits.timeWindow
      data.approved_duration = withLimits.duration
      data.approved_categories = withLimits.categories.join(',')
    }
    const updated = await api.updateAccessRequest(id, data)
    setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)))
    setLimitsOpen(null)
  }

  const handleExplain = async (req: AccessRequest) => {
    setAiLoading(req.id)
    try {
      const result = await api.aiExplainConsent({
        organization_name: req.organization?.name || `Org #${req.requesting_org_id}`,
        purpose: req.purpose || 'Not specified',
        scopes: req.scopes || 'patient/*.read',
        patient_name: 'Alex',
        use_type: req.use_type,
        secondary_purpose: req.secondary_purpose || undefined,
      })
      setAiExplanations((p) => ({ ...p, [req.id]: result }))
    } finally {
      setAiLoading(null)
    }
  }

  const toggleCategory = (cat: string) => {
    setLimits((p) => ({
      ...p,
      categories: p.categories.includes(cat)
        ? p.categories.filter((c) => c !== cat)
        : [...p.categories, cat],
    }))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
    </div>
  )

  const pending = requests.filter((r) => r.status === 'pending')
  const resolved = requests.filter((r) => r.status !== 'pending')

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-900 mb-1">Access Requests</h1>
        <p className="text-[15px] text-gray-400 font-light">Manage who can access your health records</p>
      </div>

      {pending.length > 0 && (
        <div className="mb-10">
          <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Pending Approval ({pending.length})
          </h2>
          <div className="space-y-4">
            {pending.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl border border-amber-200/60 shadow-soft overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[14px] font-semibold text-gray-900">
                        {req.organization?.name || `Organization #${req.requesting_org_id}`}
                      </p>
                      <p className="text-[12px] text-gray-400 mt-0.5">
                        {req.organization?.ehr_system_name && `${req.organization.ehr_system_name} · `}
                        Requested {new Date(req.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold ${
                        req.use_type === 'secondary_use' ? 'bg-purple-50 text-purple-600' : 'bg-teal-50 text-teal-600'
                      }`}>
                        {USE_LABELS[req.use_type] || req.use_type}
                      </span>
                      {req.secondary_purpose && (
                        <span className="text-[10px] px-2.5 py-1 rounded-lg font-semibold bg-purple-50 text-purple-500">
                          {SEC_LABELS[req.secondary_purpose] || req.secondary_purpose}
                        </span>
                      )}
                    </div>
                  </div>

                  {req.purpose && (
                    <p className="text-[13px] text-gray-600 mb-2">
                      <span className="font-medium text-gray-700">Purpose:</span> {req.purpose}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-300 mb-4">
                    <span className="font-medium text-gray-400">Scopes:</span> <code className="text-gray-400">{req.scopes}</code>
                  </p>

                  {req.use_type === 'secondary_use' && (
                    <div className="mb-4 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                      <p className="text-[12px] text-purple-600 leading-relaxed">
                        <strong>Secondary Use Notice:</strong> This request may not directly benefit your personal care.
                        Your data may be used for {SEC_LABELS[req.secondary_purpose || ''] || 'unspecified purposes'}.
                        You can approve, deny, or approve with limits.
                      </p>
                    </div>
                  )}

                  {/* AI Explanation */}
                  <button
                    onClick={() => handleExplain(req)}
                    disabled={aiLoading === req.id}
                    className="mb-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-semibold rounded-xl bg-teal-50 text-teal-600 hover:bg-teal-100 transition-all disabled:opacity-50"
                  >
                    {aiLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI Explain This Request
                  </button>

                  {aiExplanations[req.id] && (
                    <div className="mb-4 p-5 bg-teal-50/30 rounded-xl border border-teal-100 space-y-2">
                      <p className="text-[13px] text-gray-700 leading-relaxed">{aiExplanations[req.id].explanation}</p>
                      <p className="text-[12px] text-amber-600 mt-2"><strong>Risks:</strong> {aiExplanations[req.id].risk_summary}</p>
                      <p className="text-[12px] text-teal-600 mt-1"><strong>Recommendation:</strong> {aiExplanations[req.id].recommendation}</p>
                    </div>
                  )}

                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => handleDecision(req.id, 'approved')}
                      className="px-5 py-2.5 bg-emerald-500 text-white text-[13px] font-semibold rounded-xl hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-sm"
                    >
                      <ShieldCheck className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => {
                        setLimitsOpen(limitsOpen === req.id ? null : req.id)
                        setLimits({ timeWindow: 'all', duration: 'one_time', categories: [...FHIR_CATEGORIES] })
                      }}
                      className="px-5 py-2.5 border border-teal-200 text-teal-600 text-[13px] font-semibold rounded-xl hover:bg-teal-50 transition-all flex items-center gap-2"
                    >
                      <SlidersHorizontal className="w-4 h-4" /> Approve with Limits
                    </button>
                    <button
                      onClick={() => handleDecision(req.id, 'denied')}
                      className="px-5 py-2.5 border border-red-200 text-red-400 text-[13px] font-medium rounded-xl hover:bg-red-50 transition-all flex items-center gap-2"
                    >
                      <ShieldX className="w-4 h-4" /> Deny
                    </button>
                  </div>
                </div>

                {/* Approve with Limits Panel */}
                {limitsOpen === req.id && (
                  <div className="px-6 py-5 border-t border-sage-100 bg-sage-50/30 space-y-4">
                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Set Access Limits</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] text-gray-400 font-semibold">Time Window</label>
                        <select
                          value={limits.timeWindow}
                          onChange={(e) => setLimits((p) => ({ ...p, timeWindow: e.target.value }))}
                          className="mt-1 w-full text-[13px] border border-gray-200 rounded-xl px-3.5 py-2.5 bg-white focus:border-teal-300 focus:ring-1 focus:ring-teal-200 outline-none transition-all"
                        >
                          <option value="all">All Records</option>
                          <option value="6_months">Last 6 Months</option>
                          <option value="12_months">Last 12 Months</option>
                          <option value="24_months">Last 24 Months</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 font-semibold">Access Duration</label>
                        <select
                          value={limits.duration}
                          onChange={(e) => setLimits((p) => ({ ...p, duration: e.target.value }))}
                          className="mt-1 w-full text-[13px] border border-gray-200 rounded-xl px-3.5 py-2.5 bg-white focus:border-teal-300 focus:ring-1 focus:ring-teal-200 outline-none transition-all"
                        >
                          <option value="one_time">One-Time Access</option>
                          <option value="30_days">30 Days</option>
                          <option value="90_days">90 Days</option>
                          <option value="1_year">1 Year</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 font-semibold mb-2 block">Data Categories</label>
                      <div className="flex flex-wrap gap-2">
                        {FHIR_CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => toggleCategory(cat)}
                            className={`text-[11px] px-3.5 py-1.5 rounded-xl font-semibold transition-all ${
                              limits.categories.includes(cat)
                                ? 'bg-teal-100 text-teal-700 border border-teal-200'
                                : 'bg-gray-100 text-gray-400 border border-gray-200'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDecision(req.id, 'approved', limits)}
                      className="px-5 py-2.5 bg-teal-500 text-white text-[13px] font-semibold rounded-xl hover:bg-teal-600 transition-all shadow-sm"
                    >
                      Approve with These Limits
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-4">Request History</h2>
        {resolved.length === 0 ? (
          <p className="text-[13px] text-gray-300">No resolved requests yet</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-soft divide-y divide-gray-50">
            {resolved.map((req) => (
              <div key={req.id} className="px-6 py-4 flex items-center justify-between hover:bg-sage-50/30 transition-colors">
                <div>
                  <p className="text-[13px] font-medium text-gray-800">
                    {req.organization?.name || `Organization #${req.requesting_org_id}`}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    <span className={`font-semibold ${req.use_type === 'secondary_use' ? 'text-purple-400' : 'text-teal-500'}`}>
                      {USE_LABELS[req.use_type] || req.use_type}
                    </span>
                    {' · '}{new Date(req.created_at).toLocaleString()}
                    {req.resolved_at && ` · Resolved ${new Date(req.resolved_at).toLocaleString()}`}
                  </p>
                  {req.approved_time_window && req.approved_time_window !== 'all' && (
                    <p className="text-[11px] text-gray-300 mt-0.5">
                      Limits: {req.approved_time_window} window, {req.approved_duration} duration
                      {req.approved_categories && `, categories: ${req.approved_categories}`}
                    </p>
                  )}
                </div>
                <span className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold ${
                  req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                }`}>
                  {req.status === 'approved' ? 'Approved' : 'Denied'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
