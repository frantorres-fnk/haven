import { useRef, useState } from 'react'
import { getOrganizationDomainLimit, validateDomainLimit, updateCapacity, MAX_DOMAIN_LIMIT } from '../lib/capacity'

const K = {
  overlay: 'rgba(8,11,18,.85)', card: '#0d1526', border: 'rgba(130,150,220,.14)', borderHi: 'rgba(130,150,220,.22)',
  input: '#101623', t1: '#e8ecf5', t2: '#9aa6c2', t3: '#7f8aa6', accent: '#5b6ef5', red: '#f2637e', green: '#5fe39c',
  title: "'Space Grotesk',sans-serif", body: "'Manrope',sans-serif", mono: "'JetBrains Mono',monospace",
}

/**
 * "Capacidad" de una organización (solo FENIKSO Admin): cuántos dominios puede
 * monitorear. No permite bajar por debajo de los dominios existentes.
 */
export default function CapacityModal({ org, domainCount, scannerUrl, getToken, onClose, onSaved, onMfaRequired, update = updateCapacity }) {
  const current = getOrganizationDomainLimit(org)
  const [value, setValue] = useState(String(current || ''))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)
  const inFlight = useRef(false)

  async function save(e) {
    e.preventDefault()
    if (inFlight.current) return
    const problem = validateDomainLimit(value, domainCount)
    if (problem) { setError(problem); return }
    inFlight.current = true
    setSaving(true); setError('')
    const r = await update(scannerUrl, await getToken(), org.id, Number(value.trim()))
    inFlight.current = false
    setSaving(false)
    if (r.ok) { setDone(r.data); onSaved?.(r.data) }
    else if (r.reason === 'mfa_required') onMfaRequired?.()
    else setError(r.error)
  }

  const close = () => { if (!saving) onClose() }

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 210, background: K.overlay, backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Capacidad de dominios" onClick={e => e.stopPropagation()}
        style={{ background: K.card, border: `1px solid ${K.borderHi}`, borderRadius: 18, padding: '26px 28px', maxWidth: 440, width: '100%', boxSizing: 'border-box', fontFamily: K.body }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
          <h2 style={{ fontFamily: K.title, fontSize: 19, color: K.t1, margin: 0 }}>Capacidad de dominios</h2>
          <button aria-label="Cerrar" onClick={close} disabled={saving} style={{ background: 'none', border: 'none', color: K.t3, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: K.t2, margin: '0 0 16px' }}>{org.name}</p>

        {done ? (
          <div role="status">
            <p style={{ fontSize: 14, color: K.green, margin: '0 0 12px' }}>
              Capacidad actualizada: {done.domain_count} / {done.domain_limit} dominios.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={onClose} style={{ fontFamily: K.title, fontWeight: 700, fontSize: 14, color: '#fff', background: K.accent, border: 'none', padding: '10px 18px', borderRadius: 9, cursor: 'pointer' }}>Cerrar</button>
            </div>
          </div>
        ) : (
          <form onSubmit={save} noValidate>
            <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: `1px solid ${K.border}`, fontSize: 13.5 }}>
              <span style={{ color: K.t3, minWidth: 110 }}>Límite actual</span>
              <span data-testid="capacity-current" style={{ color: K.t1, fontFamily: K.mono }}>{current}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: `1px solid ${K.border}`, fontSize: 13.5, marginBottom: 14 }}>
              <span style={{ color: K.t3, minWidth: 110 }}>Dominios</span>
              <span style={{ color: K.t1, fontFamily: K.mono }}>{domainCount}</span>
            </div>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, color: K.t2, marginBottom: 6 }}>Nuevo límite</span>
              <input type="number" inputMode="numeric" min={Math.max(1, domainCount)} max={MAX_DOMAIN_LIMIT} step={1} value={value} disabled={saving}
                onChange={e => { setValue(e.target.value); setError('') }}
                style={{ width: '100%', boxSizing: 'border-box', height: 40, background: K.input, border: `1px solid ${error ? K.red : K.border}`, borderRadius: 10, padding: '0 12px', color: K.t1, fontSize: 15, fontFamily: K.mono, colorScheme: 'dark' }} />
            </label>
            <p style={{ fontSize: 12, color: K.t3, margin: '8px 0 0' }}>Cantidad máxima de dominios que esta organización puede monitorear.</p>
            {error && <p role="alert" style={{ color: K.red, fontSize: 13, margin: '12px 0 0' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18, flexWrap: 'wrap' }}>
              <button type="button" onClick={close} disabled={saving}
                style={{ fontSize: 14, color: K.t2, background: 'none', border: `1px solid ${K.border}`, padding: '10px 18px', borderRadius: 9, cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" disabled={saving}
                style={{ fontFamily: K.title, fontWeight: 700, fontSize: 14, color: '#fff', background: K.accent, border: 'none', padding: '10px 18px', borderRadius: 9, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .55 : 1 }}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
