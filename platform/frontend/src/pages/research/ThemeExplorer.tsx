import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Palette, ArrowLeft, Check, Loader2, Sparkles, FlaskConical } from 'lucide-react'
import { researchApi } from './researchApi'
import type { Patient } from './types'
import RelationalChart from './ehr/RelationalChart'
import { RELATIONAL_THEMES, getTheme } from './themes'

/**
 * Interactive palette explorer for the Relational chart. Lets us preview the
 * linked-EHR model under each candidate theme live, without touching the
 * controlled in-study prototype (which stays Clinical Teal).
 */
export default function ThemeExplorer() {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [themeId, setThemeId] = useState('vibrant')
  const [error, setError] = useState('')
  const theme = getTheme(themeId)

  useEffect(() => {
    researchApi.getStudy()
      .then((s) => setPatient(s.patient))
      .catch((e) => setError(e?.message || 'Failed to load demo chart'))
  }, [])

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-sage-200/60">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/research" className="flex items-center gap-2 text-[13px] font-semibold text-gray-500 hover:text-teal-700">
            <ArrowLeft className="w-4 h-4" /> Research home
          </Link>
          <div className="flex items-center gap-2 text-[13px] font-semibold text-teal-700">
            <Palette className="w-4 h-4" /> Theme Explorer
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 border border-teal-200/60 rounded-full mb-4">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-[11px] font-semibold text-teal-700">Design exploration</span>
          </div>
          <h1 className="text-[34px] leading-tight font-bold tracking-tight text-gray-900 mb-2">
            Relational chart, every palette
          </h1>
          <p className="text-[15px] text-gray-500 max-w-2xl">
            Flip between candidate color systems to feel how the linked-EHR model reads in each.
            The in-study prototype stays <span className="font-semibold text-teal-700">Clinical Teal</span> so the
            Traditional vs Relational comparison remains controlled.
          </p>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
          {/* Theme picker */}
          <div className="space-y-2.5 lg:sticky lg:top-24">
            {RELATIONAL_THEMES.map((t) => {
              const active = t.id === themeId
              return (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${
                    active
                      ? 'border-teal-400 bg-white shadow-soft ring-2 ring-teal-100'
                      : 'border-sage-200/70 bg-white/60 hover:bg-white hover:border-sage-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      {t.swatch.map((c, i) => (
                        <span key={i} className="w-5 h-5 rounded-full border border-black/5" style={{ background: c }} />
                      ))}
                    </div>
                    {active && <Check className="w-4 h-4 text-teal-600" />}
                  </div>
                  <div className="text-[14px] font-bold text-gray-900">{t.name}</div>
                  <div className="text-[12px] text-gray-500 leading-snug mt-0.5">{t.tagline}</div>
                </button>
              )
            })}
          </div>

          {/* Live preview */}
          <div>
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 text-[14px]">{error}</div>
            ) : !patient ? (
              <div className="rounded-2xl border border-sage-200/70 bg-white p-16 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-semibold uppercase tracking-widest text-gray-400">Live preview · {theme.name}</span>
                  <span className="text-[11px] text-gray-400">Click any record to reveal its links</span>
                </div>
                <RelationalChart patient={patient} theme={theme} />
              </div>
            )}
          </div>
        </div>

        <footer className="mt-12 pt-6 border-t border-sage-200/60 flex items-center justify-between text-[12px] text-gray-400">
          <span className="flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5" /> CareOS Research · Usability Lab</span>
          <Link to="/relational" className="font-semibold text-teal-700 hover:text-teal-800">View the vibrant showcase →</Link>
        </footer>
      </div>
    </div>
  )
}
