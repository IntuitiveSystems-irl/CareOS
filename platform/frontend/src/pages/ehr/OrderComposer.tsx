import { useState, useEffect, useRef } from 'react'
import { api, getClinicianSession } from '../../api'
import type { Organization, OrderDraft } from '../../types'
import { Send, Plus, AlertTriangle, CheckCircle2, Pill, FlaskConical, Stethoscope, ShieldCheck, ScanLine, Activity, Loader2 } from 'lucide-react'
import CdsCards from './CdsCards'

const ORDER_TYPES = [
  { value: 'medication', label: 'Medication', icon: Pill },
  { value: 'lab_order', label: 'Lab Order', icon: FlaskConical },
  { value: 'referral', label: 'Referral', icon: Stethoscope },
  { value: 'prior_auth', label: 'Prior Auth', icon: ShieldCheck },
  { value: 'imaging', label: 'Imaging', icon: ScanLine },
]

const PAYER_TYPES = ['commercial', 'medicare', 'medicaid', 'self_pay']

const inputClass = 'w-full bg-white/[0.06] text-white text-[13px] rounded-xl px-3.5 py-2.5 border border-white/[0.08] placeholder-white/20 focus:border-lime-400/40 focus:ring-1 focus:ring-lime-400/10 outline-none transition-all'
const labelClass = 'block text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-1.5'

export default function OrderComposer() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [created, setCreated] = useState<OrderDraft | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    patient_id: 1,
    organization_id: 1,
    order_type: 'medication',
    title: '',
    description: '',
    drug_name: '',
    drug_dosage: '',
    drug_frequency: '',
    drug_class: '',
    lab_test_code: '',
    lab_test_name: '',
    icd_codes: '',
    payer_type: 'commercial',
    created_by: 'Dr. Emily Chen',
  })

  const [cdsCards, setCdsCards] = useState<any[]>([])
  const [cdsLoading, setCdsLoading] = useState(false)
  const cdsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.getOrganizations().then(setOrgs).catch(() => {})
  }, [])

  const isMed = form.order_type === 'medication'
  const isLab = form.order_type === 'lab_order' || form.order_type === 'imaging'

  // Live CDS: fire the order-select hook (debounced) as the clinician drafts a med.
  const drugForCheck = (form.drug_name.trim() || form.title.trim())
  useEffect(() => {
    if (cdsTimer.current) clearTimeout(cdsTimer.current)
    if (!isMed || drugForCheck.length < 3) { setCdsCards([]); return }
    cdsTimer.current = setTimeout(async () => {
      setCdsLoading(true)
      try {
        const ctx = {
          patientId: String(form.patient_id),
          userId: getClinicianSession()?.clinician?.actor_name,
          careos_draft_meds: [{ id: 'draft-1', name: drugForCheck }],
        }
        const res = await api.cdsInvoke('careos-medication-safety', ctx, 'order-select')
        setCdsCards(res.cards || [])
      } catch {
        setCdsCards([])
      }
      setCdsLoading(false)
    }, 500)
    return () => { if (cdsTimer.current) clearTimeout(cdsTimer.current) }
  }, [drugForCheck, isMed, form.patient_id])

  async function handleCreate() {
    if (!form.title.trim()) { setError('Title is required'); return }
    setLoading(true)
    setError('')
    try {
      const body: Record<string, unknown> = { ...form }
      for (const k of Object.keys(body)) {
        if (body[k] === '') delete body[k]
      }
      const order = await api.createOrder(body)
      setCreated(order)
    } catch (e: any) {
      setError(e.message || 'Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  async function handleSendToPatient() {
    if (!created) return
    try {
      const updated = await api.sendOrderToPatient(created.id)
      setCreated(updated)
    } catch (e: any) {
      setError(e.message)
    }
  }

  function resetForm() {
    setCreated(null)
    setForm(f => ({ ...f, title: '', description: '', drug_name: '', drug_dosage: '', drug_frequency: '', drug_class: '', lab_test_code: '', lab_test_name: '', icd_codes: '' }))
  }

  return (
    <div className="max-w-2xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-white mb-1">Order Composer</h1>
        <p className="text-[15px] text-white/30 font-light">Create a draft order and send it to the patient for review</p>
      </div>

      {created ? (
        <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-7 space-y-5 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Order #{created.id} Created</h2>
              <p className="text-[12px] text-white/30">Ready to send for patient review</p>
            </div>
          </div>

          <div className="bg-white/[0.03] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/25 uppercase tracking-wider font-medium">Title</span>
              <span className="text-[13px] text-white font-medium">{created.title}</span>
            </div>
            <div className="border-t border-white/[0.04]" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/25 uppercase tracking-wider font-medium">Type</span>
              <span className="text-[13px] text-white capitalize">{created.order_type.replace('_', ' ')}</span>
            </div>
            <div className="border-t border-white/[0.04]" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/25 uppercase tracking-wider font-medium">Status</span>
              <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold ${
                created.status === 'awaiting_patient' ? 'bg-amber-500/20 text-amber-300' : 'bg-white/[0.06] text-white/50'
              }`}>{created.status.replace(/_/g, ' ')}</span>
            </div>
            <div className="border-t border-white/[0.04]" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/25 uppercase tracking-wider font-medium">PA Prediction</span>
              <div className="flex items-center gap-1.5">
                {created.prior_auth_likely === 'yes' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                <span className={`text-[12px] font-medium ${
                  created.prior_auth_likely === 'yes' ? 'text-amber-400'
                    : created.prior_auth_likely === 'no' ? 'text-emerald-400' : 'text-white/30'
                }`}>{created.prior_auth_likely === 'yes' ? 'PA Likely Required' : created.prior_auth_likely === 'no' ? 'PA Not Expected' : 'Unknown'}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            {created.status === 'drafted' && (
              <button onClick={handleSendToPatient}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all"
              style={{ backgroundColor: '#c4ff4d', color: '#111111' }}>
                <Send className="w-4 h-4" /> Send to Patient
              </button>
            )}
            <button onClick={resetForm}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-white/[0.06] text-white/50 rounded-xl text-[13px] font-medium hover:bg-white/[0.1] hover:text-white/70 transition-all">
              <Plus className="w-4 h-4" /> New Order
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-7 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-[13px] p-3.5 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {/* Order type pills */}
          <div>
            <label className={labelClass}>Order Type</label>
            <div className="flex gap-2 flex-wrap">
              {ORDER_TYPES.map(t => {
                const Icon = t.icon
                const active = form.order_type === t.value
                return (
                  <button key={t.value} onClick={() => setForm(f => ({ ...f, order_type: t.value }))}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all border ${
                      active
                        ? 'border-lime-400/20 text-white'
                        : 'bg-white/[0.03] border-white/[0.06] text-white/30 hover:text-white/50 hover:bg-white/[0.05]'
                    }`}
                    style={active ? { backgroundColor: 'rgba(196,255,77,0.12)' } : {}}>
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Organization</label>
              <select value={form.organization_id} onChange={e => setForm(f => ({ ...f, organization_id: Number(e.target.value) }))}
                className={inputClass}>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Ordering Clinician</label>
              <input value={form.created_by} onChange={e => setForm(f => ({ ...f, created_by: e.target.value }))}
                className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Order Title <span style={{ color: 'rgba(196,255,77,0.6)' }}>*</span></label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={isMed ? 'e.g. Lisinopril 10mg daily' : isLab ? 'e.g. CBC with Differential' : 'e.g. Cardiology referral'}
              className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Clinical Context</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              placeholder="Brief clinical reasoning for this order..."
              className={`${inputClass} resize-none`} />
          </div>

          {isMed && (
            <div className="bg-white/[0.02] rounded-xl border border-white/[0.04] p-5 space-y-4">
              <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(196,255,77,0.6)' }}>Medication Details</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Drug Name</label>
                  <input value={form.drug_name} onChange={e => setForm(f => ({ ...f, drug_name: e.target.value }))}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Dosage</label>
                  <input value={form.drug_dosage} onChange={e => setForm(f => ({ ...f, drug_dosage: e.target.value }))}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Frequency</label>
                  <input value={form.drug_frequency} onChange={e => setForm(f => ({ ...f, drug_frequency: e.target.value }))}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Drug Class</label>
                  <input value={form.drug_class} onChange={e => setForm(f => ({ ...f, drug_class: e.target.value }))}
                    placeholder="e.g. biologic, specialty"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Payer Type</label>
                  <select value={form.payer_type} onChange={e => setForm(f => ({ ...f, payer_type: e.target.value }))}
                    className={inputClass}>
                    {PAYER_TYPES.map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>ICD Codes</label>
                  <input value={form.icd_codes} onChange={e => setForm(f => ({ ...f, icd_codes: e.target.value }))}
                    placeholder="I10, E78.5"
                    className={inputClass} />
                </div>
              </div>
            </div>
          )}

          {isLab && (
            <div className="bg-white/[0.02] rounded-xl border border-white/[0.04] p-5 space-y-4">
              <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(196,255,77,0.6)' }}>Lab Details</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Test Code (LOINC)</label>
                  <input value={form.lab_test_code} onChange={e => setForm(f => ({ ...f, lab_test_code: e.target.value }))}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Test Name</label>
                  <input value={form.lab_test_name} onChange={e => setForm(f => ({ ...f, lab_test_name: e.target.value }))}
                    className={inputClass} />
                </div>
              </div>
            </div>
          )}

          {/* Live CDS Hooks (order-select) — relational safety + patient voice */}
          {isMed && drugForCheck.length >= 3 && (
            <div className="bg-white/[0.02] rounded-xl border border-white/[0.04] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <div className="text-[11px] font-bold text-emerald-300/80 uppercase tracking-wider">Decision Support · order-select</div>
                {cdsLoading && <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />}
              </div>
              {!cdsLoading && cdsCards.length === 0 ? (
                <div className="flex items-center gap-2 text-[12px] text-emerald-300/80">
                  <CheckCircle2 className="w-4 h-4" /> No conflicts or patient concerns for "{drugForCheck}".
                </div>
              ) : (
                <CdsCards cards={cdsCards} />
              )}
            </div>
          )}

          <button onClick={handleCreate} disabled={loading}
            className="w-full py-3 rounded-xl text-[13px] font-semibold disabled:opacity-40 transition-all active:scale-[0.99]"
            style={{ backgroundColor: '#c4ff4d', color: '#111111' }}>
            {loading ? 'Creating...' : 'Create Draft Order'}
          </button>
        </div>
      )}
    </div>
  )
}
