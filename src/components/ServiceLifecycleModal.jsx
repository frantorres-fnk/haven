import { useRef, useState } from 'react'
import {
  SERVICE_TYPES, TRIAL_PRESETS, ENDED_STATUSES, EDITABLE_STATUSES, serviceSummary, formFromOrg,
  validateServiceForm, updateService, trialEnd, periodDays, fmtDay, isValidDate,
} from '../lib/serviceLifecycle'

const K = {
  overlay: 'rgba(8,11,18,.85)', card: '#0d1526', border: 'rgba(130,150,220,.14)', borderHi: 'rgba(130,150,220,.22)', soft: 'rgba(130,150,220,.04)',
  input: '#101623', t1: '#e8ecf5', t2: '#9aa6c2', t3: '#7f8aa6', accent: '#5b6ef5', amber: '#f5b544', red: '#f2637e', green: '#5fe39c',
  title: "'Space Grotesk',sans-serif", body: "'Manrope',sans-serif", mono: "'JetBrains Mono',monospace",
}

/** Tipo de servicio + fechas. Lo usan "Acceso y vigencia" y "+ Crear cliente". */
export function ServicePeriodFields({ form, setForm, fields = {}, disabled = false }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const days = periodDays(form.service_starts_at, form.service_ends_at)
  const preset = (n) => setForm(f => ({ ...f, service_ends_at: isValidDate(f.service_starts_at) ? trialEnd(f.service_starts_at, n) : f.service_ends_at }))
  return (
    <div>
      <div role="radiogroup" aria-label="Tipo de servicio" style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {SERVICE_TYPES.map(t => (
          <label key={t.value} style={{ flex: '1 1 140px', display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, cursor: disabled ? 'default' : 'pointer',
            border: `1px solid ${form.service_type === t.value ? K.accent : K.border}`, background: form.service_type === t.value ? 'rgba(91,110,245,.1)' : K.soft }}>
            <input type="radio" name="service_type" value={t.value} checked={form.service_type === t.value} disabled={disabled}
              onChange={() => set('service_type', t.value)} style={{ marginTop: 2, accentColor: K.accent }} />
            <span><span style={{ display: 'block', fontSize: 14, color: K.t1, fontWeight: 600 }}>{t.label}</span><span style={{ fontSize: 11.5, color: K.t3 }}>{t.hint}</span></span>
          </label>
        ))}
      </div>
      {fields.service_type && <p style={{ color: K.red, fontSize: 12, margin: '0 0 8px' }}>{fields.service_type}</p>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <DateInput label="Fecha de inicio" value={form.service_starts_at} onChange={v => set('service_starts_at', v)} error={fields.service_starts_at} disabled={disabled} />
        {form.service_type !== 'manual' && (
          <DateInput label="Fecha de finalización (último día)" value={form.service_ends_at} min={form.service_starts_at || undefined}
            onChange={v => set('service_ends_at', v)} error={fields.service_ends_at} disabled={disabled} />
        )}
      </div>
      {form.service_type === 'trial' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', margin: '2px 0 6px' }}>
          <span style={{ fontSize: 12, color: K.t3 }}>Duración:</span>
          {TRIAL_PRESETS.map(n => (
            <button key={n} type="button" disabled={disabled || !isValidDate(form.service_starts_at)} onClick={() => preset(n)}
              style={{ fontSize: 12, color: days === n ? '#fff' : K.t2, background: days === n ? K.accent : K.soft, border: `1px solid ${days === n ? K.accent : K.border}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
              {n} días
            </button>
          ))}
          <span style={{ fontSize: 12, color: K.t3 }}>o elegí la fecha de fin</span>
        </div>
      )}
      {form.service_type !== 'manual' && days > 0 && (
        <p data-testid="service-period-summary" style={{ fontSize: 12, color: K.t2, margin: '4px 0 0' }}>
          Vigencia: {fmtDay(form.service_starts_at)} → {fmtDay(form.service_ends_at)} · {days === 1 ? '1 día' : `${days} días`}. Operativo durante todo el {fmtDay(form.service_ends_at)} (hora Argentina); el monitoreo se pausa al terminar ese día.
        </p>
      )}
      {form.service_type === 'manual' && <p style={{ fontSize: 12, color: K.t3, margin: '4px 0 0' }}>No vence automáticamente.</p>}
    </div>
  )
}

function DateInput({ label, error, onChange, ...props }) {
  return (
    <label style={{ display: 'block', marginBottom: 10, flex: '1 1 180px' }}>
      <span style={{ display: 'block', fontSize: 12, color: K.t2, marginBottom: 6 }}>{label}</span>
      <input type="date" {...props} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', height: 40, background: K.input, border: `1px solid ${error ? K.red : K.border}`, borderRadius: 10, padding: '0 10px', color: K.t1, fontSize: 14, fontFamily: K.body, colorScheme: 'dark' }} />
      {error && <span style={{ display: 'block', color: K.red, fontSize: 12, marginTop: 4 }}>{error}</span>}
    </label>
  )
}

/**
 * "Acceso y vigencia" de una organización (solo FENIKSO Admin). Muestra tipo,
 * vigencia y estado; edita y, si la org está finalizada, permite reactivarla.
 */
export default function ServiceLifecycleModal({ org, scannerUrl, getToken, onClose, onSaved, onMfaRequired, update = updateService }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => formFromOrg(org))
  const [fields, setFields] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)
  const inFlight = useRef(false)

  const s = serviceSummary(org)
  const ended = ENDED_STATUSES.includes(org.status)
  const editable = EDITABLE_STATUSES.includes(org.status)
  const toneColor = s.tone === 'ended' ? K.t2 : s.tone === 'warn' ? K.amber : K.green

  async function save(e) {
    e.preventDefault()
    if (inFlight.current) return
    const local = validateServiceForm(form, { mustBeCurrent: !ended || form.reactivate })
    setFields(local)
    if (Object.keys(local).length) { setError('Revisá los datos marcados.'); return }
    inFlight.current = true
    setSaving(true); setError('')
    const r = await update(scannerUrl, await getToken(), org.id, form)
    inFlight.current = false
    setSaving(false)
    if (r.ok) { setDone(r.data); onSaved?.(r.data) }
    else {
      if (r.reason === 'mfa_required') { onMfaRequired?.(); return }
      setError(r.error); setFields(r.fields ?? {})
    }
  }

  const close = () => { if (!saving) onClose() }

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 210, background: K.overlay, backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Acceso y vigencia" onClick={e => e.stopPropagation()}
        style={{ background: K.card, border: `1px solid ${K.borderHi}`, borderRadius: 18, padding: '26px 28px', maxWidth: 560, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box', fontFamily: K.body }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
          <h2 style={{ fontFamily: K.title, fontSize: 19, color: K.t1, margin: 0 }}>Acceso y vigencia</h2>
          <button aria-label="Cerrar" onClick={close} disabled={saving} style={{ background: 'none', border: 'none', color: K.t3, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: K.t2, margin: '0 0 16px' }}>{org.name}</p>

        {done ? (
          <div role="status">
            <p style={{ fontSize: 14, color: K.green, margin: '0 0 12px' }}>{done.reactivated ? 'Organización reactivada. El monitoreo de los dominios verificados se reanuda.' : 'Vigencia actualizada.'}</p>
            {(done.warnings ?? []).map(w => <p key={w} style={{ fontSize: 12, color: K.amber, margin: '6px 0' }}>⚠ {w}</p>)}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={onClose} style={{ fontFamily: K.title, fontWeight: 700, fontSize: 14, color: '#fff', background: K.accent, border: 'none', padding: '10px 18px', borderRadius: 9, cursor: 'pointer' }}>Cerrar</button>
            </div>
          </div>
        ) : !editing ? (
          <div>
            <Row label="Tipo" value={s.type} />
            <Row label="Vigencia" value={s.range} mono />
            <Row label="Estado" value={<span style={{ color: toneColor }}>{s.status}{s.note ? ` · ${s.note}` : ''}</span>} />
            {!editable && <p style={{ fontSize: 12, color: K.t3, margin: '12px 0 0' }}>La vigencia de una organización cancelada o con pago vencido no se edita desde acá.</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18, flexWrap: 'wrap' }}>
              <button onClick={onClose} style={{ fontSize: 14, color: K.t2, background: 'none', border: `1px solid ${K.border}`, padding: '10px 18px', borderRadius: 9, cursor: 'pointer' }}>Cerrar</button>
              {editable && (
                <button onClick={() => { setEditing(true); setForm(f => ({ ...f, reactivate: ended })) }}
                  style={{ fontFamily: K.title, fontWeight: 700, fontSize: 14, color: '#fff', background: K.accent, border: 'none', padding: '10px 18px', borderRadius: 9, cursor: 'pointer' }}>
                  {ended ? 'Renovar / reactivar' : 'Editar vigencia'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={save} noValidate>
            <ServicePeriodFields form={form} setForm={setForm} fields={fields} disabled={saving} />
            {ended && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: K.t1, margin: '14px 0 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.reactivate} disabled={saving} onChange={e => setForm(f => ({ ...f, reactivate: e.target.checked }))} style={{ marginTop: 2, accentColor: K.accent }} />
                <span>Reactivar la organización<br /><span style={{ fontSize: 12, color: K.t3 }}>Vuelve el acceso y el monitoreo de los dominios verificados. Se conservan dominios, hallazgos, credenciales, usuarios e informes.</span></span>
              </label>
            )}
            {error && <p role="alert" style={{ color: K.red, fontSize: 13, margin: '14px 0 0' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => { setEditing(false); setForm(formFromOrg(org)); setFields({}); setError('') }} disabled={saving}
                style={{ fontSize: 14, color: K.t2, background: 'none', border: `1px solid ${K.border}`, padding: '10px 18px', borderRadius: 9, cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" disabled={saving}
                style={{ fontFamily: K.title, fontWeight: 700, fontSize: 14, color: '#fff', background: K.accent, border: 'none', padding: '10px 18px', borderRadius: 9, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .55 : 1 }}>
                {saving ? 'Guardando…' : ended && form.reactivate ? 'Guardar y reactivar' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: `1px solid ${K.border}`, fontSize: 13.5 }}>
      <span style={{ color: K.t3, minWidth: 110 }}>{label}</span>
      <span style={{ color: K.t1, fontFamily: mono ? K.mono : K.body }}>{value}</span>
    </div>
  )
}
