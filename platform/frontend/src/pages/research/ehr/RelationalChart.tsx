import { useEffect, useMemo, useState } from 'react'
import {
  Pill, AlertTriangle, FlaskConical, CalendarDays, Send,
  ClipboardList, User, ArrowRight, Link2,
} from 'lucide-react'
import type { Patient } from '../types'
import { CLINICAL, themeStyle, type RelationalTheme } from '../themes'

interface Props {
  patient: Patient
  onEvent?: (eventType: string, target?: string) => void
  /** Visual theme. Defaults to the clinical study look. */
  theme?: RelationalTheme
}

type Sel = { kind: string; id: string } | null

const KIND_META: Record<string, { label: string; icon: any }> = {
  problem: { label: 'Problem', icon: ClipboardList },
  medication: { label: 'Medication', icon: Pill },
  allergy: { label: 'Allergy', icon: AlertTriangle },
  encounter: { label: 'Encounter', icon: CalendarDays },
  lab: { label: 'Lab', icon: FlaskConical },
  referral: { label: 'Referral', icon: Send },
}

/** Loads a theme's web font once (no-op for system-font themes). */
function useThemeFont(theme: RelationalTheme) {
  useEffect(() => {
    if (!theme.font) return
    const id = `relchart-font-${theme.id}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = theme.font.importUrl
    document.head.appendChild(link)
  }, [theme])
}

/**
 * Themeable "Relational" EHR chart. Same linked-entity model as the study
 * prototype, but every color is driven by CSS variables from `theme`, so it can
 * be re-skinned live in the theme explorer / showcase without touching the
 * controlled in-study component.
 */
export default function RelationalChart({ patient, onEvent, theme = CLINICAL }: Props) {
  useThemeFont(theme)
  const [sel, setSel] = useState<Sel>(null)
  const d = patient.demographics

  const labsSorted = useMemo(
    () => [...patient.labs].sort((a, b) => b.date.localeCompare(a.date)),
    [patient.labs],
  )
  const referralsSorted = useMemo(
    () => [...patient.referrals].sort((a, b) => b.date.localeCompare(a.date)),
    [patient.referrals],
  )

  const lookup = useMemo(() => ({
    problem: Object.fromEntries(patient.problems.map((x) => [x.id, x])),
    medication: Object.fromEntries(patient.medications.map((x) => [x.id, x])),
    allergy: Object.fromEntries(patient.allergies.map((x) => [x.id, x])),
    encounter: Object.fromEntries(patient.encounters.map((x) => [x.id, x])),
    lab: Object.fromEntries(patient.labs.map((x) => [x.id, x])),
    referral: Object.fromEntries(patient.referrals.map((x) => [x.id, x])),
  }), [patient])

  const labelFor = (kind: string, id: string): string => {
    const o: any = (lookup as any)[kind]?.[id]
    if (!o) return id
    if (kind === 'problem') return o.name
    if (kind === 'medication') return `${o.name} ${o.dose}`
    if (kind === 'allergy') return o.substance
    if (kind === 'encounter') return `${o.date} · ${o.reason}`
    if (kind === 'lab') return `${o.name} ${o.value}${o.unit}`
    if (kind === 'referral') return `${o.specialty} (${o.date})`
    return id
  }

  const conn = useMemo(() => {
    const keys = new Set<string>()
    const groups: { label: string; danger?: boolean; items: { kind: string; id: string }[] }[] = []
    if (!sel) return { keys, groups }
    const add = (label: string, items: { kind: string; id: string }[], danger = false) => {
      if (!items.length) return
      items.forEach((it) => keys.add(`${it.kind}:${it.id}`))
      groups.push({ label, items, danger })
    }
    const { kind, id } = sel
    if (kind === 'problem') {
      add('Treated by', patient.medications.filter((m) => m.treats === id).map((m) => ({ kind: 'medication', id: m.id })))
      add('Referrals', patient.referrals.filter((r) => r.problem_id === id).map((r) => ({ kind: 'referral', id: r.id })))
    } else if (kind === 'medication') {
      const m = lookup.medication[id]
      if (m?.treats) add('Treats', [{ kind: 'problem', id: m.treats }])
      if (m?.allergy_conflict) add('Allergy conflict', [{ kind: 'allergy', id: m.allergy_conflict }], true)
    } else if (kind === 'allergy') {
      add('Conflicting medication', patient.medications.filter((m) => m.allergy_conflict === id).map((m) => ({ kind: 'medication', id: m.id })), true)
    } else if (kind === 'encounter') {
      const e = lookup.encounter[id]
      add('Results collected', (e?.lab_ids || []).map((lid: string) => ({ kind: 'lab', id: lid })))
    } else if (kind === 'lab') {
      const l = lookup.lab[id]
      if (l?.encounter_id) add('From encounter', [{ kind: 'encounter', id: l.encounter_id }])
    } else if (kind === 'referral') {
      const r = lookup.referral[id]
      if (r?.problem_id) add('For problem', [{ kind: 'problem', id: r.problem_id }])
    }
    return { keys, groups }
  }, [sel, patient, lookup])

  const select = (kind: string, id: string) => {
    onEvent?.('click', `${kind}:${id}`)
    setSel({ kind, id })
  }

  const isConn = (kind: string, id: string) => conn.keys.has(`${kind}:${id}`)
  const isSel = (kind: string, id: string) => sel?.kind === kind && sel?.id === id

  const chipCls = (kind: string, id: string) => {
    const base = 'text-left w-full px-3 py-2 rounded-[var(--r-chip-radius)] border text-[13px] transition-all'
    if (isSel(kind, id)) return `${base} bg-[var(--r-accent)] text-[color:var(--r-accent-fg)] border-[color:var(--r-accent)] shadow-[var(--r-glow)]`
    if (isConn(kind, id)) return `${base} bg-[var(--r-soft-bg)] text-[color:var(--r-text)] border-[color:var(--r-conn-border)] ring-2 ring-[color:var(--r-ring)]`
    if (sel) return `${base} bg-[var(--r-surface)] text-[color:var(--r-text)] border-[color:var(--r-panel-border)] opacity-40 hover:opacity-100`
    return `${base} bg-[var(--r-surface)] text-[color:var(--r-text)] border-[color:var(--r-panel-border)] hover:border-[color:var(--r-conn-border)] hover:bg-[var(--r-soft-bg-hover)]`
  }

  const subCls = (kind: string, id: string) =>
    `text-[11px] ${isSel(kind, id) ? 'text-[color:var(--r-selected-sub)]' : 'text-[color:var(--r-muted)]'}`

  return (
    <div
      className="overflow-hidden border bg-[var(--r-panel-bg)] border-[color:var(--r-panel-border)] rounded-[var(--r-panel-radius)] shadow-[var(--r-shadow)] text-[color:var(--r-text)]"
      style={{ ...themeStyle(theme), fontFamily: 'var(--r-font)' }}
    >
      {/* Patient header */}
      <div className="px-5 py-3 flex items-center justify-between bg-[image:linear-gradient(to_right,var(--r-header-from),var(--r-header-to))] text-[color:var(--r-header-fg)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--r-avatar-bg)]">
            <User className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold leading-tight">{d.name}</div>
            <div className="text-[11px] text-[color:var(--r-header-fg-dim)]">MRN {d.mrn} · {d.sex} · {d.age}y</div>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-[color:var(--r-header-fg-dim)] flex items-center gap-1">
          <Link2 className="w-3 h-3" /> Relational Chart
        </span>
      </div>

      {/* Connections panel */}
      <div className="px-5 py-3 border-b min-h-[64px] bg-[var(--r-surface)] border-[color:var(--r-divider)]">
        {!sel ? (
          <p className="text-[12px] py-1 text-[color:var(--r-muted)]">
            Select any item below to reveal its linked records.
          </p>
        ) : (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] uppercase tracking-wide text-[color:var(--r-muted)]">{KIND_META[sel.kind].label}</span>
              <span className="text-[14px] font-semibold text-[color:var(--r-text)]">{labelFor(sel.kind, sel.id)}</span>
            </div>
            {conn.groups.length === 0 ? (
              <p className="text-[12px] text-[color:var(--r-muted)]">No linked records.</p>
            ) : (
              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                {conn.groups.map((g) => (
                  <div key={g.label} className="flex items-center gap-2 text-[13px]">
                    <span
                      className="flex items-center gap-1 text-[11px] font-semibold"
                      style={{ color: g.danger ? 'var(--r-danger)' : 'var(--r-label)' }}
                    >
                      {g.danger && <AlertTriangle className="w-3.5 h-3.5" />}
                      {g.label}
                      <ArrowRight className="w-3 h-3" />
                    </span>
                    {g.items.map((it) => (
                      <span
                        key={`${it.kind}:${it.id}`}
                        className="px-2 py-0.5 rounded-lg"
                        style={g.danger
                          ? { background: 'var(--r-danger-soft-bg)', color: 'var(--r-danger-soft-fg)' }
                          : { background: 'var(--r-soft-bg)', color: 'var(--r-soft-fg)' }}
                      >
                        {labelFor(it.kind, it.id)}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Entity lanes */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 max-h-[420px] overflow-auto">
        <Lane title="Problems" icon={ClipboardList}>
          {patient.problems.map((p) => (
            <button key={p.id} className={chipCls('problem', p.id)} onClick={() => select('problem', p.id)}>
              <div className="font-medium">{p.name}</div>
              <div className={subCls('problem', p.id)}>since {p.onset}</div>
            </button>
          ))}
        </Lane>

        <Lane title="Medications" icon={Pill}>
          {patient.medications.map((m) => (
            <button key={m.id} className={chipCls('medication', m.id)} onClick={() => select('medication', m.id)}>
              <div className="font-medium flex items-center gap-1.5">
                {m.name}
                {m.allergy_conflict && <AlertTriangle className="w-3.5 h-3.5 text-[color:var(--r-danger-icon)]" />}
              </div>
              <div className={subCls('medication', m.id)}>{m.dose} · {m.sig}</div>
            </button>
          ))}
        </Lane>

        <Lane title="Allergies" icon={AlertTriangle}>
          {patient.allergies.map((a) => (
            <button key={a.id} className={chipCls('allergy', a.id)} onClick={() => select('allergy', a.id)}>
              <div className="font-medium">{a.substance}</div>
              <div
                className="text-[11px]"
                style={{ color: isSel('allergy', a.id) ? 'var(--r-selected-sub)' : a.severity === 'severe' ? 'var(--r-danger-icon)' : 'var(--r-muted)' }}
              >
                {a.reaction} · {a.severity}
              </div>
            </button>
          ))}
        </Lane>

        <Lane title="Encounters" icon={CalendarDays}>
          {patient.encounters.map((e) => (
            <button key={e.id} className={chipCls('encounter', e.id)} onClick={() => select('encounter', e.id)}>
              <div className="font-medium">{e.reason}</div>
              <div className={subCls('encounter', e.id)}>{e.date} · {e.type}</div>
            </button>
          ))}
        </Lane>

        <Lane title="Labs (newest first)" icon={FlaskConical}>
          {labsSorted.map((l) => (
            <button key={l.id} className={chipCls('lab', l.id)} onClick={() => select('lab', l.id)}>
              <div className="font-medium flex items-center justify-between">
                <span>{l.name}</span>
                <span style={{ color: l.flag === 'H' ? 'var(--r-danger-icon)' : isSel('lab', l.id) ? 'var(--r-accent-fg)' : 'var(--r-muted-2)' }}>
                  {l.value}{l.unit}
                </span>
              </div>
              <div className={subCls('lab', l.id)}>{l.date}</div>
            </button>
          ))}
        </Lane>

        <Lane title="Referrals (newest first)" icon={Send}>
          {referralsSorted.map((r, i) => (
            <button key={r.id} className={chipCls('referral', r.id)} onClick={() => select('referral', r.id)}>
              <div className="font-medium flex items-center gap-1.5">
                {r.specialty}
                {i === 0 && (
                  <span
                    className="text-[9px] uppercase px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--r-badge-bg)', color: 'var(--r-badge-fg)' }}
                  >
                    latest
                  </span>
                )}
              </div>
              <div className={subCls('referral', r.id)}>{r.date} · {r.reason}</div>
            </button>
          ))}
        </Lane>
      </div>
    </div>
  )
}

function Lane({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 text-[11px] uppercase tracking-wide font-semibold text-[color:var(--r-muted-2)]">
        <Icon className="w-3.5 h-3.5 text-[color:var(--r-icon)]" />
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}
