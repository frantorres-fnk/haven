// Alta de clientes desde /admin. El Worker (verifyAdmin) decide todo lo sensible:
// el frontend solo manda datos del cliente y la vigencia; plan, rol, status u org
// nunca salen del navegador (el status lo deriva el Worker del tipo de servicio).
import { commercialToday, trialEnd, servicePayload } from './serviceLifecycle'

export const DEFAULT_TRIAL_DAYS = 30

/** Vigencia inicial del alta: trial de 30 días desde hoy (editable). */
export function defaultServiceForm(now = new Date()) {
  const start = commercialToday(now)
  return { service_type: 'trial', service_starts_at: start, service_ends_at: trialEnd(start, DEFAULT_TRIAL_DAYS) }
}

export function provisioningPayload(form) {
  const { service_type, service_starts_at, service_ends_at } = servicePayload({
    service_type: form.service_type, service_starts_at: form.service_starts_at, service_ends_at: form.service_ends_at,
  })
  return {
    name: String(form.name ?? '').trim(),
    owner_name: String(form.ownerName ?? '').trim(),
    owner_email: String(form.ownerEmail ?? '').trim(),
    primary_domain: String(form.domain ?? '').trim(),
    service_type, service_starts_at, service_ends_at,
  }
}

const CONFLICTS = {
  domain_taken: 'Ese dominio ya es el dominio principal de otra organización.',
  org_name_taken: 'Ya existe una organización con ese nombre.',
  owner_has_other_org: 'Ese email ya pertenece a otra organización de HAVEN.',
  password_already_set: 'El owner ya definió su contraseña: no se puede regenerar.',
}

async function post(scannerUrl, token, path, body, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`${scannerUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: res.status, data: await res.json().catch(() => null) }
  } catch {
    return { status: 0, data: null }
  }
}

function errorOf(r, fallback) {
  if (r.status === 0) return 'No pudimos conectar con el servicio. Intentá nuevamente.'
  if (r.status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión en el portal.'
  if (r.status === 403) return 'No tenés permisos de administrador.'
  return CONFLICTS[r.data?.error] ?? r.data?.message ?? r.data?.error ?? fallback
}

export async function createClient(scannerUrl, token, form, fetchImpl) {
  const r = await post(scannerUrl, token, '/admin/organizations', provisioningPayload(form), fetchImpl)
  if ((r.status === 200 || r.status === 201) && r.data?.ok) return { ok: true, data: r.data }
  if (r.status === 400 && r.data?.fields) return { ok: false, fields: r.data.fields, error: 'Revisá los datos marcados.' }
  return { ok: false, error: errorOf(r, 'No se pudo crear el cliente.') }
}

export async function resendClientAccess(scannerUrl, token, orgId, { regeneratePassword = false } = {}, fetchImpl) {
  const r = await post(scannerUrl, token, `/admin/organizations/${encodeURIComponent(orgId)}/resend-access`, { regenerate_password: regeneratePassword }, fetchImpl)
  if (r.status === 200 && r.data?.ok) return { ok: true, data: r.data }
  return { ok: false, error: errorOf(r, 'No se pudo reenviar el acceso.') }
}

// Texto para "Copiar acceso" (se arma en el momento; no se guarda en ningún lado)
export function accessText({ loginUrl, email, tempPassword, expiresAt }) {
  return [
    `Ingreso: ${loginUrl}`,
    `Usuario: ${email}`,
    ...(tempPassword ? [`Contraseña temporal: ${tempPassword}`] : []),
    ...(expiresAt ? [`Vence: ${new Date(expiresAt).toLocaleString('es-AR')}`] : []),
    'Al primer ingreso vas a definir tu propia contraseña.',
  ].join('\n')
}
