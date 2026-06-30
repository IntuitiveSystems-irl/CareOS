import { useEffect, useMemo, useState } from 'react'
import {
  MessageSquareQuote, Loader2, Check, CheckCheck, Inbox, User, GitBranch,
} from 'lucide-react'
import { api } from '../../api'

const SENTIMENT_STYLE: Record<string, string> = {
  concern: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  decline: 'bg-red-500/15 text-red-300 border-red-500/20',
  preference: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  question: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  agree: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
}

const STATUS_TABS = [
  { value: 'open', label: 'Open' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
  { value: '', label: 'All' },
]

export default function FeedbackInbox() {
  const [rows, setRows] = useState<any[]>([])
  const [patients, setPatients] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('open')
  const [busy, setBusy] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (status) params.status = status
    api.getFeedbackInbox(params)
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    api.getPatients().then((ps) => {
      const map: Record<number, string> = {}
      for (const p of ps) map[p.id] = `${p.first_name} ${p.last_name}`
      setPatients(map)
    }).catch(() => {})
  }, [])

  useEffect(() => { load() /* eslint-disable-next-line */ }, [status])

  const setStatusOf = async (id: number, newStatus: string) => {
    setBusy(id)
    try {
      await api.updateFeedback(id, { status: newStatus })
      load()
    } catch { /* ignore */ }
    setBusy(null)
  }

  const openCount = useMemo(() => rows.filter((r) => r.status === 'open').length, [rows])

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-white mb-1">Patient Feedback Inbox</h1>
        <p className="text-[15px] text-white/40 font-light">
          Triage the patient's voice — the same notes that surface as CDS cards on the chart
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1 mb-6 w-fit">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatus(t.value)}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
            style={status === t.value ? { backgroundColor: '#c4ff4d', color: '#111111' } : { color: 'rgba(255,255,255,0.5)' }}
          >
            {t.label}{t.value === 'open' && openCount > 0 ? ` (${openCount})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-emerald-400 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <Inbox className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p className="text-[14px]">No {status || ''} feedback.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((f) => (
            <div key={f.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                  <MessageSquareQuote className="w-4 h-4 text-emerald-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-white">
                      <User className="w-3.5 h-3.5 text-white/40" />
                      {patients[f.patient_id] || `Patient ${f.patient_id}`}
                    </span>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${SENTIMENT_STYLE[f.sentiment] || ''}`}>
                      {f.sentiment}
                    </span>
                    {f.target_label && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-white/[0.06] text-white/70 border border-white/[0.08]">
                        <GitBranch className="w-3 h-3 text-white/35" />
                        <span className="text-white/35">{f.target_kind}</span> {f.target_label}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-white/30">{new Date(f.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-[13px] text-white/70 leading-relaxed">{f.message}</p>
                  {f.acknowledged_by && (
                    <p className="text-[11px] text-emerald-400/70 mt-2 font-mono">ack by {f.acknowledged_by}</p>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    {f.status !== 'acknowledged' && f.status !== 'resolved' && (
                      <button
                        onClick={() => setStatusOf(f.id, 'acknowledged')}
                        disabled={busy === f.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-white/[0.06] border border-white/[0.08] text-white/70 hover:text-white transition-all"
                      >
                        {busy === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Acknowledge
                      </button>
                    )}
                    {f.status !== 'resolved' && (
                      <button
                        onClick={() => setStatusOf(f.id, 'resolved')}
                        disabled={busy === f.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/25 transition-all"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> Resolve
                      </button>
                    )}
                    <span className="text-[11px] text-white/30 capitalize">status: {f.status}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
