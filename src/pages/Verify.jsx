import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const SCANNER_URL = import.meta.env.VITE_SCANNER_URL || 'https://scanner.franzthorres.workers.dev'

export default function Verify() {
  const [status, setStatus] = useState('verifying')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      return
    }
    verifyDomain(token)
  }, [])

  async function verifyDomain(token) {
    try {
      const res = await fetch(`${SCANNER_URL}/verify?token=${token}`)
      const data = await res.json()
      if (data.ok) {
        setStatus('success')
        setTimeout(() => navigate('/dashboard'), 3000)
      } else {
        setStatus('error')
      }
    } catch (e) {
      setStatus('error')
    }
  }

  return (
    <div style={s.page}>
      <div style={s.logo}>
        <h1 style={s.logoText}>HAVEN<span style={s.dot}>.</span></h1>
        <p style={s.logoSub}>by Fenikso</p>
      </div>

      <div style={s.card}>
        {status === 'verifying' && (
          <>
            <div style={s.iconWrap}>
              <div style={s.spinner} />
            </div>
            <h2 style={s.title}>Verificando tu dominio...</h2>
            <p style={s.sub}>Un momento, estamos activando el monitoreo.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ ...s.iconWrap, background: '#2DD4BF' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#06231f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ ...s.title, color: '#2DD4BF' }}>¡Dominio verificado!</h2>
            <p style={s.sub}>Tu monitoreo está activo. Te redirigimos al portal en unos segundos.</p>
            <div style={s.infoBox}>
              <p style={{ fontSize: 13, color: '#93A1BC', margin: 0 }}>
                ✅ Monitoreo activo · 24/7<br/>
                🔍 Primer scan iniciado automáticamente
              </p>
            </div>
            <button style={s.btn} onClick={() => navigate('/dashboard')}>
              Ir al portal →
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ ...s.iconWrap, background: 'rgba(251,107,107,.15)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FB6B6B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            <h2 style={{ ...s.title, color: '#FB6B6B' }}>Link inválido o expirado</h2>
            <p style={s.sub}>El link de verificación no es válido o ya fue usado. Podés volver a solicitarlo desde el portal.</p>
            <button style={s.btn} onClick={() => navigate('/dashboard')}>
              Ir al portal →
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#0A0F1C', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  logo: { textAlign: 'center', marginBottom: '32px' },
  logoText: { fontFamily: "'Space Grotesk', sans-serif", fontSize: '28px', fontWeight: 700, color: '#EDF1F8', letterSpacing: '.04em' },
  dot: { color: '#2DD4BF' },
  logoSub: { fontSize: '11px', color: '#5E6C87', letterSpacing: '.18em', textTransform: 'uppercase', marginTop: '4px' },
  card: { background: '#131B2C', border: '1px solid #25304A', borderRadius: '16px', padding: '48px 40px', width: '100%', maxWidth: '420px', textAlign: 'center' },
  iconWrap: { width: 64, height: 64, borderRadius: '50%', background: 'rgba(45,212,191,.15)', display: 'grid', placeItems: 'center', margin: '0 auto 24px' },
  spinner: { width: 32, height: 32, borderRadius: '50%', border: '3px solid #25304A', borderTop: '3px solid #2DD4BF', animation: 'spin 1s linear infinite' },
  title: { fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 700, color: '#EDF1F8', marginBottom: '10px' },
  sub: { fontSize: '14px', color: '#93A1BC', lineHeight: 1.6, marginBottom: '24px' },
  infoBox: { background: '#0A0F1C', border: '1px solid #25304A', borderRadius: '10px', padding: '16px', margin: '0 0 24px', textAlign: 'left' },
  btn: { width: '100%', background: '#2DD4BF', color: '#06231f', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", cursor: 'pointer' },
}