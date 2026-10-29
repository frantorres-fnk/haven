// Capacidad de dominios por organización. La autoridad es el backend:
// organizations.domain_limit (única fuente de verdad, el plan legacy no interviene)
// + trigger de la DB + Worker (PUT /admin/organizations/:id/capacity, verifyAdmin + aal2).
// Acá solo se lee, se valida para ayudar y se muestra.

export const MAX_DOMAIN_LIMIT = 1000   // mismo tope que el Worker (src/capacity.js)

export const CAPACITY_REQUEST_MAILTO =
  `mailto:hola@fenikso.io?subject=${encodeURIComponent('Solicitud de ampliación de capacidad HAVEN')}`

/** Capacidad de la org: domain_limit tal cual. Sin valor válido → 0 (nunca un default por plan). */
export function getOrganizationDomainLimit(org) {
  const n = org?.domain_limit
  return Number.isInteger(n) && n >= 1 ? n : 0
}

/** Error de validación del formulario Admin, o null. `raw` es el texto del input. */
export function validateDomainLimit(raw, domainCount = 0) {
  const s = String(raw ?? '').trim()
  if (!/^\d+$/.test(s)) return 'Ingresá un número entero.'
  const n = Number(s)
  if (n < 1) return 'El límite mínimo es 1 dominio.'
  if (n > MAX_DOMAIN_LIMIT) return `El límite máximo es ${MAX_DOMAIN_LIMIT} dominios.`
  if (n < domainCount) return `El nuevo límite no puede ser menor que la cantidad de dominios existentes (${domainCount}).`
  return null
}

export async function updateCapacity(scannerUrl, token, orgId, domainLimit, fetchImpl = fetch) {
  let status = 0, data = null
  try {
    const res = await fetchImpl(`${scannerUrl}/admin/organizations/${encodeURIComponent(orgId)}/capacity`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain_limit: domainLimit }),
    })
    status = res.status
    data = await res.json().catch(() => null)
  } catch { /* status 0 */ }
  if (status === 200 && data?.ok) return { ok: true, data }
  if (status === 0) return { ok: false, error: 'No pudimos conectar con el servicio. Intentá nuevamente.' }
  if (status === 401) return { ok: false, error: 'Tu sesión expiró. Volvé a iniciar sesión en el portal.' }
  if (status === 403) return { ok: false, error: data?.error === 'mfa_required' ? 'Volvé a verificar tu segundo factor.' : 'No tenés permisos de administrador.', reason: data?.error }
  return { ok: false, error: data?.message ?? data?.error ?? 'No se pudo guardar la capacidad.' }
}
