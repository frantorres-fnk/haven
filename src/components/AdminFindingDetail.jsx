import { useEffect, useState } from 'react'
import { fetchFindingDetail } from '../lib/adminFindings'
import { formatExposureDate, SOURCE_TYPE_LABEL, SEVERITY_LABEL, REMEDIATION_LABEL } from '../lib/credentials'

const K = {
  overlay: 'rgba(4,7,15,.78)', card: '#0d1322', border: 'rgba(130,150,220,.14)', soft: 'rgba(130,150,220,.04)',
  t1: '#e8ecf5', t2: '#9aa6c2', t3: '#7f8aa6', link: '#8aa0ff', red: '#f2637e', amber: '#f5b544', green: '#3ddc84',
  title: "'Space Grotesk',sans-serif", body: "'Manrope',sans-serif", mono: "'JetBrains Mono',monospace",
}
const SEV_COLOR = { critical: K.red, high: '#fb923c', medium: K.amber, low: K.t2 }
const OPERATIONAL_LABEL = { new: 'Nueva', active: 'Activa', not_seen: 'No vista en la última corrida' }
const DETECTION_LABEL = { baseline: 'Baseline (análisis inicial)', new: 'Nueva detección' }

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—')

// Detalle técnico read-only de un finding para el portal /admin. Sin acciones:
// no resuelve, no cambia remediation_status, no actúa en nombre del cliente.
export default function AdminFindingDetail({ scannerUrl, getToken, findingId, onClose }) {
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getToken()
      const r = await fetchFindingDetail(scannerUrl, token, findingId)
      if (!cancelled) setState({ loading: false, ...r })
    })()
    return () => { cancelled = true }
  }, [scannerUrl, getToken, findingId])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const d = state.ok ? state.data : null
  const f = d?.finding

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: K.overlay, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Detalle del hallazgo" onClick={e => e.stopPropagation()}
        style={{ background: K.card, border: `1px solid ${K.border}`, borderRadius: 16, width: '100%', maxWidth: 920, maxHeight: '90vh', overflowY: 'auto', padding: '22px 22px 26px', boxSizing: 'border-box', fontFamily: K.body }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              <h2 style={{ fontFamily: K.title, fontSize: 18, color: K.t1, margin: 0 }}>Detalle del hallazgo</h2>
              <Chip color={K.t3}>Solo lectura</Chip>
            </div>
            {d && (
              <p style={{ fontFamily: K.mono, fontSize: 12, color: K.t2, margin: 0, wordBreak: 'break-all' }}>
                {d.organization?.name ?? '—'} · {d.domain?.domain ?? '—'}
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: `1px solid ${K.border}`, borderRadius: 8, color: K.t2, fontSize: 18, lineHeight: 1, padding: '4px 10px', cursor: 'pointer' }}>×</button>
        </div>

        {state.loading && <p style={{ color: K.t2, fontSize: 13 }}>Cargando detalle…</p>}
        {!state.loading && !state.ok && <p role="alert" style={{ color: K.red, fontSize: 13 }}>{state.error}</p>}

        {f && (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              <Chip color={SEV_COLOR[f.severity] ?? K.t2} strong>{SEVERITY_LABEL[f.severity] ?? f.severity ?? '—'}</Chip>
              <Chip color={K.link}>{f.category ?? '—'}</Chip>
              <Chip color={K.t2}>{f.check_id}</Chip>
              <Chip color={f.status === 'resolved' ? K.green : K.amber}>{f.status === 'resolved' ? 'Resuelto' : 'Abierto'}</Chip>
              {f.jira_key && <Chip color="#579dff">{f.jira_key}</Chip>}
            </div>

            <Section title="Vista ejecutiva">
              <Field label="Título" value={f.title_plain} />
              <Field label="Descripción" value={f.description_plain} />
              <Field label="Acción recomendada" value={f.action_plain} />
            </Section>

            <Section title="Vista técnica">
              <Field label="Título técnico" value={f.title_tech} mono />
              <Field label="Descripción técnica" value={f.description_tech} />
              <Field label="Acción técnica" value={f.action_tech} />
            </Section>

            <Section title="Contexto">
              <Grid>
                <Field label="Organización" value={d.organization?.name} />
                <Field label="Dominio" value={d.domain?.domain} mono />
                <Field label="Primera detección" value={fmtDate(f.first_seen_at)} />
                <Field label="Última detección" value={fmtDate(f.last_seen_at)} />
                <Field label="Referencia" value={f.reference} />
                <Field label="Fuente" value={f.source} />
                {f.jira_key && <Field label="Jira" value={f.jira_key} mono />}
              </Grid>
            </Section>

            <CheckDetail detail={d.check_detail} />

            {d.evidence != null && (
              <Section title="Evidencia persistida">
                <pre style={{ margin: 0, fontFamily: K.mono, fontSize: 11, color: K.t2, background: 'rgba(0,0,0,.25)', border: `1px solid ${K.border}`, borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {typeof d.evidence === 'string' ? d.evidence : JSON.stringify(d.evidence, null, 2)}
                </pre>
              </Section>
            )}
            {d.evidence == null && !d.check_detail && (
              <p style={{ fontSize: 12, color: K.t3, margin: '4px 0 0' }}>HAVEN no tiene evidencia técnica adicional persistida para este hallazgo.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CheckDetail({ detail }) {
  if (!detail) return null
  if (detail.kind === 'credential_exposure') return <CredentialDetail detail={detail} />
  if (detail.kind === 'subdomains') {
    return (
      <Section title="Subdominios">
        <Grid>
          <Field label="Detectados" value={String(detail.count)} />
          <Field label="Fuentes" value={detail.sources.length ? detail.sources.join(', ') : null} />
          <Field label="Contexto" value={detail.context} />
        </Grid>
        <HostList label="Sensibles" items={detail.sensitive} color={K.red} />
        <HostList label="Activos" items={detail.active} />
      </Section>
    )
  }
  if (detail.kind === 'typosquatting') {
    return (
      <Section title="Typosquatting">
        <Grid>
          <Field label="Variantes evaluadas" value={detail.checked != null ? String(detail.checked) : null} />
          <Field label="Registrados" value={String(detail.registered.length)} />
        </Grid>
        <HostList label="Dominios similares registrados" items={detail.registered} color={K.amber} />
        {detail.typos.length > 0 && <HostList label="Errores de tipeo" items={detail.typos} />}
        {detail.lookalikes.length > 0 && <HostList label="Lookalikes" items={detail.lookalikes} />}
      </Section>
    )
  }
  if (detail.kind === 'ipreputation') {
    return (
      <Section title="Reputación de IP">
        <Grid>
          <Field label="IP evaluada" value={detail.ip} mono />
          <Field label="Puntaje de abuso" value={detail.score != null ? `${detail.score}/100` : null} />
          <Field label="Reportes (90 días)" value={detail.reports != null ? String(detail.reports) : null} />
          <Field label="ISP" value={detail.isp} />
          <Field label="Tipo de uso" value={detail.usage_type} />
        </Grid>
      </Section>
    )
  }
  return null
}

function CredentialDetail({ detail }) {
  const s = detail.summary ?? {}
  const fresh = detail.exposures.filter(x => x.detection_kind === 'new')
  const historical = detail.exposures.filter(x => x.detection_kind !== 'new')
  return (
    <Section title={`Credenciales expuestas · ${detail.exposures.length}`}>
      <p style={{ fontSize: 12, color: K.t2, margin: '0 0 10px', lineHeight: 1.6 }}>{detail.notice}</p>
      {Object.keys(s).length > 0 && (
        <Grid>
          <Field label="Pendientes" value={String(s.pending ?? 0)} />
          <Field label="Críticas / Altas" value={`${s.critical ?? 0} / ${s.high ?? 0}`} />
          <Field label="Malware (stealer)" value={String(s.stealer ?? 0)} />
          <Field label="Con contraseña" value={String(s.with_password ?? 0)} />
        </Grid>
      )}
      {detail.exposures.length === 0 && <p style={{ fontSize: 12, color: K.t3 }}>No hay identidades registradas para este dominio.</p>}
      {fresh.length > 0 && <ExposureGroup title="Nuevas detecciones" rows={fresh} />}
      {historical.length > 0 && <ExposureGroup title="Exposiciones históricas (baseline)" rows={historical} />}
      {detail.truncated && <p style={{ fontSize: 11, color: K.t3 }}>Se muestran las primeras {detail.exposures.length} identidades.</p>}
    </Section>
  )
}

function ExposureGroup({ title, rows }) {
  return (
    <div style={{ marginTop: 12 }}>
      <h4 style={{ fontFamily: K.title, fontSize: 13, color: K.t1, margin: '0 0 8px' }}>{title} <span style={{ color: K.t3, fontWeight: 400 }}>· {rows.length}</span></h4>
      {rows.map(r => (
        <div key={r.id} style={{ border: `1px solid ${K.border}`, borderLeft: `3px solid ${SEV_COLOR[r.severity] ?? K.t3}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8, background: K.soft }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontFamily: K.mono, fontSize: 12.5, color: K.t1, wordBreak: 'break-all' }}>{r.identity}</span>
            <span style={{ fontFamily: K.mono, fontSize: 11, color: SEV_COLOR[r.severity] ?? K.t2 }}>{SEVERITY_LABEL[r.severity] ?? r.severity}</span>
          </div>
          <Grid min={160}>
            <Field label="Tipo" value={SOURCE_TYPE_LABEL[r.source_type] ?? 'Filtración'} />
            <Field label="Fuente" value={r.source_name} />
            <Field label="Fecha de exposición" value={formatExposureDate(r)} />
            <Field label="Origen" value={r.origin} mono />
            <Field label="Contraseña expuesta" value={r.password_exposed ? 'Sí  ••••••••' : 'No'} strong={r.password_exposed} />
            <Field label="Detección" value={DETECTION_LABEL[r.detection_kind] ?? r.detection_kind} />
            <Field label="Remediación" value={REMEDIATION_LABEL[r.remediation_status] ?? r.remediation_status} />
            <Field label="Estado operativo" value={OPERATIONAL_LABEL[r.operational_status] ?? r.operational_status} />
            <Field label="Primera vez en HAVEN" value={fmtDate(r.first_seen_at)} />
            <Field label="Última vez" value={fmtDate(r.last_seen_at)} />
            {r.metadata?.unverified && <Field label="Verificación" value="Sin verificar por la fuente" />}
            {r.metadata?.compilation && <Field label="Origen del dato" value="Recopilación (compilation)" />}
          </Grid>
        </div>
      ))}
    </div>
  )
}

function HostList({ label, items, color = K.t2 }) {
  if (!items?.length) return null
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontFamily: K.mono, fontSize: 10, color: K.t3, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{label} · {items.length}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(h => (
          <span key={h} style={{ fontFamily: K.mono, fontSize: 11, color, border: `1px solid ${K.border}`, background: K.soft, borderRadius: 6, padding: '3px 8px', wordBreak: 'break-all' }}>{h}</span>
        ))}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section style={{ borderTop: `1px solid ${K.border}`, padding: '14px 0 4px' }}>
      <h3 style={{ fontFamily: K.mono, fontSize: 10, fontWeight: 600, color: K.t3, textTransform: 'uppercase', letterSpacing: '.1em', margin: '0 0 10px' }}>{title}</h3>
      {children}
    </section>
  )
}

function Grid({ children, min = 200 }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap: '8px 18px', marginBottom: 6 }}>{children}</div>
}

function Field({ label, value, mono, strong }) {
  return (
    <div style={{ minWidth: 0, marginBottom: 6 }}>
      <div style={{ fontSize: 11, color: K.t3, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: strong ? K.t1 : K.t2, fontFamily: mono ? K.mono : K.body, lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{value || '—'}</div>
    </div>
  )
}

function Chip({ color, strong, children }) {
  return (
    <span style={{ fontFamily: K.mono, fontSize: 10, fontWeight: strong ? 700 : 600, color, border: `1px solid ${color}40`, background: `${color}14`, padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}
