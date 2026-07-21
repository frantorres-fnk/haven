import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Admin() {
  const [orgs, setOrgs] = useState([])
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState('clients')
  const [newAdmin, setNewAdmin] = useState({ email: '', name: '' })
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({ total: 0, active: 0, trialing: 0, cancelled: 0, mrr: 0 })
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [checking, setChecking] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { checkAdminAndLoad() }, [])

  async function checkAdminAndLoad() {
    // Admin siempre pide credenciales — no reutiliza sesión activa
    setChecking(false)
    setLoading(false)
  }

  async function verifyAdminAndLoad(user) {
    const { data: adminData } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', user.email)
      .single()

    if (!adminData) {
      setIsAdmin(false)
      setChecking(false)
      setLoading(false)
      navigate('/dashboard')
      return
    }

    setIsAdmin(true)
    await Promise.all([loadOrgs(), loadAdmins()])
    setChecking(false)
    setLoading(false)
  }

  async function handleAdminLogin(e) {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    // Cerrar sesión previa primero
    await supabase.auth.signOut()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    })

    if (error) {
      setAuthError('Credenciales incorrectas')
      setAuthLoading(false)
      return
    }

    // Verificar que el email esté en admin_users
    const { data: adminData } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', data.user.email)
      .single()

    if (!adminData) {
      await supabase.auth.signOut()
      setAuthError('No tenés permisos de administrador')
      setAuthLoading(false)
      return
    }

    setIsAdmin(true)
    await Promise.all([loadOrgs(), loadAdmins()])
    setLoading(false)
    setAuthLoading(false)
  }

  async function loadOrgs() {
    const { data: orgsData } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })

    if (!orgsData) return

    const orgsWithData = await Promise.all(orgsData.map(async (org) => {
      const { data: domains } = await supabase
        .from('domains')
        .select('id, domain, verified, monitoring_active, last_scan_at')
        .eq('org_id', org.id)

      const primaryDomain = domains?.find(d => d.is_primary) || domains?.[0]

      let lastScore = null
      if (primaryDomain) {
        const { data: scans } = await supabase
          .from('scans')
          .select('score, completed_at')
          .eq('domain_id', primaryDomain.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
        lastScore = scans?.[0]?.score || null
      }

      return { ...org, domains: domains || [], primaryDomain, lastScore }
    }))

    setOrgs(orgsWithData)

    const planPrices = { advanced: 99, premium: 199, elite: 299 }
    const active = orgsWithData.filter(o => o.status === 'active')
    const trialing = orgsWithData.filter(o => o.status === 'trialing')
    const cancelled = orgsWithData.filter(o => o.status === 'cancelled')
    const mrr = active.reduce((sum, o) => sum + (planPrices[o.plan] || 0), 0)

    setStats({
      total: orgsWithData.length,
      active: active.length,
      trialing: trialing.length,
      cancelled: cancelled.length,
      mrr,
    })
  }

  async function loadAdmins() {
    const { data } = await supabase.from('admin_users').select('*').order('created_at', { ascending: true })
    setAdmins(data || [])
  }

  async function handleAddAdmin(e) {
    e.preventDefault()
    setError('')
    setAddingAdmin(true)
    const { error } = await supabase.from('admin_users').insert({
      email: newAdmin.email.toLowerCase().trim(),
      name: newAdmin.name,
    })
    if (error) { setError(error.message); setAddingAdmin(false); return }
    setNewAdmin({ email: '', name: '' })
    await loadAdmins()
    setAddingAdmin(false)
  }

  async function handleRemoveAdmin(id) {
    if (!confirm('¿Eliminar este admin?')) return
    await supabase.from('admin_users').delete().eq('id', id)
    await loadAdmins()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const scoreColor = (s) => !s ? '#5E6C87' : s >= 90 ? '#4ADE80' : s >= 70 ? '#4F7EFF' : s >= 50 ? '#FBBF24' : '#FB6B6B'
  const scoreRating = (s) => !s ? '—' : s >= 90 ? 'A' : s >= 70 ? 'B' : s >= 50 ? 'C' : s >= 30 ? 'D' : 'F'
  const statusColor = (s) => s === 'active' ? '#4ADE80' : s === 'trialing' ? '#4F7EFF' : s === 'past_due' ? '#FBBF24' : '#FB6B6B'
  const statusLabel = (s) => s === 'active' ? 'Activo' : s === 'trialing' ? 'Trial' : s === 'past_due' ? 'Vencido' : s === 'cancelled' ? 'Cancelado' : s

  if (!isAdmin && !loading && !checking) return (
    <div style={{ minHeight: '100vh', background: '#080C18', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ width: 22, height: 3, background: '#4F7EFF', borderRadius: 2, marginBottom: 6 }} />
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 24, letterSpacing: '.08em', color: '#EDF1F8' }}>HAVEN</div>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#4F7EFF', background: 'rgba(79,126,255,.1)', border: '1px solid rgba(79,126,255,.2)', padding: '3px 10px', borderRadius: 20, letterSpacing: '.1em', marginTop: 8 }}>ADMIN</span>
      </div>
      <div style={{ background: '#0C1220', border: '1px solid #1A2240', borderRadius: 16, padding: 40, width: '100%', maxWidth: 400 }}>
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 20, color: '#EDF1F8', marginBottom: 6 }}>Acceso restringido</h2>
        <p style={{ color: '#93A1BC', fontSize: 13, marginBottom: 24 }}>Solo administradores de HAVEN.</p>
        <form onSubmit={handleAdminLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#93A1BC', marginBottom: 6 }}>Email admin</label>
            <input type="email" style={{ width: '100%', background: '#080C18', border: '1px solid #1A2240', borderRadius: 9, padding: '11px 14px', color: '#EDF1F8', fontSize: 14, outline: 'none', fontFamily: 'Inter,sans-serif' }}
              placeholder="Email" value={authEmail}
              onChange={e => setAuthEmail(e.target.value)} required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#93A1BC', marginBottom: 6 }}>Contraseña</label>
            <input type="password" style={{ width: '100%', background: '#080C18', border: '1px solid #1A2240', borderRadius: 9, padding: '11px 14px', color: '#EDF1F8', fontSize: 14, outline: 'none', fontFamily: 'Inter,sans-serif' }}
              placeholder="Contraseña" value={authPassword}
              onChange={e => setAuthPassword(e.target.value)} required />
          </div>
          {authError && <p style={{ color: '#FB6B6B', fontSize: 13, marginBottom: 16, background: 'rgba(251,107,107,.1)', padding: '10px 14px', borderRadius: 8 }}>{authError}</p>}
          <button type="submit" disabled={authLoading} style={{ width: '100%', background: '#4F7EFF', color: '#fff', border: 'none', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", cursor: 'pointer' }}>
            {authLoading ? 'Verificando...' : 'Ingresar al panel →'}
          </button>
        </form>
      </div>
    </div>
  )

  if (checking || (isAdmin && loading)) return (
    <div style={{ minHeight: '100vh', background: '#080C18', display: 'grid', placeItems: 'center' }}>
      <p style={{ color: '#5E6C87', fontSize: 14 }}>
        {checking ? 'Verificando acceso...' : 'Cargando panel de admin...'}
      </p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#080C18' }}>
      {/* TOPBAR */}
      <header style={{ borderBottom: '1px solid #1A2240', position: 'sticky', top: 0, zIndex: 20, background: 'rgba(8,12,24,.9)', backdropFilter: 'blur(14px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ width: 22, height: 3, background: '#4F7EFF', borderRadius: 2, marginBottom: 3 }} />
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: '.08em', color: '#EDF1F8' }}>HAVEN</div>
            </div>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#4F7EFF', background: 'rgba(79,126,255,.1)', border: '1px solid rgba(79,126,255,.2)', padding: '3px 10px', borderRadius: 20, letterSpacing: '.1em' }}>ADMIN</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/dashboard')} style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: '#93A1BC', background: 'none', border: '1px solid #1A2240', padding: '7px 14px', borderRadius: 8, cursor: 'pointer' }}>
              Mi portal
            </button>
            <button onClick={handleLogout} style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: '#5E6C87', background: 'none', border: '1px solid #1A2240', padding: '7px 14px', borderRadius: 8, cursor: 'pointer' }}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px' }}>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 32 }}>
          {[
            { label: 'Total clientes', value: stats.total, color: '#EDF1F8' },
            { label: 'Activos', value: stats.active, color: '#4ADE80' },
            { label: 'En trial', value: stats.trialing, color: '#4F7EFF' },
            { label: 'Cancelados', value: stats.cancelled, color: '#FB6B6B' },
            { label: 'MRR', value: `$${stats.mrr}`, color: '#4ADE80' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#0C1220', border: '1px solid #1A2240', borderRadius: 12, padding: '20px 20px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#5E6C87', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 28, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 4, background: '#0C1220', border: '1px solid #1A2240', borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 24 }}>
          {[
            { key: 'clients', label: `Clientes (${stats.total})` },
            { key: 'admins', label: `Admins (${admins.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 13, padding: '8px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', background: activeTab === t.key ? '#4F7EFF' : 'none', color: activeTab === t.key ? '#fff' : '#93A1BC' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* CLIENTES */}
        {activeTab === 'clients' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orgs.length === 0 && (
              <div style={{ background: '#0C1220', border: '1px solid #1A2240', borderRadius: 14, padding: '40px', textAlign: 'center' }}>
                <p style={{ color: '#5E6C87', fontSize: 14 }}>Sin clientes todavía</p>
              </div>
            )}
            {orgs.map((org) => (
              <div key={org.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 20, alignItems: 'center', background: '#0C1220', border: '1px solid #1A2240', borderRadius: 14, padding: '18px 22px' }}>

                {/* Score */}
                <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
                  <svg style={{ transform: 'rotate(-90deg)', width: 56, height: 56 }} viewBox="0 0 56 56">
                    <circle fill="none" stroke="#1A2240" strokeWidth="5" cx="28" cy="28" r="22"/>
                    <circle fill="none" stroke={scoreColor(org.lastScore)} strokeWidth="5" strokeLinecap="round"
                      cx="28" cy="28" r="22"
                      strokeDasharray={`${138 * (org.lastScore || 0) / 100} 138`}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 12, color: scoreColor(org.lastScore), lineHeight: 1 }}>{org.lastScore || '—'}</div>
                    <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 9, color: scoreColor(org.lastScore) }}>{scoreRating(org.lastScore)}</div>
                  </div>
                </div>

                {/* Info */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, color: '#EDF1F8' }}>{org.name}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, padding: '3px 8px', borderRadius: 20, background: `rgba(${org.plan === 'elite' ? '79,126,255' : org.plan === 'premium' ? '124,111,255' : '93,109,140'},.15)`, color: org.plan === 'elite' ? '#4F7EFF' : org.plan === 'premium' ? '#7C6FFF' : '#93A1BC', textTransform: 'uppercase' }}>{org.plan}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, padding: '3px 8px', borderRadius: 20, background: `rgba(${statusColor(org.status).replace('#', '').match(/.{2}/g).map(h => parseInt(h, 16)).join(',')}, .15)`, color: statusColor(org.status) }}>{statusLabel(org.status)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#5E6C87', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '.1em' }}>Email</div>
                      <div style={{ fontSize: 13, color: '#93A1BC', marginTop: 2 }}>{org.email}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#5E6C87', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '.1em' }}>Dominios</div>
                      <div style={{ fontSize: 13, color: '#93A1BC', marginTop: 2 }}>{org.domains.length} · {org.primaryDomain?.domain || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#5E6C87', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '.1em' }}>Cliente desde</div>
                      <div style={{ fontSize: 13, color: '#93A1BC', marginTop: 2 }}>{new Date(org.created_at).toLocaleDateString('es-AR')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#5E6C87', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '.1em' }}>Trial vence</div>
                      <div style={{ fontSize: 13, color: org.trial_ends_at && new Date(org.trial_ends_at) < new Date() ? '#FB6B6B' : '#93A1BC', marginTop: 2 }}>
                        {org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString('es-AR') : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <button onClick={() => navigate(`/dashboard?domain=${org.primaryDomain?.id}`)} style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 13, color: '#fff', background: '#4F7EFF', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Ver portal →
                  </button>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#5E6C87' }}>
                    {org.primaryDomain?.monitoring_active ? '● Monitoreo activo' : '○ Sin monitoreo'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ADMINS */}
        {activeTab === 'admins' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {admins.map((admin) => (
                <div key={admin.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0C1220', border: '1px solid #1A2240', borderRadius: 12, padding: '16px 20px' }}>
                  <div>
                    <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 15, color: '#EDF1F8', marginBottom: 4 }}>{admin.name || '—'}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: '#93A1BC' }}>{admin.email}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#5E6C87' }}>
                      Desde {new Date(admin.created_at).toLocaleDateString('es-AR')}
                    </div>
                    <button onClick={() => handleRemoveAdmin(admin.id)} style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: '#FB6B6B', background: 'rgba(251,107,107,.1)', border: '1px solid rgba(251,107,107,.2)', padding: '6px 12px', borderRadius: 7, cursor: 'pointer' }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Agregar admin */}
            <div style={{ background: '#0C1220', border: '1px dashed #1A2240', borderRadius: 14, padding: 24 }}>
              <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 16, color: '#EDF1F8', marginBottom: 6 }}>Agregar admin</h3>
              <p style={{ fontSize: 13, color: '#93A1BC', marginBottom: 20 }}>El usuario podrá acceder al panel de administración.</p>
              <form onSubmit={handleAddAdmin} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: 200 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#93A1BC', marginBottom: 6 }}>Email</label>
                  <input style={s.input} type="email" placeholder="admin@fenikso.io" value={newAdmin.email}
                    onChange={e => setNewAdmin(a => ({ ...a, email: e.target.value }))} required />
                </div>
                <div style={{ flex: 2, minWidth: 200 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#93A1BC', marginBottom: 6 }}>Nombre</label>
                  <input style={s.input} placeholder="Nombre completo" value={newAdmin.name}
                    onChange={e => setNewAdmin(a => ({ ...a, name: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="submit" disabled={addingAdmin} style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, color: '#fff', background: '#4F7EFF', border: 'none', padding: '11px 20px', borderRadius: 9, cursor: 'pointer' }}>
                    {addingAdmin ? 'Agregando...' : '+ Agregar admin'}
                  </button>
                </div>
              </form>
              {error && <p style={{ fontSize: 13, color: '#FB6B6B', marginTop: 12, background: 'rgba(251,107,107,.1)', padding: '10px 14px', borderRadius: 8 }}>{error}</p>}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

const s = {
  input: { width: '100%', background: '#080C18', border: '1px solid #1A2240', borderRadius: 9, padding: '11px 14px', color: '#EDF1F8', fontSize: 14, outline: 'none', fontFamily: 'Inter,sans-serif' },
}
