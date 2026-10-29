import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { partnerApi, failure, can, fmtDate, REQUEST_STATUS_LABEL, SERVICE_REQUEST_LABEL } from '../../lib/partner'
import { Card, Button, Pill, Empty, SectionTitle, Notice } from './ui'
import { K, th, td } from './tokens'

const tone = { pending: 'warn', approved: 'good', rejected: 'bad', cancelled: 'neutral' }

export default function PartnerRequests({ me }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    const r = await partnerApi.requests()
    if (r.status === 200 && r.data?.ok) { setData(r.data); setError('') } else setError(failure(r, 'No se pudieron cargar las solicitudes.'))
  }, [])
  useEffect(() => { load() }, [load])

  async function cancel(kind, id) {
    const r = await partnerApi.cancelRequest(kind, id)
    if (r.status === 200) load()
    else setError(failure(r, 'No se pudo cancelar la solicitud.'))
  }

  const rows = data ? [
    ...data.capacity_requests.map(r => ({ ...r, kind: 'capacity', what: `Capacidad ${r.current_limit} → ${r.requested_limit}${r.status === 'approved' && r.applied_limit ? ` (aplicada: ${r.applied_limit})` : ''}`, detail: r.reason })),
    ...data.service_requests.map(r => ({ ...r, kind: 'service', what: SERVICE_REQUEST_LABEL[r.request_type] ?? r.request_type, detail: r.message })),
  ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))) : []

  return (
    <div>
      <SectionTitle>Solicitudes</SectionTitle>
      <p style={{ color: K.t2, fontSize: 13, margin: '0 0 16px' }}>Capacidad, extensiones y activaciones las aprueba FENIKSO.</p>
      {error && <Notice>{error}</Notice>}
      {!data && !error && <Empty>Cargando…</Empty>}
      {data && rows.length === 0 && <Empty>Sin solicitudes todavía. Se crean desde el detalle de cada cliente.</Empty>}
      {rows.length > 0 && (
        <Card style={{ padding: 0 }}>
          <div className="ph-scroll"><table className="ph-table">
            <thead><tr><th style={th}>Cliente</th><th style={th}>Solicitud</th><th style={th}>Estado</th><th style={th}>Pedida</th><th style={th}>Respuesta</th><th style={th} /></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={`${r.kind}-${r.id}`}>
                <td style={td}>{r.associated ? <Link to={`/partner/clients/${r.organization_id}`} style={{ color: K.t1 }}>{r.organization_name}</Link> : <span style={{ color: K.t3 }}>Cliente desasociado</span>}</td>
                <td style={td}>{r.what}{r.detail && <div style={{ color: K.t3, fontSize: 12, marginTop: 4 }}>{r.detail}</div>}</td>
                <td style={td}><Pill tone={tone[r.status]}>{REQUEST_STATUS_LABEL[r.status] ?? r.status}</Pill></td>
                <td style={{ ...td, color: K.t3 }}>{fmtDate(r.created_at)}<div style={{ fontSize: 11.5 }}>{r.requested_by_email}</div></td>
                <td style={{ ...td, color: K.t2 }}>{r.reviewed_at ? fmtDate(r.reviewed_at) : '—'}{r.review_note && <div style={{ color: K.t3, fontSize: 12 }}>{r.review_note}</div>}</td>
                <td style={td}>{r.status === 'pending' && can(me, 'requests.create') && <Button small variant="ghost" onClick={() => cancel(r.kind, r.id)}>Cancelar</Button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}
    </div>
  )
}
