import { useEffect, useState } from 'react'
import { Compass, Network, Layers, Clock, ScrollText, MousePointerClick, Loader2, Sparkles } from 'lucide-react'
import { researchApi } from './researchApi'
import type { ExplorationSummary, ExplorationStyleAgg } from './types'

/** Researcher view of the instrumented free-exploration phase. */
export default function ExplorationPanel() {
  const [data, setData] = useState<ExplorationSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    researchApi.getExploration().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>
  }
  if (!data || data.n === 0) {
    return (
      <div className="bg-white rounded-2xl border border-sage-200/70 p-10 text-center shadow-soft">
        <Compass className="w-7 h-7 text-gray-300 mx-auto mb-3" />
        <p className="text-[14px] text-gray-500">No exploration data yet.</p>
        <p className="text-[12px] text-gray-400 mt-1">Clicks, scrolling, time, and attention appear here once participants explore the pages.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall attention / clicks split */}
      <div className="bg-white rounded-2xl border border-sage-200/70 p-5 shadow-soft">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900 mb-4">
          <Compass className="w-4.5 h-4.5 text-teal-600" /> Where attention went <span className="text-[12px] font-normal text-gray-400">· {data.n} page views</span>
        </h3>
        <Split label="Attention (dwell)" relPct={data.relational_attention_pct} />
        <Split label="Clicks" relPct={data.relational_clicks_pct} />
        <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal-500" /> Relational (linked)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-400" /> Non-relational (siloed)</span>
        </div>
      </div>

      {/* Design preference (forced choice) */}
      <PreferenceCard neon={data.preference?.neon ?? 0} generic={data.preference?.generic ?? 0} />

      {/* By style */}
      <div className="grid sm:grid-cols-2 gap-3">
        {data.by_style.map((s) => <StyleCard key={s.style} s={s} />)}
      </div>
    </div>
  )
}

function Split({ label, relPct }: { label: string; relPct: number | null }) {
  const rel = relPct ?? 0
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-[12px] text-gray-500 mb-1">
        <span>{label}</span>
        {relPct == null ? <span className="text-gray-400">no data</span> : <span className="font-semibold text-teal-700">{rel}% relational</span>}
      </div>
      <div className="flex h-5 rounded-md overflow-hidden bg-slate-100">
        <div className="h-full bg-teal-500" style={{ width: `${rel}%` }} />
        <div className="h-full bg-slate-400" style={{ width: `${100 - rel}%` }} />
      </div>
    </div>
  )
}

function StyleCard({ s }: { s: ExplorationStyleAgg }) {
  const isNeon = s.style === 'neon'
  return (
    <div className="bg-white rounded-2xl border border-sage-200/70 p-5 shadow-soft">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[14px] font-bold capitalize text-gray-900">{s.style} styling</span>
        <span
          className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded"
          style={isNeon ? { background: '#111', color: '#c4ff4d' } : { background: '#e2e8f0', color: '#334155' }}
        >
          {s.n} views
        </span>
      </div>
      {s.n === 0 ? (
        <p className="text-[13px] text-gray-400">No data yet.</p>
      ) : (
        <div className="space-y-2.5">
          <Metric icon={Clock} label="Avg time on page" value={s.mean_duration_sec == null ? '—' : `${s.mean_duration_sec}s`} />
          <Metric icon={ScrollText} label="Avg scroll depth" value={s.mean_scroll_pct == null ? '—' : `${s.mean_scroll_pct}%`} />
          <Metric icon={MousePointerClick} label="Avg clicks" value={s.mean_clicks == null ? '—' : `${s.mean_clicks}`} />
          <Metric icon={Network} label="Attention on relational" value={s.relational_attention_pct == null ? '—' : `${s.relational_attention_pct}%`} highlight />
          <Metric icon={Layers} label="Clicks on relational" value={s.relational_clicks_pct == null ? '—' : `${s.relational_clicks_pct}%`} />
        </div>
      )}
    </div>
  )
}

function Metric({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="flex items-center gap-2 text-gray-500"><Icon className="w-3.5 h-3.5 text-gray-400" /> {label}</span>
      <span className={`font-semibold tabular-nums ${highlight ? 'text-teal-700' : 'text-gray-800'}`}>{value}</span>
    </div>
  )
}

function PreferenceCard({ neon, generic }: { neon: number; generic: number }) {
  const total = neon + generic
  const neonPct = total ? Math.round((neon / total) * 100) : 0
  const genPct = total ? 100 - neonPct : 0
  return (
    <div className="bg-white rounded-2xl border border-sage-200/70 p-5 shadow-soft">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900 mb-4">
        <Sparkles className="w-4.5 h-4.5 text-teal-600" /> Preferred design <span className="text-[12px] font-normal text-gray-400">· {total} chose</span>
      </h3>
      {total === 0 ? (
        <p className="text-[13px] text-gray-400">No preferences submitted yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-xl p-4 text-center" style={{ background: '#0f1115' }}>
              <div className="text-[28px] font-bold tabular-nums" style={{ color: '#c4ff4d' }}>{neon}</div>
              <div className="text-[12px]" style={{ color: 'rgba(230,233,239,0.6)' }}>Neon · {neonPct}%</div>
            </div>
            <div className="rounded-xl p-4 text-center bg-slate-100">
              <div className="text-[28px] font-bold tabular-nums text-slate-700">{generic}</div>
              <div className="text-[12px] text-slate-500">Generic · {genPct}%</div>
            </div>
          </div>
          <div className="flex h-3 rounded-md overflow-hidden bg-slate-100">
            <div className="h-full" style={{ width: `${neonPct}%`, background: '#c4ff4d' }} />
            <div className="h-full bg-slate-400" style={{ width: `${genPct}%` }} />
          </div>
        </>
      )}
    </div>
  )
}
