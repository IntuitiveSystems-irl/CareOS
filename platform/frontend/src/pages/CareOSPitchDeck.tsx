import { Link } from 'react-router-dom'
import {
  ArrowUpRight, Network, GitBranch,
  Activity, Lock,
  ClipboardList, Microscope, Pill as PillIcon, CheckCircle2,
  Building2,
} from 'lucide-react'

const BILLION_MIRACLES = `@font-face {
  font-family: 'Billion Miracles';
  src: url('https://db.onlinewebfonts.com/t/495562e2bd3c774f692a9eb5be3417d6.woff2') format('woff2'),
       url('https://db.onlinewebfonts.com/t/495562e2bd3c774f692a9eb5be3417d6.woff') format('woff'),
       url('https://db.onlinewebfonts.com/t/495562e2bd3c774f692a9eb5be3417d6.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}`

// ── Shared primitives ────────────────────────────────────────────────────────

function NavStrip({ center }: { center: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '22px 48px 0',
      fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase' as const,
      color: '#4d6fff', flexShrink: 0,
    }}>
      <span>CAREOS</span>
      <span style={{ color: '#4d6fff', opacity: .7 }}>{center}</span>
      <span>launchflow.tech</span>
    </div>
  )
}

function Rule() {
  return <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,.08)', flexShrink: 0, marginTop: 16 }} />
}

function SlideNum({ n }: { n: number }) {
  return (
    <div style={{
      position: 'absolute', bottom: 22, right: 48,
      fontSize: 10, fontWeight: 700, letterSpacing: '.14em',
      color: 'rgba(255,255,255,.18)',
    }}>{String(n).padStart(2,'0')} / 10</div>
  )
}

function Eyebrow({ children, lime }: { children: React.ReactNode; lime?: boolean }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase' as const,
      color: lime ? '#c4ff4d' : '#4d6fff', marginBottom: 14,
    }}>{children}</div>
  )
}

function Chip({ children, lime, blue }: { children: React.ReactNode; lime?: boolean; blue?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: lime ? 'rgba(196,255,77,.08)' : blue ? 'rgba(77,111,255,.08)' : 'rgba(255,255,255,.06)',
      border: `1px solid ${lime ? 'rgba(196,255,77,.25)' : blue ? 'rgba(77,111,255,.25)' : 'rgba(255,255,255,.1)'}`,
      borderRadius: 8, padding: '5px 11px',
      fontSize: 11, fontWeight: 600,
      color: lime ? '#c4ff4d' : blue ? '#8da8ff' : 'rgba(255,255,255,.75)',
      whiteSpace: 'nowrap' as const,
    }}>{children}</span>
  )
}

function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'rgba(196,255,77,.08)', border: '1px solid rgba(196,255,77,.2)',
      borderRadius: 100, padding: '5px 12px',
      fontSize: 11, fontWeight: 600, color: '#c4ff4d',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#c4ff4d', display: 'inline-block' }} />
      {children}
    </span>
  )
}

const Pill = TagPill

function StdRow({ name, status }: { name: string; status: 'live' | 'road' }) {
  const badge = status === 'live'
    ? { bg: 'rgba(34,160,107,.15)', color: '#22a06b', border: 'rgba(34,160,107,.3)', label: 'Live' }
    : { bg: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.4)', border: 'rgba(255,255,255,.12)', label: 'Phase 3' }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 14px', borderRadius: 10,
      background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)',
    }}>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{name}</span>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' as const,
        padding: '3px 9px', borderRadius: 100,
        background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
      }}>{badge.label}</span>
    </div>
  )
}

// ── Slide wrapper ────────────────────────────────────────────────────────────

function Slide({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{
      width: 1120, height: 630, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      background: '#0b0b0b', color: '#fff',
      fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      pageBreakAfter: 'always', breakAfter: 'page',
      flexShrink: 0,
    }}>
      {children}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDES
// ════════════════════════════════════════════════════════════════════════════

function S1Cover() {
  return (
    <Slide id="s1">
      {/* top nav */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '22px 48px 0',
        fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase',
        color: '#4d6fff',
      }}>
        <span>CAREOS</span>
        <span style={{ opacity: .6 }}>CLINICAL WORK THAT WORKS ITSELF.</span>
        <span>BRAND GUIDES</span>
      </div>

      {/* wordmark */}
      <div style={{ position: 'absolute', bottom: 112, left: 48 }}>
        <div style={{ fontSize: 104, fontWeight: 700, lineHeight: .9, letterSpacing: '-.02em', color: '#4d6fff' }}>
          CARE<br />OS
        </div>
      </div>

      {/* tagline */}
      <div style={{
        position: 'absolute', bottom: 58, left: 48,
        fontSize: 12, color: 'rgba(255,255,255,.28)',
        letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 500,
      }}>
        Every patient deserves one complete, portable health record.
      </div>

      {/* by LaunchFlow */}
      <div style={{ position: 'absolute', bottom: 36, right: 48, textAlign: 'right' }}>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,.3)', fontFamily: "'Space Grotesk', sans-serif", marginBottom: 2 }}>by</div>
        <div style={{
          fontFamily: "'Billion Miracles', cursive",
          fontSize: 36, color: '#c4ff4d',
          borderBottom: '2px solid #c4ff4d', paddingBottom: 3,
          lineHeight: 1.1,
        }}>LaunchFlow</div>
      </div>
    </Slide>
  )
}

function S2Problem() {
  const stats = [
    { n: '30,000', label: 'discrete admin actions per 4,000-visit clinic / year', color: '#4d6fff' },
    { n: '5,280 hrs', label: 'structural staff shortfall annually — capacity vs. demand', color: '#c4ff4d' },
    { n: '34.2%', label: 'of U.S. healthcare spend is administrative (JAMA 2019)', color: '#ff6b5b' },
    { n: '50%+', label: 'physician burnout — driven by documentation overhead (AMA 2023)', color: 'rgba(255,255,255,.55)' },
  ]
  return (
    <Slide id="s2">
      <NavStrip center="THE PROBLEM" />
      <Rule />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '36px 48px 44px', gap: 0 }}>
        <div style={{ paddingRight: 48, borderRight: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Eyebrow>The 7:45 AM Problem</Eyebrow>
          <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: '-.02em', marginBottom: 18 }}>
            Maria re-enters data<br />that already exists.
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: 'rgba(255,255,255,.5)', marginBottom: 12 }}>
            Every morning a front-desk coordinator manually re-enters demographics, insurance, medications, and allergies across three EHR portals. It takes 4 hours — for data that's already in those systems.
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.65, color: 'rgba(255,255,255,.35)' }}>
            This is not a staffing problem. FHIR R4, SMART on FHIR, and HL7 v2 already exist. What's been missing is a relay that speaks all of them.
          </p>
        </div>
        <div style={{ paddingLeft: 48, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
          {stats.map(s => (
            <div key={s.n} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '16px 20px' }}>
              <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1, color: s.color, marginBottom: 4 }}>{s.n}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <SlideNum n={2} />
    </Slide>
  )
}

function S3Overview() {
  const features = [
    { icon: Building2, bg: '#c4ff4d', fg: '#111', title: 'Clinic surfaces', desc: 'Work queue, order composer, check-in scanner, CDS console — all connected to one relay.' },
    { icon: Activity,  bg: '#4d6fff', fg: '#fff', title: 'Patient Fishbowl™', desc: 'Patients see exactly where their care stands in real time — no phone call needed.' },
    { icon: Lock,      bg: 'rgba(255,255,255,.1)', fg: '#fff', title: 'Tamper-evident audit chain', desc: 'Every PHI access SHA-256 hash-chained. Verifiable live at /api/relay/audit/verify.' },
    { icon: Microscope, bg: 'rgba(255,210,63,.15)', fg: '#ffd23f', title: 'Research network', desc: 'De-identified, clinician-validated data pool with patient-consent gating and reward wallet.' },
  ]
  return (
    <Slide id="s3">
      <NavStrip center="WHAT IT IS" />
      <Rule />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.1fr 1fr', padding: '36px 48px 44px', gap: 0 }}>
        <div style={{ paddingRight: 48, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Eyebrow lime>Patient-Mediated Clinical OS</Eyebrow>
          <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: '-.02em', marginBottom: 18 }}>
            One relay.<br />Every EHR.<br />One record.
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: 'rgba(255,255,255,.5)', marginBottom: 20 }}>
            CareOS sits between existing EHRs and the patient — absorbing administrative overflow via a standards-based, HIPAA-grade relay. The patient is the permission layer.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['FHIR R4','SMART on FHIR','CDS Hooks','HL7 v2 MLLP','USCDI v3','Bulk Data'].map(t => <Pill key={t}>{t}</Pill>)}
          </div>
        </div>
        <div style={{ paddingLeft: 48, borderLeft: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
          {features.map(f => {
            const Icon = f.icon
            return (
              <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '13px 16px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} color={f.fg} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <SlideNum n={3} />
    </Slide>
  )
}

function S4Architecture() {
  type ChipDef = { label: string; lime?: boolean; blue?: boolean; plain?: boolean; dim?: boolean }
  const layers: { label: string; cls: { bg: string; color: string; border: string }; chips: ChipDef[]; note?: string }[] = [
    {
      label: 'Layer 1\nUniversal\nEHR Relay',
      cls: { bg: 'rgba(196,255,77,.1)', color: '#c4ff4d', border: 'rgba(196,255,77,.2)' },
      chips: [
        { label: 'HL7 v2 / MLLP', lime: true }, { label: '→', plain: true },
        { label: 'FHIR R4 Bundle', lime: true }, { label: '·', plain: true },
        { label: 'FHIR Webhook' }, { label: '·', plain: true },
        { label: 'SMART Backend Services' }, { label: '·', plain: true },
        { label: 'Epic / Cerner / VA' }, { label: '·', plain: true },
        { label: 'TEFCA / QHIN (Phase 3)', dim: true },
      ],
    },
    {
      label: 'Layer 2\nSecurity\n& Trust',
      cls: { bg: 'rgba(77,111,255,.1)', color: '#4d6fff', border: 'rgba(77,111,255,.2)' },
      chips: [
        { label: 'AES-256-GCM Encryption', blue: true }, { label: '·', plain: true },
        { label: 'SHA-256 Hash Chain', blue: true }, { label: '·', plain: true },
        { label: 'JWT / PKCE Auth' }, { label: '·', plain: true },
        { label: 'FHIR Consent Gating' }, { label: '·', plain: true },
        { label: 'HIPAA §164.312(b)' },
      ],
    },
    {
      label: 'Layer 3\nWorkflow\nAgents',
      cls: { bg: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.5)', border: 'rgba(255,255,255,.1)' },
      chips: [
        { label: 'IntakeAgent' }, { label: '·', plain: true },
        { label: 'LabLoopAgent' }, { label: '·', plain: true },
        { label: 'RxLoopAgent' }, { label: '·', plain: true },
        { label: 'CDS Hooks Cards', lime: true }, { label: '·', plain: true },
        { label: 'Relational CDS Console', lime: true },
      ],
      note: '— deterministic, no LLM',
    },
  ]
  return (
    <Slide id="s4">
      <NavStrip center="ARCHITECTURE" />
      <Rule />
      <div style={{ flex: 1, padding: '32px 48px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Eyebrow lime>Three-Layer Architecture</Eyebrow>
        {layers.map(layer => (
          <div key={layer.label} style={{ display: 'flex', alignItems: 'stretch', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ width: 136, flexShrink: 0, background: layer.cls.bg, borderRight: `1px solid ${layer.cls.border}`, color: layer.cls.color, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
              {layer.label}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '14px 20px' }}>
              {layer.chips.map((c, i) =>
                c.plain
                  ? <span key={i} style={{ color: 'rgba(255,255,255,.25)', fontSize: 12 }}>{c.label}</span>
                  : c.dim
                    ? <span key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{c.label}</span>
                    : <Chip key={i} lime={c.lime} blue={c.blue}>{c.label}</Chip>
              )}
              {layer.note && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginLeft: 4 }}>{layer.note}</span>}
            </div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>
          Stack: <span style={{ color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>FastAPI · Python 3.11 · PostgreSQL 15 · React 18 · TypeScript · Vite · Docker Compose · Cloudflare Tunnel</span>
        </div>
      </div>
      <SlideNum n={4} />
    </Slide>
  )
}

function S5Cds() {
  return (
    <Slide id="s5">
      <NavStrip center="CDS & RELATIONAL VIEW" />
      <Rule />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, padding: '32px 48px 40px' }}>
        {/* CDS Hooks card */}
        <div style={{ borderRadius: 18, padding: '26px 28px', background: '#161616', border: '1px solid rgba(196,255,77,.15)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(196,255,77,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GitBranch size={15} color="#c4ff4d" />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#c4ff4d' }}>CDS Hooks</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em' }}>Cards fire inside<br />Epic &amp; Cerner</div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', lineHeight: 1.65 }}>
            CareOS registers as a CDS Hooks provider. When a clinician opens a chart or selects an order, safety cards surface inline — no tab-switching, no separate portal.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['patient-view', 'context card on chart open'],
              ['order-select', 'allergy / interaction advisory'],
              ['order-sign',   'pre-sign compliance check'],
            ].map(([hook, desc]) => (
              <div key={hook} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
                <CheckCircle2 size={13} color="#c4ff4d" style={{ flexShrink: 0, marginTop: 1 }} strokeWidth={2.5} />
                <span><code style={{ fontSize: 10, background: 'rgba(255,255,255,.08)', padding: '1px 5px', borderRadius: 4 }}>{hook}</code> — {desc}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Relational View card */}
        <div style={{ borderRadius: 18, padding: '26px 28px', background: '#181818', border: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(77,111,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Network size={15} color="#4d6fff" />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#4d6fff' }}>Relational View</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em' }}>Cross-domain links,<br />not tabs</div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', lineHeight: 1.65 }}>
            Medications, allergies, labs, and problems are linked relationally. A drug conflict surfaces the moment you select the medication — before you navigate anywhere else.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Visual force-directed graph — patient record as a network',
              'Live allergy / medication cross-domain conflict detection',
              'Order composer with inline CDS advisory panel',
              'All 22 FHIR R4 resource types traversable',
            ].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
                <CheckCircle2 size={13} color="#4d6fff" style={{ flexShrink: 0, marginTop: 1 }} strokeWidth={2.5} />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SlideNum n={5} />
    </Slide>
  )
}

function S6Fishbowl() {
  const stages = [
    { label: 'Check-in received',              time: '7:45 AM', color: '#22a06b', done: true  },
    { label: 'Intake review — 2 flags resolved', time: '8:02 AM', color: '#22a06b', done: true  },
    { label: 'Clinician notified',              time: '8:05 AM', color: '#22a06b', done: true  },
    { label: 'Lab order sent → awaiting result', time: '9:12 AM', color: '#ffd23f', done: false },
    { label: 'Summary & discharge',             time: '—',       color: '#444',    done: false },
  ]
  const agents = [
    { icon: ClipboardList, title: 'IntakeAgent',   desc: 'Scores completeness, flags missing insurance, allergy conflicts, incomplete demographics before the patient arrives.', save: '↑ 8–12 min saved per intake encounter' },
    { icon: Microscope,    title: 'LabLoopAgent',  desc: 'Correlates HL7 v2 results to FHIR ServiceRequests, marks loops closed, surfaces abnormals in the work queue.',         save: '↑ Loop closure: days → hours' },
    { icon: PillIcon,      title: 'RxLoopAgent',   desc: 'Tracks MedicationRequest from order through dispense confirmation. Surfaces unconfirmed Rx before end of day.',       save: '↑ Rx confirmation latency eliminated' },
  ]
  return (
    <Slide id="s6">
      <NavStrip center="PATIENT EXPERIENCE & WORKFLOW AGENTS" />
      <Rule />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '32px 48px 40px', gap: 0 }}>
        <div style={{ paddingRight: 40, borderRight: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
          <Eyebrow lime>Patient Fishbowl™</Eyebrow>
          <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>Where does my care stand?<br /><span style={{ color: 'rgba(255,255,255,.4)', fontWeight: 400, fontSize: 15 }}>Real time. No phone call.</span></div>
          {stages.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.03)', opacity: s.label.includes('discharge') ? .4 : 1 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>{s.time}</div>
            </div>
          ))}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 4, lineHeight: 1.6 }}>Live WebSocket updates · Zero PHI to unauthenticated viewers · Read-only — never writes back to EHR</div>
        </div>
        <div style={{ paddingLeft: 40, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
          <Eyebrow>Workflow Agents</Eyebrow>
          {agents.map(a => {
            const Icon = a.icon
            return (
              <div key={a.title} style={{ borderRadius: 12, padding: '13px 16px', border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Icon size={14} color="#c4ff4d" />
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{a.title}</div>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', lineHeight: 1.55, marginBottom: 6 }}>{a.desc}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#c4ff4d', letterSpacing: '.05em', textTransform: 'uppercase' }}>{a.save}</div>
              </div>
            )
          })}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', paddingTop: 4 }}>All agents are deterministic rule engines. No LLM touches the clinical record.</div>
        </div>
      </div>
      <SlideNum n={6} />
    </Slide>
  )
}

function S7Standards() {
  const standards = [
    { name: 'FHIR R4 (22 resource types)',                         status: 'live' as const },
    { name: 'SMART on FHIR (EHR + Standalone + Backend Services)', status: 'live' as const },
    { name: 'CDS Hooks (patient-view / order-select / order-sign)', status: 'live' as const },
    { name: 'HL7 v2.5 / MLLP (ADT, ORM, ORU, MDM)',               status: 'live' as const },
    { name: 'USCDI v3 (all 24 data classes mapped)',                status: 'live' as const },
    { name: 'FHIR Bulk Data $export (async NDJSON)',                status: 'live' as const },
    { name: 'HIPAA §164.312(b) — Hash-chained audit',              status: 'live' as const },
    { name: 'TEFCA / QHIN connector',                              status: 'road' as const },
  ]
  const stack = [
    { label: 'Frontend',       items: 'React 18 · TypeScript 5.4 · Vite 5.1 · Tailwind CSS · Framer Motion' },
    { label: 'Backend',        items: 'FastAPI · Python 3.11 · SQLAlchemy 2 (async) · PostgreSQL 15' },
    { label: 'Infrastructure', items: 'Docker Compose · Nginx · Cloudflare Tunnel · AES-256-GCM · TLS 1.3' },
  ]
  return (
    <Slide id="s7">
      <NavStrip center="STANDARDS & TECH STACK" />
      <Rule />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '32px 48px 40px', gap: 0 }}>
        <div style={{ paddingRight: 40, borderRight: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', gap: 7, justifyContent: 'center' }}>
          <Eyebrow lime>Standards Conformance</Eyebrow>
          {standards.map(s => <StdRow key={s.name} {...s} />)}
        </div>
        <div style={{ paddingLeft: 40, display: 'flex', flexDirection: 'column', gap: 7, justifyContent: 'center' }}>
          <Eyebrow>Technology Stack</Eyebrow>
          {stack.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginTop: 10, marginBottom: 5 }}>{s.label}</div>
              <div style={{ padding: '9px 14px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.75)' }}>{s.items}</div>
            </div>
          ))}
        </div>
      </div>
      <SlideNum n={7} />
    </Slide>
  )
}

function S8Metrics() {
  const metrics = [
    { n: '0.174', unit: 'ms', label: 'p50 HL7 v2 → FHIR R4 transform overhead (200-iteration benchmark)' },
    { n: '59/59', unit: '',   label: 'correctness invariants passing across 7 subsystems' },
    { n: '36/36', unit: '',   label: 'production audit chain entries verified — live endpoint' },
    { n: '47+',   unit: 'min', label: 'estimated admin time saved per coordinator per shift' },
  ]
  const traction = [
    { label: 'Live deployment',        value: 'launchflow.tech',        sub: 'Docker Compose + Cloudflare Tunnel' },
    { label: 'Research study',         value: 'UW-affiliated IRB',      sub: 'Active June 2026 · participant interactions tracked' },
    { label: 'Audit chain proof',      value: '/api/relay/audit/verify', sub: 'Returns live cryptographic chain-integrity result', blue: true },
    { label: 'Annual clinic (modelled)',value: '~30,000 actions',        sub: 'automated per 4,000-visit outpatient clinic / year' },
  ]
  return (
    <Slide id="s8">
      <NavStrip center="TRACTION & METRICS" />
      <Rule />
      <div style={{ flex: 1, padding: '32px 48px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Eyebrow lime>Measured Performance — June 2026</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {metrics.map(m => (
            <div key={m.n} style={{ borderRadius: 16, padding: '18px 18px', border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)' }}>
              <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-.025em', lineHeight: 1, color: '#c4ff4d' }}>{m.n}<span style={{ fontSize: 14, color: 'rgba(255,255,255,.4)', fontWeight: 500 }}>{m.unit && ` ${m.unit}`}</span></div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 6, lineHeight: 1.4 }}>{m.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, flex: 1 }}>
          {traction.map(t => (
            <div key={t.label} style={{ flex: 1, borderRadius: 14, padding: '14px 18px', border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)' }}>{t.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.blue ? '#4d6fff' : '#fff' }}>{t.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{t.sub}</div>
            </div>
          ))}
        </div>
      </div>
      <SlideNum n={8} />
    </Slide>
  )
}

function S9Roadmap() {
  const phases = [
    {
      tag: 'Now · Phase 1', tagStyle: { background: 'rgba(196,255,77,.1)', color: '#c4ff4d', border: 'rgba(196,255,77,.25)' },
      title: 'Foundation',
      items: ['FHIR R4 relay + HL7 v2 MLLP','SMART Backend Services','CDS Hooks (3 hooks live)','Relational CDS console','Patient Fishbowl™','Hash-chained audit log','Research network (IRB)','Deterministic workflow agents'],
    },
    {
      tag: 'Phase 2', tagStyle: { background: 'rgba(77,111,255,.1)', color: '#4d6fff', border: 'rgba(77,111,255,.25)' },
      title: 'Depth',
      items: ['FHIR write-back to EHR','Per-user MFA','Column-level PHI encryption','Production VPS + backup','CQL for CDS rules','Simulated clinic load study'],
    },
    {
      tag: 'Phase 3', tagStyle: { background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.5)', border: 'rgba(255,255,255,.12)' },
      title: 'Network',
      items: ['TEFCA / QHIN certification','CDS Hooks outbound (EHR-embedded)','e-Rx (Surescripts)','Pilot clinic time-motion study','Payer / prior auth (X12 EDI)'],
    },
    {
      tag: 'Phase 4', tagStyle: { background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.3)', border: 'rgba(255,255,255,.08)' },
      title: 'Scale',
      items: ['Research escrow smart contracts','Population-level Bulk Data exports','Multi-clinic federation','Research sponsor marketplace','Patient-mediated exchange economy'],
    },
  ]
  return (
    <Slide id="s9">
      <NavStrip center="ROADMAP" />
      <Rule />
      <div style={{ flex: 1, padding: '32px 48px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Eyebrow lime>Build phases</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, flex: 1 }}>
          {phases.map(p => (
            <div key={p.tag} style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: p.tagStyle.background, color: p.tagStyle.color, border: `1px solid ${p.tagStyle.border}`, borderRadius: 100, padding: '3px 10px', fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', width: 'fit-content' }}>
                {p.tag.startsWith('Now') && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#c4ff4d', display: 'inline-block' }} />}
                {p.tag}
              </span>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{p.title}</div>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {p.items.map(item => (
                  <li key={item} style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', paddingLeft: 14, position: 'relative', lineHeight: 1.45 }}>
                    <span style={{ position: 'absolute', left: 0, color: 'rgba(255,255,255,.2)' }}>–</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <SlideNum n={9} />
    </Slide>
  )
}

function S10Cta() {
  const links = [
    { label: 'Live deployment',   value: 'launchflow.tech',                         blue: true },
    { label: 'Repository',        value: 'github.com/IntuitiveSystems-irl/CareOS',  blue: true },
    { label: 'Audit chain proof', value: '/api/relay/audit/verify',                 blue: true },
    { label: 'Contact',           value: 'hi@businessintuitive.tech',               blue: false },
  ]
  return (
    <Slide id="s10">
      <NavStrip center="" />
      <Rule />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '32px 80px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 30, fontWeight: 700, color: '#4d6fff', letterSpacing: '-.01em' }}>CAREOS</span>
          <span style={{ width: 1, height: 30, background: 'rgba(255,255,255,.12)' }} />
          <span style={{ fontFamily: "'Billion Miracles', cursive", fontSize: 36, color: '#c4ff4d', borderBottom: '2px solid #c4ff4d', paddingBottom: 3, lineHeight: 1.1 }}>LaunchFlow</span>
        </div>
        <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-.025em', lineHeight: 1.05 }}>
          Every patient deserves<br />one complete record.
        </div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', maxWidth: 520, lineHeight: 1.65 }}>
          CareOS is live at launchflow.tech — connecting Epic, Cerner, VA, and legacy HL7 v2 systems into one patient-mediated, standards-native relay. Pilot clinics, research partners, and health-IT teams welcome.
        </p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {links.map(l => (
            <div key={l.label} style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,.1)', padding: '14px 22px', textAlign: 'left', minWidth: 200 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 5 }}>{l.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: l.blue ? '#4d6fff' : 'rgba(255,255,255,.7)' }}>{l.value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.18)', marginTop: 4 }}>Business Intuitive Inc. (DBA LaunchFlow) · Washington State · June 2026</div>
      </div>
      <SlideNum n={10} />
    </Slide>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE
// ════════════════════════════════════════════════════════════════════════════

export default function CareOSPitchDeck() {
  return (
    <div style={{ background: '#141414', minHeight: '100vh', paddingBottom: 48 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        ${BILLION_MIRACLES}
        @media print {
          @page { size: 1120px 630px; margin: 0; }
          body { background: none !important; }
          #print-bar { display: none !important; }
          #deck > div { page-break-after: always; break-after: page; width: 100vw !important; height: 100vh !important; }
        }
      `}</style>

      {/* Top bar */}
      <div id="print-bar" style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0b0b0b', borderBottom: '1px solid rgba(255,255,255,.08)', padding: '12px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#4d6fff', letterSpacing: '.06em', fontFamily: "'Space Grotesk', sans-serif" }}>CAREOS</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>Pitch Deck · 10 slides</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 100, border: '1px solid rgba(255,255,255,.12)', color: 'rgba(255,255,255,.6)', fontSize: 12, fontWeight: 600, textDecoration: 'none', fontFamily: "'Space Grotesk', sans-serif" }}>
            ← Home
          </Link>
          <button
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 100, background: '#c4ff4d', color: '#111', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <ArrowUpRight size={13} /> Save as PDF
          </button>
        </div>
      </div>

      {/* Slides */}
      <div id="deck" style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', padding: '24px 0' }}>
        <S1Cover />
        <S2Problem />
        <S3Overview />
        <S4Architecture />
        <S5Cds />
        <S6Fishbowl />
        <S7Standards />
        <S8Metrics />
        <S9Roadmap />
        <S10Cta />
      </div>
    </div>
  )
}
