import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getAccountState, guardDecision } from '../lib/account'

/**
 * Guard de rutas protegidas. Es solo UX: el bloqueo real de la contraseña
 * temporal está en el Worker (403) y en RLS (auth_org_ids vacío).
 *
 *   sin sesión                      → /login
 *   contraseña temporal pendiente   → /account/password-required
 *   allowPasswordChange (esa misma página) y ya no hay flag → a donde corresponda
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

function Screen({ children }) {
  return <div style={s.page}><div style={{ textAlign: 'center' }}>{children}</div></div>
}

const s = {
  page: { minHeight: '100vh', background: '#080C18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: '#93A1BC', fontSize: 14, fontFamily: 'Inter,sans-serif', marginBottom: 16 },
  btn:  { background: '#4F7EFF', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}
