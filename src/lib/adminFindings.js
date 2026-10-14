// Portal /admin: findings abiertos por dominio y detalle técnico read-only.
// Toda lectura pasa por el Worker (verifyAdmin); el portal nunca usa service key
// ni la sesión del cliente.

export const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

export function sortBySeverity(findings) {
  return (Array.isArray(findings) ? findings : []).slice()
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
}

// Findings abiertos de un dominio. null = no se pudieron leer (findings_error):
// el portal no debe afirmar "sin hallazgos" en ese caso.
export function findingsForDomain(data, domainId) {
  if (!Array.isArray(data?.findings)) return null
  return sortBySeverity(data.findings.filter(f => f.domain_id === domainId))
}

// Texto del estado vacío / error de la lista de hallazgos de un dominio
export function emptyFindingsText(findings, hasScan) {
  if (findings === null) return 'No se pudieron cargar los hallazgos abiertos'
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
