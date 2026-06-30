import { useState } from 'react'
import { Gauge, ArrowRight } from 'lucide-react'
import { researchApi } from '../researchApi'
import type { InterfaceArm, TlxDimension, WorkloadPayload } from '../types'

interface Props {
  participantId: number
  arm: InterfaceArm
  dimensions: TlxDimension[]
  onDone: () => void
}

/** NASA Task Load Index — six 0-100 subscales for the just-completed arm. */
export default function NasaTlxStep({ participantId, arm, dimensions, onDone }: Props) {
  const [values, setValues] = useState<Record<string, number>>(
    () => Object.fromEntries(dimensions.map((d) => [d.key, 50])),
  )
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await researchApi.recordWorkload(participantId, {
        interface: arm,
        ...values,
      } as unknown as WorkloadPayload)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Gauge className="w-5 h-5 text-teal-600" />
        <h2 className="text-[22px] font-bold text-gray-900">Workload rating</h2>
      </div>
      <p className="text-[14px] text-gray-500 mb-6">
        Rate your experience with the{' '}
        <span className="font-semibold text-teal-700">
          {arm === 'traditional' ? 'Traditional' : 'Relational'}
        </span>{' '}
        interface you just used.
      </p>

      <div className="space-y-5 mb-7">
        {dimensions.map((d) => (
          <div key={d.key} className="bg-white rounded-xl border border-sage-200/70 p-4">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[14px] font-semibold text-gray-800">{d.label}</span>
              <span className="text-[15px] font-bold text-teal-600 tabular-nums">{values[d.key]}</span>
            </div>
            <p className="text-[13px] text-gray-500 mb-2.5">{d.question}</p>
            <input
              type="range"
              min={0}
              max={100}
              value={values[d.key]}
              onChange={(e) => setValues((v) => ({ ...v, [d.key]: Number(e.target.value) }))}
              className="w-full accent-teal-600"
            />
            <div className="flex justify-between text-[11px] text-gray-400 mt-1">
              <span>{d.low}</span>
              <span>{d.high}</span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={submit}
        disabled={busy}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 disabled:opacity-40 transition-all shadow-glow-teal"
      >
        Continue
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}
