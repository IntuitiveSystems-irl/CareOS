import { useMemo, useState } from 'react'
import {
  Pill, AlertTriangle, FlaskConical, CalendarDays, Send,
  ClipboardList, User, ArrowRight, Link2,
} from 'lucide-react'
import type { Patient } from '../types'

interface Props {
  patient: Patient
  onEvent: (eventType: string, target?: string) => void
}

type Sel = { kind: string; id: string } | null

const KIND_META: Record<string, { label: string; icon: any; color: string }> = {
  problem: { label: 'Problem', icon: ClipboardList, color: 'teal' },
  medication: { label: 'Medication', icon: Pill, color: 'teal' },
  allergy: { label: 'Allergy', icon: AlertTriangle, color: 'red' },
  encounter: { label: 'Encounter', icon: CalendarDays, color: 'teal' },
  lab: { label: 'Lab', icon: FlaskConical, color: 'teal' },
  referral: { label: 'Referral', icon: Send, color: 'teal' },
}

/**
 * "Relational" EHR: the same chart, but entities are linked. Selecting any
 * item surfaces its relationships (problem<->med, encounter<->labs,
 * med<->allergy conflict) directly, so cross-domain look-ups are a single
 * click instead of multi-tab navigation. This is the lower-workload arm.
 */
export default function RelationalEHR({ patient, onEvent }: Props) {
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

  // Compute connected entities for the current selection.
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
    onEvent('click', `${kind}:${id}`)
    setSel({ kind, id })
  }

  const isConn = (kind: string, id: string) => conn.keys.has(`${kind}:${id}`)
  const isSel = (kind: string, id: string) => sel?.kind === kind && sel?.id === id

  const chipCls = (kind: string, id: string) => {
    const base = 'text-left w-full px-3 py-2 rounded-xl border text-[13px] transition-all'
    if (isSel(kind, id)) return `${base} bg-teal-500 text-white border-teal-500 shadow-glow-teal`
    if (isConn(kind, id)) return `${base} bg-teal-50 border-teal-300 ring-2 ring-teal-200`
    if (sel) return `${base} bg-white border-sage-200/70 opacity-40 hover:opacity-100`
    return `${base} bg-white border-sage-200/70 hover:border-teal-300 hover:bg-teal-50/40`
  }

  return (
    <div className="rounded-2xl border border-sage-200/70 bg-warm-50 overflow-hidden shadow-soft">
      {/* Patient header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold leading-tight">{d.name}</div>
            <div className="text-[11px] text-teal-100">MRN {d.mrn} · {d.sex} · {d.age}y</div>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-teal-100/80 flex items-center gap-1">
          <Link2 className="w-3 h-3" /> Relational Chart
        </span>
      </div>

      {/* Connections panel */}
      <div className="px-5 py-3 bg-white border-b border-sage-100 min-h-[64px]">
        {!sel ? (
          <p className="text-[12px] text-gray-400 py-1">
            Select any item below to reveal its linked records.
          </p>
        ) : (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] uppercase tracking-wide text-gray-400">{KIND_META[sel.kind].label}</span>
              <span className="text-[14px] font-semibold text-gray-900">{labelFor(sel.kind, sel.id)}</span>
            </div>
            {conn.groups.length === 0 ? (
              <p className="text-[12px] text-gray-400">No linked records.</p>
            ) : (
              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                {conn.groups.map((g) => (
                  <div key={g.label} className="flex items-center gap-2 text-[13px]">
                    <span className={`flex items-center gap-1 text-[11px] font-semibold ${g.danger ? 'text-red-600' : 'text-teal-700'}`}>
                      {g.danger && <AlertTriangle className="w-3.5 h-3.5" />}
                      {g.label}
                      <ArrowRight className="w-3 h-3" />
                    </span>
                    {g.items.map((it) => (
                      <span key={`${it.kind}:${it.id}`} className={`px-2 py-0.5 rounded-lg ${g.danger ? 'bg-red-50 text-red-700' : 'bg-teal-50 text-teal-800'}`}>
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
              <div className={`text-[11px] ${isSel('problem', p.id) ? 'text-teal-50' : 'text-gray-400'}`}>since {p.onset}</div>
            </button>
          ))}
        </Lane>

        <Lane title="Medications" icon={Pill}>
          {patient.medications.map((m) => (
            <button key={m.id} className={chipCls('medication', m.id)} onClick={() => select('medication', m.id)}>
              <div className="font-medium flex items-center gap-1.5">
                {m.name}
                {m.allergy_conflict && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
              </div>
              <div className={`text-[11px] ${isSel('medication', m.id) ? 'text-teal-50' : 'text-gray-400'}`}>{m.dose} · {m.sig}</div>
            </button>
          ))}
        </Lane>

        <Lane title="Allergies" icon={AlertTriangle}>
          {patient.allergies.map((a) => (
            <button key={a.id} className={chipCls('allergy', a.id)} onClick={() => select('allergy', a.id)}>
              <div className="font-medium">{a.substance}</div>
              <div className={`text-[11px] ${isSel('allergy', a.id) ? 'text-teal-50' : a.severity === 'severe' ? 'text-red-500' : 'text-gray-400'}`}>{a.reaction} · {a.severity}</div>
            </button>
          ))}
        </Lane>

        <Lane title="Encounters" icon={CalendarDays}>
          {patient.encounters.map((e) => (
            <button key={e.id} className={chipCls('encounter', e.id)} onClick={() => select('encounter', e.id)}>
              <div className="font-medium">{e.reason}</div>
              <div className={`text-[11px] ${isSel('encounter', e.id) ? 'text-teal-50' : 'text-gray-400'}`}>{e.date} · {e.type}</div>
            </button>
          ))}
        </Lane>

        <Lane title="Labs (newest first)" icon={FlaskConical}>
          {labsSorted.map((l) => (
            <button key={l.id} className={chipCls('lab', l.id)} onClick={() => select('lab', l.id)}>
              <div className="font-medium flex items-center justify-between">
                <span>{l.name}</span>
                <span className={l.flag === 'H' ? 'text-red-500' : isSel('lab', l.id) ? 'text-white' : 'text-gray-500'}>
                  {l.value}{l.unit}
                </span>
              </div>
              <div className={`text-[11px] ${isSel('lab', l.id) ? 'text-teal-50' : 'text-gray-400'}`}>{l.date}</div>
            </button>
          ))}
        </Lane>

        <Lane title="Referrals (newest first)" icon={Send}>
          {referralsSorted.map((r, i) => (
            <button key={r.id} className={chipCls('referral', r.id)} onClick={() => select('referral', r.id)}>
              <div className="font-medium flex items-center gap-1.5">
                {r.specialty}
                {i === 0 && <span className="text-[9px] uppercase bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">latest</span>}
              </div>
              <div className={`text-[11px] ${isSel('referral', r.id) ? 'text-teal-50' : 'text-gray-400'}`}>{r.date} · {r.reason}</div>
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
      <div className="flex items-center gap-1.5 mb-2 text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
        <Icon className="w-3.5 h-3.5 text-teal-600" />
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}
