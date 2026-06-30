import { useState } from 'react'
import { MessageSquareText, ArrowRight } from 'lucide-react'
import { researchApi } from '../researchApi'
import type { InterfaceArm, QualPrompt } from '../types'

interface Props {
  participantId: number
  arm?: InterfaceArm | null
  prompts: QualPrompt[]
  title: string
  subtitle?: string
  ctaLabel?: string
  onDone: () => void
}

/** Open-ended responses (think-aloud / interview), per-interface or closing. */
export default function QualitativeStep({
  participantId, arm = null, prompts, title, subtitle, ctaLabel = 'Continue', onDone,
}: Props) {
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await researchApi.recordQualitative(
        participantId,
        prompts.map((p) => ({
          interface: arm,
          prompt_key: p.key,
          prompt: p.prompt,
          response: responses[p.key] || '',
        })),
      )
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquareText className="w-5 h-5 text-teal-600" />
        <h2 className="text-[22px] font-bold text-gray-900">{title}</h2>
      </div>
      {subtitle && <p className="text-[14px] text-gray-500 mb-6">{subtitle}</p>}

      <div className="space-y-4 mb-6">
        {prompts.map((p) => (
          <div key={p.key}>
            <label className="block text-[14px] font-medium text-gray-700 mb-1.5">{p.prompt}</label>
            <textarea
              value={responses[p.key] || ''}
              onChange={(e) => setResponses((r) => ({ ...r, [p.key]: e.target.value }))}
              rows={3}
              placeholder="Your response (optional)…"
              className="w-full px-4 py-2.5 rounded-xl border border-sage-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none text-[14px] resize-y"
            />
          </div>
        ))}
      </div>

      <button
        onClick={submit}
        disabled={busy}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 disabled:opacity-40 transition-all shadow-glow-teal"
      >
        {ctaLabel}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}
