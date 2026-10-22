import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getAccountState, guardDecision, fetchOwnOrgStatus, accessEndedCopy } from '../lib/account'

/**
 * Guard de rutas protegidas. Es solo UX: el bloqueo real de la contraseña
 * temporal y de la org inactiva está en el Worker (403) y en RLS (auth_org_ids vacío).
 *
 *   sin sesión                      → /login
 *   contraseña temporal pendiente   → /account/password-required
 *   allowPasswordChange (esa misma página) y ya no hay flag → a donde corresponda
 *   org cancelled / past_due        → "Acceso finalizado" (sin renderizar la página)
 */
export default function RequireAccount({ children, allowPasswordChange = false }) {
  const [state, setState] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    getAccountState(supabase).then(s => { if (!cancelled) setState(s) })
    return () => { cancelled = true }
  }, [attempt])

  if (!state) return <Screen><p style={s.text}>Cargando…</p></Screen>

  const d = guardDecision(state, { allowPasswordChange })
  if (d.redirect) return <Navigate to={d.redirect} replace />
  if (d.inactive) return <AccessEnded orgStatus={state.orgStatus} />
  if (d.error) {
    return (
      <Screen>
        <p style={s.text}>No pudimos verificar tu sesión. Revisá tu conexión.</p>
        <button style={s.btn} onClick={() => { setState(null); setAttempt(a => a + 1) }}>Reintentar</button>
      </Screen>
    )
  }
  return children
}

// Sin datos del tenant: ni findings, ni dominios, ni configuración. La sesión no se
// cierra sola; el usuario decide.
function AccessEnded({ orgStatus }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  // Con RLS por estado la fila de la org no es visible: el motivo lo da el Worker
  const [status, setStatus] = useState(orgStatus ?? null)
  useEffect(() => {
    if (orgStatus) return
    let cancelled = false
    fetchOwnOrgStatus().then(st => { if (!cancelled && st) setStatus(st) })
    return () => { cancelled = true }
  }, [orgStatus])
  const copy = accessEndedCopy(status)
  async function logout() {
    setBusy(true)
    try { await supabase.auth.signOut() } catch { /* igual se va al login */ }
    navigate('/login', { replace: true })
  }
  return (
    <Screen>
      <div role="alert" style={s.card}>
        <h1 style={s.title}>Acceso finalizado</h1>
        <p style={s.body}>{copy.text}</p>
        {copy.cta && <a href={copy.cta.href} style={s.cta}>{copy.cta.label}</a>}
        <button style={{ ...s.btn, opacity: busy ? .6 : 1 }} disabled={busy} onClick={logout}>Cerrar sesión</button>
      </div>
    </Screen>
  )
}

function Screen({ children }) {
  return <div style={s.page}><div style={{ textAlign: 'center' }}>{children}</div></div>
}

const s = {
  page: { minHeight: '100vh', background: '#080C18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: '#93A1BC', fontSize: 14, fontFamily: 'Inter,sans-serif', marginBottom: 16 },
  btn:  { background: '#4F7EFF', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  card: { maxWidth: 420, background: '#0C1220', border: '1px solid #1A2240', borderRadius: 16, padding: '32px 28px' },
  title: { fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, color: '#EDF1F8', margin: '0 0 12px' },
  body: { color: '#93A1BC', fontSize: 14, lineHeight: 1.6, fontFamily: 'Inter,sans-serif', margin: '0 0 24px' },
  cta:  { display: 'block', color: '#8aa0ff', fontSize: 14, fontWeight: 600, fontFamily: 'Inter,sans-serif', textDecoration: 'none', marginBottom: 16 },
}
