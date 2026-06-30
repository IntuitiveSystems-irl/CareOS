import { useState } from 'react'
import { Check, ArrowRight, Loader2 } from 'lucide-react'
import type { Patient } from '../types'
import { VIBRANT, CLINICAL, type RelationalTheme } from '../themes'
import RelationalChart from '../ehr/RelationalChart'

interface Props {
  patient: Patient
  onSubmit: (choice: 'neon' | 'generic') => void
}

const OPTIONS: { id: 'neon' | 'generic'; label: string; bg: string; accent: string; fg: string; theme: RelationalTheme }[] = [
  { id: 'neon', label: 'Neon', bg: '#0f1115', accent: '#c4ff4d', fg: '#e6e9ef', theme: VIBRANT },
  { id: 'generic', label: 'Generic', bg: '#f4f5f7', accent: '#475569', fg: '#1f2937', theme: CLINICAL },
]

/**
 * Forced-choice design preference shown after the two exploration pages: a small
 * framed preview of each design (neon vs generic) and a single "which do you
 * prefer?" question.
 */
export default function PreferenceStep({ patient, onSubmit }: Props) {
  const [choice, setChoice] = useState<'neon' | 'generic' | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = () => {
    if (!choice) return
    setBusy(true)
    onSubmit(choice)
  }

  return (
    <div className="min-h-screen bg-warm-50 px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 border border-teal-200/60 rounded-full mb-3">
            <span className="text-[11px] font-semibold text-teal-700">One quick question</span>
          </div>
          <h2 className="text-[26px] sm:text-[30px] font-bold tracking-tight text-gray-900">Which design do you prefer?</h2>
          <p className="text-[14px] text-gray-500 mt-1.5">Based on the two pages you just explored. Pick the one you'd rather use.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {OPTIONS.map((o) => {
            const selected = choice === o.id
            return (
              <button
                key={o.id}
                onClick={() => setChoice(o.id)}
                className={`text-left rounded-2xl border-2 overflow-hidden transition-all ${
                  selected ? 'border-teal-400 ring-2 ring-teal-100 shadow-soft' : 'border-sage-200/70 hover:border-sage-300'
                }`}
              >
                {/* Window title bar */}
                <div className="flex items-center justify-between px-3 py-2" style={{ background: o.bg }}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff6b5b' }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ffd23f' }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: o.accent }} />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: o.accent }}>{o.label}</span>
                </div>
                {/* Design preview window */}
                <div className="relative" style={{ background: o.bg, height: 300, overflow: 'hidden', padding: 14 }}>
                  <div className="pointer-events-none origin-top-left" style={{ transform: 'scale(0.9)', width: '111%' }}>
                    <RelationalChart patient={patient} theme={o.theme} />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-12" style={{ background: `linear-gradient(to top, ${o.bg}, transparent)` }} />
                </div>
                {/* Choice footer */}
                <div className="flex items-center justify-between px-4 py-3 bg-white">
                  <span className="text-[14px] font-semibold text-gray-800">{o.label} design</span>
                  <span className={`flex items-center gap-1.5 text-[13px] font-semibold ${selected ? 'text-teal-700' : 'text-gray-400'}`}>
                    {selected ? <><Check className="w-4 h-4" /> Selected</> : 'Choose'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex justify-center mt-8">
          <button
            onClick={submit}
            disabled={!choice || busy}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-[15px] font-semibold text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 transition-all shadow-glow-teal disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <>Continue <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </div>
  )
}
