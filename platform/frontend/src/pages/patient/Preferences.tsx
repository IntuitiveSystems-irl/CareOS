import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { Destination, FulfillmentPreferences, DestinationKind } from '../../types'

const PATIENT_ID = 1

export default function PreferencesPage() {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [prefs, setPrefs] = useState<FulfillmentPreferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Local form state
  const [labId, setLabId] = useState<number | null>(null)
  const [pharmacyId, setPharmacyId] = useState<number | null>(null)
  const [payerId, setPayerId] = useState<number | null>(null)
  const [pcpId, setPcpId] = useState<number | null>(null)
  const [specialistIds, setSpecialistIds] = useState<number[]>([])

  useEffect(() => {
    api.getDestinations().then(setDestinations).catch(() => {})
    api.getPreferences(PATIENT_ID).then((p) => {
      setPrefs(p)
      setLabId(p.preferred_lab_id)
      setPharmacyId(p.preferred_pharmacy_id)
      setPayerId(p.preferred_payer_id)
      setPcpId(p.preferred_primary_care_office_id)
      setSpecialistIds(p.preferred_specialist_office_ids || [])
    }).catch(() => {})
  }, [])

  const byKind = (k: DestinationKind) => destinations.filter((d) => d.kind === k)

  const handleSave = async () => {
    setSaving(true)
    setMsg('')
    try {
      const updated = await api.updatePreferences(PATIENT_ID, {
        preferred_lab_id: labId,
        preferred_pharmacy_id: pharmacyId,
        preferred_payer_id: payerId,
        preferred_primary_care_office_id: pcpId,
        preferred_specialist_office_ids: specialistIds,
      })
      setPrefs(updated)
      setMsg('Preferences saved.')
    } catch {
      setMsg('Failed to save preferences.')
    } finally {
      setSaving(false)
    }
  }

  const toggleSpecialist = (id: number) => {
    setSpecialistIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const selectClass = 'w-full text-[13px] border border-gray-200 rounded-xl px-3.5 py-2.5 bg-white focus:border-teal-300 focus:ring-1 focus:ring-teal-200 outline-none transition-all'

  return (
    <div className="max-w-4xl space-y-8 animate-fade-in">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-900 mb-1">Fulfillment Preferences</h1>
        <p className="text-[15px] text-gray-400 font-light">
          Choose where your lab orders, prescriptions, referrals, and insurance documents are routed after a visit.
        </p>
      </div>

      {msg && (
        <div className={`rounded-xl p-4 text-[13px] font-medium ${msg.includes('Failed') ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
          {msg}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Preferred Lab */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
          <h2 className="mb-3 text-[13px] font-semibold text-gray-800">Preferred Lab</h2>
          <select
            className={selectClass}
            value={labId ?? ''}
            onChange={(e) => setLabId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— None —</option>
            {byKind('lab').map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Preferred Pharmacy */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
          <h2 className="mb-3 text-[13px] font-semibold text-gray-800">Preferred Pharmacy</h2>
          <select
            className={selectClass}
            value={pharmacyId ?? ''}
            onChange={(e) => setPharmacyId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— None —</option>
            {byKind('pharmacy').map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Preferred Payer */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
          <h2 className="mb-3 text-[13px] font-semibold text-gray-800">Insurance / Payer</h2>
          <select
            className={selectClass}
            value={payerId ?? ''}
            onChange={(e) => setPayerId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— None —</option>
            {byKind('payer').map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* PCP Office */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
          <h2 className="mb-3 text-[13px] font-semibold text-gray-800">Primary Care Office</h2>
          <select
            className={selectClass}
            value={pcpId ?? ''}
            onChange={(e) => setPcpId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— None —</option>
            {byKind('provider').map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Specialist Offices */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
        <h2 className="mb-2 text-[13px] font-semibold text-gray-800">Preferred Specialist Offices</h2>
        <p className="mb-4 text-[12px] text-gray-400">Select one or more specialist offices for referrals.</p>
        <div className="space-y-2.5">
          {byKind('provider').map((d) => (
            <label key={d.id} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={specialistIds.includes(d.id)}
                onChange={() => toggleSpecialist(d.id)}
                className="rounded border-gray-200 text-teal-500 focus:ring-teal-300"
              />
              <span className="text-[13px] text-gray-700">{d.name}</span>
              {d.address && <span className="text-[11px] text-gray-300">— {d.address}</span>}
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2.5 bg-teal-500 text-white text-[13px] font-semibold rounded-xl hover:bg-teal-600 transition-all disabled:opacity-50 shadow-sm"
      >
        {saving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  )
}
