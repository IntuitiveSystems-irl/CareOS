import { useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { Heart, ArrowRight, Lock, ArrowLeft, User } from 'lucide-react'

const FONT_STYLE = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap'); .font-display, .font-careos { font-family: 'Space Grotesk', sans-serif; }`

export default function PatientLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    navigate('/patient')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f7f3eb', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <style>{FONT_STYLE}</style>
      <header style={{ backgroundColor: 'rgba(247,243,235,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(17,17,17,0.08)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-8 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#c4ff4d' }}>
              <Heart className="w-4 h-4" style={{ color: '#111111' }} />
            </div>
            <div>
              <h1 className="text-[16px] font-semibold tracking-tight" style={{ color: '#111111' }}>CareOS</h1>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(17,17,17,0.4)' }}>Patient Portal</p>
            </div>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-[13px] font-medium transition-colors" style={{ color: 'rgba(17,17,17,0.45)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#111111')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(17,17,17,0.45)')}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-8 py-16">
        <div className="w-full max-w-[420px] animate-fade-in">
          <div className="rounded-3xl overflow-hidden shadow-soft-lg" style={{ backgroundColor: '#ffffff', border: '1px solid rgba(17,17,17,0.08)' }}>
            <div className="p-8">
              <div className="text-center mb-7">
                <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#c4ff4d' }}>
                  <User className="w-6 h-6" style={{ color: '#111111' }} />
                </div>
                <h2 className="text-[22px] font-bold mb-1" style={{ color: '#111111' }}>Patient Portal</h2>
                <p className="text-[14px]" style={{ color: 'rgba(17,17,17,0.5)' }}>Your care, your decisions. Everything in one place.</p>
              </div>

              <div className="rounded-2xl p-3.5 mb-5" style={{ backgroundColor: 'rgba(196,255,77,0.12)', border: '1px solid rgba(196,255,77,0.4)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(17,17,17,0.55)' }}>Demo Credentials</p>
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-mono" style={{ color: 'rgba(17,17,17,0.65)' }}>
                    <div>sarah.chen@example.com</div>
                    <div>patient123</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEmail('sarah.chen@example.com'); setPassword('patient123') }}
                    className="px-3 py-1.5 text-[11px] font-semibold rounded-xl transition-all"
                    style={{ backgroundColor: '#c4ff4d', color: '#111111' }}
                  >
                    Auto-fill
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'rgba(17,17,17,0.5)' }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sarah.chen@example.com"
                    className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all"
                    style={{ backgroundColor: '#f7f3eb', border: '1px solid rgba(17,17,17,0.12)', color: '#111111' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#c4ff4d'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,255,77,0.15)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(17,17,17,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'rgba(17,17,17,0.5)' }}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all"
                    style={{ backgroundColor: '#f7f3eb', border: '1px solid rgba(17,17,17,0.12)', color: '#111111' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#c4ff4d'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,255,77,0.15)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(17,17,17,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3.5 text-[14px] font-semibold rounded-xl transition-all mt-2"
                  style={{ backgroundColor: '#111111', color: '#c4ff4d' }}
                >
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </button>

              </form>
            </div>

            <div className="px-8 py-4 border-t" style={{ backgroundColor: 'rgba(247,243,235,0.6)', borderColor: 'rgba(17,17,17,0.06)' }}>
              <div className="flex items-center gap-2 text-[11px]" style={{ color: 'rgba(17,17,17,0.35)' }}>
                <Lock className="w-3 h-3" style={{ color: 'rgba(17,17,17,0.3)' }} />
                <span>Protected by SMART on FHIR OAuth 2.0. Your data stays in your control.</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
