import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, X } from 'lucide-react'

const INTERESTS = [
  { value: 'clinic',   label: 'Clinic / Health System' },
  { value: 'research', label: 'Research / IRB' },
  { value: 'team',     label: 'Join the Team' },
  { value: 'investor', label: 'Investor / Partner' },
]

export default function InquireModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [interest, setInterest] = useState('clinic')
  const [role, setRole] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/email/inquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, interest, role, message }),
      })
      if (!res.ok) throw new Error('Server error')
      setStatus('success')
      setMsg("We got it — you'll hear from us soon.")
    } catch {
      setStatus('error')
      setMsg('Something went wrong. Email us directly: hi@businessintuitive.tech')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.22 }}
        className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="bg-[#111] px-8 py-7 flex items-start justify-between">
          <div>
            <span className="inline-block bg-[#c4ff4d] text-[#111] text-[10px] font-bold uppercase tracking-[.14em] px-2.5 py-1 rounded-full mb-3">CareOS</span>
            <h2 className="text-white text-[26px] font-bold tracking-[-0.02em] leading-tight">Inquire now</h2>
            <p className="text-white/50 text-[13px] mt-1">Clinic pilot, research, team, or investment</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition mt-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {status === 'success' ? (
          <div className="px-8 py-12 text-center">
            <div className="text-[40px] mb-4">✓</div>
            <p className="text-[#111] font-bold text-[18px]">{msg}</p>
            <button onClick={onClose} className="mt-6 px-6 py-2.5 rounded-full bg-[#111] text-white text-[13px] font-bold">Close</button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-8 py-7 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[.12em] text-[#111]/50 mb-1.5">Name *</label>
                <input required value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-3 rounded-xl border border-[#111]/10 text-[14px] text-[#111] outline-none focus:border-[#111]/30 bg-[#f9f9f9]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[.12em] text-[#111]/50 mb-1.5">Email *</label>
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-[#111]/10 text-[14px] text-[#111] outline-none focus:border-[#111]/30 bg-[#f9f9f9]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.12em] text-[#111]/50 mb-1.5">I'm interested in</label>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map(i => (
                  <button key={i.value} type="button"
                    onClick={() => setInterest(i.value)}
                    className={`px-3.5 py-2 rounded-full text-[12px] font-semibold border transition ${
                      interest === i.value
                        ? 'bg-[#111] text-[#c4ff4d] border-[#111]'
                        : 'bg-white text-[#111]/60 border-[#111]/15 hover:border-[#111]/30'
                    }`}
                  >{i.label}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.12em] text-[#111]/50 mb-1.5">Your role <span className="normal-case font-normal opacity-60">(optional)</span></label>
              <input value={role} onChange={e => setRole(e.target.value)}
                placeholder="e.g. Clinic Administrator, Developer, Researcher…"
                className="w-full px-4 py-3 rounded-xl border border-[#111]/10 text-[14px] text-[#111] outline-none focus:border-[#111]/30 bg-[#f9f9f9]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.12em] text-[#111]/50 mb-1.5">Message <span className="normal-case font-normal opacity-60">(optional)</span></label>
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                rows={3} placeholder="Tell us a bit about what you're looking for…"
                className="w-full px-4 py-3 rounded-xl border border-[#111]/10 text-[14px] text-[#111] outline-none focus:border-[#111]/30 bg-[#f9f9f9] resize-none"
              />
            </div>

            {status === 'error' && (
              <p className="text-rose-600 text-[12px]">{msg}</p>
            )}

            <button type="submit" disabled={status === 'loading'}
              className="w-full py-3.5 rounded-full bg-[#111] text-[#c4ff4d] text-[14px] font-bold hover:bg-black transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {status === 'loading' ? 'Sending…' : <>Send inquiry <ArrowUpRight className="w-4 h-4" /></>}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
