// Estado de las tarjetas de "Superficie monitoreada" (tri-state real).
//
// Cada tarjeta mira los checks del scheduler que la alimentan (domain_check_state):
//   · estado efectivo de un check = last_status, salvo UNKNOWN: ahí se respeta el
//     último resultado válido (last_valid_status, misma regla que el score); si no
//     hay resultado válido previo → UNKNOWN (nunca PASS)
//   · un finding abierto de la categoría sigue mandando la severidad (crit/warn)
//
//   crit / warn → REVISAR       ok → OK (solo con PASS reales)
//   pending     → neutral (SIN DATOS / NO EVALUADO): UNKNOWN sin resultado válido o sin estado

// Tarjeta (SURFACE_AREAS.category) → check_ids del scheduler que la evalúan.
// Tarjetas sin checks del scheduler (p. ej. phishing) siguen solo con findings.
export const AREA_CHECKS = {
  email_security: ['spf', 'dmarc'],
  tls:            ['tls'],
  uptime:         ['uptime'],
  headers:        ['headers'],
  subdomains:     ['subdomains'],
  reputation:     ['urlscan'],
  exposure:       ['github'],
  darkweb:        ['darkweb'],
  typosquatting:  ['typosquatting'],
  ssl:            ['ssl'],
  technology:     ['tech'],
  ip_reputation:  ['ipreputation'],
  api:            ['apiexposure'],
}

export function effectiveCheckStatus(state) {
  if (!state || !state.last_status) return null                       // nunca evaluado
  if (state.last_status === 'pass' || state.last_status === 'fail') return state.last_status
  if (state.last_valid_status === 'pass' || state.last_valid_status === 'fail') return state.last_valid_status
  return 'unknown'
}

const sevOf = (findings) => {
  if (findings.some(f => f.severity === 'critical')) return 'crit'
  return 'warn'
}

/**
 * @returns {{ status: 'crit'|'warn'|'ok'|'pending', reason: null|'unknown'|'not_evaluated' }}
 */
export function surfaceAreaStatus(category, { findings = [], checkStates = [] } = {}) {
  const areaFindings = findings.filter(f => f.category === category)
  const checks = AREA_CHECKS[category]

  // Sin checks del scheduler: comportamiento anterior (solo findings)
  if (!checks) {
    if (areaFindings.length === 0) return { status: 'ok', reason: null }
    return { status: sevOf(areaFindings), reason: null }
  }

  const statuses = checks.map(id => effectiveCheckStatus(checkStates.find(s => s.check_id === id)))
  const failing = statuses.includes('fail')

  if (areaFindings.length > 0) return { status: sevOf(areaFindings), reason: null }
  if (failing) {
    const sev = checks.map(id => checkStates.find(s => s.check_id === id))
      .filter(s => effectiveCheckStatus(s) === 'fail')
      .map(s => s.last_status === 'fail' ? s.last_severity : s.last_valid_severity)
    return { status: sev.includes('critical') ? 'crit' : 'warn', reason: null }
  }
  if (statuses.includes('unknown')) return { status: 'pending', reason: 'unknown' }
  if (statuses.includes(null)) return { status: 'pending', reason: 'not_evaluated' }
  return { status: 'ok', reason: null }
}
