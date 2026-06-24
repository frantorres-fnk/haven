import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [org, setOrg] = useState(null)
  const [domain, setDomain] = useState(null)
  const [view, setView] = useState('owner') // owner | tech
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    const { data: orgData } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', user.id)
      .single()

    const { data: domainData } = await supabase
      .from('domains')
      .select('*')
      .eq('org_id', user.id)
      .eq('is_primary', true)
      .single()

    setOrg(orgData)
    setDomain(domainData)
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0A0F1C', display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: '24px', color: '#2DD4BF', marginBottom: '12px' }}>HAVEN<span style={{ color: '#2DD4BF' }}>.</span></div>
        <p style={{ color: '#5E6C87', fontSize: '14px' }}>Cargando tu portal...</p>
      </div>
    </div>
  )

  const score = 70
  const circumference = 402

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
              {/* Role switch */}
              <div style={s.roleSwitch}>
                <button style={{ ...s.roleBtn, ...(view === 'owner' ? s.roleBtnOn : {}) }} onClick={() => setView('owner')}>Dueño</button>
                <button style={{ ...s.roleBtn, ...(view === 'tech' ? s.roleBtnOn : {}) }} onClick={() => setView('tech')}>Técnico</button>
              </div>
              <button style={s.logoutBtn} onClick={handleLogout}>Salir</button>
            </div>
          </div>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.wrap}>

          {/* HERO */}
          <section style={s.hero}>
            {/* Ring */}
            <div style={s.ringWrap}>
              <svg style={{ transform: 'rotate(-90deg)', width: 150, height: 150 }} viewBox="0 0 150 150">
                <circle fill="none" stroke="#25304A" strokeWidth="9" cx="75" cy="75" r="64" />
                <circle fill="none" stroke="#FBBF24" strokeWidth="9" strokeLinecap="round"
                  cx="75" cy="75" r="64"
                  strokeDasharray={`${circumference * score / 100} ${circumference}`}
                  style={{ filter: 'drop-shadow(0 0 6px #FBBF24)' }}
                />
              </svg>
              <div style={s.ringCenter}>
                <div style={s.ringScore}>{score}<small style={{ fontSize: 13, color: '#5E6C87' }}>/100</small></div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: '#5E6C87', textTransform: 'uppercase', letterSpacing: '.14em', marginTop: 4 }}>Protección</div>
              </div>
            </div>

            <div style={s.heroText}>
              <div style={s.eyebrow}>
                <span style={s.liveDot} />
                Monitoreo activo · sin interrupción
              </div>
              {view === 'owner' ? (
                <>
                  <h1 style={{ ...s.heroTitle, color: '#FBBF24' }}>Vas bien, con tareas pendientes</h1>
                  <p style={s.heroSub}>Tu empresa está vigilada las 24 horas. Hay puntos que conviene resolver para subir tu protección.</p>
                </>
              ) : (
                <>
                  <h1 style={{ ...s.heroTitle, color: '#FBBF24' }}>Score: {score}/100 · 2 hallazgos abiertos</h1>
                  <p style={s.heroSub}>Superficie externa monitoreada · chequeo cada 24h · último scan hace 2h</p>
                </>
              )}
              <div style={s.heroMeta}>
                <div><div style={s.metaK}>Último chequeo</div><div style={s.metaV}>hace <b style={{ color: '#2DD4BF' }}>2 h</b></div></div>
                <div><div style={s.metaK}>Próximo</div><div style={s.metaV}>en <b style={{ color: '#2DD4BF' }}>22 h</b></div></div>
                <div><div style={s.metaK}>Plan</div><div style={s.metaV}>{org?.plan?.toUpperCase() || 'ADVANCED'}</div></div>
                <div><div style={s.metaK}>Trial</div><div style={s.metaV}><b style={{ color: '#2DD4BF' }}>7 días</b> restantes</div></div>
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
              { icon: '🔑', label: 'Credenciales', status: 'crit', plain: '3 expuestas', tech: '3 en breach · plaintext' },
              { icon: '✉️', label: 'Correo', status: 'warn', plain: 'DMARC ausente', tech: 'DMARC → NXDOMAIN' },
              { icon: '🔒', label: 'Certificado TLS', status: 'ok', plain: 'Vigente 84 días', tech: 'TLS 1.3 · vence en 84d' },
              { icon: '🔍', label: 'OSINT / Perímetro', status: 'ok', plain: 'Sin exposición', tech: 'superficie estable' },
            ].map((a, i) => (
              <div key={i} style={s.areaCard}>
                <div style={s.areaTop}>
                  <span style={{ fontSize: 20 }}>{a.icon}</span>
                  <span style={{ ...s.pill, ...(a.status === 'ok' ? s.pillOk : a.status === 'warn' ? s.pillWarn : s.pillCrit) }}>
                    {a.status === 'ok' ? 'OK' : a.status === 'warn' ? 'Revisar' : 'Crítico'}
                  </span>
                </div>
                <div style={s.areaLabel}>{a.label}</div>
                <div style={s.areaNote}>{view === 'owner' ? a.plain : a.tech}</div>
              </div>
            ))}
          </div>

          {/* FINDINGS */}
          <div style={s.secHead}>
            <h2 style={s.secTitle}>Alertas activas</h2>
            <span style={s.secCount}>2 abiertas</span>
          </div>
          <div style={s.findings}>
            {[
              {
                sev: 'crit', sevLabel: 'Crítico',
                plain: { title: 'Contraseñas filtradas en internet', desc: '3 cuentas de tu empresa aparecen en una filtración reciente.', fix: 'Cambiá las contraseñas y activá doble factor.' },
                tech: { title: 'Credential exposure · 3 accounts', desc: '3 cuentas en combolist 2026-06 · plaintext · fuente HIBP', fix: 'Forzar reset + MFA obligatorio en cuentas afectadas' },
                when: 'hace 40 min',
              },
              {
                sev: 'warn', sevLabel: 'Alto',
                plain: { title: 'Tu correo es fácil de imitar', desc: 'Falta una protección que evita que alguien mande mails haciéndose pasar por vos.', fix: 'Lo resolvemos publicando un registro en tu DNS.' },
                tech: { title: 'DMARC policy absent', desc: '_dmarc.' + (domain?.domain || 'tudominio.com') + ' → NXDOMAIN', fix: 'Publicar v=DMARC1; p=none · escalar a quarantine' },
                when: 'hace 2 h',
              },
            ].map((f, i) => (
              <div key={i} style={{ ...s.finding, borderLeftColor: f.sev === 'crit' ? '#FB6B6B' : '#FBBF24' }}>
                <span style={{ ...s.sevBadge, ...(f.sev === 'crit' ? s.sevCrit : s.sevWarn) }}>{f.sevLabel}</span>
                <div style={s.findingBody}>
                  <div style={s.findingTitle}>{view === 'owner' ? f.plain.title : f.tech.title}</div>
                  <div style={s.findingDesc}>{view === 'owner' ? f.plain.desc : f.tech.desc}</div>
                  <div style={s.findingFix}>→ {view === 'owner' ? f.plain.fix : f.tech.fix}</div>
                </div>
                <div style={s.findingWhen}>{f.when}</div>
              </div>
            ))}
          </div>

          {/* DOMAIN NOT VERIFIED BANNER */}
          {domain && !domain.verified && (
            <div style={s.verifyBanner}>
              <span>⚠️</span>
              <p style={{ fontSize: 14, color: '#93A1BC', margin: 0 }}>
                <b style={{ color: '#EDF1F8' }}>Verificá tu dominio</b> para activar el monitoreo real. Revisá tu mail en <b style={{ color: '#2DD4BF' }}>{org?.email}</b>.
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#0A0F1C' },
  wrap: { maxWidth: 1080, margin: '0 auto', padding: '0 24px' },
  header: { borderBottom: '1px solid #1E2840', position: 'sticky', top: 0, zIndex: 20, background: 'rgba(10,15,28,.85)', backdropFilter: 'blur(14px)' },
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 66, gap: 16 },
  brand: { display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 },
  brandMark: { width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(145deg,#2DD4BF,#119e8e)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 1px rgba(45,212,191,.25)' },
  brandName: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: '.04em', color: '#EDF1F8' },
  brandBy: { fontSize: 10, color: '#5E6C87', letterSpacing: '.18em', textTransform: 'uppercase', marginTop: -2 },
  topRight: { display: 'flex', alignItems: 'center', gap: 12 },
  domainChip: { display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: '#93A1BC', padding: '7px 13px', border: '1px solid #25304A', borderRadius: 8, background: '#131B2C' },
  dot: { width: 7, height: 7, borderRadius: '50%', background: '#34D399', boxShadow: '0 0 8px #34D399', display: 'inline-block' },
  roleSwitch: { display: 'flex', background: '#131B2C', border: '1px solid #25304A', borderRadius: 10, padding: 3 },
  roleBtn: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 13, color: '#93A1BC', background: 'none', border: 'none', padding: '7px 14px', borderRadius: 8, cursor: 'pointer' },
  roleBtnOn: { background: '#2DD4BF', color: '#06231f' },
  logoutBtn: { fontFamily: 'Inter,sans-serif', fontSize: 13, color: '#5E6C87', background: 'none', border: '1px solid #25304A', padding: '7px 14px', borderRadius: 8, cursor: 'pointer' },
  main: { padding: '40px 0 64px' },
  hero: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 38, alignItems: 'center', background: 'linear-gradient(180deg,#131B2C,transparent)', border: '1px solid #1E2840', borderRadius: 20, padding: '34px 38px', marginBottom: 28 },
  ringWrap: { position: 'relative', width: 150, height: 150, flexShrink: 0 },
  ringCenter: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  ringScore: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 30, color: '#FBBF24', lineHeight: 1 },
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
  findings: { display: 'flex', flexDirection: 'column', gap: 11 },
  finding: { display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'start', background: '#131B2C', border: '1px solid #1E2840', borderLeftWidth: 3, borderRadius: 13, padding: '16px 20px' },
  sevBadge: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 500, letterSpacing: '.1em', padding: '5px 9px', borderRadius: 6, textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sevCrit: { background: 'rgba(251,107,107,.13)', color: '#FB6B6B' },
  sevWarn: { background: 'rgba(251,191,36,.13)', color: '#FBBF24' },
  findingBody: {},
  findingTitle: { fontSize: 14, fontWeight: 600, color: '#EDF1F8', marginBottom: 4 },
  findingDesc: { fontSize: 13, color: '#93A1BC', lineHeight: 1.5 },
  findingFix: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: '#5E6C87', marginTop: 6 },
  findingWhen: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#5E6C87', textAlign: 'right', whiteSpace: 'nowrap' },
  verifyBanner: { display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 12, padding: '16px 20px', marginTop: 20 },
}