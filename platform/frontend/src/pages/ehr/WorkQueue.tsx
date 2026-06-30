import { useState, useEffect } from 'react'
import { api } from '../../api'
import type { OrderDraft } from '../../types'
import { Clock, CheckCircle2, AlertTriangle, XCircle, ArrowRight, RefreshCw, Send, ListChecks, Pill, FlaskConical, Stethoscope, ShieldCheck } from 'lucide-react'

const STATUS_BUCKETS = [
  { key: 'patient_approved', label: 'Patient Approved', dotColor: 'bg-emerald-400', icon: CheckCircle2 },
  { key: 'ready_to_submit', label: 'Ready to Submit', dotColor: 'bg-sky-400', icon: ArrowRight },
  { key: 'awaiting_patient', label: 'Awaiting Patient', dotColor: 'bg-amber-400', icon: Clock },
  { key: 'patient_requested_change', label: 'Change Requested', dotColor: 'bg-orange-400', icon: AlertTriangle },
  { key: 'submitted', label: 'Submitted', dotColor: 'bg-violet-400', icon: Send },
  { key: 'drafted', label: 'Drafts', dotColor: 'bg-white/20', icon: Clock },
  { key: 'failed', label: 'Failed', dotColor: 'bg-red-400', icon: XCircle },
] as const

const statusBadge: Record<string, string> = {
  drafted: 'bg-white/[0.06] text-white/40',
  awaiting_patient: 'bg-amber-500/15 text-amber-300',
  patient_approved: 'bg-emerald-500/15 text-emerald-300',
  patient_requested_change: 'bg-orange-500/15 text-orange-300',
  ready_to_submit: 'bg-sky-500/15 text-sky-300',
  submitted: 'bg-violet-500/15 text-violet-300',
  fulfilled: 'bg-emerald-500/15 text-emerald-300',
  failed: 'bg-red-500/15 text-red-300',
  cancelled: 'bg-white/[0.04] text-white/20',
}

const typeIcons: Record<string, typeof Pill> = {
  medication: Pill,
  lab_order: FlaskConical,
  referral: Stethoscope,
  prior_auth: ShieldCheck,
  imaging: FlaskConical,
}

export default function WorkQueue() {
  const [orders, setOrders] = useState<OrderDraft[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      const data = await api.getStaffQueue()
      setOrders(data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  function bucketOrders(status: string) {
    return orders.filter(o => o.status === status)
  }

  async function handleTransition(orderId: number, newStatus: string) {
    try {
      await api.transitionOrder(orderId, newStatus)
      refresh()
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-white mb-1">Work Queue</h1>
          <p className="text-[15px] text-white/30 font-light">{orders.length} active order{orders.length !== 1 ? 's' : ''} across all statuses</p>
        </div>
        <button onClick={refresh}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.06] text-white/50 rounded-xl text-[12px] font-medium hover:bg-white/[0.1] hover:text-white/70 border border-white/[0.06] transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="space-y-8">
        {STATUS_BUCKETS.map(bucket => {
          const items = bucketOrders(bucket.key)
          if (items.length === 0) return null
          return (
            <div key={bucket.key} className="animate-slide-up">
              <div className="flex items-center gap-2.5 mb-3">
                <span className={`w-2 h-2 rounded-full ${bucket.dotColor}`} />
                <h2 className="text-[12px] font-bold text-white/40 uppercase tracking-wider">
                  {bucket.label}
                </h2>
                <span className="bg-white/[0.06] text-white/30 text-[11px] font-semibold px-2 py-0.5 rounded-lg">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(order => {
                  const TypeIcon = typeIcons[order.order_type] || Pill
                  return (
                    <div key={order.id} className="bg-white/[0.04] backdrop-blur-sm rounded-xl border border-white/[0.06] p-4 flex items-center justify-between hover:bg-white/[0.06] transition-all group">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                          <TypeIcon className="w-4 h-4 text-white/30" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[13px] text-white font-medium truncate">{order.title}</span>
                            {order.prior_auth_likely === 'yes' && (
                              <span className="flex items-center gap-1 text-amber-400 text-[11px] font-medium flex-shrink-0">
                                <AlertTriangle className="w-3 h-3" /> PA
                              </span>
                            )}
                            {order.patient_constraints && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: 'rgba(196,255,77,0.7)', backgroundColor: 'rgba(196,255,77,0.1)' }}>Constraints</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[11px] text-white/20 font-mono">#{order.id}</span>
                            <span className="text-[11px] text-white/20 capitalize">{order.order_type.replace('_', ' ')}</span>
                            <span className="text-[11px] text-white/20">{order.organization?.name || ''}</span>
                            <span className="text-[11px] text-white/15">{order.created_by || 'Staff'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        {order.status === 'patient_approved' && (
                          <button onClick={() => handleTransition(order.id, 'ready_to_submit')}
                            className="px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all"
                            style={{ backgroundColor: 'rgba(196,255,77,0.15)', color: 'rgba(196,255,77,0.9)', border: '1px solid rgba(196,255,77,0.2)' }}>
                            Mark Ready
                          </button>
                        )}
                        {order.status === 'ready_to_submit' && (
                          <button onClick={() => handleTransition(order.id, 'submitted')}
                            className="px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all"
                            style={{ backgroundColor: '#c4ff4d', color: '#111111' }}>
                            Submit Order
                          </button>
                        )}
                        {order.status === 'submitted' && (
                          <>
                            <button onClick={() => handleTransition(order.id, 'fulfilled')}
                              className="px-3.5 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg text-[11px] font-semibold hover:bg-emerald-500/30 border border-emerald-500/20 transition-all">
                              Fulfilled
                            </button>
                            <button onClick={() => handleTransition(order.id, 'failed')}
                              className="px-3.5 py-2 bg-red-500/10 text-red-300/60 rounded-lg text-[11px] font-medium hover:bg-red-500/20 border border-red-500/10 transition-all">
                              Failed
                            </button>
                          </>
                        )}
                        {order.status === 'patient_requested_change' && (
                          <div className="text-[11px] text-orange-300/70 max-w-[220px] truncate italic">
                            {order.actions?.find(a => a.action_type === 'request_change')?.comment || 'Patient requested changes'}
                          </div>
                        )}
                        {order.status === 'drafted' && (
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold ${statusBadge[order.status]}`}>Draft</span>
                        )}
                        {order.status === 'awaiting_patient' && (
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold ${statusBadge[order.status]}`}>Waiting</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {orders.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
              <ListChecks className="w-7 h-7 text-white/15" />
            </div>
            <p className="text-[14px] text-white/30 font-medium">No active orders</p>
            <p className="text-[12px] text-white/15 mt-1">Create one from the Order Composer</p>
          </div>
        )}
      </div>
    </div>
  )
}
