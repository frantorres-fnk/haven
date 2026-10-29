import { useRef, useState } from 'react'
import { createClient, accessText, defaultServiceForm } from '../lib/adminProvisioning'
import { validateServiceForm, serviceSummary } from '../lib/serviceLifecycle'
import { ServicePeriodFields } from './ServiceLifecycleModal'

const K = {
  overlay: 'rgba(8,11,18,.85)', card: '#0d1526', border: 'rgba(130,150,220,.14)', borderHi: 'rgba(130,150,220,.22)', soft: 'rgba(130,150,220,.04)',
  input: '#101623', t1: '#e8ecf5', t2: '#9aa6c2', t3: '#7f8aa6', accent: '#5b6ef5', amber: '#f5b544', red: '#f2637e', green: '#5fe39c',
  title: "'Space Grotesk',sans-serif", body: "'Manrope',sans-serif", mono: "'JetBrains Mono',monospace",
}

/** "+ Crear cliente": alta completa del tenant vía POST /admin/organizations. */
export default function CreateClientModal({ scannerUrl, getToken, onClose, onCreated, onViewClient }) {
  const [form, setForm] = useState(() => ({ name: '', ownerName: '', ownerEmail: '', domain: '', ...defaultServiceForm() }))
  const [fields, setFields] = useState({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  // Guarda sincrónica contra doble click (el estado recién se actualiza en el próximo render)
  const inFlight = useRef(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const complete = form.name.trim() && form.ownerName.trim() && form.ownerEmail.trim() && form.domain.trim()

  async function submit(e) {
    e.preventDefault()
    if (inFlight.current || !complete) return
    const local = validateServiceForm(form)
    if (Object.keys(local).length) { setFields(local); setError('Revisá los datos marcados.'); return }
    inFlight.current = true
    setSubmitting(true)
    setError('')
    setFields({})
    const r = await createClient(scannerUrl, await getToken(), form)
    setSubmitting(false)
    inFlight.current = false
    if (r.ok) { setResult(r.data); onCreated?.(r.data) }
    else { setError(r.error); setFields(r.fields ?? {}) }
  }

  async function copyAccess() {
    const a = result.access
    try {
      await navigator.clipboard.writeText(accessText({ loginUrl: a.login_url, email: result.owner?.email ?? result.organization.email, tempPassword: a.temp_password, expiresAt: a.temp_password_expires_at }))
      setCopied(true)
    } catch { setCopied(false) }
  }

  const close = () => { if (!submitting) onClose() }

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 210, background: K.overlay, backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Crear cliente" onClick={e => e.stopPropagation()}
        style={{ background: K.card, border: `1px solid ${K.borderHi}`, borderTop: `2px solid ${K.accent}`, borderRadius: 18, padding: '28px 30px', maxWidth: 560, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box', fontFamily: K.body }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <h2 style={{ fontFamily: K.title, fontSize: 19, color: K.t1, margin: 0 }}>{result ? (result.created ? 'Cliente creado correctamente' : 'El cliente ya existía') : 'Crear cliente'}</h2>
          <button aria-label="Cerrar" onClick={close} disabled={submitting} style={{ background: 'none', border: 'none', color: K.t3, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {result ? (
          <div role="status">
            <Row label="Organización" value={result.organization.name} />
            <Row label="Owner" value={result.owner ? `${result.owner.name} · ${result.owner.email}` : (result.owners ?? []).join(', ')} mono />
            <Row label="Dominio principal" value={result.primary_domain ? `${result.primary_domain.domain}${result.primary_domain.verified ? '' : ' (pendiente de confirmación por el owner)'}` : '—'} mono />
            <Row label="Tipo" value={serviceSummary(result.organization).type} />
            <Row label="Vigencia" value={serviceSummary(result.organization).range} mono />
            <Row label="Estado" value={serviceSummary(result.organization).status} />
            <Row label="Acceso enviado" value={result.access?.email_sent === true ? 'Sí' : result.access?.email_sent === false ? 'No' : '—'} />

            {result.access?.temp_password && (
              <div style={{ border: `1px solid ${K.amber}55`, background: 'rgba(245,181,68,.06)', borderRadius: 10, padding: '12px 14px', margin: '14px 0' }}>
                <div style={{ fontSize: 12, color: K.amber, marginBottom: 8, lineHeight: 1.5 }}>
                  Contraseña temporal del owner — <strong>se muestra una sola vez</strong>. Enviala por un canal separado del email (vence en 72 h).
                </div>
                <div data-testid="temp-password" style={{ fontFamily: K.mono, fontSize: 14, color: K.t1, wordBreak: 'break-all', marginBottom: 10 }}>{result.access.temp_password}</div>
                <button onClick={copyAccess} style={{ fontSize: 12, color: K.t1, background: K.soft, border: `1px solid ${K.border}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
                  {copied ? '✓ Copiado' : 'Copiar acceso'}
                </button>
              </div>
            )}
            {result.owner?.existing_user && <p style={{ fontSize: 12, color: K.t2, margin: '10px 0' }}>El owner ya tenía usuario en HAVEN: ingresa con su contraseña habitual.</p>}
            {result.access?.note && <p style={{ fontSize: 12, color: K.t2, margin: '10px 0' }}>{result.access.note}</p>}
            {(result.warnings ?? []).map(w => <p key={w} style={{ fontSize: 12, color: K.amber, margin: '6px 0' }}>⚠ {w}</p>)}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18, flexWrap: 'wrap' }}>
              <button onClick={onClose} style={{ fontSize: 14, color: K.t2, background: 'none', border: `1px solid ${K.border}`, padding: '10px 18px', borderRadius: 9, cursor: 'pointer' }}>Cerrar</button>
              <button onClick={() => onViewClient?.(result.organization.id)} style={{ fontFamily: K.title, fontWeight: 700, fontSize: 14, color: '#fff', background: K.accent, border: 'none', padding: '10px 18px', borderRadius: 9, cursor: 'pointer' }}>Ver cliente</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <Section>Organización</Section>
            <Input label="Nombre de organización *" value={form.name} onChange={set('name')} error={fields.name} />
            <Input label="Contacto principal / owner *" value={form.ownerName} onChange={set('ownerName')} error={fields.owner_name} />
            <Input label="Email owner *" type="email" value={form.ownerEmail} onChange={set('ownerEmail')} error={fields.owner_email} />
            <Input label="Dominio principal *" placeholder="empresa.com" value={form.domain} onChange={set('domain')} error={fields.primary_domain} mono />

            <Section>Servicio</Section>
            <ServicePeriodFields form={form} setForm={setForm} fields={fields} disabled={submitting} />
            <p style={{ fontSize: 12, color: K.t3, lineHeight: 1.6, margin: '10px 0 16px' }}>
              Se crea el usuario owner con contraseña temporal, la organización y el dominio principal. El owner recibe el email de bienvenida y otro para confirmar el dominio; el monitoreo empieza cuando lo confirma.
            </p>

            {error && <p role="alert" style={{ color: K.red, fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" onClick={onClose} disabled={submitting} style={{ fontSize: 14, color: K.t2, background: 'none', border: `1px solid ${K.border}`, padding: '10px 18px', borderRadius: 9, cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" disabled={!complete || submitting}
                style={{ fontFamily: K.title, fontWeight: 700, fontSize: 14, color: '#fff', background: K.accent, border: 'none', padding: '10px 18px', borderRadius: 9, cursor: complete && !submitting ? 'pointer' : 'not-allowed', opacity: complete && !submitting ? 1 : .45 }}>
                {submitting ? 'Creando…' : 'Crear cliente'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Section({ children }) {
  return <div style={{ fontFamily: K.mono, fontSize: 10, color: K.t3, letterSpacing: '.1em', textTransform: 'uppercase', margin: '6px 0 10px' }}>{children}</div>
}
function Input({ label, error, mono, ...props }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, color: K.t2, marginBottom: 6 }}>{label}</span>
      <input {...props} style={{ width: '100%', boxSizing: 'border-box', height: 42, background: K.input, border: `1px solid ${error ? K.red : K.border}`, borderRadius: 10, padding: '0 12px', color: K.t1, fontSize: 14, fontFamily: mono ? K.mono : K.body }} />
      {error && <span style={{ display: 'block', color: K.red, fontSize: 12, marginTop: 4 }}>{error}</span>}
    </label>
  )
}
function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: `1px solid ${K.border}`, fontSize: 13 }}>
      <span style={{ color: K.t3, minWidth: 140 }}>{label}</span>
      <span style={{ color: K.t1, fontFamily: mono ? K.mono : K.body, wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}
