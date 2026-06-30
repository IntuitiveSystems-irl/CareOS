/**
 * CareOS Live Global Data Dashboard
 * Route: /live
 *
 * Real-time public-facing scoreboard of the de-identified global health data pool.
 * No PHI. Aggregated condition codes, medication trends, allergy signals, region map.
 * Auto-refreshes every 15s.
 */
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import InquireModal from '../components/InquireModal'
import {
  Activity, Globe, Shield, FlaskConical, Pill, AlertTriangle,
  TrendingUp, Users, Zap, ArrowRight, RefreshCw, MapPin,
  CheckCircle2, Clock, ArrowUpRight,
} from 'lucide-react'

const API = '/api'
const REFRESH_MS = 15_000

// ── Colour helpers ────────────────────────────────────────────────────────────

const RANK_COLORS = ['#c4ff4d', '#4d80ff', '#ff6b5b', '#ffd23f', '#9ee3db',
                      '#c084fc', '#fb923c', '#34d399', '#f472b6', '#60a5fa']

function rankColor(i: number) { return RANK_COLORS[i % RANK_COLORS.length] }

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = '#c4ff4d' }:
  { icon: any; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 p-5">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}22` }}>
        <Icon className="w-4.5 h-4.5" style={{ color }} />
      </div>
      <div className="text-[28px] font-bold tracking-tight" style={{ color }}>{value}</div>
      <div className="text-[13px] text-white/70 mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-white/35 mt-1">{sub}</div>}
    </div>
  )
}

function RankList({ title, icon: Icon, color, items, keyLabel, valueLabel }:
  { title: string; icon: any; color: string; items: any[]; keyLabel: string; valueLabel: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}22` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <h3 className="text-[14px] font-bold">{title}</h3>
      </div>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[11px] font-bold w-5 text-right" style={{ color: rankColor(i) }}>
              #{i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-white truncate">{item[keyLabel]}</div>
              <div className="h-1.5 mt-1 rounded-full bg-white/8 overflow-hidden">
                <div className="h-full rounded-full" style={{
                  width: `${Math.max(8, (item.count / (items[0]?.count || 1)) * 100)}%`,
                  background: rankColor(i),
                }} />
              </div>
            </div>
            <span className="text-[12px] font-bold" style={{ color: rankColor(i) }}>{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LiveFeedRow({ item }: { item: any }) {
  const age = Math.floor((Date.now() - new Date(item.contributed_at).getTime()) / 60000)
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <span className="w-2 h-2 rounded-full bg-[#c4ff4d] shrink-0 animate-pulse" />
      <div className="flex-1 min-w-0">
        <span className="text-[12px] text-white/80">{item.clinic_name}</span>
        <span className="text-[11px] text-white/35 ml-2">{item.region}</span>
      </div>
      <div className="flex gap-1 flex-wrap justify-end">
        {item.research_authorized && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#4d80ff]/20 text-[#4d80ff] font-bold">Research</span>
        )}
        <span className="text-[9px] text-white/25">{age < 1 ? 'just now' : `${age}m ago`}</span>
      </div>
    </div>
  )
}

function TrendBar({ series }: { series: { week: string; contributions: number }[] }) {
  const max = Math.max(...series.map(s => s.contributions), 1)
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-[#c4ff4d]" />
        <h3 className="text-[14px] font-bold">Contribution trend</h3>
        <span className="ml-auto text-[11px] text-white/30">weekly</span>
      </div>
      <div className="flex items-end gap-1 h-20">
        {series.map((s, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-sm"
              style={{
                height: `${Math.max(4, (s.contributions / max) * 72)}px`,
                background: i === series.length - 1 ? '#c4ff4d' : 'rgba(255,255,255,0.12)',
              }}
            />
            {i % 4 === 0 && (
              <span className="text-[8px] text-white/20 rotate-45 origin-left">{s.week.slice(5)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LiveDashboard() {
  const [inquireOpen, setInquireOpen] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [conditions, setConditions] = useState<any[]>([])
  const [medications, setMedications] = useState<any[]>([])
  const [allergies, setAllergies] = useState<any[]>([])
  const [regions, setRegions] = useState<any[]>([])
  const [live, setLive] = useState<any[]>([])
  const [trends, setTrends] = useState<any[]>([])
  const [research, setResearch] = useState<any>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [sumR, condR, medR, algR, regR, liveR, trendR, resR] = await Promise.all([
        fetch(`${API}/pool/summary`).then(r => r.json()),
        fetch(`${API}/pool/conditions?limit=8`).then(r => r.json()),
        fetch(`${API}/pool/medications?limit=6`).then(r => r.json()),
        fetch(`${API}/pool/allergies?limit=6`).then(r => r.json()),
        fetch(`${API}/pool/regions`).then(r => r.json()),
        fetch(`${API}/pool/live?limit=15`).then(r => r.json()),
        fetch(`${API}/pool/trends?weeks=12`).then(r => r.json()),
        fetch(`${API}/pool/research`).then(r => r.json()),
      ])
      setSummary(sumR)
      setConditions(condR.conditions || [])
      setMedications(medR.medications || [])
      setAllergies(algR.allergies || [])
      setRegions((regR.regions || []).slice(0, 8))
      setLive(liveR.live_feed || [])
      setTrends(trendR.series || [])
      setResearch(resR)
      setLastRefresh(new Date())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  return (
    <div className="antialiased bg-[#0a0a0a] text-white min-h-screen selection:bg-[#c4ff4d] selection:text-[#111]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { font-family: 'Space Grotesk', system-ui, sans-serif; }`}</style>

      {inquireOpen && <InquireModal onClose={() => setInquireOpen(false)} />}
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-[#111] border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 sm:px-10 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#c4ff4d] flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#111]" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold text-white">CareOS</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-semibold">by LaunchFlow</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-white/70">
            <Link to="/" className="hover:text-white transition">How it works</Link>
            <Link to="/fhir-standards" className="hover:text-white transition">FHIR</Link>
            <Link to="/research" className="hover:text-white transition">Research</Link>
            <Link to="/live" className="text-[#c4ff4d] font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c4ff4d] animate-pulse"/>Live
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-white/30">
              <RefreshCw className="w-3 h-3" />
              <span>{lastRefresh.toLocaleTimeString()}</span>
            </div>
            <button onClick={() => setInquireOpen(true)} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-semibold text-[#111] bg-[#c4ff4d] hover:bg-[#d4ff6d] transition">
              Inquire now <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-white/6 bg-[#060606]">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c4ff4d]/10 border border-[#c4ff4d]/20 text-[#c4ff4d] text-[10px] uppercase tracking-[0.16em] font-bold mb-3">
                <Globe className="w-3 h-3" /> Worldwide · De-identified · Public
              </div>
              <h1 className="text-[36px] sm:text-[48px] font-bold tracking-[-0.02em] leading-tight">
                Global Health Data Pool
              </h1>
              <p className="text-[14px] text-white/45 mt-2 max-w-xl">
                Real-time aggregate of de-identified patient contributions. No PHI.
                Patients earn research participation credits. Clinicians get live CDS signals.
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/clinic/scan" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#c4ff4d] text-[#111] text-[13px] font-bold hover:bg-white transition">
                Clinic Scanner <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link to="/web3" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-white/15 text-[13px] text-white font-semibold hover:bg-white/8 transition">
                Data Economy <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Summary stats */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={Users} label="Total contributions" value={summary.total_contributions} color="#c4ff4d" />
            <StatCard icon={FlaskConical} label="Research authorized" value={summary.research_authorized} color="#4d80ff" />
            <StatCard icon={TrendingUp} label="Research rate" value={`${summary.research_rate_pct}%`} color="#9ee3db" />
            <StatCard icon={Globe} label="Regions" value={summary.unique_regions} color="#ffd23f" />
            <StatCard icon={MapPin} label="Clinics" value={summary.unique_clinics} color="#ff6b5b" />
            <StatCard icon={Zap} label="Today" value={summary.contributed_today} color="#c4ff4d" />
          </div>
        )}

        {/* Trend + live feed */}
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            {trends.length > 0 && <TrendBar series={trends} />}
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/4 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#c4ff4d] animate-pulse" />
              <h3 className="text-[14px] font-bold">Live feed</h3>
              <span className="ml-auto text-[10px] text-white/25">no PHI</span>
            </div>
            <div className="overflow-y-auto max-h-48">
              {live.map(item => <LiveFeedRow key={item.id} item={item} />)}
              {live.length === 0 && <p className="text-[12px] text-white/30">No contributions yet</p>}
            </div>
          </div>
        </div>

        {/* Scoreboard grids */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <RankList title="Trending Conditions" icon={Activity} color="#c4ff4d"
            items={conditions} keyLabel="label" valueLabel="count" />
          <RankList title="Top Medications" icon={Pill} color="#4d80ff"
            items={medications} keyLabel="label" valueLabel="count" />
          <RankList title="Allergy Signals" icon={AlertTriangle} color="#ff6b5b"
            items={allergies} keyLabel="label" valueLabel="count" />
        </div>

        {/* Regions */}
        <div className="rounded-2xl border border-white/8 bg-white/4 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-[#ffd23f]" />
            <h3 className="text-[14px] font-bold">Regions scoreboard</h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {regions.map((r, i) => (
              <div key={r.region} className="flex items-center gap-3 rounded-xl bg-white/4 border border-white/6 px-4 py-3">
                <span className="text-[13px] font-bold w-6 text-right" style={{ color: rankColor(i) }}>#{r.rank}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-white truncate">{r.region}</div>
                  <div className="text-[11px] text-white/35">{r.contributions} contributions</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CDS Signals */}
        <div className="rounded-2xl border border-[#4d80ff]/20 bg-[#4d80ff]/6 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Zap className="w-5 h-5 text-[#4d80ff]" />
            <h3 className="text-[16px] font-bold">CDS Signals</h3>
            <span className="ml-auto text-[11px] text-white/30 font-mono">available at /cds-research</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { signal: 'Patient eligible for study', hook: 'patient-view', color: '#c4ff4d' },
              { signal: 'Missing insurance info', hook: 'appointment-booked', color: '#ffd23f' },
              { signal: 'Medication list needs verification', hook: 'order-select', color: '#4d80ff' },
              { signal: 'Abnormal patient-reported outcome', hook: 'patient-view', color: '#ff6b5b' },
              { signal: 'Follow-up recommended', hook: 'patient-view', color: '#9ee3db' },
              { signal: 'Consent expired', hook: 'patient-view', color: '#c084fc' },
            ].map(s => (
              <div key={s.signal} className="rounded-xl border border-white/8 bg-white/4 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: s.color }} />
                  <span className="text-[13px] font-semibold text-white">{s.signal}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/40 font-mono">{s.hook}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/30">
            <span>Discovery:</span>
            <code className="px-2 py-0.5 rounded bg-white/8 text-white/50">GET /cds-services</code>
            <span>·</span>
            <span>FHIR CDS Hooks 2.0 spec</span>
            <span>·</span>
            <span>Integrates with Epic, Cerner, athenahealth via SMART on FHIR</span>
          </div>
        </div>

        {/* Research framing */}
        {research && (
          <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FlaskConical className="w-5 h-5 text-[#4d80ff]" />
              <h3 className="text-[16px] font-bold">Research Participation Framework</h3>
            </div>
            <div className="grid sm:grid-cols-3 gap-5 mb-5">
              <div>
                <div className="text-[28px] font-bold text-[#c4ff4d]">{research.research_authorized_total}</div>
                <div className="text-[12px] text-white/45">Authorized research contributions</div>
              </div>
              <div>
                <div className="text-[28px] font-bold text-[#4d80ff]">{research.authorization_rate_pct}%</div>
                <div className="text-[12px] text-white/45">Authorization rate</div>
              </div>
              <div>
                <div className="text-[28px] font-bold text-[#9ee3db]">${(research.research_authorized_total * 10).toLocaleString()}</div>
                <div className="text-[12px] text-white/45">Total research stipends earned</div>
              </div>
            </div>
            <div className="rounded-xl bg-[#4d80ff]/8 border border-[#4d80ff]/15 p-4 text-[13px] text-white/60 leading-relaxed">
              <strong className="text-white">Grant framing: </strong>
              {research.framing}
            </div>
            <p className="text-[11px] text-white/30 mt-3">{research.irb_note}</p>
          </div>
        )}

        {/* Compliance notice */}
        <div className="rounded-xl border border-white/6 p-4 flex gap-3">
          <Shield className="w-5 h-5 text-white/25 shrink-0 mt-0.5" />
          <p className="text-[12px] text-white/35 leading-relaxed">
            All data displayed here is de-identified aggregate. No PHI is stored in the pool.
            Patient contributions require explicit HIPAA-compliant consent. Research compensation
            is subject to IRB review per 45 CFR 46. Data use is permissioned and audited per FHIR Provenance + AuditEvent.
            CareOS does not sell PHI. Patients may revoke authorization at any time.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/8 mt-8">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-[12px] text-white/30">
            CareOS · Business Intuitive Inc. · Seattle, WA · launchflow.tech
          </div>
          <div className="flex gap-3 text-[12px]">
            <Link to="/web3" className="text-white/35 hover:text-white transition">Data Economy</Link>
            <Link to="/clinic/scan" className="text-white/35 hover:text-white transition">Clinic Scanner</Link>
            <Link to="/fhir-standards" className="text-white/35 hover:text-white transition">FHIR Standards</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
