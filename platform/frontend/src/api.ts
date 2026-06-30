const BASE = ''

// ── Clinician session (localStorage) ──
const CLINICIAN_KEY = 'careos_clinician'

export interface ClinicianSession {
  token: string
  clinician: any
}

export function getClinicianSession(): ClinicianSession | null {
  try {
    const raw = localStorage.getItem(CLINICIAN_KEY)
    return raw ? (JSON.parse(raw) as ClinicianSession) : null
  } catch {
    return null
  }
}

export function setClinicianSession(session: ClinicianSession) {
  localStorage.setItem(CLINICIAN_KEY, JSON.stringify(session))
}

export function clearClinicianSession() {
  localStorage.removeItem(CLINICIAN_KEY)
}

function clinicianAuthHeaders(): Record<string, string> {
  const s = getClinicianSession()
  return s?.token ? { 'X-Clinician-Token': s.token } : {}
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  // Patients
  getPatients: () => request<any[]>('/api/patients'),
  getPatient: (id: number) => request<any>(`/api/patients/${id}`),
  getPatientRecords: (id: number) => request<any>(`/api/patients/${id}/records`),

  // Organizations
  getOrganizations: () => request<any[]>('/api/organizations'),
  getOrganization: (id: number) => request<any>(`/api/organizations/${id}`),
  createOrganization: (data: Record<string, any>) =>
    request<any>('/api/organizations', { method: 'POST', body: JSON.stringify(data) }),
  updateOrganization: (id: number, data: Record<string, any>) =>
    request<any>(`/api/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOrganization: (id: number) =>
    fetch(`/api/organizations/${id}`, { method: 'DELETE' }).then((r) => {
      if (!r.ok) throw new Error('Delete failed')
    }),

  // Access Requests
  getAccessRequests: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<any[]>(`/api/access-requests${qs}`)
  },
  createAccessRequest: (data: {
    patient_id: number; requesting_org_id: number; purpose?: string;
    scopes?: string; use_type?: string; secondary_purpose?: string;
  }) =>
    request<any>('/api/access-requests', { method: 'POST', body: JSON.stringify(data) }),
  updateAccessRequest: (id: number, data: {
    status: string; approved_time_window?: string;
    approved_duration?: string; approved_categories?: string;
  }) =>
    request<any>(`/api/access-requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Clinical Notes
  getClinicalNotes: (patientId?: number) => {
    const qs = patientId ? `?patient_id=${patientId}` : ''
    return request<any[]>(`/api/clinical-notes${qs}`)
  },
  updateClinicalNote: (id: number, data: { status?: string; patient_comments?: string }) =>
    request<any>(`/api/clinical-notes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Payments
  createPayment: (data: { access_request_id: number }) =>
    request<any>('/api/payments', { method: 'POST', body: JSON.stringify(data) }),

  // Notifications
  getNotifications: (patientId?: number, unreadOnly?: boolean) => {
    const params = new URLSearchParams()
    if (patientId) params.set('patient_id', String(patientId))
    if (unreadOnly) params.set('unread_only', 'true')
    const qs = params.toString() ? `?${params.toString()}` : ''
    return request<any[]>(`/api/notifications${qs}`)
  },
  markNotificationRead: (id: number) =>
    request<any>(`/api/notifications/${id}`, { method: 'PATCH', body: JSON.stringify({ read: true }) }),

  // Access Logs
  getAccessLogs: (patientId?: number) => {
    const qs = patientId ? `?patient_id=${patientId}` : ''
    return request<any[]>(`/api/access-logs${qs}`)
  },

  // FHIR
  getFhirPatient: (patientId: number, orgId: number) =>
    request<any>(`/fhir/Patient/${patientId}?org_id=${orgId}`),
  getFhirConditions: (patientId: number, orgId: number) =>
    request<any>(`/fhir/Condition?patient=${patientId}&org_id=${orgId}`),
  getFhirMedications: (patientId: number, orgId: number) =>
    request<any>(`/fhir/MedicationRequest?patient=${patientId}&org_id=${orgId}`),
  getFhirAllergies: (patientId: number, orgId: number) =>
    request<any>(`/fhir/AllergyIntolerance?patient=${patientId}&org_id=${orgId}`),
  getFhirObservations: (patientId: number, orgId: number) =>
    request<any>(`/fhir/Observation?patient=${patientId}&org_id=${orgId}`),
  getFhirEncounters: (patientId: number, orgId: number) =>
    request<any>(`/fhir/Encounter?patient=${patientId}&org_id=${orgId}`),

  // SMART on FHIR
  getSmartConfig: () => request<any>('/.well-known/smart-configuration'),
  getFhirCapability: () => request<any>('/fhir/metadata'),

  // Patient Portal
  getPatientAccessLog: (patientId: number, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<any[]>(`/api/patient/${patientId}/access-log${qs}`)
  },
  getPatientNotes: (patientId: number) =>
    request<any[]>(`/api/patient/${patientId}/notes`),
  getPatientNote: (patientId: number, noteId: number) =>
    request<any>(`/api/patient/${patientId}/notes/${noteId}`),
  submitNoteReview: (patientId: number, noteId: number, data: { status: string; comment?: string }) =>
    request<any>(`/api/patient/${patientId}/notes/${noteId}/review`, { method: 'POST', body: JSON.stringify(data) }),
  getNoteReviews: (patientId: number, noteId: number) =>
    request<any[]>(`/api/patient/${patientId}/notes/${noteId}/reviews`),

  // AI Layer
  aiExplainConsent: (data: {
    organization_name: string; purpose: string; scopes?: string;
    patient_name?: string; use_type?: string; secondary_purpose?: string;
  }) =>
    request<any>('/ai/consent/explain', { method: 'POST', body: JSON.stringify(data) }),
  aiSummarizeData: (data: { patient_id: number; scopes?: string }) =>
    request<any>('/ai/consent/summarize-data', { method: 'POST', body: JSON.stringify(data) }),
  aiDecideConsent: (data: { consent_session_id: number; patient_id: number; decision: string; reason?: string }) =>
    request<any>('/ai/consent/decide', { method: 'POST', body: JSON.stringify(data) }),
  aiInitiateNfc: (data: { organization_id: number; patient_id: number; scopes?: string; purpose?: string }) =>
    request<any>('/ai/session/initiate-nfc', { method: 'POST', body: JSON.stringify(data) }),
  aiSessionStatus: (data: { session_token: string }) =>
    request<any>('/ai/session/status', { method: 'POST', body: JSON.stringify(data) }),
  aiTranslateNote: (data: { note_content: string; patient_name?: string }) =>
    request<any>('/ai/notes/translate', { method: 'POST', body: JSON.stringify(data) }),
  aiVerifyNote: (data: { note_content: string; patient_name?: string }) =>
    request<any>('/ai/notes/verify', { method: 'POST', body: JSON.stringify(data) }),

  // Destination Directory
  getDestinations: (kind?: string) => {
    const qs = kind ? `?kind=${kind}` : ''
    return request<any[]>(`/api/destinations${qs}`)
  },

  // Fulfillment Preferences
  getPreferences: (patientId: number) =>
    request<any>(`/api/patient/${patientId}/preferences`),
  updatePreferences: (patientId: number, data: Record<string, any>) =>
    request<any>(`/api/patient/${patientId}/preferences`, { method: 'POST', body: JSON.stringify(data) }),

  // Fulfillment Packets
  getPackets: (patientId: number) =>
    request<any[]>(`/api/patient/${patientId}/fulfillment/packets`),
  getPacket: (patientId: number, packetId: number) =>
    request<any>(`/api/patient/${patientId}/fulfillment/packets/${packetId}`),
  createPacket: (patientId: number, data: { encounter_id?: number; note_id?: number; organization_id?: number }) =>
    request<any>(`/api/patient/${patientId}/fulfillment/packets`, { method: 'POST', body: JSON.stringify(data) }),
  sendPacket: (patientId: number, packetId: number) =>
    request<any>(`/api/patient/${patientId}/fulfillment/packets/${packetId}/send`, { method: 'POST' }),

  // Fulfillment Tasks
  getTasks: (patientId: number, status?: string) => {
    const qs = status ? `?status=${status}` : ''
    return request<any[]>(`/api/patient/${patientId}/fulfillment/tasks${qs}`)
  },

  // Clinician Fulfillment View
  getClinicianPackets: (patientId: number) =>
    request<any[]>(`/api/clinician/patient/${patientId}/fulfillment/packets`),

  // AI Fulfillment
  aiFulfillmentSummarize: (data: { items_json: Record<string, any> }) =>
    request<any>('/ai/fulfillment/summarize', { method: 'POST', body: JSON.stringify(data) }),

  // EHR Vendor Adapters
  getEhrAdapterInfo: (orgId: number) =>
    request<any>(`/api/ehr-adapters/org/${orgId}/info`),
  getEhrSupportedResources: (orgId: number) =>
    request<any>(`/api/ehr-adapters/org/${orgId}/resources`),
  getEhrSmartConfig: (orgId: number) =>
    request<any>(`/api/ehr-adapters/org/${orgId}/smart-config`),
  getEhrMetadata: (orgId: number) =>
    request<any>(`/api/ehr-adapters/org/${orgId}/metadata`),
  getEhrConnectivityTest: () =>
    request<any>(`/api/ehr-adapters/connectivity-test`),
  fetchResourceViaAdapter: (orgId: number, resourceType: string, resourceId?: string) => {
    const qs = resourceId ? `?resource_id=${resourceId}` : ''
    return request<any>(`/api/ehr-adapters/org/${orgId}/fetch/${resourceType}${qs}`, { method: 'POST' })
  },

  // ── EHR OUTBOUND connect (SMART auth-code + PKCE) ──
  ehrConnectAllStatus: () =>
    request<{ connections: any[] }>(`/api/ehr-connect/status`),
  ehrConnectStatus: (orgId: number) =>
    request<any>(`/api/ehr-connect/org/${orgId}/status`),
  ehrConnectAuthorizeUrl: (orgId: number, redirectBack?: string) => {
    const qs = redirectBack ? `?redirect_back=${encodeURIComponent(redirectBack)}` : ''
    return request<any>(`/api/ehr-connect/org/${orgId}/authorize-url${qs}`, { method: 'POST' })
  },
  ehrConnectRefresh: (orgId: number) =>
    request<any>(`/api/ehr-connect/org/${orgId}/refresh`, { method: 'POST' }),
  ehrConnectDisconnect: (orgId: number) =>
    request<any>(`/api/ehr-connect/org/${orgId}/disconnect`, { method: 'POST' }),

  // ── Relational vs Standard clinician view ──
  relationalSources: () =>
    request<{ internal_patients: any[]; connections: any[] }>(`/api/relational/sources`),
  relationalLivePatients: (orgId: number, count = 20) =>
    request<{ patients: any[] }>(`/api/relational/org/${orgId}/patients?count=${count}`),
  relationalInternalChart: (patientId: number) =>
    request<any>(`/api/relational/chart/internal/${patientId}`, { headers: clinicianAuthHeaders() }),
  relationalLiveChart: (orgId: number, patientId: string) =>
    request<any>(`/api/relational/chart/org/${orgId}/${encodeURIComponent(patientId)}`, { headers: clinicianAuthHeaders() }),

  // ── Clinician management ──
  getClinicianRoles: () => request<{ roles: string[]; statuses: string[] }>(`/api/clinicians/roles`),
  getClinicians: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<any[]>(`/api/clinicians${qs}`)
  },
  getClinician: (id: number) => request<any>(`/api/clinicians/${id}`),
  createClinician: (data: Record<string, any>) =>
    request<any>('/api/clinicians', { method: 'POST', body: JSON.stringify(data) }),
  updateClinician: (id: number, data: Record<string, any>) =>
    request<any>(`/api/clinicians/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteClinician: (id: number) =>
    fetch(`/api/clinicians/${id}`, { method: 'DELETE' }).then((r) => {
      if (!r.ok) throw new Error('Delete failed')
    }),
  clinicianLogin: (email: string, password: string) =>
    request<{ token: string; clinician: any }>('/api/clinicians/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  clinicianMe: () => request<any>('/api/clinicians/me', { headers: clinicianAuthHeaders() }),

  // ── Patient feedback (patient voice) ──
  getPatientFeedback: (patientId: number, status?: string) => {
    const qs = status ? `?status=${status}` : ''
    return request<any[]>(`/api/patient/${patientId}/feedback${qs}`)
  },
  createPatientFeedback: (patientId: number, data: Record<string, any>) =>
    request<any>(`/api/patient/${patientId}/feedback`, { method: 'POST', body: JSON.stringify(data) }),
  getFeedbackInbox: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<any[]>(`/api/feedback${qs}`)
  },
  updateFeedback: (id: number, data: Record<string, any>) =>
    request<any>(`/api/feedback/${id}`, { method: 'PATCH', body: JSON.stringify(data), headers: clinicianAuthHeaders() }),

  // ── CDS Hooks ──
  cdsDiscovery: () => request<{ services: any[] }>(`/cds-services`),
  cdsInvoke: (serviceId: string, context: Record<string, any>, hook = 'patient-view') =>
    request<{ cards: any[] }>(`/cds-services/${serviceId}`, {
      method: 'POST',
      body: JSON.stringify({ hook, hookInstance: crypto.randomUUID(), context }),
    }),

  // ── Email / Marketing ──
  subscribe: (data: { email: string; name?: string; role?: string }) =>
    request<any>('/api/email/subscribe', { method: 'POST', body: JSON.stringify(data) }),
  contact: (data: { email: string; name: string; subject: string; message: string }) =>
    request<any>('/api/email/contact', { method: 'POST', body: JSON.stringify(data) }),

  // ── Order Workflow (MVP mediator loop) ──
  createOrder: (body: Record<string, unknown>) =>
    request<any>('/api/orders', { method: 'POST', body: JSON.stringify(body) }),
  listOrders: (params?: { patient_id?: number; organization_id?: number; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.patient_id) qs.set('patient_id', String(params.patient_id))
    if (params?.organization_id) qs.set('organization_id', String(params.organization_id))
    if (params?.status) qs.set('status', params.status)
    return request<any[]>(`/api/orders?${qs}`)
  },
  getStaffQueue: (organizationId?: number) => {
    const qs = organizationId ? `?organization_id=${organizationId}` : ''
    return request<any[]>(`/api/orders/queue${qs}`)
  },
  getOrder: (orderId: number) =>
    request<any>(`/api/orders/${orderId}`),
  updateOrder: (orderId: number, body: Record<string, unknown>) =>
    request<any>(`/api/orders/${orderId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  sendOrderToPatient: (orderId: number) =>
    request<any>(`/api/orders/${orderId}/send-to-patient`, { method: 'POST' }),
  transitionOrder: (orderId: number, newStatus: string) =>
    request<any>(`/api/orders/${orderId}/transition`, { method: 'POST', body: JSON.stringify({ new_status: newStatus }) }),
  patientPendingOrders: (patientId: number) =>
    request<any[]>(`/api/orders/patient/${patientId}/pending`),
  patientAllOrders: (patientId: number) =>
    request<any[]>(`/api/orders/patient/${patientId}/all`),
  patientAction: (orderId: number, body: Record<string, unknown>) =>
    request<any>(`/api/orders/${orderId}/patient-action`, { method: 'POST', body: JSON.stringify(body) }),
  getOrderTimeline: (orderId: number) =>
    request<any>(`/api/orders/${orderId}/timeline`),
}

/**
 * Connect to the patient's WebSocket for real-time notifications.
 * Returns the WebSocket instance for cleanup.
 */
export function connectPatientWs(
  patientId: number,
  onMessage: (msg: any) => void,
): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws/patient/${patientId}`)
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch {
      // ignore non-JSON messages
    }
  }
  ws.onclose = () => {
    // Auto-reconnect after 3 seconds
    setTimeout(() => connectPatientWs(patientId, onMessage), 3000)
  }
  return ws
}
