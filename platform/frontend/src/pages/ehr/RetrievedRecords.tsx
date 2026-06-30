import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, AlertCircle } from 'lucide-react'
import { api } from '../../api'

interface FhirData {
  patient: any | null
  conditions: any | null
  medications: any | null
  allergies: any | null
  observations: any | null
  encounters: any | null
}

export default function RetrievedRecords() {
  const [searchParams] = useSearchParams()
  const patientId = Number(searchParams.get('patient_id') || 1)
  const orgId = Number(searchParams.get('org_id') || 1)
  const [data, setData] = useState<FhirData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('patient')

  const fetchRecords = async () => {
    setLoading(true)
    setError(null)
    try {
      const [patient, conditions, medications, allergies, observations, encounters] = await Promise.all([
        api.getFhirPatient(patientId, orgId),
        api.getFhirConditions(patientId, orgId),
        api.getFhirMedications(patientId, orgId),
        api.getFhirAllergies(patientId, orgId),
        api.getFhirObservations(patientId, orgId),
        api.getFhirEncounters(patientId, orgId),
      ])
      setData({ patient, conditions, medications, allergies, observations, encounters })
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchRecords()
  }, [patientId, orgId])

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-white mb-1">Retrieved Patient Records</h1>
        <p className="text-[15px] text-white/30 font-light">
          FHIR data imported into EHR — Patient #{patientId}, Organization #{orgId}
        </p>
      </div>

      {error && (
        <div className="mb-6 px-5 py-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-red-300">Unable to retrieve records</p>
            <p className="text-[12px] text-red-300/60 mt-1">{error}</p>
            <p className="text-[11px] text-red-300/40 mt-2">
              Ensure the access request is approved and the access fee has been paid.
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-8">
          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(196,255,77,0.2)', borderTopColor: '#c4ff4d' }} />
          <p className="text-[13px] text-white/30">Retrieving FHIR resources...</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Success banner */}
          <div className="mb-6 px-5 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
            <Download className="w-5 h-5 text-emerald-400" />
            <p className="text-[13px] font-medium text-emerald-300">
              Records successfully retrieved and imported into EHR
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-white/[0.04] rounded-xl p-1 w-fit">
            {[
              { key: 'patient', label: 'Patient' },
              { key: 'conditions', label: `Conditions (${data.conditions?.total || 0})` },
              { key: 'medications', label: `Medications (${data.medications?.total || 0})` },
              { key: 'allergies', label: `Allergies (${data.allergies?.total || 0})` },
              { key: 'observations', label: `Labs (${data.observations?.total || 0})` },
              { key: 'encounters', label: `Encounters (${data.encounters?.total || 0})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-[12px] font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-white/[0.1] text-white shadow-glow/10'
                    : 'text-white/30 hover:text-white/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/[0.06] overflow-hidden">
            {/* FHIR Resource Header */}
            <div className="px-5 py-3 bg-white/[0.02] border-b border-white/[0.06] flex items-center gap-2">
              <span className="text-[11px] font-mono text-navy-300/60">FHIR R4</span>
              <span className="text-[11px] text-white/10">&middot;</span>
              <span className="text-[11px] text-white/20">
                {activeTab === 'patient' ? 'Patient' : `Bundle (${activeTab})`}
              </span>
            </div>

            {activeTab === 'patient' && data.patient && (
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] text-white/20 uppercase tracking-wider font-medium mb-1">Name</p>
                    <p className="text-[13px] font-medium text-white">
                      {data.patient.name?.[0]?.given?.join(' ')} {data.patient.name?.[0]?.family}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-white/20 uppercase tracking-wider font-medium mb-1">Gender</p>
                    <p className="text-[13px] text-white/70">{data.patient.gender}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-white/20 uppercase tracking-wider font-medium mb-1">Date of Birth</p>
                    <p className="text-[13px] text-white/70">{data.patient.birthDate}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-white/20 uppercase tracking-wider font-medium mb-1">Contact</p>
                    <p className="text-[13px] text-white/70">
                      {data.patient.telecom?.filter(Boolean).map((t: any) => t.value).join(', ')}
                    </p>
                  </div>
                </div>
                {/* Raw FHIR JSON */}
                <div className="mt-5 pt-5 border-t border-white/[0.06]">
                  <p className="text-[11px] font-semibold text-white/20 uppercase tracking-wider mb-2">Raw FHIR Resource</p>
                  <pre className="text-[11px] bg-white/[0.03] rounded-xl p-4 overflow-auto max-h-60 text-white/40 font-mono">
                    {JSON.stringify(data.patient, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'conditions' && data.conditions && (
              <div className="divide-y divide-white/[0.04]">
                {data.conditions.entry?.map((e: any, i: number) => (
                  <div key={i} className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono bg-white/[0.06] px-2 py-0.5 rounded-md text-white/30">
                        {e.resource.code?.coding?.[0]?.code}
                      </span>
                    </div>
                    <p className="text-[13px] font-medium text-white">
                      {e.resource.code?.coding?.[0]?.display}
                    </p>
                    {e.resource.onsetDateTime && (
                      <p className="text-[11px] text-white/20 mt-1">Onset: {e.resource.onsetDateTime}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'medications' && data.medications && (
              <div className="divide-y divide-white/[0.04]">
                {data.medications.entry?.map((e: any, i: number) => (
                  <div key={i} className="px-6 py-4">
                    <p className="text-[13px] font-medium text-white">
                      {e.resource.medicationCodeableConcept?.text}
                    </p>
                    <p className="text-[12px] text-white/30 mt-1">
                      {e.resource.dosageInstruction?.[0]?.text}
                    </p>
                    {e.resource.requester && (
                      <p className="text-[11px] text-white/20 mt-1">
                        Prescribed by {e.resource.requester.display}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'allergies' && data.allergies && (
              <div className="divide-y divide-white/[0.04]">
                {data.allergies.entry?.map((e: any, i: number) => (
                  <div key={i} className="px-6 py-4">
                    <p className="text-[13px] font-medium text-white">{e.resource.code?.text}</p>
                    {e.resource.reaction?.[0] && (
                      <p className="text-[12px] text-white/30 mt-1">
                        Reaction: {e.resource.reaction[0].manifestation?.[0]?.text}
                      </p>
                    )}
                    <p className="text-[11px] text-white/20 mt-1">
                      Criticality: {e.resource.criticality}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'observations' && data.observations && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-[11px] font-semibold text-white/20 uppercase tracking-wider px-6 py-3">Test</th>
                    <th className="text-left text-[11px] font-semibold text-white/20 uppercase tracking-wider px-6 py-3">Value</th>
                    <th className="text-left text-[11px] font-semibold text-white/20 uppercase tracking-wider px-6 py-3">Reference</th>
                    <th className="text-left text-[11px] font-semibold text-white/20 uppercase tracking-wider px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {data.observations.entry?.map((e: any, i: number) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3 text-[13px] text-white">{e.resource.code?.text}</td>
                      <td className="px-6 py-3 text-[13px] font-medium text-white">
                        {e.resource.valueQuantity?.value} {e.resource.valueQuantity?.unit}
                      </td>
                      <td className="px-6 py-3 text-[11px] text-white/20">
                        {e.resource.referenceRange?.[0]?.text}
                      </td>
                      <td className="px-6 py-3 text-[11px] text-white/20">
                        {e.resource.effectiveDateTime ? new Date(e.resource.effectiveDateTime).toLocaleDateString() : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'encounters' && data.encounters && (
              <div className="divide-y divide-white/[0.04]">
                {data.encounters.entry?.map((e: any, i: number) => (
                  <div key={i} className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      {e.resource.type?.[0] && (
                        <span className="text-[10px] px-2 py-0.5 rounded-lg font-semibold" style={{ backgroundColor: 'rgba(77,128,255,0.15)', color: 'rgba(160,188,255,0.9)' }}>
                          {e.resource.type[0].text}
                        </span>
                      )}
                      <span className="text-[11px] text-white/15">
                        {e.resource.period?.start ? new Date(e.resource.period.start).toLocaleDateString() : ''}
                      </span>
                    </div>
                    {e.resource.participant?.[0] && (
                      <p className="text-[13px] font-medium text-white">
                        {e.resource.participant[0].individual?.display}
                      </p>
                    )}
                    {e.resource.location?.[0] && (
                      <p className="text-[12px] text-white/30 mt-0.5">
                        {e.resource.location[0].location?.display}
                      </p>
                    )}
                    {e.resource.reasonCode?.[0] && (
                      <p className="text-[12px] text-white/25 mt-1 leading-relaxed">
                        {e.resource.reasonCode[0].text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
