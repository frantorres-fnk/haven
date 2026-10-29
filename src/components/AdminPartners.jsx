import { useCallback, useEffect, useState } from 'react'
import { adminPartnerApi, failure, ROLE_LABEL, ROLES, fmtDate, REQUEST_STATUS_LABEL, SERVICE_REQUEST_LABEL, HEX_RE } from '../lib/partner'
import { Card, Button, Pill, Empty, Modal, Field, Notice } from '../pages/partner/ui'
import { K, inputStyle, th, td } from '../pages/partner/tokens'

const STATUS = { active: ['Activo', 'good'], suspended: ['Suspendido', 'bad'], inactive: ['Inactivo', 'neutral'] }

/**
 * FENIKSO Admin → Partners. Todo pasa por /admin/* (verifyAdmin + aal2).
 * Suspender un Partner bloquea su Hub, nunca a sus clientes. Asociar/desasociar solo
 * crea/cierra la relación. Aprobar capacidad usa admin_set_domain_limit (Worker/RPC);
 * aprobar una solicitud de servicio NO cambia la vigencia: se aplica con "Vigencia".
 */
export default function AdminPartners({ orgs = [], onOpenService }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState({})
  const [editing, setEditing] = useState(null)
  const [review, setReview] = useState(null)   // { kind, request }

  const load = useCallback(async () => {
    const r = await adminPartnerApi.list()
    if (r.status === 200 && r.data?.ok) { setData(r.data); setError('') } else setError(failure(r, 'No se pudieron cargar los Partners.'))
  }, [])
  useEffect(() => { load() }, [load])

  async function act(promise, success) {
    setError(''); setOk('')
    const r = await promise
    if (r.status >= 200 && r.status < 300 && r.data?.ok !== false) { if (success) setOk(success); await load(); return r }
    setError(failure(r, 'No se pudo completar la acción.'))
    return null
  }

  if (!data) return error ? <Notice>{error}</Notice> : <Empty>Cargando Partners…</Empty>
  const pendingCap = data.capacity_requests.filter(r => r.status === 'pending')
  const pendingSvc = data.service_requests.filter(r => r.status === 'pending')
  const partnerName = (id) => data.partners.find(p => p.id === id)?.name ?? '—'
  const activeRelOrg = new Set(data.organizations.filter(r => r.status === 'active').map(r => r.organization_id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ color: K.t2, fontSize: 13, margin: 0 }}>{data.partners.length} Partners · {pendingCap.length + pendingSvc.length} solicitudes pendientes</p>
        <Button onClick={() => setCreating(true)}>+ Crear Partner</Button>
      </div>
      {error && <Notice>{error}</Notice>}
      {ok && <Notice tone="good">{ok}</Notice>}

      {(pendingCap.length > 0 || pendingSvc.length > 0) && (
        <Card style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', fontFamily: K.title, fontWeight: 700, color: K.t1 }}>Solicitudes pendientes</div>
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Partner</th><th style={th}>Cliente</th><th style={th}>Solicitud</th><th style={th}>Pedida por</th><th style={th} /></tr></thead>
            <tbody>
              {pendingCap.map(r => (
                <tr key={r.id}>
                  <td style={td}>{partnerName(r.partner_id)}</td><td style={td}>{r.organization_name ?? r.organization_id}</td>
                  <td style={td}>Capacidad {r.current_limit} → <strong>{r.requested_limit}</strong>{r.reason && <div style={{ color: K.t3, fontSize: 12 }}>{r.reason}</div>}</td>
                  <td style={{ ...td, color: K.t2 }}>{r.requested_by_email}<div style={{ fontSize: 11.5, color: K.t3 }}>{fmtDate(r.created_at)}</div></td>
                  <td style={td}><Button small onClick={() => setReview({ kind: 'capacity', request: r })}>Revisar</Button></td>
                </tr>
              ))}
              {pendingSvc.map(r => (
                <tr key={r.id}>
                  <td style={td}>{partnerName(r.partner_id)}</td><td style={td}>{r.organization_name ?? r.organization_id}</td>
                  <td style={td}>{SERVICE_REQUEST_LABEL[r.request_type]}{r.message && <div style={{ color: K.t3, fontSize: 12 }}>{r.message}</div>}
                    <div style={{ color: K.t3, fontSize: 11.5 }}>Al pedir: {r.org_service_type ?? '—'}{r.org_service_ends_at ? ` hasta ${fmtDate(r.org_service_ends_at)}` : ''}</div></td>
                  <td style={{ ...td, color: K.t2 }}>{r.requested_by_email}<div style={{ fontSize: 11.5, color: K.t3 }}>{fmtDate(r.created_at)}</div></td>
                  <td style={td}><Button small onClick={() => setReview({ kind: 'service', request: r })}>Revisar</Button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      )}

      {data.partners.length === 0 && <Empty>Todavía no hay Partners. Creá el primero con “+ Crear Partner”.</Empty>}
      {data.partners.map(p => {
        const users = data.users.filter(u => u.partner_id === p.id)
        const invites = data.invites.filter(i => i.partner_id === p.id)
        const rels = data.organizations.filter(r => r.partner_id === p.id && r.status === 'active')
        const [label, tone] = STATUS[p.status] ?? [p.status, 'neutral']
        const expanded = !!open[p.id]
        return (
          <Card key={p.id} style={{ padding: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '16px 18px' }}>
              <button type="button" onClick={() => setOpen(o => ({ ...o, [p.id]: !o[p.id] }))} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                {p.branding?.logo_url
                  ? <img src={p.branding.logo_url} alt="" style={{ height: 30, maxWidth: 90, objectFit: 'contain' }} />
                  : <span style={{ width: 30, height: 30, borderRadius: 8, background: HEX_RE.test(p.accent_color ?? '') ? p.accent_color : '#5B6EF5', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: K.title, fontWeight: 700 }}>{p.name.slice(0, 1)}</span>}
                <span>
                  <span style={{ display: 'block', fontFamily: K.title, fontWeight: 700, color: K.t1, fontSize: 15 }}>{p.name}</span>
                  <span style={{ display: 'block', color: K.t3, fontSize: 12 }}>{p.display_name} · {users.filter(u => u.status === 'active').length} usuarios · {rels.length} clientes</span>
                </span>
              </button>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Pill tone={tone}>{label}</Pill>
                <Button small variant="ghost" onClick={() => setEditing(p)}>Editar</Button>
                {p.status === 'active'
                  ? <Button small variant="danger" onClick={() => window.confirm(`¿Suspender ${p.name}? Sus usuarios no podrán entrar al Partner Hub. Los clientes NO se modifican.`) && act(adminPartnerApi.update(p.id, { status: 'suspended' }), `${p.name} suspendido. Sus clientes siguen igual.`)}>Suspender</Button>
                  : <Button small variant="ghost" onClick={() => act(adminPartnerApi.update(p.id, { status: 'active' }), `${p.name} activado.`)}>Activar</Button>}
              </div>
            </div>
            {expanded && (
              <div style={{ borderTop: `1px solid ${K.border}`, padding: '16px 18px', display: 'grid', gap: 18 }}>
                <PartnerClientsBlock partner={p} rels={rels} orgs={orgs} activeRelOrg={activeRelOrg} act={act} onOpenService={onOpenService} />
                <PartnerUsersBlock partner={p} users={users} invites={invites} act={act} />
              </div>
            )}
          </Card>
        )
      })}

      {data.actions.length > 0 && (
        <details>
          <summary style={{ color: K.t2, fontSize: 13, cursor: 'pointer' }}>Auditoría Partner (últimas {data.actions.length})</summary>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.actions.map(a => (
              <div key={a.id} style={{ fontSize: 12, color: K.t2, fontFamily: K.mono }}>
                {new Date(a.created_at).toLocaleString('es-AR')} · {partnerName(a.partner_id)} · {a.actor_email} · {a.action}
              </div>
            ))}
          </div>
        </details>
      )}

      {creating && <CreatePartnerModal onClose={() => setCreating(false)} onDone={async (r) => { setCreating(false); setOk(r.owner_invite?.email_sent ? `Partner creado. Invitación enviada a ${r.owner_invite.email}.` : `Partner creado. ${r.warnings?.[0] ?? ''}`); await load() }} />}
      {editing && <EditPartnerModal partner={editing} onClose={() => setEditing(null)} onSave={async (patch) => { const r = await act(adminPartnerApi.update(editing.id, patch), 'Partner actualizado.'); if (r) setEditing(null) }} />}
      {review && <ReviewModal review={review} onClose={() => setReview(null)} onDecide={async (decision, note) => {
        const fn = review.kind === 'capacity' ? adminPartnerApi.reviewCapacity : adminPartnerApi.reviewService
        const success = review.kind === 'capacity'
          ? (decision === 'approve' ? `Capacidad aprobada: ${review.request.requested_limit} dominios.` : 'Solicitud rechazada.')
          : (decision === 'approve' ? 'Solicitud aprobada. Aplicá la vigencia desde el cliente (“Vigencia”).' : 'Solicitud rechazada.')
        const r = await act(fn(review.request.id, decision, note), success)
        if (r) setReview(null)
      }} />}
    </div>
  )
}

function PartnerClientsBlock({ partner, rels, orgs, activeRelOrg, act, onOpenService }) {
  const [orgId, setOrgId] = useState('')
  const [type, setType] = useState('managed')
  const candidates = orgs.filter(o => !activeRelOrg.has(o.id)).sort((a, b) => String(a.name).localeCompare(String(b.name)))
  return (
    <div>
      <div style={{ fontFamily: K.mono, fontSize: 10, color: K.t3, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>Clientes asociados</div>
      {rels.length === 0 && <p style={{ color: K.t3, fontSize: 13, margin: '0 0 10px' }}>Sin clientes asociados.</p>}
      {rels.map(r => (
        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${K.border}`, flexWrap: 'wrap' }}>
          <span style={{ color: K.t1, fontSize: 13 }}>{r.organizations?.name ?? r.organization_id} <span style={{ color: K.t3, fontSize: 12 }}>· {r.relationship_type === 'referred' ? 'referido' : 'gestionado'} · {r.organizations?.status} · {r.organizations?.domain_limit} dominios</span></span>
          <span style={{ display: 'flex', gap: 6 }}>
            {onOpenService && <Button small variant="ghost" onClick={() => onOpenService(r.organization_id)}>Vigencia</Button>}
            <Button small variant="danger" onClick={() => window.confirm(`¿Desasociar ${r.organizations?.name} de ${partner.name}? El cliente, su monitoreo y sus datos no cambian.`) && act(adminPartnerApi.disassociate(partner.id, r.organization_id), 'Cliente desasociado. La organización no se modificó.')}>Desasociar</Button>
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <select aria-label="Organización a asociar" value={orgId} onChange={e => setOrgId(e.target.value)} style={{ ...inputStyle(), width: 'auto', minWidth: 220, height: 34 }}>
          <option value="">Asociar organización existente…</option>
          {candidates.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select aria-label="Tipo de relación" value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle(), width: 'auto', height: 34 }}>
          <option value="managed">Gestionado</option><option value="referred">Referido</option>
        </select>
        <Button small disabled={!orgId} onClick={async () => { if (await act(adminPartnerApi.associate(partner.id, orgId, type), 'Organización asociada.')) setOrgId('') }}>Asociar</Button>
      </div>
    </div>
  )
}

function PartnerUsersBlock({ partner, users, invites, act }) {
  const [form, setForm] = useState({ email: '', role: 'partner_owner' })
  return (
    <div>
      <div style={{ fontFamily: K.mono, fontSize: 10, color: K.t3, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>Usuarios</div>
      {users.map(u => (
        <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${K.border}`, flexWrap: 'wrap' }}>
          <span style={{ color: u.status === 'active' ? K.t1 : K.t3, fontSize: 13 }}>{u.email} <span style={{ color: K.t3, fontSize: 12 }}>· {ROLE_LABEL[u.role]}{u.status !== 'active' ? ' · inactivo' : ''}</span></span>
          {u.status === 'active'
            ? <Button small variant="danger" onClick={() => act(adminPartnerApi.updateUser(partner.id, u.id, { status: 'inactive' }), 'Usuario desactivado.')}>Desactivar</Button>
            : <Button small variant="ghost" onClick={() => act(adminPartnerApi.updateUser(partner.id, u.id, { status: 'active' }), 'Usuario reactivado.')}>Reactivar</Button>}
        </div>
      ))}
      {invites.map(i => (
        <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${K.border}`, flexWrap: 'wrap' }}>
          <span style={{ color: K.t2, fontSize: 13 }}>{i.email} <span style={{ color: K.t3, fontSize: 12 }}>· {ROLE_LABEL[i.role]} · invitación pendiente hasta {fmtDate(i.expires_at)}</span></span>
          <Button small variant="ghost" onClick={() => act(adminPartnerApi.revokeInvite(partner.id, i.id), 'Invitación revocada.')}>Revocar</Button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <input aria-label="Email a invitar" placeholder="email@partner.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ ...inputStyle(), width: 'auto', minWidth: 220, height: 34 }} />
        <select aria-label="Rol" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ ...inputStyle(), width: 'auto', height: 34 }}>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <Button small disabled={!form.email.trim()} onClick={async () => { if (await act(adminPartnerApi.invite(partner.id, { email: form.email.trim(), role: form.role }), `Invitación enviada a ${form.email.trim()}.`)) setForm(f => ({ ...f, email: '' })) }}>Invitar</Button>
      </div>
    </div>
  )
}

function CreatePartnerModal({ onClose, onDone }) {
  const [form, setForm] = useState({ name: '', display_name: '', owner_name: '', owner_email: '', support_email: '' })
  const [fields, setFields] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setFields({})
    const r = await adminPartnerApi.create(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || undefined])))
    setBusy(false)
    if (r.status === 201 && r.data?.ok) return onDone(r.data)
    setFields(r.data?.fields ?? {})
    setError(failure(r, 'No se pudo crear el Partner.'))
  }
  return (
    <Modal title="Crear Partner" onClose={onClose}>
      <p style={{ color: K.t2, fontSize: 13, lineHeight: 1.6, margin: '0 0 14px' }}>Se crea el Partner y se invita al owner por email (sin contraseñas). No se asocian clientes automáticamente.</p>
      <form onSubmit={submit} noValidate>
        {error && <Notice>{error}</Notice>}
        <Field label="Nombre" error={fields.name}><input value={form.name} onChange={set('name')} style={inputStyle(fields.name)} maxLength={120} /></Field>
        <Field label="Nombre visible (opcional)" error={fields.display_name} hint="Por defecto, el nombre."><input value={form.display_name} onChange={set('display_name')} style={inputStyle(fields.display_name)} maxLength={80} /></Field>
        <Field label="Owner (nombre)" error={fields.owner_name}><input value={form.owner_name} onChange={set('owner_name')} style={inputStyle(fields.owner_name)} maxLength={120} /></Field>
        <Field label="Email del owner" error={fields.owner_email}><input type="email" value={form.owner_email} onChange={set('owner_email')} style={inputStyle(fields.owner_email)} /></Field>
        <Field label="Email de soporte (opcional)" error={fields.support_email}><input type="email" value={form.support_email} onChange={set('support_email')} style={inputStyle(fields.support_email)} /></Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Creando…' : 'Crear Partner'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function EditPartnerModal({ partner, onClose, onSave }) {
  const [form, setForm] = useState({ name: partner.name ?? '', display_name: partner.display_name ?? '', accent_color: partner.accent_color ?? '', support_email: partner.support_email ?? '' })
  const accentError = form.accent_color && !HEX_RE.test(form.accent_color) ? 'Formato #RRGGBB.' : null
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  return (
    <Modal title={`Editar ${partner.name}`} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (!accentError) onSave({ name: form.name, display_name: form.display_name, accent_color: form.accent_color || null, support_email: form.support_email || null }) }} noValidate>
        <Field label="Nombre"><input value={form.name} onChange={set('name')} style={inputStyle()} maxLength={120} /></Field>
        <Field label="Nombre visible"><input value={form.display_name} onChange={set('display_name')} style={inputStyle()} maxLength={80} /></Field>
        <Field label="Color de acento" error={accentError}><input value={form.accent_color} onChange={set('accent_color')} placeholder="#5B6EF5" style={inputStyle(accentError)} maxLength={7} /></Field>
        <Field label="Email de soporte"><input type="email" value={form.support_email} onChange={set('support_email')} style={inputStyle()} /></Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!!accentError || !form.name.trim() || !form.display_name.trim()}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}

function ReviewModal({ review, onClose, onDecide }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const r = review.request
  const decide = async (d) => { setBusy(true); await onDecide(d, note.trim() || undefined); setBusy(false) }
  return (
    <Modal title="Revisar solicitud" onClose={onClose}>
      <p style={{ color: K.t1, fontSize: 14, margin: '0 0 6px' }}>{r.organization_name}</p>
      <p style={{ color: K.t2, fontSize: 13, lineHeight: 1.6, margin: '0 0 14px' }}>
        {review.kind === 'capacity'
          ? <>Capacidad {r.current_limit} → <strong style={{ color: K.t1 }}>{r.requested_limit}</strong> dominios. Al aprobar se aplica con el mismo mecanismo que “Capacidad”.</>
          : <>{SERVICE_REQUEST_LABEL[r.request_type]}. Aprobar registra la decisión; la vigencia se aplica desde el cliente con “Vigencia”.</>}
      </p>
      <p style={{ color: K.t3, fontSize: 12, margin: '0 0 12px' }}>Estado: {REQUEST_STATUS_LABEL[r.status]} · pedida por {r.requested_by_email}</p>
      <Field label="Nota para el Partner (opcional)"><textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000} style={{ ...inputStyle(), height: 'auto', padding: 10 }} /></Field>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button variant="danger" disabled={busy} onClick={() => decide('reject')}>Rechazar</Button>
        <Button disabled={busy} onClick={() => decide('approve')}>Aprobar</Button>
      </div>
    </Modal>
  )
}
