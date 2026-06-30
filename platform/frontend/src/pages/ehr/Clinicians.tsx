import { useEffect, useMemo, useState } from 'react'
import {
  Plus, X, Loader2, Search, Stethoscope, Shield, Trash2,
  AlertTriangle, CheckCircle2, BadgeCheck, Building2,
} from 'lucide-react'
import { api } from '../../api'

const ROLE_LABELS: Record<string, string> = {
  physician: 'Physician',
  nurse: 'Nurse',
  physician_assistant: 'PA / NP',
  pharmacist: 'Pharmacist',
  care_coordinator: 'Care Coordinator',
  front_desk: 'Front Desk',
  admin: 'Administrator',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  inactive: 'bg-white/[0.06] text-white/40 border-white/[0.10]',
  suspended: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const EMPTY_FORM = {
  first_name: '', last_name: '', email: '', npi: '', credential: '',
  specialty: '', role: 'physician', organization_id: '', password: '',
}

export default function Clinicians() {
  const [rows, setRows] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [statuses, setStatuses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (q) params.q = q
      if (roleFilter) params.role = roleFilter
      const [list, orgList] = await Promise.all([
        api.getClinicians(params),
        api.getOrganizations(),
      ])
      setRows(list)
      setOrgs(orgList)
    } catch (e: any) {
      setBanner({ kind: 'err', text: e.message || 'Failed to load clinicians' })
    }
    setLoading(false)
  }

  useEffect(() => {
    api.getClinicianRoles().then((r) => {
      setRoles(r.roles || [])
      setStatuses(r.statuses || [])
    }).catch(() => {})
  }, [])

  useEffect(() => { load() /* eslint-disable-next-line */ }, [q, roleFilter])

  const orgName = (id: number | null) => orgs.find((o) => o.id === id)?.name || '—'

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setBanner({ kind: 'err', text: 'First name, last name, and email are required.' })
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, any> = { ...form }
      payload.organization_id = form.organization_id ? Number(form.organization_id) : null
      if (!payload.password) delete payload.password
      await api.createClinician(payload)
      setForm({ ...EMPTY_FORM })
      setShowForm(false)
      setBanner({ kind: 'ok', text: 'Clinician registered.' })
      load()
    } catch (e: any) {
      setBanner({ kind: 'err', text: e.message || 'Failed to register clinician' })
    }
    setSaving(false)
  }

  const changeRole = async (id: number, role: string) => {
    try { await api.updateClinician(id, { role }); load() }
    catch (e: any) { setBanner({ kind: 'err', text: e.message }) }
  }
  const changeStatus = async (id: number, status: string) => {
    try { await api.updateClinician(id, { status }); load() }
    catch (e: any) { setBanner({ kind: 'err', text: e.message }) }
  }
  const remove = async (id: number, name: string) => {
    if (!window.confirm(`Remove ${name}? This cannot be undone.`)) return
    try { await api.deleteClinician(id); setBanner({ kind: 'ok', text: 'Clinician removed.' }); load() }
    catch (e: any) { setBanner({ kind: 'err', text: e.message }) }
  }

  const counts = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    physicians: rows.filter((r) => r.role === 'physician').length,
  }), [rows])

  return (
    <div className="max-w-5xl animate-fade-in">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-white mb-1">Clinician Management</h1>
          <p className="text-[15px] text-white/40 font-light">Staff registry, roles, and the <span className="font-mono text-emerald-400">clinician.&lt;npi&gt;</span> audit identity</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/15 border border-emerald-500/25 rounded-xl text-[13px] font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-all"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Clinician'}
        </button>
      </div>

      {banner && (
        <div className={`mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-[13px] ${
          banner.kind === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border-red-500/20 text-red-300'
        }`}>
          <span className="flex items-center gap-2">
            {banner.kind === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {banner.text}
          </span>
          <button onClick={() => setBanner(null)}><X className="w-4 h-4 opacity-60 hover:opacity-100" /></button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Staff', value: counts.total, icon: Stethoscope },
          { label: 'Active', value: counts.active, icon: BadgeCheck },
          { label: 'Physicians', value: counts.physicians, icon: Shield },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(196,255,77,0.1)' }}>
                <s.icon className="w-4 h-4" style={{ color: 'rgba(196,255,77,0.7)' }} />
              </div>
              <div>
                <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">{s.label}</p>
                <p className="text-[24px] font-bold text-white">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={submitForm} className="mb-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name *"><input className={inputCls} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
            <Field label="Last name *"><input className={inputCls} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
            <Field label="Email *"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@clinic.org" /></Field>
            <Field label="NPI"><input className={inputCls} value={form.npi} onChange={(e) => setForm({ ...form, npi: e.target.value })} placeholder="10-digit NPI" /></Field>
            <Field label="Credential"><input className={inputCls} value={form.credential} onChange={(e) => setForm({ ...form, credential: e.target.value })} placeholder="MD, RN, NP…" /></Field>
            <Field label="Specialty"><input className={inputCls} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Internal Medicine" /></Field>
            <Field label="Role">
              <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roles.map((r) => <option key={r} value={r} className="bg-black">{ROLE_LABELS[r] || r}</option>)}
              </select>
            </Field>
            <Field label="Organization">
              <select className={inputCls} value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: e.target.value })}>
                <option value="" className="bg-black">— none —</option>
                {orgs.map((o) => <option key={o.id} value={o.id} className="bg-black">{o.name}</option>)}
              </select>
            </Field>
            <Field label="Login password (optional)"><input type="password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="enables staff sign-in" /></Field>
          </div>
          <div className="mt-5">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all disabled:opacity-50" style={{ backgroundColor: '#c4ff4d', color: '#111111' }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Register clinician
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, NPI…"
            className="bg-transparent text-[13px] text-white placeholder-white/25 outline-none flex-1"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[13px] text-white outline-none"
        >
          <option value="" className="bg-black">All roles</option>
          {roles.map((r) => <option key={r} value={r} className="bg-black">{ROLE_LABELS[r] || r}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#c4ff4d' }} /></div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
                <th className="px-5 py-3 font-semibold">Clinician</th>
                <th className="px-3 py-3 font-semibold">NPI</th>
                <th className="px-3 py-3 font-semibold">Organization</th>
                <th className="px-3 py-3 font-semibold">Role</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <div className="text-[13px] font-semibold text-white">{c.first_name} {c.last_name}{c.credential ? `, ${c.credential}` : ''}</div>
                    <div className="text-[11px] text-white/40">{c.email}{c.specialty ? ` · ${c.specialty}` : ''}</div>
                    <div className="text-[10px] text-emerald-400/70 font-mono mt-0.5">{c.actor_name}</div>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-white/50 font-mono">{c.npi || '—'}</td>
                  <td className="px-3 py-3 text-[12px] text-white/50">
                    <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3 text-white/30" />{orgName(c.organization_id)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={c.role}
                      onChange={(e) => changeRole(c.id, e.target.value)}
                      className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-[12px] text-white outline-none"
                    >
                      {roles.map((r) => <option key={r} value={r} className="bg-black">{ROLE_LABELS[r] || r}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={c.status}
                      onChange={(e) => changeStatus(c.id, e.target.value)}
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold border outline-none ${STATUS_STYLES[c.status] || ''}`}
                    >
                      {statuses.map((s) => <option key={s} value={s} className="bg-black text-white">{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button onClick={() => remove(c.id, `${c.first_name} ${c.last_name}`)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-white/30 text-[13px]">No clinicians found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white placeholder-white/20 focus:border-emerald-500/40 outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}
