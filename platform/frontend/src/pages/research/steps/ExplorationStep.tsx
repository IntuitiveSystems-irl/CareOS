import { useState } from 'react'
import { Compass, MousePointerClick, ScrollText, Clock, Eye, ArrowRight, Loader2 } from 'lucide-react'
import type { Patient } from '../types'
import { researchApi } from '../researchApi'
import ExplorationPage, { type ExplorationMetrics } from './ExplorationPage'
import PreferenceStep from './PreferenceStep'

interface Props {
  participantId: number
  patient: Patient
  onDone: () => void
}

/**
 * Free-exploration phase shown before the timed tasks. The participant explores
 * two full styled pages (neon + generic, counterbalanced), each containing a
 * relational and a non-relational section, while we capture clicks, scrolls,
 * time, and per-section attention.
 */
export default function ExplorationStep({ participantId, patient, onDone }: Props) {
  // Counterbalance the styling order by participant id parity.
  const order: ('neon' | 'generic')[] = participantId % 2 === 0 ? ['neon', 'generic'] : ['generic', 'neon']
  const [stage, setStage] = useState<'intro' | 0 | 1 | 'saving' | 'preference'>('intro')

  const handleComplete = async (idx: number, metrics: ExplorationMetrics) => {
    setStage('saving')
    try {
      await researchApi.recordExploration(participantId, metrics)
    } catch {
      /* don't block the participant on a telemetry failure */
    }
    if (idx + 1 < order.length) setStage((idx + 1) as 0 | 1)
    else setStage('preference')
  }

  const handlePreference = async (choice: 'neon' | 'generic') => {
    try {
      await researchApi.setStylePreference(participantId, choice)
    } catch {
      /* non-blocking */
    }
    onDone()
  }

  if (stage === 'intro') {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center px-6 py-10">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-sage-200/70 shadow-soft p-7 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-teal-100 mx-auto mb-5 flex items-center justify-center">
            <Compass className="w-7 h-7 text-teal-600" />
          </div>
          <h2 className="text-[24px] font-bold text-gray-900 mb-2">First, explore freely</h2>
          <p className="text-[15px] text-gray-500 mb-6">
            Before the timed tasks, we'd like you to look around two versions of a patient chart.
            Just explore naturally — click items, switch tabs, scroll. There are no right answers.
          </p>
          <div className="grid grid-cols-2 gap-3 text-left mb-6">
            <Capture icon={MousePointerClick} label="Clicks" />
            <Capture icon={ScrollText} label="Scrolling" />
            <Capture icon={Clock} label="Time on each view" />
            <Capture icon={Eye} label="On-screen attention" />
          </div>
          <p className="text-[12px] text-gray-400 mb-6">
            We record on-screen interactions and pointer movement only. <span className="font-medium text-gray-500">No webcam or camera is used.</span>
          </p>
          <button
            onClick={() => setStage(0)}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 transition-all shadow-glow-teal"
          >
            Start exploring <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'saving') {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
      </div>
    )
  }

  if (stage === 'preference') {
    return <PreferenceStep patient={patient} onSubmit={handlePreference} />
  }

  return (
    <ExplorationPage
      key={stage}
      styleName={order[stage]}
      orderIndex={stage}
      totalPages={order.length}
      patient={patient}
      onComplete={(m) => handleComplete(stage, m)}
    />
  )
}

function Capture({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 bg-warm-50 rounded-xl border border-sage-200/70 px-3 py-2.5">
      <Icon className="w-4 h-4 text-teal-600 shrink-0" />
      <span className="text-[13px] font-medium text-gray-700">{label}</span>
    </div>
  )
}
