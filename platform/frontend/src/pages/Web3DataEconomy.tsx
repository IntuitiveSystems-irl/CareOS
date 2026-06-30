import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, Shield, FileCheck, Zap, ArrowRight, ChevronDown, ChevronRight,
  Lock, Database, Coins, Activity, AlertTriangle, CheckCircle2, Circle,
  QrCode, Building2, FlaskConical, ClipboardCheck, ExternalLink, ArrowUpRight,
} from 'lucide-react'

// ── Flow steps ────────────────────────────────────────────────────────────────

const FLOW_STEPS = [
  {
    n: '01', icon: QrCode, color: '#c4ff4d', label: 'Universal Member ID',
    detail: 'Patient receives a QR-scannable alphanumeric member code (e.g. COS-A3X7-K2PQ). No PHI on the code — it resolves to a secure identity token via CareOS. Optionally linked to a self-custody wallet or DID.',
  },
  {
    n: '02', icon: Building2, color: '#4d80ff', label: 'Hospital EHR Intake via SMART on FHIR',
    detail: 'At registration, the hospital scans or enters the member ID. CareOS CDS Hooks returns a card to the EHR: "Patient is enrolled in the CareOS research participation network." — all via standard FHIR/CDS Hooks.',
  },
  {
    n: '03', icon: FileCheck, color: '#ffd23f', label: 'HIPAA Authorization + Research Consent',
    detail: 'Patient reviews: what data, which approved research sponsor, purpose, compensation amount, duration, and revocation terms. A FHIR Consent resource is created. This is a full HIPAA authorization for research use — not casual consent. No treatment penalty for declining.',
  },
  {
    n: '04', icon: Database, color: '#ff6b5b', label: 'FHIR Data Package',
    detail: 'If approved, CareOS assembles a US Core R4 FHIR Bundle: Patient, Encounter, Condition, Observation, MedicationRequest, DiagnosticReport, Procedure, Provenance, Consent. PHI stays in the encrypted off-chain vault.',
  },
  {
    n: '05', icon: Shield, color: '#9ee3db', label: 'Smart Contract Anchor',
    detail: 'The consent hash (SHA-256 of agreement metadata — no PHI) is anchored to the CareOSEscrow smart contract on Polygon. The contract holds the USDC compensation in escrow. Only the hash, agreement ID, and bundle hash go on-chain.',
  },
  {
    n: '06', icon: Coins, color: '#c4ff4d', label: 'Research Compensation Release',
    detail: 'Once consent is valid, data is delivered, and compliance checks pass — the platform calls release() on the smart contract. USDC transfers directly to the patient wallet. Fiat rails (ACH/prepaid card) also supported.',
  },
]

const PARTICIPATION_TASKS = [
  { icon: FlaskConical, label: 'Lab-Linked Research Survey', reward: '$2–5', desc: 'Confirm symptoms or context for an approved research protocol linked to today\'s lab study.' },
  { icon: ClipboardCheck, label: 'Medication List Verification', reward: '$3–8', desc: 'Verify accuracy of your current medication list for research data quality. Clinician validates.' },
  { icon: Activity, label: 'Patient-Reported Outcome', reward: '$1–4', desc: 'Submit a symptom diary, pain scale, or wearable reading as part of an approved study.' },
  { icon: FileCheck, label: 'Longitudinal Follow-Up', reward: '$2–6', desc: 'Complete a follow-up survey after your visit as part of an ongoing research cohort.' },
]

const COMPLIANCE_ITEMS = [
  { met: true,  label: 'Explicit HIPAA authorization (not casual consent)' },
  { met: true,  label: 'No treatment penalty for declining' },
  { met: true,  label: 'Tamper-evident audit log (SHA-256 hash chain)' },
  { met: true,  label: 'Minimum necessary access (per-resource scoping)' },
  { met: true,  label: 'Revocation at any time — contract refunds research sponsor' },
  { met: true,  label: 'PHI never on-chain — only hashes and IDs' },
  { met: true,  label: 'FHIR Consent resource for every authorization' },
  { met: 'wip', label: 'BAA with hospital partners (template ready)' },
  { met: 'wip', label: 'IRB pathway for research-purpose data use' },
  { met: 'wip', label: 'De-identification pipeline (Safe Harbor / Expert Determination)' },
]

const ON_CHAIN = [
  { label: 'Consent hash', value: '0x sha256(agreement_id | member | sponsor | purpose_hash | ts)' },
  { label: 'Agreement ID', value: 'CareOS off-chain DB reference' },
  { label: 'Bundle hash', value: '0x sha256(FHIR bundle metadata)' },
  { label: 'Payment amount', value: 'USDC units' },
  { label: 'Status flags', value: 'Funded → Consent → Delivery → Released | Revoked' },
  { label: 'Timestamps', value: 'block.timestamp for each state transition' },
]

const OFF_CHAIN = [
  'Patient name, DOB, MRN — all PHI',
  'FHIR resources (encrypted vault)',
  'Data Use Agreement full text',
  'Buyer org details',
  'Payment rails / ACH info',
]

// ── Sub-components ────────────────────────────────────────────────────────────

function FlowStep({ step, last }: { step: typeof FLOW_STEPS[0]; last: boolean }) {
  const [open, setOpen] = useState(false)
  const Icon = step.icon
  return (
    <div className="flex gap-5">
      <div className="flex flex-col items-center">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: step.color }}>
          <Icon className="w-5 h-5 text-[#111]" />
        </div>
        {!last && <div className="w-px flex-1 mt-3" style={{ background: 'rgba(255,255,255,0.1)' }} />}
      </div>
      <div className="pb-8 flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">{step.n}</span>
          <h3 className="text-[16px] font-bold text-white">{step.label}</h3>
        </div>
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/70 transition mb-1">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {open ? 'Hide detail' : 'Show detail'}
        </button>
        {open && <p className="text-[13px] text-white/65 leading-relaxed mt-1">{step.detail}</p>}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Web3DataEconomy() {
  return (
    <div className="antialiased bg-[#0a0a0a] text-white min-h-screen selection:bg-[#c4ff4d] selection:text-[#111]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }
      `}</style>

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/8" style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(18px)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 sm:px-10 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#c4ff4d] flex items-center justify-center">
              <Wallet className="w-4 h-4 text-[#111]" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold text-white">CareOS</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/30 font-semibold">Data Economy</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-[13px] font-medium text-white/50">
            <Link to="/" className="hover:text-white transition">Home</Link>
            <Link to="/order-flow" className="hover:text-white transition">Order Flow</Link>
            <Link to="/relational-cds" className="hover:text-white transition">Relational CDS</Link>
            <Link to="/fhir-standards" className="hover:text-white transition">FHIR Standards</Link>
            <Link to="/research" className="hover:text-white transition">Research</Link>
            <span className="w-px h-4 bg-white/15" />
            <Link to="/web3" className="text-[#c4ff4d] font-semibold">Data Economy</Link>
          </nav>
          <a href="https://launchflow.tech/web3/patient/demo" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#c4ff4d] text-[#111] text-[13px] font-bold hover:bg-white transition">
            Try Demo <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: '#c4ff4d' }} />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-8 blur-3xl" style={{ background: '#4d80ff' }} />
        </div>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 pt-20 pb-20 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#c4ff4d]/30 bg-[#c4ff4d]/10 text-[#c4ff4d] text-[11px] uppercase tracking-[0.16em] font-bold mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c4ff4d] animate-pulse" />
            Polygon · USDC · FHIR R4 · HIPAA
          </div>
          <h1 className="text-[48px] sm:text-[72px] leading-[0.92] tracking-[-0.03em] max-w-4xl mb-8">
            Patient-Controlled<br />
            <span style={{ color: '#c4ff4d' }}>Research Participation Network</span>
          </h1>
          <p className="text-[18px] text-white/60 max-w-2xl leading-relaxed mb-10">
            Patients authorize approved research use, verify records, and complete optional participation tasks.
            Smart contracts hold compensation in escrow and release automatically after consent, delivery, and validation.
            PHI never touches the blockchain.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#flow" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#c4ff4d] text-[#111] text-[14px] font-bold hover:bg-white transition">
              See how it works <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#contract" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-white/20 text-white text-[14px] font-semibold hover:bg-white/10 transition">
              View smart contract <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-3 mt-12">
            {[
              { label: 'PHI on-chain', value: 'Zero' },
              { label: 'Payment network', value: 'Polygon USDC' },
              { label: 'FHIR standard', value: 'US Core R4' },
              { label: 'Consent model', value: 'HIPAA Authorization' },
              { label: 'Audit chain', value: 'SHA-256 tamper-evident' },
            ].map(s => (
              <div key={s.label} className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5">
                <div className="text-[13px] font-bold text-white">{s.value}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-[0.1em]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two-column: flow + on/off chain */}
      <section id="flow" className="max-w-6xl mx-auto px-6 sm:px-10 py-16 grid lg:grid-cols-2 gap-16">
        {/* Flow */}
        <div>
          <h2 className="text-[28px] font-bold tracking-tight mb-10">How it works</h2>
          {FLOW_STEPS.map((step, i) => (
            <FlowStep key={step.n} step={step} last={i === FLOW_STEPS.length - 1} />
          ))}
        </div>

        {/* What goes on vs off chain */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/4 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#c4ff4d] flex items-center justify-center">
                <Lock className="w-3.5 h-3.5 text-[#111]" />
              </div>
              <h3 className="text-[16px] font-bold">What goes on-chain</h3>
            </div>
            <p className="text-[12px] text-white/40 mb-4">Polygon smart contract — public, verifiable, no PHI</p>
            <div className="space-y-2.5">
              {ON_CHAIN.map(item => (
                <div key={item.label} className="flex gap-3 text-[12px]">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#c4ff4d]" />
                  <div>
                    <span className="font-semibold text-white">{item.label}</span>
                    <span className="text-white/40"> — {item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              </div>
              <h3 className="text-[16px] font-bold">What stays off-chain</h3>
            </div>
            <p className="text-[12px] text-white/40 mb-4">Encrypted CareOS vault — HIPAA-compliant, never blockchain</p>
            <div className="space-y-2">
              {OFF_CHAIN.map(item => (
                <div key={item} className="flex gap-3 text-[12px]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
                  <span className="text-white/60">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Architecture diagram */}
          <div className="rounded-2xl border border-white/8 bg-[#111] p-6 font-mono text-[11px] text-white/50 leading-relaxed">
            <div className="text-[#c4ff4d] font-bold mb-3 text-[12px]">Architecture</div>
            <pre>{`Patient App / Wallet
      │
Universal Member ID (COS-XXXX-XXXX)
      │
Hospital EHR Intake → CDS Hooks Card
      │
HIPAA Auth + FHIR Consent Resource
      │
FHIR Data Access Layer (US Core R4)
      │
Compliance / DUA Engine
      │
Off-chain Encrypted Vault
      │
CareOSEscrow.sol (Polygon)
      │
Patient USDC Wallet / ACH Payout`}</pre>
          </div>
        </div>
      </section>

      {/* Order Participation */}
      <section className="border-t border-white/8">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
          <div className="max-w-xl mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#4d80ff]/15 border border-[#4d80ff]/30 text-[#4d80ff] text-[11px] uppercase tracking-[0.14em] font-bold mb-5">
              <Activity className="w-3 h-3" /> Optional Participation
            </div>
            <h2 className="text-[28px] font-bold tracking-tight mb-4">Paid Research & Record Verification Tasks</h2>
            <p className="text-[15px] text-white/55 leading-relaxed">
              Patients are invited to optional research activities linked to approved protocols.
              Clinician or research coordinator validates completion → FHIR Provenance logged → compensation released.
              Patients may decline any task without affecting their care.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PARTICIPATION_TASKS.map(t => {
              const Icon = t.icon
              return (
                <div key={t.label} className="rounded-2xl border border-white/8 bg-white/4 p-5">
                  <div className="w-9 h-9 rounded-xl bg-[#4d80ff]/20 flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4 text-[#4d80ff]" />
                  </div>
                  <div className="text-[14px] font-bold mb-1">{t.label}</div>
                  <div className="text-[20px] font-bold text-[#c4ff4d] mb-2">{t.reward}</div>
                  <p className="text-[12px] text-white/45 leading-relaxed">{t.desc}</p>
                </div>
              )
            })}
          </div>

          {/* Guardrail callout */}
          <div className="mt-8 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-6 flex gap-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-[14px] font-bold text-amber-300 mb-2">IRB guardrails</div>
              <p className="text-[13px] text-white/55 leading-relaxed max-w-3xl">
                Patients are compensated for <strong className="text-white">voluntary research participation, record verification,
                patient-reported outcomes, and longitudinal study tasks</strong> — never for accepting a medication,
                selecting a procedure, or influencing a clinical decision.
                Compensation amounts and timing are subject to IRB review per 45 CFR 46 and FDA guidelines.
                Participation is always optional. No treatment is conditioned on participation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Smart contract */}
      <section id="contract" className="border-t border-white/8 bg-[#060606]">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
          <h2 className="text-[28px] font-bold tracking-tight mb-2">CareOSEscrow.sol</h2>
          <p className="text-[14px] text-white/45 mb-8">Polygon · Solidity ^0.8.20 · USDC (ERC-20)</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[
              { label: 'fund()', color: '#4d80ff', desc: 'Buyer deposits USDC + consent hash into escrow' },
              { label: 'confirmConsent()', color: '#c4ff4d', desc: 'Platform anchors patient signature on-chain' },
              { label: 'confirmDelivery()', color: '#ffd23f', desc: 'Platform logs FHIR bundle hash + record count' },
              { label: 'release()', color: '#c4ff4d', desc: 'USDC transfers to patient wallet automatically' },
              { label: 'revoke()', color: '#ff6b5b', desc: 'Patient or platform triggers refund to buyer at any time' },
              { label: 'statusOf()', color: '#9ee3db', desc: 'Read escrow state: Funded→Consent→Delivery→Released' },
            ].map(fn => (
              <div key={fn.label} className="rounded-xl border border-white/8 bg-white/4 p-4">
                <div className="font-mono text-[13px] font-bold mb-2" style={{ color: fn.color }}>{fn.label}</div>
                <p className="text-[12px] text-white/45">{fn.desc}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#111] p-6 font-mono text-[11px] text-white/55 overflow-x-auto">
            <div className="text-[#c4ff4d] mb-2">// State machine — no PHI ever touches this contract</div>
            <div className="text-white/30">enum Status {'{'} Empty, Funded, ConsentConfirmed, DeliveryConfirmed, Released, Refunded, Revoked {'}'}</div>
            <div className="mt-3 text-white/30">// On-chain fields per escrow:</div>
            <div>consentHash  <span className="text-white/30">// sha256(agreement_id | member | buyer | purpose | ts)</span></div>
            <div>bundleHash   <span className="text-white/30">// sha256(FHIR bundle metadata)</span></div>
            <div>amount       <span className="text-white/30">// USDC wei</span></div>
            <div>status       <span className="text-white/30">// Status enum</span></div>
            <div>timestamps   <span className="text-white/30">// fundedAt, consentAt, deliveryAt, releasedAt</span></div>
          </div>
          <div className="mt-4 flex items-center gap-3 text-[12px] text-white/35">
            <span>Contract source:</span>
            <code className="px-2 py-0.5 rounded bg-white/8 text-white/60">platform/contracts/CareOSEscrow.sol</code>
            <span>·</span>
            <span>Deployment pending Alchemy RPC config</span>
          </div>
        </div>
      </section>

      {/* Compliance */}
      <section className="border-t border-white/8">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
          <h2 className="text-[28px] font-bold tracking-tight mb-2">Compliance & HIPAA Guardrails</h2>
          <p className="text-[14px] text-white/45 mb-8">HIPAA generally restricts sale of PHI without patient authorization. Every item below is enforced.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {COMPLIANCE_ITEMS.map(item => (
              <div key={item.label} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-white/3">
                {item.met === true
                  ? <CheckCircle2 className="w-4 h-4 shrink-0 text-[#c4ff4d]" />
                  : <Circle className="w-4 h-4 shrink-0 text-amber-400" />}
                <span className="text-[13px] text-white/70">{item.label}</span>
                {item.met === 'wip' && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold uppercase">WIP</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API preview */}
      <section className="border-t border-white/8 bg-[#060606]">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
          <h2 className="text-[28px] font-bold tracking-tight mb-2">API Endpoints</h2>
          <p className="text-[14px] text-white/45 mb-8">All endpoints live at <code className="text-[#c4ff4d]">/web3/*</code> — FHIR-adjacent, audited, HIPAA-compliant.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { method: 'POST', path: '/web3/member-id', desc: 'Issue patient universal member ID' },
              { method: 'GET',  path: '/web3/member-id/{code}', desc: 'Resolve member code (no PHI)' },
              { method: 'POST', path: '/web3/agreements', desc: 'Buyer creates DUA offer' },
              { method: 'POST', path: '/web3/agreements/{id}/sign', desc: 'Patient signs → consent hash' },
              { method: 'POST', path: '/web3/agreements/{id}/revoke', desc: 'Patient revokes consent' },
              { method: 'POST', path: '/web3/escrow/{id}/release', desc: 'Trigger USDC payment release' },
              { method: 'POST', path: '/web3/participations', desc: 'Offer patient a paid task' },
              { method: 'POST', path: '/web3/participations/{id}/validate', desc: 'Clinician validates contribution' },
              { method: 'GET',  path: '/web3/patient/{id}/dashboard', desc: 'Patient earnings dashboard' },
              { method: 'GET',  path: '/web3/cds-card/{code}', desc: 'CDS Hooks card for EHR intake' },
            ].map(ep => {
              const mc: Record<string, string> = { GET: '#4d80ff', POST: '#c4ff4d', PUT: '#ffd23f', DELETE: '#ff6b5b' }
              return (
                <div key={ep.path} className="rounded-xl border border-white/8 bg-white/3 px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${mc[ep.method]}22`, color: mc[ep.method] }}>{ep.method}</span>
                    <code className="text-[11px] text-white/60">{ep.path}</code>
                  </div>
                  <p className="text-[11px] text-white/35">{ep.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/8">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20 text-center">
          <h2 className="text-[36px] sm:text-[52px] font-bold tracking-[-0.02em] mb-6">
            The grant framing:<br />
            <span style={{ color: '#c4ff4d' }}>compensate patients for contributing to public-interest research.</span>
          </h2>
          <p className="text-[16px] text-white/55 max-w-2xl mx-auto leading-relaxed mb-10">
            A patient-controlled consent and compensation layer for approved research use,
            integrated into hospital EHR workflows through FHIR, CDS Hooks, and SMART on FHIR.
            QR-based digital intake · Patient-controlled consent · Research recruitment ·
            Patient-reported outcomes · Secure compensation for participation.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/fhir-standards" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#c4ff4d] text-[#111] text-[14px] font-bold hover:bg-white transition">
              FHIR Conformance Explorer <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-white/20 text-white text-[14px] font-semibold hover:bg-white/10 transition">
              Back to CareOS <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 bg-[#060606]">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-[14px] font-bold mb-1">CareOS · by LaunchFlow</div>
            <div className="text-[11px] text-white/30">Business Intuitive Inc. · Seattle, WA · launchflow.tech</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'FHIR R4', url: 'https://hl7.org/fhir/R4/' },
              { label: 'US Core', url: 'https://hl7.org/fhir/us/core/' },
              { label: 'Polygon', url: 'https://polygon.technology' },
              { label: 'USDC', url: 'https://www.circle.com/usdc' },
              { label: 'HIPAA', url: 'https://www.hhs.gov/hipaa/' },
            ].map(l => (
              <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/8 text-[11px] text-white/50 hover:text-white hover:bg-white/15 transition">
                {l.label} <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
