import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SCANNER_URL = import.meta.env.VITE_SCANNER_URL || 'https://scanner.franzthorres.workers.dev'

const PLAN_LIMITS = { advanced: 1, premium: 3, elite: 6 }

export default function Domains() {
  const [org, setOrg] = useState(null)
  const [domains, setDomains] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [scanning, setScanning] = useState(null)
  const [form, setForm] = useState({ domain: '', label: '' })
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    const { data: orgData } = await supabase.from('organizations').select('*').eq('id', user.id).single()
    if (orgData) setOrg(orgData)

    const { data: domainsData } = await supabase
      .from('domains').select('*').eq('org_id', user.id).order('created_at', { ascending: true })

    if (domainsData) {
      const domainsWithScans = await Promise.all(domainsData.map(async (d) => {
        const { data: scans } = await supabase
          .from('scans').select('score, completed_at, status')
          .eq('domain_id', d.id).eq('status', 'completed')
          .order('created_at', { ascending: false }).limit(1)
        const { data: findings } = await supabase
          .from('findings').select('severity', { count: 'exact' })
          .eq('domain_id', d.id).eq('status', 'open')
        return { ...d, lastScan: scans?.[0] || null, findingsCount: findings?.length || 0 }
      }))
      setDomains(domainsWithScans)
    }
    setLoading(false)
  }

  async function handleAddDomain(e) {
    e.preventDefault()
    setError('')
    const limit = PLAN_LIMITS[org?.plan] || 1
    const supplierCount = domains.filter(d => d.domain_type === 'supplier').length
    if (supplierCount >= limit - 1) {
      setError(`Tu plan ${org?.plan?.toUpperCase()} permite hasta ${limit} dominio(s) en total. Actualizá tu plan para agregar más.`)
      return
    }

    const cleanDomain = form.domain.toLowerCase().replace(/^www\./, '').replace(/^https?:\/\//, '')
    setAdding(true)

    const { data: domainData, error: domainError } = await supabase.from('domains').insert({
      org_id: org.id,
      domain: cleanDomain,
      domain_type: 'supplier',
      domain_label: form.label || cleanDomain,
      verified: true,
      is_primary: false,
      monitoring_active: true,
    }).select().single()

    if (domainError) { setError('Error agregando el dominio'); setAdding(false); return }

    try {
      await fetch(`${SCANNER_URL}/scan/dns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: cleanDomain, org_id: org.id, domain_id: domainData.id })
      })
    } catch (e) { console.error('Error corriendo scan:', e) }

    setForm({ domain: '', label: '' })
    setAdding(false)
    await loadData()
  }

  async function handleScan(d) {
    setScanning(d.id)
    try {
      await fetch(`${SCANNER_URL}/scan/dns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: d.domain, org_id: org.id, domain_id: d.id })
      })
      await loadData()
    } catch (e) { console.error('Error:', e) }
    setScanning(null)
  }

  async function handleDelete(d) {
    if (!confirm(`¿Eliminar ${d.domain}?`)) return
    await supabase.from('domains').delete().eq('id', d.id)
    await loadData()
  }

  const limit = PLAN_LIMITS[org?.plan] || 1
  const canAdd = domains.length < limit

  const scoreColor = (s) => !s ? '#5E6C87' : s >= 90 ? '#4ADE80' : s >= 70 ? '#4F7EFF' : s >= 50 ? '#FBBF24' : '#FB6B6B'
  const scoreRating = (s) => !s ? '—' : s >= 90 ? 'A' : s >= 70 ? 'B' : s >= 50 ? 'C' : s >= 30 ? 'D' : 'F'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080C18', display: 'grid', placeItems: 'center' }}>
      <p style={{ color: '#5E6C87', fontSize: 14 }}>Cargando dominios...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#080C18' }}>
      {/* TOPBAR */}
      <header style={{ borderBottom: '1px solid #1A2240', position: 'sticky', top: 0, zIndex: 20, background: 'rgba(8,12,24,.85)', backdropFilter: 'blur(14px)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: '#5E6C87', cursor: 'pointer', fontSize: 13, fontFamily: 'Inter,sans-serif' }}>← Dashboard</button>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ width: 22, height: 3, background: '#4F7EFF', borderRadius: 2, marginBottom: 3 }} />
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: '.08em', color: '#EDF1F8' }}>HAVEN</div>
            </div>
          </div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, color: '#93A1BC' }}>
            {domains.length} / {limit} dominio{limit !== 1 ? 's' : ''} · Plan {org?.plan?.toUpperCase()}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 24, color: '#EDF1F8', marginBottom: 6 }}>Mis dominios</h1>
            <p style={{ fontSize: 14, color: '#93A1BC' }}>Monitoreá tu dominio y el de tus proveedores clave</p>
          </div>
        </div>

        {/* DOMAIN CARDS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
          {domains.map((d) => (
            <div key={d.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 20, alignItems: 'center', background: '#0C1220', border: `1px solid ${d.is_primary ? '#1A2240' : '#1A2240'}`, borderLeft: `3px solid ${d.is_primary ? '#4F7EFF' : '#5E6C87'}`, borderRadius: 14, padding: '20px 24px' }}>

              {/* Score ring mini */}
              <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
                <svg style={{ transform: 'rotate(-90deg)', width: 64, height: 64 }} viewBox="0 0 64 64">
                  <circle fill="none" stroke="#1A2240" strokeWidth="6" cx="32" cy="32" r="26"/>
                  <circle fill="none" stroke={scoreColor(d.lastScan?.score)} strokeWidth="6" strokeLinecap="round"
                    cx="32" cy="32" r="26"
                    strokeDasharray={`${163 * (d.lastScan?.score || 0) / 100} 163`}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, color: scoreColor(d.lastScan?.score), lineHeight: 1 }}>
                    {d.lastScan?.score || '—'}
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 10, color: scoreColor(d.lastScan?.score) }}>
                    {scoreRating(d.lastScan?.score)}
                  </div>
                </div>
              </div>

              {/* Info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, color: '#EDF1F8' }}>{d.domain}</span>
                  {d.domain_label && d.domain_label !== d.domain && (
                    <span style={{ fontSize: 12, color: '#5E6C87', background: '#131B2C', padding: '3px 10px', borderRadius: 20 }}>{d.domain_label}</span>
                  )}
                  <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", padding: '3px 10px', borderRadius: 20, ...(d.is_primary ? { background: 'rgba(79,126,255,.12)', color: '#4F7EFF' } : { background: '#131B2C', color: '#5E6C87' }) }}>
                    {d.is_primary ? 'Principal' : 'Proveedor'}
                  </span>
                  {!d.verified && (
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", padding: '3px 10px', borderRadius: 20, background: 'rgba(251,191,36,.1)', color: '#FBBF24' }}>Sin verificar</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#5E6C87', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '.1em' }}>Hallazgos</div>
                    <div style={{ fontSize: 14, color: d.findingsCount > 0 ? '#FBBF24' : '#4ADE80', fontWeight: 600, marginTop: 2 }}>{d.findingsCount} abiertos</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#5E6C87', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '.1em' }}>Último scan</div>
                    <div style={{ fontSize: 14, color: '#93A1BC', marginTop: 2 }}>{d.lastScan ? timeSince(d.lastScan.completed_at) : 'Sin scan'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#5E6C87', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '.1em' }}>Monitoreo</div>
                    <div style={{ fontSize: 14, color: d.monitoring_active ? '#4ADE80' : '#5E6C87', marginTop: 2 }}>{d.monitoring_active ? '✅ Activo' : '⏸ Pausado'}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                <button onClick={() => navigate(`/dashboard?domain=${d.id}`)} style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 13, color: '#080C18', background: '#4F7EFF', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Ver detalle →
                </button>
                <button onClick={() => handleScan(d)} disabled={scanning === d.id} style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 12, color: '#4F7EFF', background: 'rgba(79,126,255,.1)', border: '1px solid rgba(79,126,255,.3)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {scanning === d.id ? 'Analizando...' : '⟳ Analizar'}
                </button>
                {!d.is_primary && (
                  <button onClick={() => handleDelete(d)} style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: '#5E6C87', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* AGREGAR DOMINIO */}
        {canAdd ? (
          <div style={{ background: '#0C1220', border: '1px dashed #1A2240', borderRadius: 14, padding: '24px' }}>
            <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 16, color: '#EDF1F8', marginBottom: 6 }}>Agregar dominio proveedor</h3>
            <p style={{ fontSize: 13, color: '#93A1BC', marginBottom: 20 }}>Monitoreá la seguridad de tus proveedores clave como si fueran propios.</p>
            <form onSubmit={handleAddDomain} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#93A1BC', marginBottom: 6 }}>Dominio del proveedor</label>
                <input style={s.input} placeholder="proveedor.com" value={form.domain}
                  onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} required />
              </div>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#93A1BC', marginBottom: 6 }}>Nombre / etiqueta (opcional)</label>
                <input style={s.input} placeholder="Ej: Banco XYZ, Hosting principal" value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="submit" disabled={adding} style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, color: '#080C18', background: '#4F7EFF', border: 'none', padding: '11px 20px', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {adding ? 'Agregando...' : '+ Agregar y analizar'}
                </button>
              </div>
            </form>
            {error && <p style={{ fontSize: 13, color: '#FB6B6B', marginTop: 12, background: 'rgba(251,107,107,.1)', padding: '10px 14px', borderRadius: 8 }}>{error}</p>}
          </div>
        ) : (
          <div style={{ background: 'rgba(79,126,255,.06)', border: '1px solid rgba(79,126,255,.2)', borderRadius: 14, padding: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: '#EDF1F8', marginBottom: 8 }}>Alcanzaste el límite de dominios de tu plan <b style={{ color: '#4F7EFF' }}>{org?.plan?.toUpperCase()}</b></p>
            <p style={{ fontSize: 13, color: '#93A1BC', marginBottom: 16 }}>Actualizá a Elite para monitorear hasta 6 dominios, o contactanos para un plan personalizado.</p>
            <a href="mailto:hola@fenikso.io" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, color: '#080C18', background: '#4F7EFF', padding: '11px 24px', borderRadius: 9, textDecoration: 'none' }}>Hablar con un especialista →</a>
          </div>
        )}
      </main>
    </div>
  )
}

function timeSince(dateStr) {
  if (!dateStr) return '—'
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000)
  if (seconds < 60) return 'hace un momento'
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`
  return `hace ${Math.floor(seconds / 86400)} d`
}

const s = {
  input: { width: '100%', background: '#080C18', border: '1px solid #1A2240', borderRadius: 9, padding: '11px 14px', color: '#EDF1F8', fontSize: 14, outline: 'none', fontFamily: 'Inter,sans-serif' },
}
