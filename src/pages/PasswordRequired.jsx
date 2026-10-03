import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { changePassword, getAccountState, accountRoute } from '../lib/account'
import PasswordChangeForm, { Brand } from '../components/PasswordChangeForm'
import { st } from '../components/authStyles'

// Primer login con contraseña temporal: única pantalla disponible (además de
// cerrar sesión) mientras app_metadata.must_change_password sea true.
export default function PasswordRequired() {
  const [account, setAccount] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { getAccountState(supabase).then(setAccount) }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  async function handleSubmit({ currentPassword, newPassword }) {
    const r = await changePassword({ email: account?.user?.email, currentPassword, newPassword, revokeOthers: true })
    if (r.ok) navigate(accountRoute(await getAccountState(supabase)), { replace: true })
    return r
  }

  const expired = account?.status === 'temp_expired'

  return (
    <div style={st.page}>
      <Brand />
      <div style={st.card}>
        {expired ? (
          <>
            <h2 style={st.title}>Tu contraseña temporal venció</h2>
            <p style={st.sub}>Por seguridad, la contraseña temporal tiene un plazo limitado. Pedile una nueva a Fenikso para ingresar.</p>
          </>
        ) : (
          <>
            <h2 style={st.title}>Creá tu nueva contraseña</h2>
            <p style={st.sub}>Estás usando una contraseña temporal. Antes de continuar, elegí una contraseña propia.</p>
            {account && (
              <PasswordChangeForm email={account.user?.email} currentLabel="Contraseña temporal" submitLabel="Guardar y continuar" onSubmit={handleSubmit} />
            )}
          </>
        )}
        <button type="button" onClick={handleLogout} style={st.link}>Cerrar sesión</button>
      </div>
    </div>
  )
}
