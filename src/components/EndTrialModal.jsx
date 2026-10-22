import { useEffect, useState } from 'react'
import { fetchTrialPreview, endTrial, fmtDay } from '../lib/trialClosure'

const K = {
  overlay: 'rgba(8,11,18,.85)', card: '#0d1526', border: 'rgba(130,150,220,.14)', borderHi: 'rgba(130,150,220,.22)', soft: 'rgba(130,150,220,.04)',
  input: '#101623', t1: '#e8ecf5', t2: '#9aa6c2', t3: '#7f8aa6', accent: '#5b6ef5', amber: '#f5b544', red: '#f2637e', green: '#5fe39c',
  title: "'Space Grotesk',sans-serif", body: "'Manrope',sans-serif", mono: "'JetBrains Mono',monospace",
}
const SEV = [['critical', 'Críticos', K.red], ['high', 'Altos', '#fb923c'], ['medium', 'Medios', K.amber], ['low', 'Bajos', K.t2]]

/**
 * "Finalizar prueba": muestra lo que se va a guardar y enviar (preview del Worker,
 * sin persistir) y recién con el preview OK + el nombre escrito permite cerrar.
 */
export default function EndTrialModal({ org, scannerUrl, getToken, onClose, onDone }) {
  const [preview, setPreview] = useState({ loading: true })
  const [sendToCustomer, setSendToCustomer] = useState(true)
  const [message, setMessage] = useState('')
  const [confirmName, setConfirmName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const r = await fetchTrialPreview(scannerUrl, await getToken(), org.id)
      if (!cancelled) setPreview({ loading: false, ...r })
    })()
    return () => { cancelled = true }
  }, [scannerUrl, getToken, org.id])

  const p = preview.ok ? preview.data : null
  const snap = p?.snapshot
  const noRecipients = p && p.recipients.length === 0
  const willSend = sendToCustomer && !noRecipients
  const canSubmit = !!p && confirmName === org.name && !submitting

  async function submit() {
    setSubmitting(true)
    setError('')
    const r = await endTrial(scannerUrl, await getToken(), org.id, { confirmName, sendToCustomer: willSend, customerMessage: message.trim() })
    setSubmitting(false)
    if (r.ok) setResult(r.data)
    else setError(r.error)
  }

  const close = () => { if (!submitting) (result ? onDone : onClose)() }

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 210, background: K.overlay, backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Finalizar período de prueba" onClick={e => e.stopPropagation()}
        style={{ background: K.card, border: `1px solid ${K.borderHi}`, borderTop: `2px solid ${K.amber}`, borderRadius: 18, padding: '28px 30px', maxWidth: 620, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box', fontFamily: K.body }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
          <h2 style={{ fontFamily: K.title, fontSize: 19, color: K.t1, margin: 0 }}>Finalizar período de prueba</h2>
          <button aria-label="Cerrar" onClick={close} disabled={submitting} style={{ background: 'none', border: 'none', color: K.t3, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {result ? <Result result={result} onDone={onDone} /> : (<>
          <p style={{ fontSize: 13, color: K.t2, lineHeight: 1.6, margin: '0 0 18px' }}>
            Se generará el informe final del período, se enviará al cliente y a FENIKSO, se pausará el monitoreo y el acceso de la organización quedará desactivado.
            {' '}<strong style={{ color: K.t1 }}>Todos los datos e históricos se conservarán.</strong>
          </p>

          {preview.loading && <p style={{ color: K.t2, fontSize: 13 }}>Generando el informe del período…</p>}
          {!preview.loading && !preview.ok && <p role="alert" style={{ color: K.red, fontSize: 13 }}>{preview.error}</p>}

          {snap && (<>
            {p.existing && (
              <p style={{ fontSize: 12, color: K.amber, margin: '0 0 12px' }}>Ya existe un informe generado para esta prueba: se reutilizará (no se genera ni se envía dos veces).</p>
            )}
            <Grid>
              <Field label="Organización" value={org.name} />
              <Field label="Inicio del trial" value={fmtDay(snap.period.trial_started_at)} />
              <Field label="Cierre" value={p.existing ? fmtDay(snap.period.trial_ended_at) : `${fmtDay(new Date().toISOString())} (al confirmar)`} />
            </Grid>
            <Field label={`Dominios monitoreados · ${snap.domains_count}`} value={snap.domains.map(d => d.domain).join(', ') || '—'} mono />

            <div style={{ border: `1px solid ${K.border}`, background: K.soft, borderRadius: 10, padding: '12px 14px', margin: '14px 0' }}>
              <div style={{ fontFamily: K.mono, fontSize: 10, color: K.t3, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>Resumen del informe</div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: K.t2 }}>
                <span><strong style={{ color: K.t1 }}>{snap.findings.total}</strong> hallazgos</span>
                {SEV.map(([k, label, color]) => <span key={k}><strong style={{ color }}>{snap.findings.by_severity[k]}</strong> {label.toLowerCase()}</span>)}
                <span><strong style={{ color: K.t1 }}>{snap.findings.open}</strong> abiertos al cierre</span>
                <span><strong style={{ color: K.t1 }}>{snap.credentials.exposed}</strong> credenciales expuestas</span>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: K.t1, cursor: noRecipients ? 'not-allowed' : 'pointer' }}>
                <input type="checkbox" checked={willSend} disabled={noRecipients || p.existing} onChange={e => setSendToCustomer(e.target.checked)} />
                Enviar informe final al cliente
              </label>
              <div style={{ fontSize: 12, color: K.t3, margin: '6px 0 0 24px', lineHeight: 1.6 }}>
                {noRecipients
                  ? <span style={{ color: K.amber }}>La organización no tiene un email de contacto válido: no se enviará al cliente.</span>
                  : <>Cliente: <span data-testid="customer-recipients" style={{ color: willSend ? K.t1 : K.t3, fontFamily: K.mono }}>{p.recipients.join(', ')}</span>{!willSend && ' (no se enviará)'}<br /></>}
                Copia interna: <span data-testid="internal-recipients" style={{ color: K.t1, fontFamily: K.mono }}>{p.internal_recipients.join(', ')}</span>
              </div>
            </div>

            {!p.existing && (
              <div style={{ marginBottom: 14 }}>
                <Label>Mensaje para el cliente (opcional)</Label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} rows={3} disabled={!willSend}
                  style={{ width: '100%', boxSizing: 'border-box', background: K.input, border: `1px solid ${K.border}`, borderRadius: 10, padding: '10px 12px', color: K.t1, fontSize: 13, fontFamily: K.body, resize: 'vertical' }} />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <Label>Escribí el nombre de la organización para confirmar</Label>
              <input value={confirmName} onChange={e => setConfirmName(e.target.value)} placeholder={org.name}
                style={{ width: '100%', boxSizing: 'border-box', height: 42, background: K.input, border: `1px solid ${K.border}`, borderRadius: 10, padding: '0 12px', color: K.t1, fontSize: 14, fontFamily: K.body }} />
            </div>
          </>)}

          {error && <p role="alert" style={{ color: K.red, fontSize: 13, margin: '0 0 12px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button onClick={onClose} disabled={submitting} style={{ fontSize: 14, color: K.t2, background: 'none', border: `1px solid ${K.border}`, padding: '10px 18px', borderRadius: 9, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={submit} disabled={!canSubmit}
              style={{ fontFamily: K.title, fontWeight: 700, fontSize: 14, color: '#fff', background: 'linear-gradient(135deg,#d68a1f,#b8700f)', border: 'none', padding: '10px 18px', borderRadius: 9, cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : .45 }}>
              {submitting ? 'Finalizando…' : willSend ? 'Finalizar prueba y enviar informe' : 'Finalizar prueba'}
            </button>
          </div>
        </>)}
      </div>
    </div>
  )
}

function Result({ result, onDone }) {
  const sent = result.email?.status === 'sent'
  const skipped = result.email?.status === 'skipped'
  return (
    <div role="status">
      <p style={{ fontSize: 14, color: K.green, margin: '0 0 10px' }}>✓ Prueba finalizada. El monitoreo quedó pausado y el acceso de la organización desactivado.</p>
      <p style={{ fontSize: 13, color: sent ? K.t2 : skipped ? K.t2 : K.amber, margin: '0 0 10px' }}>
        {sent && <>Informe enviado a <span style={{ fontFamily: K.mono, color: K.t1 }}>{result.email.recipients.join(', ')}</span>.</>}
        {skipped && 'No se envió informe al cliente (opción desmarcada).'}
        {!sent && !skipped && '⚠ El informe NO se pudo enviar al cliente. Quedó guardado: podés reenviarlo desde el listado.'}
      </p>
      {(result.warnings ?? []).map(w => <p key={w} style={{ fontSize: 12, color: K.amber, margin: '0 0 6px' }}>⚠ {w}</p>)}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onDone} style={{ fontFamily: K.title, fontWeight: 700, fontSize: 14, color: '#fff', background: K.accent, border: 'none', padding: '10px 20px', borderRadius: 9, cursor: 'pointer' }}>Listo</button>
      </div>
    </div>
  )
}

function Grid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '8px 16px', marginBottom: 10 }}>{children}</div>
}
function Label({ children }) {
  return <div style={{ fontFamily: K.mono, fontSize: 10, color: K.t3, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>{children}</div>
}
function Field({ label, value, mono }) {
  return (
    <div style={{ minWidth: 0, marginBottom: 6 }}>
      <Label>{label}</Label>
      <div style={{ fontSize: 13, color: K.t1, fontFamily: mono ? K.mono : K.body, wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}
