import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ShieldCheck, FileText, Activity, Wifi, ClipboardList, Pill, ChevronRight, Database, Shield, ArrowRight } from 'lucide-react'
import { api } from '../../api'
import { usePatientWs } from '../../hooks/usePatientWs'
import type { Patient, Notification as Notif, AccessRequest, WsMessage, OrderDraft } from '../../types'

export default function PatientDashboard() {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [notifications, setNotifications] = useState<Notif[]>([])
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [pendingOrders, setPendingOrders] = useState<OrderDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [wsConnected, setWsConnected] = useState(false)

  const loadData = useCallback(() => {
    Promise.all([
      api.getPatient(1),
      api.getNotifications(1),
      api.getAccessRequests({ patient_id: '1' }),
      api.patientPendingOrders(1),
    ]).then(([p, n, r, o]) => {
      setPatient(p)
      setNotifications(n)
      setRequests(r)
      setPendingOrders(o)
      setLoading(false)
    })
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Real-time WebSocket notifications
  const handleWsMessage = useCallback((msg: WsMessage) => {
    if (msg.type === 'ack') return
    const liveNotif: Notif = {
      id: Date.now(),
      patient_id: 1,
      type: msg.type,
      message: msg.message,
      read: false,
      created_at: new Date().toISOString(),
      access_request_id: msg.access_request_id ?? null,
    }
    setNotifications((prev) => [liveNotif, ...prev])
    api.getAccessRequests({ patient_id: '1' }).then(setRequests).catch(() => {})
  }, [])

  const wsRef = usePatientWs(1, handleWsMessage)
  useEffect(() => {
    const interval = setInterval(() => {
      setWsConnected(wsRef.current?.readyState === WebSocket.OPEN)
    }, 2000)
    return () => clearInterval(interval)
  }, [wsRef])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
    </div>
  )

  const unreadCount = notifications.filter((n) => !n.read).length
  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="max-w-5xl animate-fade-in">
      {/* Greeting */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-gray-900">
            {greeting}, {patient?.first_name}
          </h1>
          <span
            className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-medium"
            style={wsConnected
              ? { backgroundColor: 'rgba(196,255,77,0.15)', color: '#111111', border: '1px solid rgba(196,255,77,0.4)' }
              : { backgroundColor: '#f3f4f6', color: '#9ca3af' }
            }
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: wsConnected ? '#c4ff4d' : '#d1d5db' }} />
            {wsConnected ? 'Connected' : 'Connecting'}
          </span>
        </div>
        <p className="text-[15px] text-gray-400 font-light">Your care, your decisions. Everything in one place.</p>
      </div>

      {/* Needs Attention Banner */}
      {pendingOrders.length > 0 && (
        <Link to="/patient/orders" className="group block mb-8 animate-slide-up">
          <div className="relative overflow-hidden rounded-2xl p-6 shadow-soft-lg" style={{ background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)' }}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/5 rounded-full translate-y-1/2 -translate-x-1/4" />
            <div className="relative flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(196,255,77,0.15)' }}>
                    <ClipboardList className="w-4 h-4" style={{ color: '#c4ff4d' }} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(196,255,77,0.8)' }}>Needs Your Review</span>
                </div>
                <h2 className="text-xl font-semibold mb-1" style={{ color: '#ffffff' }}>
                  {pendingOrders.length} order{pendingOrders.length > 1 ? 's' : ''} awaiting your approval
                </h2>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {pendingOrders.map(o => o.title).join(' \u00B7 ')}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center transition-colors" style={{ backgroundColor: 'rgba(196,255,77,0.12)' }}>
                <ArrowRight className="w-5 h-5" style={{ color: '#c4ff4d' }} />
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-soft hover:shadow-soft-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Bell className="w-[18px] h-[18px] text-amber-500" />
            </div>
            {unreadCount > 0 && <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">New</span>}
          </div>
          <p className="text-[32px] font-semibold text-gray-900 tracking-tight leading-none mb-1">{unreadCount}</p>
          <p className="text-[13px] text-gray-400 font-medium">Unread notifications</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-soft hover:shadow-soft-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <ShieldCheck className="w-[18px] h-[18px] text-teal-500" />
            </div>
            {pendingCount > 0 && <span className="text-[11px] font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">{pendingCount} pending</span>}
          </div>
          <p className="text-[32px] font-semibold text-gray-900 tracking-tight leading-none mb-1">{requests.length}</p>
          <p className="text-[13px] text-gray-400 font-medium">Access requests</p>
        </div>
        <Link to="/patient/orders" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-soft hover:shadow-soft-lg hover:border-teal-200 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <ClipboardList className="w-[18px] h-[18px] text-violet-500" />
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-teal-400 transition-colors" />
          </div>
          <p className="text-[32px] font-semibold text-gray-900 tracking-tight leading-none mb-1">{pendingOrders.length}</p>
          <p className="text-[13px] text-gray-400 font-medium">Pending approvals</p>
        </Link>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        {/* Notifications — wider */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-gray-900">Recent Activity</h2>
            <span className="text-[11px] text-gray-400">{notifications.length} total</span>
          </div>
          <div className="divide-y divide-gray-50/80">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'rgba(196,255,77,0.1)' }}>
                  <Bell className="w-5 h-5" style={{ color: 'rgba(17,17,17,0.3)' }} />
                </div>
                <p className="text-sm text-gray-400">No notifications yet</p>
                <p className="text-xs text-gray-300 mt-1">We'll keep you updated on your care</p>
              </div>
            ) : (
              notifications.slice(0, 5).map((n) => (
                <div key={n.id} className="px-6 py-4 flex items-start gap-3 transition-colors hover:bg-warm-50/50"
                  style={!n.read ? { backgroundColor: 'rgba(196,255,77,0.06)' } : {}}>
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: !n.read ? '#c4ff4d' : '#e5e7eb' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-gray-700 leading-relaxed">{n.message}</p>
                    <p className="text-[11px] text-gray-300 mt-1.5">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {n.access_request_id && n.type === 'access_request' && (
                    <Link to="/patient/requests" className="text-[11px] font-semibold flex-shrink-0 uppercase tracking-wide" style={{ color: '#111111' }}>
                      Review
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions — narrower */}
        <div className="lg:col-span-2 space-y-4">
          <Link to="/patient/orders" className="group block bg-white rounded-2xl border border-gray-100 p-5 shadow-soft hover:shadow-soft-lg hover:border-teal-200/60 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100/80 flex items-center justify-center group-hover:from-teal-100 group-hover:to-teal-200/60 transition-colors">
                <Pill className="w-5 h-5 text-teal-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-[13px] font-semibold text-gray-900">Order Review</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">Approve or set your preferences</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-teal-400 transition-colors" />
            </div>
          </Link>

          <Link to="/patient/records" className="group block bg-white rounded-2xl border border-gray-100 p-5 shadow-soft hover:shadow-soft-lg hover:border-teal-200/60 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sage-50 to-sage-100/80 flex items-center justify-center group-hover:from-sage-100 group-hover:to-sage-200/60 transition-colors">
                <Database className="w-5 h-5 text-sage-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-[13px] font-semibold text-gray-900">My Health Records</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">View your complete health data</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-teal-400 transition-colors" />
            </div>
          </Link>

          <Link to="/patient/notes" className="group block bg-white rounded-2xl border border-gray-100 p-5 shadow-soft hover:shadow-soft-lg hover:border-teal-200/60 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-warm-50 to-warm-100/80 flex items-center justify-center group-hover:from-warm-100 group-hover:to-warm-200/60 transition-colors">
                <FileText className="w-5 h-5 text-warm-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-[13px] font-semibold text-gray-900">Clinical Notes</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">Review clinical documentation</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-teal-400 transition-colors" />
            </div>
          </Link>

          <Link to="/patient/access-log" className="group block bg-white rounded-2xl border border-gray-100 p-5 shadow-soft hover:shadow-soft-lg hover:border-teal-200/60 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100/80 flex items-center justify-center group-hover:from-violet-100 group-hover:to-violet-200/60 transition-colors">
                <Shield className="w-5 h-5 text-violet-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-[13px] font-semibold text-gray-900">Data Access Log</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">See who accessed your data</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-teal-400 transition-colors" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
