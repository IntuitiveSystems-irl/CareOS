import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Layers, Network, CheckCircle2, Loader2, Lock,
} from 'lucide-react'
import { researchApi } from './researchApi'
import type { InterfaceArm, Participant, Study } from './types'
import AuthStep from './steps/AuthStep'
import ConsentStep from './steps/ConsentStep'
import DemographicsStep from './steps/DemographicsStep'
import TaskBlock from './steps/TaskBlock'
import NasaTlxStep from './steps/NasaTlxStep'
import QualitativeStep from './steps/QualitativeStep'
import UsabilityStep from './steps/UsabilityStep'
import ExplorationStep from './steps/ExplorationStep'

type Phase = 'welcome' | 'consent' | 'demographics' | 'explore' | 'block' | 'closing' | 'usability' | 'locked' | 'done'
type BlockSub = 'intro' | 'tasks' | 'tlx' | 'qual'

export default function ParticipantStudy() {
  const [study, setStudy] = useState<Study | null>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [phase, setPhase] = useState<Phase>('welcome')
  const [blockIndex, setBlockIndex] = useState(0)
  const [blockSub, setBlockSub] = useState<BlockSub>('intro')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    researchApi.getStudy().then(setStudy).catch((e) => setError(e?.message || 'Failed to load study'))
  }, [])

  const arms: InterfaceArm[] = participant
    ? participant.condition_order === 'traditional_first'
      ? ['traditional', 'relational']
      : ['relational', 'traditional']
    : []
  const arm = arms[blockIndex]

  const handleAuth = (p: Participant) => {
    setParticipant(p)
    setPhase(p.status === 'enrolled' ? 'consent' : 'locked')
  }

  const afterQual = () => {
    if (blockIndex === 0) {
      setBlockIndex(1)
      setBlockSub('intro')
    } else {
      setPhase('closing')
    }
  }

  const finish = async () => {
    if (!participant) return
    setBusy(true)
    try {
      await researchApi.complete(participant.id)
      setPhase('done')
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return <Shell><p className="text-red-600">{error}</p></Shell>
  }
  if (!study) {
    return <Shell><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></Shell>
  }

  // ── Sign up / sign in ──
  if (phase === 'welcome') {
    return (
      <Shell wide>
        <AuthStep study={study} onAuthed={handleAuth} />
      </Shell>
    )
  }

  if (!participant) return <Shell><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></Shell>

  // ── Locked (already started or completed) ──
  if (phase === 'locked') {
    const done = participant.status === 'completed'
    return (
      <Shell>
        <div className="max-w-md mx-auto text-center pt-10">
          <div className={`w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center ${done ? 'bg-teal-100' : 'bg-amber-100'}`}>
            {done ? <CheckCircle2 className="w-8 h-8 text-teal-600" /> : <Lock className="w-8 h-8 text-amber-600" />}
          </div>
          <h2 className="text-[26px] font-bold text-gray-900 mb-2">
            {done ? 'Participation complete' : 'Session already started'}
          </h2>
          <p className="text-[15px] text-gray-500 mb-2">
            {done
              ? 'Our records show you have already completed this study. Thank you for taking part!'
              : 'You have already begun this study. For data quality, sessions can\u2019t be paused and resumed.'}
          </p>
          <p className="text-[13px] text-gray-400 mb-8">Participant {participant.participant_code}</p>
          <Link to="/research" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold text-teal-700 border border-teal-200 hover:bg-teal-50 transition-all">
            Back to study home
          </Link>
        </div>
      </Shell>
    )
  }

  // ── Consent / Demographics ──
  if (phase === 'consent') {
    return <Shell><Stepper phase={phase} blockIndex={blockIndex} />
      <ConsentStep participantId={participant.id} consent={study.consent} onDone={() => setPhase('demographics')} />
    </Shell>
  }
  if (phase === 'demographics') {
    return <Shell><Stepper phase={phase} blockIndex={blockIndex} />
      <DemographicsStep participantId={participant.id} onDone={() => setPhase('explore')} />
    </Shell>
  }

  // ── Free exploration (instrumented, full-bleed) ──
  if (phase === 'explore') {
    return <ExplorationStep
      participantId={participant.id}
      patient={study.patient}
      onDone={() => { setBlockIndex(0); setBlockSub('intro'); setPhase('block') }}
    />
  }

  // ── Interface block ──
  if (phase === 'block') {
    if (blockSub === 'intro') {
      const isTrad = arm === 'traditional'
      return (
        <Shell wide><Stepper phase={phase} blockIndex={blockIndex} />
          <div className="max-w-2xl mx-auto text-center pt-4">
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center ${isTrad ? 'bg-slate-100' : 'bg-teal-100'}`}>
              {isTrad ? <Layers className="w-8 h-8 text-slate-600" /> : <Network className="w-8 h-8 text-teal-600" />}
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Interface {blockIndex + 1} of 2
            </p>
            <h2 className="text-[26px] font-bold text-gray-900 mb-3">
              {isTrad ? 'Traditional Interface' : 'Relational Interface'}
            </h2>
            <p className="text-[15px] text-gray-500 mb-8 max-w-md mx-auto">
              {isTrad
                ? 'A conventional tabbed chart. Each section lives on its own tab. Answer each question as quickly and accurately as you can.'
                : 'A linked chart — selecting any record reveals its related records. Answer each question as quickly and accurately as you can.'}
            </p>
            <button
              onClick={() => setBlockSub('tasks')}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-[15px] font-semibold text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 transition-all shadow-glow-teal"
            >
              Start Tasks <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </Shell>
      )
    }
    if (blockSub === 'tasks') {
      return <Shell wide><TaskBlock participantId={participant.id} arm={arm} study={study} onDone={() => setBlockSub('tlx')} /></Shell>
    }
    if (blockSub === 'tlx') {
      return <Shell><Stepper phase={phase} blockIndex={blockIndex} />
        <NasaTlxStep participantId={participant.id} arm={arm} dimensions={study.tlx_dimensions} onDone={() => setBlockSub('qual')} />
      </Shell>
    }
    if (blockSub === 'qual') {
      return <Shell><Stepper phase={phase} blockIndex={blockIndex} />
        <QualitativeStep
          participantId={participant.id}
          arm={arm}
          prompts={study.qual_prompts.per_interface}
          title="Quick reflection"
          subtitle={`A few questions about the ${arm} interface you just used.`}
          onDone={afterQual}
        />
      </Shell>
    }
  }

  // ── Closing ──
  if (phase === 'closing') {
    return <Shell><Stepper phase={phase} blockIndex={blockIndex} />
      <QualitativeStep
        participantId={participant.id}
        arm={null}
        prompts={study.qual_prompts.closing}
        title="Final thoughts"
        subtitle="Comparing the two interfaces overall."
        ctaLabel="Continue"
        onDone={() => setPhase('usability')}
      />
    </Shell>
  }

  // ── Usability evaluation of CareOS ──
  if (phase === 'usability') {
    return <Shell><Stepper phase={phase} blockIndex={blockIndex} />
      <UsabilityStep participantId={participant.id} usability={study.usability} onDone={finish} />
    </Shell>
  }

  // ── Done ──
  return (
    <Shell>
      <div className="max-w-md mx-auto text-center pt-10">
        <div className="w-16 h-16 rounded-2xl bg-teal-100 mx-auto mb-5 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-teal-600" />
        </div>
        <h2 className="text-[26px] font-bold text-gray-900 mb-2">Thank you!</h2>
        <p className="text-[15px] text-gray-500 mb-2">
          Your responses were recorded as <span className="font-semibold text-teal-700">{participant.participant_code}</span>.
        </p>
        <p className="text-[14px] text-gray-400 mb-8">Your contribution helps reduce clinician documentation burden.</p>
        <Link to="/research" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold text-teal-700 border border-teal-200 hover:bg-teal-50 transition-all">
          Back to study home
        </Link>
      </div>
    </Shell>
  )
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-warm-50 py-10 px-6">
      <div className={`${wide ? 'max-w-6xl' : 'max-w-3xl'} mx-auto`}>{children}</div>
    </div>
  )
}

function Expect({ n, t }: { n: string; t: string }) {
  return (
    <div className="bg-white rounded-xl border border-sage-200/70 p-4">
      <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-700 text-[12px] font-bold flex items-center justify-center mb-2">{n}</div>
      <p className="text-[13px] font-medium text-gray-700">{t}</p>
    </div>
  )
}

const STEP_LABELS = ['Consent', 'Background', 'Explore', 'Interface 1', 'Interface 2', 'Reflection', 'CareOS']
function Stepper({ phase, blockIndex }: { phase: Phase; blockIndex: number }) {
  let active = 0
  if (phase === 'consent') active = 0
  else if (phase === 'demographics') active = 1
  else if (phase === 'explore') active = 2
  else if (phase === 'block') active = 3 + blockIndex
  else if (phase === 'closing') active = 5
  else if (phase === 'usability' || phase === 'done') active = 6
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEP_LABELS.map((l, i) => (
        <div key={l} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
            i < active ? 'text-teal-600' : i === active ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'text-gray-300'
          }`}>
            {i < active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-current inline-block" />}
            {l}
          </div>
          {i < STEP_LABELS.length - 1 && <div className={`w-4 h-px ${i < active ? 'bg-teal-300' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )
}
