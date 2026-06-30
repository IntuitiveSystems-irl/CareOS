import { useState, useEffect } from 'react'
import { api } from '../../api'
import type { OrderDraft, OrderTimeline } from '../../types'
import { Clock, CheckCircle2, AlertTriangle, ArrowRight, Search, BarChart3, Pill, FlaskConical, Stethoscope, ShieldCheck, Send, XCircle } from 'lucide-react'

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

const actionDotColor: Record<string, string> = {
  order_created: 'bg-emerald-400',
  order_sent_to_patient: 'bg-sky-400',
  patient_approved: 'bg-emerald-400',
  patient_approved_with_limits: 'bg-teal-400',
  patient_requested_change: 'bg-amber-400',
  patient_rejected: 'bg-red-400',
  order_transition: 'bg-violet-400',
  order_updated: 'bg-white/30',
}

const typeIcons: Record<string, typeof Pill> = {
  medication: Pill,
  lab_order: FlaskConical,
  referral: Stethoscope,
  prior_auth: ShieldCheck,
  imaging: FlaskConical,
}

export default function OrderStatus() {
  const [orders, setOrders] = useState<OrderDraft[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [timeline, setTimeline] = useState<OrderTimeline | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.listOrders().then(setOrders).catch(() => {})
  }, [])

  async function loadTimeline(orderId: number) {
    setSelectedId(orderId)
    try {
      const tl = await api.getOrderTimeline(orderId)
      setTimeline(tl)
    } catch {
      setTimeline(null)
    }
  }

  const filtered = orders.filter(o =>
    o.title.toLowerCase().includes(search.toLowerCase()) ||
    String(o.id).includes(search)
  )

  const selectedOrder = orders.find(o => o.id === selectedId)

  return (
    <div className="flex gap-7 animate-fade-in">
      {/* Order list */}
      <div className="w-[340px] flex-shrink-0">
        <div className="mb-6">
          <h1 className="text-[28px] font-semibold tracking-tight text-white mb-1">Order Status</h1>
          <p className="text-[15px] text-white/30 font-light">Timeline and audit trail</p>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search orders..."
            className="w-full bg-white/[0.06] text-white text-[13px] rounded-xl pl-10 pr-3 py-2.5 border border-white/[0.08] placeholder-white/20 focus:border-navy-400/50 focus:ring-1 focus:ring-navy-400/20 outline-none transition-all" />
        </div>

        <div className="space-y-1.5 max-h-[calc(100vh-260px)] overflow-auto pr-1">
          {filtered.map(order => {
            const isSelected = selectedId === order.id
            const TypeIcon = typeIcons[order.order_type] || Pill
            return (
              <button key={order.id} onClick={() => loadTimeline(order.id)}
                className={`w-full text-left p-3.5 rounded-xl transition-all duration-200 ${
                  isSelected
                    ? 'bg-white/[0.08] border border-white/[0.15]'
                    : 'bg-white/[0.03] border border-transparent hover:bg-white/[0.06]'
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected ? '' : 'bg-white/[0.06]'
                  }`}
                  style={isSelected ? { backgroundColor: 'rgba(196,255,77,0.12)' } : {}}>
                    <TypeIcon className="w-3.5 h-3.5" style={{ color: isSelected ? '#c4ff4d' : 'rgba(255,255,255,0.25)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] text-white font-medium truncate">{order.title}</span>
                      <span className="text-[10px] text-white/15 font-mono flex-shrink-0">#{order.id}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${statusBadge[order.status] || ''}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center py-12">
              <Search className="w-5 h-5 text-white/10 mb-2" />
              <p className="text-[13px] text-white/20">No orders found</p>
            </div>
          )}
        </div>
      </div>

      {/* Timeline detail */}
      <div className="flex-1">
        {selectedOrder && timeline ? (
          <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/[0.06] overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="px-7 py-6 border-b border-white/[0.06]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide ${statusBadge[selectedOrder.status] || ''}`}>
                      {selectedOrder.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] text-white/15 capitalize">{selectedOrder.order_type.replace('_', ' ')}</span>
                  </div>
                  <h2 className="text-xl font-semibold text-white tracking-tight">{selectedOrder.title}</h2>
                  <p className="text-[13px] text-white/30 mt-1">
                    #{selectedOrder.id} &middot; {selectedOrder.organization?.name} &middot; {selectedOrder.created_by}
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics strip */}
            <div className="grid grid-cols-3 gap-px bg-white/[0.04]">
              <div className="bg-white/[0.03] px-6 py-4">
                <div className="text-[11px] text-white/20 uppercase tracking-wider font-medium mb-1">Type</div>
                <div className="text-[14px] text-white font-medium capitalize">{selectedOrder.order_type.replace('_', ' ')}</div>
              </div>
              <div className="bg-white/[0.03] px-6 py-4">
                <div className="text-[11px] text-white/20 uppercase tracking-wider font-medium mb-1">PA Prediction</div>
                <div className={`text-[14px] font-medium ${
                  selectedOrder.prior_auth_likely === 'yes' ? 'text-amber-400'
                    : selectedOrder.prior_auth_likely === 'no' ? 'text-emerald-400' : 'text-white/30'
                }`}>
                  {selectedOrder.prior_auth_likely === 'yes' ? 'Likely Required' : selectedOrder.prior_auth_likely === 'no' ? 'Not Expected' : 'Unknown'}
                </div>
              </div>
              <div className="bg-white/[0.03] px-6 py-4">
                <div className="text-[11px] text-white/20 uppercase tracking-wider font-medium mb-1">Patient Constraints</div>
                <div className="text-[14px] font-medium">
                  {selectedOrder.patient_constraints ? (
                    <span style={{ color: 'rgba(196,255,77,0.8)' }}>{Object.keys(selectedOrder.patient_constraints).length} rule(s)</span>
                  ) : <span className="text-white/20">None</span>}
                </div>
              </div>
            </div>

            {/* Patient constraints detail */}
            {selectedOrder.patient_constraints && (
              <div className="mx-7 mt-5 rounded-xl p-5" style={{ backgroundColor: 'rgba(196,255,77,0.05)', border: '1px solid rgba(196,255,77,0.1)' }}>
                <div className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(196,255,77,0.6)' }}>Patient Constraints</div>
                <div className="space-y-2">
                  {Object.entries(selectedOrder.patient_constraints).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className="text-[12px] text-white/30 capitalize">{k.replace(/_/g, ' ')}</span>
                      <span className="text-[12px] text-white/70 font-medium">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="px-7 py-6">
              <div className="text-[11px] font-bold text-white/20 uppercase tracking-wider mb-5">Audit Timeline</div>
              <div className="relative pl-7">
                <div className="absolute left-[5px] top-2 bottom-2 w-px bg-white/[0.06]" />
                {timeline.timeline.map((entry, i) => {
                  const dotColor = actionDotColor[entry.action] || 'bg-white/20'
                  const isFirst = i === 0
                  return (
                    <div key={i} className="relative pb-6 last:pb-0">
                      <div className={`absolute left-[-22px] top-1 w-2.5 h-2.5 rounded-full ${dotColor} ${isFirst ? 'ring-4 ring-white/[0.04]' : ''}`} />
                      <div className="text-[13px] text-white/70 leading-relaxed">{entry.details}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-white/15">{new Date(entry.timestamp).toLocaleString()}</span>
                        <span className="text-[11px] text-white/10">&middot;</span>
                        <span className="text-[11px] text-white/15 capitalize">{entry.action.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-20">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
              <BarChart3 className="w-7 h-7 text-white/10" />
            </div>
            <p className="text-[14px] text-white/25 font-medium">Select an order to view its timeline</p>
            <p className="text-[12px] text-white/12 mt-1">Click on any order from the list</p>
          </div>
        )}
      </div>
    </div>
  )
}
