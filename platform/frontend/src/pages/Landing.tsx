import { Link } from 'react-router-dom'
import { useState } from 'react'
import {
  Heart, Shield, ArrowRight, Mail,
  Stethoscope, Database, Activity,
  CheckCircle2, Wifi, Eye, FileText, ClipboardCheck,
  Lock, Users, Brain,
} from 'lucide-react'
import { api } from '../api'

export default function Landing() {
  const [subEmail, setSubEmail] = useState('')
  const [subName, setSubName] = useState('')
  const [subStatus, setSubStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [subMsg, setSubMsg] = useState('')

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subEmail) return
    setSubStatus('loading')
    try {
      await api.subscribe({ email: subEmail, name: subName, role: 'general' })
      setSubStatus('success')
      setSubMsg('Welcome email sent! Check your inbox.')
      setSubEmail('')
      setSubName('')
    } catch (err: any) {
      setSubStatus('error')
      setSubMsg(err?.message || 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-sage-200/60">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-glow-teal">
              <Heart className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-[16px] font-semibold tracking-tight text-gray-900">LaunchFlow</h1>
              <p className="text-[10px] font-semibold text-teal-600/60 uppercase tracking-widest">Health Data Agent</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login/patient"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-teal-700 hover:bg-teal-50 transition-all"
            >
              <Heart className="w-4 h-4" />
              Patients
            </Link>
            <Link
              to="/login/clinician"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl text-[13px] font-semibold hover:from-teal-400 hover:to-teal-500 transition-all shadow-glow-teal"
            >
              <Stethoscope className="w-4 h-4" />
              Clinicians
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-8">
        <div className="max-w-6xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 border border-teal-200/60 rounded-full mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse-soft" />
            <span className="text-[11px] font-semibold text-teal-700">Connected to Epic, Cerner & MEDITECH</span>
          </div>

          <h2 className="text-[44px] leading-[1.12] font-bold tracking-tight text-gray-900 mb-5 max-w-[680px] mx-auto">
            The patient is the only entity present across every healthcare organization.
          </h2>
          <p className="text-[24px] leading-relaxed text-teal-700/80 font-medium max-w-[520px] mx-auto mb-10">
            What if they coordinated the workflow?
          </p>

          <div className="flex items-center justify-center gap-4 mb-6">
            <Link
              to="/login/patient"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl text-[14px] font-semibold hover:from-teal-400 hover:to-teal-500 transition-all shadow-glow-teal"
            >
              Patient Portal
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login/clinician"
              className="flex items-center gap-2 px-6 py-3 bg-white border border-sage-200/80 text-gray-700 rounded-xl text-[14px] font-semibold hover:bg-sage-50 transition-all shadow-soft"
            >
              Clinician Login
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-5 text-[11px] text-gray-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-500/60" />
              <span>HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-500/60" />
              <span>FHIR R4</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-500/60" />
              <span>US Core STU7</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-500/60" />
              <span>SMART on FHIR</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-[28px] font-bold tracking-tight text-gray-900 mb-3">How it works</h3>
            <p className="text-[15px] text-gray-400 max-w-[480px] mx-auto">
              A patient-controlled agent that bridges every EHR system, giving patients transparency and clinicians seamless workflows.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-16">
            {[
              {
                icon: Eye,
                title: 'Full Transparency',
                desc: 'Patients see exactly who accessed their data, when, and why. Every action is logged and auditable in real time.',
                color: 'from-teal-400 to-teal-600',
              },
              {
                icon: ClipboardCheck,
                title: 'Patient-Approved Orders',
                desc: 'Clinicians compose orders. Patients review and approve them. No surprises — informed consent at every step.',
                color: 'from-teal-500 to-teal-700',
              },
              {
                icon: Brain,
                title: 'AI-Powered Translation',
                desc: 'Clinical notes automatically translated to plain language. Patients understand their care without a medical degree.',
                color: 'from-teal-600 to-teal-800',
              },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl border border-sage-200/60 p-6 shadow-soft hover:shadow-soft-lg transition-all">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-glow-teal`}>
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-[16px] font-semibold text-gray-900 mb-2">{f.title}</h4>
                <p className="text-[13px] leading-relaxed text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* EHR Connections bar */}
          <div className="bg-white rounded-2xl border border-sage-200/60 p-6 shadow-soft">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-teal-500" />
                </div>
                <div>
                  <h4 className="text-[15px] font-semibold text-gray-900">Live EHR Connections</h4>
                  <p className="text-[12px] text-gray-400">Real FHIR endpoints — not simulated</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                {[
                  { name: 'Epic', status: 'connected' },
                  { name: 'Cerner', status: 'connected' },
                  { name: 'MEDITECH', status: 'connected' },
                ].map((v) => (
                  <div key={v.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-[13px] font-medium text-gray-600">{v.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities row */}
      <section className="py-12 px-8 bg-white border-y border-sage-200/40">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: Shield, label: 'SMART on FHIR OAuth 2.0', sub: 'Granular consent & scopes' },
              { icon: Database, label: 'Multi-Vendor FHIR', sub: 'Epic, Cerner, MEDITECH' },
              { icon: Activity, label: 'Real-Time Audit', sub: 'Every access logged' },
              { icon: FileText, label: 'Clinical Notes AI', sub: 'Plain-language translation' },
            ].map((c, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <c.icon className="w-4 h-4 text-teal-500" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-gray-800">{c.label}</p>
                  <p className="text-[12px] text-gray-400">{c.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Patients / For Clinicians */}
      <section className="py-16 px-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Patient card */}
          <div className="bg-white rounded-2xl border border-sage-200/60 p-8 shadow-soft">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-glow-teal">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <h4 className="text-[18px] font-bold text-gray-900">For Patients</h4>
            </div>
            <ul className="space-y-3 mb-6">
              {[
                'View and control who accesses your health data',
                'Review and approve clinical orders before they execute',
                'Read your clinical notes in plain language',
                'Track every data access with a full audit trail',
                'Set fulfillment preferences for medications and labs',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] text-gray-500">
                  <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/login/patient"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl text-[13px] font-semibold hover:from-teal-400 hover:to-teal-500 transition-all shadow-glow-teal"
            >
              Sign in as Patient <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Clinician card */}
          <div className="bg-white rounded-2xl border border-sage-200/60 p-8 shadow-soft">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center shadow-glow-teal">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <h4 className="text-[18px] font-bold text-gray-900">For Clinicians</h4>
            </div>
            <ul className="space-y-3 mb-6">
              {[
                'Request patient records across Epic, Cerner & MEDITECH',
                'Compose and submit orders with AI-assisted prior auth',
                'Manage work queue with status-bucketed workflows',
                'View real-time order status and clinical timelines',
                'Access FHIR resources directly from vendor endpoints',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] text-gray-500">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/login/clinician"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-sage-200/80 text-gray-700 rounded-xl text-[13px] font-semibold hover:bg-sage-50 transition-all shadow-soft"
            >
              Sign in as Clinician <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Subscribe Section */}
      <section className="py-16 px-8 bg-gradient-to-br from-teal-50 to-warm-50 border-t border-sage-200/40">
        <div className="max-w-[520px] mx-auto text-center">
          <div className="w-11 h-11 mx-auto rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center mb-4 shadow-glow-teal">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-[22px] font-bold text-gray-900 mb-2">Stay in the loop</h3>
          <p className="text-[14px] text-gray-400 mb-6">
            Get updates on new features, launch milestones, and early access opportunities.
          </p>

          {subStatus === 'success' ? (
            <div className="bg-white rounded-xl border border-teal-200/60 p-5 shadow-soft">
              <CheckCircle2 className="w-8 h-8 text-teal-500 mx-auto mb-2" />
              <p className="text-[14px] font-semibold text-gray-900">{subMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="Name (optional)"
                  className="flex-1 bg-white border border-sage-200/80 rounded-xl px-4 py-3 text-[13px] text-gray-900 placeholder-gray-300 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
                />
                <input
                  type="email"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="flex-[1.5] bg-white border border-sage-200/80 rounded-xl px-4 py-3 text-[13px] text-gray-900 placeholder-gray-300 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={subStatus === 'loading'}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-[14px] font-semibold rounded-xl hover:from-teal-400 hover:to-teal-500 transition-all shadow-glow-teal disabled:opacity-60"
              >
                {subStatus === 'loading' ? 'Sending...' : 'Subscribe'}
                {subStatus !== 'loading' && <ArrowRight className="w-4 h-4" />}
              </button>
              {subStatus === 'error' && (
                <p className="text-[12px] text-red-500">{subMsg}</p>
              )}
              <p className="text-[11px] text-gray-400">No spam. Unsubscribe anytime.</p>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-sage-200/40 py-6 px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <Lock className="w-3 h-3 text-teal-500/50" />
            <span>Protected by SMART on FHIR OAuth 2.0</span>
          </div>
          <span className="text-[11px] text-gray-400">University of Washington &middot; Patient Health Data Agent</span>
        </div>
      </footer>
    </div>
  )
}
