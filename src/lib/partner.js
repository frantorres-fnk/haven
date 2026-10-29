// Partner Hub V1 — cliente del Worker. La autoridad es el Worker (verifyPartner:
// JWT + membresía activa + Partner activo + aal2 + rol + relación con la org). Lo de
// acá es solo UX: qué mostrar según el rol y mensajes legibles. Nunca se manda
// partner_id: el Worker lo deriva de la sesión.
import { supabase } from './supabase'

export const SCANNER_URL = import.meta.env.VITE_SCANNER_URL || 'https://scanner.franzthorres.workers.dev'

export const ROLE_LABEL = { partner_owner: 'Owner', partner_admin: 'Admin', partner_analyst: 'Analista', partner_sales: 'Comercial' }
export const ROLES = Object.keys(ROLE_LABEL)
export const PARTNER_TRIAL_MAX_DAYS = 7
export const PARTNER_TRIAL_DOMAIN_LIMIT = 6
export const LOGO_MAX_BYTES = 512 * 1024
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']
export const HEX_RE = /^#[0-9A-Fa-f]{6}$/
export const DEFAULT_ACCENT = '#5B6EF5'

/** El permiso viene del Worker (/partner/me → permissions). */
export const can = (me, perm) => !!me?.user?.permissions?.includes(perm)

/** Color de acento seguro: solo #RRGGBB; cualquier otra cosa → el de HAVEN. */
export const safeAccent = (c) => (HEX_RE.test(String(c ?? '')) ? c : DEFAULT_ACCENT)

export function validateLogoFile(file) {
  if (!file) return 'Elegí un archivo.'
  if (!LOGO_TYPES.includes(file.type)) return 'Formatos admitidos: PNG, JPG o WEBP.'
  if (file.size > LOGO_MAX_BYTES) return 'El logo puede pesar hasta 512 KB.'
  return null
}

const ERRORS = {
  not_partner: 'Tu cuenta no tiene acceso al Partner Hub.',
  partner_suspended: 'El acceso de tu Partner al Partner Hub está suspendido. Contactá a FENIKSO.',
  partner_inactive: 'El acceso de tu Partner al Partner Hub no está activo. Contactá a FENIKSO.',
  mfa_required: 'Verificá tu segundo factor para continuar.',
  forbidden_role: 'Tu rol no permite esta acción.',
  client_not_found: 'Cliente no encontrado.',
  password_change_required: 'Tenés que cambiar tu contraseña temporal antes de continuar.',
  request_pending: 'Ya hay una solicitud pendiente para este cliente.',
  invite_pending: 'Ya hay una invitación pendiente para ese email.',
  already_member: 'Esa persona ya es parte del equipo.',
  cannot_modify_self: 'No podés cambiar tu propio rol o estado.',
  last_owner: 'El Partner tiene que tener al menos un owner activo.',
  domain_taken: 'Ese dominio ya es el dominio principal de otra organización.',
  org_name_taken: 'Ya existe una organización con ese nombre.',
  owner_has_other_org: 'Ese email ya pertenece a otra organización de HAVEN.',
  client_conflict: 'No se pudo crear el cliente: alguno de los datos ya está en uso en HAVEN. Si corresponde, contactá a FENIKSO.',
  client_quota_exceeded: 'Alcanzaste el límite de altas por día. Contactá a FENIKSO si necesitás más.',
  email_not_confirmed: 'Confirmá tu email antes de aceptar la invitación.',
  relation_inactive: 'El Partner ya no gestiona esta organización.',
  not_allowed_for_partner: 'Eso lo define FENIKSO. Usá "Solicitar extensión / activación".',
}
export const errorText = (code, fallback = 'No se pudo completar la operación.') => ERRORS[code] ?? fallback

async function token() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

/** → { status, data } (status 0 = sin conexión) */
export async function api(method, path, body, { fetchImpl = fetch, raw = false, headers = {} } = {}) {
  try {
    const t = await token()
    const res = await fetchImpl(`${SCANNER_URL}${path}`, {
      method,
      headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(raw ? {} : body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body !== undefined ? { body: raw ? body : JSON.stringify(body) } : {}),
    })
    return { status: res.status, data: await res.json().catch(() => null) }
  } catch {
    return { status: 0, data: null }
  }
}

/** Mensaje para la UI a partir de una respuesta fallida. */
export function failure(r, fallback) {
  if (r.status === 0) return 'No pudimos conectar con el servicio. Intentá nuevamente.'
  if (r.status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión.'
  return r.data?.message ?? errorText(r.data?.error, fallback)
}

export const partnerApi = {
  me: () => api('GET', '/partner/me'),
  dashboard: () => api('GET', '/partner/dashboard'),
  client: (id) => api('GET', `/partner/organizations/${encodeURIComponent(id)}`),
  clientPart: (id, part) => api('GET', `/partner/organizations/${encodeURIComponent(id)}/${part}`),
  createClient: (form) => api('POST', '/partner/organizations', {
    name: String(form.name ?? '').trim(), owner_name: String(form.ownerName ?? '').trim(),
    owner_email: String(form.ownerEmail ?? '').trim(), primary_domain: String(form.domain ?? '').trim(),
    trial_days: Number(form.trialDays) || PARTNER_TRIAL_MAX_DAYS,
  }),
  requests: () => api('GET', '/partner/requests'),
  requestCapacity: (orgId, requestedLimit, reason) => api('POST', '/partner/capacity-requests', { organization_id: orgId, requested_limit: requestedLimit, reason }),
  requestService: (orgId, type, message) => api('POST', '/partner/service-requests', { organization_id: orgId, request_type: type, message }),
  cancelRequest: (kind, id) => api('POST', `/partner/${kind === 'capacity' ? 'capacity' : 'service'}-requests/${encodeURIComponent(id)}/cancel`),
  team: () => api('GET', '/partner/team'),
  invite: (email, role, fullName) => api('POST', '/partner/team/invite', { email, role, full_name: fullName }),
  updateMember: (id, patch) => api('PUT', `/partner/team/${encodeURIComponent(id)}`, patch),
  revokeInvite: (id) => api('POST', `/partner/team/invites/${encodeURIComponent(id)}/revoke`),
  branding: () => api('GET', '/partner/branding'),
  saveBranding: (patch) => api('PUT', '/partner/branding', patch),
  uploadLogo: (file) => api('PUT', '/partner/branding/logo', file, { raw: true, headers: { 'Content-Type': file.type } }),
  deleteLogo: () => api('DELETE', '/partner/branding/logo'),
  inviteInfo: (t) => api('GET', `/partner-invites/info?token=${encodeURIComponent(t)}`),
  acceptInvite: (t) => api('POST', '/partner-invites/accept', { token: t }),
}

export const adminPartnerApi = {
  list: () => api('GET', '/admin/partners'),
  create: (form) => api('POST', '/admin/partners', form),
  update: (id, patch) => api('PUT', `/admin/partners/${encodeURIComponent(id)}`, patch),
  invite: (id, body) => api('POST', `/admin/partners/${encodeURIComponent(id)}/invites`, body),
  revokeInvite: (id, inviteId) => api('POST', `/admin/partners/${encodeURIComponent(id)}/invites/${encodeURIComponent(inviteId)}/revoke`),
  updateUser: (id, memberId, patch) => api('PUT', `/admin/partners/${encodeURIComponent(id)}/users/${encodeURIComponent(memberId)}`, patch),
  associate: (id, organizationId, relationshipType) => api('POST', `/admin/partners/${encodeURIComponent(id)}/organizations`, { organization_id: organizationId, relationship_type: relationshipType }),
  disassociate: (id, organizationId) => api('DELETE', `/admin/partners/${encodeURIComponent(id)}/organizations/${encodeURIComponent(organizationId)}`),
  reviewCapacity: (id, decision, note) => api('POST', `/admin/capacity-requests/${encodeURIComponent(id)}/review`, { decision, note }),
  reviewService: (id, decision, note) => api('POST', `/admin/service-requests/${encodeURIComponent(id)}/review`, { decision, note }),
}

// ─── Presentación ────────────────────────────────────────────────────────────

export const STATUS_LABEL = { trialing: 'Trial', active: 'Activo', trial_ended: 'Trial finalizado', expired: 'Vencido', cancelled: 'Cancelado', past_due: 'Pago pendiente' }
export const SERVICE_LABEL = { trial: 'Trial', contract: 'Contrato', manual: 'Sin vencimiento' }
export const REQUEST_STATUS_LABEL = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Cancelada' }
export const SERVICE_REQUEST_LABEL = { trial_extension: 'Extensión de trial', activation: 'Activación / contrato' }

export const fmtDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

export function vigenciaText(c) {
  if (c.service_type === 'manual') return 'Sin vencimiento'
  if (!c.service_ends_at) return '—'
  if (c.ended) return `Finalizó el ${fmtDate(c.service_ends_at)}`
  if (c.days_left === 0) return 'Último día'
  if (c.days_left != null) return `${c.days_left} ${c.days_left === 1 ? 'día' : 'días'} · hasta ${fmtDate(c.service_ends_at)}`
  return `Hasta ${fmtDate(c.service_ends_at)}`
}

export const CLIENT_FILTERS = [
  { key: 'all', label: 'Todos', test: () => true },
  { key: 'active', label: 'Activos', test: (c) => c.status === 'active' || c.status === 'trialing' },
  { key: 'trial', label: 'Trial', test: (c) => c.service_type === 'trial' && c.status === 'trialing' },
  { key: 'ended', label: 'Vencidos', test: (c) => !!c.ended },
  { key: 'expiring', label: 'Próximos a vencer', test: (c) => !!c.expiring_soon },
]
export const filterClients = (clients, key) => (clients ?? []).filter(CLIENT_FILTERS.find(f => f.key === key)?.test ?? (() => true))
