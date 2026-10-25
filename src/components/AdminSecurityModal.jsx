import { useRef, useState } from 'react'
import { changeAdminPassword } from '../lib/adminPassword'

const K = {
  overlay: 'rgba(8,11,18,.85)', card: '#0d1526', border: 'rgba(130,150,220,.14)', borderHi: 'rgba(130,150,220,.22)',
  input: '#101623', inputBdr: 'rgba(130,150,220,.16)', t1: '#e8ecf5', t2: '#9aa6c2', t3: '#7f8aa6',
  accentBtn: 'linear-gradient(135deg,#5b6ef5,#6d5bf5)', red: '#f2637e', green: '#5fe39c',
  title: "'Space Grotesk',sans-serif", body: "'Manrope',sans-serif",
}

/**
 * "Seguridad de la cuenta" del portal Admin: cambio de contraseña con Supabase
 * Auth (sesión aal2). Las contraseñas solo viven en el estado de este componente
 * mientras se edita; al terminar (bien o mal) se limpian.
 */
export default function AdminSecurityModal({ client, onClose, onPasswordChanged, onMfaRequired, changePassword = changeAdminPassword }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  const complete = current && next && confirm

  async function submit(e) {
    e.preventDefault()
    if (inFlight.current || !complete) return
    inFlight.current = true
    setBusy(true); setError('')
    const r = await changePassword(client, { current, next, confirm })
    inFlight.current = false
    setBusy(false)
    if (r.ok) {
      setCurrent(''); setNext(''); setConfirm('')
      onPasswordChanged()
      return
    }
    if (r.reason === 'mfa_required') { setCurrent(''); setNext(''); setConfirm(''); onMfaRequired(); return }
    setError(r.error)
  }

  const field = (id, label, value, setValue, autoComplete) => (
    <label htmlFor={id} style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: 12.5, color: K.t2, marginBottom: 7 }}>{label}</span>
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={e => setValue(e.target.value)} autoComplete={autoComplete}
        spellCheck={false} autoCapitalize="off"
        style={{ width: '100%', boxSizing: 'border-box', height: 44, background: K.input, border: `1px solid ${K.inputBdr}`, borderRadius: 10, padding: '0 14px', color: K.t1, fontSize: 14, fontFamily: K.body, outline: 'none' }} />
    </label>
  )

  return (
    <div onClick={() => !busy && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 220, background: K.overlay, backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Seguridad de la cuenta" onClick={e => e.stopPropagation()}
        style={{ background: K.card, border: `1px solid ${K.borderHi}`, borderRadius: 18, padding: '26px 28px', maxWidth: 440, width: '100%', boxSizing: 'border-box', fontFamily: K.body }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <h2 style={{ fontFamily: K.title, fontSize: 19, color: K.t1, margin: 0 }}>Seguridad de la cuenta</h2>
          <button aria-label="Cerrar" onClick={onClose} disabled={busy} style={{ background: 'none', border: 'none', color: K.t3, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: K.t2, lineHeight: 1.6, margin: '0 0 18px' }}>
          Cambiar contraseña. Al terminar se cierra la sesión y vas a ingresar de nuevo con la nueva contraseña y tu código de verificación.
        </p>
        <form onSubmit={submit} noValidate>
          {field('admin-current-password', 'Contraseña actual', current, setCurrent, 'current-password')}
          {field('admin-new-password', 'Nueva contraseña', next, setNext, 'new-password')}
          {field('admin-confirm-password', 'Confirmar nueva contraseña', confirm, setConfirm, 'new-password')}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: K.t3, margin: '-4px 0 14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> Mostrar contraseñas
          </label>
          {error && <p role="alert" style={{ color: K.red, fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>{error}</p>}
          <button type="submit" disabled={busy || !complete}
            style={{ width: '100%', height: 46, fontFamily: K.title, fontWeight: 700, fontSize: 14.5, color: '#fff', background: K.accentBtn, border: 'none', borderRadius: 10, cursor: busy || !complete ? 'not-allowed' : 'pointer', opacity: busy || !complete ? .55 : 1 }}>
            {busy ? 'Actualizando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
