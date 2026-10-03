/**
 * requestScan: único punto de entrada de "Analizar" (tarjeta /domains y detalle).
 * Mismo endpoint y payload que antes; errores visibles y consistentes.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-1' } } }) } } }))
const { requestScan, scanErrorMessage, SCANNER_URL } = await import('../scan')

const jsonRes = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const call = (resOrFn) => {
  const fetchImpl = vi.fn(typeof resOrFn === 'function' ? resOrFn : async () => resOrFn)
  return { fetchImpl, run: () => requestScan('dom-1', 'org-1', { fetchImpl }) }
}

describe('requestScan', () => {
  it('éxito → ok:true con los datos del backend', async () => {
    const { run } = call(jsonRes(200, { ok: true, scan_id: 's1', score: 80, findings: 2 }))
    expect(await run()).toEqual({ ok: true, status: 200, data: { ok: true, scan_id: 's1', score: 80, findings: 2 } })
  })

  it('mantiene endpoint, método, auth y payload exactos', async () => {
    const { fetchImpl, run } = call(jsonRes(200, { ok: true }))
    await run()
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${SCANNER_URL}/scan/dns`)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok-1')
    expect(JSON.parse(init.body)).toEqual({ domain_id: 'dom-1', org_id: 'org-1' })
  })

  it('403 → muestra el mensaje seguro del backend (dominio sin verificar)', async () => {
    const { run } = call(jsonRes(403, { error: 'El dominio todavía no está verificado' }))
    expect(await run()).toEqual({ ok: false, status: 403, error: 'El dominio todavía no está verificado' })
  })

  it('403 sin mensaje usable → texto genérico de permisos', async () => {
    expect((await call(jsonRes(403, {})).run()).error).toBe('No tenés permisos para analizar este dominio.')
    expect((await call(jsonRes(403, { error: 'x'.repeat(500) })).run()).error).toBe('No tenés permisos para analizar este dominio.')
  })

  it('409 → "Ya hay un análisis en curso"', async () => {
    const r = await call(jsonRes(409, { error: 'Ya hay un análisis en curso para este dominio.', retry_after: 60 })).run()
    expect(r).toEqual({ ok: false, status: 409, error: 'Ya hay un análisis en curso' })
  })

  it('429 → "Esperá un momento antes de volver a analizar"', async () => {
    const r = await call(jsonRes(429, { error: 'Demasiados scans', retry_after: 90 })).run()
    expect(r.error).toBe('Esperá un momento antes de volver a analizar')
  })

  it('500 y 503 → mensaje de servicio, sin detalles técnicos', async () => {
    for (const st of [500, 503]) {
      const r = await call(jsonRes(st, { error: 'Internal server error: stack...' })).run()
      expect(r).toEqual({ ok: false, status: st, error: 'No pudimos completar el análisis. Intentá nuevamente.' })
    }
  })

  it('500 con body no-JSON → mismo mensaje (no rompe)', async () => {
    const r = await call(new Response('<html>Bad Gateway</html>', { status: 502 })).run()
    expect(r.error).toBe('No pudimos completar el análisis. Intentá nuevamente.')
  })

  it('error de red (fetch rechaza) → status 0, mensaje de conexión, no lanza', async () => {
    const r = await call(async () => { throw new TypeError('Failed to fetch') }).run()
    expect(r).toEqual({ ok: false, status: 0, error: 'No pudimos conectar con el servicio. Intentá nuevamente.' })
  })

  it('otros status → mensaje genérico seguro; 2xx sin ok:true no se toma como éxito', async () => {
    expect((await call(jsonRes(400, { error: 'domain_id es requerido' })).run()).error).toBe('No pudimos iniciar el análisis. Intentá nuevamente.')
    expect((await call(jsonRes(200, { ok: false })).run()).ok).toBe(false)
  })

  it('403 por contraseña temporal pendiente → mensaje propio, nunca el código crudo', () => {
    expect(scanErrorMessage(403, { error: 'password_change_required' })).toBe('Tenés que cambiar tu contraseña para continuar.')
    expect(scanErrorMessage(403, { error: 'temp_password_expired' })).toBe('Tenés que cambiar tu contraseña para continuar.')
  })

  it('401 → sesión expirada', () => {
    expect(scanErrorMessage(401, {})).toBe('Tu sesión expiró. Volvé a iniciar sesión.')
  })
})

describe('ambos entry points usan el mismo helper', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const src = (f) => readFileSync(join(here, '../../pages', f), 'utf8')

  for (const [file, handler] of [['Domains.jsx', 'handleScan'], ['Dashboard.jsx', 'runScan']]) {
    it(`${file}: importa requestScan, lo usa en ${handler} y no llama a /scan/dns directo`, () => {
      const code = src(file)
      expect(code).toMatch(/import \{ requestScan \} from '\.\.\/lib\/scan'/)
      expect(code).not.toMatch(/\/scan\/dns/)
      const body = code.slice(code.indexOf(`async function ${handler}(`), code.indexOf(`async function ${handler}(`) + 600)
      expect(body).toMatch(/await requestScan\(/)
      expect(body).toMatch(/if \(r\.ok\)/)                // refresca solo en éxito
      expect(body).toMatch(/setScanError\(/)              // error visible
      expect(body).toMatch(/if \([^)]*scanning\) return/) // no doble envío
    })
  }

  it('el alta de proveedor también usa el helper y muestra su error', () => {
    const code = src('Domains.jsx')
    const add = code.slice(code.indexOf('async function handleAddDomain('), code.indexOf('async function handleScan('))
    expect(add).toMatch(/await requestScan\(domainId, org\.id\)/)
    expect(add).toMatch(/setScanError\(/)
  })
})
