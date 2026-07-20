import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Wordmark from '../components/Wordmark'

const SCANNER_URL = import.meta.env.VITE_SCANNER_URL || 'https://scanner.franzthorres.workers.dev'
const PLAN_LIMITS = { advanced: 1, premium: 3, elite: 6 }

// ─── Design tokens (mismos que Dashboard) ───────────────────────────────────
const C = {
  bg:         '#080b12',
  card:       'rgba(20,27,46,.45)',
  cardSolid:  '#0d1526',
  border:     'rgba(130,150,220,.12)',
  borderHi:   'rgba(130,150,220,.22)',
  t1:         '#e8ecf5',
  t2:         '#9aa6c2',
  t3:         '#7f8aa6',
  accent:     '#5b6ef5',
  accentGrad: 'linear-gradient(135deg,#5b6ef5,#7c5bf5)',
  link:       '#8aa0ff',
  green:      '#3ddc84',
  greenText:  '#5fe39c',
  teal:       '#2fb8a8',
  amber:      '#f5b544',
  amberText:  '#f5c46b',
  red:        '#f2637e',
  title:      "'Space Grotesk',sans-serif",
  body:       "'Manrope',sans-serif",
  mono:       "'JetBrains Mono',monospace",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function scoreColor(s) {
  if (s == null) return { main: C.t3, glow: null }
  if (s >= 75)   return { main: C.green, glow: '#3ddc8450' }
  if (s >= 45)   return { main: C.amber, glow: '#f5b54450' }
  return           { main: C.red,   glow: '#f2637e50' }
}

function scoreBorderColor(s) {
  if (s == null) return C.t3
  if (s >= 75)   return C.green
  if (s >= 45)   return C.amber
  return           C.red
}

function scoreGrade(s) {
  if (s == null) return '—'
  return s >= 90 ? 'A' : s >= 75 ? 'B' : s >= 50 ? 'C' : s >= 30 ? 'D' : 'F'
}

function findingsColor(score, count) {
  if (count === 0) return C.greenText
  if (score >= 75) return C.greenText
  if (score >= 45) return C.amberText
  return C.red
}

function timeSince(dateStr) {
  if (!dateStr) return '—'
  const s = Math.floor((new Date() - new Date(dateStr)) / 1000)
  if (s < 60)    return 'hace un momento'
  if (s < 3600)  return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return `hace ${Math.floor(s / 86400)} días`
}

// ─── Íconos de línea (SVG) ───────────────────────────────────────────────────
function Icon({ name, size = 16, color = 'currentColor', sw = 1.5 }) {
  const paths = {
    'arrow-left':  <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>,
    'arrow-right': <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    'refresh-cw':  <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>,
    'trash':       <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></>,
    'pause':       <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>,
    'play':        <><polygon points="5 3 19 12 5 21 5 3"/></>,
    'plus':        <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    'shield':      <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    'alert':       <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      {paths[name] ?? null}
    </svg>
  )
}

// ─── Mini anillo de score (64×64) ────────────────────────────────────────────
const MINI_CIRC = 2 * Math.PI * 26

function MiniRing({ score }) {
  const col  = scoreColor(score)
  const pct  = typeof score === 'number' ? score / 100 : 0
  const dash = MINI_CIRC * pct
  return (
    <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
      <svg width="64" height="64" viewBox="0 0 64 64"
        style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx="32" cy="32" r="26" fill="none" stroke={C.border} strokeWidth="5" />
        <circle cx="32" cy="32" r="26" fill="none"
          stroke={col.main} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${dash} ${MINI_CIRC}`}
          style={{
            filter: col.glow ? `drop-shadow(0 0 5px ${col.glow})` : 'none',
            transition: 'stroke-dasharray .8s ease',
          }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: C.title, fontWeight: 700, fontSize: 14, color: col.main, lineHeight: 1 }}>
          {typeof score === 'number' ? score : '—'}
        </span>
        <span style={{ fontFamily: C.mono, fontSize: 10, color: col.main, lineHeight: 1.3 }}>
          {typeof score === 'number' ? scoreGrade(score) : ''}
        </span>
      </div>
    </div>
  )
}

// ─── Tarjeta de dominio ───────────────────────────────────────────────────────
function DomainCard({ d, onDetail, onScan, onDelete, scanning }) {
  const score     = d.lastScan?.score ?? null
  const col       = scoreColor(score)
  const border    = scoreBorderColor(score)
  const findings  = d.findingsCount ?? 0
  const isActive  = d.monitoring_active
  const isPrimary = d.is_primary

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '64px 1fr auto',
      gap: 20,
      alignItems: 'center',
      background: C.card,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${border}`,
      borderRadius: 14,
      padding: '20px 24px',
    }}>

      {/* Anillo de score */}
      <MiniRing score={score} />

      {/* Info central */}
      <div style={{ minWidth: 0 }}>
        {/* Nombre + badges */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          flexWrap: 'wrap', marginBottom: 10,
        }}>
          <span style={{
            fontFamily: C.title, fontWeight: 700, fontSize: 16, color: C.t1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {d.domain}
          </span>

          {/* Badge rol */}
          <span style={{
            fontFamily: C.mono, fontSize: 11, fontWeight: 600, letterSpacing: '.04em',
            padding: '3px 10px', borderRadius: 20,
            background: 'rgba(91,110,245,.12)',
            color: C.link,
            border: '1px solid rgba(91,110,245,.25)',
            whiteSpace: 'nowrap',
          }}>
            {isPrimary ? 'Principal' : 'Partner'}
          </span>

          {/* Badge estado: Sin verificar */}
          {!d.verified && (
            <span style={{
              fontFamily: C.mono, fontSize: 11, fontWeight: 600, letterSpacing: '.04em',
              padding: '3px 10px', borderRadius: 20,
              background: 'rgba(245,181,68,.1)',
              color: C.amberText,
              border: '1px solid rgba(245,181,68,.25)',
              whiteSpace: 'nowrap',
            }}>
              Sin verificar
            </span>
          )}

          {/* Badge estado: Proveedor */}
          {!isPrimary && (
            <span style={{
              fontFamily: C.mono, fontSize: 11, fontWeight: 600, letterSpacing: '.04em',
              padding: '3px 10px', borderRadius: 20,
              background: 'rgba(130,150,220,.08)',
              color: C.t3,
              border: '1px solid rgba(130,150,220,.15)',
              whiteSpace: 'nowrap',
            }}>
              Proveedor
            </span>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{
              fontFamily: C.mono, fontSize: 10, color: C.t3,
              textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3,
            }}>Hallazgos</div>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: findingsColor(score, findings),
            }}>
              {findings} abiertos
            </div>
          </div>

          <div>
            <div style={{
              fontFamily: C.mono, fontSize: 10, color: C.t3,
              textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3,
            }}>Último scan</div>
            <div style={{ fontSize: 13, color: C.t2 }}>
              {d.lastScan ? timeSince(d.lastScan.completed_at) : 'Sin scan'}
            </div>
          </div>

          <div>
            <div style={{
              fontFamily: C.mono, fontSize: 10, color: C.t3,
              textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3,
            }}>Monitoreo</div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 13,
              color: isActive ? C.greenText : C.amberText,
            }}>
              {isActive
                ? <><span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: `0 0 5px ${C.green}`, display: 'inline-block' }} /> Activo</>
                : <><Icon name="pause" size={12} color={C.amberText} sw={2} /> Pausado</>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Columna de acciones */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        alignItems: 'flex-end', flexShrink: 0,
      }}>
        <button
          onClick={onDetail}
          style={{
            fontFamily: C.title, fontWeight: 700, fontSize: 13,
            color: '#fff', background: C.accentGrad,
            border: 'none', padding: '9px 18px', borderRadius: 9,
            cursor: 'pointer', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          Ver detalle
          <Icon name="arrow-right" size={13} color="#fff" />
        </button>

        <button
          onClick={onScan}
          disabled={scanning}
          style={{
            fontFamily: C.title, fontWeight: 600, fontSize: 12,
            color: C.link, background: 'rgba(91,110,245,.08)',
            border: '1px solid rgba(91,110,245,.25)',
            padding: '7px 14px', borderRadius: 9,
            cursor: scanning ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 5,
            opacity: scanning ? .6 : 1,
          }}
        >
          <Icon name="refresh-cw" size={12} color={C.link} />
          {scanning ? 'Analizando…' : 'Analizar'}
        </button>

        {!isPrimary && (
          <button
            onClick={onDelete}
            style={{
              fontFamily: C.body, fontSize: 12,
              color: C.t3, background: 'none', border: 'none',
              cursor: 'pointer', padding: '4px 0',
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'color .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = C.red}
            onMouseLeave={e => e.currentTarget.style.color = C.t3}
          >
            <Icon name="trash" size={12} color="currentColor" />
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Domains() {
  const [org, setOrg]         = useState(null)
  const [domains, setDomains] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const [scanning, setScanning] = useState(null)
  const [form, setForm]       = useState({ domain: '', label: '' })
  const [error, setError]     = useState('')
  const [focused, setFocused] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    const { data: orgData } = await supabase
      .from('organizations').select('*').eq('id', user.id).single()
    if (orgData) setOrg(orgData)

    const { data: domainsData } = await supabase
      .from('domains').select('*').eq('org_id', user.id)
      .order('created_at', { ascending: true })

    if (domainsData) {
      const enriched = await Promise.all(domainsData.map(async (d) => {
        const { data: scans } = await supabase
          .from('scans').select('score, completed_at, status')
          .eq('domain_id', d.id).eq('status', 'completed')
          .order('created_at', { ascending: false }).limit(1)
        const { data: findings } = await supabase
          .from('findings').select('severity', { count: 'exact' })
          .eq('domain_id', d.id).eq('status', 'open')
        return { ...d, lastScan: scans?.[0] || null, findingsCount: findings?.length || 0 }
      }))
      setDomains(enriched)
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
    const cleanDomain = form.domain.toLowerCase()
      .replace(/^www\./, '').replace(/^https?:\/\//, '')
    setAdding(true)
    const { data: domainData, error: domainError } = await supabase
      .from('domains').insert({
        org_id: org.id, domain: cleanDomain,
        domain_type: 'supplier', domain_label: form.label || cleanDomain,
        verified: true, is_primary: false, monitoring_active: true,
      }).select().single()
    if (domainError) { setError('Error agregando el dominio.'); setAdding(false); return }
    try {
      await fetch(`${SCANNER_URL}/scan/dns`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: cleanDomain, org_id: org.id, domain_id: domainData.id }),
      })
    } catch { /* scan no bloqueante */ }
    setForm({ domain: '', label: '' })
    setAdding(false)
    await loadData()
  }

  async function handleScan(d) {
    setScanning(d.id)
    try {
      await fetch(`${SCANNER_URL}/scan/dns`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: d.domain, org_id: org.id, domain_id: d.id }),
      })
      await loadData()
    } catch { /* ignorar */ }
    setScanning(null)
  }

  async function handleDelete(d) {
    if (!confirm(`¿Eliminar ${d.domain}?`)) return
    await supabase.from('domains').delete().eq('id', d.id)
    await loadData()
  }

  const limit  = PLAN_LIMITS[org?.plan] || 1
  const canAdd = domains.length < limit

  const inputStyle = (field) => ({
    width: '100%',
    background: C.bg,
    border: `1px solid ${focused === field ? C.accent : C.border}`,
    borderRadius: 9,
    padding: '11px 14px',
    color: C.t1,
    fontSize: 14,
    outline: 'none',
    fontFamily: C.body,
    boxShadow: focused === field ? '0 0 0 3px rgba(91,110,245,.22)' : 'none',
    transition: 'border-color .15s, box-shadow .15s',
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Wordmark size={36} variant="outline" />
        </div>
        <p style={{ color: C.t3, fontSize: 14, fontFamily: C.body }}>Cargando dominios…</p>
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(ellipse at 50% 0%, #131a2c 0%, ${C.bg} 60%)`,
      fontFamily: C.body,
    }}>

      {/* ─── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{
        borderBottom: `1px solid ${C.border}`,
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(8,11,18,.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto', padding: '0 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 64, gap: 16,
        }}>
          {/* Izquierda: volver + logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: 'none',
                color: C.t3, fontSize: 13, fontFamily: C.body,
                cursor: 'pointer', padding: '4px 0',
                transition: 'color .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = C.t1}
              onMouseLeave={e => e.currentTarget.style.color = C.t3}
            >
              <Icon name="arrow-left" size={14} color="currentColor" />
              Dashboard
            </button>

            <div style={{ width: 1, height: 20, background: C.border }} />

            <Wordmark size={30} variant="solid" />
          </div>

          {/* Derecha: contador */}
          <div style={{
            fontFamily: C.mono, fontSize: 13, color: C.t2,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ color: C.t1, fontWeight: 700 }}>{domains.length}</span>
            <span>/</span>
            <span>{limit}</span>
            <span style={{ color: C.t3 }}>
              dominio{limit !== 1 ? 's' : ''} · Plan
            </span>
            <span style={{
              fontFamily: C.title, fontWeight: 700, fontSize: 12,
              color: C.link, background: 'rgba(91,110,245,.1)',
              border: '1px solid rgba(91,110,245,.22)',
              padding: '2px 8px', borderRadius: 6,
            }}>
              {org?.plan ? org.plan.charAt(0).toUpperCase() + org.plan.slice(1) : '—'}
            </span>
          </div>
        </div>
      </header>

      {/* ─── CONTENIDO ──────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '36px 20px 72px' }}>

        {/* Encabezado */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontFamily: C.title, fontWeight: 700, fontSize: 26,
            color: C.t1, marginBottom: 8, lineHeight: 1.2,
          }}>
            Mis dominios
          </h1>
          <p style={{ fontSize: 15, color: C.t2, lineHeight: 1.5 }}>
            Monitoreá tu dominio y el de tus proveedores clave.
          </p>
        </div>

        {/* Lista de tarjetas */}
        {domains.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '56px 24px',
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 16, marginBottom: 20,
          }}>
            <Icon name="shield" size={36} color={C.t3} />
            <p style={{ fontSize: 15, color: C.t2, marginTop: 16 }}>
              No hay dominios configurados todavía.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
            {domains.map((d) => (
              <DomainCard
                key={d.id}
                d={d}
                scanning={scanning === d.id}
                onDetail={() => navigate(`/dashboard?domain=${d.id}`)}
                onScan={() => handleScan(d)}
                onDelete={() => handleDelete(d)}
              />
            ))}
          </div>
        )}

        {/* ─── AGREGAR DOMINIO ──────────────────────────────────────────────── */}
        {canAdd ? (
          <div style={{
            background: C.card,
            border: `1px dashed ${C.borderHi}`,
            borderRadius: 16, padding: '28px 28px',
          }}>
            <h3 style={{
              fontFamily: C.title, fontWeight: 700, fontSize: 16,
              color: C.t1, marginBottom: 6,
            }}>
              Agregar dominio proveedor
            </h3>
            <p style={{ fontSize: 13, color: C.t2, marginBottom: 22, lineHeight: 1.5 }}>
              Monitoreá la seguridad de tus proveedores clave como si fueran propios.
            </p>

            <form
              onSubmit={handleAddDomain}
              style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}
            >
              <div style={{ flex: '2 1 200px' }}>
                <label style={{
                  display: 'block', fontSize: 12, color: C.t2,
                  fontFamily: C.body, marginBottom: 7,
                }}>
                  Dominio del proveedor
                </label>
                <input
                  style={inputStyle('domain')}
                  placeholder="proveedor.com"
                  value={form.domain}
                  onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                  onFocus={() => setFocused('domain')}
                  onBlur={() => setFocused(null)}
                  required
                />
              </div>

              <div style={{ flex: '3 1 240px' }}>
                <label style={{
                  display: 'block', fontSize: 12, color: C.t2,
                  fontFamily: C.body, marginBottom: 7,
                }}>
                  Nombre / etiqueta (opcional)
                </label>
                <input
                  style={inputStyle('label')}
                  placeholder="Ej: Banco XYZ, Hosting principal"
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  onFocus={() => setFocused('label')}
                  onBlur={() => setFocused(null)}
                />
              </div>

              <div style={{ flexShrink: 0 }}>
                <button
                  type="submit"
                  disabled={adding}
                  style={{
                    fontFamily: C.title, fontWeight: 700, fontSize: 14,
                    color: '#fff', background: adding ? 'rgba(91,110,245,.5)' : C.accentGrad,
                    border: 'none', padding: '11px 22px', borderRadius: 10,
                    cursor: adding ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}
                >
                  <Icon name="plus" size={15} color="#fff" />
                  {adding ? 'Agregando…' : 'Agregar y analizar'}
                </button>
              </div>
            </form>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16,
                background: 'rgba(242,99,126,.08)', border: '1px solid rgba(242,99,126,.25)',
                borderRadius: 10, padding: '12px 16px',
              }}>
                <Icon name="alert" size={15} color={C.red} sw={1.8} />
                <p style={{ fontSize: 13, color: C.red, margin: 0, lineHeight: 1.5 }}>{error}</p>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: 'rgba(91,110,245,.05)',
            border: `1px solid rgba(91,110,245,.2)`,
            borderRadius: 16, padding: '28px 28px', textAlign: 'center',
          }}>
            <Icon name="shield" size={28} color={C.link} />
            <p style={{ fontSize: 15, color: C.t1, marginTop: 14, marginBottom: 6 }}>
              Alcanzaste el límite de tu plan{' '}
              <b style={{ color: C.link, fontFamily: C.title }}>
                {org?.plan ? org.plan.charAt(0).toUpperCase() + org.plan.slice(1) : ''}
              </b>
            </p>
            <p style={{ fontSize: 13, color: C.t2, marginBottom: 20, lineHeight: 1.6 }}>
              Actualizá a Elite para monitorear hasta 6 dominios, o contactanos para un plan personalizado.
            </p>
            <a
              href="mailto:hola@fenikso.io"
              style={{
                fontFamily: C.title, fontWeight: 700, fontSize: 14,
                color: '#fff', background: C.accentGrad,
                padding: '11px 24px', borderRadius: 10,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7,
              }}
            >
              Hablar con un especialista
              <Icon name="arrow-right" size={14} color="#fff" />
            </a>
          </div>
        )}
      </main>
    </div>
  )
}
