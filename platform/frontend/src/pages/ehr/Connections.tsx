import { useEffect, useState } from 'react'
import { api } from '../../api'
import {
  Wifi, WifiOff, RefreshCw, ChevronDown, ChevronUp,
  Server, Shield, Clock, Zap, Database, ExternalLink,
  CheckCircle2, AlertTriangle, XCircle, Loader2,
  Plus, Link2, Unplug, KeyRound, Trash2, X, Building2,
} from 'lucide-react'

interface ConnStatus {
  org_id: number
  connected: boolean
  status: string
  scope?: string | null
  patient_context?: string | null
  expires_at?: string | null
  has_refresh_token?: boolean
}

const VENDOR_OPTIONS = [
  { value: 'epic', label: 'Epic' },
  { value: 'cerner', label: 'Cerner / Oracle Health' },
  { value: 'meditech', label: 'MEDITECH' },
  { value: 'other', label: 'Other / Generic FHIR R4' },
]

const EMPTY_FORM = {
  name: '',
  ehr_vendor: 'other',
  fhir_base_url: '',
  client_id: '',
  client_secret: '',
  redirect_uri: '',
  smart_discovery_mode: 'smart_config',
  fhir_profile: 'r4',
}

interface ConnResult {
  org_id: number
  org_name: string
  ehr_vendor: string
  fhir_base_url: string
  smart_discovery: {
    status: string
    latency_ms?: number
    authorization_endpoint?: string | null
    token_endpoint?: string | null
    scopes_supported_count?: number
    capabilities_count?: number
    error?: string
  }
  metadata: {
    status: string
    latency_ms?: number
    resourceType?: string
    fhirVersion?: string
    software?: string
    error?: string
  }
  overall: string
}

interface TestResponse {
  total_orgs: number
  connected: number
  failed: number
  results: ConnResult[]
}

const VENDOR_META: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  epic: {
    label: 'Epic',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: '🏥',
  },
  cerner: {
    label: 'Cerner / Oracle Health',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
    icon: '🔬',
  },
  meditech: {
    label: 'MEDITECH',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    icon: '💊',
  },
  other: {
    label: 'Generic FHIR R4',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: '🔌',
  },
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'connected') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 className="w-3 h-3" /> Connected
    </span>
  )
  if (status === 'partial') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <AlertTriangle className="w-3 h-3" /> Partial
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
      <XCircle className="w-3 h-3" /> Failed
    </span>
  )
}

function LatencyPill({ ms }: { ms?: number }) {
  if (!ms) return null
  const color = ms < 500 ? 'text-emerald-400' : ms < 1500 ? 'text-amber-400' : 'text-red-400'
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono ${color}`}>
      <Clock className="w-3 h-3" /> {ms}ms
    </span>
  )
}

export default function Connections() {
  const [data, setData] = useState<TestResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [adapterInfo, setAdapterInfo] = useState<Record<number, any>>({})
  const [resourceTest, setResourceTest] = useState<Record<string, any>>({})
  const [resourceLoading, setResourceLoading] = useState<Record<string, boolean>>({})
  const [statuses, setStatuses] = useState<Record<number, ConnStatus>>({})
  const [connecting, setConnecting] = useState<number | null>(null)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const runTest = async () => {
    setTesting(true)
    try {
      const res = await api.getEhrConnectivityTest()
      setData(res)
    } catch (e) {
      console.error('Connectivity test failed:', e)
    }
    setTesting(false)
    setLoading(false)
  }

  const loadStatuses = async () => {
    try {
      const res = await api.ehrConnectAllStatus()
      const map: Record<number, ConnStatus> = {}
      for (const s of res.connections || []) map[s.org_id] = s
      setStatuses(map)
    } catch (e) {
      console.error('Failed to load connection statuses:', e)
    }
  }

  useEffect(() => {
    runTest()
    loadStatuses()
    // Surface the OAuth callback result (?connected= / ?connect_error=).
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected')) {
      setBanner({ kind: 'ok', text: 'EHR connected successfully — access token stored.' })
      loadStatuses()
    } else if (params.get('connect_error')) {
      setBanner({ kind: 'err', text: `Connection failed: ${params.get('connect_error')}` })
    }
    if (params.get('connected') || params.get('connect_error')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const connect = async (orgId: number) => {
    setConnecting(orgId)
    setBanner(null)
    try {
      const redirectBack = `${window.location.origin}/ehr/connections`
      const res = await api.ehrConnectAuthorizeUrl(orgId, redirectBack)
      window.location.href = res.authorize_url
    } catch (e: any) {
      setBanner({ kind: 'err', text: e.message || 'Could not start the SMART connect flow.' })
      setConnecting(null)
    }
  }

  const refreshToken = async (orgId: number) => {
    try {
      await api.ehrConnectRefresh(orgId)
      setBanner({ kind: 'ok', text: 'Access token refreshed.' })
      loadStatuses()
    } catch (e: any) {
      setBanner({ kind: 'err', text: e.message || 'Refresh failed.' })
    }
  }

  const disconnect = async (orgId: number) => {
    try {
      await api.ehrConnectDisconnect(orgId)
      setBanner({ kind: 'ok', text: 'Disconnected — token revoked.' })
      loadStatuses()
    } catch (e: any) {
      setBanner({ kind: 'err', text: e.message || 'Disconnect failed.' })
    }
  }

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim() || !form.fhir_base_url.trim()) {
      setFormError('Connection name and FHIR base URL are required.')
      return
    }
    setSaving(true)
    try {
      await api.createOrganization(form)
      setForm({ ...EMPTY_FORM })
      setShowForm(false)
      setBanner({ kind: 'ok', text: 'Connection registered. Run discovery, then connect.' })
      await runTest()
      await loadStatuses()
    } catch (err: any) {
      setFormError(err.message || 'Failed to create connection.')
    }
    setSaving(false)
  }

  const removeConnection = async (orgId: number, name: string) => {
    if (!window.confirm(`Remove the connection "${name}"? This cannot be undone.`)) return
    try {
      await api.deleteOrganization(orgId)
      setBanner({ kind: 'ok', text: 'Connection removed.' })
      await runTest()
      await loadStatuses()
    } catch (e: any) {
      setBanner({ kind: 'err', text: e.message || 'Delete failed.' })
    }
  }

  const toggleExpand = async (orgId: number) => {
    const next = { ...expanded, [orgId]: !expanded[orgId] }
    setExpanded(next)
    if (next[orgId] && !adapterInfo[orgId]) {
      try {
        const info = await api.getEhrAdapterInfo(orgId)
        setAdapterInfo((prev) => ({ ...prev, [orgId]: info }))
      } catch (e) {
        console.error('Failed to load adapter info:', e)
      }
    }
  }

  const testResource = async (orgId: number, resourceType: string) => {
    const key = `${orgId}-${resourceType}`
    setResourceLoading((prev) => ({ ...prev, [key]: true }))
    try {
      const res = await api.fetchResourceViaAdapter(orgId, resourceType)
      setResourceTest((prev) => ({ ...prev, [key]: res }))
    } catch (e: any) {
      setResourceTest((prev) => ({ ...prev, [key]: { _error: true, error: e.message } }))
    }
    setResourceLoading((prev) => ({ ...prev, [key]: false }))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 text-navy-400 animate-spin" />
    </div>
  )

  return (
    <div className="max-w-5xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-white mb-1">EHR Connections</h1>
          <p className="text-[15px] text-white/40 font-light">Register any EHR, connect via SMART on FHIR, and pull live data</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/15 border border-emerald-500/25 rounded-xl text-[13px] font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-all"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'Add Connection'}
          </button>
          <button
            onClick={() => { runTest(); loadStatuses() }}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-[13px] font-semibold text-white/80 hover:bg-white/[0.10] hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testing...' : 'Re-test All'}
          </button>
        </div>
      </div>

      {/* Result banner */}
      {banner && (
        <div className={`mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-[13px] ${
          banner.kind === 'ok'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : 'bg-red-500/10 border-red-500/20 text-red-300'
        }`}>
          <span className="flex items-center gap-2">
            {banner.kind === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {banner.text}
          </span>
          <button onClick={() => setBanner(null)} className="opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Add Connection form */}
      {showForm && (
        <form onSubmit={submitForm} className="mb-8 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-[14px] font-semibold text-white">Register a new EHR connection</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Connection name *</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Springfield Health"
                className="mt-1.5 w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white placeholder-white/20 focus:border-emerald-500/40 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">EHR vendor</span>
              <select
                value={form.ehr_vendor}
                onChange={(e) => setForm({ ...form, ehr_vendor: e.target.value })}
                className="mt-1.5 w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white focus:border-emerald-500/40 outline-none"
              >
                {VENDOR_OPTIONS.map((v) => <option key={v.value} value={v.value} className="bg-navy-900">{v.label}</option>)}
              </select>
            </label>
            <label className="block col-span-2">
              <span className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">FHIR base URL *</span>
              <input
                value={form.fhir_base_url}
                onChange={(e) => setForm({ ...form, fhir_base_url: e.target.value })}
                placeholder="https://fhir.example.org/r4"
                className="mt-1.5 w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white placeholder-white/20 font-mono focus:border-emerald-500/40 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Client ID</span>
              <input
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                placeholder="SMART app client_id"
                className="mt-1.5 w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white placeholder-white/20 font-mono focus:border-emerald-500/40 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Client secret (confidential apps)</span>
              <input
                type="password"
                value={form.client_secret}
                onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
                placeholder="leave blank for public + PKCE"
                className="mt-1.5 w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white placeholder-white/20 font-mono focus:border-emerald-500/40 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">SMART discovery</span>
              <select
                value={form.smart_discovery_mode}
                onChange={(e) => setForm({ ...form, smart_discovery_mode: e.target.value })}
                className="mt-1.5 w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white focus:border-emerald-500/40 outline-none"
              >
                <option value="smart_config" className="bg-navy-900">.well-known/smart-configuration</option>
                <option value="capability_statement" className="bg-navy-900">CapabilityStatement (/metadata)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">FHIR profile</span>
              <select
                value={form.fhir_profile}
                onChange={(e) => setForm({ ...form, fhir_profile: e.target.value })}
                className="mt-1.5 w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white focus:border-emerald-500/40 outline-none"
              >
                <option value="r4" className="bg-navy-900">R4 (US Core)</option>
                <option value="us_core_stu7" className="bg-navy-900">US Core STU7</option>
                <option value="dstu2" className="bg-navy-900">DSTU2 (Argonaut)</option>
              </select>
            </label>
          </div>
          {formError && <p className="mt-3 text-[12px] text-red-400">{formError}</p>}
          <div className="flex items-center gap-3 mt-5">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-navy-950 rounded-xl text-[13px] font-bold hover:bg-emerald-400 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Register connection'}
            </button>
            <span className="text-[11px] text-white/30">After registering, expand the card and click <span className="text-emerald-400">Connect</span> to run the SMART OAuth flow.</span>
          </div>
        </form>
      )}

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-navy-500/30 flex items-center justify-center">
                <Server className="w-4 h-4 text-navy-300" />
              </div>
              <div>
                <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">Total Vendors</p>
                <p className="text-[24px] font-bold text-white">{data.total_orgs}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Wifi className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">Connected</p>
                <p className="text-[24px] font-bold text-emerald-400">{data.connected}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center">
                <WifiOff className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">Failed</p>
                <p className="text-[24px] font-bold text-red-400">{data.failed}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vendor cards */}
      <div className="space-y-4">
        {data?.results.map((r) => {
          const vendor = VENDOR_META[r.ehr_vendor] || { label: r.ehr_vendor, color: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10', icon: '🏢' }
          const isExpanded = expanded[r.org_id]
          const info = adapterInfo[r.org_id]
          const conn = statuses[r.org_id]

          return (
            <div key={r.org_id} className={`rounded-2xl border bg-white/[0.02] overflow-hidden transition-all ${
              r.overall === 'connected' ? 'border-white/[0.08]' : 'border-red-500/20'
            }`}>
              {/* Card Header */}
              <button
                onClick={() => toggleExpand(r.org_id)}
                className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/[0.02] transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl ${vendor.bg} border ${vendor.border} flex items-center justify-center text-lg`}>
                    {vendor.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 mb-0.5">
                      <h3 className="text-[15px] font-semibold text-white">{r.org_name}</h3>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${vendor.color}`}>{vendor.label}</span>
                    </div>
                    <p className="text-[12px] text-white/30 font-mono truncate max-w-[400px]">{r.fhir_base_url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {conn?.connected ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Link2 className="w-3 h-3" /> Authorized
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/[0.04] text-white/40 border border-white/[0.08]">
                      <Unplug className="w-3 h-3" /> Not connected
                    </span>
                  )}
                  <StatusBadge status={r.overall} />
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-white/[0.06] px-6 py-5 space-y-5">
                  {/* Connection (OAuth) action bar */}
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-emerald-400" />
                        <div>
                          <h4 className="text-[12px] font-semibold text-white/70 uppercase tracking-wider">SMART Connection</h4>
                          <p className="text-[11px] text-white/40 mt-0.5">
                            {conn?.connected
                              ? `Authorized${conn.patient_context ? ` · patient ${conn.patient_context}` : ''}${conn.expires_at ? ` · expires ${new Date(conn.expires_at).toLocaleString()}` : ''}`
                              : 'Authorize via SMART OAuth (PKCE) to pull live data with a stored token.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!conn?.connected && (
                          <button
                            onClick={() => connect(r.org_id)}
                            disabled={connecting === r.org_id}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 text-navy-950 rounded-lg text-[12px] font-bold hover:bg-emerald-400 transition-all disabled:opacity-50"
                          >
                            {connecting === r.org_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                            Connect
                          </button>
                        )}
                        {conn?.connected && conn?.has_refresh_token && (
                          <button
                            onClick={() => refreshToken(r.org_id)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] border border-white/[0.08] rounded-lg text-[12px] font-semibold text-white/70 hover:text-white transition-all"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Refresh
                          </button>
                        )}
                        {conn?.connected && (
                          <button
                            onClick={() => disconnect(r.org_id)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[12px] font-semibold text-red-400 hover:bg-red-500/20 transition-all"
                          >
                            <Unplug className="w-3.5 h-3.5" /> Disconnect
                          </button>
                        )}
                        <button
                          onClick={() => removeConnection(r.org_id, r.org_name)}
                          title="Remove connection"
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[12px] font-semibold text-white/40 hover:text-red-400 hover:border-red-500/30 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* SMART Discovery + Metadata Row */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* SMART Discovery */}
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-navy-400" />
                          <h4 className="text-[12px] font-semibold text-white/70 uppercase tracking-wider">SMART Discovery</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <LatencyPill ms={r.smart_discovery.latency_ms} />
                          <StatusBadge status={r.smart_discovery.status} />
                        </div>
                      </div>
                      <div className="space-y-2 text-[12px]">
                        {r.smart_discovery.authorization_endpoint && (
                          <div>
                            <span className="text-white/30">Auth: </span>
                            <span className="text-white/60 font-mono text-[11px] break-all">{r.smart_discovery.authorization_endpoint}</span>
                          </div>
                        )}
                        {r.smart_discovery.token_endpoint && (
                          <div>
                            <span className="text-white/30">Token: </span>
                            <span className="text-white/60 font-mono text-[11px] break-all">{r.smart_discovery.token_endpoint}</span>
                          </div>
                        )}
                        {r.smart_discovery.scopes_supported_count != null && (
                          <div>
                            <span className="text-white/30">Scopes: </span>
                            <span className="text-white/60">{r.smart_discovery.scopes_supported_count} supported</span>
                          </div>
                        )}
                        {r.smart_discovery.capabilities_count != null && r.smart_discovery.capabilities_count > 0 && (
                          <div>
                            <span className="text-white/30">Capabilities: </span>
                            <span className="text-white/60">{r.smart_discovery.capabilities_count}</span>
                          </div>
                        )}
                        {r.smart_discovery.error && (
                          <div className="text-red-400/80 text-[11px] mt-1">{r.smart_discovery.error}</div>
                        )}
                      </div>
                    </div>

                    {/* Metadata / CapabilityStatement */}
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-navy-400" />
                          <h4 className="text-[12px] font-semibold text-white/70 uppercase tracking-wider">FHIR Metadata</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <LatencyPill ms={r.metadata.latency_ms} />
                          <StatusBadge status={r.metadata.status} />
                        </div>
                      </div>
                      <div className="space-y-2 text-[12px]">
                        {r.metadata.resourceType && (
                          <div>
                            <span className="text-white/30">Type: </span>
                            <span className="text-white/60">{r.metadata.resourceType}</span>
                          </div>
                        )}
                        {r.metadata.fhirVersion && (
                          <div>
                            <span className="text-white/30">FHIR Version: </span>
                            <span className="text-emerald-400 font-semibold">{r.metadata.fhirVersion}</span>
                          </div>
                        )}
                        {r.metadata.software && (
                          <div>
                            <span className="text-white/30">Software: </span>
                            <span className="text-white/60">{r.metadata.software}</span>
                          </div>
                        )}
                        {r.metadata.error && (
                          <div className="text-red-400/80 text-[11px] mt-1">{r.metadata.error}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Supported Resources + Live Test */}
                  {info && (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-4 h-4 text-navy-400" />
                        <h4 className="text-[12px] font-semibold text-white/70 uppercase tracking-wider">
                          Supported Resources ({info.supported_resources?.length || 0})
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {(info.supported_resources || []).slice(0, 20).map((res: string) => {
                          const key = `${r.org_id}-${res}`
                          const result = resourceTest[key]
                          const isLoading = resourceLoading[key]
                          const hasResult = !!result
                          const isError = result?._error

                          return (
                            <button
                              key={res}
                              onClick={() => testResource(r.org_id, res)}
                              disabled={isLoading}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                                hasResult
                                  ? isError
                                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                  : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.08]'
                              }`}
                            >
                              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                              {res}
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-[10px] text-white/20">Click a resource to fetch it live from the vendor's FHIR endpoint</p>
                    </div>
                  )}

                  {/* Resource Test Results */}
                  {Object.entries(resourceTest).filter(([k]) => k.startsWith(`${r.org_id}-`)).map(([key, result]) => (
                    <div key={key} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                          {key.split('-').slice(1).join('-')} Response
                        </span>
                        {result?._live && !result?._error && (
                          <span className="text-[10px] text-emerald-400 font-semibold">LIVE</span>
                        )}
                        {result?._error && (
                          <span className="text-[10px] text-red-400 font-semibold">ERROR</span>
                        )}
                      </div>
                      <pre className="text-[11px] text-white/50 font-mono bg-black/30 rounded-lg p-3 overflow-auto max-h-[200px] whitespace-pre-wrap">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </div>
                  ))}

                  {/* FHIR Base URL */}
                  <div className="flex items-center gap-2 text-[11px] text-white/20">
                    <ExternalLink className="w-3 h-3" />
                    <span className="font-mono">{r.fhir_base_url}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Epic CDS Hooks setup */}
      <div className="mt-8 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: 'rgba(196,255,77,0.1)' }}>🪝</div>
          <div>
            <h3 className="text-[15px] font-semibold text-white">Register CareOS as a CDS Hooks Provider</h3>
            <p className="text-[12px] text-white/40 mt-0.5">Point your EHR at CareOS to receive relational decision support cards during clinical workflows</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Endpoint info */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">CDS Hooks Endpoints</p>
            {[
              { method: 'GET', path: '/cds-services', desc: 'Discovery — EHR fetches available services' },
              { method: 'POST', path: '/cds-services/careos-patient-summary', desc: 'patient-view hook — fires when chart opens' },
              { method: 'POST', path: '/cds-services/careos-medication-safety', desc: 'order-select / order-sign hooks' },
            ].map((e) => (
              <div key={e.path} className="bg-black/30 border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(196,255,77,0.12)', color: '#c4ff4d' }}>{e.method}</span>
                  <code className="text-[12px] text-white/80 font-mono">https://launchflow.tech{e.path}</code>
                </div>
                <p className="text-[11px] text-white/35">{e.desc}</p>
              </div>
            ))}
          </div>

          {/* Epic setup steps */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Epic Configuration Steps</p>
            {[
              { n: '1', title: 'Open App Orchard / Interconnect Admin', body: 'In your Epic environment, go to Interconnect → CDS Hooks Configuration (or App Orchard if using App Market).' },
              { n: '2', title: 'Add a new CDS Hooks service entry', body: 'Set the Service URL to https://launchflow.tech/cds-services and give it a display name (e.g. "CareOS Decision Support").' },
              { n: '3', title: 'Map hooks to clinical contexts', body: 'Bind careos-patient-summary to patient-view (chart open) and careos-medication-safety to order-select and order-sign.' },
              { n: '4', title: 'Configure prefetch & SMART token', body: 'Epic will send a SMART launch token in the Authorization header. Enable prefetch for Patient/{id} so CareOS receives the FHIR context.' },
              { n: '5', title: 'Test via the CDS tab', body: 'Navigate to /ehr/cds in this portal, select a patient, and run patient-view to verify cards return correctly.' },
            ].map((s) => (
              <div key={s.n} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5" style={{ backgroundColor: 'rgba(196,255,77,0.15)', color: '#c4ff4d' }}>{s.n}</div>
                <div>
                  <p className="text-[12px] font-semibold text-white">{s.title}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-3 flex-wrap">
          <span className="text-[11px] text-white/30">Cerner (Oracle Health):</span>
          <span className="text-[11px] text-white/50">Use CDS Hooks Subscriber in the Millennium CDS Hooks Manager — same endpoint URL, same hook IDs.</span>
          <span className="mx-2 text-white/15">·</span>
          <span className="text-[11px] text-white/30">Generic FHIR R4:</span>
          <span className="text-[11px] text-white/50">Any EHR that implements the CDS Hooks 1.0 spec can call these endpoints.</span>
        </div>
      </div>
    </div>
  )
}
