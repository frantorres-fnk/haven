import { useEffect, useState } from 'react'
import {
  fetchCredentialExposures, formatExposureDate, SOURCE_TYPE_LABEL, SEVERITY_LABEL, REMEDIATION_LABEL,
} from '../lib/credentials'

const K = {
  overlay: 'rgba(4,7,15,.72)', card: '#0C1220', border: '#1A2240', t1: '#EDF1F8', t2: '#93A1BC', t3: '#5F6B85',
  red: '#FB6B6B', amber: '#F5B544', green: '#34D399', mono: "'JetBrains Mono',monospace", title: "'Space Grotesk',sans-serif",
}
const SEV_COLOR = { critical: K.red, high: '#FB923C', medium: K.amber, low: K.t2 }

// Detalle de credenciales expuestas (tarjeta Credenciales). Nunca muestra la
// contraseña: solo si estuvo expuesta. Sin acción de revelado en el piloto.
export default function CredentialsPanel({ domainId, domainName, summaryText, onClose }) {
  const [state, setState] = useState({ loading: true, ok: true, rows: [] })

  useEffect(() => {
    let cancelled = false
    fetchCredentialExposures(domainId).then(r => { if (!cancelled) setState({ loading: false, ...r }) })
    return () => { cancelled = true }
  }, [domainId])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: K.overlay, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-label="Credenciales expuestas" onClick={e => e.stopPropagation()}
        style={{ background: K.card, border: `1px solid ${K.border}`, borderRadius: 16, width: '100%', maxWidth: 860, maxHeight: '88vh', overflowY: 'auto', padding: '24px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <div>
            <h2 style={{ fontFamily: K.title, fontSize: 19, color: K.t1, margin: 0 }}>Credenciales expuestas</h2>
            <p style={{ fontFamily: K.mono, fontSize: 12, color: K.t3, margin: '4px 0 0' }}>{domainName}{summaryText ? ` · ${summaryText}` : ''}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: K.t3, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: K.t2, margin: '10px 0 18px', lineHeight: 1.6 }}>
          Credencial completa disponible bajo solicitud autorizada de respuesta a incidente.
        </p>

        {state.loading && <p style={{ color: K.t2, fontSize: 13 }}>Cargando…</p>}
        {!state.loading && !state.ok && <p style={{ color: K.red, fontSize: 13 }}>No pudimos cargar el detalle. Intentá nuevamente.</p>}
        {!state.loading && state.ok && state.rows.length === 0 && (
          <p style={{ color: K.t2, fontSize: 13 }}>No hay credenciales expuestas registradas para este dominio.</p>
        )}

        {state.rows.map(r => (
          <div key={r.id} style={{ border: `1px solid ${K.border}`, borderLeft: `3px solid ${SEV_COLOR[r.severity] ?? K.t3}`, borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontFamily: K.mono, fontSize: 13, color: K.t1, wordBreak: 'break-all' }}>{r.identity}</span>
              <span style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: K.mono }}>
                <span style={{ color: SEV_COLOR[r.severity] ?? K.t2 }}>{SEVERITY_LABEL[r.severity] ?? r.severity}</span>
                <span style={{ color: r.remediation_status === 'remediated' ? K.green : K.t2 }}>· {REMEDIATION_LABEL[r.remediation_status] ?? r.remediation_status}</span>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '6px 16px', fontSize: 12, color: K.t2 }}>
              <Field label="Tipo" value={SOURCE_TYPE_LABEL[r.source_type] ?? 'Filtración'} />
              <Field label="Fuente" value={r.source_name || '—'} />
              <Field label="Fecha" value={formatExposureDate(r)} />
              {r.origin && <Field label="Origen" value={r.origin} />}
              <Field label="Contraseña" value={r.password_exposed ? '••••••••  Contraseña expuesta: Sí' : 'Contraseña expuesta: No'} strong={r.password_exposed} />
              <Field label="Detectada" value={r.first_seen_at ? new Date(r.first_seen_at).toLocaleDateString('es-AR') : '—'} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Field({ label, value, strong }) {
  return (
    <div style={{ minWidth: 0 }}>
      <span style={{ color: K.t3 }}>{label}: </span>
      <span style={{ color: strong ? K.t1 : K.t2, wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}
