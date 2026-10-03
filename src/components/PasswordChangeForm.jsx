import { useState } from 'react'
import { passwordProblem, PASSWORD_MIN_LENGTH } from '../lib/account'
import { st } from './authStyles'

/**
 * Formulario de cambio de contraseña (primer login y Mi cuenta).
 * onSubmit({ currentPassword, newPassword, revokeOthers }) → { ok, error? }.
 * Las contraseñas solo viven en el estado de este formulario y se limpian al terminar.
 */
export default function PasswordChangeForm({ email, currentLabel = 'Contraseña actual', submitLabel = 'Guardar contraseña', showRevokeOption = false, onSubmit }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [revokeOthers, setRevokeOthers] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return
    const problem = passwordProblem(next, { email, currentPassword: current, confirm })
    if (problem) { setError(problem); return }
    setBusy(true)
    setError('')
    const r = await onSubmit({ currentPassword: current, newPassword: next, revokeOthers })
    setBusy(false)
    if (r?.ok) { setCurrent(''); setNext(''); setConfirm(''); return }
    setError(r?.error || 'No pudimos cambiar la contraseña. Intentá nuevamente.')
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label={currentLabel} value={current} onChange={setCurrent} autoComplete="current-password" />
      <Field label="Nueva contraseña" value={next} onChange={setNext} autoComplete="new-password" placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`} />
      <Field label="Confirmar nueva contraseña" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      {showRevokeOption && (
        <label style={st.check}>
          <input type="checkbox" checked={revokeOthers} onChange={e => setRevokeOthers(e.target.checked)} />
          Cerrar sesión en otros dispositivos
        </label>
      )}
      {error && <p role="alert" style={st.error}>{error}</p>}
      <button type="submit" disabled={busy} style={{ ...st.btn, opacity: busy ? 0.7 : 1 }}>
        {busy ? 'Guardando…' : submitLabel}
      </button>
    </form>
  )
}

function Field({ label, value, onChange, autoComplete, placeholder }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={st.label}>{label}</label>
      <input type="password" required value={value} autoComplete={autoComplete} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} style={st.input} />
    </div>
  )
}


export function Brand() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
      <div style={{ width: 22, height: 3, background: '#4F7EFF', borderRadius: 2, marginBottom: 6 }} />
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: '.08em', color: '#EDF1F8' }}>HAVEN</div>
    </div>
  )
}
