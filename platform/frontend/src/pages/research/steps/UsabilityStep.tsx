import { useState } from 'react'
import { ArrowRight, ArrowLeft, Gauge, ListChecks, Palette, Loader2 } from 'lucide-react'
import { researchApi } from '../researchApi'
import type { ScaleDef, UsabilityBlock } from '../types'

interface Props {
  participantId: number
  usability: UsabilityBlock
  onDone: () => void
}

type Page = 'sus' | 'heuristics' | 'design'

/**
 * Post-study usability evaluation of CareOS: System Usability Scale, Nielsen's
 * 10 heuristics, design ratings, and open-ended function feedback. Paginated to
 * keep each screen short; SUS is required (for scoring), the rest encouraged.
 */
export default function UsabilityStep({ participantId, usability, onDone }: Props) {
  const [page, setPage] = useState<Page>('sus')
  const [sus, setSus] = useState<Record<string, number>>({})
  const [heur, setHeur] = useState<Record<string, number>>({})
  const [design, setDesign] = useState<Record<string, number>>({})
  const [text, setText] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const susComplete = usability.sus.items.every((i) => sus[i.key] != null)

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await researchApi.recordUsability(participantId, {
        target: 'careos_relational',
        sus_responses: sus,
        heuristic_ratings: heur,
        design_ratings: design,
        most_valuable: text.most_valuable,
        missing_functions: text.missing_functions,
        friction: text.friction,
        general_comments: text.general,
      })
      onDone()
    } catch (e: any) {
      setError(e?.message || 'Failed to submit')
      setBusy(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 border border-teal-200/60 rounded-full mb-3">
          <span className="text-[11px] font-semibold text-teal-700">CareOS usability evaluation</span>
        </div>
        <h2 className="text-[24px] font-bold text-gray-900">Evaluating CareOS</h2>
        <p className="text-[14px] text-gray-500 max-w-lg mx-auto mt-1.5">{usability.intro}</p>
        <SubNav page={page} />
      </div>

      {/* ── SUS ── */}
      {page === 'sus' && (
        <Card>
          <SectionHead icon={Gauge} title="System Usability Scale" subtitle="Rate your agreement with each statement about CareOS." />
          <div className="divide-y divide-sage-100">
            {usability.sus.items.map((it, idx) => (
              <div key={it.key} className="py-4">
                <p className="text-[14px] text-gray-800 mb-2.5">
                  <span className="text-gray-400 font-semibold mr-1.5">{idx + 1}.</span>{it.text}
                </p>
                <Likert scale={usability.sus.scale} value={sus[it.key]} onChange={(v) => setSus({ ...sus, [it.key]: v })} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-5">
            <span className="text-[12px] text-gray-400">{Object.keys(sus).length}/{usability.sus.items.length} answered</span>
            <NextBtn disabled={!susComplete} onClick={() => setPage('heuristics')} label="Next: Heuristics" />
          </div>
          {!susComplete && <p className="text-[12px] text-amber-600 text-right mt-2">Please answer all items to continue.</p>}
        </Card>
      )}

      {/* ── Heuristics ── */}
      {page === 'heuristics' && (
        <Card>
          <SectionHead icon={ListChecks} title="Usability heuristics" subtitle="How well does CareOS support each principle?" />
          <div className="divide-y divide-sage-100">
            {usability.heuristics.items.map((h) => (
              <div key={h.key} className="py-4">
                <p className="text-[14px] font-semibold text-gray-800">{h.name}</p>
                <p className="text-[12px] text-gray-400 mb-2.5">{h.desc}</p>
                <Likert scale={usability.heuristics.scale} value={heur[h.key]} onChange={(v) => setHeur({ ...heur, [h.key]: v })} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-5">
            <BackBtn onClick={() => setPage('sus')} />
            <NextBtn onClick={() => setPage('design')} label="Next: Design & feedback" />
          </div>
        </Card>
      )}

      {/* ── Design + function feedback ── */}
      {page === 'design' && (
        <Card>
          <SectionHead icon={Palette} title="Design & feedback" subtitle="A few ratings and open questions about CareOS." />
          <div className="space-y-4 pb-2">
            {usability.design.dimensions.map((d) => (
              <div key={d.key} className="py-1">
                <p className="text-[14px] text-gray-800 mb-2">{d.question}</p>
                <Likert scale={usability.design.scale} value={design[d.key]} onChange={(v) => setDesign({ ...design, [d.key]: v })} />
              </div>
            ))}
          </div>
          <div className="space-y-4 pt-4 border-t border-sage-100">
            {usability.function_prompts.map((f) => (
              <div key={f.key}>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{f.prompt}</label>
                <textarea
                  rows={2}
                  value={text[f.key] || ''}
                  onChange={(e) => setText({ ...text, [f.key]: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage-200 text-[14px] text-gray-800 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none resize-none"
                  placeholder="Optional"
                />
              </div>
            ))}
          </div>
          {error && <p className="text-[13px] text-red-600 mt-3">{error}</p>}
          <div className="flex items-center justify-between pt-5">
            <BackBtn onClick={() => setPage('heuristics')} />
            <button
              onClick={submit}
              disabled={busy}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 transition-all shadow-glow-teal disabled:opacity-50"
            >
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <>Finish study <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}

function Likert({ scale, value, onChange }: { scale: ScaleDef; value?: number; onChange: (v: number) => void }) {
  const opts: number[] = []
  for (let i = scale.min; i <= scale.max; i++) opts.push(i)
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-gray-400 w-24 text-right leading-tight hidden sm:block">{scale.low}</span>
      <div className="flex gap-1.5">
        {opts.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`w-9 h-9 rounded-lg text-[13px] font-semibold border transition-all ${
              value === i ? 'bg-teal-500 text-white border-teal-500 shadow-glow-teal' : 'bg-white border-sage-200 text-gray-500 hover:border-teal-300'
            }`}
          >
            {i}
          </button>
        ))}
      </div>
      <span className="text-[11px] text-gray-400 w-24 leading-tight hidden sm:block">{scale.high}</span>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-sage-200/70 shadow-soft p-6 sm:p-7 max-w-2xl mx-auto">{children}</div>
}

function SectionHead({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 mb-3 pb-3 border-b border-sage-100">
      <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-teal-600" />
      </div>
      <div>
        <h3 className="text-[16px] font-bold text-gray-900">{title}</h3>
        <p className="text-[12.5px] text-gray-500">{subtitle}</p>
      </div>
    </div>
  )
}

function NextBtn({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 transition-all shadow-glow-teal disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {label} <ArrowRight className="w-4 h-4" />
    </button>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-semibold text-gray-500 hover:text-teal-700 hover:bg-teal-50 transition-all">
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  )
}

function SubNav({ page }: { page: Page }) {
  const steps: { id: Page; label: string }[] = [
    { id: 'sus', label: 'SUS' },
    { id: 'heuristics', label: 'Heuristics' },
    { id: 'design', label: 'Design' },
  ]
  const activeIdx = steps.findIndex((s) => s.id === page)
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
            i === activeIdx ? 'bg-teal-50 text-teal-700 border border-teal-200' : i < activeIdx ? 'text-teal-600' : 'text-gray-300'
          }`}>{s.label}</span>
          {i < steps.length - 1 && <div className={`w-4 h-px ${i < activeIdx ? 'bg-teal-300' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )
}
