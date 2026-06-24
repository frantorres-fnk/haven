import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SCANNER_URL = import.meta.env.VITE_SCANNER_URL || 'https://scanner.franzthorres.workers.dev'

const FRAMEWORKS = {
  fintech: {
    badge: 'BCRA · Com. A 7724',
    sub: 'Lineamientos de ciberseguridad y resiliencia operacional',
    controls: [
      { code: 'A7724·4.2', name: 'Detección de fuga de credenciales', plain: 'Vigilar si las contraseñas de la empresa se filtran.', category: 'credentials' },
      { code: 'A7724·3.5', name: 'Protección de canales digitales', plain: 'Tu web y servicios viajan cifrados.', category: 'tls' },
      { code: 'A7724·3.6', name: 'Higiene del correo institucional', plain: 'Evitar que imiten el correo de la empresa.', category: 'email_security' },
      { code: 'A7724·5.1', name: 'Gestión de superficie expuesta', plain: 'Que no queden puertas abiertas a internet.', category: 'osint' },
      { code: 'A7724·4.4', name: 'Prevención de suplantación de marca', plain: 'Detectar sitios falsos que copian tu marca.', category: 'brand' },
    ]
  },
  ecommerce: {
    badge: 'PCI DSS v4.0',
    sub: 'Estándar de seguridad para datos de tarjetas',
    controls: [
      { code: 'PCI·Req4', name: 'Cifrado de datos en tránsito', plain: 'Los pagos viajan protegidos.', category: 'tls' },
      { code: 'PCI·Req2', name: 'Configuraciones seguras', plain: 'Tu sitio no expone configuración de fábrica.', category: 'osint' },
      { code: 'PCI·Req6', name: 'Sistemas y software seguros', plain: 'Tecnología sin agujeros conocidos.', category: 'technology' },
      { code: 'PCI·Req8', name: 'Autenticación de accesos', plain: 'Las llaves de acceso no deben estar expuestas.', category: 'credentials' },
      { code: 'PCI·Req11', name: 'Pruebas de seguridad continuas', plain: 'Se revisa tu exposición todo el tiempo.', category: 'osint' },
    ]
  },
  health: {
    badge: 'Ley 25.326 · Datos personales',
    sub: 'Protección de datos personales y sensibles',
    controls: [
      { code: '25326·Art9a', name: 'Medidas de seguridad técnicas', plain: 'Los datos viajan cifrados.', category: 'tls' },
      { code: '25326·Art9b', name: 'Control de acceso a la información', plain: 'Solo quien debe accede a los datos.', category: 'credentials' },
      { code: '25326·Art9c', name: 'Protección de canales de contacto', plain: 'Que no suplanten el correo con datos de pacientes.', category: 'email_security' },
      { code: '25326·Art7', name: 'Exposición de datos sensibles', plain: 'Que no queden sistemas con datos abiertos.', category: 'osint' },
    ]
  },
  government: {
    badge: 'ISO 27001 · NIST CSF',
    sub: 'Gestión de seguridad de la información',
    controls: [
      { code: 'ISO·A.9', name: 'Control de accesos', plain: 'Gestión de quién accede a qué sistemas.', category: 'credentials' },
      { code: 'ISO·A.10', name: 'Cifrado de información', plain: 'Los datos viajan y se guardan protegidos.', category: 'tls' },
      { code: 'ISO·A.13', name: 'Seguridad de comunicaciones', plain: 'Las comunicaciones institucionales están protegidas.', category: 'email_security' },
      { code: 'NIST·PR.IP', name: 'Gestión de superficie expuesta', plain: 'Reducir la exposición pública de sistemas.', category: 'osint' },
      { code: 'NIST·DE.CM', name: 'Monitoreo continuo', plain: 'Vigilancia permanente de la infraestructura.', category: 'osint' },
    ]
  },
  general: {
    badge: 'CIS Controls v8',
    sub: 'Controles críticos de ciberseguridad',
    controls: [
      { code: 'CIS·C3', name: 'Protección de datos', plain: 'Los datos de la empresa están protegidos.', category: 'tls' },
      { code: 'CIS·C5', name: 'Gestión de credenciales', plain: 'Las contraseñas de la empresa son seguras.', category: 'credentials' },
      { code: 'CIS·C9', name: 'Protección del correo', plain: 'El correo institucional no puede ser suplantado.', category: 'email_security' },
      { code: 'CIS·C12', name: 'Gestión de superficie', plain: 'Reducir lo que está expuesto a internet.', category: 'osint' },
    ]
  },
}

function getDataLaw(domain) {
  if (!domain) return null
  const tld = domain.split('.').slice(-2).join('.').toLowerCase()
  const map = {
    'com.py': { law: 'Ley N° 6534/2020', country: 'Paraguay', flag: '🇵🇾' },
    'com.ar': { law: 'Ley 25.326', country: 'Argentina', flag: '🇦🇷' },
    'ar': { law: 'Ley 25.326', country: 'Argentina', flag: '🇦🇷' },
    'com.br': { law: 'LGPD', country: 'Brasil', flag: '🇧🇷' },
    'br': { law: 'LGPD', country: 'Brasil', flag: '🇧🇷' },
    'cl': { law: 'Ley 19.628', country: 'Chile', flag: '🇨🇱' },
    'com.co': { law: 'Ley 1581', country: 'Colombia', flag: '🇨🇴' },
    'co': { law: 'Ley 1581', country: 'Colombia', flag: '🇨🇴' },
    'mx': { law: 'LFPDPPP', country: 'México', flag: '🇲🇽' },
    'com.mx': { law: 'LFPDPPP', country: 'México', flag: '🇲🇽' },
    'es': { law: 'RGPD / LOPDGDD', country: 'España', flag: '🇪🇸' },
    'eu': { law: 'GDPR', country: 'Unión Europea', flag: '🇪🇺' },
    'com.uy': { law: 'Ley 18.331', country: 'Uruguay', flag: '🇺🇾' },
    'uy': { law: 'Ley 18.331', country: 'Uruguay', flag: '🇺🇾' },
  }
  return map[tld] || null
}

export default function Dashboard() {
  const [org, setOrg] = useState(null)
  const [domain, setDomain] = useState(null)
  const [scan, setScan] = useState(null)
  const [findings, setFindings] = useState([])
  const [view, setView] = useState('owner')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
    // Chequear si viene de Stripe
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') {
      alert('🎉 ¡Suscripción activada! Bienvenido a HAVEN.')
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

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
      .from('scans').select('*').eq('domain_id', domain_id)
      .eq('status', 'completed').order('created_at', { ascending: false }).limit(1)

    if (scans && scans.length > 0) {
      setScan(scans[0])
      const { data: findingsData } = await supabase
        .from('findings').select('*').eq('scan_id', scans[0].id)
        .eq('status', 'open').order('severity', { ascending: true })
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
          domain: domain.domain, org_id: org.id, domain_id: domain.id,
          org_name: org.name, org_email: org.email,
        })
      })
      const data = await res.json()
      if (data.ok) await loadLatestScan(domain.id, org.id)
    } catch (e) {
      console.error('Error corriendo scan:', e)
    }
    setScanning(false)
  }

  async function handleCheckout() {
    if (!org) return
    setCheckingOut(true)
    try {
      const res = await fetch(`${SCANNER_URL}/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: org.id,
          email: org.email,
          plan: org.plan || 'advanced',
          domain: domain?.domain,
        })
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (e) {
      console.error('Error creando checkout:', e)
    }
    setCheckingOut(false)
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
  const isTrial = org?.status === 'trialing'
  const trialDaysLeft = daysLeft(org?.trial_ends_at)

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

  const framework = FRAMEWORKS[org?.industry] || FRAMEWORKS.general
  const compControls = framework.controls.map(c => ({
    ...c, ok: !findings.some(f => f.category === c.category)
  }))
  const compHit = compControls.filter(c => c.ok).length
  const compTot = compControls.length
  const compPct = Math.round(compHit / compTot * 100)
  const dataLaw = getDataLaw(domain?.domain)

  return (
    <div style={s.page}>
      {/* TOPBAR */}
      <header style={s.header}>
        <div style={s.wrap}>
          <div style={s.topbar}>
          <div style={s.brand}>
  <svg width="30" height="35" viewBox="0 0 120 138" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 0 L100 0 Q120 0 120 22 L120 68 Q120 105 60 120 Q0 105 0 68 L0 22 Q0 0 20 0 Z" fill="#2DD4BF"/>
    <rect x="22" y="28" width="18" height="64" fill="#06231f" rx="3"/>
    <rect x="80" y="28" width="18" height="64" fill="#06231f" rx="3"/>
    <rect x="22" y="56" width="76" height="14" fill="#06231f" rx="2"/>
  </svg>
  <div style={s.brandName}>HAVEN<span style={{ color: '#2DD4BF' }}>.</span></div>
</div>
            <div style={s.topRight}>
              {domain && (
                <div style={s.domainChip}>
                  <span style={s.dot} />{domain.domain}
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

          {/* TRIAL BANNER */}
          {isTrial && (
            <div style={s.trialBanner}>
              <div>
                <b style={{ color: '#EDF1F8' }}>Estás en prueba gratuita</b>
                <span style={{ color: '#93A1BC', fontSize: 13, marginLeft: 8 }}>
                  {trialDaysLeft > 0 ? `Te quedan ${trialDaysLeft} días` : 'Tu trial venció hoy'}
                </span>
              </div>
              <button style={s.trialBtn} onClick={handleCheckout} disabled={checkingOut}>
                {checkingOut ? 'Redirigiendo...' : `Activar plan ${org?.plan?.toUpperCase() || 'ADVANCED'} · $${org?.plan === 'elite' ? '299' : org?.plan === 'premium' ? '199' : '99'}/mes →`}
              </button>
            </div>
          )}

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
                    <div><div style={s.metaK}>Trial</div><div style={s.metaV}><b style={{ color: '#2DD4BF' }}>{trialDaysLeft} días</b> restantes</div></div>
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
                          : (areaFindings.length > 0 ? areaFindings[0].description_tech : a.tech)}
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

              {/* COMPLIANCE PANEL */}
              <div style={{ marginTop: 32 }}>
                <div style={s.secHead}>
                  <h2 style={s.secTitle}>
                    Postura de cumplimiento
                    <span style={s.frameBadge}>{framework.badge}</span>
                  </h2>
                </div>
                <div style={s.compCard}>
                  <div style={s.compTop}>
                    <div style={{ flex: 1 }}>
                      <div style={s.compBarLabel}>
                        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 20 }}>
                          <b style={{ color: '#2DD4BF' }}>{compHit}</b> de {compTot} controles cubiertos
                        </span>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: '#5E6C87' }}>
                          {compTot - compHit} pendiente{compTot - compHit !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={s.compBar}><div style={{ ...s.compFill, width: `${compPct}%` }} /></div>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#5E6C87', marginTop: 8 }}>{framework.sub}</div>
                    </div>
                    <div style={s.compRing}>
                      <svg style={{ transform: 'rotate(-90deg)', width: 80, height: 80 }} viewBox="0 0 80 80">
                        <circle fill="none" stroke="#25304A" strokeWidth="7" cx="40" cy="40" r="33" />
                        <circle fill="none" stroke="#2DD4BF" strokeWidth="7" strokeLinecap="round"
                          cx="40" cy="40" r="33"
                          strokeDasharray={`${207 * compPct / 100} 207`}
                          style={{ filter: 'drop-shadow(0 0 5px rgba(45,212,191,.5))' }}
                        />
                      </svg>
                      <div style={s.compRingCenter}>
                        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, color: '#2DD4BF' }}>{compPct}%</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #1E2840', marginTop: 8 }}>
                    {compControls.map((c, i) => (
                      <div key={i} style={s.control}>
                        <div style={{ ...s.controlMark, ...(c.ok ? s.controlOk : s.controlFail) }}>
                          {c.ok
                            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          }
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#EDF1F8' }}>{c.name}</div>
                          <div style={{ fontSize: 13, color: '#93A1BC', marginTop: 3 }}>{view === 'tech' ? c.code : c.plain}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={s.scopeNote}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                    <p style={{ fontSize: 13, color: '#93A1BC', margin: 0, lineHeight: 1.5 }}>
                      <b style={{ color: '#EDF1F8' }}>Alcance:</b> HAVEN monitorea los controles de superficie externa relevantes para <b style={{ color: '#EDF1F8' }}>{framework.badge}</b>. No constituye una certificación ni cumplimiento integral del marco.
                    </p>
                  </div>

                  <div style={s.upsell}>
                    <p style={{ fontSize: 13, color: '#93A1BC', margin: 0 }}>
                      ¿Querés cerrar el resto del marco completo? <b style={{ color: '#EDF1F8' }}>Eso lo trabajamos con consultoría y SGSI de Fenikso.</b>
                    </p>
                    <a href="mailto:hola@fenikso.io" style={s.upsellBtn}>Hablar con un especialista →</a>
                  </div>
                </div>
              </div>

              {/* LEY DE DATOS PERSONALES */}
              {dataLaw && (
                <div style={{ marginTop: 20 }}>
                  <div style={s.dataLawCard}>
                    <div style={s.dataLawLeft}>
                      <span style={{ fontSize: 28 }}>{dataLaw.flag}</span>
                      <div>
                        <div style={{ fontSize: 13, color: '#5E6C87', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                          Ley de datos personales detectada
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#EDF1F8' }}>{dataLaw.law} · {dataLaw.country}</div>
                        <div style={{ fontSize: 13, color: '#93A1BC', marginTop: 4 }}>
                          Tu dominio <b style={{ color: '#2DD4BF' }}>{domain?.domain}</b> indica que probablemente te aplica esta normativa.
                        </div>
                      </div>
                    </div>
                    <a href="mailto:hola@fenikso.io" style={s.upsellBtn}>Ver cobertura completa →</a>
                  </div>
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
  trialBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: 'linear-gradient(110deg,rgba(45,212,191,.08),rgba(45,212,191,.03))', border: '1px solid rgba(45,212,191,.25)', borderRadius: 12, padding: '16px 22px', marginBottom: 24, flexWrap: 'wrap' },
  trialBtn: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, color: '#06231f', background: '#2DD4BF', border: 'none', padding: '10px 20px', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap' },
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
  secHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '32px 0 14px', flexWrap: 'wrap', gap: 8 },
  secTitle: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 15, color: '#EDF1F8', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
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
  frameBadge: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 500, color: '#2DD4BF', background: 'rgba(45,212,191,.1)', border: '1px solid rgba(45,212,191,.25)', padding: '4px 10px', borderRadius: 7, letterSpacing: '.04em' },
  compCard: { background: 'linear-gradient(180deg,#131B2C,transparent)', border: '1px solid #1E2840', borderRadius: 18, padding: '28px 30px' },
  compTop: { display: 'flex', alignItems: 'center', gap: 24, marginBottom: 8 },
  compBarLabel: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  compBar: { height: 10, background: '#0A0F1C', borderRadius: 20, overflow: 'hidden', border: '1px solid #25304A' },
  compFill: { height: '100%', background: 'linear-gradient(90deg,#2DD4BF,#5fe6d6)', borderRadius: 20, transition: 'width .8s ease' },
  compRing: { position: 'relative', width: 80, height: 80, flexShrink: 0 },
  compRingCenter: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  control: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 4px', borderBottom: '1px solid #1E2840' },
  controlMark: { width: 24, height: 24, borderRadius: 7, display: 'grid', placeItems: 'center', flexShrink: 0 },
  controlOk: { background: 'rgba(52,211,153,.13)', color: '#34D399' },
  controlFail: { background: 'rgba(251,107,107,.13)', color: '#FB6B6B' },
  scopeNote: { display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 20, padding: '14px 16px', background: 'rgba(45,212,191,.04)', border: '1px solid rgba(45,212,191,.18)', borderRadius: 10 },
  upsell: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 14, padding: '16px 20px', background: '#0A0F1C', border: '1px solid #1E2840', borderRadius: 12, flexWrap: 'wrap' },
  upsellBtn: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 13, color: '#2DD4BF', background: 'none', border: '1px solid rgba(45,212,191,.4)', padding: '9px 16px', borderRadius: 9, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' },
  dataLawCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, background: 'linear-gradient(110deg,#131B2C,#0A0F1C)', border: '1px solid #1E2840', borderRadius: 14, padding: '22px 24px', flexWrap: 'wrap' },
  dataLawLeft: { display: 'flex', alignItems: 'center', gap: 16, flex: 1 },
}