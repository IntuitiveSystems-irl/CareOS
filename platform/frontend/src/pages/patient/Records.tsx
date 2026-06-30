import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { PatientRecords } from '../../types'

export default function Records() {
  const [records, setRecords] = useState<PatientRecords | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('diagnoses')

  useEffect(() => {
    api.getPatientRecords(1).then((r) => {
      setRecords(r)
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
    </div>
  )
  if (!records) return <div className="text-gray-400 text-[13px]">No records found</div>

  const tabs = [
    { key: 'diagnoses', label: 'Diagnoses', count: records.diagnoses.length },
    { key: 'medications', label: 'Medications', count: records.medications.length },
    { key: 'allergies', label: 'Allergies', count: records.allergies.length },
    { key: 'labs', label: 'Lab Results', count: records.lab_results.length },
    { key: 'encounters', label: 'Encounters', count: records.encounters.length },
  ]

  return (
    <div className="max-w-5xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-900 mb-1">My Health Records</h1>
        <p className="text-[15px] text-gray-400 font-light">
          {records.patient.first_name} {records.patient.last_name} &middot; DOB: {records.patient.date_of_birth}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-sage-50 rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-soft'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[11px] text-gray-300">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
        {activeTab === 'diagnoses' && (
          <div className="divide-y divide-gray-50">
            {records.diagnoses.map((d) => (
              <div key={d.id} className="px-6 py-4 hover:bg-sage-50/30 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-mono text-gray-400 bg-sage-50 px-2 py-0.5 rounded-md">{d.code}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${d.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                    {d.status}
                  </span>
                </div>
                <p className="text-[13px] font-medium text-gray-800">{d.description}</p>
                {d.date_diagnosed && (
                  <p className="text-[11px] text-gray-300 mt-1">Diagnosed: {d.date_diagnosed}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'medications' && (
          <div className="divide-y divide-gray-50">
            {records.medications.map((m) => (
              <div key={m.id} className="px-6 py-4 hover:bg-sage-50/30 transition-colors">
                <p className="text-[13px] font-medium text-gray-800">{m.name}</p>
                <p className="text-[12px] text-gray-500 mt-1">
                  {m.dosage} &middot; {m.frequency}
                </p>
                <p className="text-[11px] text-gray-300 mt-1">
                  Prescribed by {m.prescriber} &middot; Started {m.start_date}
                </p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'allergies' && (
          <div className="divide-y divide-gray-50">
            {records.allergies.map((a) => (
              <div key={a.id} className="px-6 py-4 hover:bg-sage-50/30 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[13px] font-medium text-gray-800">{a.allergen}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                    a.severity === 'severe' ? 'bg-red-50 text-red-600' :
                    a.severity === 'moderate' ? 'bg-amber-50 text-amber-600' :
                    'bg-gray-50 text-gray-400'
                  }`}>
                    {a.severity}
                  </span>
                </div>
                <p className="text-[12px] text-gray-400">{a.reaction}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'labs' && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-[11px] font-semibold text-gray-300 uppercase tracking-wider px-6 py-3">Test</th>
                <th className="text-left text-[11px] font-semibold text-gray-300 uppercase tracking-wider px-6 py-3">Value</th>
                <th className="text-left text-[11px] font-semibold text-gray-300 uppercase tracking-wider px-6 py-3">Reference</th>
                <th className="text-left text-[11px] font-semibold text-gray-300 uppercase tracking-wider px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.lab_results.map((l) => (
                <tr key={l.id} className="hover:bg-sage-50/30 transition-colors">
                  <td className="px-6 py-3 text-[13px] text-gray-800">{l.test_name}</td>
                  <td className="px-6 py-3 text-[13px] font-medium text-gray-800">
                    {l.value} {l.unit}
                  </td>
                  <td className="px-6 py-3 text-[11px] text-gray-300">{l.reference_range}</td>
                  <td className="px-6 py-3 text-[11px] text-gray-300">
                    {new Date(l.date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'encounters' && (
          <div className="divide-y divide-gray-50">
            {records.encounters.map((e) => (
              <div key={e.id} className="px-6 py-4 hover:bg-sage-50/30 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-600 font-semibold">{e.type}</span>
                  <span className="text-[11px] text-gray-300">{new Date(e.date).toLocaleDateString()}</span>
                </div>
                <p className="text-[13px] font-medium text-gray-800 mb-1">{e.provider} — {e.location}</p>
                <p className="text-[12px] text-gray-400 leading-relaxed">{e.summary}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
