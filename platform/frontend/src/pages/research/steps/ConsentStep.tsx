import { useState } from 'react'
import { ShieldCheck, ArrowRight } from 'lucide-react'
import { researchApi } from '../researchApi'
import type { Consent } from '../types'

interface Props {
  participantId: number
  consent: Consent
  onDone: () => void
}

export default function ConsentStep({ participantId, consent, onDone }: Props) {
  const [signature, setSignature] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!agreed || !signature.trim()) return
    setBusy(true)
    setError('')
    try {
      await researchApi.consent(participantId, signature.trim())
      onDone()
    } catch (e: any) {
      setError(e?.message || 'Could not record consent')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-5 h-5 text-teal-600" />
        <h2 className="text-[22px] font-bold text-gray-900">{consent.title}</h2>
      </div>
      <p className="text-[12px] text-gray-400 mb-6">Version {consent.version}</p>

      <div className="space-y-4 mb-6">
        {consent.sections.map((s) => (
          <div key={s.heading} className="bg-white rounded-xl border border-sage-200/70 p-4">
            <h3 className="text-[13px] font-semibold text-teal-700 uppercase tracking-wide mb-1.5">{s.heading}</h3>
            <p className="text-[14px] leading-relaxed text-gray-600">{s.body}</p>
          </div>
        ))}
      </div>

      <label className="flex items-start gap-3 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 w-4 h-4 accent-teal-600"
        />
        <span className="text-[14px] text-gray-700">{consent.agreement}</span>
      </label>

      <div className="mb-5">
        <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">Type your full name to sign</label>
        <input
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder="e.g. Jordan A. Smith"
          className="w-full px-4 py-2.5 rounded-xl border border-sage-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none text-[14px]"
        />
      </div>

      {error && <p className="text-[13px] text-red-600 mb-3">{error}</p>}

      <button
        onClick={submit}
        disabled={!agreed || !signature.trim() || busy}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-glow-teal"
      >
        I Consent — Continue
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}
