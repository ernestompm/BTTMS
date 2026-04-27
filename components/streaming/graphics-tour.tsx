'use client'
// ============================================================================
// Streaming Graphics — TOUR skin (estilo WTA broadcast)
// ============================================================================
// Inspirado en la l\u00ednea gr\u00e1fica del WTA Tour (Qatar, Indian Wells...):
// scorebug compacto navy con tabs verdes, lower thirds limpios, weather bar
// horizontal. Selector v\u00eda tournament.scoreboard_config.graphics_style:'tour'.
// ============================================================================

import type { Score, Tournament, Sponsor, WeatherData } from '@/types'
import { animStyle, hexAlpha, flagPath, firstSurname } from './stage-shared'

// ─── Paleta TOUR ───────────────────────────────────────────────────────────
const TOUR = {
  bg:      'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
  border:  'rgba(255,255,255,.08)',
  text:    '#ffffff',
  textDim: 'rgba(255,255,255,.55)',
  setTab:  'rgba(255,255,255,.06)',     // celda set inactive
  setBorder: 'rgba(255,255,255,.10)',
  setWon:  '#10b981',                    // verde set ganado
  setCurrent: 'rgba(16,185,129,.18)',
  setCurrentBorder: '#10b981',
  pts:     '#10b981',                    // tab puntos por defecto
  ptsTb:   '#fbbf24',                    // tab puntos en TB
  serve:   '#fde047',                    // dot saque amarillo
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const PTS = ['0','15','30','40']
function pointDisplay(score: Score | null, team: 1|2): string {
  if (!score) return '0'
  const k = team===1 ? 't1' : 't2'
  if (score.super_tiebreak_active || score.tiebreak_active) return String(score.tiebreak_score?.[k] ?? 0)
  if (score.deuce) return '40'
  return PTS[score.current_game?.[k] ?? 0] ?? '0'
}
function setsForTeam(score: Score | null, team: 1|2): Array<number|null> {
  const out: Array<number|null> = [null, null, null]
  if (!score) return out
  const k = team===1 ? 't1' : 't2'
  const sets = score.sets ?? []
  for (let i = 0; i < Math.min(3, sets.length); i++) out[i] = sets[i][k]
  if (score.match_status === 'in_progress') {
    const idx = sets.length
    if (idx < 3) {
      out[idx] = score.super_tiebreak_active
        ? (score.tiebreak_score?.[k] ?? 0)
        : (score.current_set?.[k] ?? 0)
    }
  }
  return out
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ SCOREBUG TOUR                                                            ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function ScorebugTour({ visible, match, tickerStat }: { visible:boolean, match:any, tickerStat?: string | null }) {
  if (!match) return null
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const serving = match.serving_team as 1|2|null
  const inProgress = score?.match_status === 'in_progress'
  const setsPlayed = score?.sets?.length ?? 0
  const setCount = Math.max(1, Math.min(3, setsPlayed + (inProgress ? 1 : 0)))
  const currentSetIdx = inProgress ? setsPlayed : -1

  return (
    <div style={{
      position:'absolute', bottom:60, left:60,
      ...animStyle(visible, 'sgInU', 'sgOutU', 600, 'cubic-bezier(.19,1,.22,1)'),
    }}>
      <div style={{
        background: TOUR.bg,
        border: `1px solid ${TOUR.border}`,
        borderRadius: 8,
        boxShadow: '0 12px 32px rgba(0,0,0,.55)',
        overflow: 'hidden',
        padding: 4,
      }}>
        <table style={{ borderCollapse:'separate', borderSpacing:4 }}>
          <tbody>
            {[1,2].map(tn => {
              const team = tn as 1|2
              const entry = team===1 ? match.entry1 : match.entry2
              const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
              const sets = setsForTeam(score, team).slice(0, setCount)
              const pt = pointDisplay(score, team)
              const isServe = serving === team
              const tbActive = score?.tiebreak_active || score?.super_tiebreak_active

              const nameStr = isDoubles
                ? players.map((p:any) => firstSurname(p).toUpperCase()).join(' / ')
                : (players[0]?.last_name ?? '').toUpperCase()
              const initials = isDoubles
                ? players.map((p:any) => (p?.first_name?.[0] ?? '').toUpperCase() + '.').join(' ')
                : (players[0]?.first_name?.[0] ?? '').toUpperCase() + '.'

              return (
                <tr key={team}>
                  {/* Serve dot */}
                  <td style={{ width:14, paddingLeft:6 }}>
                    {isServe && (
                      <span style={{ display:'block', width:10, height:10, borderRadius:'50%', background: TOUR.serve, boxShadow:`0 0 8px ${TOUR.serve}`, animation:'sgSrvPulse 1.4s infinite' }}/>
                    )}
                  </td>
                  {/* Flag */}
                  <td>
                    <img src={flagPath(players[0]?.nationality)} alt="" style={{ display:'block', width:24, height:16, borderRadius:2, objectFit:'cover' }}/>
                  </td>
                  {/* Name */}
                  <td style={{ paddingLeft:8, paddingRight:14 }}>
                    <span style={{ display:'inline-flex', alignItems:'baseline', gap:6, fontFamily:"'Roboto', system-ui, sans-serif" }}>
                      <span style={{ color: TOUR.textDim, fontSize:14, fontWeight:500, letterSpacing:'.02em' }}>{initials}</span>
                      <span style={{ color: TOUR.text, fontSize:18, fontWeight:700, letterSpacing:'.01em' }}>{nameStr}</span>
                      {entry?.seed && <span style={{ color: TOUR.textDim, fontSize:12, fontWeight:500, marginLeft:2 }}>({entry.seed})</span>}
                    </span>
                  </td>
                  {/* Set tabs */}
                  {sets.map((v, i) => {
                    const op = sets // not used here; we infer winner via threeSetsFor of opponent if needed
                    const isCurrent = i === currentSetIdx
                    const opSets = setsForTeam(score, team===1 ? 2 : 1)
                    const isWonSet = i < setsPlayed && v != null && opSets[i] != null && v > (opSets[i] as number)
                    const bg = isWonSet ? TOUR.setWon : isCurrent ? TOUR.setCurrent : TOUR.setTab
                    const border = isCurrent && !isWonSet ? `1px solid ${TOUR.setCurrentBorder}` : `1px solid ${TOUR.setBorder}`
                    return (
                      <td key={i}>
                        <div style={{
                          width:30, height:28,
                          display:'grid', placeItems:'center',
                          background: bg, border,
                          borderRadius: 4,
                          color: TOUR.text, fontFamily:"'Roboto', system-ui, sans-serif",
                          fontSize:16, fontWeight:700, fontVariantNumeric:'tabular-nums',
                        }}>
                          {v === null ? '' : v}
                        </div>
                      </td>
                    )
                  })}
                  {/* Points tab */}
                  <td style={{ paddingLeft:2 }}>
                    <div style={{
                      width:46, height:28,
                      display:'grid', placeItems:'center',
                      background: tbActive ? TOUR.ptsTb : TOUR.pts,
                      borderRadius: 4,
                      color: tbActive ? '#1f1200' : '#fff', fontFamily:"'Roboto', system-ui, sans-serif",
                      fontSize:16, fontWeight:800, fontVariantNumeric:'tabular-nums',
                    }}>
                      {pt}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ BIG SCOREBOARD TOUR — barra horizontal centrada estilo WTA semifinal     ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function BigScoreboardTour({ visible, match, tournament }: { visible:boolean, match:any, tournament: Tournament | null }) {
  if (!match) return null
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const setsPlayed = score?.sets?.length ?? 0
  const inProgress = score?.match_status === 'in_progress'
  const setCount = Math.max(1, Math.min(3, setsPlayed + (inProgress ? 1 : 0)))

  const ROUND_LBL: Record<string,string> = { F:'FINAL', SF:'SEMIFINAL', QF:'CUARTOS DE FINAL', R16:'OCTAVOS DE FINAL', R32:'1/16' }

  return (
    <div style={{ position:'absolute', left:0, right:0, bottom:80, display:'flex', justifyContent:'center', pointerEvents:'none' }}>
      <div style={{
        ...animStyle(visible, 'sgInU', 'sgOutU', 700, 'cubic-bezier(.19,1,.22,1)'),
        pointerEvents:'auto', display:'inline-block',
      }}>
        {/* Round label */}
        <div style={{ textAlign:'center', marginBottom:6 }}>
          <span style={{ fontFamily:"'Roboto', system-ui, sans-serif", fontSize:18, fontWeight:600, letterSpacing:'.32em', color:'#fff', textTransform:'uppercase' }}>
            {ROUND_LBL[match.round ?? ''] ?? match.round ?? ''}
          </span>
        </div>
        {/* Scorebar */}
        <div style={{
          background: TOUR.bg, border:`1px solid ${TOUR.border}`,
          borderRadius:8, padding:'8px 12px',
          boxShadow:'0 18px 50px rgba(0,0,0,.6)',
        }}>
          <table style={{ borderCollapse:'separate', borderSpacing:'12px 4px' }}>
            <tbody>
              {[1,2].map(tn => {
                const team = tn as 1|2
                const entry = team===1 ? match.entry1 : match.entry2
                const players = [entry?.player1, isDoubles?entry?.player2:null].filter(Boolean)
                const sets = setsForTeam(score, team).slice(0, setCount)
                const opSets = setsForTeam(score, team===1?2:1).slice(0, setCount)

                const fullName = isDoubles
                  ? players.map((p:any) => `${(p?.first_name?.[0] ?? '').toUpperCase()}.${firstSurname(p).toUpperCase()}`).join(' / ')
                  : ((players[0]?.first_name ?? '') + ' ' + (players[0]?.last_name ?? '')).toUpperCase()

                return (
                  <tr key={team}>
                    {/* Flag */}
                    <td>
                      <img src={flagPath(players[0]?.nationality)} alt="" style={{ display:'block', width:28, height:18, borderRadius:2, objectFit:'cover' }}/>
                    </td>
                    {/* Name */}
                    <td style={{ minWidth:280 }}>
                      <span style={{ fontFamily:"'Roboto', system-ui, sans-serif", color:'#fff', fontSize:24, fontWeight:700, letterSpacing:'.01em', whiteSpace:'nowrap' }}>
                        {fullName}
                      </span>
                      {entry?.seed && <span style={{ marginLeft:8, color: TOUR.textDim, fontSize:16, fontWeight:500 }}>({entry.seed})</span>}
                    </td>
                    {/* Sets */}
                    {sets.map((v, i) => {
                      const isWon = v != null && opSets[i] != null && v > (opSets[i] as number)
                      return (
                        <td key={i}>
                          <div style={{
                            width:38, height:34, display:'grid', placeItems:'center',
                            background: isWon ? TOUR.setWon : TOUR.setTab,
                            border:`1px solid ${TOUR.setBorder}`,
                            borderRadius:4,
                            color:'#fff', fontFamily:"'Roboto', system-ui, sans-serif",
                            fontSize:22, fontWeight:700, fontVariantNumeric:'tabular-nums',
                          }}>
                            {v === null ? '' : v}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ PLAYER LOWER THIRD TOUR (versi\u00f3n alternativa de player_bio compacta)    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function PlayerLowerThirdTour({ visible, player, accent }: { visible:boolean, player: any, accent?: string }) {
  if (!player) return null
  const ac = accent ?? '#10b981'
  return (
    <div style={{ position:'absolute', bottom:90, left:80,
      ...animStyle(visible, 'sgInR', 'sgOutR', 700, 'cubic-bezier(.19,1,.22,1)') }}>
      <div style={{
        background: TOUR.bg, border:`1px solid ${TOUR.border}`,
        borderRadius:8, padding:'14px 22px', boxShadow:'0 18px 40px rgba(0,0,0,.6)',
        display:'flex', alignItems:'center', gap:18,
      }}>
        <span style={{ display:'block', width:6, height:42, background:ac, borderRadius:2 }}/>
        <img src={flagPath(player.nationality)} alt="" style={{ width:48, height:32, borderRadius:3, objectFit:'cover' }}/>
        <div style={{ display:'flex', flexDirection:'column', lineHeight:1, fontFamily:"'Roboto', system-ui, sans-serif" }}>
          <span style={{ fontSize:18, fontWeight:500, color: TOUR.textDim, letterSpacing:'.02em' }}>
            {(player.first_name ?? '').toUpperCase()}
          </span>
          <span style={{ fontSize:36, fontWeight:800, color: TOUR.text, marginTop:4, letterSpacing:'.005em' }}>
            {(player.last_name ?? '').toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ WEATHER BAR TOUR (lower bar horizontal con icono+label+valor)            ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function WeatherBarTour({ visible, weather, tournament }: { visible:boolean, weather: WeatherData | null, tournament: Tournament | null }) {
  if (!weather) return null
  const venue = tournament?.venue_city ?? tournament?.venue_name ?? 'SEDE'
  const condIcon: Record<string,string> = {
    'Despejado':'☀️', 'Parcialmente nublado':'⛅', 'Niebla':'🌫️', 'Llovizna':'🌦️',
    'Lluvia':'🌧️', 'Nieve':'❄️', 'Chubascos':'🌦️', 'Tormenta':'⛈️', 'Desconocido':'🌡️',
  }
  return (
    <div style={{ position:'absolute', left:0, right:0, bottom:60, display:'flex', justifyContent:'center', pointerEvents:'none' }}>
      <div style={{
        ...animStyle(visible, 'sgInU', 'sgOutU', 700, 'cubic-bezier(.19,1,.22,1)'),
        pointerEvents:'auto',
        background: TOUR.bg, border:`1px solid ${TOUR.border}`,
        borderRadius:8, padding:'10px 18px', boxShadow:'0 18px 40px rgba(0,0,0,.55)',
        display:'flex', alignItems:'center', gap:24,
        fontFamily:"'Roboto', system-ui, sans-serif",
      }}>
        <span style={{ background: TOUR.pts, color:'#0f172a', padding:'6px 14px', borderRadius:4, fontWeight:800, fontSize:14, letterSpacing:'.24em', textTransform:'uppercase' }}>
          {venue} · WEATHER
        </span>
        <Metric icon="🌡" label="Temp" value={`${Math.round(weather.temperature_c)}°C / ${Math.round(weather.temperature_c*9/5+32)}°F`}/>
        <Metric icon={condIcon[weather.condition] ?? '🌡️'} label="Forecast" value={weather.condition.toUpperCase()}/>
        <Metric icon="💨" label="Wind" value={`${Math.round(weather.wind_speed_kmh)} km/h`}/>
        <Metric icon="💧" label="Humidity" value={`${weather.humidity_pct}%`}/>
      </div>
    </div>
  )
}
function Metric({ icon, label, value }: { icon:string, label:string, value:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ fontSize:24, lineHeight:1 }}>{icon}</span>
      <div style={{ display:'flex', flexDirection:'column', lineHeight:1 }}>
        <span style={{ color: TOUR.textDim, fontSize:11, letterSpacing:'.22em', fontWeight:600, textTransform:'uppercase' }}>{label}</span>
        <span style={{ color: TOUR.text, fontSize:18, fontWeight:700, marginTop:3 }}>{value}</span>
      </div>
    </div>
  )
}
