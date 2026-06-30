import { useEffect, useMemo, useState } from 'react'
import { Users, Loader2, RefreshCw } from 'lucide-react'
import { researchApi } from './researchApi'
import type { RosterRow } from './types'

const STATUS_STYLE: Record<string, string> = {
  enrolled: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-teal-100 text-teal-700',
  withdrawn: 'bg-red-100 text-red-600',
}

/** Researcher roster: who signed up, their status, and progress (passcode-gated). */
export default function ParticipantRoster() {
  const [rows, setRows] = useState<RosterRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    researchApi.getRoster().then(setRows).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const counts = useMemo(() => {
    const c = { total: rows.length, completed: 0, in_progress: 0, enrolled: 0 }
    rows.forEach((r) => {
      if (r.status === 'completed') c.completed++
      else if (r.status === 'in_progress') c.in_progress++
      else if (r.status === 'enrolled') c.enrolled++
    })
    return c
  }, [rows])

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="flex items-center gap-2 text-[16px] font-semibold text-gray-900">
          <Users className="w-4.5 h-4.5 text-teal-600" />
          Participants ({counts.total})
        </h3>
        <div className="flex items-center gap-3 text-[12px] text-gray-500">
          <span><b className="text-teal-700">{counts.completed}</b> completed</span>
          <span><b className="text-amber-600">{counts.in_progress}</b> in progress</span>
          <span><b className="text-slate-500">{counts.enrolled}</b> signed up</span>
          <button onClick={load} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-sage-200 hover:bg-teal-50 text-gray-500">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-[14px] text-gray-400 py-8 text-center">No sign-ups yet.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-sage-200/70 shadow-soft overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-sage-200">
                <th className="text-left py-2.5 px-3">Code</th>
                <th className="text-left px-3">Name</th>
                <th className="text-left px-3">Email</th>
                <th className="text-left px-3">Role</th>
                <th className="text-left px-3">First arm</th>
                <th className="text-left px-3">Status</th>
                <th className="text-right px-3">Progress</th>
                <th className="text-left px-3">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-sage-100 hover:bg-warm-50/60">
                  <td className="py-2.5 px-3 font-semibold text-gray-700">{r.participant_code}</td>
                  <td className="px-3 text-gray-700">{r.full_name || '—'}</td>
                  <td className="px-3 text-gray-500">{r.email || '—'}</td>
                  <td className="px-3 text-gray-500">{r.role ? r.role.replace(/_/g, ' ') : '—'}</td>
                  <td className="px-3 text-gray-500">{r.condition_order === 'traditional_first' ? 'Traditional' : 'Relational'}</td>
                  <td className="px-3">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_STYLE[r.status] || 'bg-slate-100 text-slate-600'}`}>
                      {r.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-3 text-right tabular-nums text-gray-500" title="tasks · workload · comments">
                    {r.n_attempts}t · {r.n_workload}w · {r.n_qualitative}c
                  </td>
                  <td className="px-3 text-gray-400">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
