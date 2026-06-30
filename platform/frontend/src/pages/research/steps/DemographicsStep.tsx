import { useState } from 'react'
import { ClipboardList, ArrowRight } from 'lucide-react'
import { researchApi } from '../researchApi'

interface Props {
  participantId: number
  onDone: () => void
}

const ROLES = [
  ['physician', 'Physician'],
  ['resident', 'Resident / Fellow'],
  ['nurse_practitioner', 'Nurse Practitioner'],
  ['physician_assistant', 'Physician Assistant'],
  ['registered_nurse', 'Registered Nurse'],
  ['pharmacist', 'Pharmacist'],
  ['other', 'Other'],
]
const EHRS = ['Epic', 'Oracle Health (Cerner)', 'MEDITECH', 'athenahealth', 'Allscripts/Veradigm', 'VA VistA', 'Other', 'None']
const AGE_RANGES = ['25-34', '35-44', '45-54', '55-64', '65+']

export default function DemographicsStep({ participantId, onDone }: Props) {
  const [role, setRole] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [years, setYears] = useState('')
  const [ehr, setEhr] = useState('')
  const [ehrHours, setEhrHours] = useState('')
  const [ageRange, setAgeRange] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await researchApi.setDemographics(participantId, {
        role: role || undefined,
        specialty: specialty || undefined,
        years_experience: years ? Number(years) : undefined,
        primary_ehr: ehr || undefined,
        ehr_hours_per_week: ehrHours ? Number(ehrHours) : undefined,
        age_range: ageRange || undefined,
      } as any)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full px-4 py-2.5 rounded-xl border border-sage-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none text-[14px] bg-white'
  const label = 'block text-[12px] font-semibold text-gray-500 mb-1.5'

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="w-5 h-5 text-teal-600" />
        <h2 className="text-[22px] font-bold text-gray-900">About you</h2>
      </div>
      <p className="text-[14px] text-gray-500 mb-6">
        Your background helps us interpret the results. No identifying information is collected.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className={label}>Professional role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
            <option value="">Select…</option>
            {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Specialty</label>
          <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Internal Medicine" className={field} />
        </div>
        <div>
          <label className={label}>Years in practice</label>
          <input type="number" min="0" value={years} onChange={(e) => setYears(e.target.value)} placeholder="e.g. 8" className={field} />
        </div>
        <div>
          <label className={label}>Primary EHR</label>
          <select value={ehr} onChange={(e) => setEhr(e.target.value)} className={field}>
            <option value="">Select…</option>
            {EHRS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Hours/week in the EHR</label>
          <input type="number" min="0" value={ehrHours} onChange={(e) => setEhrHours(e.target.value)} placeholder="e.g. 20" className={field} />
        </div>
        <div>
          <label className={label}>Age range</label>
          <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)} className={field}>
            <option value="">Prefer not to say</option>
            {AGE_RANGES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
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
