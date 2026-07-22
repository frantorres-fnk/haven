import { useState, useMemo, useEffect } from 'react'
import { fetchScanHistory } from '../lib/domainStats'

// Mirror de los design tokens de Dashboard.jsx — mantener en sincronía con C
const C = {
  card:       'rgba(20,27,46,.45)',
  cardSolid:  '#0d1526',
  border:     'rgba(130,150,220,.12)',
  borderHi:   'rgba(130,150,220,.22)',
  t1:         '#e8ecf5',
  t2:         '#9aa6c2',
  t3:         '#7f8aa6',
  accent:     '#5b6ef5',
  green:      '#3ddc84',
  greenText:  '#5fe39c',
  red:        '#f2637e',
  title:      "'Space Grotesk',sans-serif",
  body:       "'Manrope',sans-serif",
  mono:       "'JetBrains Mono',monospace",
}

const WINDOWS = [
  { key: '24h',    label: '24 h' },
  { key: '7d',     label: '7 d' },
  { key: '30d',    label: '30 d' },
  { key: '90d',    label: '90 d' },
  { key: 'custom', label: 'Personalizado' },
]

// ─── Agregación diaria ──────────────────────────────────────────────────────────
// Para cada día, conserva el scan manual si existe; si no, el último cron.
function aggregateDaily(scans) {
  const m = new Map()
  for (const s of scans) {
    if (!s.completed_at || s.score == null) continue
    const day = s.completed_at.slice(0, 10)
    const ex  = m.get(day)
    if (!ex || s.triggered_by === 'manual' || ex.triggered_by !== 'manual') m.set(day, s)
  }
  return Array.from(m.values())
}

// ─── Agregación horaria ────────────────────────────────────────────────────────
// Mismo criterio que aggregateDaily pero agrupa por hora (YYYY-MM-DDTHH).
function aggregateHourly(scans) {
  const m = new Map()
  for (const s of scans) {
    if (!s.completed_at || s.score == null) continue
    const hr = s.completed_at.slice(0, 13)
    const ex = m.get(hr)
    if (!ex || s.triggered_by === 'manual' || ex.triggered_by !== 'manual') m.set(hr, s)
  }
  return Array.from(m.values())
}

// ─── Cutoff de ventana ─────────────────────────────────────────────────────────
function winCutoff(key) {
  const h  = 3600000
  const ms = { '24h': 24 * h, '7d': 7 * 24 * h, '30d': 30 * 24 * h, '90d': 90 * 24 * h }
  return new Date(Date.now() - (ms[key] ?? 0))
}

// ─── Índices de labels para eje X ──────────────────────────────────────────────
function labelIndices(count, isMobile) {
  if (count <= 1) return [0]
  const maxL = isMobile ? 3 : 5
  if (count <= maxL) return Array.from({ length: count }, (_, i) => i)
  const idxs = [0]
  const step = (count - 1) / (maxL - 1)
  for (let k = 1; k < maxL - 1; k++) idxs.push(Math.round(k * step))
  idxs.push(count - 1)
  return [...new Set(idxs)].sort((a, b) => a - b)
}

// ─── Formateo de fechas ────────────────────────────────────────────────────────
function fmtXLabel(dateStr, showTime) {
  return showTime
    ? new Date(dateStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : new Date(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function fmtTooltipDate(dateStr, showTime) {
  return showTime
    ? new Date(dateStr).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : new Date(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Texto de resumen ───────────────────────────────────────────────────────────
// Compara el primer punto visible en la ventana contra el último.
function scoreSummary(pts, winKey) {
  const last  = pts[pts.length - 1]
  const first = pts[0]
  const delta = last.score - first.score
  const abs   = Math.abs(delta)
  const span  = {
    '24h':    'en las últimas 24 h',
    '7d':     'en los últimos 7 días',
    '30d':    'en los últimos 30 días',
    '90d':    'en los últimos 90 días',
    'custom': 'en el período seleccionado',
  }[winKey] ?? 'en el período'
  if (abs <= 2) return { text: `El score se mantuvo estable ${span}.`, delta: 0 }
  if (delta > 0) return { text: `Mejoraste ${abs} puntos ${span}.`, delta }
  return { text: `Bajó ${abs} puntos ${span}.`, delta }
}

// ───────────────────────────────────────────────────────────────────────────────
export default function ScoreEvolution({ scanHistory, isMobile, domainId }) {
  const [activeWin,  setActiveWin]  = useState('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [extHistory, setExtHistory] = useState(null)
  const [extLoading, setExtLoading] = useState(false)
  const [hovered,    setHovered]    = useState(null)

  // Fetch extendido: solo cuando custom + fromDate es anterior a 90 días
  useEffect(() => {
    if (activeWin !== 'custom' || !customFrom || !domainId) return
    const fromDate  = new Date(customFrom)
    const ninetyAgo = new Date(Date.now() - 90 * 24 * 3600000)
    if (fromDate >= ninetyAgo) { setExtHistory(null); return }
    let cancelled = false
    setExtLoading(true)
    fetchScanHistory(domainId, { fromDate })
      .then(data => { if (!cancelled) { setExtHistory(data); setExtLoading(false) } })
      .catch(()  => { if (!cancelled) setExtLoading(false) })
    return () => { cancelled = true }
  }, [activeWin, customFrom, domainId])

  // Limpiar historial extendido al salir del modo custom
  useEffect(() => { if (activeWin !== 'custom') setExtHistory(null) }, [activeWin])

  const source = activeWin === 'custom' && extHistory ? extHistory : scanHistory

  // Derivación de puntos según ventana activa
  const { pts, isHourly } = useMemo(() => {
    let filtered = source

    if (activeWin === 'custom') {
      if (customFrom) {
        const f = new Date(customFrom)
        filtered = filtered.filter(s => new Date(s.completed_at) >= f)
      }
      if (customTo) {
        const t = new Date(customTo + 'T23:59:59')
        filtered = filtered.filter(s => new Date(s.completed_at) <= t)
      }
      return { pts: aggregateDaily(filtered), isHourly: false }
    }

    const cutoff = winCutoff(activeWin)
    filtered = filtered.filter(s => new Date(s.completed_at) >= cutoff)

    if (activeWin === '24h') {
      if (filtered.length > 50) return { pts: aggregateHourly(filtered), isHourly: true }
      return { pts: filtered.filter(s => s.score != null), isHourly: false }
    }

    return { pts: aggregateDaily(filtered), isHourly: false }
  }, [source, activeWin, customFrom, customTo])

  function changeWin(w) { setHovered(null); setActiveWin(w) }

  const showTime = activeWin === '24h'
  const today    = new Date().toISOString().slice(0, 10)

  // ── Chips ────────────────────────────────────────────────────────────────
  const chip = (active) => ({
    fontFamily:   C.mono,
    fontSize:     isMobile ? 11 : 12,
    padding:      isMobile ? '5px 10px' : '5px 13px',
    borderRadius: 8,
    border:       `1px solid ${active ? 'rgba(91,110,245,.45)' : C.border}`,
    cursor:       'pointer',
    whiteSpace:   'nowrap',
    background:   active ? 'rgba(91,110,245,.15)' : 'transparent',
    color:        active ? C.t1 : C.t3,
  })

  const Chips = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
      {WINDOWS.map(w => (
        <button key={w.key} onClick={() => changeWin(w.key)} style={chip(activeWin === w.key)}>
          {w.label}
        </button>
      ))}
    </div>
  )

  // ── Date pickers para modo Personalizado ─────────────────────────────────
  const inputStyle = {
    background:   'rgba(20,27,46,.8)',
    border:       `1px solid ${C.border}`,
    borderRadius: 8,
    color:        C.t1,
    fontFamily:   C.mono,
    fontSize:     12,
    padding:      '6px 10px',
    colorScheme:  'dark',
    outline:      'none',
  }

  const CustomPickers = activeWin === 'custom' && (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
      <input
        type="date" value={customFrom}
        max={customTo || today}
        onChange={e => setCustomFrom(e.target.value)}
        style={inputStyle}
      />
      <span style={{ fontFamily: C.mono, fontSize: 11, color: C.t3 }}>—</span>
      <input
        type="date" value={customTo}
        min={customFrom} max={today}
        onChange={e => setCustomTo(e.target.value)}
        style={inputStyle}
      />
      {extLoading && (
        <span style={{ fontFamily: C.mono, fontSize: 11, color: C.t3 }}>Cargando…</span>
      )}
    </div>
  )

  // ── Estado vacío / cargando ──────────────────────────────────────────────
  if (pts.length < 2) {
    const msg = extLoading
      ? 'Cargando datos históricos…'
      : 'Necesitamos más datos para mostrar la evolución en esta ventana — seguí monitoreando.'
    return (
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: C.title, fontWeight: 700, fontSize: 16, color: C.t1, marginBottom: 14 }}>
          Evolución
        </h2>
        {Chips}
        {CustomPickers}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 18, padding: '40px 24px', textAlign: 'center',
        }}>
          <p style={{ fontFamily: C.body, fontSize: 14, color: C.t2, margin: '0 0 8px', lineHeight: 1.6 }}>
            {msg}
          </p>
          {!extLoading && (
            <span style={{ fontFamily: C.mono, fontSize: 11, color: C.t3 }}>
              {pts.length} de 2 puntos mínimos en la ventana seleccionada
            </span>
          )}
        </div>
      </section>
    )
  }

  const summary = scoreSummary(pts, activeWin)

  // ── Dimensiones del SVG ─────────────────────────────────────────────────
  const VW = isMobile ? 360 : 600
  const VH = isMobile ? 210 : 230
  const PL = isMobile ? 36  : 44
  const PR = isMobile ? 12  : 20
  const PT = 18
  const PB = isMobile ? 36  : 42
  const CW = VW - PL - PR
  const CH = VH - PT - PB

  const xs = pts.map((_, i) =>
    pts.length === 1 ? PL + CW / 2 : PL + (i / (pts.length - 1)) * CW
  )
  const ys = pts.map(p => PT + (1 - p.score / 100) * CH)

  const polyPts = pts.map((_, i) => `${xs[i]},${ys[i]}`).join(' ')

  const areaD = [
    `M${xs[0]},${ys[0]}`,
    pts.slice(1).map((_, i) => `L${xs[i + 1]},${ys[i + 1]}`).join(''),
    `L${xs[xs.length - 1]},${PT + CH}`,
    `L${xs[0]},${PT + CH}Z`,
  ].join('')

  const yTicks = [0, 25, 50, 75, 100]
  const lblIdx = labelIndices(pts.length, isMobile)
  const fSz    = isMobile ? 9  : 10
  const fSzTip = isMobile ? 11 : 13

  const sumBg  = summary.delta > 0 ? 'rgba(61,220,132,.08)'  : summary.delta < 0 ? 'rgba(242,99,126,.08)'  : 'rgba(130,150,220,.06)'
  const sumBdr = summary.delta > 0 ? 'rgba(61,220,132,.18)'  : summary.delta < 0 ? 'rgba(242,99,126,.18)'  : C.border
  const sumCol = summary.delta > 0 ? C.greenText              : summary.delta < 0 ? C.red                   : C.t2
  const sumPfx = summary.delta > 0 ? '↑' : summary.delta < 0 ? '↓' : '→'

  // Stat del header según ventana activa
  const headerStat = (() => {
    if (activeWin === 'custom') return `${pts.length} punto${pts.length !== 1 ? 's' : ''}`
    if (activeWin === '24h') {
      const unit = isHourly ? 'hora' : 'punto'
      return `${pts.length} ${unit}${pts.length !== 1 ? 's' : ''} · 24 h`
    }
    const label = { '7d': '7 d', '30d': '30 d', '90d': '90 d' }[activeWin] ?? ''
    return `${pts.length} día${pts.length !== 1 ? 's' : ''} · últimos ${label}`
  })()

  // Tooltip: un poco más ancho en modo hora para que quepa la fecha+hora
  const bW = showTime ? 132 : 118

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontFamily: C.title, fontWeight: 700, fontSize: 16, color: C.t1 }}>
          Evolución
        </h2>
        <span style={{ fontFamily: C.mono, fontSize: 11, color: C.t3 }}>
          {headerStat}
        </span>
      </div>

      {Chips}
      {CustomPickers}

      <div style={{
        background: 'linear-gradient(160deg, rgba(20,27,46,.5) 0%, rgba(8,11,18,.2) 100%)',
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        padding: isMobile ? '20px 14px 16px' : '28px 28px 20px',
      }}>

        {/* ── Gráfico SVG ─────────────────────────────────────────────── */}
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          width="100%"
          style={{ display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={C.accent} stopOpacity="0.16" />
              <stop offset="100%" stopColor={C.accent} stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="scoreLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={C.accent} />
              <stop offset="100%" stopColor="#7c5bf5" />
            </linearGradient>
          </defs>

          {/* Grid horizontal + labels Y */}
          {yTicks.map(t => {
            const y = PT + (1 - t / 100) * CH
            return (
              <g key={t}>
                <line
                  x1={PL} y1={y} x2={PL + CW} y2={y}
                  stroke={C.border}
                  strokeWidth={t === 0 || t === 100 ? 0.8 : 0.5}
                  strokeDasharray={t === 0 || t === 100 ? undefined : '3 3'}
                />
                <text
                  x={PL - 6} y={y + 3.5}
                  textAnchor="end" fill={C.t3}
                  fontSize={fSz} fontFamily={C.mono}
                >
                  {t}
                </text>
              </g>
            )
          })}

          {/* Área rellena bajo la línea */}
          <path d={areaD} fill="url(#scoreAreaGrad)" />

          {/* Línea */}
          <polyline
            points={polyPts}
            fill="none"
            stroke="url(#scoreLineGrad)"
            strokeWidth={isMobile ? 1.5 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Puntos + zonas de hit invisibles */}
          {pts.map((p, i) => {
            const isManual = p.triggered_by === 'manual'
            const isHov    = hovered === i
            const rVis     = isManual ? (isMobile ? 3.5 : 4.5) : (isMobile ? 2 : 2.5)
            return (
              <g key={i}>
                <circle
                  cx={xs[i]} cy={ys[i]} r={isMobile ? 10 : 12}
                  fill="transparent"
                  onMouseEnter={() => setHovered(i)}
                  style={{ cursor: 'crosshair' }}
                />
                <circle
                  cx={xs[i]} cy={ys[i]}
                  r={isHov ? rVis + 1.5 : rVis}
                  fill={isManual ? C.green : C.accent}
                  stroke={isManual ? C.green : C.accent}
                  strokeOpacity={isHov ? 0.3 : 0}
                  strokeWidth={isHov ? 5 : 0}
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            )
          })}

          {/* Labels eje X — hora o fecha según ventana */}
          {lblIdx.map(i => {
            const anchor = i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'
            return (
              <text
                key={i}
                x={xs[i]} y={PT + CH + (isMobile ? 20 : 24)}
                textAnchor={anchor}
                fill={C.t3}
                fontSize={fSz} fontFamily={C.mono}
              >
                {fmtXLabel(pts[i].completed_at, showTime)}
              </text>
            )
          })}

          {/* Tooltip */}
          {hovered !== null && (() => {
            const p      = pts[hovered]
            const x      = xs[hovered]
            const y      = ys[hovered]
            const isM    = p.triggered_by === 'manual'
            const bH     = isM ? 58 : 48
            const bX     = Math.max(PL, Math.min(x - bW / 2, PL + CW - bW))
            const nearTop = y < bH + 16
            const bY     = nearTop ? y + 14 : y - bH - 12

            return (
              <g style={{ pointerEvents: 'none' }}>
                <line
                  x1={x} y1={nearTop ? y + 4 : y - 4}
                  x2={x} y2={nearTop ? bY : bY + bH}
                  stroke={C.borderHi} strokeWidth={0.8} strokeDasharray="2 2"
                />
                <rect
                  x={bX} y={bY} width={bW} height={bH}
                  rx={7} fill={C.cardSolid}
                  stroke={C.borderHi} strokeWidth={0.8}
                />
                <text
                  x={bX + bW / 2} y={bY + 18}
                  textAnchor="middle" fill={C.t1}
                  fontSize={fSzTip} fontFamily={C.title} fontWeight={700}
                >
                  {p.score}
                </text>
                <text
                  x={bX + bW / 2} y={bY + 33}
                  textAnchor="middle" fill={C.t3}
                  fontSize={isMobile ? 8 : 9} fontFamily={C.mono}
                >
                  {fmtTooltipDate(p.completed_at, showTime)}
                </text>
                {isM && (
                  <text
                    x={bX + bW / 2} y={bY + 48}
                    textAnchor="middle" fill={C.greenText}
                    fontSize={isMobile ? 7 : 8} fontFamily={C.mono}
                  >
                    MANUAL
                  </text>
                )}
              </g>
            )
          })()}
        </svg>

        {/* ── Leyenda + resumen ────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
          marginTop: 6,
          paddingTop: 14, borderTop: `1px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {[
              { col: C.accent, label: 'Automático', r: 2.5 },
              { col: C.green,  label: 'Manual',      r: 4.5 },
            ].map(({ col, label, r }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width={Math.ceil(r * 2 + 2)} height={Math.ceil(r * 2 + 2)} style={{ flexShrink: 0 }}>
                  <circle cx={r + 1} cy={r + 1} r={r} fill={col} />
                </svg>
                <span style={{ fontFamily: C.mono, fontSize: 10, color: C.t3 }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: sumBg, border: `1px solid ${sumBdr}`,
            borderRadius: 10, padding: '7px 13px',
          }}>
            <span style={{ fontSize: 13, color: sumCol, fontWeight: 600, fontFamily: C.body }}>
              {sumPfx} {summary.text}
            </span>
          </div>
        </div>

      </div>
    </section>
  )
}
