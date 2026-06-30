import { useEffect, useState } from 'react'
import { Send, CheckCircle, XCircle, Clock, CreditCard } from 'lucide-react'
import { api } from '../../api'
import type { Organization, AccessRequest, Patient } from '../../types'

export default function EhrDashboard() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [selectedOrg, setSelectedOrg] = useState<number | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null)
  const [purpose, setPurpose] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [paying, setPaying] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadData = async () => {
    const [o, p, r] = await Promise.all([
      api.getOrganizations(),
      api.getPatients(),
      api.getAccessRequests(),
    ])
    setOrgs(o)
    setPatients(p)
    setRequests(r)
    if (o.length > 0 && !selectedOrg) setSelectedOrg(o[0].id)
    if (p.length > 0 && !selectedPatient) setSelectedPatient(p[0].id)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleRequest = async () => {
    if (!selectedOrg || !selectedPatient) return
    setSending(true)
    setMessage(null)
    try {
      await api.createAccessRequest({
        patient_id: selectedPatient,
        requesting_org_id: selectedOrg,
        purpose: purpose || 'Continuity of care — requesting patient records for treatment',
      })
      setMessage({ type: 'success', text: 'Access request sent successfully. Waiting for patient approval.' })
      setPurpose('')
      await loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
    setSending(false)
  }

  const handlePayment = async (requestId: number) => {
    setPaying(requestId)
    setMessage(null)
    try {
      await api.createPayment({ access_request_id: requestId })
      setMessage({ type: 'success', text: 'Payment completed. You can now retrieve records.' })
      await loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
    setPaying(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(196,255,77,0.2)', borderTopColor: '#c4ff4d' }} />
    </div>
  )

  const statusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-emerald-400" />
      case 'denied': return <XCircle className="w-4 h-4 text-red-400" />
      default: return <Clock className="w-4 h-4 text-amber-400" />
    }
  }

  const inputClass = 'w-full text-white text-[13px] rounded-xl px-3.5 py-2.5 outline-none transition-all'
  const inputStyle = { backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ffffff' }
  const labelClass = 'block text-[11px] font-semibold uppercase tracking-wider mb-1.5'
  const labelStyle = { color: 'rgba(255,255,255,0.35)' }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-white mb-1">Request Patient Records</h1>
        <p className="text-[15px] text-white/30 font-light">
          Request access to patient health data via FHIR
        </p>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3.5 rounded-xl text-[13px] font-medium flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border border-red-500/20 text-red-300'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Request Form */}
      <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-7 mb-8">
        <h2 className="text-[13px] font-bold text-white/50 uppercase tracking-wider mb-5">New Access Request</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass} style={labelStyle}>Your Organization</label>
            <select
              value={selectedOrg || ''}
              onChange={(e) => setSelectedOrg(Number(e.target.value))}
              className={inputClass}
              style={inputStyle}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name} ({o.ehr_system_name})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Patient</label>
            <select
              value={selectedPatient || ''}
              onChange={(e) => setSelectedPatient(Number(e.target.value))}
              className={inputClass}
              style={inputStyle}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-5">
          <label className={labelClass} style={labelStyle}>Purpose of Request</label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Continuity of care — requesting patient records for treatment"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <button
          onClick={handleRequest}
          disabled={sending}
          className="px-5 py-3 text-[13px] font-semibold rounded-xl transition-all flex items-center gap-2 disabled:opacity-40"
          style={{ backgroundColor: '#c4ff4d', color: '#111111' }}
        >
          <Send className="w-4 h-4" />
          {sending ? 'Sending...' : 'Send Access Request'}
        </button>
      </div>

      {/* Request Status */}
      <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-[13px] font-bold text-white/50 uppercase tracking-wider">Request Status</h2>
        </div>
        {requests.length === 0 ? (
          <p className="p-6 text-[13px] text-white/20">No requests yet</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {requests.map((req) => {
              const hasPaidRequest = req.status === 'approved'
              return (
                <div key={req.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {statusIcon(req.status)}
                      <div>
                        <p className="text-[13px] font-medium text-white">
                          Request #{req.id} — Patient #{req.patient_id}
                        </p>
                        <p className="text-[11px] text-white/25 mt-0.5">
                          {req.organization?.name} &middot; {new Date(req.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold ${
                      req.status === 'approved' ? 'bg-emerald-500/15 text-emerald-300' :
                      req.status === 'denied' ? 'bg-red-500/15 text-red-300' :
                      'bg-amber-500/10 text-amber-300'
                    }`}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </span>
                  </div>
                  {req.purpose && (
                    <p className="text-[12px] text-white/20 ml-7 mb-2">{req.purpose}</p>
                  )}
                  {hasPaidRequest && (
                    <div className="ml-7 flex gap-2">
                      <button
                        onClick={() => handlePayment(req.id)}
                        disabled={paying === req.id}
                        className="px-4 py-2 bg-violet-500/20 text-violet-300 text-[11px] font-semibold rounded-lg hover:bg-violet-500/30 border border-violet-500/20 transition-all flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        {paying === req.id ? 'Processing...' : 'Pay Access Fee ($25.00)'}
                      </button>
                      <a
                        href={`/ehr/records?request_id=${req.id}&patient_id=${req.patient_id}&org_id=${req.requesting_org_id}`}
                        className="px-4 py-2 text-[11px] font-semibold rounded-lg transition-all"
                        style={{ backgroundColor: 'rgba(77,128,255,0.15)', color: 'rgba(160,188,255,0.9)', border: '1px solid rgba(77,128,255,0.2)' }}
                      >
                        Retrieve Records
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
