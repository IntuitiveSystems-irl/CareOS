// API client for the research subsystem (prefix /api/research).
import type {
  Study, Participant, TelemetryEvent, TaskAttemptPayload,
  WorkloadPayload, QualitativePayload, Summary, QualitativeRow, RosterRow,
  UsabilityPayload, UsabilitySummary, ExplorationPayload, ExplorationSummary,
} from './types'

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

const P = '/api/research'

// ── Researcher passcode (stored per-session) ──
const KEY_STORAGE = 'research_admin_key'
export const setResearchKey = (k: string) => sessionStorage.setItem(KEY_STORAGE, k)
export const getResearchKey = () => sessionStorage.getItem(KEY_STORAGE) || ''
export const clearResearchKey = () => sessionStorage.removeItem(KEY_STORAGE)
const authHeaders = (): Record<string, string> => {
  const k = getResearchKey()
  return k ? { 'X-Research-Key': k } : {}
}

// Authenticated file download (sends the passcode header, no key in the URL).
async function downloadFile(url: string, filename: string) {
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

export const researchApi = {
  getStudy: () => request<Study>(`${P}/study`),

  // Participant lifecycle
  enroll: () => request<Participant>(`${P}/participants`, { method: 'POST' }),
  register: (full_name: string, email: string) =>
    request<Participant>(`${P}/participants/register`, {
      method: 'POST', body: JSON.stringify({ full_name, email }),
    }),
  login: (email: string) =>
    request<Participant>(`${P}/participants/login`, {
      method: 'POST', body: JSON.stringify({ email }),
    }),
  getParticipant: (id: number) => request<any>(`${P}/participants/${id}`),
  listParticipants: () => request<Participant[]>(`${P}/participants`),
  consent: (id: number, signature: string) =>
    request<Participant>(`${P}/participants/${id}/consent`, {
      method: 'POST', body: JSON.stringify({ signature, agreed: true }),
    }),
  setDemographics: (id: number, data: Partial<Participant>) =>
    request<Participant>(`${P}/participants/${id}/demographics`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),
  complete: (id: number) =>
    request<Participant>(`${P}/participants/${id}/complete`, { method: 'POST' }),

  // Data capture
  recordAttempt: (id: number, payload: TaskAttemptPayload) =>
    request<any>(`${P}/participants/${id}/task-attempts`, {
      method: 'POST', body: JSON.stringify(payload),
    }),
  recordEvents: (id: number, events: TelemetryEvent[]) =>
    request<any>(`${P}/participants/${id}/events`, {
      method: 'POST', body: JSON.stringify({ events }),
    }),
  recordWorkload: (id: number, payload: WorkloadPayload) =>
    request<any>(`${P}/participants/${id}/workload`, {
      method: 'POST', body: JSON.stringify(payload),
    }),
  recordQualitative: (id: number, responses: QualitativePayload[]) =>
    request<any>(`${P}/participants/${id}/qualitative`, {
      method: 'POST', body: JSON.stringify({ responses }),
    }),
  recordUsability: (id: number, payload: UsabilityPayload) =>
    request<any>(`${P}/participants/${id}/usability`, {
      method: 'POST', body: JSON.stringify(payload),
    }),
  recordExploration: (id: number, payload: ExplorationPayload) =>
    request<any>(`${P}/participants/${id}/exploration`, {
      method: 'POST', body: JSON.stringify(payload),
    }),
  setStylePreference: (id: number, choice: 'neon' | 'generic') =>
    request<Participant>(`${P}/participants/${id}/style-preference`, {
      method: 'POST', body: JSON.stringify({ choice }),
    }),

  // Researcher analytics
  checkAuth: (key: string) =>
    request<{ ok: boolean }>(`${P}/auth/check`, { headers: { 'X-Research-Key': key } }),
  getSummary: () => request<Summary>(`${P}/results/summary`, { headers: authHeaders() }),
  getUsability: () => request<UsabilitySummary>(`${P}/results/usability`, { headers: authHeaders() }),
  getExploration: () => request<ExplorationSummary>(`${P}/results/exploration`, { headers: authHeaders() }),
  getRoster: () => request<RosterRow[]>(`${P}/participants/roster`, { headers: authHeaders() }),
  listQualitative: () => request<QualitativeRow[]>(`${P}/qualitative`, { headers: authHeaders() }),
  codeQualitative: (qid: number, data: { code?: string; theme?: string }) =>
    request<QualitativeRow>(`${P}/qualitative/${qid}/coding`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(data),
    }),
  downloadCsv: () => downloadFile(`${P}/results/export.csv`, 'ehr_study_results.csv'),
  downloadJson: () => downloadFile(`${P}/results/export.json`, 'ehr_study_results.json'),
}
