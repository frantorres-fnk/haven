import { useCallback, useEffect, useState } from 'react'
import { partnerApi, failure, fmtDate, ROLE_LABEL, ROLES } from '../../lib/partner'
import { Card, Button, Pill, Empty, SectionTitle, Field, Notice } from './ui'
import { K, inputStyle, th, td } from './tokens'

/** Equipo del Partner (owner/admin). Desactivar no borra el usuario Auth. */
export default function PartnerTeam({ me }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [form, setForm] = useState({ email: '', fullName: '', role: 'partner_analyst' })
  const [busy, setBusy] = useState(false)
  const isOwner = me.user.role === 'partner_owner'
  const assignable = ROLES.filter(r => isOwner || r !== 'partner_owner')

  const load = useCallback(async () => {
    const r = await partnerApi.team()
    if (r.status === 200 && r.data?.ok) setData(r.data); else setError(failure(r, 'No se pudo cargar el equipo.'))
  }, [])
  useEffect(() => { load() }, [load])

  async function invite(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setOk('')
    const r = await partnerApi.invite(form.email.trim(), form.role, form.fullName.trim() || undefined)
    setBusy(false)
    if (r.status === 201) {
      setOk(r.data.email_sent ? `Invitación enviada a ${r.data.invite.email}.` : (r.data.warnings?.[0] ?? 'Invitación creada.'))
      setForm({ email: '', fullName: '', role: form.role }); load()
    } else setError(failure(r, 'No se pudo invitar.'))
  }
  async function update(id, patch) {
    setError(''); setOk('')
    const r = await partnerApi.updateMember(id, patch)
    if (r.status === 200) load(); else setError(failure(r, 'No se pudo actualizar.'))
  }
  async function revoke(id) {
    const r = await partnerApi.revokeInvite(id)
    if (r.status === 200) load(); else setError(failure(r, 'No se pudo revocar.'))
  }

  return (
    <div>
      <SectionTitle>Equipo</SectionTitle>
      {error && <Notice>{error}</Notice>}
      {ok && <Notice tone="good">{ok}</Notice>}
      <Card style={{ marginBottom: 16 }}>
        <form onSubmit={invite} noValidate style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, alignItems: 'end' }}>
          <Field label="Email"><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle()} /></Field>
          <Field label="Nombre (opcional)"><input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} style={inputStyle()} maxLength={120} /></Field>
          <Field label="Rol">
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle()}>
              {assignable.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </Field>
          <div style={{ marginBottom: 14 }}><Button type="submit" disabled={busy || !form.email.trim()}>{busy ? 'Invitando…' : 'Invitar'}</Button></div>
        </form>
        <p style={{ color: K.t3, fontSize: 12, margin: 0 }}>La invitación vence en 7 días. No se envían contraseñas: la persona ingresa con su cuenta y configura la verificación en dos pasos.</p>
      </Card>

      {!data ? <Empty>Cargando…</Empty> : (
        <Card style={{ padding: 0 }}>
          <div className="ph-scroll"><table className="ph-table">
            <thead><tr><th style={th}>Persona</th><th style={th}>Rol</th><th style={th}>Estado</th><th style={th}>Desde</th><th style={th} /></tr></thead>
            <tbody>
              {data.members.map(m => {
                const locked = m.is_self || (!isOwner && m.role === 'partner_owner')
                return (
                  <tr key={m.id}>
                    <td style={td}>{m.full_name && <div>{m.full_name}</div>}<div style={{ color: K.t2, fontSize: 12.5 }}>{m.email}{m.is_self && ' (vos)'}</div></td>
                    <td style={td}>
                      {locked ? ROLE_LABEL[m.role] : (
                        <select aria-label={`Rol de ${m.email}`} value={m.role} onChange={e => update(m.id, { role: e.target.value })} style={{ ...inputStyle(), height: 32, width: 'auto' }}>
                          {assignable.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      )}
                    </td>
                    <td style={td}><Pill tone={m.status === 'active' ? 'good' : 'neutral'}>{m.status === 'active' ? 'Activo' : 'Inactivo'}</Pill></td>
                    <td style={{ ...td, color: K.t3 }}>{fmtDate(m.created_at)}</td>
                    <td style={td}>{!locked && (m.status === 'active'
                      ? <Button small variant="danger" onClick={() => update(m.id, { status: 'inactive' })}>Desactivar</Button>
                      : <Button small variant="ghost" onClick={() => update(m.id, { status: 'active' })}>Reactivar</Button>)}</td>
                  </tr>
                )
              })}
              {data.invites.map(i => (
                <tr key={i.id}>
                  <td style={td}><div style={{ color: K.t2 }}>{i.email}</div></td>
                  <td style={td}>{ROLE_LABEL[i.role]}</td>
                  <td style={td}><Pill tone="warn">Invitación pendiente</Pill></td>
                  <td style={{ ...td, color: K.t3 }}>vence {fmtDate(i.expires_at)}</td>
                  <td style={td}>{(isOwner || i.role !== 'partner_owner') && <Button small variant="ghost" onClick={() => revoke(i.id)}>Revocar</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      )}
    </div>
  )
}
