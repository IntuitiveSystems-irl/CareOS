import { useEffect, useState } from 'react'
import { CheckCircle, AlertTriangle, Clock, Sparkles, ClipboardCheck, Loader2 } from 'lucide-react'
import { api } from '../../api'
import type { ClinicalNote, NoteTranslation, NoteVerification } from '../../types'

export default function Notes() {
  const [notes, setNotes] = useState<ClinicalNote[]>([])
  const [loading, setLoading] = useState(true)
  const [commenting, setCommenting] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [translations, setTranslations] = useState<Record<number, NoteTranslation>>({})
  const [verifications, setVerifications] = useState<Record<number, NoteVerification>>({})
  const [aiLoading, setAiLoading] = useState<Record<number, string>>({})

  useEffect(() => {
    api.getPatientNotes(1).then((n) => { setNotes(n); setLoading(false) })
  }, [])

  const handleTranslate = async (note: ClinicalNote) => {
    setAiLoading((p) => ({ ...p, [note.id]: 'translate' }))
    try {
      const result = await api.aiTranslateNote({ note_content: note.content, patient_name: 'Alex' })
      setTranslations((p) => ({ ...p, [note.id]: result }))
    } finally {
      setAiLoading((p) => { const n = { ...p }; delete n[note.id]; return n })
    }
  }

  const handleVerify = async (note: ClinicalNote) => {
    setAiLoading((p) => ({ ...p, [note.id]: 'verify' }))
    try {
      const result = await api.aiVerifyNote({ note_content: note.content, patient_name: 'Alex' })
      setVerifications((p) => ({ ...p, [note.id]: result }))
    } finally {
      setAiLoading((p) => { const n = { ...p }; delete n[note.id]; return n })
    }
  }

  const handleApprove = async (id: number) => {
    await api.submitNoteReview(1, id, { status: 'approved' })
    const updated = await api.getPatientNote(1, id)
    setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)))
  }

  const handleFlag = async (id: number) => {
    await api.submitNoteReview(1, id, { status: 'flagged', comment: comment || undefined })
    const updated = await api.getPatientNote(1, id)
    setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)))
    setCommenting(null)
    setComment('')
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
    </div>
  )

  const statusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'flagged': return <AlertTriangle className="w-4 h-4 text-red-500" />
      default: return <Clock className="w-4 h-4 text-amber-500" />
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Approved'
      case 'flagged': return 'Flagged'
      default: return 'Pending Review'
    }
  }

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-900 mb-1">Clinical Notes</h1>
        <p className="text-[15px] text-gray-400 font-light">Review and verify your clinical documentation (Open Notes)</p>
      </div>

      <div className="space-y-5">
        {notes.map((note) => (
          <div key={note.id} className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {statusIcon(note.status)}
                <div>
                  <p className="text-[13px] font-semibold text-gray-800">{note.author}</p>
                  <p className="text-[11px] text-gray-300">{new Date(note.date).toLocaleString()}</p>
                </div>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold ${
                note.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                note.status === 'flagged' ? 'bg-red-50 text-red-500' :
                'bg-amber-50 text-amber-600'
              }`}>
                {statusLabel(note.status)}
              </span>
            </div>

            <div className="px-6 py-5">
              <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">{note.content}</p>
            </div>

            {/* AI Actions */}
            <div className="px-6 py-3 border-t border-gray-50 flex items-center gap-2">
              <button
                onClick={() => handleTranslate(note)}
                disabled={!!aiLoading[note.id]}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-semibold rounded-xl bg-teal-50 text-teal-600 hover:bg-teal-100 transition-all disabled:opacity-50"
              >
                {aiLoading[note.id] === 'translate' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Plain Language
              </button>
              <button
                onClick={() => handleVerify(note)}
                disabled={!!aiLoading[note.id]}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-semibold rounded-xl bg-sage-50 text-sage-600 hover:bg-sage-100 transition-all disabled:opacity-50"
              >
                {aiLoading[note.id] === 'verify' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardCheck className="w-3 h-3" />}
                Verify Accuracy
              </button>
            </div>

            {/* AI Translation Result */}
            {translations[note.id] && (
              <div className="px-6 py-5 border-t border-teal-100/50 bg-teal-50/20">
                <p className="text-[11px] font-bold text-teal-600 uppercase tracking-wider mb-2">AI Plain-Language Translation</p>
                <p className="text-[13px] text-gray-700 leading-relaxed">{translations[note.id].plain_language}</p>
                {translations[note.id].key_points.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold text-teal-500 mb-1.5">Key Points</p>
                    <ul className="space-y-1.5">
                      {translations[note.id].key_points.map((pt, i) => (
                        <li key={i} className="text-[12px] text-gray-600 flex items-start gap-2">
                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* AI Verification Result */}
            {verifications[note.id] && (
              <div className="px-6 py-5 border-t border-sage-100/50 bg-sage-50/20">
                <p className="text-[11px] font-bold text-sage-600 uppercase tracking-wider mb-2">Verification Checklist</p>
                <ul className="space-y-2 mb-3">
                  {verifications[note.id].checklist.map((item, i) => (
                    <li key={i} className="text-[12px] text-gray-700 flex items-start gap-2">
                      <input type="checkbox" className="mt-0.5 rounded border-gray-200 text-teal-500 focus:ring-teal-300" />
                      {item}
                    </li>
                  ))}
                </ul>
                {verifications[note.id].common_errors.length > 0 && (
                  <>
                    <p className="text-[11px] font-semibold text-amber-500 mb-1.5">Common Errors to Watch For</p>
                    <ul className="space-y-1.5">
                      {verifications[note.id].common_errors.map((err, i) => (
                        <li key={i} className="text-[12px] text-gray-600 flex items-start gap-2">
                          <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                          {err}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {note.patient_comments && (
              <div className="px-6 py-3 bg-sage-50/30 border-t border-gray-50">
                <p className="text-[11px] font-semibold text-gray-400 mb-1">Your Comments</p>
                <p className="text-[13px] text-gray-600">{note.patient_comments}</p>
              </div>
            )}

            {note.status === 'pending_review' && (
              <div className="px-6 py-4 border-t border-gray-50 flex items-center gap-3">
                <button
                  onClick={() => handleApprove(note.id)}
                  className="px-5 py-2.5 bg-emerald-500 text-white text-[13px] font-semibold rounded-xl hover:bg-emerald-600 transition-all shadow-sm"
                >
                  Approve
                </button>

                {commenting === note.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Describe the inaccuracy..."
                      className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-teal-200 focus:border-teal-300 transition-all"
                    />
                    <button
                      onClick={() => handleFlag(note.id)}
                      className="px-4 py-2.5 bg-red-500 text-white text-[13px] font-semibold rounded-xl hover:bg-red-600 transition-all"
                    >
                      Submit Flag
                    </button>
                    <button
                      onClick={() => { setCommenting(null); setComment('') }}
                      className="px-3 py-2 text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCommenting(note.id)}
                    className="px-5 py-2.5 border border-red-200 text-red-400 text-[13px] font-medium rounded-xl hover:bg-red-50 transition-all"
                  >
                    Flag Inaccuracy
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
