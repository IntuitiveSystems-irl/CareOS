import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { FulfillmentPacket, FulfillmentTask, FulfillmentSummary } from '../../types'

const PATIENT_ID = 1

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-gray-50 text-gray-500',
  sent: 'bg-teal-50 text-teal-600',
  acknowledged: 'bg-indigo-50 text-indigo-600',
  completed: 'bg-emerald-50 text-emerald-600',
  failed: 'bg-red-50 text-red-500',
  needs_patient_input: 'bg-amber-50 text-amber-600',
}

const PACKET_COLORS: Record<string, string> = {
  created: 'bg-gray-50 text-gray-500',
  in_progress: 'bg-teal-50 text-teal-600',
  completed: 'bg-emerald-50 text-emerald-600',
  blocked: 'bg-red-50 text-red-500',
}

const TYPE_LABELS: Record<string, string> = {
  lab_order: 'Lab Order',
  pharmacy_rx: 'Prescription Routing',
  referral: 'Referral',
  insurance_packet: 'Insurance / Prior Auth',
  record_request: 'Record Request',
}

export default function FulfillmentPage() {
  const [packets, setPackets] = useState<FulfillmentPacket[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<number | null>(null)
  const [summary, setSummary] = useState<FulfillmentSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const fetchPackets = () => {
    api.getPackets(PATIENT_ID).then(setPackets).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { fetchPackets() }, [])

  const handleSend = async (packetId: number) => {
    setSending(packetId)
    try {
      await api.sendPacket(PATIENT_ID, packetId)
      fetchPackets()
    } catch { /* ignore */ }
    setSending(null)
  }

  const handleSummarize = async (packet: FulfillmentPacket) => {
    if (!packet.items_json) return
    setSummaryLoading(true)
    setSummary(null)
    try {
      const res = await api.aiFulfillmentSummarize({ items_json: packet.items_json })
      setSummary(res)
    } catch {
      setSummary({ checklist: ['Unable to generate summary.'], what_to_expect: [], patient_actions: [] })
    }
    setSummaryLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-gray-900 mb-1">Visit Fulfillment</h1>
          <p className="text-[15px] text-gray-400 font-light">
            Track post-visit tasks: lab orders, prescriptions, referrals, and insurance submissions.
          </p>
        </div>
        <a href="/patient/preferences" className="text-[12px] font-semibold text-teal-500 hover:text-teal-600 transition-colors">Edit Preferences</a>
      </div>

      {packets.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-[13px] text-gray-300">
          No fulfillment packets yet.
        </div>
      )}

      {packets.map((pkt) => (
        <div key={pkt.id} className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          {/* Packet header */}
          <div className="flex items-center justify-between border-b border-gray-50 px-6 py-4">
            <div>
              <span className="text-[14px] font-semibold text-gray-800">Packet #{pkt.id}</span>
              <span className={`ml-2 inline-block rounded-lg px-2.5 py-0.5 text-[10px] font-semibold ${PACKET_COLORS[pkt.status] || 'bg-gray-50 text-gray-400'}`}>
                {pkt.status.replace('_', ' ')}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSummarize(pkt)}
                disabled={summaryLoading}
                className="rounded-xl border border-teal-200 px-3.5 py-1.5 text-[11px] font-semibold text-teal-600 hover:bg-teal-50 transition-all disabled:opacity-50"
              >
                {summaryLoading ? 'Summarizing...' : 'AI Summary'}
              </button>
              {pkt.tasks.some((t) => t.status === 'queued') && (
                <button
                  onClick={() => handleSend(pkt.id)}
                  disabled={sending === pkt.id}
                  className="rounded-xl bg-teal-500 px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-teal-600 transition-all disabled:opacity-50 shadow-sm"
                >
                  {sending === pkt.id ? 'Sending...' : 'Send Now'}
                </button>
              )}
            </div>
          </div>

          {/* Task checklist */}
          <div className="divide-y divide-gray-50">
            {pkt.tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>

          {/* Packet metadata */}
          <div className="border-t border-gray-50 bg-sage-50/30 px-6 py-2.5 text-[11px] text-gray-300">
            Created {new Date(pkt.created_at).toLocaleString()}
            {pkt.encounter_id && <span> &middot; Encounter #{pkt.encounter_id}</span>}
            {pkt.source_note_id && <span> &middot; Note #{pkt.source_note_id}</span>}
          </div>
        </div>
      ))}

      {/* AI Summary panel */}
      {summary && (
        <div className="rounded-2xl border border-teal-200/50 bg-teal-50/30 p-6">
          <h3 className="mb-3 text-[14px] font-semibold text-teal-700">AI Fulfillment Summary</h3>
          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <h4 className="mb-1.5 text-[11px] font-bold text-teal-600 uppercase tracking-wider">Checklist</h4>
              <ul className="space-y-1">
                {summary.checklist.map((item, i) => <li key={i} className="text-[12px] text-gray-600 flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />{item}</li>)}
              </ul>
            </div>
            <div>
              <h4 className="mb-1.5 text-[11px] font-bold text-teal-600 uppercase tracking-wider">What to Expect</h4>
              <ul className="space-y-1">
                {summary.what_to_expect.map((item, i) => <li key={i} className="text-[12px] text-gray-600 flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />{item}</li>)}
              </ul>
            </div>
            <div>
              <h4 className="mb-1.5 text-[11px] font-bold text-teal-600 uppercase tracking-wider">Your Actions</h4>
              <ul className="space-y-1">
                {summary.patient_actions.map((item, i) => <li key={i} className="text-[12px] text-gray-600 flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />{item}</li>)}
              </ul>
            </div>
          </div>
          <button onClick={() => setSummary(null)} className="mt-4 text-[11px] text-teal-500 hover:text-teal-600 font-medium transition-colors">Dismiss</button>
        </div>
      )}
    </div>
  )
}

function TaskRow({ task }: { task: FulfillmentTask }) {
  return (
    <div className="flex items-center justify-between px-6 py-3.5 hover:bg-sage-50/30 transition-colors">
      <div className="flex items-center gap-3">
        <TaskIcon type={task.type} status={task.status} />
        <div>
          <p className="text-[13px] font-medium text-gray-800">{TYPE_LABELS[task.type] || task.type}</p>
          <p className="text-[11px] text-gray-400">
            {task.destination?.name || `Destination #${task.destination_id || '—'}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-lg px-2.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[task.status] || 'bg-gray-50 text-gray-400'}`}>
          {task.status.replace('_', ' ')}
        </span>
        {task.last_error && (
          <span className="text-[10px] text-red-400" title={task.last_error}>error</span>
        )}
      </div>
    </div>
  )
}

function TaskIcon({ type, status }: { type: string; status: string }) {
  const done = status === 'completed' || status === 'acknowledged'
  const failed = status === 'failed'
  const color = done ? 'text-green-500' : failed ? 'text-red-500' : 'text-gray-400'
  const icons: Record<string, string> = {
    lab_order: '\u{1F9EA}',
    pharmacy_rx: '\u{1F48A}',
    referral: '\u{1F4CB}',
    insurance_packet: '\u{1F4C4}',
    record_request: '\u{1F4C1}',
  }
  return <span className={`text-lg ${color}`}>{icons[type] || '\u{2753}'}</span>
}
