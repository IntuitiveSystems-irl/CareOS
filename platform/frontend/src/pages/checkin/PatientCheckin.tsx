/**
 * Patient Check-In Approval Page
 * Route: /checkin/:token
 *
 * Loaded when patient opens the check-in URL (from their QR code).
 * Optimised for mobile / Apple Watch.
 * Shows what the clinic is requesting, lets patient choose what to share.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CheckCircle2, Circle, ShieldCheck, Wallet, AlertTriangle,
  Loader2, FlaskConical, ChevronRight,
} from 'lucide-react'

const API = '/api'

const RESOURCE_OPTIONS = [
  { id: 'name_dob_phone',         label: 'Name / DOB / Phone',         required: true },
  { id: 'insurance',              label: 'Insurance card',             required: false },
  { id: 'medications',            label: 'Medications',               required: false },
  { id: 'allergies',              label: 'Allergies',                 required: false },
  { id: 'conditions',             label: 'Conditions / diagnoses',    required: false },
  { id: 'recent_labs',            label: 'Recent labs',               required: false },
  { id: 'research_authorization', label: 'Research authorization',    required: false, research: true },
  { id: 'full_chart',             label: 'Full chart history',        required: false },
]

type Stage = 'loading' | 'choose' | 'submitting' | 'approved' | 'error' | 'expired'

export default function PatientCheckin() {
  const { token } = useParams<{ token: string }>()
  const [stage, setStage] = useState<Stage>('loading')
  const [session, setSession] = useState<any>(null)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(['name_dob_phone', 'insurance', 'medications', 'allergies',
             'conditions', 'recent_labs', 'research_authorization'])
  )
  const [researchAuth, setResearchAuth] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { setStage('error'); return }
    fetch(`${API}/checkin/session/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.detail?.includes('expired')) { setStage('expired'); return }
        if (data.status === 'reward_released' || data.status === 'accepted') {
          setStage('approved'); setSession(data); return
        }
        setSession(data)
        setStage('choose')
      })
      .catch(() => setStage('error'))
  }, [token])

  const toggle = (id: string) => {
    const opt = RESOURCE_OPTIONS.find(o => o.id === id)
    if (opt?.required) return
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    if (id === 'research_authorization') setResearchAuth(prev => !prev)
  }

  const approve = async () => {
    setStage('submitting')
    try {
      const r = await fetch(`${API}/checkin/session/${token}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_resources: Array.from(selected),
          research_authorized: researchAuth,
        }),
      })
      const data = await r.json()
      if (!r.ok) { setError(data.detail || 'Failed'); setStage('error'); return }
      setSession(data)
      setStage('approved')
    } catch {
      setError('Network error')
      setStage('error')
    }
  }

  /* ── Layout shell ── */
  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div className="px-5 pt-10 pb-6 text-center">
        <div className="w-14 h-14 rounded-3xl bg-[#c4ff4d] flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-7 h-7 text-[#111]" />
        </div>
        <h1 className="text-[22px] font-bold tracking-tight">CareOS Check-In</h1>
        <p className="text-[13px] text-white/50 mt-1">Secure health data sharing</p>
      </div>

      {/* Loading */}
      {stage === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
        </div>
      )}

      {/* Expired */}
      {stage === 'expired' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <AlertTriangle className="w-10 h-10 text-amber-400" />
          <p className="text-[17px] font-semibold">QR code expired</p>
          <p className="text-[13px] text-white/50">Open the CareOS app to generate a new QR code.</p>
        </div>
      )}

      {/* Error */}
      {stage === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <AlertTriangle className="w-10 h-10 text-red-400" />
          <p className="text-[17px] font-semibold">Something went wrong</p>
          <p className="text-[13px] text-white/50">{error || 'Could not load check-in session.'}</p>
        </div>
      )}

      {/* Choose what to share */}
      {stage === 'choose' && (
        <div className="flex-1 flex flex-col px-5 pb-10 gap-4 max-w-md mx-auto w-full">
          <div className="rounded-2xl bg-white/6 border border-white/10 p-4">
            <p className="text-[13px] text-white/50 uppercase tracking-widest font-semibold mb-1">Sharing with</p>
            <p className="text-[18px] font-bold">{session?.clinic_name || 'Clinic'}</p>
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#c4ff4d]/10 border border-[#c4ff4d]/20">
              <Wallet className="w-4 h-4 text-[#c4ff4d]" />
              <span className="text-[13px] font-semibold text-[#c4ff4d]">
                ${session?.reward_available_usd ?? 10} health wallet credit available
              </span>
            </div>
          </div>

          <p className="text-[13px] text-white/50 px-1">Choose what to share:</p>

          <div className="rounded-2xl bg-white/5 border border-white/8 overflow-hidden divide-y divide-white/8">
            {RESOURCE_OPTIONS.map(opt => {
              const on = selected.has(opt.id)
              return (
                <button
                  key={opt.id}
                  onClick={() => toggle(opt.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-white/10 transition"
                >
                  {on
                    ? <CheckCircle2 className="w-5 h-5 text-[#c4ff4d] shrink-0" />
                    : <Circle className="w-5 h-5 text-white/25 shrink-0" />}
                  <span className={`text-[15px] flex-1 ${opt.required ? 'text-white/40' : 'text-white'}`}>
                    {opt.label}
                  </span>
                  {opt.required && <span className="text-[10px] text-white/30 uppercase tracking-wider">Required</span>}
                  {opt.research && on && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#4d80ff]/20 text-[#4d80ff] font-semibold">Research</span>
                  )}
                </button>
              )
            })}
          </div>

          {selected.has('research_authorization') && (
            <div className="rounded-2xl bg-[#4d80ff]/10 border border-[#4d80ff]/20 p-4 text-[12px] text-white/60 leading-relaxed">
              <FlaskConical className="w-4 h-4 text-[#4d80ff] mb-2" />
              <strong className="text-white">Research authorization:</strong> You are voluntarily authorizing
              the use of your health information for an approved research purpose. You may revoke at any time.
              No treatment will be affected by your choice.
            </div>
          )}

          <button
            onClick={approve}
            className="w-full py-4 rounded-2xl bg-[#c4ff4d] text-[#111] text-[17px] font-bold active:bg-white transition flex items-center justify-center gap-2"
          >
            Approve & Share <ChevronRight className="w-5 h-5" />
          </button>

          <p className="text-center text-[11px] text-white/30 leading-relaxed">
            Your data is encrypted in transit. The QR code contains no personal information.
            Powered by CareOS · FHIR R4 · HIPAA
          </p>
        </div>
      )}

      {/* Submitting */}
      {stage === 'submitting' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <Loader2 className="w-10 h-10 text-[#c4ff4d] animate-spin" />
          <p className="text-[16px] font-semibold">Sending to clinic…</p>
        </div>
      )}

      {/* Approved */}
      {stage === 'approved' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-5">
          <div className="w-20 h-20 rounded-full bg-[#c4ff4d] flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-[#111]" />
          </div>
          <div>
            <p className="text-[22px] font-bold mb-2">Approved!</p>
            <p className="text-[14px] text-white/55">Your intake package is with the clinic.</p>
          </div>
          {session?.reward_pending_usd > 0 && (
            <div className="rounded-2xl bg-[#c4ff4d]/10 border border-[#c4ff4d]/20 px-6 py-4 w-full max-w-xs">
              <Wallet className="w-6 h-6 text-[#c4ff4d] mx-auto mb-2" />
              <p className="text-[24px] font-bold text-[#c4ff4d]">${session.reward_pending_usd}</p>
              <p className="text-[12px] text-white/50 mt-1">Health wallet credit pending clinic acceptance</p>
            </div>
          )}
          <p className="text-[12px] text-white/30">You can close this page.</p>
        </div>
      )}
    </div>
  )
}
