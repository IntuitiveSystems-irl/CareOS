import { useState, useEffect } from 'react'
import { api } from '../../api'
import type { OrderDraft } from '../../types'
import {
  ShieldCheck, AlertTriangle, CheckCircle2, MessageSquare,
  XCircle, Pill, FlaskConical, FileText, Clock, Stethoscope, ChevronRight, ClipboardList,
} from 'lucide-react'

const typeIcons: Record<string, typeof Pill> = {
  medication: Pill,
  lab_order: FlaskConical,
  referral: Stethoscope,
  prior_auth: ShieldCheck,
  imaging: FlaskConical,
}

const statusStyles: Record<string, string> = {
  drafted: 'bg-gray-100 text-gray-500',
  awaiting_patient: 'bg-teal-50 text-teal-700 border border-teal-100',
  patient_approved: 'bg-emerald-50 text-emerald-700',
  patient_requested_change: 'bg-amber-50 text-amber-700',
  ready_to_submit: 'bg-blue-50 text-blue-700',
  submitted: 'bg-violet-50 text-violet-700',
  fulfilled: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-600',
  cancelled: 'bg-gray-100 text-gray-400',
}

export default function OrderReview() {
  const patientId = 1
  const [pending, setPending] = useState<OrderDraft[]>([])
  const [allOrders, setAllOrders] = useState<OrderDraft[]>([])
  const [selected, setSelected] = useState<OrderDraft | null>(null)
  const [tab, setTab] = useState<'pending' | 'all'>('pending')
  const [loading, setLoading] = useState(true)

  const [allowGeneric, setAllowGeneric] = useState(true)
  const [maxOop, setMaxOop] = useState('')
  const [callbackRequired, setCallbackRequired] = useState(false)
  const [comment, setComment] = useState('')
  const [actionType, setActionType] = useState<'approve' | 'approve_with_limits' | 'request_change' | 'reject'>('approve')

  async function refresh() {
    setLoading(true)
    try {
      const [p, a] = await Promise.all([
        api.patientPendingOrders(patientId),
        api.patientAllOrders(patientId),
      ])
      setPending(p)
      setAllOrders(a)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  function selectOrder(order: OrderDraft) {
    setSelected(order)
    setComment('')
    setMaxOop('')
    setAllowGeneric(true)
    setCallbackRequired(false)
    setActionType('approve')
  }

  async function handleAction() {
    if (!selected) return
    const body: Record<string, unknown> = { action_type: actionType }

    if (actionType === 'approve_with_limits') {
      body.allow_generic_substitution = allowGeneric
      if (maxOop) body.max_out_of_pocket = parseFloat(maxOop)
      body.require_callback_before_changes = callbackRequired
    }
    if (comment.trim()) body.comment = comment.trim()

    try {
      await api.patientAction(selected.id, body)
      setSelected(null)
      refresh()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const displayOrders = tab === 'pending' ? pending : allOrders

  return (
    <div className="max-w-6xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-900 mb-1">Order Review</h1>
        <p className="text-[15px] text-gray-400 font-light">Review proposed orders and set your preferences before approval</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-sage-50 p-1 rounded-xl w-fit mb-8">
        <button onClick={() => setTab('pending')}
          className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-all ${
            tab === 'pending' ? 'bg-white shadow-soft text-gray-900' : 'text-gray-400 hover:text-gray-600'
          }`}>
          Needs Review ({pending.length})
        </button>
        <button onClick={() => setTab('all')}
          className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-all ${
            tab === 'all' ? 'bg-white shadow-soft text-gray-900' : 'text-gray-400 hover:text-gray-600'
          }`}>
          All Orders ({allOrders.length})
        </button>
      </div>

      <div className="flex gap-7">
        {/* Order list */}
        <div className="w-[380px] flex-shrink-0 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
            </div>
          )}
          {!loading && displayOrders.length === 0 && (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-sage-50 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-sage-300" />
              </div>
              <p className="text-[14px] text-gray-500 font-medium">
                {tab === 'pending' ? 'All caught up' : 'No orders yet'}
              </p>
              <p className="text-[12px] text-gray-300 mt-1">
                {tab === 'pending' ? 'No orders need your review right now' : 'Orders will appear here when created'}
              </p>
            </div>
          )}
          {displayOrders.map(order => {
            const Icon = typeIcons[order.order_type] || FileText
            const isSelected = selected?.id === order.id
            const isPending = order.status === 'awaiting_patient'
            return (
              <button key={order.id} onClick={() => selectOrder(order)}
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${
                  isSelected
                    ? 'border-teal-300/60 bg-teal-50/40 shadow-soft'
                    : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-soft'
                }`}>
                <div className="flex items-start gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-teal-100/80' : isPending ? 'bg-teal-50' : 'bg-gray-50'
                  }`}>
                    <Icon className={`w-[17px] h-[17px] ${isSelected ? 'text-teal-600' : isPending ? 'text-teal-500' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-gray-900 truncate">{order.title}</span>
                      <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-teal-400' : 'text-gray-200'}`} />
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${statusStyles[order.status] || ''}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-gray-300">
                        {order.organization?.name || 'Clinic'}
                      </span>
                    </div>
                    {order.prior_auth_likely === 'yes' && (
                      <div className="flex items-center gap-1.5 mt-2 text-amber-500 text-[11px] font-medium">
                        <AlertTriangle className="w-3 h-3" /> Prior auth may be needed
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail + action panel */}
        {selected ? (
          <div className="flex-1 animate-fade-in">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft overflow-hidden">
              {/* Header */}
              <div className="px-7 py-6 border-b border-gray-50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide ${statusStyles[selected.status] || ''}`}>
                        {selected.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-gray-300 capitalize">{selected.order_type.replace('_', ' ')}</span>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 tracking-tight">{selected.title}</h2>
                    <p className="text-[13px] text-gray-400 mt-1 leading-relaxed">{selected.description || 'No additional context provided by your care team.'}</p>
                  </div>
                </div>
              </div>

              {/* Order details */}
              <div className="px-7 py-5">
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  {selected.drug_name && (
                    <div>
                      <div className="text-[11px] text-gray-300 uppercase tracking-wide font-medium mb-0.5">Medication</div>
                      <div className="text-[13px] text-gray-800 font-medium">{selected.drug_name} {selected.drug_dosage}</div>
                    </div>
                  )}
                  {selected.drug_frequency && (
                    <div>
                      <div className="text-[11px] text-gray-300 uppercase tracking-wide font-medium mb-0.5">Frequency</div>
                      <div className="text-[13px] text-gray-800 font-medium">{selected.drug_frequency}</div>
                    </div>
                  )}
                  {selected.lab_test_name && (
                    <div>
                      <div className="text-[11px] text-gray-300 uppercase tracking-wide font-medium mb-0.5">Test</div>
                      <div className="text-[13px] text-gray-800 font-medium">{selected.lab_test_name}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-[11px] text-gray-300 uppercase tracking-wide font-medium mb-0.5">Ordered by</div>
                    <div className="text-[13px] text-gray-800 font-medium">{selected.created_by || 'Staff'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-300 uppercase tracking-wide font-medium mb-0.5">Date</div>
                    <div className="text-[13px] text-gray-800 font-medium">{new Date(selected.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>

              {selected.prior_auth_likely === 'yes' && (
                <div className="mx-7 mb-5 bg-amber-50/60 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-amber-800">Prior Authorization May Be Required</div>
                    <div className="text-[12px] text-amber-600/80 mt-0.5 leading-relaxed">
                      Based on the medication type and your insurance, this may need prior authorization. Your care team will handle the paperwork.
                    </div>
                  </div>
                </div>
              )}

              {/* Action section */}
              {selected.status === 'awaiting_patient' ? (
                <div className="border-t border-gray-50 px-7 py-6 bg-warm-50/30">
                  <h3 className="text-[13px] font-semibold text-gray-700 mb-4">How would you like to proceed?</h3>

                  {/* Action type selector */}
                  <div className="grid grid-cols-2 gap-2.5 mb-5">
                    {([
                      { val: 'approve' as const, label: 'Approve', desc: 'Looks good as-is', icon: CheckCircle2, bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', activeBg: 'bg-emerald-100 border-emerald-300 text-emerald-800 shadow-soft' },
                      { val: 'approve_with_limits' as const, label: 'Approve with Limits', desc: 'Set your preferences', icon: ShieldCheck, bg: 'bg-teal-50 border-teal-200 text-teal-700', activeBg: 'bg-teal-100 border-teal-300 text-teal-800 shadow-soft' },
                      { val: 'request_change' as const, label: 'Request Change', desc: 'Ask your care team', icon: MessageSquare, bg: 'bg-amber-50 border-amber-200 text-amber-700', activeBg: 'bg-amber-100 border-amber-300 text-amber-800 shadow-soft' },
                      { val: 'reject' as const, label: 'Decline', desc: 'Not right for me', icon: XCircle, bg: 'bg-gray-50 border-gray-200 text-gray-500', activeBg: 'bg-red-50 border-red-200 text-red-700 shadow-soft' },
                    ]).map(opt => (
                      <button key={opt.val} onClick={() => setActionType(opt.val)}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 ${
                          actionType === opt.val ? opt.activeBg : `${opt.bg} hover:shadow-soft opacity-70 hover:opacity-100`
                        }`}>
                        <opt.icon className="w-5 h-5 flex-shrink-0" />
                        <div>
                          <div className="text-[13px] font-semibold">{opt.label}</div>
                          <div className="text-[11px] opacity-70">{opt.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Approve-with-limits */}
                  {actionType === 'approve_with_limits' && (
                    <div className="bg-white rounded-xl border border-teal-100 p-5 mb-5 space-y-4 animate-slide-up">
                      <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">Your Preferences</div>
                      <label className="flex items-center gap-3 text-[13px] text-gray-700 cursor-pointer p-2 -m-2 rounded-lg hover:bg-teal-50/50 transition-colors">
                        <input type="checkbox" checked={allowGeneric} onChange={e => setAllowGeneric(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                        OK to substitute with a generic version
                      </label>
                      <div>
                        <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Maximum out-of-pocket cost</label>
                        <div className="relative mt-1.5">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 text-sm">$</span>
                          <input type="number" value={maxOop} onChange={e => setMaxOop(e.target.value)}
                            placeholder="50"
                            className="w-full rounded-xl border border-gray-200 pl-8 pr-3 py-2.5 text-[13px] focus:border-teal-300 focus:ring-1 focus:ring-teal-200 outline-none" />
                        </div>
                      </div>
                      <label className="flex items-center gap-3 text-[13px] text-gray-700 cursor-pointer p-2 -m-2 rounded-lg hover:bg-teal-50/50 transition-colors">
                        <input type="checkbox" checked={callbackRequired} onChange={e => setCallbackRequired(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                        Call me before making any changes
                      </label>
                    </div>
                  )}

                  {/* Comment */}
                  {(actionType === 'request_change' || actionType === 'reject' || actionType === 'approve_with_limits') && (
                    <div className="mb-5 animate-slide-up">
                      <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">
                        {actionType === 'request_change' ? 'What would you like changed?' : 'Additional notes (optional)'}
                      </label>
                      <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                        placeholder={actionType === 'request_change' ? 'Describe the changes you need...' : 'Any additional thoughts...'}
                        className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-[13px] placeholder-gray-300 focus:border-teal-300 focus:ring-1 focus:ring-teal-200 outline-none resize-none" />
                    </div>
                  )}

                  <button onClick={handleAction}
                    className={`w-full py-3 rounded-xl text-[13px] font-semibold text-white shadow-soft transition-all hover:shadow-soft-lg active:scale-[0.99] ${
                      actionType === 'approve' || actionType === 'approve_with_limits'
                        ? 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500'
                        : actionType === 'request_change'
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500'
                          : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500'
                    }`}>
                    {actionType === 'approve' ? 'Approve This Order'
                      : actionType === 'approve_with_limits' ? 'Approve with My Preferences'
                        : actionType === 'request_change' ? 'Send Change Request'
                          : 'Decline This Order'}
                  </button>
                </div>
              ) : (
                <div className="border-t border-gray-50 px-7 py-5">
                  <div className="flex items-center gap-2.5 mb-3">
                    <Clock className="w-4 h-4 text-gray-300" />
                    <span className="text-[13px] text-gray-500">Current status:</span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold ${statusStyles[selected.status] || ''}`}>
                      {selected.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {selected.actions.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <div className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Your Responses</div>
                      {selected.actions.map(a => (
                        <div key={a.id} className="bg-sage-50/50 rounded-xl p-3.5">
                          <span className="text-[13px] font-medium text-gray-700 capitalize">{a.action_type.replace(/_/g, ' ')}</span>
                          {a.comment && <p className="text-[12px] text-gray-500 mt-1">{a.comment}</p>}
                          <p className="text-[11px] text-gray-300 mt-1.5">{new Date(a.created_at).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-sage-50 flex items-center justify-center mb-4">
              <ClipboardList className="w-7 h-7 text-sage-300" />
            </div>
            <p className="text-[14px] text-gray-400 font-medium">Select an order to review</p>
            <p className="text-[12px] text-gray-300 mt-1">Click on any order from the list</p>
          </div>
        )}
      </div>
    </div>
  )
}
