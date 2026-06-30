import { useEffect, useMemo, useState } from 'react'
import { MessageSquareHeart, Send, Loader2, CheckCircle2 } from 'lucide-react'
import { api } from '../../api'

const PATIENT_ID = 1

const SENTIMENTS = [
  { value: 'concern', label: 'I have a concern' },
  { value: 'preference', label: 'I have a preference' },
  { value: 'decline', label: "I'd like to decline / stop" },
  { value: 'question', label: 'I have a question' },
  { value: 'agree', label: 'I agree / this is working' },
]

const SENTIMENT_BADGE: Record<string, string> = {
  concern: 'bg-amber-50 text-amber-700 border-amber-200',
  preference: 'bg-sky-50 text-sky-700 border-sky-200',
  decline: 'bg-red-50 text-red-700 border-red-200',
  question: 'bg-violet-50 text-violet-700 border-violet-200',
  agree: 'bg-teal-50 text-teal-700 border-teal-200',
}

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-gray-100 text-gray-600',
  acknowledged: 'bg-teal-50 text-teal-700',
  resolved: 'bg-green-50 text-green-700',
}

export default function PatientFeedback() {
  const [chart, setChart] = useState<any | null>(null)
  const [feedback, setFeedback] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sentiment, setSentiment] = useState('concern')
  const [targetKey, setTargetKey] = useState('general')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const load = () => {
    api.getPatientFeedback(PATIENT_ID).then(setFeedback).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    api.relationalInternalChart(PATIENT_ID).then(setChart).catch(() => {})
    load()
  }, [])

  // Build a "what is this about?" list from the patient's own chart.
  const targets = useMemo(() => {
    if (!chart) return []
    const out: { key: string; kind: string; ref: string; label: string }[] = []
    for (const m of chart.medications || []) out.push({ key: `medication:${m.id}`, kind: 'medication', ref: m.id, label: `${m.name}${m.dose ? ` ${m.dose}` : ''}` })
    for (const p of chart.problems || []) out.push({ key: `problem:${p.id}`, kind: 'problem', ref: p.id, label: p.name })
    for (const a of chart.allergies || []) out.push({ key: `allergy:${a.id}`, kind: 'allergy', ref: a.id, label: a.substance })
    return out
  }, [chart])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setSaving(true)
    try {
      const t = targets.find((x) => x.key === targetKey)
      await api.createPatientFeedback(PATIENT_ID, {
        topic: t ? t.kind : 'general',
        target_kind: t?.kind,
        target_ref: t?.ref,
        target_label: t?.label,
        sentiment,
        message: message.trim(),
      })
      setMessage('')
      setTargetKey('general')
      setSentiment('concern')
      setDone(true)
      setTimeout(() => setDone(false), 3000)
      load()
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold tracking-tight text-gray-900 mb-1">Share Feedback</h1>
        <p className="text-[15px] text-gray-400">
          Your voice goes straight to your care team as a decision-support note — they'll see it on your chart.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={submit} className="bg-white rounded-2xl border border-sage-200/60 shadow-soft p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquareHeart className="w-5 h-5 text-teal-600" />
          <h2 className="text-[15px] font-semibold text-gray-900">Tell your care team something</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <label className="block">
            <span className="text-[12px] font-medium text-gray-500">What's this about?</span>
            <select
              value={targetKey}
              onChange={(e) => setTargetKey(e.target.value)}
              className="mt-1.5 w-full bg-warm-50/80 border border-sage-200/80 rounded-xl px-3 py-2.5 text-[14px] text-gray-900 outline-none focus:border-teal-400"
            >
              <option value="general">General / my care overall</option>
              {targets.map((t) => (
                <option key={t.key} value={t.key}>{t.kind}: {t.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-gray-500">How do you feel?</span>
            <select
              value={sentiment}
              onChange={(e) => setSentiment(e.target.value)}
              className="mt-1.5 w-full bg-warm-50/80 border border-sage-200/80 rounded-xl px-3 py-2.5 text-[14px] text-gray-900 outline-none focus:border-teal-400"
            >
              {SENTIMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        </div>

        <label className="block mb-4">
          <span className="text-[12px] font-medium text-gray-500">Your message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="e.g. I'd prefer the generic version of this medication if possible…"
            className="mt-1.5 w-full bg-warm-50/80 border border-sage-200/80 rounded-xl px-3 py-2.5 text-[14px] text-gray-900 placeholder-gray-300 outline-none focus:border-teal-400 resize-none"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !message.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-800 text-white text-[14px] font-semibold rounded-xl hover:from-teal-500 hover:to-teal-700 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send to care team
          </button>
          {done && (
            <span className="flex items-center gap-1.5 text-[13px] text-teal-600 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Sent — your team will see this on your chart.
            </span>
          )}
        </div>
      </form>

      {/* History */}
      <h3 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Your feedback</h3>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>
      ) : feedback.length === 0 ? (
        <p className="text-[14px] text-gray-400 py-8 text-center">No feedback yet.</p>
      ) : (
        <div className="space-y-3">
          {feedback.map((f) => (
            <div key={f.id} className="bg-white rounded-xl border border-sage-200/60 shadow-soft p-4">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${SENTIMENT_BADGE[f.sentiment] || ''}`}>
                  {f.sentiment}
                </span>
                {f.target_label && (
                  <span className="text-[11px] text-gray-500">about <span className="font-medium text-gray-700">{f.target_kind}: {f.target_label}</span></span>
                )}
                <span className={`ml-auto text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${STATUS_BADGE[f.status] || ''}`}>
                  {f.status}
                </span>
              </div>
              <p className="text-[14px] text-gray-700">{f.message}</p>
              {f.acknowledged_by && (
                <p className="text-[11px] text-teal-600 mt-2">Acknowledged by {f.acknowledged_by}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
