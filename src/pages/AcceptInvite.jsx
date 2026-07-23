import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Wordmark from '../components/Wordmark'

const SCANNER_URL = import.meta.env.VITE_SCANNER_URL || 'https://scanner.franzthorres.workers.dev'

const C = {
  bg:         '#080b12',
  card:       'rgba(20,27,46,.45)',
  border:     'rgba(130,150,220,.12)',
  t1:         '#e8ecf5',
  t2:         '#9aa6c2',
  t3:         '#7f8aa6',
  accent:     '#5b6ef5',
  accentGrad: 'linear-gradient(135deg,#5b6ef5,#7c5bf5)',
  link:       '#8aa0ff',
  green:      '#3ddc84',
  greenText:  '#5fe39c',
  amber:      '#f5b544',
  amberText:  '#f5c46b',
  red:        '#f2637e',
  title:      "'Space Grotesk',sans-serif",
  body:       "'Manrope',sans-serif",
  mono:       "'JetBrains Mono',monospace",
}

function Icon({ name, size = 16, color = 'currentColor', sw = 1.5 }) {
  const paths = {
    shield:      <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    check:       <><polyline points="20 6 9 17 4 12"/></>,
    'x-mark':    <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    mail:        <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></>,
    'arrow-right':<><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      {paths[name] ?? null}
    </svg>
  )
}

const ROLE_LABELS = { admin: 'Admin', viewer: 'Viewer' }

export default function AcceptInvite() {
  const [searchParams]  = useSearchParams()
  const navigate        = useNavigate()
  const token           = searchParams.get('token')

  const [step, setStep]           = useState('loading')   // loading | info | auth | accepting | done | error
  const [inviteInfo, setInviteInfo] = useState(null)       // { org_name, email, role, valid }
  const [authMode, setAuthMode]   = useState('login')      // login | signup
  const [form, setForm]           = useState({ email: '', password: '' })
  const [authError, setAuthError] = useState(null)
  const [busy, setBusy]           = useState(false)

  useEffect(() => {
    if (!token) { setStep('error'); return }
    validateToken()
  }, [token])

  async function validateToken() {
    try {
      const res = await fetch(`${SCANNER_URL}/invite-info?token=${token}`)
      const data = await res.json()
      if (!data.valid) { setStep('error'); return }
      setInviteInfo(data)

      const { data: { user } } = await supabase.auth.getUser()
      setStep(user ? 'info' : 'auth')
    } catch {
      setStep('error')
    }
  }

  async function handleAuth(e) {
    e.preventDefault()
    setAuthError(null)
    setBusy(true)
    try {
      let result
      if (authMode === 'login') {
        result = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
      } else {
        result = await supabase.auth.signUp({ email: form.email, password: form.password })
      }
      if (result.error) {
        setAuthError(result.error.message)
        setBusy(false)
        return
      }
      if (authMode === 'signup' && result.data.user && !result.data.session) {
        setAuthError('Revisá tu email para confirmar tu cuenta y luego volvé a este link.')
        setBusy(false)
        return
      }
      setStep('info')
    } catch {
      setAuthError('Error inesperado. Intentá de nuevo.')
    }
    setBusy(false)
  }

  async function handleAccept() {
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SCANNER_URL}/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (data.ok) {
        setStep('done')
        setTimeout(() => navigate('/dashboard'), 2500)
      } else {
        setAuthError(data.error || 'No se pudo aceptar la invitación.')
        setStep('error')
      }
    } catch {
      setAuthError('Error de red al aceptar la invitación.')
      setStep('error')
    }
    setBusy(false)
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 9, padding: '11px 14px',
    color: C.t1, fontSize: 14, fontFamily: C.body, outline: 'none',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(ellipse at 50% 20%, #131a2c 0%, ${C.bg} 65%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px 20px', fontFamily: C.body,
    }}>
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'center' }}>
        <Wordmark size={36} />
      </div>

      <div style={{
        width: '100%', maxWidth: 440,
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: '36px 32px',
      }}>

        {/* ─── LOADING ─── */}
        {step === 'loading' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: C.t2, fontSize: 14 }}>Verificando invitación…</p>
          </div>
        )}

        {/* ─── INFO: confirmación antes de aceptar ─── */}
        {step === 'info' && inviteInfo && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
              padding: '16px', background: 'rgba(91,110,245,.06)',
              border: '1px solid rgba(91,110,245,.2)', borderRadius: 12,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: 'rgba(91,110,245,.15)', display: 'grid', placeItems: 'center',
              }}>
                <Icon name="shield" size={20} color={C.link} />
              </div>
              <div>
                <div style={{ fontFamily: C.title, fontWeight: 700, fontSize: 15, color: C.t1 }}>
                  {inviteInfo.org_name}
                </div>
                <div style={{ fontSize: 13, color: C.t2, marginTop: 3 }}>
                  Te invitaron como{' '}
                  <span style={{
                    fontFamily: C.mono, fontSize: 12, color: C.link,
                    background: 'rgba(91,110,245,.1)', border: '1px solid rgba(91,110,245,.22)',
                    padding: '1px 7px', borderRadius: 6,
                  }}>
                    {ROLE_LABELS[inviteInfo.role] ?? inviteInfo.role}
                  </span>
                </div>
              </div>
            </div>

            <h2 style={{ fontFamily: C.title, fontWeight: 700, fontSize: 20, color: C.t1, marginBottom: 8 }}>
              Unirte al equipo
            </h2>
            <p style={{ fontSize: 14, color: C.t2, lineHeight: 1.6, marginBottom: 24 }}>
              Al aceptar vas a tener acceso al portal de seguridad de{' '}
              <b style={{ color: C.t1 }}>{inviteInfo.org_name}</b>.
            </p>

            <button
              onClick={handleAccept}
              disabled={busy}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: C.title, fontWeight: 700, fontSize: 15,
                color: '#fff', background: busy ? 'rgba(91,110,245,.5)' : C.accentGrad,
                border: 'none', padding: '13px', borderRadius: 10,
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              {busy ? 'Procesando…' : 'Aceptar invitación'}
              {!busy && <Icon name="arrow-right" size={14} color="#fff" />}
            </button>
          </>
        )}

        {/* ─── AUTH: login o registro ─── */}
        {step === 'auth' && (
          <>
            {inviteInfo && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
                padding: '12px 14px', background: 'rgba(91,110,245,.06)',
                border: '1px solid rgba(91,110,245,.2)', borderRadius: 10,
              }}>
                <Icon name="mail" size={14} color={C.link} />
                <span style={{ fontSize: 13, color: C.t2 }}>
                  Invitación a <b style={{ color: C.t1 }}>{inviteInfo.org_name}</b>{' '}
                  como <b style={{ color: C.link }}>{ROLE_LABELS[inviteInfo.role] ?? inviteInfo.role}</b>
                </span>
              </div>
            )}

            <h2 style={{ fontFamily: C.title, fontWeight: 700, fontSize: 20, color: C.t1, marginBottom: 6 }}>
              {authMode === 'login' ? 'Iniciá sesión para continuar' : 'Creá tu cuenta'}
            </h2>
            <p style={{ fontSize: 13, color: C.t2, marginBottom: 24 }}>
              {authMode === 'login'
                ? 'Usá la cuenta con la que recibiste la invitación.'
                : 'Completá el registro para aceptar la invitación.'}
            </p>

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: C.t2, marginBottom: 6 }}>Email</label>
                <input
                  type="email" required style={inputStyle}
                  placeholder="tu@email.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: C.t2, marginBottom: 6 }}>Contraseña</label>
                <input
                  type="password" required style={inputStyle}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>

              {authError && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px',
                  background: 'rgba(242,99,126,.08)', border: '1px solid rgba(242,99,126,.25)',
                  borderRadius: 8,
                }}>
                  <Icon name="x-mark" size={13} color={C.red} />
                  <span style={{ fontSize: 13, color: C.red }}>{authError}</span>
                </div>
              )}

              <button
                type="submit" disabled={busy}
                style={{
                  fontFamily: C.title, fontWeight: 700, fontSize: 14,
                  color: '#fff', background: busy ? 'rgba(91,110,245,.5)' : C.accentGrad,
                  border: 'none', padding: '12px', borderRadius: 10,
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                {busy ? 'Procesando…' : authMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button
                onClick={() => { setAuthMode(m => m === 'login' ? 'signup' : 'login'); setAuthError(null) }}
                style={{
                  fontFamily: C.body, fontSize: 13, color: C.link,
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                {authMode === 'login' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
              </button>
            </div>
          </>
        )}

        {/* ─── DONE ─── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(61,220,132,.12)', display: 'grid', placeItems: 'center',
              margin: '0 auto 20px',
            }}>
              <Icon name="check" size={24} color={C.greenText} sw={2.5} />
            </div>
            <h2 style={{ fontFamily: C.title, fontWeight: 700, fontSize: 20, color: C.t1, marginBottom: 8 }}>
              ¡Bienvenido al equipo!
            </h2>
            <p style={{ fontSize: 14, color: C.t2 }}>Redirigiendo al dashboard…</p>
          </div>
        )}

        {/* ─── ERROR ─── */}
        {step === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(242,99,126,.12)', display: 'grid', placeItems: 'center',
              margin: '0 auto 20px',
            }}>
              <Icon name="x-mark" size={24} color={C.red} sw={2.5} />
            </div>
            <h2 style={{ fontFamily: C.title, fontWeight: 700, fontSize: 20, color: C.t1, marginBottom: 8 }}>
              Invitación inválida
            </h2>
            <p style={{ fontSize: 14, color: C.t2, lineHeight: 1.6, marginBottom: 20 }}>
              {authError || 'Este link expiró, ya fue aceptado, o no existe. Pedile al propietario que te reenvíe la invitación.'}
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                fontFamily: C.title, fontWeight: 600, fontSize: 14,
                color: C.link, background: 'none',
                border: '1px solid rgba(138,160,255,.3)',
                padding: '10px 20px', borderRadius: 9, cursor: 'pointer',
              }}
            >
              Ir al login
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
