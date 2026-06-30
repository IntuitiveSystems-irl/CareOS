import { useState } from 'react'
import {
  ClipboardList, Pill, AlertTriangle, FlaskConical,
  CalendarDays, Send, User,
} from 'lucide-react'
import type { Patient } from '../types'

interface Props {
  patient: Patient
  onEvent: (eventType: string, target?: string) => void
}

const TABS = [
  { key: 'problems', label: 'Problems', icon: ClipboardList },
  { key: 'medications', label: 'Medications', icon: Pill },
  { key: 'allergies', label: 'Allergies', icon: AlertTriangle },
  { key: 'labs', label: 'Labs', icon: FlaskConical },
  { key: 'encounters', label: 'Encounters', icon: CalendarDays },
  { key: 'referrals', label: 'Referrals', icon: Send },
] as const

type TabKey = (typeof TABS)[number]['key']

function flagColor(flag: string) {
  if (flag === 'H') return 'text-red-600 font-semibold'
  if (flag === 'L') return 'text-amber-600 font-semibold'
  return 'text-slate-500'
}

/**
 * "Traditional" EHR: a legacy tabbed, siloed chart. Each domain lives on its
 * own tab as a flat table with no cross-references — so any task that links
 * two domains (e.g. medication <-> allergy) forces manual tab-switching and
 * working-memory load. This is the higher-cognitive-workload arm.
 */
export default function TraditionalEHR({ patient, onEvent }: Props) {
  const [tab, setTab] = useState<TabKey>('problems')

  const switchTab = (t: TabKey) => {
    if (t !== tab) {
      onEvent('tab_switch', t)
      setTab(t)
    }
  }

  const d = patient.demographics

  return (
    <div className="border border-slate-300 rounded-md overflow-hidden bg-white shadow-sm font-sans text-[13px]">
      {/* Title bar — deliberately utilitarian / legacy */}
      <div className="bg-slate-700 text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate-300" />
          <span className="font-semibold">{d.name}</span>
          <span className="text-slate-300 text-[11px]">
            MRN {d.mrn} · {d.sex} · DOB {d.dob} · {d.age}y
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-slate-400">Chart Review</span>
      </div>

      {/* Tab strip */}
      <div className="flex border-b border-slate-300 bg-slate-100 overflow-x-auto">
        {TABS.map((t) => {
          const active = t.key === tab
          return (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[12px] whitespace-nowrap border-r border-slate-300 transition-colors ${
                active
                  ? 'bg-white text-slate-900 font-semibold border-b-2 border-b-blue-600 -mb-px'
                  : 'text-slate-500 hover:bg-slate-200/60'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="p-4 min-h-[320px] max-h-[420px] overflow-auto">
        {tab === 'problems' && (
          <Table head={['Problem', 'Onset', 'Status']}
            rows={patient.problems.map((p) => [p.name, p.onset, p.status])}
            onRowClick={(i) => onEvent('click', `problem:${patient.problems[i].id}`)} />
        )}
        {tab === 'medications' && (
          <Table head={['Medication', 'Dose', 'Sig']}
            rows={patient.medications.map((m) => [m.name, m.dose, m.sig])}
            onRowClick={(i) => onEvent('click', `medication:${patient.medications[i].id}`)} />
        )}
        {tab === 'allergies' && (
          <Table head={['Substance', 'Reaction', 'Severity']}
            rows={patient.allergies.map((a) => [
              a.substance, a.reaction,
              <span key="s" className={a.severity === 'severe' ? 'text-red-600 font-semibold' : 'text-amber-600'}>
                {a.severity}
              </span>,
            ])}
            onRowClick={(i) => onEvent('click', `allergy:${patient.allergies[i].id}`)} />
        )}
        {tab === 'labs' && (
          <Table head={['Test', 'Result', 'Date']}
            rows={[...patient.labs].map((l) => [
              l.name,
              <span key="v" className={flagColor(l.flag)}>{l.value} {l.unit} {l.flag === 'H' ? '(H)' : ''}</span>,
              l.date,
            ])}
            onRowClick={(i) => onEvent('click', `lab:${patient.labs[i].id}`)} />
        )}
        {tab === 'encounters' && (
          <Table head={['Date', 'Type', 'Reason', 'Provider']}
            rows={patient.encounters.map((e) => [e.date, e.type, e.reason, e.provider])}
            onRowClick={(i) => onEvent('click', `encounter:${patient.encounters[i].id}`)} />
        )}
        {tab === 'referrals' && (
          <Table head={['Date', 'Specialty', 'Reason', 'Provider']}
            rows={patient.referrals.map((r) => [r.date, r.specialty, r.reason, r.provider])}
            onRowClick={(i) => onEvent('click', `referral:${patient.referrals[i].id}`)} />
        )}
      </div>
    </div>
  )
}

function Table({
  head, rows, onRowClick,
}: {
  head: string[]
  rows: React.ReactNode[][]
  onRowClick?: (rowIndex: number) => void
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} className="text-left text-[11px] uppercase tracking-wide text-slate-500 font-semibold border-b border-slate-300 px-2 py-1.5">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr
            key={i}
            onClick={() => onRowClick?.(i)}
            className="hover:bg-blue-50/50 cursor-default border-b border-slate-100"
          >
            {cells.map((c, j) => (
              <td key={j} className="px-2 py-1.5 text-slate-700 align-top">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
