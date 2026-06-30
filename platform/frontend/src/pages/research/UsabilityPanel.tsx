import { useEffect, useState } from 'react'
import { Gauge, ListChecks, Palette, MessageSquareText, Loader2 } from 'lucide-react'
import { researchApi } from './researchApi'
import type { UsabilitySummary } from './types'

/** Researcher view of the CareOS usability evaluation (SUS + heuristics + design). */
export default function UsabilityPanel() {
  const [data, setData] = useState<UsabilitySummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    researchApi.getUsability().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>
  }
  if (!data || data.n === 0) {
    return (
      <div className="bg-white rounded-2xl border border-sage-200/70 p-10 text-center shadow-soft">
        <Gauge className="w-7 h-7 text-gray-300 mx-auto mb-3" />
        <p className="text-[14px] text-gray-500">No usability evaluations submitted yet.</p>
        <p className="text-[12px] text-gray-400 mt-1">SUS, heuristics, and design feedback appear here once participants finish.</p>
      </div>
    )
  }

  const { sus } = data
  return (
    <div className="space-y-6">
      {/* SUS hero */}
      <div className="bg-white rounded-2xl border border-sage-200/70 p-5 shadow-soft">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900 mb-4">
          <Gauge className="w-4.5 h-4.5 text-teal-600" /> System Usability Scale
        </h3>
        <div className="grid sm:grid-cols-[200px_1fr] gap-5 items-center">
          <div className="text-center sm:border-r border-sage-100 sm:pr-5">
            <div className="text-[52px] leading-none font-bold text-gray-900 tabular-nums">{sus.mean ?? '—'}</div>
            <div className="text-[12px] text-gray-400 mt-1">mean SUS · n={sus.n}</div>
            <div className="flex items-center justify-center gap-2 mt-2">
              {sus.grade && <span className="text-[12px] font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-700">Grade {sus.grade}</span>}
              {sus.adjective && <span className="text-[12px] font-semibold px-2 py-0.5 rounded-md bg-sage-100 text-gray-600">{sus.adjective}</span>}
            </div>
          </div>
          <div>
            {/* 0-100 scale with benchmark at 68 (industry average) */}
            <div className="relative h-7 rounded-lg bg-gradient-to-r from-red-100 via-amber-100 to-teal-100 overflow-hidden">
              {sus.mean != null && (
                <div className="absolute top-0 bottom-0 w-1 bg-teal-600 rounded" style={{ left: `calc(${Math.min(100, Math.max(0, sus.mean))}% - 2px)` }} />
              )}
              <div className="absolute top-0 bottom-0 border-l border-dashed border-gray-400/70" style={{ left: '68%' }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>0</span>
              <span className="text-gray-500">68 = industry avg</span>
              <span>100</span>
            </div>
            <div className="flex gap-4 text-[12px] text-gray-500 mt-3">
              <span>min <b className="text-gray-700 tabular-nums">{sus.min ?? '—'}</b></span>
              <span>max <b className="text-gray-700 tabular-nums">{sus.max ?? '—'}</b></span>
              <span>SD <b className="text-gray-700 tabular-nums">{sus.sd ?? '—'}</b></span>
            </div>
          </div>
        </div>
      </div>

      {/* Heuristics */}
      <div className="bg-white rounded-2xl border border-sage-200/70 p-5 shadow-soft">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900 mb-4">
          <ListChecks className="w-4.5 h-4.5 text-teal-600" /> Usability heuristics <span className="text-[12px] font-normal text-gray-400">(mean of 5)</span>
        </h3>
        <div className="space-y-2.5">
          {data.heuristics.map((h) => <Rating5 key={h.key} label={h.name} mean={h.mean} n={h.n} />)}
        </div>
      </div>

      {/* Design */}
      <div className="bg-white rounded-2xl border border-sage-200/70 p-5 shadow-soft">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900 mb-4">
          <Palette className="w-4.5 h-4.5 text-teal-600" /> Design ratings <span className="text-[12px] font-normal text-gray-400">(mean of 5)</span>
        </h3>
        <div className="space-y-2.5">
          {data.design.map((d) => <Rating5 key={d.key} label={d.label} mean={d.mean} n={d.n} />)}
        </div>
      </div>

      {/* Open feedback */}
      <div className="bg-white rounded-2xl border border-sage-200/70 p-5 shadow-soft">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900 mb-4">
          <MessageSquareText className="w-4.5 h-4.5 text-teal-600" /> Function & design feedback <span className="text-[12px] font-normal text-gray-400">({data.feedback.length})</span>
        </h3>
        {data.feedback.length === 0 ? (
          <p className="text-[13px] text-gray-400">No written feedback yet.</p>
        ) : (
          <div className="space-y-3">
            {data.feedback.map((f, i) => (
              <div key={i} className="rounded-xl border border-sage-200/70 p-4 bg-sage-50/30">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Participant #{f.participant_id}</div>
                <div className="space-y-1.5 text-[13px]">
                  {f.most_valuable && <FeedbackLine label="Most valuable" text={f.most_valuable} />}
                  {f.missing_functions && <FeedbackLine label="Missing" text={f.missing_functions} />}
                  {f.friction && <FeedbackLine label="Friction" text={f.friction} />}
                  {f.general_comments && <FeedbackLine label="Other" text={f.general_comments} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Rating5({ label, mean, n }: { label: string; mean: number | null; n: number }) {
  const w = mean == null ? 0 : Math.min(100, (mean / 5) * 100)
  return (
    <div className="flex items-center gap-3">
      <span className="w-48 text-[13px] text-gray-600 truncate" title={label}>{label}</span>
      <div className="flex-1 h-5 rounded-md bg-sage-50 overflow-hidden">
        <div className="h-full bg-teal-500 rounded-md transition-all" style={{ width: `${w}%` }} />
      </div>
      <span className="w-16 text-right text-[12px] font-semibold text-gray-700 tabular-nums">
        {mean == null ? '—' : mean.toFixed(2)} <span className="text-gray-400 font-normal">·{n}</span>
      </span>
    </div>
  )
}

function FeedbackLine({ label, text }: { label: string; text: string }) {
  return (
    <p className="text-gray-700">
      <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide mr-1.5">{label}:</span>
      {text}
    </p>
  )
}
