// Types for the comparative EHR usability study (mirrors backend study payload).

export type InterfaceArm = 'traditional' | 'relational'
export type ConditionOrder = 'traditional_first' | 'relational_first'
export type ParticipantStatus = 'enrolled' | 'in_progress' | 'completed' | 'withdrawn'

export interface PatientDemographics {
  name: string; mrn: string; sex: string; dob: string; age: number
}
export interface Problem {
  id: string; name: string; onset: string; status: string; med_ids: string[]
}
export interface Medication {
  id: string; name: string; dose: string; sig: string; treats: string
  allergy_conflict?: string
}
export interface Allergy {
  id: string; substance: string; reaction: string; severity: string
}
export interface Encounter {
  id: string; date: string; type: string; reason: string; provider: string; lab_ids: string[]
}
export interface Lab {
  id: string; name: string; value: string; unit: string; date: string
  flag: string; encounter_id: string
}
export interface Referral {
  id: string; date: string; specialty: string; provider: string; reason: string; problem_id: string
}
export interface Patient {
  demographics: PatientDemographics
  problems: Problem[]
  medications: Medication[]
  allergies: Allergy[]
  encounters: Encounter[]
  labs: Lab[]
  referrals: Referral[]
}

export interface Task { key: string; title: string; prompt: string; options: string[] }
export interface TlxDimension {
  key: string; label: string; question: string; low: string; high: string
}
export interface QualPrompt { key: string; prompt: string }
export interface ConsentSection { heading: string; body: string }
export interface Consent {
  title: string; version: string; sections: ConsentSection[]; agreement: string
}

// ── Usability instruments (SUS + Nielsen heuristics + design + function) ──
export interface ScaleDef { min: number; max: number; low: string; high: string }
export interface SusItem { key: string; text: string }
export interface HeuristicItem { key: string; name: string; desc: string }
export interface DesignDimension { key: string; label: string; question: string }
export interface FunctionPrompt { key: string; prompt: string }
export interface UsabilityBlock {
  intro: string
  sus: { scale: ScaleDef; items: SusItem[] }
  heuristics: { scale: ScaleDef; items: HeuristicItem[] }
  design: { scale: ScaleDef; dimensions: DesignDimension[] }
  function_prompts: FunctionPrompt[]
}
export interface StudyMeta {
  title: string; subtitle: string; principal_investigator: string
  institution: string; design: string; arms: string[]
}
export interface Study {
  meta: StudyMeta
  patient: Patient
  tasks: Task[]
  tlx_dimensions: TlxDimension[]
  qual_prompts: { per_interface: QualPrompt[]; closing: QualPrompt[] }
  usability: UsabilityBlock
  consent: Consent
}

export interface Participant {
  id: number
  participant_code: string
  full_name?: string | null
  email?: string | null
  role?: string | null
  specialty?: string | null
  years_experience?: number | null
  primary_ehr?: string | null
  ehr_hours_per_week?: number | null
  age_range?: string | null
  style_preference?: string | null
  consent_given: boolean
  condition_order: ConditionOrder
  status: ParticipantStatus
  started_at?: string | null
  completed_at?: string | null
  created_at: string
}

// ── Telemetry / capture payloads ──
export interface TelemetryEvent {
  interface: InterfaceArm
  event_type: string
  target?: string
  task_key?: string
  t_offset_ms: number
}
export interface TaskAttemptPayload {
  interface: InterfaceArm
  task_key: string
  submitted_answer?: string
  duration_ms: number
  click_count: number
  completed: boolean
}
export interface WorkloadPayload {
  interface: InterfaceArm
  mental_demand: number
  physical_demand: number
  temporal_demand: number
  performance: number
  effort: number
  frustration: number
}
export interface QualitativePayload {
  interface?: InterfaceArm | null
  prompt_key: string
  prompt?: string
  response?: string
}
export interface UsabilityPayload {
  target?: string
  sus_responses: Record<string, number>
  heuristic_ratings: Record<string, number>
  heuristic_comments?: Record<string, string>
  design_ratings: Record<string, number>
  most_valuable?: string
  missing_functions?: string
  friction?: string
  general_comments?: string
}
export interface ExplorationPayload {
  style: 'neon' | 'generic'
  order_index: number
  duration_ms: number
  scroll_depth_pct: number
  click_count: number
  relational_clicks: number
  nonrelational_clicks: number
  relational_attention_ms: number
  nonrelational_attention_ms: number
  mouse_distance_px: number
  gaze_available: boolean
}

// ── Analytics ──
export interface PairedStat {
  n: number
  mean_traditional?: number
  mean_relational?: number
  mean_diff?: number
  sd_diff?: number
  se_diff?: number
  t?: number | null
  df?: number
  cohens_dz?: number | null
  ci95_approx?: [number, number] | null
}
export interface InterfaceAgg {
  n_attempts: number
  accuracy_pct: number | null
  mean_duration_ms: number | null
  mean_duration_sec: number | null
  mean_clicks: number | null
  tlx: Record<string, number | null> & { n: number }
}
export interface TaskAgg {
  key: string; title: string
  traditional: { n: number; accuracy_pct: number | null; mean_duration_sec: number | null }
  relational: { n: number; accuracy_pct: number | null; mean_duration_sec: number | null }
}
export interface Summary {
  n_participants: number
  n_completed: number
  by_interface: { traditional: InterfaceAgg; relational: InterfaceAgg }
  paired: { raw_tlx: PairedStat; duration_sec: PairedStat; accuracy_pct: PairedStat }
  tasks: TaskAgg[]
}

// ── Usability analytics ──
export interface SusSummary {
  n: number
  mean: number | null
  sd: number | null
  min: number | null
  max: number | null
  grade: string | null
  adjective: string | null
}
export interface HeuristicAgg { key: string; name: string; n: number; mean: number | null; sd: number | null }
export interface DesignAgg { key: string; label: string; n: number; mean: number | null; sd: number | null }
export interface UsabilityFeedbackRow {
  participant_id: number
  most_valuable?: string | null
  missing_functions?: string | null
  friction?: string | null
  general_comments?: string | null
}
export interface UsabilitySummary {
  n: number
  sus: SusSummary
  heuristics: HeuristicAgg[]
  design: DesignAgg[]
  feedback: UsabilityFeedbackRow[]
}

// ── Exploration analytics ──
export interface ExplorationStyleAgg {
  style: string
  n: number
  mean_duration_sec: number | null
  mean_scroll_pct: number | null
  mean_clicks: number | null
  relational_attention_pct: number | null
  relational_clicks_pct: number | null
}
export interface ExplorationSummary {
  n: number
  by_style: ExplorationStyleAgg[]
  relational_attention_pct: number | null
  relational_clicks_pct: number | null
  preference: { neon: number; generic: number }
}

export interface QualitativeRow {
  id: number
  participant_id: number
  interface?: InterfaceArm | null
  prompt_key: string
  prompt?: string
  response?: string
  code?: string | null
  theme?: string | null
  created_at: string
}

export interface RosterRow {
  id: number
  participant_code: string
  full_name?: string | null
  email?: string | null
  role?: string | null
  specialty?: string | null
  status: ParticipantStatus
  condition_order: ConditionOrder
  started_at?: string | null
  completed_at?: string | null
  created_at: string
  n_attempts: number
  n_workload: number
  n_qualitative: number
  n_usability: number
  sus_score?: number | null
}
