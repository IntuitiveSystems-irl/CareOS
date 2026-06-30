import { useEffect, useMemo, useState } from 'react'
import { MessageSquareText, Tag, Loader2 } from 'lucide-react'
import { researchApi } from './researchApi'
import type { QualitativeRow } from './types'

/** Researcher view: read open-ended responses and apply thematic codes/themes
 *  (the qualitative strand of the convergent design). */
export default function QualCodingBoard() {
  const [rows, setRows] = useState<QualitativeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'traditional' | 'relational'>('all')

  useEffect(() => {
    researchApi.listQualitative()
      .then(setRows)
      .finally(() => setLoading(false))
  }, [])

  const themes = useMemo(() => {
    const counts: Record<string, number> = {}
    rows.forEach((r) => { if (r.theme) counts[r.theme] = (counts[r.theme] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [rows])

  const visible = rows.filter((r) => filter === 'all' || r.interface === filter)

  const update = (id: number, patch: Partial<QualitativeRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const save = async (r: QualitativeRow) => {
    await researchApi.codeQualitative(r.id, { code: r.code || '', theme: r.theme || '' }).catch(() => {})
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="flex items-center gap-2 text-[16px] font-semibold text-gray-900">
          <MessageSquareText className="w-4.5 h-4.5 text-teal-600" />
          Qualitative responses ({rows.length})
        </h3>
        <div className="flex gap-1.5">
          {(['all', 'traditional', 'relational'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium capitalize transition-all ${
                filter === f ? 'bg-teal-500 text-white' : 'bg-white text-gray-500 border border-sage-200 hover:bg-teal-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {themes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {themes.map(([t, c]) => (
            <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 text-[12px]">
              <Tag className="w-3 h-3" /> {t} <span className="text-teal-500 font-semibold">{c}</span>
            </span>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-[14px] text-gray-400 py-8 text-center">No responses yet.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-sage-200/70 p-4">
              <div className="flex items-center gap-2 mb-1.5 text-[11px]">
                <span className="font-semibold text-gray-500">#{r.participant_id}</span>
                {r.interface && (
                  <span className={`px-2 py-0.5 rounded-md font-medium ${r.interface === 'relational' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                    {r.interface}
                  </span>
                )}
                <span className="text-gray-400">{r.prompt}</span>
              </div>
              <p className="text-[14px] text-gray-800 mb-3 whitespace-pre-wrap">{r.response}</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={r.code || ''}
                  onChange={(e) => update(r.id, { code: e.target.value })}
                  onBlur={() => save(r)}
                  placeholder="Code (e.g. navigation_friction)"
                  className="px-3 py-1.5 rounded-lg border border-sage-200 text-[12px] focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none"
                />
                <input
                  value={r.theme || ''}
                  onChange={(e) => update(r.id, { theme: e.target.value })}
                  onBlur={() => save(r)}
                  placeholder="Theme (e.g. Cognitive load)"
                  className="px-3 py-1.5 rounded-lg border border-sage-200 text-[12px] focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
