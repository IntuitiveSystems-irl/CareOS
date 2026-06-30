/**
 * Patient QR Code Display
 * Route: /patient/qr/:patientId
 *
 * Shows the patient's current check-in QR code for display at clinic.
 * Also shows health wallet balance.
 */
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { QrCode, Wallet, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react'

function QRImage({ value, size = 220 }: { value: string; size?: number }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=111111&margin=2`
  return <img src={src} alt="Check-in QR code" width={size} height={size} className="rounded-xl" />
}

const API = '/api'

export default function PatientQR() {
  const { patientId } = useParams<{ patientId: string }>()
  const [qr, setQr] = useState<any>(null)
  const [wallet, setWallet] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      const [qrRes, walletRes] = await Promise.all([
        fetch(`${API}/checkin/qr/${patientId}`),
        fetch(`${API}/checkin/wallet/${patientId}`),
      ])
      const qrData = await qrRes.json()
      const walletData = await walletRes.json()
      setQr(qrData)
      setWallet(walletData)
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { if (patientId) load() }, [patientId])

  const refresh = () => { setRefreshing(true); load() }

  const timeLeft = qr?.expires_at
    ? Math.max(0, Math.floor((new Date(qr.expires_at).getTime() - Date.now()) / 60000))
    : null

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col items-center" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
        </div>
      ) : (
        <div className="w-full max-w-sm px-5 py-10 flex flex-col gap-6">
          {/* Header */}
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#c4ff4d] flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-6 h-6 text-[#111]" />
            </div>
            <h1 className="text-[20px] font-bold">Your Check-In Code</h1>
            <p className="text-[12px] text-white/40 mt-1">Show this at the clinic</p>
          </div>

          {/* QR */}
          {qr?.qr_content && (
            <div className="bg-white rounded-3xl p-6 flex items-center justify-center">
              <QRImage value={qr.qr_content} size={220} />
            </div>
          )}

          {/* Token display */}
          <div className="text-center space-y-1">
            <p className="font-mono text-[13px] text-white/50 break-all">{qr?.token}</p>
            {timeLeft !== null && (
              <p className="text-[11px] text-white/30">Expires in ~{timeLeft} min</p>
            )}
          </div>

          {/* Wallet */}
          {wallet && (
            <div className="rounded-2xl bg-white/6 border border-white/10 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#c4ff4d]/15 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-[#c4ff4d]" />
              </div>
              <div>
                <p className="text-[22px] font-bold text-[#c4ff4d]">${wallet.wallet?.balance_usd?.toFixed(2)}</p>
                <p className="text-[11px] text-white/40">Health wallet · ${wallet.wallet?.lifetime_earned_usd?.toFixed(2)} lifetime</p>
              </div>
            </div>
          )}

          {/* Reward notice */}
          {qr?.reward_available_usd && (
            <div className="rounded-xl bg-[#c4ff4d]/8 border border-[#c4ff4d]/15 px-4 py-3 text-center">
              <p className="text-[13px] font-semibold text-[#c4ff4d]">
                ${qr.reward_available_usd} available for research participation
              </p>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 text-[13px] text-white/40 hover:text-white transition"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh QR'}
          </button>

          {/* Footer */}
          <div className="text-center text-[11px] text-white/25 space-y-1">
            <div className="flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>No personal information in QR · HIPAA · FHIR R4</span>
            </div>
            <Link to="/web3" className="text-white/25 hover:text-white transition">CareOS Data Economy</Link>
          </div>
        </div>
      )}
    </div>
  )
}
