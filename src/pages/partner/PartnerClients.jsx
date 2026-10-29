import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  partnerApi, failure, can, CLIENT_FILTERS, filterClients, STATUS_LABEL, SERVICE_LABEL, vigenciaText,
  PARTNER_TRIAL_MAX_DAYS, PARTNER_TRIAL_DOMAIN_LIMIT,
} from '../../lib/partner'
import { Card, Button, Pill, Kpi, Empty, SectionTitle, Modal, Field, Notice } from './ui'
import { K, inputStyle, th, td } from './tokens'

const relTime = (iso) => {
  if (!iso) return '—'
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600e3)
  if (h < 1) return 'hace minutos'
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`
}
const statusTone = (c) => (c.ended ? 'bad' : c.expiring_soon ? 'warn' : c.status === 'trialing' ? 'accent' : 'good')

/** Dashboard multicliente (dashboard) y listado de clientes. */
export default function PartnerClients({ me, dashboard = false }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setError('')
    const r = await partnerApi.dashboard()
    if (r.status === 200 && r.data?.ok) setData(r.data)
    else setError(failure(r, 'No se pudieron cargar los clientes.'))
  }, [])
  useEffect(() => { load() }, [load])

  const clients = filterClients(data?.clients, filter)
  const k = data?.kpis
  return (
    <div>
      <SectionTitle right={can(me, 'clients.create') && <Button onClick={() => setCreating(true)}>+ Nuevo cliente</Button>}>
        {dashboard ? 'Dashboard' : 'Clientes'}
      </SectionTitle>
      {error && <Notice>{error} <Button variant="link" onClick={load}>Reintentar</Button></Notice>}

      {dashboard && (
        <div className="ph-grid" style={{ marginBottom: 22 }}>
          <Kpi label="Clientes activos" value={k?.active_clients} />
          <Kpi label="Trials activos" value={k?.trials_active} />
          <Kpi label="Próximos a vencer" value={k?.expiring_soon} tone={k?.expiring_soon ? 'warn' : undefined} />
          <Kpi label="Dominios monitoreados" value={k?.domains_monitored} />
          <Kpi label="Críticos abiertos" value={k?.critical_open} tone={k?.critical_open ? 'bad' : undefined} />
          <Kpi label="Credenciales expuestas" value={k?.credentials_exposed} tone={k?.credentials_exposed ? 'bad' : undefined} />
          <Kpi label="Solicitudes pendientes" value={k?.pending_requests} />
        </div>
      )}

      <div role="tablist" aria-label="Filtrar clientes" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
        {CLIENT_FILTERS.map(f => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)} style={{
            fontFamily: K.title, fontWeight: 600, fontSize: 12.5, padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
            border: `1px solid ${filter === f.key ? K.accent : K.border}`, background: filter === f.key ? 'rgba(130,150,220,.08)' : 'none',
            color: filter === f.key ? K.t1 : K.t3,
          }}>{f.label} <span style={{ color: K.t3 }}>{filterClients(data?.clients, f.key).length}</span></button>
        ))}
      </div>

      {!data && !error && <Empty>Cargando clientes…</Empty>}
      {data && clients.length === 0 && <Empty>{data.clients.length === 0 ? 'Todavía no tenés clientes. Creá el primero con un trial de 7 días.' : 'Ningún cliente en este filtro.'}</Empty>}
      {clients.length > 0 && (
        <Card style={{ padding: 0 }}>
          <div className="ph-scroll">
            <table className="ph-table">
              <thead><tr>
                <th style={th}>Cliente</th><th style={th}>Estado</th><th style={th}>Servicio</th><th style={th}>Vigencia</th>
                <th style={th}>Dominios</th><th style={th}>Críticos</th><th style={th}>Credenciales</th><th style={th}>Última actividad</th>
              </tr></thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id} onClick={() => navigate(`/partner/clients/${c.id}`)} style={{ cursor: 'pointer' }}>
                    <td style={td}>
                      <Link to={`/partner/clients/${c.id}`} onClick={e => e.stopPropagation()} style={{ color: K.t1, fontWeight: 700, textDecoration: 'none' }}>{c.name}</Link>
                      {c.pending_requests > 0 && <span style={{ marginLeft: 8 }}><Pill tone="warn">{c.pending_requests} solicitud{c.pending_requests > 1 ? 'es' : ''}</Pill></span>}
                    </td>
                    <td style={td}><Pill tone={statusTone(c)}>{STATUS_LABEL[c.status] ?? c.status}</Pill></td>
                    <td style={{ ...td, color: K.t2 }}>{SERVICE_LABEL[c.service_type] ?? '—'}</td>
                    <td style={{ ...td, color: c.expiring_soon ? K.amberText : K.t2, whiteSpace: 'nowrap' }}>{vigenciaText(c)}</td>
                    <td style={{ ...td, fontFamily: K.mono }}>{c.domain_count}/{c.domain_limit}</td>
                    <td style={{ ...td, fontFamily: K.mono, color: c.critical_open ? K.red : K.t2 }}>{c.critical_open ?? '—'}</td>
                    <td style={{ ...td, fontFamily: K.mono, color: c.credentials_exposed ? K.red : K.t2 }}>{c.credentials_exposed}</td>
                    <td style={{ ...td, color: K.t3, whiteSpace: 'nowrap' }}>{relTime(c.last_activity_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {creating && <NewClientModal onClose={() => setCreating(false)} onCreated={(org) => { setCreating(false); load(); if (org?.id) navigate(`/partner/clients/${org.id}`) }} />}
    </div>
  )
}

export function NewClientModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', ownerName: '', ownerEmail: '', domain: '', trialDays: PARTNER_TRIAL_MAX_DAYS })
  const [fields, setFields] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const MAP = { name: 'name', owner_name: 'ownerName', owner_email: 'ownerEmail', primary_domain: 'domain', trial_days: 'trialDays' }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setFields({})
    const r = await partnerApi.createClient(form)
    setBusy(false)
    if ((r.status === 201 || r.status === 200) && r.data?.ok) { setDone(r.data); return }
    if (r.status === 400 && r.data?.fields) setFields(Object.fromEntries(Object.entries(r.data.fields).map(([k, v]) => [MAP[k] ?? k, v])))
    setError(failure(r, 'No se pudo crear el cliente.'))
  }

  if (done) {
    return (
      <Modal title="Cliente creado" onClose={() => onCreated(done.organization)}>
        <p style={{ color: K.t2, fontSize: 13.5, lineHeight: 1.6, margin: '0 0 12px' }}>
          <strong style={{ color: K.t1 }}>{done.organization?.name}</strong> quedó en trial hasta el {done.organization?.service_ends_at?.split('-').reverse().join('/')}, con capacidad para {PARTNER_TRIAL_DOMAIN_LIMIT} dominios.
        </p>
        <p style={{ color: K.t2, fontSize: 13.5, lineHeight: 1.6, margin: '0 0 12px' }}>
          {`Enviamos a ${done.owner?.email} la bienvenida y un link para que defina su contraseña. Nadie más la conoce.`}
          {' '}El monitoreo empieza cuando el owner confirme el dominio.
        </p>
        {done.warnings?.map(w => <Notice key={w} tone="warn">{w}</Notice>)}
        <Button onClick={() => onCreated(done.organization)}>Ver cliente</Button>
      </Modal>
    )
  }
  return (
    <Modal title="Nuevo cliente" onClose={onClose}>
      <p style={{ color: K.t2, fontSize: 13, lineHeight: 1.6, margin: '0 0 16px' }}>
        Se crea con un trial de hasta {PARTNER_TRIAL_MAX_DAYS} días y capacidad para {PARTNER_TRIAL_DOMAIN_LIMIT} dominios. Contratos, extensiones y más capacidad se solicitan a FENIKSO.
      </p>
      <form onSubmit={submit} noValidate>
        {error && <Notice>{error}</Notice>}
        <Field label="Organización" error={fields.name}><input value={form.name} onChange={set('name')} style={inputStyle(fields.name)} maxLength={120} /></Field>
        <Field label="Owner (nombre)" error={fields.ownerName}><input value={form.ownerName} onChange={set('ownerName')} style={inputStyle(fields.ownerName)} maxLength={120} /></Field>
        <Field label="Email del owner" error={fields.ownerEmail}><input type="email" value={form.ownerEmail} onChange={set('ownerEmail')} style={inputStyle(fields.ownerEmail)} /></Field>
        <Field label="Dominio principal" error={fields.domain} hint="Por ejemplo: empresa.com"><input value={form.domain} onChange={set('domain')} style={inputStyle(fields.domain)} /></Field>
        <Field label="Duración del trial" error={fields.trialDays}>
          <select value={form.trialDays} onChange={set('trialDays')} style={inputStyle(fields.trialDays)}>
            {Array.from({ length: PARTNER_TRIAL_MAX_DAYS }, (_, i) => PARTNER_TRIAL_MAX_DAYS - i).map(d => <option key={d} value={d}>{d} {d === 1 ? 'día' : 'días'}</option>)}
          </select>
        </Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Creando…' : 'Crear trial'}</Button>
        </div>
      </form>
    </Modal>
  )
}
