import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { AccessLog } from '../../types'

export default function Logs() {
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAccessLogs(1).then((l) => { setLogs(l); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
    </div>
  )

  const actionColor = (action: string) => {
    if (action.includes('approved')) return 'bg-emerald-50 text-emerald-600'
    if (action.includes('denied')) return 'bg-red-50 text-red-500'
    if (action.includes('payment')) return 'bg-purple-50 text-purple-600'
    if (action.includes('retrieved') || action.includes('accessed')) return 'bg-teal-50 text-teal-600'
    return 'bg-gray-50 text-gray-400'
  }

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-900 mb-1">Access Logs</h1>
        <p className="text-[15px] text-gray-400 font-light">Complete audit trail of data access events</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
        {logs.length === 0 ? (
          <p className="p-8 text-[13px] text-gray-300 text-center">No access events recorded</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map((log) => (
              <div key={log.id} className="px-6 py-4 flex items-start gap-4 hover:bg-sage-50/30 transition-colors">
                <div className="flex-shrink-0 mt-0.5">
                  <span className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold ${actionColor(log.action)}`}>
                    {log.action.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-gray-600">{log.details}</p>
                  <p className="text-[11px] text-gray-300 mt-1">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
