import { useEffect, useState } from 'react'
import {
  ClipboardList, Pill, AlertTriangle, FlaskConical, CalendarDays, Send, User,
} from 'lucide-react'
import type { Patient } from '../types'
import { CLINICAL, themeStyle, type RelationalTheme } from '../themes'

interface Props {
  patient: Patient
  onEvent?: (eventType: string, target?: string) => void
  theme?: RelationalTheme
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
 * Themeable "Traditional" (non-relational) chart: a siloed tabbed view where
 * each domain is a flat table with no cross-references. Mirrors the study's
 * Traditional arm but is re-skinnable via theme tokens for the exploration
 * pages (neon / generic).
 */
export default function TraditionalChart({ patient, onEvent, theme = CLINICAL }: Props) {
  useThemeFont(theme)
  const [tab, setTab] = useState<TabKey>('problems')
  const d = patient.demographics

  const switchTab = (t: TabKey) => {
    if (t !== tab) {
      onEvent?.('tab_switch', t)
      setTab(t)
    }
  }

  return (
    <div
      className="overflow-hidden border bg-[var(--r-surface)] border-[color:var(--r-panel-border)] rounded-[var(--r-panel-radius)] shadow-[var(--r-shadow)] text-[color:var(--r-text)] text-[13px]"
      style={{ ...themeStyle(theme), fontFamily: 'var(--r-font)' }}
    >
      {/* Title bar */}
      <div className="px-4 py-2.5 flex items-center justify-between bg-[image:linear-gradient(to_right,var(--r-header-from),var(--r-header-to))] text-[color:var(--r-header-fg)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--r-avatar-bg)]">
            <User className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold">{d.name}</span>
          <span className="text-[11px] text-[color:var(--r-header-fg-dim)]">MRN {d.mrn} · {d.sex} · {d.age}y</span>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-[color:var(--r-header-fg-dim)]">Chart Review</span>
      </div>

      {/* Tab strip */}
      <div className="flex border-b border-[color:var(--r-divider)] bg-[var(--r-panel-bg)] overflow-x-auto">
        {TABS.map((t) => {
          const active = t.key === tab
          return (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] whitespace-nowrap border-r border-[color:var(--r-divider)] transition-colors"
              style={active
                ? { background: 'var(--r-surface)', color: 'var(--r-text)', fontWeight: 600, boxShadow: 'inset 0 -2px 0 var(--r-accent)' }
                : { color: 'var(--r-muted-2)' }}
            >
              <t.icon className="w-3.5 h-3.5" style={{ color: active ? 'var(--r-icon)' : 'var(--r-muted)' }} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="p-4 min-h-[300px] max-h-[420px] overflow-auto">
        {tab === 'problems' && (
          <DataTable head={['Problem', 'Onset', 'Status']}
            rows={patient.problems.map((p) => [p.name, p.onset, p.status])}
            onRowClick={(i) => onEvent?.('click', `problem:${patient.problems[i].id}`)} />
        )}
        {tab === 'medications' && (
          <DataTable head={['Medication', 'Dose', 'Sig']}
            rows={patient.medications.map((m) => [m.name, m.dose, m.sig])}
            onRowClick={(i) => onEvent?.('click', `medication:${patient.medications[i].id}`)} />
        )}
        {tab === 'allergies' && (
          <DataTable head={['Substance', 'Reaction', 'Severity']}
            rows={patient.allergies.map((a) => [
              a.substance, a.reaction,
              <span key="s" style={{ color: a.severity === 'severe' ? 'var(--r-danger)' : 'var(--r-muted-2)', fontWeight: 600 }}>{a.severity}</span>,
            ])}
            onRowClick={(i) => onEvent?.('click', `allergy:${patient.allergies[i].id}`)} />
        )}
        {tab === 'labs' && (
          <DataTable head={['Test', 'Result', 'Date']}
            rows={patient.labs.map((l) => [
              l.name,
              <span key="v" style={{ color: l.flag === 'H' ? 'var(--r-danger)' : 'var(--r-muted-2)', fontWeight: l.flag === 'H' ? 600 : 400 }}>{l.value} {l.unit} {l.flag === 'H' ? '(H)' : ''}</span>,
              l.date,
            ])}
            onRowClick={(i) => onEvent?.('click', `lab:${patient.labs[i].id}`)} />
        )}
        {tab === 'encounters' && (
          <DataTable head={['Date', 'Type', 'Reason', 'Provider']}
            rows={patient.encounters.map((e) => [e.date, e.type, e.reason, e.provider])}
            onRowClick={(i) => onEvent?.('click', `encounter:${patient.encounters[i].id}`)} />
        )}
        {tab === 'referrals' && (
          <DataTable head={['Date', 'Specialty', 'Reason', 'Provider']}
            rows={patient.referrals.map((r) => [r.date, r.specialty, r.reason, r.provider])}
            onRowClick={(i) => onEvent?.('click', `referral:${patient.referrals[i].id}`)} />
        )}
      </div>
    </div>
  )
}

function DataTable({ head, rows, onRowClick }: {
  head: string[]; rows: React.ReactNode[][]; onRowClick?: (i: number) => void
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} className="text-left text-[11px] uppercase tracking-wide font-semibold px-2 py-1.5 border-b text-[color:var(--r-muted)] border-[color:var(--r-divider)]">
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
            className="cursor-default border-b border-[color:var(--r-divider)] hover:bg-[var(--r-soft-bg-hover)]"
          >
            {cells.map((c, j) => (
              <td key={j} className="px-2 py-1.5 align-top text-[color:var(--r-text)]">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
