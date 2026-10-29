import { useEffect, useState } from 'react'
import { api } from '../lib/partner'

// Tenant Portal: identificación discreta cuando un Partner gestiona la organización.
// Solo marca pública (nombre/logo) de la org del propio usuario (GET /account/managed-by).
// Ante cualquier error no muestra nada: el portal funciona igual que siempre.
export default function ManagedBy({ fetchImpl }) {
  const [partner, setPartner] = useState(null)
  useEffect(() => {
    let cancelled = false
    api('GET', '/account/managed-by', undefined, fetchImpl ? { fetchImpl } : {})
      .then(r => { if (!cancelled && r.status === 200 && r.data?.partner?.display_name) setPartner(r.data.partner) })
    return () => { cancelled = true }
  }, [fetchImpl])
  if (!partner) return null
  return (
    <div data-testid="managed-by" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 14, borderLeft: '1px solid rgba(130,150,220,.14)', minWidth: 0 }}>
      {partner.logo_url && <img src={partner.logo_url} alt="" style={{ height: 22, maxWidth: 80, objectFit: 'contain' }} />}
      <div style={{ lineHeight: 1.25, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: '#9aa6c2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Gestionado por <strong style={{ color: '#e8ecf5' }}>{partner.display_name}</strong></div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#7f8aa6', letterSpacing: '.14em', textTransform: 'uppercase' }}>Powered by HAVEN</div>
      </div>
    </div>
  )
}
