/**
 * Clinic Check-In Scanner
 * Route: /clinic/scan
 *
 * Staff enters or pastes the token from a scanned QR.
 * Shows the FHIR intake package once patient approves.
 * Staff clicks Accept → patient gets $10.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  QrCode, CheckCircle2, Clock, Loader2, ArrowRight, Wallet,
  Shield, User, FlaskConical, Pill, AlertCircle, ChevronDown, ChevronRight,
} from 'lucide-react'

const API = '/api'

type Stage = 'scan' | 'polling' | 'reviewing' | 'accepting' | 'done' | 'error'

const RESOURCE_LABELS: Record<string, string> = {
  name_dob_phone: 'Name / DOB / Phone',
  insurance: 'Insurance card',
  medications: 'Medications',
  allergies: 'Allergies',
  conditions: 'Conditions / diagnoses',
  recent_labs: 'Recent labs',
  research_authorization: 'Research authorization',
  full_chart: 'Full chart history',
}

function ResourceBadge({ id }: { id: string }) {
  const colors: Record<string, string> = {
    research_authorization: 'bg-[#4d80ff]/15 text-[#4d80ff] border-[#4d80ff]/25',
    insurance: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${colors[id] || 'bg-white/8 text-white/70 border-white/12'}`}>
      {RESOURCE_LABELS[id] || id}
    </span>
  )
}

export default function ClinicScanner() {
  const [stage, setStage] = useState<Stage>('scan')
  const [tokenInput, setTokenInput] = useState('')
  const [token, setToken] = useState('')
  const [session, setSession] = useState<any>(null)
  const [pkg, setPkg] = useState<any>(null)
  const [clinicName, setClinicName] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [bundleOpen, setBundleOpen] = useState(false)
  const [polling, setPolling] = useState(false)

  const extractToken = (raw: string) => {
    const match = raw.match(/ck_[A-Za-z0-9_-]+/)
    return match ? match[0] : raw.trim()
  }

  const scanQR = async () => {
    const tok = extractToken(tokenInput)
    if (!tok) { setError('Enter the token or paste the QR URL'); return }
    setToken(tok)
    setError('')
    setStage('polling')
    await pollSession(tok)
  }

  const pollSession = async (tok: string) => {
    setPolling(true)
    try {
      const r = await fetch(`${API}/checkin/session/${tok}`)
      const data = await r.json()
      if (!r.ok) { setError(data.detail || 'Session error'); setStage('error'); return }

      setSession(data)

      if (data.status === 'patient_approved' || data.status === 'accepted' || data.status === 'reward_released') {
        const pr = await fetch(`${API}/checkin/session/${tok}/package`)
        const pkgData = await pr.json()
        setPkg(pkgData)
        setStage('reviewing')
      } else {
        setStage('polling')
        setTimeout(() => pollSession(tok), 3000)
      }
    } catch {
      setError('Network error')
      setStage('error')
    } finally {
      setPolling(false)
    }
  }

  const accept = async () => {
    if (!clinicName.trim()) { setError('Enter clinic name'); return }
    setError('')
    setStage('accepting')
    try {
      const r = await fetch(`${API}/checkin/session/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinic_name: clinicName }),
      })
      const data = await r.json()
      if (!r.ok) { setError(data.detail || 'Accept failed'); setStage('error'); return }
      setResult(data)
      setStage('done')
    } catch {
      setError('Network error')
      setStage('error')
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');`}</style>

      {/* Nav */}
      <header className="border-b border-white/8 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#c4ff4d] flex items-center justify-center">
            <QrCode className="w-4 h-4 text-[#111]" />
          </div>
          <span className="text-[15px] font-bold">CareOS Clinic Check-In</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/clinic/board" className="text-[12px] text-white/40 hover:text-white transition">Waiting Room Board →</Link>
          <Link to="/web3" className="text-[12px] text-white/40 hover:text-white transition">Data Economy →</Link>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-6 py-10">

        {/* ── Scan stage ── */}
        {stage === 'scan' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-[28px] font-bold tracking-tight mb-2">Patient QR Check-In</h1>
              <p className="text-[14px] text-white/50">Scan the patient's QR code or paste the token below.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/4 p-6 space-y-4">
              <div>
                <label className="block text-[12px] text-white/50 uppercase tracking-widest mb-2">QR Token or URL</label>
                <input
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && scanQR()}
                  placeholder="ck_xxxx... or https://launchflow.tech/checkin/ck_xxxx"
                  className="w-full bg-white/8 border border-white/12 rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/25 focus:outline-none focus:border-[#c4ff4d]/50"
                />
              </div>
              {error && <p className="text-[12px] text-red-400">{error}</p>}
              <button
                onClick={scanQR}
                className="w-full py-3.5 rounded-xl bg-[#c4ff4d] text-[#111] text-[15px] font-bold hover:bg-white transition flex items-center justify-center gap-2"
              >
                Load Patient Package <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl border border-white/6 p-4 text-[12px] text-white/35 leading-relaxed">
              <Shield className="w-4 h-4 text-white/25 mb-2" />
              The QR code contains no PHI. Patient data is only shared after
              the patient approves on their phone or watch.
            </div>
          </div>
        )}

        {/* ── Polling stage ── */}
        {stage === 'polling' && (
          <div className="text-center space-y-6 py-10">
            <div className="w-16 h-16 rounded-full border-4 border-[#c4ff4d]/30 border-t-[#c4ff4d] animate-spin mx-auto" />
            <div>
              <p className="text-[18px] font-bold mb-2">Waiting for patient approval</p>
              <p className="text-[13px] text-white/45">
                Ask the patient to open CareOS on their phone or watch to approve sharing.
              </p>
            </div>
            <div className="rounded-xl bg-white/4 border border-white/8 px-5 py-4 text-left">
              <p className="text-[11px] text-white/30 uppercase tracking-widest mb-2">Token</p>
              <p className="font-mono text-[12px] text-white/60 break-all">{token}</p>
            </div>
            <p className="text-[11px] text-white/25 animate-pulse">Checking every 3 seconds…</p>
          </div>
        )}

        {/* ── Reviewing stage ── */}
        {stage === 'reviewing' && pkg && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#c4ff4d]/15 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-[#c4ff4d]" />
              </div>
              <div>
                <p className="text-[18px] font-bold">Patient approved</p>
                <p className="text-[12px] text-white/45">{session?.approved_at ? new Date(session.approved_at).toLocaleTimeString() : ''}</p>
              </div>
            </div>

            {/* Shared resources */}
            <div className="rounded-2xl border border-white/10 bg-white/4 p-5 space-y-3">
              <p className="text-[12px] text-white/50 uppercase tracking-widest font-semibold">Shared resources</p>
              <div className="flex flex-wrap gap-2">
                {(session?.selected_resources || []).map((id: string) => <ResourceBadge key={id} id={id} />)}
              </div>
              {pkg.research_authorized && (
                <div className="flex items-center gap-2 mt-2">
                  <FlaskConical className="w-4 h-4 text-[#4d80ff]" />
                  <span className="text-[12px] text-[#4d80ff] font-semibold">Research participation authorized</span>
                </div>
              )}
            </div>

            {/* Reward notice */}
            <div className="rounded-2xl border border-[#c4ff4d]/20 bg-[#c4ff4d]/8 p-4 flex items-center gap-3">
              <Wallet className="w-5 h-5 text-[#c4ff4d] shrink-0" />
              <div>
                <p className="text-[14px] font-bold text-[#c4ff4d]">${pkg.reward_on_accept_usd} health wallet credit</p>
                <p className="text-[11px] text-white/45">Released to patient automatically when you accept.</p>
              </div>
            </div>

            {/* FHIR bundle preview */}
            <div className="rounded-2xl border border-white/8 bg-white/3">
              <button
                onClick={() => setBundleOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-[13px] font-semibold">FHIR Bundle ({pkg.fhir_bundle?.entry?.length || 0} resources)</span>
                {bundleOpen ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
              </button>
              {bundleOpen && (
                <pre className="px-5 pb-5 text-[10px] text-white/45 overflow-x-auto leading-relaxed max-h-60 overflow-y-auto">
                  {JSON.stringify(pkg.fhir_bundle, null, 2)}
                </pre>
              )}
            </div>

            {/* Clinic name */}
            <div>
              <label className="block text-[12px] text-white/50 uppercase tracking-widest mb-2">Your Clinic Name</label>
              <input
                value={clinicName}
                onChange={e => setClinicName(e.target.value)}
                placeholder="e.g. SLO Family Clinic"
                className="w-full bg-white/8 border border-white/12 rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/25 focus:outline-none focus:border-[#c4ff4d]/50"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[12px] text-red-400">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            <button
              onClick={accept}
              className="w-full py-4 rounded-xl bg-[#c4ff4d] text-[#111] text-[16px] font-bold hover:bg-white transition flex items-center justify-center gap-2"
            >
              Accept Package & Release ${pkg.reward_on_accept_usd} <CheckCircle2 className="w-5 h-5" />
            </button>

            <p className="text-[11px] text-white/25 text-center">
              Accepting confirms data was received. FHIR resources will be written to the EHR.
            </p>
          </div>
        )}

        {/* ── Accepting ── */}
        {stage === 'accepting' && (
          <div className="text-center py-16 space-y-4">
            <Loader2 className="w-10 h-10 text-[#c4ff4d] animate-spin mx-auto" />
            <p className="text-[16px] font-semibold">Accepting and releasing payment…</p>
          </div>
        )}

        {/* ── Done ── */}
        {stage === 'done' && result && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-[#c4ff4d] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-[#111]" />
              </div>
              <h2 className="text-[24px] font-bold">Check-in complete</h2>
              <p className="text-[13px] text-white/50">{result.clinic_name}</p>
            </div>

            <div className="rounded-2xl border border-[#c4ff4d]/20 bg-[#c4ff4d]/8 p-5 text-center">
              <Wallet className="w-6 h-6 text-[#c4ff4d] mx-auto mb-2" />
              <p className="text-[32px] font-bold text-[#c4ff4d]">${result.reward?.amount_usd}</p>
              <p className="text-[13px] text-white/60 mt-1">{result.reward?.message}</p>
              <p className="text-[11px] text-white/35 mt-2">Patient wallet balance: ${result.reward?.wallet_balance_usd}</p>
            </div>

            <div className="rounded-xl border border-white/8 p-4 space-y-2 text-[13px]">
              {[
                { label: 'FHIR written', value: result.fhir_written ? '✓' : '–' },
                { label: 'Research authorized', value: result.research_participation_confirmed ? '✓' : 'No' },
                { label: 'Audit logged', value: '✓' },
                { label: 'Provenance ref', value: result.provenance_ref?.slice(0, 40) + '…' },
              ].map(row => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-white/45">{row.label}</span>
                  <span className="text-white font-mono text-[11px]">{row.value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => { setStage('scan'); setTokenInput(''); setToken(''); setSession(null); setPkg(null); setResult(null); setClinicName('') }}
              className="w-full py-3 rounded-xl border border-white/15 text-[14px] font-semibold hover:bg-white/8 transition"
            >
              Scan next patient
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {stage === 'error' && (
          <div className="text-center py-12 space-y-4">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-[17px] font-semibold">Error</p>
            <p className="text-[13px] text-white/50">{error}</p>
            <button onClick={() => setStage('scan')} className="text-[13px] text-[#c4ff4d] underline">Try again</button>
          </div>
        )}
      </div>
    </div>
  )
}
