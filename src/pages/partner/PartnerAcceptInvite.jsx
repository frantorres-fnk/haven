import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { authErrorMessage } from '../../lib/authErrors'
import { partnerApi, failure, ROLE_LABEL } from '../../lib/partner'
import { Button, Field, Notice, PartnerMark, PoweredBy } from './ui'
import { K, inputStyle } from './tokens'

const INVALID = {
  expired: 'La invitación venció. Pedile a tu Partner que te invite de nuevo.',
  not_pending: 'La invitación ya fue usada o revocada.',
  partner_inactive: 'El Partner Hub de este Partner no está activo.',
  not_found: 'El link de invitación no es válido.',
}

/**
 * Aceptación de invitación Partner. Sin contraseñas por email: el invitado entra con
 * su cuenta (o la crea) y acepta. El Worker valida token (hash), vencimiento, email
 * de la sesión == email invitado y Partner activo. Después, el Hub exige MFA.
 */
export default function PartnerAcceptInvite() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [info, setInfo] = useState(null)
  const [invalid, setInvalid] = useState('')
  const [user, setUser] = useState(null)
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ password: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!token) { setInvalid(INVALID.not_found); return }
      const r = await partnerApi.inviteInfo(token)
      if (cancelled) return
      if (r.status !== 200) { setInvalid('No pudimos validar la invitación. Intentá nuevamente.'); return }
      if (!r.data?.valid) { setInvalid(INVALID[r.data?.reason] ?? INVALID.not_found); return }
      setInfo(r.data)
      const { data } = await supabase.auth.getUser()
      if (!cancelled) setUser(data?.user ?? null)
    })()
    return () => { cancelled = true }
  }, [token])

  async function auth(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    const creds = { email: info.email, password: form.password }
    const r = mode === 'login' ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds)
    setBusy(false)
    if (r.error) { setError(authErrorMessage(r.error)); return }
    if (mode === 'signup' && !r.data.session) { setNotice('Revisá tu email para confirmar la cuenta y después volvé a este link.'); return }
    setUser(r.data.user)
  }

  async function accept() {
    setBusy(true); setError('')
    const r = await partnerApi.acceptInvite(token)
    setBusy(false)
    if (r.status === 200 && r.data?.ok) { navigate('/partner/dashboard', { replace: true }); return }
    setError(failure(r, 'No se pudo aceptar la invitación.'))
  }

  const sameEmail = user && info && String(user.email).toLowerCase() === info.email
  return (
    <div style={{ minHeight: '100vh', background: K.bg, display: 'grid', placeItems: 'center', padding: 20, fontFamily: K.body }}>
      <div style={{ width: '100%', maxWidth: 420, background: K.card, border: `1px solid ${K.border}`, borderRadius: 18, padding: 28 }}>
        {invalid && <><h1 style={{ fontFamily: K.title, fontSize: 20, color: K.t1, margin: '0 0 12px' }}>Invitación no disponible</h1><Notice>{invalid}</Notice><PoweredBy /></>}
        {!invalid && !info && <p style={{ color: K.t2 }}>Validando invitación…</p>}
        {info && (<>
          <div style={{ marginBottom: 20 }}><PartnerMark branding={info.partner} /></div>
          <h1 style={{ fontFamily: K.title, fontSize: 20, color: K.t1, margin: '0 0 8px' }}>Te invitaron al Partner Hub</h1>
          <p style={{ color: K.t2, fontSize: 13.5, lineHeight: 1.6, margin: '0 0 18px' }}>
            Invitación para <strong style={{ color: K.t1 }}>{info.email}</strong> con el rol <strong style={{ color: K.t1 }}>{ROLE_LABEL[info.role]}</strong>. El acceso requiere verificación en dos pasos.
          </p>
          {error && <Notice>{error}</Notice>}
          {notice && <Notice tone="good">{notice}</Notice>}
          {user && !sameEmail && (
            <>
              <Notice tone="warn">Iniciaste sesión como {user.email}. Esta invitación es para {info.email}.</Notice>
              <Button variant="ghost" onClick={async () => { await supabase.auth.signOut(); setUser(null) }}>Cambiar de cuenta</Button>
            </>
          )}
          {sameEmail && <Button onClick={accept} disabled={busy} style={{ width: '100%', height: 44 }}>{busy ? 'Aceptando…' : 'Aceptar invitación'}</Button>}
          {!user && (
            <form onSubmit={auth} noValidate>
              <Field label="Email"><input value={info.email} disabled style={inputStyle()} /></Field>
              <Field label={mode === 'login' ? 'Contraseña' : 'Elegí una contraseña'} hint={mode === 'signup' ? 'Mínimo 12 caracteres.' : null}>
                <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={e => setForm({ password: e.target.value })} style={inputStyle()} />
              </Field>
              <Button type="submit" disabled={busy || (mode === 'signup' ? form.password.length < 12 : !form.password)} style={{ width: '100%', height: 44 }}>
                {busy ? 'Un momento…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
              </Button>
              <button type="button" onClick={() => setMode(m => (m === 'login' ? 'signup' : 'login'))} style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', color: K.t3, fontSize: 12.5, cursor: 'pointer' }}>
                {mode === 'login' ? '¿No tenés cuenta? Creala' : 'Ya tengo cuenta'}
              </button>
            </form>
          )}
        </>)}
      </div>
    </div>
  )
}
