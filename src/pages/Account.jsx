import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { changePassword } from '../lib/account'
import PasswordChangeForm, { Brand } from '../components/PasswordChangeForm'
import { st } from '../components/authStyles'

// Mi cuenta → Seguridad → Cambiar contraseña. Siempre exige la contraseña actual.
export default function Account() {
  const [email, setEmail] = useState(null)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email ?? null))
  }, [])

  async function handleSubmit({ currentPassword, newPassword, revokeOthers }) {
    setDone(false)
    const r = await changePassword({ email, currentPassword, newPassword, revokeOthers })
    if (r.ok) setDone(true)
    return r
  }

  return (
    <div style={st.page}>
      <Brand />
      <div style={st.card}>
        <p style={{ ...st.label, marginBottom: 4 }}>Mi cuenta · Seguridad</p>
        <h2 style={st.title}>Cambiar contraseña</h2>
        <p style={st.sub}>{email ? <>Cuenta: <b style={{ color: '#EDF1F8' }}>{email}</b></> : ' '}</p>
        {done && <p role="status" style={st.ok}>Contraseña actualizada.</p>}
        {email && <PasswordChangeForm email={email} showRevokeOption onSubmit={handleSubmit} />}
        <button type="button" onClick={() => navigate('/dashboard')} style={st.link}>Volver al portal</button>
      </div>
    </div>
  )
}
