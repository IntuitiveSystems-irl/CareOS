import { AlertTriangle, Info, ShieldAlert, MessageSquareQuote, GitBranch, Check, Lightbulb } from 'lucide-react'

export interface CdsCard {
  uuid: string
  summary: string
  indicator: 'info' | 'warning' | 'critical' | string
  detail?: string
  source?: { label?: string; url?: string }
  suggestions?: { uuid: string; label: string }[]
  careos?: {
    kind?: string
    related?: { kind: string; id: string; label: string }[]
    feedback_id?: number | null
  }
}

const INDICATOR_STYLES: Record<string, { ring: string; chip: string; icon: any }> = {
  critical: { ring: 'border-red-500/30 bg-red-500/[0.06]', chip: 'bg-red-500/15 text-red-300', icon: ShieldAlert },
  warning: { ring: 'border-amber-500/30 bg-amber-500/[0.06]', chip: 'bg-amber-500/15 text-amber-300', icon: AlertTriangle },
  info: { ring: 'border-sky-500/25 bg-sky-500/[0.05]', chip: 'bg-sky-500/15 text-sky-300', icon: Info },
}

/** Minimal markdown: bold (**x**) + blockquote (> x). */
function renderDetail(detail: string) {
  return detail.split('\n').map((line, i) => {
    const isQuote = line.startsWith('> ')
    const text = (isQuote ? line.slice(2) : line).split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
      seg.startsWith('**') && seg.endsWith('**')
        ? <strong key={j} className="text-white">{seg.slice(2, -2)}</strong>
        : <span key={j}>{seg}</span>,
    )
    if (!line.trim()) return <div key={i} className="h-1.5" />
    if (isQuote) {
      return (
        <blockquote key={i} className="border-l-2 border-white/20 pl-3 italic text-white/70 my-1">{text}</blockquote>
      )
    }
    return <p key={i} className="text-white/60 leading-relaxed">{text}</p>
  })
}

export default function CdsCards({
  cards, onAcknowledge,
}: { cards: CdsCard[]; onAcknowledge?: (feedbackId: number) => void }) {
  if (!cards.length) {
    return (
      <div className="text-center py-8 text-white/30 text-[13px] border border-dashed border-white/[0.08] rounded-xl">
        No decision-support cards — chart is clear and no open patient feedback.
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {cards.map((card) => {
        const style = INDICATOR_STYLES[card.indicator] || INDICATOR_STYLES.info
        const isFeedback = card.careos?.kind === 'patient_feedback'
        const Icon = isFeedback ? MessageSquareQuote : style.icon
        return (
          <div key={card.uuid} className={`rounded-xl border p-4 ${style.ring}`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${style.chip}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-[13px] font-semibold text-white">{card.summary}</h4>
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${style.chip}`}>
                    {card.indicator}
                  </span>
                  {isFeedback && (
                    <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                      Patient voice
                    </span>
                  )}
                </div>

                {card.detail && <div className="text-[12px] mt-1.5 space-y-0.5">{renderDetail(card.detail)}</div>}

                {/* Relational links — what this card connects */}
                {!!card.careos?.related?.length && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                    <GitBranch className="w-3.5 h-3.5 text-white/30" />
                    {card.careos.related.map((r, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-white/[0.06] text-white/70 border border-white/[0.08]">
                        <span className="text-white/35">{r.kind}</span> {r.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Suggestions — advisory next steps */}
                {!!card.suggestions?.length && (
                  <div className="flex items-start gap-1.5 flex-wrap mt-2.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-300/70 mt-0.5" />
                    {card.suggestions.map((s) => (
                      <span key={s.uuid} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-amber-500/[0.08] text-amber-200/90 border border-amber-500/15">
                        {s.label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-[11px] text-white/30">{card.source?.label}</span>
                  {isFeedback && card.careos?.feedback_id && onAcknowledge && (
                    <button
                      onClick={() => onAcknowledge(card.careos!.feedback_id!)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-all"
                    >
                      <Check className="w-3 h-3" /> Acknowledge
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
