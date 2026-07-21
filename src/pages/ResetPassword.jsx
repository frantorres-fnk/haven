import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  async function handleReset(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setSuccess(true)
    setTimeout(() => navigate('/dashboard'), 3000)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080C18', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ width: 22, height: 3, background: '#4F7EFF', borderRadius: 2, marginBottom: 6 }} />
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: '.08em', color: '#EDF1F8' }}>HAVEN</div>
      </div>

      <div style={{ background: '#0C1220', border: '1px solid #1A2240', borderRadius: 16, padding: 40, width: '100%', maxWidth: 420 }}>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, color: '#EDF1F8', marginBottom: 8 }}>¡Contraseña actualizada!</h2>
            <p style={{ color: '#93A1BC', fontSize: 14 }}>Te redirigimos al portal en unos segundos...</p>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 22, color: '#EDF1F8', marginBottom: 8 }}>Nueva contraseña</h2>
            <p style={{ color: '#93A1BC', fontSize: 14, marginBottom: 28 }}>Elegí una contraseña segura para tu cuenta.</p>
            <form onSubmit={handleReset}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#93A1BC', marginBottom: 7 }}>Nueva contraseña</label>
                <input type="password" style={{ width: '100%', background: '#080C18', border: '1px solid #1A2240', borderRadius: 9, padding: '11px 14px', color: '#EDF1F8', fontSize: 14, outline: 'none', fontFamily: 'Inter,sans-serif' }}
                  placeholder="Mínimo 8 caracteres" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#93A1BC', marginBottom: 7 }}>Confirmar contraseña</label>
                <input type="password" style={{ width: '100%', background: '#080C18', border: '1px solid #1A2240', borderRadius: 9, padding: '11px 14px', color: '#EDF1F8', fontSize: 14, outline: 'none', fontFamily: 'Inter,sans-serif' }}
                  placeholder="Repetí la contraseña" value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </div>
              {error && <p style={{ color: '#FB6B6B', fontSize: 13, marginBottom: 16, background: 'rgba(251,107,107,.1)', padding: '10px 14px', borderRadius: 8 }}>{error}</p>}
              <button type="submit" disabled={loading} style={{ width: '100%', background: '#4F7EFF', color: '#fff', border: 'none', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", cursor: 'pointer' }}>
                {loading ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
