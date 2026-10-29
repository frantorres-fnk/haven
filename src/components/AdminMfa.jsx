import { useRef, useState } from 'react'
import Wordmark from './Wordmark'
import { startEnrollment, verifyTotp } from '../lib/adminMfa'

const K = {
  bg: '#080b12', card: 'rgba(20,27,46,.55)', border: 'rgba(130,150,220,.14)', input: '#101623', inputBdr: 'rgba(130,150,220,.16)',
  t1: '#e8ecf5', t2: '#9aa6c2', t3: '#7f8aa6', accent: '#5b6ef5', accentBtn: 'linear-gradient(135deg,#5b6ef5,#6d5bf5)', red: '#f2637e',
  title: "'Space Grotesk',sans-serif", body: "'Manrope',sans-serif", mono: "'JetBrains Mono',monospace",
}
const APPS = ['Google Authenticator', 'Microsoft Authenticator', '1Password', 'Authy', 'Apple Passwords / compatible TOTP']

/**
 * Segundo paso del login de /admin. mode:
 *   'challenge' → factores TOTP verificados: pedir el código
 *   'enroll'    → sin MFA: enrolamiento obligatorio (QR + secret de Supabase)
 * El secret/QR solo viven en el estado de este componente; nunca se guardan.
 */
// Reutilizado por el Partner Hub (MFA obligatorio para usuarios Partner): solo cambian
// los textos y el nombre del factor; el flujo y las garantías son los mismos.
export default function AdminMfa({ client, mode, factors = [], onVerified, onLogout,
  enrollTitle = 'Protegé tu acceso administrativo',
  enrollIntro = 'El acceso al portal administrativo de HAVEN requiere autenticación en dos pasos.',
  friendlyName, header = null }) {
  const [enrollment, setEnrollment] = useState(null)   // { factorId, qr, secret }
  const [factorId, setFactorId] = useState(factors[0]?.id ?? null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)
  const inFlight = useRef(false)

  async function begin() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true); setError('')
    const r = await startEnrollment(client, ...(friendlyName ? [friendlyName] : []))
    inFlight.current = false
    setBusy(false)
    if (r.ok) setEnrollment({ factorId: r.factorId, qr: r.qr, secret: r.secret })
    else setError(r.error)
  }

  async function submit(e) {
    e.preventDefault()
    const target = mode === 'enroll' ? enrollment?.factorId : factorId
    if (inFlight.current || !target) return
    inFlight.current = true
    setBusy(true); setError('')
    const r = await verifyTotp(client, target, code.trim())
    inFlight.current = false
    setBusy(false)
    setCode('')
    if (r.ok) { setEnrollment(null); onVerified() }
    else setError(r.error)
  }

  async function copySecret() {
    try { await navigator.clipboard.writeText(enrollment.secret); setCopied(true) } catch { setCopied(false) }
  }

  const codeForm = (label) => (
    <form onSubmit={submit} noValidate>
      <label style={{ display: 'block', fontSize: 12.5, color: K.t2, marginBottom: 7 }} htmlFor="mfa-code">Código de verificación</label>
      <input id="mfa-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus placeholder="••••••" aria-label="Código de 6 dígitos"
        style={{ width: '100%', boxSizing: 'border-box', height: 48, background: K.input, border: `1px solid ${error ? K.red : K.inputBdr}`, borderRadius: 10, padding: '0 14px', color: K.t1, fontSize: 22, letterSpacing: '.4em', textAlign: 'center', fontFamily: K.mono, outline: 'none' }} />
      {error && <p role="alert" style={{ color: K.red, fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
      <button type="submit" disabled={busy || code.length !== 6}
        style={{ width: '100%', height: 46, marginTop: 16, fontFamily: K.title, fontWeight: 700, fontSize: 14.5, color: '#fff', background: K.accentBtn, border: 'none', borderRadius: 10, cursor: busy || code.length !== 6 ? 'not-allowed' : 'pointer', opacity: busy || code.length !== 6 ? .55 : 1 }}>
        {busy ? 'Verificando…' : label}
      </button>
    </form>
  )

  return (
    <div style={{ minHeight: '100vh', background: K.bg, display: 'grid', placeItems: 'center', padding: 20, fontFamily: K.body }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>{header ?? <Wordmark size={34} />}</div>
        <div style={{ background: K.card, border: `1px solid ${K.border}`, borderRadius: 18, padding: '28px 28px 24px', backdropFilter: 'blur(8px)' }}>
          {mode === 'challenge' && (<>
            <h1 style={{ fontFamily: K.title, fontSize: 20, color: K.t1, margin: '0 0 8px' }}>Verificación en dos pasos</h1>
            <p style={{ fontSize: 13.5, color: K.t2, lineHeight: 1.6, margin: '0 0 18px' }}>Ingresá el código generado por tu aplicación de autenticación.</p>
            {factors.length > 1 && (
              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ display: 'block', fontSize: 12.5, color: K.t2, marginBottom: 7 }}>Autenticador</span>
                <select value={factorId ?? ''} onChange={e => setFactorId(e.target.value)}
                  style={{ width: '100%', height: 40, background: K.input, border: `1px solid ${K.inputBdr}`, borderRadius: 10, color: K.t1, padding: '0 10px' }}>
                  {factors.map((f, i) => <option key={f.id} value={f.id}>{f.friendly_name || `Autenticador ${i + 1}`}</option>)}
                </select>
              </label>
            )}
            {codeForm('Verificar')}
          </>)}

          {mode === 'enroll' && !enrollment && (<>
            <h1 style={{ fontFamily: K.title, fontSize: 20, color: K.t1, margin: '0 0 8px' }}>{enrollTitle}</h1>
            <p style={{ fontSize: 13.5, color: K.t2, lineHeight: 1.6, margin: '0 0 20px' }}>{enrollIntro}</p>
            {error && <p role="alert" style={{ color: K.red, fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
            <button onClick={begin} disabled={busy}
              style={{ width: '100%', height: 46, fontFamily: K.title, fontWeight: 700, fontSize: 14.5, color: '#fff', background: K.accentBtn, border: 'none', borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .6 : 1 }}>
              {busy ? 'Preparando…' : 'Configurar autenticador'}
            </button>
          </>)}

          {mode === 'enroll' && enrollment && (<>
            <div style={{ fontFamily: K.mono, fontSize: 10, color: K.t3, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 6 }}>Seguridad de la cuenta</div>
            <p style={{ fontSize: 13.5, color: K.t2, lineHeight: 1.6, margin: '0 0 8px' }}>Escaneá este código QR con:</p>
            <ul style={{ fontSize: 12.5, color: K.t3, margin: '0 0 14px', paddingLeft: 18, lineHeight: 1.7 }}>{APPS.map(a => <li key={a}>{a}</li>)}</ul>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <img src={enrollment.qr} alt="Código QR para configurar el autenticador" width={180} height={180} style={{ background: '#fff', borderRadius: 12, padding: 8 }} />
            </div>
            <button type="button" onClick={() => setShowSecret(v => !v)} style={{ background: 'none', border: 'none', color: '#8aa0ff', fontSize: 12.5, cursor: 'pointer', padding: 0, marginBottom: 8 }}>
              ¿No podés escanearlo?
            </button>
            {showSecret && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                <code data-testid="mfa-secret" style={{ flex: 1, fontFamily: K.mono, fontSize: 12.5, color: K.t1, background: K.input, border: `1px solid ${K.inputBdr}`, borderRadius: 8, padding: '8px 10px', wordBreak: 'break-all' }}>{enrollment.secret}</code>
                <button type="button" onClick={copySecret} style={{ fontSize: 12, color: K.t1, background: 'none', border: `1px solid ${K.inputBdr}`, borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>{copied ? '✓' : 'Copiar'}</button>
              </div>
            )}
            {codeForm('Activar MFA')}
          </>)}

          <button type="button" onClick={onLogout} disabled={busy} style={{ display: 'block', margin: '18px auto 0', background: 'none', border: 'none', color: K.t3, fontSize: 12.5, cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
