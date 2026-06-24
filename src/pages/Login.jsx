import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div style={s.page}>
      <div style={s.logo}>
        <svg width="64" height="74" viewBox="0 0 120 138" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 0 L100 0 Q120 0 120 22 L120 68 Q120 105 60 120 Q0 105 0 68 L0 22 Q0 0 20 0 Z" fill="#2DD4BF"/>
          <rect x="22" y="28" width="18" height="64" fill="#06231f" rx="3"/>
          <rect x="80" y="28" width="18" height="64" fill="#06231f" rx="3"/>
          <rect x="22" y="56" width="76" height="14" fill="#06231f" rx="2"/>
        </svg>
        <h1 style={s.logoText}>HAVEN</h1>
        <p style={s.logoSub}>by Fenikso</p>
      </div>
      <div style={s.card}>
        <h2 style={s.title}>Bienvenido de vuelta</h2>
        <p style={s.sub}>Ingresá para ver el estado de tu empresa</p>
        <form onSubmit={handleLogin}>
          <div style={s.field}>
            <label style={s.label}>Email corporativo</label>
            <input
              style={s.input}
              type="email"
              placeholder="vos@tuempresa.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Contraseña</label>
            <input
              style={s.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p style={s.error}>{error}</p>}
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <p style={s.register}>
          ¿No tenés cuenta?{' '}
          <Link to="/onboarding" style={s.link}>
            Empezá tu prueba gratis
          </Link>
        </p>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#0A0F1C', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  logo: { textAlign: 'center', marginBottom: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  logoText: { fontFamily: "'Space Grotesk', sans-serif", fontSize: '28px', fontWeight: 700, color: '#EDF1F8', letterSpacing: '.06em', marginTop: '8px', marginBottom: 0 },
  logoSub: { fontSize: '11px', color: '#5E6C87', letterSpacing: '.18em', textTransform: 'uppercase', marginTop: '4px' },
  card: { background: '#131B2C', border: '1px solid #25304A', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '420px' },
  title: { fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 700, color: '#EDF1F8', marginBottom: '8px' },
  sub: { fontSize: '14px', color: '#93A1BC', marginBottom: '28px' },
  field: { marginBottom: '18px' },
  label: { display: 'block', fontSize: '13px', color: '#93A1BC', marginBottom: '7px', fontWeight: 500 },
  input: { width: '100%', background: '#0A0F1C', border: '1px solid #25304A', borderRadius: '9px', padding: '11px 14px', color: '#EDF1F8', fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif' },
  error: { color: '#FB6B6B', fontSize: '13px', marginBottom: '16px', background: 'rgba(251,107,107,.1)', padding: '10px 14px', borderRadius: '8px' },
  btn: { width: '100%', background: '#2DD4BF', color: '#06231f', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", cursor: 'pointer', marginTop: '8px' },
  register: { textAlign: 'center', fontSize: '13px', color: '#5E6C87', marginTop: '24px' },
  link: { color: '#2DD4BF', textDecoration: 'none', fontWeight: 500 },
}