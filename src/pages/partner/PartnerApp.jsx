import { useCallback, useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { authErrorMessage } from '../../lib/authErrors'
import { getAdminMfaState, isAal2 } from '../../lib/adminMfa'
import { partnerApi, can, safeAccent, errorText, ROLE_LABEL } from '../../lib/partner'
import AdminMfa from '../../components/AdminMfa'
import Wordmark from '../../components/Wordmark'
import { Button, Field, Notice, PartnerMark, PoweredBy } from './ui'
import { K, inputStyle } from './tokens'
import PartnerClients from './PartnerClients'
import PartnerClientDetail from './PartnerClientDetail'
import PartnerRequests from './PartnerRequests'
import PartnerTeam from './PartnerTeam'
import PartnerBranding from './PartnerBranding'

const RESET_URL = 'https://haven.fenikso.io/reset-password'

/**
 * HAVEN Partner Hub (/partner/*). Guard: sesión → Worker (/partner/me: membresía
 * activa + Partner activo + aal2) → MFA si falta. El Worker es la autoridad; nada del
 * Hub se renderiza antes de que responda 200. Sin impersonación: el Partner usa su
 * propia sesión, nunca una del tenant.
 */
export default function PartnerApp() {
  const [phase, setPhase] = useState('checking')   // checking | login | mfa | blocked | ready | error
  const [me, setMe] = useState(null)
  const [mfa, setMfa] = useState(null)
  const [blocked, setBlocked] = useState('')
  const [loginError, setLoginError] = useState('')
  const navigate = useNavigate()

  const resolve = useCallback(async (fromLogin = false) => {
    const r = await partnerApi.me()
    if (r.status === 200 && r.data?.ok) {
      if (!(await isAal2(supabase))) return resolveMfa()
      setMe(r.data); setMfa(null); setPhase('ready'); return
    }
    const code = r.data?.error
    if (r.status === 403 && code === 'mfa_required') return resolveMfa()
    if (r.status === 401) { setPhase('login'); return }
    if (r.status === 403 && code === 'not_partner') {
      if (fromLogin) { await supabase.auth.signOut(); setLoginError(errorText(code)); setPhase('login'); return }
      setBlocked(errorText(code)); setPhase('blocked'); return
    }
    if (r.status === 403) { setBlocked(errorText(code, 'No tenés acceso al Partner Hub.')); setPhase('blocked'); return }
    setPhase('error')

    async function resolveMfa() {
      const st = await getAdminMfaState(supabase)
      if (st.level === 'challenge' || st.level === 'enroll') { setMfa({ mode: st.level, factors: st.factors ?? [] }); setPhase('mfa'); return }
      await supabase.auth.signOut()
      setLoginError('No pudimos verificar la autenticación en dos pasos. Intentá de nuevo.')
      setPhase('login')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let session = null
      try { ({ data: { session } } = await supabase.auth.getSession()) } catch { session = null }
      if (cancelled) return
      if (!session) { setPhase('login'); return }
      await resolve(false)
    })()
    return () => { cancelled = true }
  }, [resolve])

  async function logout() {
    await supabase.auth.signOut()
    setMe(null); setMfa(null); setBlocked(''); setPhase('login')
    navigate('/partner/login', { replace: true })
  }

  if (phase === 'checking') return <Screen><p style={{ color: K.t2, fontSize: 14 }}>Cargando…</p></Screen>
  if (phase === 'login') return <PartnerLogin error={loginError} onSubmit={async (email, password) => {
    setLoginError('')
    await supabase.auth.signOut()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setLoginError(authErrorMessage(error)); return }
    await resolve(true)
  }} />
  if (phase === 'mfa') {
    return <AdminMfa client={supabase} mode={mfa.mode} factors={mfa.factors} friendlyName="HAVEN Partner Hub"
      enrollTitle="Protegé el acceso de tu Partner" enrollIntro="El Partner Hub requiere autenticación en dos pasos para todos los usuarios."
      header={<HubWordmark />} onVerified={() => resolve(true)} onLogout={logout} />
  }
  if (phase === 'blocked' || phase === 'error') {
    return (
      <Screen>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <HubWordmark />
          <p role="alert" style={{ color: K.t1, fontSize: 15, lineHeight: 1.6, margin: '24px 0' }}>
            {phase === 'error' ? 'El servicio no está disponible en este momento. Intentá de nuevo.' : blocked}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {phase === 'error' && <Button onClick={() => { setPhase('checking'); resolve(false) }}>Reintentar</Button>}
            <Button variant="ghost" onClick={logout}>Cerrar sesión</Button>
          </div>
        </div>
      </Screen>
    )
  }
  return <HubLayout me={me} setMe={setMe} onLogout={logout} />
}

function HubWordmark() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <Wordmark size={32} />
      <span style={{ fontFamily: K.mono, fontSize: 10, color: K.t3, letterSpacing: '.2em', textTransform: 'uppercase' }}>Partner Hub</span>
    </div>
  )
}

function Screen({ children }) {
  return <div style={{ minHeight: '100vh', background: K.bg, display: 'grid', placeItems: 'center', padding: 20, fontFamily: K.body }}>{children}</div>
}

function PartnerLogin({ error, onSubmit }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [reset, setReset] = useState(null)   // null | 'form' | 'sent'
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    if (reset === 'form') {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: RESET_URL })
      setReset('sent')
    } else await onSubmit(email, password)
    setBusy(false)
  }
  return (
    <Screen>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}><HubWordmark /></div>
        <form onSubmit={submit} noValidate style={{ background: K.card, border: `1px solid ${K.border}`, borderRadius: 18, padding: 28 }}>
          <h1 style={{ fontFamily: K.title, fontSize: 20, color: K.t1, margin: '0 0 6px' }}>{reset ? 'Recuperar contraseña' : 'Ingresar al Partner Hub'}</h1>
          <p style={{ fontSize: 13, color: K.t2, margin: '0 0 20px', lineHeight: 1.6 }}>
            {reset ? 'Te enviamos un link para definir una contraseña nueva.' : 'Acceso para partners que operan HAVEN para sus clientes.'}
          </p>
          {error && <Notice>{error}</Notice>}
          {reset === 'sent'
            ? <Notice tone="good">Si el email tiene una cuenta, vas a recibir el link en unos minutos.</Notice>
            : <>
              <Field label="Email"><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle()} required /></Field>
              {!reset && <Field label="Contraseña"><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle()} required /></Field>}
              <Button type="submit" disabled={busy || !email || (!reset && !password)} style={{ width: '100%', marginTop: 6, height: 44 }}>
                {busy ? 'Un momento…' : reset ? 'Enviar link' : 'Ingresar'}
              </Button>
            </>}
          <button type="button" onClick={() => setReset(reset ? null : 'form')} style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', color: K.t3, fontSize: 12.5, cursor: 'pointer' }}>
            {reset ? 'Volver al ingreso' : '¿Olvidaste tu contraseña?'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 18 }}><PoweredBy /></div>
      </div>
    </Screen>
  )
}

const NAV = [
  { to: '/partner/dashboard', label: 'Dashboard' },
  { to: '/partner/clients', label: 'Clientes' },
  { to: '/partner/requests', label: 'Solicitudes' },
  { to: '/partner/team', label: 'Equipo', perm: 'team.manage' },
  { to: '/partner/branding', label: 'Branding' },
]

function HubLayout({ me, setMe, onLogout }) {
  const accent = safeAccent(me.partner?.accent_color)
  const onBranding = (branding) => setMe(m => ({ ...m, partner: { ...m.partner, ...branding } }))
  return (
    <div className="ph-shell" style={{ '--pa': accent, minHeight: '100vh', background: K.bg, fontFamily: K.body, color: K.t1 }}>
      <style>{`
        .ph-shell { display: grid; grid-template-columns: 240px 1fr; }
        .ph-side { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 22px; padding: 22px 16px; border-right: 1px solid ${K.border}; background: ${K.panel}; box-sizing: border-box; }
        .ph-nav { display: flex; flex-direction: column; gap: 2px; }
        .ph-nav a { color: ${K.t2}; text-decoration: none; font-size: 13.5px; font-weight: 600; padding: 9px 12px; border-radius: 9px; border-left: 2px solid transparent; }
        .ph-nav a:hover { color: ${K.t1}; background: rgba(130,150,220,.06); }
        .ph-nav a.active { color: ${K.t1}; background: rgba(130,150,220,.08); border-left-color: var(--pa); }
        .ph-main { padding: 28px 32px 48px; min-width: 0; max-width: 1280px; box-sizing: border-box; width: 100%; }
        .ph-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
        .ph-table { width: 100%; border-collapse: collapse; }
        .ph-scroll { overflow-x: auto; }
        @media (max-width: 860px) {
          .ph-shell { grid-template-columns: 1fr; }
          .ph-side { position: static; height: auto; flex-direction: row; flex-wrap: wrap; align-items: center; padding: 12px 16px; gap: 12px; border-right: none; border-bottom: 1px solid ${K.border}; }
          .ph-nav { flex-direction: row; flex-wrap: wrap; width: 100%; }
          .ph-nav a { border-left: none; border-bottom: 2px solid transparent; padding: 7px 10px; }
          .ph-nav a.active { border-bottom-color: var(--pa); }
          .ph-main { padding: 20px 16px 40px; }
          .ph-side-foot { width: 100%; flex-direction: row !important; justify-content: space-between; }
        }
      `}</style>
      <aside className="ph-side">
        <PartnerMark branding={me.partner} />
        <nav className="ph-nav" aria-label="Partner Hub">
          {NAV.filter(n => !n.perm || can(me, n.perm)).map(n => <NavLink key={n.to} to={n.to}>{n.label}</NavLink>)}
        </nav>
        <div className="ph-side-foot" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 12, color: K.t3, lineHeight: 1.5 }}>
            <div style={{ color: K.t2, wordBreak: 'break-all' }}>{me.user.email}</div>
            <div>{ROLE_LABEL[me.user.role] ?? me.user.role}</div>
          </div>
          <Button variant="ghost" small onClick={onLogout}>Cerrar sesión</Button>
        </div>
      </aside>
      <main className="ph-main">
        <Routes>
          <Route index element={<Navigate to="/partner/dashboard" replace />} />
          <Route path="login" element={<Navigate to="/partner/dashboard" replace />} />
          <Route path="dashboard" element={<PartnerClients me={me} dashboard />} />
          <Route path="clients" element={<PartnerClients me={me} />} />
          <Route path="clients/:organizationId" element={<PartnerClientDetail me={me} />} />
          <Route path="requests" element={<PartnerRequests me={me} />} />
          <Route path="team" element={can(me, 'team.manage') ? <PartnerTeam me={me} /> : <Navigate to="/partner/dashboard" replace />} />
          <Route path="branding" element={<PartnerBranding me={me} onChange={onBranding} />} />
          <Route path="*" element={<Navigate to="/partner/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}
