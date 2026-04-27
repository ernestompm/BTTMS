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
            // Tamaño de fuente UNIFICADO entre ambos equipos para mantener
            // simetría visual: usamos el apellido más largo de los dos.
            // Bajado targetChars de 11 -> 9 y minimo 56 -> 44 — apellidos
            // compuestos espanoles (GARCIA MARTINEZ, CASTANO PARRA, etc.)
            // se salian del card a tamano 73 con el algoritmo anterior.
            const allLast = [...teamA.players, ...teamB.players].map((p:any) => (p?.last_name ?? p?.name ?? '').length)
            const longest = Math.max(...allLast, 1)
            const isDoubles = teamA.players.length > 1
            const baseFs = isDoubles ? 96 : 132
            const targetChars = 9
            const sharedFs = longest > targetChars ? Math.max(44, Math.round(baseFs * targetChars / longest)) : baseFs
            return (
            <div className="absolute z-10" style={{ left:64, right:64, top:172, bottom: showSponsors&&sponsorList.length>0?252:60, display:'grid', gridTemplateColumns:'1fr 220px 1fr', gap:32, alignItems:'stretch', animation:'phaseIn .75s cubic-bezier(.2,.9,.25,1) both' }}>

              {/* Team A card */}
              <PreMatchTeamCard team={teamA} accent={accentA} isRight={false} showFlags={showFlags} showSeed={showSeed} nameFs={sharedFs} />

              {/* VS column — minWidth 320 -> 220 da mas espacio horizontal a los cards */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', animation:'vsIn .9s cubic-bezier(.2,.9,.25,1) .15s both' }}>
                <div style={{ fontSize:30, letterSpacing:'.36em', opacity:.72, textTransform:'uppercase', fontWeight:800, marginBottom:18, textAlign:'center', lineHeight:1.2, whiteSpace:'nowrap' }}>
                  {STATUS_LABELS[status] ?? 'PRÓXIMO PARTIDO'}
                </div>
                <div style={{ fontSize:260, fontWeight:900, lineHeight:.82, color:accentA, letterSpacing:'-.04em', textShadow:`0 20px 80px ${hexAlpha(accentA,.5)}` }}>
                  VS
                </div>
                <div style={{ marginTop:22, textAlign:'center' }}>
                  {status==='warmup' && countdown!=null
                    ? <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:112, letterSpacing:'.04em', fontWeight:900, color: countdown.startsWith('+')?'#f87171':accentA, animation:'cntPulse 1s ease infinite', display:'block', lineHeight:1, textShadow:`0 0 60px ${hexAlpha(accentA,.45)}` }}>{countdown}</span>
                    : <span style={{ fontSize:30, letterSpacing:'.22em', opacity:.88, textTransform:'uppercase', fontWeight:800, lineHeight:1.3, display:'block', whiteSpace:'nowrap' }}>
                        {match.scheduled_at
                          ? `A LAS ${new Date(match.scheduled_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`
                          : match.court?.name ?? ''}
                      </span>
                  }
                </div>
              </div>

              {/* Team B card */}
              <PreMatchTeamCard team={teamB} accent={accentB} isRight={true} showFlags={showFlags} showSeed={showSeed} nameFs={sharedFs} />
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
          {isFinished && (
            <div className="absolute z-10" style={{ left:64, right:64, top:190, bottom: showSponsors && sponsorList.length ? 260 : 60, display:'flex', flexDirection:'column', justifyContent:'center', gap:28 }}>

              {/* Status banner */}
              <div style={{ textAlign:'center', marginBottom:8 }}>
                <span style={{ display:'inline-block', padding:'14px 48px', background: hexAlpha(accentA,.18), border:`2px solid ${hexAlpha(accentA,.5)}`, borderRadius:999, fontWeight:900, fontSize:30, letterSpacing:'.3em', textTransform:'uppercase', color:accentA }}>
                  {STATUS_LABELS[status] ?? status.toUpperCase()}
                  {status === 'retired' && match.retired_team ? ` — EQUIPO ${match.retired_team}` : ''}
                </span>
              </div>

              {/* Final score rows */}
              {(['A','B'] as const).map(key => {
                const t = key==='A' ? teamA : teamB
                const accent = key==='A' ? accentA : accentB
                const teamNum = key==='A' ? 1 : 2
                const won = winnerTeam === teamNum
                const allSets = score?.sets ?? []
                return (
                  <div key={key} style={{ display:'grid', gridTemplateColumns:`${showSeed?'100px ':''}minmax(0,1fr) ${allSets.map(()=>'170px').join(' ')} 80px`, alignItems:'stretch', background: won ? hexAlpha(accent,.14) : 'rgba(255,255,255,.04)', borderLeft:`12px solid ${won?accent:'rgba(255,255,255,.12)'}`, borderRadius:10, overflow:'hidden', animation:'vsbPop .4s ease' }}>
                    {showSeed && (
                      <div style={{ display:'grid', placeItems:'center', fontWeight:800, fontSize:48, color:'rgba(255,255,255,.45)', borderRight:'1px solid rgba(255,255,255,.06)' }}>
                        {t.seed??''}
                      </div>
                    )}
                    <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 28px', gap:10, borderRight:'1px solid rgba(255,255,255,.06)' }}>
                      {t.players.map((p:any,i:number) => (
                        <div key={p?.id??i} style={{ display:'flex', alignItems:'center', gap:20 }}>
                          {showFlags && p?.nationality && (
                            <span style={{ flex:'none', width:58, height:40, borderRadius:4, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,.4)' }}>
                              <img src={`/Flags/${p.nationality.toUpperCase()}.jpg`} alt={p.nationality} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            </span>
                          )}
                          <span style={{ fontWeight:800, fontSize: t.players.length===1 ? 110 : 78, lineHeight:.9, letterSpacing:'.015em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                            {(p?.last_name??p?.name??'').toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                    {allSets.map((s,i) => {
                      const my = key==='A' ? s.t1 : s.t2
                      const op = key==='A' ? s.t2 : s.t1
                      const setWon = my > op
                      return (
                        <div key={i} style={{ display:'grid', placeItems:'center', fontWeight:800, fontSize:148, lineHeight:.92, fontVariantNumeric:'tabular-nums', borderRight:'1px solid rgba(255,255,255,.06)', background:'rgba(0,0,0,.18)', opacity: setWon ? 1 : .45, color: setWon ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.6)', position:'relative' }}>
                          {my}
                          {setWon && <span style={{ position:'absolute', bottom:10, left:'18%', right:'18%', height:6, borderRadius:3, background:accent }} />}
                        </div>
                      )
                    })}
                    {/* Winner badge */}
                    <div style={{ display:'grid', placeItems:'center' }}>
                      {won && <span style={{ fontWeight:900, fontSize:20, letterSpacing:'.14em', textTransform:'uppercase', color:accent, writingMode:'vertical-rl', textOrientation:'mixed' }}>GANADOR</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

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
  const fs = nameFs ?? (isDoubles ? 96 : 132)
  return (
    <div style={{
      display:'flex', flexDirection:'column', justifyContent:'center',
      gap:18, padding:'32px 36px', borderRadius:14,
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
        <div style={{ fontWeight:900, fontSize:48, letterSpacing:'.24em', color:`${hexAlpha(accent,.75)}`, lineHeight:1 }}>
          ({team.seed})
        </div>
      )}

      {/* Nombres + bandera (sin portraits/placeholders) */}
      <div style={{ display:'flex', flexDirection:'column', gap:14, alignItems: isRight?'flex-end':'flex-start', width:'100%' }}>
        {team.players.map((p:any, i:number) => {
          const nat = (p?.nationality ?? 'ESP').toUpperCase()
          const last = (p?.last_name ?? p?.name ?? '').toUpperCase()
          const first = (p?.first_name ?? '').toUpperCase()
          return (
            // Row con minWidth:0 + flex:1 en el bloque de nombre — permite que
            // el apellido use TODO el ancho disponible y, si aun asi no entra,
            // que se rompa en lugar de salirse del card.
            <div key={p?.id??i} style={{ display:'flex', alignItems:'center', gap:18, flexDirection: isRight?'row-reverse':'row', width:'100%', minWidth:0 }}>
              {showFlags && (
                <span style={{ flex:'none', width:64, height:44, borderRadius:5, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,.4),inset 0 0 0 1px rgba(0,0,0,.25)' }}>
                  <img src={`/Flags/${nat}.jpg`} alt={nat} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </span>
              )}
              <div style={{ display:'flex', flexDirection:'column', alignItems: isRight?'flex-end':'flex-start', minWidth:0, flex:1 }}>
                {first && (
                  <span style={{ fontWeight:700, fontSize:Math.round(fs*0.30), lineHeight:1, letterSpacing:'.04em', textTransform:'uppercase', opacity:.85 }}>
                    {first}
                  </span>
                )}
                <span style={{
                  fontWeight:900, fontSize:fs, lineHeight:.95, textTransform:'uppercase', letterSpacing:'-.01em',
                  // Permitir wrap como ultimo recurso si el algoritmo no logra
                  // encogerlo lo suficiente. overflowWrap evita que palabras
                  // largas se salgan del contenedor.
                  overflowWrap:'anywhere', wordBreak:'normal', maxWidth:'100%',
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
  const bg = serving
    ? `linear-gradient(90deg,${hexAlpha(accentColor,.18)} 0%,${hexAlpha(accentColor,.04)} 100%)`
    : `linear-gradient(90deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.02) 100%)`

  return (
    <div style={{ position:'relative', display:'grid', gridTemplateColumns:gridCols, alignItems:'stretch', background:bg, borderLeft:`12px solid ${accentColor}`, borderRadius:10, overflow:'hidden' }}>
      {showSeed && (
        <div style={{ display:'grid', placeItems:'center', fontWeight:800, fontSize:52, color:'rgba(255,255,255,.55)', fontVariantNumeric:'tabular-nums', borderRight:'1px solid rgba(255,255,255,.06)' }}>
          {team.seed??''}
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 22px 0 32px', minWidth:0, gap:10, overflow:'hidden', borderRight:'1px solid rgba(255,255,255,.06)' }}>
        {team.players.map((p:any, i:number) => {
          const active = isDoubles && serving && p.id === servingPlayerId
          const nat = (p.nationality??'ESP').toUpperCase()
          return (
            <div key={p.id??i} style={{ display:'flex', alignItems:'center', gap:22, minWidth:0 }}>
              {showFlags && (
                <span style={{ flex:'none', width:64, height:44, borderRadius:5, boxShadow:'0 2px 8px rgba(0,0,0,.4),inset 0 0 0 1px rgba(0,0,0,.25)', overflow:'hidden' }}>
                  <img src={`/Flags/${nat}.jpg`} alt={nat} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:5 }} />
                </span>
              )}
              <span style={{ fontWeight:800, fontSize: team.players.length===1 ? 118 : 86, lineHeight:.9, letterSpacing:'.015em', textTransform:'uppercase', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'flex', alignItems:'center', gap:18, flex:1 }}>
                {showServeIndicator && ((!isDoubles&&serving)||active) && (
                  <span style={{ flex:'none', width:26, height:26, borderRadius:'50%', background:servingColor, animation:'vsbSrvPulse 1.4s infinite' }} />
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
