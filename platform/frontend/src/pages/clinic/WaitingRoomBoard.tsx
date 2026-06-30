/**
 * CareOS Clinic Waiting Room Board
 * Route: /clinic/board
 *
 * TV/display-optimised scoreboard for clinic waiting rooms.
 * Shows only clinician-validated, de-identified case notes.
 * Auto-refreshes every 20 seconds.
 * No PHI. Patients can see what types of cases are actively being
 * researched or reported at this and other CareOS-connected clinics.
 */
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, Shield, FlaskConical, CheckCircle2, Clock,
  Globe, Zap, AlertTriangle, Heart, Users, RefreshCw,
} from 'lucide-react'

const API = '/api'
const REFRESH_MS = 20_000

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Respiratory':       { bg: '#4d80ff18', text: '#4d80ff', border: '#4d80ff30' },
  'Cardiology':        { bg: '#ff6b5b18', text: '#ff6b5b', border: '#ff6b5b30' },
  'Primary Care':      { bg: '#c4ff4d18', text: '#9bcc00', border: '#c4ff4d30' },
  'Allergy/Immunology':{ bg: '#ffd23f18', text: '#ffd23f', border: '#ffd23f30' },
  'Endocrinology':     { bg: '#9ee3db18', text: '#9ee3db', border: '#9ee3db30' },
  'Pulmonology':       { bg: '#c084fc18', text: '#c084fc', border: '#c084fc30' },
  'Gastroenterology':  { bg: '#fb923c18', text: '#fb923c', border: '#fb923c30' },
  'Infectious Disease':{ bg: '#34d39918', text: '#34d399', border: '#34d39930' },
}

const CATEGORY_ICONS: Record<string, any> = {
  'Respiratory': Activity,
  'Cardiology': Heart,
  'Allergy/Immunology': AlertTriangle,
  'Infectious Disease': FlaskConical,
}

function categoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] || { bg: '#ffffff10', text: '#ffffff80', border: '#ffffff20' }
}

function CategoryIcon({ cat }: { cat: string }) {
  const Icon = CATEGORY_ICONS[cat] || Activity
  return <Icon className="w-4 h-4" />
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface BoardEntry {
  id: number
  category: string
  headline: string
  conditions: { code: string; label: string }[]
  region: string
  age_bucket: string
  research_authorized: boolean
  validated_at: string
  clinic_name: string
}

interface BoardData {
  board: BoardEntry[]
  stats: {
    total_validated: number
    total_pool: number
    pending_validation: number
    top_conditions: { code: string; label: string; count: number }[]
    by_category: { category: string; count: number }[]
  }
}

export default function WaitingRoomBoard() {
  const [data, setData] = useState<BoardData | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [tick, setTick] = useState(0)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/pool/board?limit=12`)
      const d = await r.json()
      setData(d)
      setLastRefresh(new Date())
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const refresh = setInterval(load, REFRESH_MS)
    const ticker = setInterval(() => setTick(t => t + 1), 1000)
    return () => { clearInterval(refresh); clearInterval(ticker) }
  }, [load])

  const entries = data?.board || []
  const stats = data?.stats

  return (
    <div
      className="min-h-screen text-white select-none"
      style={{
        background: 'linear-gradient(135deg, #050508 0%, #0a0a12 50%, #050508 100%)',
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');`}</style>

      {/* Header bar */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#c4ff4d] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#111]" />
          </div>
          <div>
            <div className="text-[17px] font-bold leading-tight">CareOS Clinical Knowledge Board</div>
            <div className="text-[11px] text-white/35">Clinician-validated · De-identified · No PHI</div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {stats && (
            <div className="flex items-center gap-5 text-center">
              <div>
                <div className="text-[22px] font-bold text-[#c4ff4d]">{stats.total_validated}</div>
                <div className="text-[10px] text-white/35 uppercase tracking-wider">Validated</div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <div className="text-[22px] font-bold text-white/60">{stats.total_pool}</div>
                <div className="text-[10px] text-white/35 uppercase tracking-wider">Total pool</div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <div className="text-[22px] font-bold text-[#4d80ff]">
                  {stats.by_category.length}
                </div>
                <div className="text-[10px] text-white/35 uppercase tracking-wider">Specialties</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#c4ff4d]/10 border border-[#c4ff4d]/25">
            <span className="w-2 h-2 rounded-full bg-[#c4ff4d] animate-pulse" />
            <span className="text-[11px] font-bold text-[#c4ff4d] uppercase tracking-wider">Live</span>
          </div>
        </div>
      </header>

      <div className="flex gap-0 min-h-[calc(100vh-72px)]">

        {/* Left sidebar — stats */}
        <aside className="w-64 shrink-0 border-r border-white/6 p-5 flex flex-col gap-5">

          {/* Top conditions */}
          {stats?.top_conditions && stats.top_conditions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-3.5 h-3.5 text-[#c4ff4d]" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Trending</span>
              </div>
              <div className="space-y-2">
                {stats.top_conditions.map((c, i) => (
                  <div key={c.code} className="flex items-center gap-2">
                    <span className="text-[11px] font-bold w-4 text-white/25">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-white truncate">{c.label}</div>
                      <div className="h-1 mt-1 rounded-full bg-white/8 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#c4ff4d]"
                          style={{ width: `${Math.max(8, (c.count / (stats.top_conditions[0]?.count || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] text-white/40 font-mono">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="w-full h-px bg-white/6" />

          {/* By category */}
          {stats?.by_category && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-3.5 h-3.5 text-[#4d80ff]" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">By Specialty</span>
              </div>
              <div className="space-y-2">
                {stats.by_category.map(b => {
                  const st = categoryStyle(b.category)
                  return (
                    <div key={b.category} className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold" style={{ color: st.text }}>{b.category}</span>
                      <span className="text-[11px] text-white/35 font-mono">{b.count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="w-full h-px bg-white/6" />

          {/* Info notice */}
          <div className="rounded-xl bg-white/4 border border-white/8 p-3">
            <Shield className="w-4 h-4 text-white/25 mb-2" />
            <p className="text-[10px] text-white/30 leading-relaxed">
              All cases on this board have been reviewed and signed off by a licensed clinician.
              No patient names, dates of birth, or other identifying information is displayed.
            </p>
          </div>

          <div className="mt-auto">
            <div className="flex items-center gap-1.5 text-[10px] text-white/20">
              <RefreshCw className="w-3 h-3" />
              <span>{lastRefresh.toLocaleTimeString()}</span>
            </div>
            <Link to="/live" className="block mt-2 text-[10px] text-white/20 hover:text-white/50 transition">
              Global data pool →
            </Link>
          </div>
        </aside>

        {/* Main board */}
        <main className="flex-1 p-6 overflow-auto">

          {entries.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <Clock className="w-12 h-12 text-white/15" />
              <p className="text-[18px] font-semibold text-white/40">No validated entries yet</p>
              <p className="text-[13px] text-white/25 max-w-xs">
                Cases appear here after a clinician reviews and signs off on the de-identified data.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {entries.map((entry, i) => {
              const st = categoryStyle(entry.category)
              const isNew = entry.validated_at &&
                (Date.now() - new Date(entry.validated_at).getTime()) < 3600_000
              return (
                <div
                  key={entry.id}
                  className="rounded-2xl border p-5 flex flex-col gap-3 transition-all"
                  style={{
                    background: st.bg,
                    borderColor: st.border,
                    opacity: i > 8 ? 0.7 : 1,
                  }}
                >
                  {/* Category header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: `${st.text}22` }}
                      >
                        <span style={{ color: st.text }}>
                          <CategoryIcon cat={entry.category} />
                        </span>
                      </div>
                      <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: st.text }}>
                        {entry.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isNew && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#c4ff4d]/20 text-[#c4ff4d] font-bold uppercase tracking-wider">
                          New
                        </span>
                      )}
                      {entry.research_authorized && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#4d80ff]/20 text-[#4d80ff] font-bold uppercase tracking-wider">
                          Research
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Headline */}
                  <p className="text-[14px] font-semibold text-white leading-snug">
                    {entry.headline}
                  </p>

                  {/* Condition tags */}
                  {entry.conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {entry.conditions.slice(0, 3).map(c => (
                        <span
                          key={c.code}
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${st.text}18`, color: st.text }}
                        >
                          {c.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/6">
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3 h-3 text-white/25" />
                      <span className="text-[11px] text-white/30">{entry.region}</span>
                      {entry.age_bucket && (
                        <>
                          <span className="text-white/15">·</span>
                          <span className="text-[11px] text-white/30">Age {entry.age_bucket}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-[#c4ff4d]" />
                      <span className="text-[10px] text-white/30">
                        {entry.validated_at ? timeAgo(entry.validated_at) : ''}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/6 px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-white/20">
          <Shield className="w-3 h-3" />
          <span>All data clinician-validated · No PHI · HIPAA-compliant · FHIR R4</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-white/20">
          <span>CareOS · launchflow.tech</span>
          <Link to="/clinic/scan" className="hover:text-white/50 transition">Scan QR →</Link>
          <Link to="/web3" className="hover:text-white/50 transition">Research Program →</Link>
        </div>
      </footer>
    </div>
  )
}
