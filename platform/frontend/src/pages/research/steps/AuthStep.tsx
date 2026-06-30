import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, ArrowRight, Loader2, BarChart3, UserPlus, LogIn } from 'lucide-react'
import { researchApi } from '../researchApi'
import type { Participant, Study } from '../types'

interface Props {
  study: Study
  onAuthed: (p: Participant) => void
}

/** Entry screen: study intro + sign-up (name/email) or return sign-in (email). */
export default function AuthStep({ study, onAuthed }: Props) {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!emailOk) { setError('Please enter a valid email address.'); return }
    if (mode === 'signup' && !name.trim()) { setError('Please enter your name.'); return }
    setBusy(true)
    try {
      const p = mode === 'signup'
        ? await researchApi.register(name.trim(), email.trim())
        : await researchApi.login(email.trim())
      onAuthed(p)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full px-4 py-2.5 rounded-xl border border-sage-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none text-[14px]'

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 border border-teal-200/60 rounded-full mb-5">
          <Brain className="w-3.5 h-3.5 text-teal-600" />
          <span className="text-[11px] font-semibold text-teal-700">Research Study · ~15 min</span>
        </div>
        <h1 className="text-[26px] leading-tight font-bold text-gray-900 mb-2">{study.meta.title}</h1>
        <p className="text-[14px] text-teal-700/80 font-medium">{study.meta.subtitle}</p>
        <p className="text-[12px] text-gray-400 mt-2">{study.meta.principal_investigator} · {study.meta.institution}</p>
      </div>

      <div className="bg-white rounded-2xl border border-sage-200/70 shadow-soft p-6">
        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-sage-50 rounded-xl mb-5">
          <button
            onClick={() => { setMode('signup'); setError('') }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              mode === 'signup' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            <UserPlus className="w-4 h-4" /> Sign up
          </button>
          <button
            onClick={() => { setMode('signin'); setError('') }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              mode === 'signin' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            <LogIn className="w-4 h-4" /> Sign in
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. Jordan Smith" className={field} autoFocus />
            </div>
          )}
          <div>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hospital.org" className={field} autoFocus={mode === 'signin'} />
          </div>

          {error && <p className="text-[13px] text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 disabled:opacity-40 transition-all shadow-glow-teal"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <>{mode === 'signup' ? 'Create account & begin' : 'Continue'} <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
          {mode === 'signup'
            ? 'Your name and email are used only for study communication and are stored separately from the research data. Full details are on the next (consent) screen.'
            : 'Enter the email you signed up with. If you have already started, your session will show as complete.'}
        </p>
      </div>

      <div className="text-center mt-6">
        <Link to="/research/dashboard" className="text-[13px] text-gray-400 hover:text-teal-600 inline-flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" /> Researcher dashboard
        </Link>
      </div>
    </div>
  )
}
