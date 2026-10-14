// Portal /admin: findings abiertos por dominio y detalle técnico read-only.
// Toda lectura pasa por el Worker (verifyAdmin); el portal nunca usa service key
// ni la sesión del cliente.

export const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

export function sortBySeverity(findings) {
  return (Array.isArray(findings) ? findings : []).slice()
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
}

export const FINDINGS_ERROR_TEXT = 'No se pudieron cargar los hallazgos abiertos'

/**
 * GET /admin/organizations/:orgId/findings (lazy load de "Ver hallazgos").
 * → { status: 'success', findings } | { status: 'error', error }
 * Un error NUNCA se convierte en lista vacía.
 */
export async function fetchOrgFindings(scannerUrl, token, orgId, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`${scannerUrl}/admin/organizations/${encodeURIComponent(orgId)}/findings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok && Array.isArray(data.findings)) return { status: 'success', findings: sortBySeverity(data.findings) }
    return { status: 'error', error: FINDINGS_ERROR_TEXT }
  } catch {
    return { status: 'error', error: FINDINGS_ERROR_TEXT }
  }
}

/**
 * Vista de los hallazgos de un dominio según el estado de carga de su org
 * (undefined = idle). Solo 'list' puede mostrar "Sin hallazgos abiertos".
 */
export function domainFindingsView(orgEntry, domainId) {
  if (!orgEntry || orgEntry.status === 'loading') return { kind: 'loading', text: 'Cargando hallazgos...' }
  if (orgEntry.status === 'error') return { kind: 'error', text: orgEntry.error || FINDINGS_ERROR_TEXT }
  return { kind: 'list', findings: sortBySeverity((orgEntry.findings || []).filter(f => f.domain_id === domainId)) }
}

// Texto del estado vacío de una lista ya cargada
export function emptyFindingsText(hasScan) {
  return hasScan ? 'Sin hallazgos abiertos' : 'Sin datos de scan disponibles'
}

const DETAIL_ERRORS = {
  401: 'Tu sesión expiró. Volvé a iniciar sesión en el portal.',
  403: 'No tenés permisos de administrador para ver este detalle.',
  404: 'El hallazgo ya no existe.',
}

/**
 * GET /admin/findings/:id/detail con el token del admin.
 * → { ok: true, data } | { ok: false, status, error }
 */
export async function fetchFindingDetail(scannerUrl, token, findingId, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`${scannerUrl}/admin/findings/${encodeURIComponent(findingId)}/detail`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok) return { ok: true, data }
    return { ok: false, status: res.status, error: DETAIL_ERRORS[res.status] ?? 'No pudimos cargar el detalle. Intentá nuevamente.' }
  } catch {
    return { ok: false, status: 0, error: 'No pudimos conectar con el servicio. Intentá nuevamente.' }
  }
}
