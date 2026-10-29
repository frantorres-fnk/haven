// Vigencia del servicio ("Acceso y vigencia") en /admin. La autoridad es el Worker
// (PUT /admin/organizations/:id/service, verifyAdmin + aal2): acá solo se arma el
// formulario, se valida para ayudar y se muestra.
//
// Fechas comerciales 'YYYY-MM-DD' en America/Argentina/Buenos_Aires. service_ends_at
// es el ÚLTIMO día de servicio (inclusive): vence a las 00:00 ART del día siguiente.

export const COMMERCIAL_TZ = 'America/Argentina/Buenos_Aires'

export const SERVICE_TYPES = [
  { value: 'trial', label: 'Trial', hint: 'Período de evaluación con fecha de fin' },
  { value: 'contract', label: 'Contrato', hint: 'Servicio con fecha de inicio y fin' },
  { value: 'manual', label: 'Sin vencimiento', hint: 'No vence automáticamente' },
]
export const TRIAL_PRESETS = [7, 15, 30]
export const SERVICE_TYPE_LABEL = Object.fromEntries(SERVICE_TYPES.map(t => [t.value, t.label]))

export const STATUS_LABEL = {
  trialing: 'Activo', active: 'Activo',
  trial_ended: 'Prueba finalizada', expired: 'Vencido',
  cancelled: 'Cancelado', past_due: 'Pago vencido',
}
export const ENDED_STATUSES = ['trial_ended', 'expired']
export const EDITABLE_STATUSES = ['trialing', 'active', 'trial_ended', 'expired']

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidDate(s) {
  const m = typeof s === 'string' && s.match(DATE_RE)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < 2020 || y > 2100) return false
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

export function commercialToday(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: COMMERCIAL_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now).filter(x => x.type !== 'literal').map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Duración inclusive en días (01/11 → 07/11 = 7). */
export function periodDays(starts, ends) {
  if (!isValidDate(starts) || !isValidDate(ends)) return null
  const ms = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((ms(ends) - ms(starts)) / 86400e3) + 1
}

export const fmtDay = (s) => (isValidDate(s) ? s.split('-').reverse().join('/') : '—')

/** Fin de un trial de N días que empieza en `starts`. */
export const trialEnd = (starts, days) => addDays(starts, days - 1)

/** Resumen para la tarjeta de la org: { type, range, status, tone } */
export function serviceSummary(org, now = new Date()) {
  const type = org?.service_type ?? 'manual'
  const range = type === 'manual'
    ? (isValidDate(org?.service_starts_at) ? `Desde ${fmtDay(org.service_starts_at)}` : 'Sin fecha de fin')
    : `${fmtDay(org?.service_starts_at)} → ${fmtDay(org?.service_ends_at)}`
  const ended = ENDED_STATUSES.includes(org?.status)
  let tone = ended ? 'ended' : 'ok'
  let note = null
  if (!ended && type !== 'manual' && isValidDate(org?.service_ends_at)) {
    const left = periodDays(commercialToday(now), org.service_ends_at)
    if (left !== null && left >= 1) {
      note = left === 1 ? 'Último día' : `${left} días restantes`
      if (left <= 7) tone = 'warn'
    }
  }
  return { type: SERVICE_TYPE_LABEL[type] ?? type, range, status: STATUS_LABEL[org?.status] ?? org?.status ?? '—', tone, note }
}

/** Formulario inicial a partir de la org. */
export function formFromOrg(org, now = new Date()) {
  const today = commercialToday(now)
  const type = org?.service_type ?? 'manual'
  return {
    service_type: type,
    service_starts_at: org?.service_starts_at ?? today,
    service_ends_at: org?.service_ends_at ?? '',
    reactivate: false,
  }
}

/**
 * Validación local (la autoridad es el Worker). → { field: mensaje } (vacío = OK)
 * `mustBeCurrent`: la org queda en servicio, así que el fin no puede ser pasado.
 */
export function validateServiceForm(f, { mustBeCurrent = true, now = new Date() } = {}) {
  const errors = {}
  if (!SERVICE_TYPE_LABEL[f.service_type]) return { service_type: 'Elegí Trial, Contrato o Sin vencimiento.' }
  if (f.service_starts_at && !isValidDate(f.service_starts_at)) errors.service_starts_at = 'Fecha de inicio inválida.'
  if (f.service_type === 'manual') return errors
  if (!f.service_starts_at) errors.service_starts_at = 'Ingresá la fecha de inicio.'
  if (!f.service_ends_at) errors.service_ends_at = 'Ingresá la fecha de finalización.'
  else if (!isValidDate(f.service_ends_at)) errors.service_ends_at = 'Fecha de finalización inválida.'
  if (!errors.service_starts_at && !errors.service_ends_at) {
    if (f.service_ends_at < f.service_starts_at) errors.service_ends_at = 'La fecha de finalización no puede ser anterior a la de inicio.'
    else if (mustBeCurrent && f.service_ends_at < commercialToday(now)) errors.service_ends_at = 'La fecha de finalización ya pasó.'
  }
  return errors
}

export function servicePayload(f) {
  const manual = f.service_type === 'manual'
  return {
    service_type: f.service_type,
    service_starts_at: f.service_starts_at || null,
    service_ends_at: manual ? null : (f.service_ends_at || null),
    ...(f.reactivate ? { reactivate: true } : {}),
  }
}

const ERRORS = {
  org_status_not_supported: 'La vigencia de una organización cancelada o con pago vencido no se edita desde acá.',
  already_active: 'La organización ya está activa.',
  conflict: 'La organización cambió mientras editabas. Actualizá y volvé a intentar.',
}

export async function updateService(scannerUrl, token, orgId, form, fetchImpl = fetch) {
  let status = 0, data = null
  try {
    const res = await fetchImpl(`${scannerUrl}/admin/organizations/${encodeURIComponent(orgId)}/service`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(servicePayload(form)),
    })
    status = res.status
    data = await res.json().catch(() => null)
  } catch { /* status 0 */ }
  if (status === 200 && data?.ok) return { ok: true, data }
  if (status === 0) return { ok: false, error: 'No pudimos conectar con el servicio. Intentá nuevamente.' }
  if (status === 401) return { ok: false, error: 'Tu sesión expiró. Volvé a iniciar sesión en el portal.' }
  if (status === 403) return { ok: false, error: data?.error === 'mfa_required' ? 'Volvé a verificar tu segundo factor.' : 'No tenés permisos de administrador.', reason: data?.error }
  if (status === 400 && data?.fields) return { ok: false, fields: data.fields, error: 'Revisá los datos marcados.' }
  return { ok: false, error: ERRORS[data?.error] ?? data?.message ?? data?.error ?? 'No se pudo guardar la vigencia.' }
}
