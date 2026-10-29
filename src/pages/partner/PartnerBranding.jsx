import { useEffect, useRef, useState } from 'react'
import { partnerApi, failure, can, validateLogoFile, HEX_RE, safeAccent, LOGO_TYPES } from '../../lib/partner'
import { Card, Button, SectionTitle, Field, Notice, PartnerMark } from './ui'
import { K, inputStyle } from './tokens'

/**
 * Co-branding liviano: nombre visible, logo (PNG/JPG/WEBP ≤ 512 KB), accent #RRGGBB
 * y email de soporte. "Powered by HAVEN" siempre visible; sin CSS/fonts/HTML propios.
 */
export default function PartnerBranding({ me, onChange }) {
  const editable = can(me, 'branding.manage')
  const b = me.partner
  const [form, setForm] = useState({ display_name: b.display_name ?? '', accent_color: b.accent_color ?? '', support_email: b.support_email ?? '' })
  const [fields, setFields] = useState({})
  const [msg, setMsg] = useState({})
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  useEffect(() => { setForm({ display_name: b.display_name ?? '', accent_color: b.accent_color ?? '', support_email: b.support_email ?? '' }) }, [b.display_name, b.accent_color, b.support_email])

  const accentError = form.accent_color && !HEX_RE.test(form.accent_color) ? 'Usá el formato #RRGGBB, por ejemplo #5B6EF5.' : null
  const preview = { ...b, display_name: form.display_name || b.display_name }

  async function save(e) {
    e.preventDefault()
    if (busy || accentError) return
    setBusy(true); setMsg({}); setFields({})
    const r = await partnerApi.saveBranding({ display_name: form.display_name, accent_color: form.accent_color || null, support_email: form.support_email || null })
    setBusy(false)
    if (r.status === 200) { onChange(r.data.branding); setMsg({ ok: 'Branding guardado.' }) }
    else { setFields(r.data?.fields ?? {}); setMsg({ error: failure(r, 'No se pudo guardar.') }) }
  }
  async function upload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    const problem = validateLogoFile(file)
    if (problem) { setMsg({ error: problem }); return }
    setBusy(true); setMsg({})
    const r = await partnerApi.uploadLogo(file)
    setBusy(false)
    if (r.status === 200) { onChange(r.data.branding); setMsg({ ok: 'Logo actualizado.' }) } else setMsg({ error: failure(r, 'No se pudo subir el logo.') })
  }
  async function removeLogo() {
    setBusy(true); setMsg({})
    const r = await partnerApi.deleteLogo()
    setBusy(false)
    if (r.status === 200) { onChange(r.data.branding); setMsg({ ok: 'Logo eliminado.' }) } else setMsg({ error: failure(r, 'No se pudo quitar el logo.') })
  }

  return (
    <div>
      <SectionTitle>Branding</SectionTitle>
      <p style={{ color: K.t2, fontSize: 13, margin: '0 0 16px', lineHeight: 1.6 }}>
        Tu marca aparece en el Partner Hub, en los emails y reportes de tus clientes, siempre junto a “Powered by HAVEN”.
      </p>
      {msg.error && <Notice>{msg.error}</Notice>}
      {msg.ok && <Notice tone="good">{msg.ok}</Notice>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, alignItems: 'start' }}>
        <Card>
          <form onSubmit={save} noValidate>
            <Field label="Nombre visible" error={fields.display_name}>
              <input value={form.display_name} disabled={!editable} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} style={inputStyle(fields.display_name)} maxLength={80} />
            </Field>
            <Field label="Color de acento" error={accentError ?? fields.accent_color} hint="Se usa en botones y resaltados.">
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="color" aria-label="Elegir color" disabled={!editable} value={safeAccent(form.accent_color)} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value.toUpperCase() }))}
                  style={{ width: 44, height: 40, padding: 2, background: K.input, border: `1px solid ${K.inputBdr}`, borderRadius: 9 }} />
                <input value={form.accent_color} disabled={!editable} placeholder="#5B6EF5" onChange={e => setForm(f => ({ ...f, accent_color: e.target.value.trim() }))} style={inputStyle(accentError)} maxLength={7} />
              </div>
            </Field>
            <Field label="Email de soporte" error={fields.support_email} hint="Contacto que ven tus clientes. Si queda vacío: hola@fenikso.io.">
              <input type="email" value={form.support_email} disabled={!editable} onChange={e => setForm(f => ({ ...f, support_email: e.target.value }))} style={inputStyle(fields.support_email)} />
            </Field>
            {editable && <Button type="submit" disabled={busy || !!accentError || !form.display_name.trim()}>{busy ? 'Guardando…' : 'Guardar'}</Button>}
          </form>
          <div style={{ borderTop: `1px solid ${K.border}`, marginTop: 20, paddingTop: 16 }}>
            <div style={{ fontSize: 12.5, color: K.t2, marginBottom: 10 }}>Logo (PNG, JPG o WEBP, hasta 512 KB)</div>
            {editable ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input ref={fileRef} type="file" accept={LOGO_TYPES.join(',')} onChange={upload} hidden data-testid="logo-input" />
                <Button variant="ghost" disabled={busy} onClick={() => fileRef.current?.click()}>{b.logo_url ? 'Reemplazar logo' : 'Subir logo'}</Button>
                {b.logo_url && <Button variant="danger" disabled={busy} onClick={removeLogo}>Quitar</Button>}
              </div>
            ) : <p style={{ color: K.t3, fontSize: 12.5, margin: 0 }}>Solo Owner y Admin pueden editar el branding.</p>}
          </div>
        </Card>
        <Card style={{ '--pa': safeAccent(form.accent_color) }}>
          <div style={{ fontFamily: K.mono, fontSize: 10, color: K.t3, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 14 }}>Vista previa</div>
          <PartnerMark branding={preview} />
          <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
            <Button small>Botón</Button>
            <span style={{ borderBottom: `2px solid ${K.accent}`, color: K.t1, fontSize: 13, padding: '6px 2px' }}>Pestaña activa</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
