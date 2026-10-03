import { useEffect, useState } from 'react'
import { sendDomainVerification } from '../lib/domains'

const RESEND_COOLDOWN_S = 60

// "Reenviar mail" de confirmación del dominio, con espera entre envíos.
export default function ResendVerificationButton({ domainId, style, onResult }) {
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait(w => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  async function handleClick() {
    if (busy || wait > 0) return
    setBusy(true)
    setMsg(null)
    const r = await sendDomainVerification(domainId)
    setBusy(false)
    if (r.ok) {
      setWait(RESEND_COOLDOWN_S)
      setMsg({ ok: true, text: r.already ? 'El dominio ya está confirmado.' : 'Te reenviamos el mail.' })
    } else {
      setMsg({ ok: false, text: r.error })
    }
    onResult?.(r)
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 6 }}>
      <button type="button" onClick={handleClick} disabled={busy || wait > 0}
        style={{ ...style, opacity: busy || wait > 0 ? 0.6 : 1, cursor: busy || wait > 0 ? 'default' : 'pointer' }}>
        {busy ? 'Enviando…' : wait > 0 ? `Reenviar mail (${wait}s)` : 'Reenviar mail'}
      </button>
      {msg && <span role="status" style={{ fontSize: 12, color: msg.ok ? '#34D399' : '#FB6B6B' }}>{msg.text}</span>}
    </span>
  )
}
