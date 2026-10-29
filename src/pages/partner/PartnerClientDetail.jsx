import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { partnerApi, failure, can, STATUS_LABEL, SERVICE_LABEL, vigenciaText, fmtDate, SERVICE_REQUEST_LABEL } from '../../lib/partner'
import { Card, Button, Pill, Empty, Modal, Field, Notice, PartnerMark } from './ui'
import { K, inputStyle, th, td, SEV, SEV_LABEL } from './tokens'

const MAX_DOMAIN_LIMIT = 1000

/**
 * Vista Partner de UN cliente. NO es impersonación: el Partner sigue con su propia
 * sesión y todo sale de /partner/organizations/:id/* (verifyPartner + relación activa).
 */
export default function PartnerClientDetail({ me }) {
  const { organizationId } = useParams()
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('summary')
  const [modal, setModal] = useState(null)   // capacity | service
  const [flash, setFlash] = useState('')

  const load = useCallback(async () => {
    setError('')
    const r = await partnerApi.client(organizationId)
    if (r.status === 200 && r.data?.ok) setSummary(r.data)
    else { setSummary(null); setError(failure(r, 'No se pudo cargar el cliente.')) }
  }, [organizationId])
  useEffect(() => { load() }, [load])

  if (error) return <div><BackLink /><Empty>{error}</Empty></div>
  if (!summary) return <div><BackLink /><Empty>Cargando…</Empty></div>

  const o = summary.organization
  const lc = summary.lifecycle
  const technical = can(me, 'technical.read')
  const TABS = [
    { key: 'summary', label: 'Resumen' }, { key: 'domains', label: 'Dominios' }, { key: 'findings', label: 'Hallazgos' },
    { key: 'credentials', label: 'Credenciales' }, ...(technical ? [{ key: 'reports', label: 'Reportes' }] : []),
  ]
  return (
    <div>
      <BackLink />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily: K.title, fontSize: 24, color: K.t1, margin: '0 0 8px' }}>{o.name}</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Pill tone={lc.ended ? 'bad' : lc.expiring_soon ? 'warn' : 'good'}>{STATUS_LABEL[lc.status] ?? lc.status}</Pill>
            <Pill>{SERVICE_LABEL[lc.service_type] ?? '—'}</Pill>
            <Pill>{o.relationship_type === 'referred' ? 'Referido' : 'Gestionado'}</Pill>
          </div>
        </div>
        {can(me, 'requests.create') && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={() => setModal('capacity')}>Solicitar capacidad</Button>
            <Button onClick={() => setModal('service')}>Solicitar extensión / activación</Button>
          </div>
        )}
      </div>
      {flash && <Notice tone="good">{flash}</Notice>}

      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${K.border}`, marginBottom: 18, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} style={{
            fontFamily: K.title, fontWeight: 600, fontSize: 13, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t.key ? K.t1 : K.t3, borderBottom: `2px solid ${tab === t.key ? K.accent : 'transparent'}`, whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'summary' && <Summary s={summary} />}
      {tab === 'domains' && <DomainsTab orgId={o.id} />}
      {tab === 'findings' && <FindingsTab orgId={o.id} />}
      {tab === 'credentials' && <CredentialsTab orgId={o.id} />}
      {tab === 'reports' && technical && <ReportsTab orgId={o.id} partner={me.partner} orgName={o.name} />}

      {modal === 'capacity' && <CapacityRequestModal summary={summary} onClose={() => setModal(null)} onDone={() => { setModal(null); setFlash('Solicitud de capacidad enviada a FENIKSO.'); load() }} />}
      {modal === 'service' && <ServiceRequestModal summary={summary} onClose={() => setModal(null)} onDone={() => { setModal(null); setFlash('Solicitud enviada a FENIKSO.'); load() }} />}
    </div>
  )
}

function BackLink() {
  return <Link to="/partner/clients" style={{ display: 'inline-block', color: K.t3, fontSize: 12.5, textDecoration: 'none', marginBottom: 14 }}>← Clientes</Link>
}

function Stat({ label, value, sub, tone }) {
  return (
    <Card style={{ padding: '16px 18px' }}>
      <div style={{ fontFamily: K.mono, fontSize: 10, color: K.t3, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: K.title, fontSize: 20, fontWeight: 700, color: tone === 'bad' ? K.red : tone === 'warn' ? K.amberText : K.t1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: K.t3, marginTop: 6 }}>{sub}</div>}
    </Card>
  )
}

function Summary({ s }) {
  const f = s.findings_open
  const pending = [...s.pending_requests.capacity.map(r => `Capacidad → ${r.requested_limit}`), ...s.pending_requests.service.map(r => SERVICE_REQUEST_LABEL[r.request_type])]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="ph-grid">
        <Stat label="Vigencia" value={vigenciaText(s.lifecycle)} tone={s.lifecycle.ended ? 'bad' : s.lifecycle.expiring_soon ? 'warn' : undefined}
          sub={s.lifecycle.service_starts_at ? `Desde ${fmtDate(s.lifecycle.service_starts_at)}` : null} />
        <Stat label="Capacidad" value={`${s.capacity.domain_count} de ${s.capacity.domain_limit} dominios`} sub={`${s.capacity.monitored_domains} monitoreados`} />
        <Stat label="Hallazgos críticos" value={f ? f.critical : '—'} tone={f?.critical ? 'bad' : undefined} sub={f ? `${f.high} altos · ${f.medium} medios · ${f.low} bajos` : 'No se pudieron leer'} />
        <Stat label="Credenciales expuestas" value={s.credentials.exposed} tone={s.credentials.exposed ? 'bad' : undefined} sub={`${s.credentials.total} detectadas en total`} />
      </div>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, fontSize: 13 }}>
          <div><div style={{ color: K.t3, fontSize: 12 }}>Owner del cliente</div><div style={{ color: K.t1, marginTop: 4 }}>{s.organization.owner_email ?? '—'}</div></div>
          <div><div style={{ color: K.t3, fontSize: 12 }}>Última actividad</div><div style={{ color: K.t1, marginTop: 4 }}>{s.last_activity_at ? new Date(s.last_activity_at).toLocaleString('es-AR') : '—'}</div></div>
          <div><div style={{ color: K.t3, fontSize: 12 }}>Asociado desde</div><div style={{ color: K.t1, marginTop: 4 }}>{fmtDate(s.organization.associated_at)}</div></div>
          <div><div style={{ color: K.t3, fontSize: 12 }}>Solicitudes pendientes</div><div style={{ color: K.t1, marginTop: 4 }}>{pending.length ? pending.join(' · ') : 'Ninguna'}</div></div>
        </div>
        <p style={{ color: K.t3, fontSize: 12, margin: '16px 0 0', lineHeight: 1.6 }}>
          El cliente conserva su propio acceso al portal HAVEN. Desde el Partner Hub no se puede ingresar como el cliente ni cambiar sus credenciales.
        </p>
      </Card>
    </div>
  )
}

function usePart(orgId, part) {
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    let cancelled = false
    partnerApi.clientPart(orgId, part).then(r => {
      if (cancelled) return
      setState(r.status === 200 && r.data?.ok ? { data: r.data } : { error: failure(r, 'No se pudo cargar la información.') })
    })
    return () => { cancelled = true }
  }, [orgId, part])
  return state
}

function DomainsTab({ orgId }) {
  const { data, error, loading } = usePart(orgId, 'domains')
  if (loading) return <Empty>Cargando dominios…</Empty>
  if (error) return <Empty>{error}</Empty>
  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: '14px 16px', color: K.t2, fontSize: 13 }}>{data.domain_count} de {data.domain_limit} dominios</div>
      <div className="ph-scroll"><table className="ph-table">
        <thead><tr><th style={th}>Dominio</th><th style={th}>Estado</th><th style={th}>Score</th><th style={th}>Último análisis</th></tr></thead>
        <tbody>{data.domains.map(d => (
          <tr key={d.id}>
            <td style={td}>{d.domain} {d.is_primary && <Pill>principal</Pill>}</td>
            <td style={td}>{!d.verified ? <Pill tone="warn">Sin confirmar</Pill> : d.monitoring_paused ? <Pill tone="bad">Pausado</Pill> : d.monitoring_active ? <Pill tone="good">Monitoreado</Pill> : <Pill>Inactivo</Pill>}</td>
            <td style={{ ...td, fontFamily: K.mono }}>{d.score ?? '—'}</td>
            <td style={{ ...td, color: K.t3 }}>{d.last_scan_at ? new Date(d.last_scan_at).toLocaleString('es-AR') : '—'}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </Card>
  )
}

function SeveritySummary({ summary, label }) {
  return (
    <div className="ph-grid" style={{ marginBottom: 14 }}>
      {['critical', 'high', 'medium', 'low'].map(s => (
        <Card key={s} style={{ padding: '14px 16px' }}>
          <div style={{ fontFamily: K.mono, fontSize: 10, color: K.t3, letterSpacing: '.12em', textTransform: 'uppercase' }}>{label} · {SEV_LABEL[s]}</div>
          <div style={{ fontFamily: K.title, fontSize: 22, fontWeight: 700, color: summary[s] ? SEV[s] : K.t2, marginTop: 6 }}>{summary[s] ?? 0}</div>
        </Card>
      ))}
    </div>
  )
}

const Restricted = () => <Notice tone="warn">Tu rol ve solo el resumen. El detalle técnico está disponible para los roles Owner, Admin y Analista.</Notice>

function FindingsTab({ orgId }) {
  const { data, error, loading } = usePart(orgId, 'findings')
  if (loading) return <Empty>Cargando hallazgos…</Empty>
  if (error) return <Empty>{error}</Empty>
  return (
    <div>
      <SeveritySummary summary={data.summary} label="Abiertos" />
      {data.restricted ? <Restricted /> : data.findings.length === 0 ? <Empty>Sin hallazgos abiertos.</Empty> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.findings.map(f => (
            <Card key={f.id} style={{ padding: '14px 16px', borderLeft: `3px solid ${SEV[f.severity] ?? K.t3}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ color: K.t1, fontSize: 14 }}>{f.title_plain ?? f.check_id}</strong>
                <span style={{ display: 'flex', gap: 6 }}><Pill>{f.domain}</Pill><Pill tone={f.severity === 'critical' || f.severity === 'high' ? 'bad' : 'warn'}>{SEV_LABEL[f.severity] ?? f.severity}</Pill></span>
              </div>
              {f.description_plain && <p style={{ color: K.t2, fontSize: 13, lineHeight: 1.6, margin: '8px 0 0' }}>{f.description_plain}</p>}
              {f.title_tech && <p style={{ color: K.t3, fontSize: 12, fontFamily: K.mono, margin: '8px 0 0' }}>{f.title_tech}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function CredentialsTab({ orgId }) {
  const { data, error, loading } = usePart(orgId, 'credentials')
  if (loading) return <Empty>Cargando credenciales…</Empty>
  if (error) return <Empty>{error}</Empty>
  const s = data.summary
  return (
    <div>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: K.title, fontSize: 20, fontWeight: 700, color: s.exposed ? K.red : K.t1 }}>
          {s.exposed === 1 ? '1 credencial expuesta' : `${s.exposed} credenciales expuestas`}
        </div>
        <div style={{ color: K.t3, fontSize: 12.5, marginTop: 6 }}>{s.critical} críticas · {s.high} altas · {s.medium} medias · {s.low} bajas · {s.total} detectadas en total</div>
      </Card>
      {data.restricted ? <Restricted /> : data.exposures.length === 0 ? <Empty>Sin credenciales detectadas.</Empty> : (
        <Card style={{ padding: 0 }}>
          <div className="ph-scroll"><table className="ph-table">
            <thead><tr><th style={th}>Identidad</th><th style={th}>Severidad</th><th style={th}>Origen</th><th style={th}>Contraseña</th><th style={th}>Estado</th><th style={th}>Visto</th></tr></thead>
            <tbody>{data.exposures.map(x => (
              <tr key={x.id}>
                <td style={{ ...td, fontFamily: K.mono, fontSize: 12 }}>{x.identity}</td>
                <td style={td}><span style={{ color: SEV[x.severity] }}>{SEV_LABEL[x.severity] ?? x.severity}</span></td>
                <td style={{ ...td, color: K.t2 }}>{x.source_name ?? x.source_type}</td>
                <td style={td}>{x.password_exposed ? <Pill tone="bad">expuesta</Pill> : <Pill>no</Pill>}</td>
                <td style={{ ...td, color: K.t2 }}>{x.remediation_status}</td>
                <td style={{ ...td, color: K.t3 }}>{fmtDate(x.last_seen_at)}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <p style={{ color: K.t3, fontSize: 12, padding: '10px 16px', margin: 0 }}>Nunca se muestran contraseñas. Las cuentas de terceros aparecen enmascaradas.</p>
        </Card>
      )}
    </div>
  )
}

function ReportsTab({ orgId, partner, orgName }) {
  const { data, error, loading } = usePart(orgId, 'reports')
  if (loading) return <Empty>Cargando reportes…</Empty>
  if (error) return <Empty>{error}</Empty>
  const t = data.trial_closure
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <PartnerMark branding={partner} compact />
        <span style={{ color: K.t3, fontSize: 12.5 }}>Reportes de {orgName}</span>
      </Card>
      {t && (
        <Card>
          <div style={{ fontFamily: K.mono, fontSize: 10, color: K.t3, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>Informe de cierre de trial</div>
          <div style={{ color: K.t1, fontSize: 14 }}>{fmtDate(t.trial_started_at)} — {fmtDate(t.trial_ended_at)} · {t.domains_count} dominios</div>
          <div style={{ color: K.t2, fontSize: 13, marginTop: 6 }}>{t.findings_total} hallazgos ({t.critical_count} críticos, {t.high_count} altos) · {t.open_findings_count} abiertos al cierre · {t.credentials_exposed_count} credenciales expuestas</div>
        </Card>
      )}
      {data.monthly.length === 0 && !t ? <Empty>Todavía no hay reportes para este cliente.</Empty> : data.monthly.length > 0 && (
        <Card style={{ padding: 0 }}>
          <div className="ph-scroll"><table className="ph-table">
            <thead><tr><th style={th}>Reporte mensual</th><th style={th}>Score</th><th style={th}>Hallazgos</th><th style={th}>Enviado</th></tr></thead>
            <tbody>{data.monthly.map(m => (
              <tr key={m.id}>
                <td style={td}>{fmtDate(m.period_start)} — {fmtDate(m.period_end)}</td>
                <td style={{ ...td, fontFamily: K.mono }}>{m.score_start ?? '—'} → {m.score_end ?? '—'}</td>
                <td style={{ ...td, color: K.t2 }}>{m.findings_summary ? `${m.findings_summary.total ?? 0} (${m.findings_summary.open ?? 0} abiertos)` : '—'}</td>
                <td style={{ ...td, color: K.t3 }}>{m.sent_at ? fmtDate(m.sent_at) : 'No enviado'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}
    </div>
  )
}

function CapacityRequestModal({ summary, onClose, onDone }) {
  const current = summary.capacity.domain_limit
  const [limit, setLimit] = useState(String(Math.max(current + 1, 25)))
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const n = Number(limit)
  const invalid = !/^\d+$/.test(limit.trim()) || n <= current || n > MAX_DOMAIN_LIMIT
  async function submit(e) {
    e.preventDefault()
    if (invalid || busy) return
    setBusy(true); setError('')
    const r = await partnerApi.requestCapacity(summary.organization.id, n, reason.trim() || undefined)
    setBusy(false)
    if (r.status === 201) onDone()
    else setError(failure(r, 'No se pudo enviar la solicitud.'))
  }
  return (
    <Modal title="Solicitar capacidad" onClose={onClose}>
      <p style={{ color: K.t2, fontSize: 13, lineHeight: 1.6, margin: '0 0 14px' }}>
        Capacidad actual: <strong style={{ color: K.t1 }}>{current} dominios</strong> ({summary.capacity.domain_count} en uso). FENIKSO revisa y aprueba el cambio.
      </p>
      <form onSubmit={submit} noValidate>
        {error && <Notice>{error}</Notice>}
        <Field label="Capacidad solicitada" error={limit && invalid ? `Ingresá un número mayor a ${current} y hasta ${MAX_DOMAIN_LIMIT}.` : null}>
          <input inputMode="numeric" value={limit} onChange={e => setLimit(e.target.value)} style={inputStyle(limit && invalid)} />
        </Field>
        <Field label="Motivo (opcional)"><textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} rows={3} style={{ ...inputStyle(), height: 'auto', padding: 10, resize: 'vertical' }} /></Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={invalid || busy}>{busy ? 'Enviando…' : 'Enviar solicitud'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function ServiceRequestModal({ summary, onClose, onDone }) {
  const isTrial = summary.lifecycle.service_type === 'trial'
  const [type, setType] = useState(isTrial ? 'trial_extension' : 'activation')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    const r = await partnerApi.requestService(summary.organization.id, type, message.trim() || undefined)
    setBusy(false)
    if (r.status === 201) onDone()
    else setError(failure(r, 'No se pudo enviar la solicitud.'))
  }
  return (
    <Modal title="Solicitar extensión / activación" onClose={onClose}>
      <p style={{ color: K.t2, fontSize: 13, lineHeight: 1.6, margin: '0 0 14px' }}>
        La vigencia la define FENIKSO. Tu solicitud queda registrada y vas a ver la respuesta en Solicitudes.
      </p>
      <form onSubmit={submit} noValidate>
        {error && <Notice>{error}</Notice>}
        <Field label="Tipo">
          <select value={type} onChange={e => setType(e.target.value)} style={inputStyle()}>
            {isTrial && <option value="trial_extension">{SERVICE_REQUEST_LABEL.trial_extension}</option>}
            <option value="activation">{SERVICE_REQUEST_LABEL.activation}</option>
          </select>
        </Field>
        <Field label="Detalle (opcional)"><textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={1000} rows={3} style={{ ...inputStyle(), height: 'auto', padding: 10, resize: 'vertical' }} /></Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar solicitud'}</Button>
        </div>
      </form>
    </Modal>
  )
}
