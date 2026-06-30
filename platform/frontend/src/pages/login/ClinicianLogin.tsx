import { useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { Heart, ArrowRight, Lock, ArrowLeft, Stethoscope, Loader2 } from 'lucide-react'
import { api, setClinicianSession } from '../../api'

const FONT_STYLE = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap'); .font-display, .font-careos { font-family: 'Space Grotesk', sans-serif; }`

export default function ClinicianLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.clinicianLogin(email.trim().toLowerCase(), password)
      setClinicianSession({ token: res.token, clinician: res.clinician })
      navigate('/ehr')
    } catch (err: any) {
      setError(err.message || 'Sign in failed')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#111111', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <style>{FONT_STYLE}</style>
      <header style={{ backgroundColor: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-8 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#c4ff4d' }}>
              <Heart className="w-4 h-4" style={{ color: '#111111' }} />
            </div>
            <div>
              <h1 className="text-[16px] font-semibold tracking-tight" style={{ color: '#ffffff' }}>CareOS</h1>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Clinician Portal</p>
            </div>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-[13px] font-medium transition-colors" style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-8 py-16">
        <div className="w-full max-w-[420px] animate-fade-in">
          <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="p-8">
              <div className="text-center mb-7">
                <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#c4ff4d' }}>
                  <Stethoscope className="w-6 h-6" style={{ color: '#111111' }} />
                </div>
                <h2 className="text-[22px] font-bold mb-1" style={{ color: '#ffffff' }}>Clinician Portal</h2>
                <p className="text-[14px]" style={{ color: 'rgba(255,255,255,0.4)' }}>EHR access, orders & clinical workflows</p>
              </div>

              <div className="rounded-2xl p-3.5 mb-5" style={{ backgroundColor: 'rgba(196,255,77,0.08)', border: '1px solid rgba(196,255,77,0.2)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(196,255,77,0.7)' }}>Demo Credentials</p>
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <div>dr.chen@metrogeneral.com</div>
                    <div>clinician123</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEmail('dr.chen@metrogeneral.com'); setPassword('clinician123') }}
                    className="px-3 py-1.5 text-[11px] font-semibold rounded-xl transition-all"
                    style={{ backgroundColor: '#c4ff4d', color: '#111111' }}
                  >
                    Auto-fill
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Staff Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="dr.chen@metrogeneral.com"
                    className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ffffff' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#c4ff4d'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,255,77,0.1)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ffffff' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#c4ff4d'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,255,77,0.1)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>

                {error && (
                  <p className="text-[12px] rounded-lg px-3 py-2" style={{ color: '#ff6b5b', backgroundColor: 'rgba(255,107,91,0.1)', border: '1px solid rgba(255,107,91,0.2)' }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 text-[14px] font-semibold rounded-xl transition-all mt-2 disabled:opacity-50"
                  style={{ backgroundColor: '#c4ff4d', color: '#111111' }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign in <ArrowRight className="w-4 h-4" /></>}
                </button>

              </form>
            </div>

            <div className="px-8 py-4 border-t" style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                <Lock className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
                <span>Authorized staff only. All access is logged and auditable.</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
