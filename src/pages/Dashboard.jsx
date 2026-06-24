import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SCANNER_URL = import.meta.env.VITE_SCANNER_URL || 'https://scanner.franzthorres.workers.dev'

export default function Dashboard() {
  const [org, setOrg] = useState(null)
  const [domain, setDomain] = useState(null)
  const [scan, setScan] = useState(null)
  const [findings, setFindings] = useState([])
  const [view, setView] = useState('owner')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    const { data: orgData } = await supabase
      .from('organizations').select('*').eq('id', user.id).single()

    const { data: domainData } = await supabase
      .from('domains').select('*').eq('org_id', user.id).eq('is_primary', true).single()

    if (orgData) setOrg(orgData)
    if (domainData) {
      setDomain(domainData)
      await loadLatestScan(domainData.id, orgData.id)
    }
    setLoading(false)
  }

  async function loadLatestScan(domain_id, org_id) {
    const { data: scans } = await supabase
      .from('scans')
      .select('*')
      .eq('domain_id', domain_id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)

    if (scans && scans.length > 0) {
      setScan(scans[0])
      const { data: findingsData } = await supabase
        .from('findings')
        .select('*')
        .eq('scan_id', scans[0].id)
        .eq('status', 'open')
        .order('severity', { ascending: true })
      setFindings(findingsData || [])
    }
  }

  async function runScan() {
    if (!domain || !org) return
    setScanning(true)
    try {
      const res = await fetch(`${SCANNER_URL}/scan/dns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domain.domain,
          org_id: org.id,
          domain_id: domain.id,
          org_name: org.name,
          org_email: org.email,
        })
      })
      const data = await res.json()
      if (data.ok) {
        await loadLatestScan(domain.id, org.id)
      }
    } catch (e) {
      console.error('Error corriendo scan:', e)
    }
    setScanning(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const score = scan?.score || 0
  const hasCritical = findings.some(f => f.severity === 'critical')
  const hasHigh = findings.some(f => f.severity === 'high')
  const stateColor = hasCritical ? '#FB6B6B' : hasHigh ? '#FBBF24' : score >= 90 ? '#34D399' : '#FBBF24'
  const stateLabel = hasCritical ? 'Acción inmediata' : hasHigh ? 'Atención requerida' : score >= 90 ? 'Protegido' : 'Atención requerida'
  const stateLabelPlain = hasCritical ? 'Hay problemas críticos que resolver ya' : hasHigh ? 'Vas bien, con tareas pendientes' : 'Tu empresa está protegida'
  const circumference = 402

  const areaStatus = (category) => {
    const f = findings.filter(f => f.category === category)
    if (f.some(x => x.severity === 'critical')) return 'crit'
    if (f.some(x => x.severity === 'high' || x.severity === 'medium')) return 'warn'
    return 'ok'
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0A0F1C', display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: '24px', color: '#2DD4BF', marginBottom: '12px' }}>HAVEN<span style={{ color: '#2DD4BF' }}>.</span></div>
        <p style={{ color: '#5E6C87', fontSize: '14px' }}>Cargando tu portal...</p>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      {/* TOPBAR */}
      <header style={s.header}>
        <div style={s.wrap}>
          <div style={s.topbar}>
            <div style={s.brand}>
              <div style={s.brandMark}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06231f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div>
                <div style={s.brandName}>HAVEN<span style={{ color: '#2DD4BF' }}>.</span></div>
                <div style={s.brandBy}>by Fenikso</div>
              </div>
            </div>
            <div style={s.topRight}>
              {domain && (
                <div style={s.domainChip}>
                  <span style={s.dot} />
                  {domain.domain}
                </div>
              )}
              <div style={s.roleSwitch}>
                <button style={{ ...s.roleBtn, ...(view === 'owner' ? s.roleBtnOn : {}) }} onClick={() => setView('owner')}>Dueño</button>
                <button style={{ ...s.roleBtn, ...(view === 'tech' ? s.roleBtnOn : {}) }} onClick={() => setView('tech')}>Técnico</button>
              </div>
              <button style={s.scanBtn} onClick={runScan} disabled={scanning}>
                {scanning ? '⟳ Escaneando...' : '⟳ Escanear'}
              </button>
              <button style={s.logoutBtn} onClick={handleLogout}>Salir</button>
            </div>
          </div>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.wrap}>

          {/* NO SCAN YET */}
          {!scan && !scanning && (
            <div style={s.noScan}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🛡️</div>
              <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, marginBottom: 8, color: '#EDF1F8' }}>Tu dominio está listo para ser analizado</h2>
              <p style={{ color: '#93A1BC', fontSize: 14, marginBottom: 24 }}>Corré el primer scan para ver el estado real de tu empresa.</p>
              <button style={s.btnPrimary} onClick={runScan}>Iniciar primer scan →</button>
            </div>
          )}

          {/* SCANNING */}
          {scanning && (
            <div style={s.noScan}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
              <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, marginBottom: 8, color: '#2DD4BF' }}>Analizando {domain?.domain}...</h2>
              <p style={{ color: '#93A1BC', fontSize: 14 }}>Chequeando SPF, DMARC, TLS y exposición. Un momento.</p>
            </div>
          )}

          {/* DASHBOARD CON DATOS REALES */}
          {scan && !scanning && (
            <>
              {/* HERO */}
              <section style={s.hero}>
                <div style={s.ringWrap}>
                  <svg style={{ transform: 'rotate(-90deg)', width: 150, height: 150 }} viewBox="0 0 150 150">
                    <circle fill="none" stroke="#25304A" strokeWidth="9" cx="75" cy="75" r="64" />
                    <circle fill="none" stroke={stateColor} strokeWidth="9" strokeLinecap="round"
                      cx="75" cy="75" r="64"
                      strokeDasharray={`${circumference * score / 100} ${circumference}`}
                      style={{ filter: `drop-shadow(0 0 6px ${stateColor})` }}
                    />
                  </svg>
                  <div style={s.ringCenter}>
                    <div style={{ ...s.ringScore, color: stateColor }}>{score}<small style={{ fontSize: 13, color: '#5E6C87' }}>/100</small></div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: '#5E6C87', textTransform: 'uppercase', letterSpacing: '.14em', marginTop: 4 }}>Protección</div>
                  </div>
                </div>

                <div style={s.heroText}>
                  <div style={s.eyebrow}><span style={s.liveDot} />Monitoreo activo · sin interrupción</div>
                  {view === 'owner' ? (
                    <>
                      <h1 style={{ ...s.heroTitle, color: stateColor }}>{stateLabelPlain}</h1>
                      <p style={s.heroSub}>
                        {findings.length === 0
                          ? 'Tu superficie digital está limpia. Te avisamos si algo cambia.'
                          : `Encontramos ${findings.length} punto${findings.length > 1 ? 's' : ''} que conviene resolver.`}
                      </p>
                    </>
                  ) : (
                    <>
                      <h1 style={{ ...s.heroTitle, color: stateColor }}>{stateLabel} · Score {score}/100</h1>
                      <p style={s.heroSub}>Superficie externa monitoreada · {findings.length} finding{findings.length !== 1 ? 's' : ''} open · último scan hace {timeSince(scan.completed_at)}</p>
                    </>
                  )}
                  <div style={s.heroMeta}>
                    <div><div style={s.metaK}>Último scan</div><div style={s.metaV}>hace <b style={{ color: '#2DD4BF' }}>{timeSince(scan.completed_at)}</b></div></div>
                    <div><div style={s.metaK}>Hallazgos</div><div style={s.metaV}><b style={{ color: stateColor }}>{findings.length}</b> abiertos</div></div>
                    <div><div style={s.metaK}>Plan</div><div style={s.metaV}>{org?.plan?.toUpperCase()}</div></div>
                    <div><div style={s.metaK}>Trial</div><div style={s.metaV}><b style={{ color: '#2DD4BF' }}>{daysLeft(org?.trial_ends_at)} días</b> restantes</div></div>
                  </div>
                </div>
              </section>

              {/* AREAS */}
              <div style={s.secHead}>
                <h2 style={s.secTitle}>Áreas bajo vigilancia</h2>
                <span style={s.secCount}>4 monitoreadas · 24/7</span>
              </div>
              <div style={s.areas}>
                {[
                  { icon: '🔑', label: 'Credenciales', category: 'credentials', plain: 'Filtraciones en internet', tech: 'breach monitoring · HIBP' },
                  { icon: '✉️', label: 'Correo', category: 'email_security', plain: 'Protección del correo', tech: 'SPF · DKIM · DMARC' },
                  { icon: '🔒', label: 'Certificado TLS', category: 'tls', plain: 'Cifrado de tu web', tech: 'TLS · HTTPS · cert expiry' },
                  { icon: '🔍', label: 'OSINT / Perímetro', category: 'osint', plain: 'Exposición pública', tech: 'surface · subdomains · ports' },
                ].map((a, i) => {
                  const status = areaStatus(a.category)
                  const areaFindings = findings.filter(f => f.category === a.category)
                  return (
                    <div key={i} style={s.areaCard}>
                      <div style={s.areaTop}>
                        <span style={{ fontSize: 20 }}>{a.icon}</span>
                        <span style={{ ...s.pill, ...(status === 'ok' ? s.pillOk : status === 'warn' ? s.pillWarn : s.pillCrit) }}>
                          {status === 'ok' ? 'OK' : status === 'warn' ? 'Revisar' : 'Crítico'}
                        </span>
                      </div>
                      <div style={s.areaLabel}>{a.label}</div>
                      <div style={s.areaNote}>
                        {view === 'owner'
                          ? (areaFindings.length > 0 ? areaFindings[0].title_plain : a.plain)
                          : (areaFindings.length > 0 ? areaFindings[0].description_tech : a.tech)
                        }
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* FINDINGS */}
              <div style={s.secHead}>
                <h2 style={s.secTitle}>Alertas activas</h2>
                <span style={s.secCount}>{findings.length} {findings.length === 1 ? 'abierta' : 'abiertas'}</span>
              </div>

              {findings.length === 0 ? (
                <div style={s.allClear}>
                  <span style={{ fontSize: 24 }}>✅</span>
                  <p style={{ color: '#93A1BC', fontSize: 14, margin: 0 }}>Sin alertas abiertas. Tu superficie está limpia y bajo monitoreo continuo.</p>
                </div>
              ) : (
                <div style={s.findingsList}>
                  {findings.map((f, i) => (
                    <div key={i} style={{ ...s.finding, borderLeftColor: f.severity === 'critical' ? '#FB6B6B' : f.severity === 'high' ? '#FB6B6B' : '#FBBF24' }}>
                      <span style={{ ...s.sevBadge, ...(f.severity === 'critical' || f.severity === 'high' ? s.sevCrit : s.sevWarn) }}>
                        {f.severity === 'critical' ? 'Crítico' : f.severity === 'high' ? 'Alto' : 'Medio'}
                      </span>
                      <div style={s.findingBody}>
                        <div style={s.findingTitle}>{view === 'owner' ? f.title_plain : f.title_tech}</div>
                        <div style={s.findingDesc}>{view === 'owner' ? f.description_plain : f.description_tech}</div>
                        <div style={s.findingFix}>→ {view === 'owner' ? f.action_plain : f.action_tech}</div>
                        {view === 'tech' && f.reference && <div style={{ ...s.findingFix, color: '#2DD4BF', marginTop: 4 }}>{f.reference}</div>}
                      </div>
                      <div style={s.findingWhen}>{timeSince(f.first_seen_at)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* DOMAIN NOT VERIFIED */}
              {domain && !domain.verified && (
                <div style={s.verifyBanner}>
                  <span>⚠️</span>
                  <p style={{ fontSize: 14, color: '#93A1BC', margin: 0 }}>
                    <b style={{ color: '#EDF1F8' }}>Verificá tu dominio</b> para activar el monitoreo automático. Revisá tu mail en <b style={{ color: '#2DD4BF' }}>{org?.email}</b>.
                  </p>
                </div>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  )
}

// ============================================================
// UTILS
// ============================================================
function timeSince(dateStr) {
  if (!dateStr) return '—'
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000)
  if (seconds < 60) return 'hace un momento'
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`
  return `hace ${Math.floor(seconds / 86400)} d`
}

function daysLeft(dateStr) {
  if (!dateStr) return 0
  return Math.max(0, Math.ceil((new Date(dateStr) - new Date()) / 86400000))
}

// ============================================================
// STYLES
// ============================================================
const s = {
  page: { minHeight: '100vh', background: '#0A0F1C' },
  wrap: { maxWidth: 1080, margin: '0 auto', padding: '0 24px' },
  header: { borderBottom: '1px solid #1E2840', position: 'sticky', top: 0, zIndex: 20, background: 'rgba(10,15,28,.85)', backdropFilter: 'blur(14px)' },
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 66, gap: 12 },
  brand: { display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 },
  brandMark: { width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(145deg,#2DD4BF,#119e8e)', display: 'grid', placeItems: 'center' },
  brandName: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: '.04em', color: '#EDF1F8' },
  brandBy: { fontSize: 10, color: '#5E6C87', letterSpacing: '.18em', textTransform: 'uppercase', marginTop: -2 },
  topRight: { display: 'flex', alignItems: 'center', gap: 10 },
  domainChip: { display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: '#93A1BC', padding: '7px 13px', border: '1px solid #25304A', borderRadius: 8, background: '#131B2C' },
  dot: { width: 7, height: 7, borderRadius: '50%', background: '#34D399', boxShadow: '0 0 8px #34D399', display: 'inline-block' },
  roleSwitch: { display: 'flex', background: '#131B2C', border: '1px solid #25304A', borderRadius: 10, padding: 3 },
  roleBtn: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 13, color: '#93A1BC', background: 'none', border: 'none', padding: '7px 14px', borderRadius: 8, cursor: 'pointer' },
  roleBtnOn: { background: '#2DD4BF', color: '#06231f' },
  scanBtn: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 13, color: '#2DD4BF', background: 'rgba(45,212,191,.1)', border: '1px solid rgba(45,212,191,.3)', padding: '7px 14px', borderRadius: 8, cursor: 'pointer' },
  logoutBtn: { fontFamily: 'Inter,sans-serif', fontSize: 13, color: '#5E6C87', background: 'none', border: '1px solid #25304A', padding: '7px 14px', borderRadius: 8, cursor: 'pointer' },
  main: { padding: '40px 0 64px' },
  noScan: { textAlign: 'center', padding: '80px 24px', border: '1px solid #1E2840', borderRadius: 20, background: '#131B2C', marginBottom: 28 },
  btnPrimary: { background: '#2DD4BF', color: '#06231f', border: 'none', borderRadius: 10, padding: '13px 28px', fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", cursor: 'pointer' },
  hero: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 38, alignItems: 'center', background: 'linear-gradient(180deg,#131B2C,transparent)', border: '1px solid #1E2840', borderRadius: 20, padding: '34px 38px', marginBottom: 28 },
  ringWrap: { position: 'relative', width: 150, height: 150, flexShrink: 0 },
  ringCenter: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  ringScore: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 30, lineHeight: 1 },
  heroText: {},
  eyebrow: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#5E6C87', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: '50%', background: '#2DD4BF', display: 'inline-block' },
  heroTitle: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 32, letterSpacing: '-.01em', lineHeight: 1.1, marginBottom: 10 },
  heroSub: { color: '#93A1BC', fontSize: 15, marginBottom: 20, maxWidth: '48ch', lineHeight: 1.5 },
  heroMeta: { display: 'flex', gap: 28, flexWrap: 'wrap' },
  metaK: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: '#5E6C87' },
  metaV: { fontSize: 14, color: '#EDF1F8', marginTop: 4, fontWeight: 500 },
  secHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '32px 0 14px' },
  secTitle: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 15, color: '#EDF1F8' },
  secCount: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: '#5E6C87' },
  areas: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 13, marginBottom: 4 },
  areaCard: { background: '#131B2C', border: '1px solid #1E2840', borderRadius: 14, padding: '18px 18px 16px' },
  areaTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pill: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 500, letterSpacing: '.06em', padding: '4px 8px', borderRadius: 20, textTransform: 'uppercase' },
  pillOk: { background: 'rgba(52,211,153,.12)', color: '#34D399' },
  pillWarn: { background: 'rgba(251,191,36,.13)', color: '#FBBF24' },
  pillCrit: { background: 'rgba(251,107,107,.13)', color: '#FB6B6B' },
  areaLabel: { fontSize: 14, fontWeight: 600, color: '#EDF1F8', marginBottom: 4 },
  areaNote: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: '#5E6C87' },
  findingsList: { display: 'flex', flexDirection: 'column', gap: 11 },
  finding: { display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'start', background: '#131B2C', border: '1px solid #1E2840', borderLeftWidth: 3, borderRadius: 13, padding: '16px 20px' },
  sevBadge: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 500, letterSpacing: '.1em', padding: '5px 9px', borderRadius: 6, textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sevCrit: { background: 'rgba(251,107,107,.13)', color: '#FB6B6B' },
  sevWarn: { background: 'rgba(251,191,36,.13)', color: '#FBBF24' },
  findingBody: {},
  findingTitle: { fontSize: 14, fontWeight: 600, color: '#EDF1F8', marginBottom: 4 },
  findingDesc: { fontSize: 13, color: '#93A1BC', lineHeight: 1.5 },
  findingFix: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: '#5E6C87', marginTop: 6 },
  findingWhen: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#5E6C87', textAlign: 'right', whiteSpace: 'nowrap' },
  allClear: { display: 'flex', alignItems: 'center', gap: 14, background: '#131B2C', border: '1px solid #1E2840', borderRadius: 13, padding: '22px 24px' },
  verifyBanner: { display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 12, padding: '16px 20px', marginTop: 20 },
}