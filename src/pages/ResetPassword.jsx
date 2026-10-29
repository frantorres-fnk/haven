import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, hasRecentRecovery, clearRecovery } from '../lib/supabase'
import { getAccountState, PASSWORD_MIN_LENGTH } from '../lib/account'
import { readRecoveryToken, postResetRoute, AUTH_ERRORS } from '../lib/passwordSetup'
import Wordmark from '../components/Wordmark'

// Link de "¿Olvidaste tu contraseña?" o "Definí tu contraseña" (sesión de
// recuperación). Con una sesión normal no se ofrece: el cambio voluntario va por
// Mi cuenta, que exige la contraseña actual.
// Con token_hash el token se canjea (verifyOtp) recién al enviar el formulario:
// abrir el link (o que lo abra un escáner de correo) no lo consume.
export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [tokenHash, setTokenHash] = useState(() => readRecoveryToken(window.location.search))
  const [isRecovery, setIsRecovery] = useState(() => !!tokenHash || hasRecentRecovery())
  const navigate = useNavigate()

  useEffect(() => {
    if (window.location.search.includes('token_hash')) {
      try { window.history.replaceState(null, '', window.location.pathname) } catch { /* sin history */ }
    }
  }, [])

  async function handleReset(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < PASSWORD_MIN_LENGTH) { setError(`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`); return }
    setLoading(true)
    setError('')
    if (tokenHash) {
      const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
      if (otpErr) { setIsRecovery(false); setTokenHash(null); setLoading(false); return }
      setTokenHash(null)   // ya hay sesión de recuperación: un reintento no vuelve a canjear
    }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(AUTH_ERRORS[error.code] ?? error.message); setLoading(false); return }
    clearRecovery()
    setSuccess(true)
    const next = await postResetRoute(await getAccountState(supabase))
    setTimeout(() => navigate(next, { replace: true }), 2500)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080C18', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
        <Wordmark size={36} variant="outline" gap={11} />
      </div>

      <div style={{ background: '#0C1220', border: '1px solid #1A2240', borderRadius: 16, padding: 40, width: '100%', maxWidth: 420 }}>
        {!isRecovery ? (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 22, color: '#EDF1F8', marginBottom: 8 }}>Enlace no válido</h2>
            <p style={{ color: '#93A1BC', fontSize: 14, marginBottom: 24 }}>
              Este enlace venció, ya se usó o no es un enlace para definir contraseña. Pedí uno nuevo desde "¿Olvidaste tu contraseña?" o, si ya ingresaste, cambiala desde Mi cuenta.
            </p>
            <button onClick={() => navigate('/login')} style={{ width: '100%', background: '#4F7EFF', color: '#fff', border: 'none', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", cursor: 'pointer' }}>
              Ir al login
            </button>
          </div>
        ) : success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, color: '#EDF1F8', marginBottom: 8 }}>¡Contraseña definida!</h2>
            <p style={{ color: '#93A1BC', fontSize: 14 }}>Te llevamos a HAVEN en unos segundos...</p>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 22, color: '#EDF1F8', marginBottom: 8 }}>Definí tu contraseña</h2>
            <p style={{ color: '#93A1BC', fontSize: 14, marginBottom: 28 }}>Elegí una contraseña segura para tu cuenta. Solo vos la vas a conocer.</p>
            <form onSubmit={handleReset}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#93A1BC', marginBottom: 7 }}>Nueva contraseña</label>
                <input type="password" style={{ width: '100%', background: '#080C18', border: '1px solid #1A2240', borderRadius: 9, padding: '11px 14px', color: '#EDF1F8', fontSize: 14, outline: 'none', fontFamily: 'Inter,sans-serif' }}
                  placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`} value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#93A1BC', marginBottom: 7 }}>Confirmar contraseña</label>
                <input type="password" style={{ width: '100%', background: '#080C18', border: '1px solid #1A2240', borderRadius: 9, padding: '11px 14px', color: '#EDF1F8', fontSize: 14, outline: 'none', fontFamily: 'Inter,sans-serif' }}
                  placeholder="Repetí la contraseña" value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </div>
              {error && <p style={{ color: '#FB6B6B', fontSize: 13, marginBottom: 16, background: 'rgba(251,107,107,.1)', padding: '10px 14px', borderRadius: 8 }}>{error}</p>}
              <button type="submit" disabled={loading} style={{ width: '100%', background: '#4F7EFF', color: '#fff', border: 'none', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", cursor: 'pointer' }}>
                {loading ? 'Guardando...' : 'Definir contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
