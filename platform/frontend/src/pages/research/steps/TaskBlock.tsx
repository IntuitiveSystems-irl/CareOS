import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, MousePointerClick } from 'lucide-react'
import TraditionalEHR from '../ehr/TraditionalEHR'
import RelationalEHR from '../ehr/RelationalEHR'
import { researchApi } from '../researchApi'
import type { InterfaceArm, Study, TelemetryEvent } from '../types'

interface Props {
  participantId: number
  arm: InterfaceArm
  study: Study
  onDone: () => void
}

/**
 * Runs the full task set for one interface arm: shows each task prompt next to
 * the assigned EHR prototype, captures time-on-task, interaction count, and a
 * fine-grained telemetry stream, and scores each answer server-side.
 */
export default function TaskBlock({ participantId, arm, study, onDone }: Props) {
  const [taskIdx, setTaskIdx] = useState(0)
  const [selected, setSelected] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const clickCount = useRef(0)
  const taskStart = useRef(Date.now())
  const events = useRef<TelemetryEvent[]>([])

  const task = study.tasks[taskIdx]
  const total = study.tasks.length

  useEffect(() => {
    taskStart.current = Date.now()
    clickCount.current = 0
    setSelected('')
  }, [taskIdx])

  const handleEvent = (event_type: string, target?: string) => {
    clickCount.current += 1
    events.current.push({
      interface: arm,
      event_type,
      target,
      task_key: task.key,
      t_offset_ms: Date.now() - taskStart.current,
    })
  }

  const submit = async () => {
    if (!selected || submitting) return
    setSubmitting(true)
    const duration = Date.now() - taskStart.current
    try {
      await researchApi.recordAttempt(participantId, {
        interface: arm,
        task_key: task.key,
        submitted_answer: selected,
        duration_ms: duration,
        click_count: clickCount.current,
        completed: true,
      })
      if (taskIdx + 1 < total) {
        setTaskIdx(taskIdx + 1)
      } else {
        if (events.current.length) {
          await researchApi.recordEvents(participantId, events.current).catch(() => {})
          events.current = []
        }
        onDone()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Task prompt bar */}
      <div className="sticky top-0 z-10 mb-4 rounded-2xl bg-white border border-sage-200/70 shadow-soft p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-teal-600">
            {arm === 'traditional' ? 'Traditional Interface' : 'Relational Interface'} · Task {taskIdx + 1} of {total}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <MousePointerClick className="w-3.5 h-3.5" /> interactions tracked
          </span>
        </div>
        <p className="text-[16px] font-semibold text-gray-900 mb-3">{task.prompt}</p>
        <div className="flex flex-wrap gap-2">
          {task.options.map((opt) => (
            <button
              key={opt}
              onClick={() => setSelected(opt)}
              className={`px-3.5 py-2 rounded-xl text-[13px] font-medium border transition-all ${
                selected === opt
                  ? 'bg-teal-500 text-white border-teal-500 shadow-glow-teal'
                  : 'bg-white text-gray-700 border-sage-200 hover:border-teal-300 hover:bg-teal-50/50'
              }`}
            >
              {opt}
            </button>
          ))}
          <button
            onClick={submit}
            disabled={!selected || submitting}
            className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-glow-teal"
          >
            <CheckCircle2 className="w-4 h-4" />
            {taskIdx + 1 < total ? 'Submit & Next' : 'Submit & Finish'}
          </button>
        </div>
        {/* progress */}
        <div className="mt-3 h-1 rounded-full bg-sage-100 overflow-hidden">
          <div className="h-full bg-teal-500 transition-all" style={{ width: `${(taskIdx / total) * 100}%` }} />
        </div>
      </div>

      {/* The interface under study */}
      {arm === 'traditional'
        ? <TraditionalEHR patient={study.patient} onEvent={handleEvent} />
        : <RelationalEHR patient={study.patient} onEvent={handleEvent} />}
    </div>
  )
}
