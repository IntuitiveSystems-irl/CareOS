import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { PatientAccessLog, UseType } from '../../types'

const USE_TYPE_LABELS: Record<UseType, string> = {
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

export default function AccessLogPage() {
  const [logs, setLogs] = useState<PatientAccessLog[]>([])
  const [filter, setFilter] = useState<UseType | ''>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params: Record<string, string> = {}
    if (filter) params.use_type = filter
    api.getPatientAccessLog(1, Object.keys(params).length ? params : undefined)
      .then(setLogs)
      .finally(() => setLoading(false))
  }, [filter])

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-gray-900 mb-1">Data Access Log</h1>
          <p className="text-[15px] text-gray-400 font-light">Complete transparency into who accessed your data and why</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as UseType | '')}
          className="text-[13px] border border-gray-200 rounded-xl px-3.5 py-2.5 bg-white focus:border-teal-300 focus:ring-1 focus:ring-teal-200 outline-none transition-all"
        >
          <option value="">All Types</option>
          <option value="primary_care">Primary Care</option>
          <option value="secondary_use">Secondary Use</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Organization</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Use Type</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Purpose</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Scopes</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Date</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Token</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-[13px] text-gray-300">No access log entries</td></tr>
            ) : logs.map((log) => (
              <tr key={log.id} className="hover:bg-sage-50/30 transition-colors">
                <td className="px-6 py-3 text-[13px] font-medium text-gray-800">{log.organization_name || `Org #${log.requesting_org_id}`}</td>
                <td className="px-6 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                    log.use_type === 'secondary_use' ? 'bg-purple-50 text-purple-600' : 'bg-teal-50 text-teal-600'
                  }`}>
                    {USE_TYPE_LABELS[log.use_type] || log.use_type}
                  </span>
                </td>
                <td className="px-6 py-3 text-[12px] text-gray-500">
                  {log.secondary_purpose ? PURPOSE_LABELS[log.secondary_purpose] || log.secondary_purpose : '—'}
                </td>
                <td className="px-6 py-3 text-[11px] text-gray-400 font-mono max-w-[180px] truncate">{log.scopes || '—'}</td>
                <td className="px-6 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                    log.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                    log.status === 'denied' ? 'bg-red-50 text-red-500' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    {log.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-[12px] text-gray-400">{new Date(log.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-3 text-[11px] text-gray-300">{log.token_id ? `#${log.token_id}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
