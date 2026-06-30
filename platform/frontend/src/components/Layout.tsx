import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FileText, ClipboardList, ShieldCheck,
  Activity, Building2, Database, ScrollText, Stethoscope,
  Settings, Package, PenSquare, ListChecks, BarChart3,
  Heart, Zap, ArrowLeftRight, Wifi, LogOut, Link2, Users,
  MessageSquareHeart, Webhook,
} from 'lucide-react'

const FONT_STYLE = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap'); body, .font-careos { font-family: 'Space Grotesk', system-ui, sans-serif; }`

const patientNav = [
  { to: '/patient', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/patient/orders', label: 'Order Review', icon: ClipboardList },
  { to: '/patient/records', label: 'My Records', icon: Database },
  { to: '/patient/notes', label: 'Clinical Notes', icon: FileText },
  { to: '/patient/requests', label: 'Access Requests', icon: ShieldCheck },
  { to: '/patient/fulfillment', label: 'Visit Fulfillment', icon: Package },
  { to: '/patient/feedback', label: 'Share Feedback', icon: MessageSquareHeart },
  { to: '/patient/logs', label: 'Access Logs', icon: Activity },
  { to: '/patient/access-log', label: 'Data Access Log', icon: ScrollText },
  { to: '/patient/preferences', label: 'Preferences', icon: Settings },
]

const ehrNav = [
  { to: '/ehr', label: 'Request Records', icon: ClipboardList, end: true },
  { to: '/ehr/compose', label: 'Order Composer', icon: PenSquare },
  { to: '/ehr/queue', label: 'Work Queue', icon: ListChecks },
  { to: '/ehr/order-status', label: 'Order Status', icon: BarChart3 },
  { to: '/ehr/records', label: 'Retrieved Records', icon: Database },
  { to: '/ehr/chart', label: 'Patient Chart', icon: Link2 },
  { to: '/ehr/clinician', label: 'Clinician View', icon: Stethoscope },
  { to: '/ehr/cds', label: 'Decision Support', icon: Webhook },
  { to: '/ehr/feedback', label: 'Patient Feedback', icon: MessageSquareHeart },
  { to: '/ehr/clinicians', label: 'Clinician Mgmt', icon: Users },
  { to: '/ehr/connections', label: 'EHR Connections', icon: Wifi },
]

export default function Layout({ mode }: { mode: 'patient' | 'ehr' }) {
  const location = useLocation()
  const nav = mode === 'patient' ? patientNav : ehrNav
  const isPatient = mode === 'patient'

  return (
    <div className="flex h-screen" style={{ backgroundColor: isPatient ? '#f7f3eb' : '#111111', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <style>{FONT_STYLE}</style>
      {/* Sidebar */}
      <aside
        className="w-[260px] flex-shrink-0 flex flex-col"
        style={isPatient
          ? { backgroundColor: '#ffffff', borderRight: '1px solid rgba(17,17,17,0.08)' }
          : { backgroundColor: '#1a1a1a', borderRight: '1px solid rgba(255,255,255,0.07)' }
        }
      >
        {/* Brand Header */}
        <div
          className="px-6 py-5"
          style={isPatient
            ? { borderBottom: '1px solid rgba(17,17,17,0.07)' }
            : { borderBottom: '1px solid rgba(255,255,255,0.07)' }
          }
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#c4ff4d' }}>
              <Heart className="w-4 h-4" style={{ color: '#111111' }} />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight" style={{ color: isPatient ? '#111111' : '#ffffff' }}>
                CareOS
              </h1>
              <p className="text-[11px] font-medium tracking-wide uppercase" style={{ color: isPatient ? 'rgba(17,17,17,0.4)' : 'rgba(196,255,77,0.6)' }}>
                {isPatient ? 'Patient Portal' : 'Care Operations'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200"
              style={({ isActive }) => isActive
                ? isPatient
                  ? { backgroundColor: 'rgba(196,255,77,0.15)', color: '#111111' }
                  : { backgroundColor: 'rgba(196,255,77,0.12)', color: '#c4ff4d' }
                : isPatient
                  ? { color: 'rgba(17,17,17,0.5)' }
                  : { color: 'rgba(255,255,255,0.4)' }
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                    style={isActive
                      ? isPatient
                        ? { backgroundColor: 'rgba(196,255,77,0.25)' }
                        : { backgroundColor: 'rgba(196,255,77,0.15)' }
                      : { backgroundColor: 'transparent' }
                    }
                  >
                    <item.icon
                      className="w-[15px] h-[15px] transition-colors"
                      style={{ color: isActive
                        ? isPatient ? '#111111' : '#c4ff4d'
                        : isPatient ? 'rgba(17,17,17,0.4)' : 'rgba(255,255,255,0.3)'
                      }}
                    />
                  </div>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Mode Switcher + Logout */}
        <div
          className="px-3 py-4 space-y-2"
          style={isPatient
            ? { borderTop: '1px solid rgba(17,17,17,0.07)', backgroundColor: 'rgba(247,243,235,0.5)' }
            : { borderTop: '1px solid rgba(255,255,255,0.07)', backgroundColor: '#111111' }
          }
        >
          <NavLink
            to={isPatient ? '/ehr' : '/patient'}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold tracking-wide uppercase transition-all duration-200"
            style={isPatient
              ? { color: 'rgba(17,17,17,0.45)', border: '1px solid rgba(17,17,17,0.1)' }
              : { color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }
            }
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {isPatient ? 'Staff View' : 'Patient View'}
          </NavLink>
          <NavLink
            to={isPatient ? '/login/patient' : '/login/clinician'}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium tracking-wide transition-all duration-200"
            style={isPatient
              ? { color: 'rgba(17,17,17,0.35)' }
              : { color: 'rgba(255,255,255,0.2)' }
            }
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </NavLink>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 lg:p-10 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
