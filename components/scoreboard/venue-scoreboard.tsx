'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Match, Score, Sponsor, ScoreboardConfig } from '@/types'
import { DEFAULT_SCOREBOARD_CONFIG } from '@/types'

interface Props {
  initialMatch: Match & { entry1: any; entry2: any; court: any }
  config: ScoreboardConfig | null
  tournamentName: string
  sponsors: Sponsor[]
  warmupDuration?: number
  weather: any
}

const PTS_LABEL = ['0', '15', '30', '40']
const ROUND_LABELS: Record<string, string> = {
  F: 'FINAL', SF: 'SEMIFINAL', QF: 'CUARTOS DE FINAL',
  R16: 'OCTAVOS DE FINAL', R32: 'DIECISEISAVOS',
}
const STATUS_LABELS: Record<string, string> = {
  scheduled:        'PRÓXIMO PARTIDO',
  judge_on_court:   'ÁRBITRO EN PISTA',
  players_on_court: 'JUGADORES EN PISTA',
  warmup:           'CALENTAMIENTO',
  suspended:        'PARTIDO SUSPENDIDO',
  finished:         'PARTIDO FINALIZADO',
  retired:          'ABANDONO',
  walkover:         'WALKOVER',
}
const SKIN_BG: Record<string, string> = {
  marbella: 'radial-gradient(1400px 700px at 50% 0%, #1d3a5f 0%, #0a1627 70%), #0a1627',
  noche:    'radial-gradient(1400px 700px at 50% 0%, #122a4a 0%, #04070e 70%), #04070e',
  arena:    'radial-gradient(1400px 700px at 50% 0%, #f3e4c7 0%, #d9bf8a 70%), #d9bf8a',
}

function hexAlpha(hex: string, alpha: number) {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0')
}
function formatSecs(secs: number) {
  const abs = Math.abs(secs)
  const m = Math.floor(abs / 60), s = abs % 60
  return `${secs < 0 ? '+' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
function gameLabel(score: Score | null, team: 1 | 2): string {
  if (!score) return '0'
  const key = (`t${team}`) as 't1' | 't2'
  if (score.super_tiebreak_active || score.tiebreak_active) return String(score.tiebreak_score?.[key] ?? 0)
  if (score.advantage_team === team) return 'AD'
  if (score.advantage_team && score.advantage_team !== team) return '40'
  if (score.deuce) return '40'
  return PTS_LABEL[score.current_game?.[key] ?? 0] ?? '0'
}

export function VenueScoreboard({ initialMatch, config, tournamentName, sponsors: propSponsors, warmupDuration = 300 }: Props) {
  const supabase = createClient()
  const [match, setMatch] = useState(initialMatch)
  const [clock, setClock] = useState('')
  const [matchTime, setMatchTime] = useState('00:00')
  const [countdown, setCountdown] = useState<string | null>(null)
  const [rtStatus, setRtStatus] = useState<'connecting' | 'live' | 'error'>('connecting')
  const stageRef = useRef<HTMLDivElement>(null)

  const cfg = (config as any) ?? DEFAULT_SCOREBOARD_CONFIG
  const skin: string = cfg.skin ?? 'marbella'
  const showSeed = cfg.display?.show_rankings !== false
  const showFlags = cfg.display?.show_flags !== false
  const showServeIndicator = cfg.display?.show_serve_indicator !== false
  const showRound = cfg.display?.show_round !== false
  const showCourtName = cfg.display?.show_court_name !== false
  const showSponsors = cfg.sponsors?.enabled !== false
  const accentA: string = cfg.colors?.team1_accent ?? '#ef6a4c'
  const accentB: string = cfg.colors?.team2_accent ?? '#ef6a4c'
  const srvColor: string = cfg.colors?.serving_indicator ?? '#ef6a4c'
  const carouselSpeed: number = cfg.sponsors?.rotation_interval_seconds ?? 10

  // Robust realtime subscription — reconnects on error
  useEffect(() => {
    let channel = supabase
      .channel(`vsb-${match.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') setMatch(prev => ({ ...prev, ...(payload.new as any) }))
        }
      )
      .subscribe((status) => {
        setRtStatus(status === 'SUBSCRIBED' ? 'live' : status === 'CHANNEL_ERROR' ? 'error' : 'connecting')
      })
    return () => { supabase.removeChannel(channel) }
  }, [match.id])

  // Clock, match timer & warmup countdown
  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      const d = new Date(now)
      setClock(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
      if (match.started_at && !match.finished_at) {
        const secs = Math.floor((now - new Date(match.started_at).getTime()) / 1000)
        setMatchTime(formatSecs(secs))
      }
      if (match.status === 'warmup' && match.warmup_started_at) {
        const elapsed = Math.floor((now - new Date(match.warmup_started_at).getTime()) / 1000)
        setCountdown(formatSecs(warmupDuration - elapsed))
      } else {
        setCountdown(null)
      }
    }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [match.started_at, match.finished_at, match.status, match.warmup_started_at, warmupDuration])

  // 1920×1080 stage — always fills 100% screen
  useEffect(() => {
    const scale = () => {
      const s = stageRef.current; if (!s) return
      s.style.transform = `scaleX(${window.innerWidth / 1920}) scaleY(${window.innerHeight / 1080})`
    }
    scale(); window.addEventListener('resize', scale); return () => window.removeEventListener('resize', scale)
  }, [])

  const score = match.score as Score | null
  const entry1 = (match as any).entry1
  const entry2 = (match as any).entry2
  const isDoubles = match.match_type === 'doubles'

  const teamA = {
    seed: entry1?.seed,
    players: isDoubles ? [entry1?.player1, entry1?.player2].filter(Boolean) : [entry1?.player1].filter(Boolean),
    games: score?.current_set?.t1 ?? 0,
    point: gameLabel(score, 1),
  }
  const teamB = {
    seed: entry2?.seed,
    players: isDoubles ? [entry2?.player1, entry2?.player2].filter(Boolean) : [entry2?.player1].filter(Boolean),
    games: score?.current_set?.t2 ?? 0,
    point: gameLabel(score, 2),
  }

  // Dynamic set columns
  const scoringSystem = (match as any).scoring_system ?? ''
  const maxSets = (scoringSystem === 'pro_set' || scoringSystem === '7_games_tb') ? 1 : 3
  const completedSets = score?.sets?.length ?? 0
  const numSetCols = Math.min(completedSets + 1, maxSets)
  const setCols = Array.from({ length: numSetCols }, (_, i) => {
    const s = score?.sets?.[i]; const isCurrent = i === completedSets
    return { a: isCurrent ? null : (s?.t1 ?? null), b: isCurrent ? null : (s?.t2 ?? null), done: !isCurrent, current: isCurrent }
  })
  const setColW = numSetCols === 1 ? 210 : numSetCols === 2 ? 180 : 160
  const gridCols = `${showSeed ? '110px ' : ''}minmax(0,1fr) ${Array(numSetCols).fill(`${setColW}px`).join(' ')} 220px`

  const roundLabel = ROUND_LABELS[match.round ?? ''] ?? (match.round ?? '—')
  const courtLabel = showCourtName ? (match.court?.name ?? '') : ''
  const sponsorList = propSponsors?.length ? propSponsors : []
  const status = match.status as string

  // Winner (finished / retired / walkover)
  const winnerTeam: 1 | 2 | null =
    score?.winner_team ??
    ((score?.sets_won?.t1 ?? 0) > (score?.sets_won?.t2 ?? 0) ? 1 :
     (score?.sets_won?.t2 ?? 0) > (score?.sets_won?.t1 ?? 0) ? 2 : null)

  const isPreMatch = ['scheduled', 'judge_on_court', 'players_on_court', 'warmup'].includes(status)
  const isLive     = status === 'in_progress' || status === 'suspended'
  const isFinished = ['finished', 'retired', 'walkover'].includes(status)

  return (
    <>
      <style jsx global>{`
        html, body { margin:0; padding:0; background:#000; color:#fff; font-family:'Barlow Condensed',system-ui,sans-serif; overflow:hidden; height:100%; }
        @keyframes vsbBlink    { 0%,100%{opacity:1} 50%{opacity:.2} }
        @keyframes vsbSrvPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,106,76,.7)} 50%{box-shadow:0 0 0 18px rgba(239,106,76,0)} }
        @keyframes vsbSrvBadgePulse { 0%,100%{transform:scale(1);filter:brightness(1)} 50%{transform:scale(1.04);filter:brightness(1.18)} }
        @keyframes vsbSrvBallSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes cardIn      { from{opacity:0;transform:translateY(40px) scale(.97);filter:blur(10px)} to{opacity:1;transform:none;filter:blur(0)} }
        @keyframes vsIn        { from{opacity:0;transform:scale(.5) rotate(-8deg);filter:blur(10px)} to{opacity:1;transform:none;filter:blur(0)} }
        @keyframes phaseIn     { from{opacity:0;transform:translateY(26px) scale(.985);filter:blur(12px)} to{opacity:1;transform:none;filter:blur(0)} }
        @keyframes cntPulse    { 0%,100%{opacity:1} 50%{opacity:.55} }
      `}</style>

      <div className="fixed inset-0 bg-black overflow-hidden">
        <div ref={stageRef} className="absolute" style={{ width:1920, height:1080, top:0, left:0, transformOrigin:'top left', background: SKIN_BG[skin] ?? SKIN_BG.marbella }}>

          {/* LED texture */}
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:'repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 1px,transparent 1px 4px),repeating-linear-gradient(90deg,rgba(0,0,0,.22) 0 1px,transparent 1px 4px)', mixBlendMode:'multiply', opacity:.35 }} />

          {/* Realtime dot */}
          <div style={{ position:'absolute', top:20, right:20, zIndex:100, width:14, height:14, borderRadius:'50%', background: rtStatus==='live'?'#34d399':rtStatus==='error'?'#f87171':'#fbbf24', boxShadow:`0 0 10px ${rtStatus==='live'?'#34d399':rtStatus==='error'?'#f87171':'#fbbf24'}`, opacity:.9 }} />

          {/* ── HEADER (all screens) ──────────────────────────── */}
          <div className="absolute top-0 left-0 right-0 z-10" style={{ height:160, padding:'0 56px', display:'grid', gridTemplateColumns:'minmax(0,1.4fr) auto minmax(0,1fr)', alignItems:'center', gap:32, background:'linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,0) 100%)' }}>
            {/* IZQ — logo + nombre torneo (auto-escalable, 2 lineas max) */}
            <div style={{ display:'flex', alignItems:'center', gap:22, minWidth:0 }}>
              {cfg.logos?.tournament_logo_url
                ? <img src={cfg.logos.tournament_logo_url} alt={tournamentName} style={{ flex:'none', width:78, height:78, borderRadius:14, objectFit:'contain' }} />
                : <div style={{ flex:'none', width:78, height:78, borderRadius:14, background:'radial-gradient(circle at 30% 30%,#f3e4c7 0 20px,transparent 20.5px),linear-gradient(135deg,#ef6a4c 0%,#d94a2e 100%)', boxShadow:'0 10px 32px rgba(239,106,76,.55)' }} />
              }
              <div style={{ minWidth:0, lineHeight:1.05 }}>
                <span style={{ fontWeight:900, fontSize:(tournamentName?.length ?? 0) > 24 ? 40 : 50, letterSpacing:'.04em', textTransform:'uppercase', display:'block' }}>
                  {(tournamentName||'TENIS PLAYA').toUpperCase()}
                </span>
              </div>
            </div>
            {/* CENTRO — pill de la fase */}
            <div style={{ display:'flex', justifyContent:'center', alignItems:'center', whiteSpace:'nowrap' }}>
              {showRound && <span style={{ padding:'14px 38px', background:srvColor, color:'#fff', borderRadius:999, fontWeight:900, fontSize:38, letterSpacing:'.18em', textTransform:'uppercase', textAlign:'center', boxShadow:`0 8px 24px ${hexAlpha(srvColor,.45)}` }}>{roundLabel}</span>}
            </div>
            {/* DCHA — solo duracion del partido con icono de cronometro */}
            <div style={{ display:'flex', alignItems:'center', gap:14, justifyContent:'flex-end', whiteSpace:'nowrap' }}>
              {(isLive || isFinished) ? (
                <>
                  {/* Icono cron\u00f3metro SVG */}
                  <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:.85 }}>
                    <circle cx="12" cy="13" r="8"/>
                    <path d="M12 9v4l2.5 2.5"/>
                    <path d="M9 2h6"/>
                    <path d="M12 2v3"/>
                  </svg>
                  <div style={{ display:'flex', flexDirection:'column', lineHeight:1, alignItems:'flex-start' }}>
                    <span style={{ fontSize:14, letterSpacing:'.32em', fontWeight:800, opacity:.55, textTransform:'uppercase' }}>Tiempo</span>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:54, letterSpacing:'.05em', fontWeight:800, marginTop:4 }}>{matchTime}</span>
                  </div>
                </>
              ) : (
                <span style={{ fontSize:18, letterSpacing:'.32em', textTransform:'uppercase', opacity:.55, fontWeight:800 }}>—</span>
              )}
            </div>
          </div>

          {/* ── PRE-MATCH ────────────────────────────────────── */}
          {(() => {
            if (!isPreMatch) return null
            const isDoubles = teamA.players.length > 1
            // Nombres SIEMPRE al tamaño grande fijo. Si el apellido no entra
            // en una linea, simplemente WRAP a 2 lineas en el espacio entre
            // palabras (GARCIA MARTINEZ -> GARCIA / MARTINEZ). Asi nunca
            // achicamos la tipografia y la simetria visual se mantiene
            // porque ambos lados usan el mismo fontSize y un line-height
            // tight (.86) que hace los wraps compactos.
            const nameFs = isDoubles ? 110 : 156
            return (
            <div className="absolute z-10" style={{ left:64, right:64, top:172, bottom: showSponsors&&sponsorList.length>0?252:60, display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:40, alignItems:'stretch', animation:'phaseIn .75s cubic-bezier(.2,.9,.25,1) both' }}>

              {/* Team A card */}
              <PreMatchTeamCard team={teamA} accent={accentA} isRight={false} showFlags={showFlags} showSeed={showSeed} nameFs={nameFs} />

              {/* VS column — vuelvo al ancho original (320 minWidth) y al
                  VS gigante (300px). Los apellidos largos los resolvemos
                  con wrap, no comiendole espacio a esta columna. */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', animation:'vsIn .9s cubic-bezier(.2,.9,.25,1) .15s both', minWidth:320 }}>
                <div style={{ fontSize:34, letterSpacing:'.48em', opacity:.72, textTransform:'uppercase', fontWeight:800, marginBottom:24, textAlign:'center', lineHeight:1.2, whiteSpace:'nowrap' }}>
                  {STATUS_LABELS[status] ?? 'PRÓXIMO PARTIDO'}
                </div>
                <div style={{ fontSize:300, fontWeight:900, lineHeight:.82, color:accentA, letterSpacing:'-.04em', textShadow:`0 20px 80px ${hexAlpha(accentA,.5)}` }}>
                  VS
                </div>
                <div style={{ marginTop:28, textAlign:'center' }}>
                  {status==='warmup' && countdown!=null
                    ? <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:120, letterSpacing:'.04em', fontWeight:900, color: countdown.startsWith('+')?'#f87171':accentA, animation:'cntPulse 1s ease infinite', display:'block', lineHeight:1, textShadow:`0 0 60px ${hexAlpha(accentA,.45)}` }}>{countdown}</span>
                    : <span style={{ fontSize:34, letterSpacing:'.22em', opacity:.88, textTransform:'uppercase', fontWeight:800, lineHeight:1.3, display:'block', whiteSpace:'nowrap' }}>
                        {match.scheduled_at
                          ? `A LAS ${new Date(match.scheduled_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`
                          : match.court?.name ?? ''}
                      </span>
                  }
                </div>
              </div>

              {/* Team B card */}
              <PreMatchTeamCard team={teamB} accent={accentB} isRight={true} showFlags={showFlags} showSeed={showSeed} nameFs={nameFs} />
            </div>
            )
          })()}

          {/* ── LIVE SCOREBOARD ──────────────────────────────── */}
          {isLive && (
            <>
              {/* Suspended overlay */}
              {status === 'suspended' && (
                <div className="absolute inset-0 z-30" style={{ display:'grid', placeItems:'center', background:'rgba(0,0,0,.55)' }}>
                  <span style={{ padding:'24px 72px', background:'#f59e0b', color:'#000', borderRadius:16, fontWeight:900, fontSize:72, letterSpacing:'.22em', textTransform:'uppercase', boxShadow:'0 0 80px rgba(245,158,11,.6)' }}>
                    SUSPENDIDO
                  </span>
                </div>
              )}

              {/* Column labels */}
              <div className="absolute z-10" style={{ left:64, right:64, top:190, height:30, display:'grid', gridTemplateColumns:gridCols, alignItems:'center', pointerEvents:'none' }}>
                {showSeed && <div />}
                <div />
                {setCols.map((_,i) => <div key={i} style={{ fontWeight:700, letterSpacing:'.28em', fontSize:28, opacity:.65, textAlign:'center', textTransform:'uppercase' }}>SET {i+1}</div>)}
                <div style={{ fontWeight:700, letterSpacing:'.28em', fontSize:28, opacity:.65, textAlign:'center', textTransform:'uppercase' }}>PUNTOS</div>
              </div>

              {/* Score rows */}
              <div className="absolute z-10" style={{ left:64, right:64, top:230, bottom: showSponsors && sponsorList.length ? 260 : 60, display:'grid', gridTemplateRows:'1fr 1fr', gap:26 }}>
                {(['A','B'] as const).map(key => {
                  const t = key==='A' ? teamA : teamB
                  const accent = key==='A' ? accentA : accentB
                  const serving = (match.serving_team===1 && key==='A') || (match.serving_team===2 && key==='B')
                  return (
                    <TeamRowLED key={key} team={t} serving={serving} setCols={setCols} teamKey={key} isDoubles={isDoubles} servingPlayerId={match.current_server_id??null} gridCols={gridCols} accentColor={accent} servingColor={srvColor} showSeed={showSeed} showFlags={showFlags} showServeIndicator={showServeIndicator} />
                  )
                })}
              </div>

              {/* Sponsor bar */}
              {showSponsors && sponsorList.length > 0 && <SponsorBar sponsorList={sponsorList} />}
            </>
          )}

          {/* ── FINISHED ─────────────────────────────────────── */}
          {/* Misma layout que el pre-match (cards laterales con nombres
              grandes y bandera) pero en el centro, en vez del VS, se
              muestran los sets apilados con los resultados. El equipo
              ganador queda visualmente resaltado (fondo glow + borde
              accent + nombres bold + texto "GANA EL PARTIDO" debajo). */}
          {isFinished && (() => {
            // Sets a mostrar — fallback super TB orfano si el engine antiguo
            // no lo pusheo a score.sets
            const baseSets = score?.sets ?? []
            const tb = score?.tiebreak_score
            const hasOrphanSuperTB = !!(score?.super_tiebreak_active && tb && (tb.t1 > 0 || tb.t2 > 0))
            const displaySets = hasOrphanSuperTB
              ? [...baseSets, { t1: tb!.t1, t2: tb!.t2 }]
              : baseSets
            const isSuperTbAt = (i: number) => {
              const s = displaySets[i]
              if (!s) return false
              if (i === displaySets.length - 1 && (match.scoring_system === 'best_of_2_sets_super_tb' || hasOrphanSuperTB)) {
                if (i >= 2) return true
                if (Math.max(s.t1, s.t2) >= 10) return true
              }
              return false
            }

            // Tamaño compartido entre A y B para los apellidos (mismo
            // criterio que el pre-match) — sin autoshrink, con wrap a 2
            // lineas si el apellido lleva espacios.
            const isDoubles = teamA.players.length > 1
            const finishedNameFs = isDoubles ? 110 : 156

            return (
            <div className="absolute z-10" style={{
              left:64, right:64, top:172, bottom: showSponsors&&sponsorList.length>0?252:60,
              display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:40, alignItems:'stretch',
              animation:'phaseIn .75s cubic-bezier(.2,.9,.25,1) both',
            }}>

              {/* Team A card — reutiliza el mismo PreMatchTeamCard */}
              <FinishedTeamCard
                team={teamA} accent={accentA} isRight={false}
                showFlags={showFlags} showSeed={showSeed} nameFs={finishedNameFs}
                won={winnerTeam === 1}
              />

              {/* CENTER — set scores apilados en lugar del VS */}
              <div style={{
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                animation:'vsIn .9s cubic-bezier(.2,.9,.25,1) .15s both', minWidth:340,
              }}>
                {/* Status banner arriba (PARTIDO FINALIZADO / RETIRADO / W.O.) */}
                <div style={{
                  fontSize:30, letterSpacing:'.36em', opacity:.85, textTransform:'uppercase',
                  fontWeight:900, marginBottom:24, textAlign:'center', lineHeight:1.2,
                  whiteSpace:'nowrap', color:accentA,
                }}>
                  {STATUS_LABELS[status] ?? status.toUpperCase()}
                  {status === 'retired' && match.retired_team ? ` (Eq.${match.retired_team})` : ''}
                </div>

                {/* Set scores stacked — t1-t2 separados por dash, ganador
                    de cada set se ve en color del equipo */}
                <div style={{ display:'flex', flexDirection:'column', gap:18, alignItems:'center' }}>
                  {displaySets.map((s, i) => {
                    const aWon = s.t1 > s.t2
                    const bWon = s.t2 > s.t1
                    const isTb = isSuperTbAt(i)
                    return (
                      <div key={i} style={{
                        display:'flex', flexDirection:'column', alignItems:'center', lineHeight:1,
                      }}>
                        {/* Label set / super TB */}
                        <span style={{
                          fontSize: isTb ? 22 : 22,
                          letterSpacing:'.32em', textTransform:'uppercase',
                          fontWeight:800,
                          color: isTb ? '#fbbf24' : 'rgba(255,255,255,.55)',
                          marginBottom:6,
                        }}>
                          {isTb ? 'SUPER TB' : `SET ${i+1}`}
                        </span>
                        {/* Score */}
                        <div style={{
                          display:'flex', alignItems:'baseline', gap:18,
                          fontSize:140, fontWeight:900, lineHeight:.95,
                          letterSpacing:'-.025em', fontVariantNumeric:'tabular-nums',
                        }}>
                          <span style={{ color: aWon ? accentA : 'rgba(255,255,255,.55)' }}>{s.t1}</span>
                          <span style={{ color:'rgba(255,255,255,.30)', fontWeight:600 }}>—</span>
                          <span style={{ color: bWon ? accentB : 'rgba(255,255,255,.55)' }}>{s.t2}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Tiempo total del partido */}
                {match.started_at && (
                  <div style={{
                    marginTop:30,
                    fontSize:20, letterSpacing:'.28em', opacity:.65, textTransform:'uppercase',
                    fontWeight:800, textAlign:'center',
                  }}>
                    {`Duración · ${matchTime}`}
                  </div>
                )}
              </div>

              {/* Team B card */}
              <FinishedTeamCard
                team={teamB} accent={accentB} isRight={true}
                showFlags={showFlags} showSeed={showSeed} nameFs={finishedNameFs}
                won={winnerTeam === 2}
              />
            </div>
            )
          })()}

          {/* Sponsor bar for pre-match and finished */}
          {(isPreMatch || isFinished) && showSponsors && sponsorList.length > 0 && (
            <SponsorBar sponsorList={sponsorList} />
          )}

        </div>
      </div>
    </>
  )
}

// ── Sponsor bar ───────────────────────────────────────────────────────────────
// Fills the full 1920px stage regardless of sponsor count using dynamic keyframes.
function SponsorBar({ sponsorList }: { sponsorList: Sponsor[] }) {
  const CARD_W = 340, CARD_GAP = 80
  const cardSlot = CARD_W + CARD_GAP  // 420px per slot
  const oneSetW = sponsorList.length * cardSlot
  // Fill 1920px stage + buffer for seamless loop
  const copies = Math.max(4, Math.ceil((1920 * 2) / oneSetW) + 1)
  // Fixed scroll speed: 80px/s regardless of sponsor count
  const duration = Math.round(oneSetW / 80)
  const kf = `@keyframes vsbMarqueeDyn{0%{transform:translateX(0)}100%{transform:translateX(-${oneSetW}px)}}`

  return (
    <div className="absolute z-10" style={{ left:0, right:0, bottom:0, height:240, background:'linear-gradient(180deg,rgba(0,0,0,.1) 0%,rgba(0,0,0,.4) 100%)', borderTop:'3px solid rgba(255,255,255,.08)', display:'grid', gridTemplateRows:'48px 1fr' }}>
      <style dangerouslySetInnerHTML={{ __html: kf }} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:28, fontWeight:700, letterSpacing:'.42em', fontSize:24, opacity:.7, textTransform:'uppercase' }}>
        <i style={{ display:'block', width:40, height:2, background:'currentColor', opacity:.4 }} />
        Patrocinadores oficiales
        <i style={{ display:'block', width:40, height:2, background:'currentColor', opacity:.4 }} />
      </div>
      <div style={{ position:'relative', overflow:'hidden', height:192 }}>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', display:'flex', alignItems:'center', animation:`vsbMarqueeDyn ${duration}s linear infinite` }}>
          {Array.from({ length: copies }).flatMap((_, ci) =>
            sponsorList.map((sp, i) => (
              <div key={`${ci}-${i}`} style={{ flex:'none', display:'flex', alignItems:'center', justifyContent:'center', width:CARD_W, height:160, margin:`0 ${CARD_GAP/2}px` }}>
                {sp.logo_url
                  ? <img src={sp.logo_url} alt={sp.name} style={{ maxHeight:150, maxWidth:CARD_W, objectFit:'contain' }} />
                  : <span style={{ fontWeight:800, fontSize:36, letterSpacing:'.06em', textTransform:'uppercase', color:'rgba(255,255,255,.85)', whiteSpace:'nowrap' }}>{sp.name}</span>
                }
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pre-match team card ───────────────────────────────────────────────────────
interface PreMatchTeamCardProps {
  team: { seed: number|undefined; players: any[]; games: number; point: string }
  accent: string
  isRight: boolean
  showFlags: boolean
  showSeed: boolean
  /** tamaño compartido entre ambos equipos (para simetría) */
  nameFs?: number
}
function PreMatchTeamCard({ team, accent, isRight, showFlags, showSeed, nameFs }: PreMatchTeamCardProps) {
  const isDoubles = team.players.length > 1
  const fs = nameFs ?? (isDoubles ? 110 : 156)
  return (
    <div style={{
      display:'flex', flexDirection:'column', justifyContent:'center',
      // Padding restaurado a 48x52 (estaba en 32x36 que dejaba el card "vacio"
      // arriba/abajo). Ahora distribuimos el espacio vertical con space-around
      // si hay seed, asi seed-nombre-nombre se reparten bien.
      gap: isDoubles ? 32 : 0,
      padding:'48px 52px', borderRadius:14,
      background:'linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.02))',
      border:'1px solid rgba(255,255,255,.09)',
      borderTop:`8px solid ${accent}`,
      alignItems: isRight ? 'flex-end' : 'flex-start',
      animation:`cardIn .75s cubic-bezier(.2,.9,.25,1) ${isRight?'.2s':'0s'} both`,
      overflow:'hidden',
      minWidth: 0,
    }}>
      {/* Seed */}
      {showSeed && team.seed && (
        <div style={{ fontWeight:900, fontSize:60, letterSpacing:'.24em', color:`${hexAlpha(accent,.75)}`, lineHeight:1 }}>
          ({team.seed})
        </div>
      )}

      {/* Nombres + bandera */}
      <div style={{ display:'flex', flexDirection:'column', gap: isDoubles ? 36 : 0, alignItems: isRight?'flex-end':'flex-start', width:'100%' }}>
        {team.players.map((p:any, i:number) => {
          const nat = (p?.nationality ?? 'ESP').toUpperCase()
          const last = (p?.last_name ?? p?.name ?? '').toUpperCase()
          const first = (p?.first_name ?? '').toUpperCase()
          return (
            <div key={p?.id??i} style={{ display:'flex', alignItems:'center', gap:20, flexDirection: isRight?'row-reverse':'row', width:'100%', minWidth:0 }}>
              {showFlags && (
                <span style={{ flex:'none', width:78, height:54, borderRadius:6, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,.4),inset 0 0 0 1px rgba(0,0,0,.25)', alignSelf:'flex-start', marginTop:Math.round(fs*0.35) }}>
                  <img src={`/Flags/${nat}.jpg`} alt={nat} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </span>
              )}
              <div style={{ display:'flex', flexDirection:'column', alignItems: isRight?'flex-end':'flex-start', minWidth:0, flex:1 }}>
                {first && (
                  <span style={{ fontWeight:700, fontSize:Math.round(fs*0.28), lineHeight:1, letterSpacing:'.04em', textTransform:'uppercase', opacity:.85, marginBottom:6 }}>
                    {first}
                  </span>
                )}
                {/* Apellido GRANDE. Si tiene espacios (apellidos compuestos
                    como GARCIA MARTINEZ) se parte en dos lineas en el espacio
                    natural (no se rompen palabras a la mitad). line-height
                    .86 para que las dos lineas queden compactas y centradas
                    visualmente con la bandera. */}
                <span style={{
                  fontWeight:900, fontSize:fs, lineHeight:.86,
                  textTransform:'uppercase', letterSpacing:'-.005em',
                  whiteSpace:'normal', wordBreak:'normal', overflowWrap:'normal',
                  hyphens:'none',
                  textAlign: isRight ? 'right' : 'left',
                  width:'100%',
                }}>
                  {last}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Finished team card ────────────────────────────────────────────────────
// Misma estructura que PreMatchTeamCard pero con resaltado del equipo
// ganador: borde gordo accent + glow + fondo saturado + tag "GANA EL
// PARTIDO" debajo. El equipo perdedor se muestra atenuado (.65 opacity).
interface FinishedTeamCardProps extends PreMatchTeamCardProps { won: boolean }
function FinishedTeamCard({ team, accent, isRight, showFlags, showSeed, nameFs, won }: FinishedTeamCardProps) {
  const isDoubles = team.players.length > 1
  const fs = nameFs ?? (isDoubles ? 110 : 156)
  return (
    <div style={{
      display:'flex', flexDirection:'column', justifyContent:'center',
      gap: isDoubles ? 32 : 0,
      padding:'48px 52px', borderRadius:14,
      background: won
        ? `linear-gradient(180deg, ${hexAlpha(accent,.22)} 0%, ${hexAlpha(accent,.05)} 100%)`
        : 'linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.01))',
      border: '1px solid rgba(255,255,255,.09)',
      borderTop: `${won ? 14 : 8}px solid ${won ? accent : hexAlpha(accent,.4)}`,
      boxShadow: won ? `inset 0 0 0 2px ${hexAlpha(accent,.4)}, 0 0 60px ${hexAlpha(accent,.30)}` : 'none',
      alignItems: isRight ? 'flex-end' : 'flex-start',
      animation:`cardIn .75s cubic-bezier(.2,.9,.25,1) ${isRight?'.2s':'0s'} both`,
      overflow:'hidden',
      minWidth: 0,
      opacity: won ? 1 : .68,
      transition: 'all 300ms ease',
    }}>
      {/* Seed */}
      {showSeed && team.seed && (
        <div style={{ fontWeight:900, fontSize:60, letterSpacing:'.24em', color: won ? accent : `${hexAlpha(accent,.55)}`, lineHeight:1 }}>
          ({team.seed})
        </div>
      )}

      {/* Nombres + bandera */}
      <div style={{ display:'flex', flexDirection:'column', gap: isDoubles ? 36 : 0, alignItems: isRight?'flex-end':'flex-start', width:'100%' }}>
        {team.players.map((p:any, i:number) => {
          const nat = (p?.nationality ?? 'ESP').toUpperCase()
          const last = (p?.last_name ?? p?.name ?? '').toUpperCase()
          const first = (p?.first_name ?? '').toUpperCase()
          return (
            <div key={p?.id??i} style={{ display:'flex', alignItems:'center', gap:20, flexDirection: isRight?'row-reverse':'row', width:'100%', minWidth:0 }}>
              {showFlags && (
                <span style={{ flex:'none', width:78, height:54, borderRadius:6, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,.4),inset 0 0 0 1px rgba(0,0,0,.25)', alignSelf:'flex-start', marginTop:Math.round(fs*0.35) }}>
                  <img src={`/Flags/${nat}.jpg`} alt={nat} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </span>
              )}
              <div style={{ display:'flex', flexDirection:'column', alignItems: isRight?'flex-end':'flex-start', minWidth:0, flex:1 }}>
                {first && (
                  <span style={{ fontWeight:700, fontSize:Math.round(fs*0.28), lineHeight:1, letterSpacing:'.04em', textTransform:'uppercase', opacity: won ? .9 : .7, marginBottom:6 }}>
                    {first}
                  </span>
                )}
                <span style={{
                  fontWeight:900, fontSize:fs, lineHeight:.86,
                  textTransform:'uppercase', letterSpacing:'-.005em',
                  whiteSpace:'normal', wordBreak:'normal', overflowWrap:'normal',
                  hyphens:'none',
                  textAlign: isRight ? 'right' : 'left',
                  width:'100%',
                  color: won ? '#fff' : 'rgba(255,255,255,.78)',
                  textShadow: won ? `0 4px 24px ${hexAlpha(accent,.55)}` : 'none',
                }}>
                  {last}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tag "GANA EL PARTIDO" — solo en el card ganador */}
      {won && (
        <div style={{
          marginTop: 24, alignSelf: isRight ? 'flex-end' : 'flex-start',
          padding: '14px 36px', borderRadius: 999,
          background: accent, color: '#fff',
          boxShadow: `0 12px 32px ${hexAlpha(accent,.55)}, inset 0 1px 0 rgba(255,255,255,.30)`,
        }}>
          <span style={{ fontWeight: 900, fontSize: 32, letterSpacing: '.30em', textTransform: 'uppercase' }}>
            GANA EL PARTIDO
          </span>
        </div>
      )}
    </div>
  )
}

// ── Team row (live scoreboard) ────────────────────────────────────────────────
interface TeamRowProps {
  team: { seed: number|undefined; players: any[]; games: number; point: string }
  serving: boolean
  setCols: Array<{ a: number|null; b: number|null; done: boolean; current: boolean }>
  teamKey: 'A'|'B'
  isDoubles: boolean
  servingPlayerId: string|null
  gridCols: string
  accentColor: string
  servingColor: string
  showSeed: boolean
  showFlags: boolean
  showServeIndicator: boolean
}

function TeamRowLED({ team, serving, setCols, teamKey, isDoubles, servingPlayerId, gridCols, accentColor, servingColor, showSeed, showFlags, showServeIndicator }: TeamRowProps) {
  // Background MUCHO mas evidente cuando saca el equipo: gradiente con
  // mas saturacion + un "wash" del color de saque encima del accent
  const bg = serving
    ? `linear-gradient(90deg, ${hexAlpha(servingColor,.32)} 0%, ${hexAlpha(accentColor,.20)} 35%, rgba(0,0,0,.10) 100%)`
    : `linear-gradient(90deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.02) 100%)`

  // Per-player serving check para dobles. Si current_server_id no esta
  // seteado pero el equipo SI esta sacando (caso "boundary": justo cambio
  // de servicio o data corrupta), marcamos al primer jugador como fallback
  // — asi nunca tenemos un equipo en saque sin indicador visible.
  const teamHasMatchingServer = isDoubles && serving && team.players.some((p:any) => p.id === servingPlayerId)
  const isPlayerServing = (p: any, idx: number) => {
    if (!serving) return false
    if (!isDoubles) return true  // singles: el unico jugador es el que saca
    if (teamHasMatchingServer) return p.id === servingPlayerId
    // Fallback: si nadie matchea, marcamos al primero del equipo
    return idx === 0
  }

  return (
    <div style={{
      position:'relative', display:'grid', gridTemplateColumns:gridCols, alignItems:'stretch',
      background:bg,
      // En vez de un border-left fino, hacemos un edge gordo con efecto glow
      // cuando el equipo esta al saque — bandera visual fuerte.
      borderLeft: serving ? `16px solid ${servingColor}` : `12px solid ${accentColor}`,
      borderRadius:10, overflow:'hidden',
      boxShadow: serving ? `inset 0 0 0 2px ${hexAlpha(servingColor,.45)}, 0 0 32px ${hexAlpha(servingColor,.30)}` : 'none',
      transition: 'all 300ms ease',
    }}>
      {/* PILL "AL SAQUE" — flotante en el borde superior izquierdo, solo
          visible cuando el equipo esta sacando. Banderazo grande con icono
          de pelota animado y label legible desde la grada. */}
      {serving && showServeIndicator && (
        <div style={{
          position: 'absolute',
          top: -2, left: -16,  // alineado con el borde gordo del row
          padding: '8px 22px 8px 16px',
          background: servingColor,
          color: '#fff',
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: '.32em',
          textTransform: 'uppercase',
          borderBottomRightRadius: 16,
          boxShadow: `0 8px 24px ${hexAlpha(servingColor,.55)}, inset 0 1px 0 rgba(255,255,255,.30)`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          zIndex: 5,
          animation: 'vsbSrvBadgePulse 1.6s ease-in-out infinite',
        }}>
          <span aria-hidden style={{
            display: 'inline-block',
            fontSize: 28,
            animation: 'vsbSrvBallSpin 2.2s linear infinite',
          }}>🎾</span>
          <span>AL SAQUE</span>
        </div>
      )}
      {showSeed && (
        <div style={{ display:'grid', placeItems:'center', fontWeight:800, fontSize:52, color:'rgba(255,255,255,.55)', fontVariantNumeric:'tabular-nums', borderRight:'1px solid rgba(255,255,255,.06)' }}>
          {team.seed??''}
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 22px 0 32px', minWidth:0, gap:10, overflow:'hidden', borderRight:'1px solid rgba(255,255,255,.06)' }}>
        {team.players.map((p:any, i:number) => {
          const playerServes = isPlayerServing(p, i)
          const nat = (p.nationality??'ESP').toUpperCase()
          return (
            <div key={p.id??i} style={{ display:'flex', alignItems:'center', gap:22, minWidth:0 }}>
              {showFlags && (
                <span style={{ flex:'none', width:64, height:44, borderRadius:5, boxShadow:'0 2px 8px rgba(0,0,0,.4),inset 0 0 0 1px rgba(0,0,0,.25)', overflow:'hidden' }}>
                  <img src={`/Flags/${nat}.jpg`} alt={nat} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:5 }} />
                </span>
              )}
              <span style={{ fontWeight:800, fontSize: team.players.length===1 ? 118 : 86, lineHeight:.9, letterSpacing:'.015em', textTransform:'uppercase', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'flex', alignItems:'center', gap:18, flex:1 }}>
                {showServeIndicator && playerServes && (
                  <span style={{
                    flex:'none', width:32, height:32, borderRadius:'50%',
                    background:servingColor,
                    boxShadow: `0 0 0 4px ${hexAlpha(servingColor,.30)}, 0 0 24px ${servingColor}`,
                    animation:'vsbSrvPulse 1.4s infinite',
                  }} />
                )}
                {(p.last_name??p.name??'').toUpperCase()}
              </span>
            </div>
          )
        })}
      </div>
      {setCols.map((s,i) => {
        const my = teamKey==='A' ? s.a : s.b
        const op = teamKey==='A' ? s.b : s.a
        const won = s.done && my!=null && op!=null && my>op
        const lost = s.done && my!=null && op!=null && my<op
        return (
          <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:168, lineHeight:.92, letterSpacing:'-.02em', fontVariantNumeric:'tabular-nums', position:'relative', overflow:'hidden', borderRight:'1px solid rgba(255,255,255,.06)', background: s.current ? hexAlpha(accentColor,.16) : 'rgba(0,0,0,.18)', opacity: lost?.4:1 }}>
            <span style={{ position:'relative', zIndex:1 }}>{s.current ? team.games : (my!=null?my:'–')}</span>
            {won && <span style={{ position:'absolute', left:'16%', right:'16%', bottom:16, height:8, borderRadius:4, background:accentColor }} />}
          </div>
        )
      })}
      <div style={{ position:'relative', display:'grid', placeItems:'center', background:accentColor, color:'#fff', fontWeight:900, fontSize:158, lineHeight:1, letterSpacing:'-.01em', fontVariantNumeric:'tabular-nums' }}>
        {team.point}
      </div>
    </div>
  )
}
