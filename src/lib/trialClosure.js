// Cierre de trials desde /admin. Toda acción pasa por el Worker (verifyAdmin).

// Qué acción comercial corresponde a cada estado: no mezclar "fin de prueba" con
// "baja de un cliente pago".
export function orgLifecycleActions(status) {
  if (status === 'trialing') return { endTrial: true, cancel: false }
  if (status === 'cancelled' || status === 'trial_ended') return { endTrial: false, cancel: false }
  return { endTrial: false, cancel: true }   // active, past_due
}

// Estado de entrega del informe final para el listado del admin
export function trialReportBadge(report) {
  if (!report) return null
  const when = report.delivered_at ? new Date(report.delivered_at).toLocaleDateString('es-AR') : null
  switch (report.delivery_status) {
    case 'sent': return { tone: 'ok', text: `Informe final enviado${when ? ` · ${when}` : ''}`, canResend: true, needsForce: true }
    case 'failed': return { tone: 'warn', text: 'Informe final NO enviado', canResend: true, needsForce: false }
    case 'sending': return { tone: 'info', text: 'Informe final enviándose…', canResend: true, needsForce: false }
    case 'pending': return { tone: 'warn', text: 'Informe final pendiente de envío', canResend: true, needsForce: false }
    case 'skipped': return { tone: 'info', text: 'Prueba cerrada sin enviar informe al cliente', canResend: false, needsForce: false }
    default: return { tone: 'info', text: report.delivery_status, canResend: false, needsForce: false }
  }
}

async function call(scannerUrl, token, path, { method = 'GET', body, fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(`${scannerUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const data = await res.json().catch(() => null)
    return { status: res.status, data }
  } catch {
    return { status: 0, data: null }
  }
}

const ERRORS = {
  org_not_trialing: 'La organización ya no está en período de prueba.',
  confirm_name_mismatch: 'El nombre no coincide con el de la organización.',
  already_sent: 'El informe ya fue enviado.',
}
const errorText = (r, fallback) =>
  r.status === 0 ? 'No pudimos conectar con el servicio. Intentá nuevamente.'
    : r.status === 401 ? 'Tu sesión expiró. Volvé a iniciar sesión en el portal.'
      : r.status === 403 ? 'No tenés permisos de administrador.'
        : ERRORS[r.data?.error] ?? r.data?.error ?? fallback

/** Datos del modal (no persiste nada). */
export async function fetchTrialPreview(scannerUrl, token, orgId, fetchImpl) {
  const r = await call(scannerUrl, token, `/admin/clients/${encodeURIComponent(orgId)}/end-trial/preview`, { fetchImpl })
  if (r.status === 200 && r.data?.ok && r.data.snapshot) return { ok: true, data: r.data }
  return { ok: false, error: errorText(r, 'No se pudo generar el informe del período. No se modificó nada.') }
}

export async function endTrial(scannerUrl, token, orgId, { confirmName, sendToCustomer, customerMessage }, fetchImpl) {
  const r = await call(scannerUrl, token, `/admin/clients/${encodeURIComponent(orgId)}/end-trial`, {
    method: 'POST', fetchImpl,
    body: { confirm_name: confirmName, send_to_customer: sendToCustomer, customer_message: customerMessage || null },
  })
  if (r.status === 200 && r.data?.ok) return { ok: true, data: r.data }
  return { ok: false, error: errorText(r, 'No se pudo finalizar la prueba.') }
}

export async function resendTrialReport(scannerUrl, token, reportId, { force = false } = {}, fetchImpl) {
  const r = await call(scannerUrl, token, `/admin/trial-reports/${encodeURIComponent(reportId)}/resend`, {
    method: 'POST', fetchImpl, body: { target: 'customer', force },
  })
  if (r.status === 200 && r.data?.ok) return { ok: true, data: r.data }
  return { ok: false, error: errorText(r, 'No se pudo reenviar el informe.') }
}

export const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
