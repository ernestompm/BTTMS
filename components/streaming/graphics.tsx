'use client'
// ============================================================================
// Streaming Graphics — visual components (10)
// ============================================================================
// All components receive `visible` plus a `data` payload and handle their own
// enter/exit animations. They are pure presentational — real state comes from
// the overlay page via props.
// ============================================================================

import { useEffect, useState } from 'react'
import type { Match, Score, Player, Sponsor, Tournament } from '@/types'
import { animStyle, hexAlpha, flagPath, palette, teamLabel } from './stage-shared'

// ─── Helpers ────────────────────────────────────────────────────────────────
const PTS = ['0','15','30','40']
function gamePoint(score: Score | null, team: 1|2): string {
  if (!score) return '0'
  const k = team===1 ? 't1' : 't2'
  if (score.super_tiebreak_active || score.tiebreak_active) return String(score.tiebreak_score?.[k] ?? 0)
  if (score.deuce) return 'ORO'
  return PTS[score.current_game?.[k] ?? 0] ?? '0'
}

function fmtClock(secs: number) {
  const s = Math.max(0, secs|0)
  const hh = Math.floor(s/3600), mm = Math.floor((s%3600)/60), ss = s%60
  return hh ? `${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}` : `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
}

function useTicker(start: string | null, stop: string | null) {
  const [ , tick ] = useState(0)
  useEffect(() => { const id = setInterval(() => tick(x => x+1), 1000); return () => clearInterval(id) }, [])
  if (!start) return 0
  const end = stop ? new Date(stop).getTime() : Date.now()
  return Math.floor((end - new Date(start).getTime()) / 1000)
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 1) TOURNAMENT INTRO                                                      ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function TournamentIntro({ visible, tournament }: { visible: boolean, tournament: Tournament | null }) {
  if (!tournament) return null
  const pal = palette(tournament.scoreboard_config)
  return (
    <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', background:'radial-gradient(1400px 800px at 50% 40%, rgba(18,30,60,.85) 0%, rgba(4,8,20,.95) 70%)',
      ...animStyle(visible, 'sgZoomIn', 'sgZoomOut', 900) }}>
      <div style={{ position:'absolute', inset:0, background:'repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0 1px,transparent 1px 4px)', mixBlendMode:'multiply', opacity:.4 }}/>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:30, textAlign:'center', maxWidth:1600, padding:'0 80px' }}>
        {tournament.logo_url
          ? <img src={tournament.logo_url} alt="" style={{ width:260, height:260, objectFit:'contain', filter:`drop-shadow(0 20px 40px ${hexAlpha(pal.accentA,.5)})` }}/>
          : <div style={{ width:240, height:240, borderRadius:40, background:`linear-gradient(135deg,${pal.accentA} 0%,${pal.accentB} 100%)`, boxShadow:`0 30px 80px ${hexAlpha(pal.accentA,.55)}` }}/>
        }
        <div style={{ fontSize:38, letterSpacing:'.5em', textTransform:'uppercase', opacity:.72, fontWeight:700, color:pal.text2 }}>
          {tournament.edition ? `${tournament.edition}ª EDICIÓN` : 'CAMPEONATO'}
        </div>
        <div style={{ fontSize:170, fontWeight:900, lineHeight:.88, letterSpacing:'-.015em', textTransform:'uppercase', color:pal.text,
          background:`linear-gradient(180deg, ${pal.text} 0%, ${hexAlpha(pal.accentA,.85)} 100%)`,
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', textShadow:`0 0 60px ${hexAlpha(pal.accentA,.4)}` }}>
          {tournament.name}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:40, fontSize:44, fontWeight:800, letterSpacing:'.14em', textTransform:'uppercase', color:pal.text2 }}>
          <span>{tournament.venue_city}</span>
          <span style={{ width:10, height:10, borderRadius:'50%', background:pal.accentA, boxShadow:`0 0 20px ${pal.accentA}` }}/>
          <span>{new Date(tournament.start_date).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})} — {new Date(tournament.end_date).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'})}</span>
        </div>
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 2) VENUE CARD                                                            ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function VenueCard({ visible, tournament }: { visible: boolean, tournament: Tournament | null }) {
  if (!tournament) return null
  const pal = palette(tournament.scoreboard_config)
  return (
    <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center',
      background:'radial-gradient(1500px 800px at 50% 30%, rgba(10,24,56,.92) 0%, rgba(2,5,12,.96) 70%)',
      ...animStyle(visible, 'sgSlideUp', 'sgSlideDown', 750) }}>
      <div style={{ textAlign:'center', maxWidth:1600, padding:'0 80px' }}>
        <div style={{ fontSize:44, letterSpacing:'.5em', textTransform:'uppercase', opacity:.6, fontWeight:800, color:pal.text2, marginBottom:24 }}>SEDE</div>
        <div style={{ fontSize:220, fontWeight:900, lineHeight:.85, letterSpacing:'-.02em', textTransform:'uppercase', color:pal.text, textShadow:`0 20px 80px ${hexAlpha(pal.accentA,.55)}` }}>
          {tournament.venue_name || tournament.venue_city}
        </div>
        <div style={{ marginTop:30, display:'inline-flex', alignItems:'center', gap:28, padding:'26px 60px', borderRadius:999,
          background:hexAlpha(pal.accentA,.18), border:`2px solid ${hexAlpha(pal.accentA,.55)}` }}>
          <span style={{ width:18, height:18, borderRadius:'50%', background:pal.accentA, boxShadow:`0 0 22px ${pal.accentA}` }}/>
          <span style={{ fontSize:64, fontWeight:900, letterSpacing:'.18em', textTransform:'uppercase', color:pal.text }}>{tournament.venue_city}</span>
        </div>
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 3) MATCH PRESENTATION                                                    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const ROUND_LABELS: Record<string,string> = { F:'FINAL', SF:'SEMIFINAL', QF:'CUARTOS DE FINAL', R16:'OCTAVOS', R32:'16vos', RR:'ROUND ROBIN' }

export function MatchPresentation({ visible, match, tournament }: { visible: boolean, match: any, tournament: Tournament | null }) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const isDoubles = match.match_type === 'doubles'
  const teams = [
    { entry: match.entry1, accent: pal.accentA, side:'left'  as const },
    { entry: match.entry2, accent: pal.accentB, side:'right' as const },
  ]
  return (
    <div style={{ position:'absolute', inset:0,
      background:'radial-gradient(1800px 900px at 50% 20%, rgba(15,30,60,.9) 0%, rgba(2,5,12,.96) 75%)',
      ...animStyle(visible, 'sgZoomIn', 'sgZoomOut', 850) }}>
      {/* Top header */}
      <div style={{ position:'absolute', top:60, left:0, right:0, textAlign:'center' }}>
        {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height:90, marginBottom:14 }}/>}
        <div style={{ fontSize:34, letterSpacing:'.5em', textTransform:'uppercase', opacity:.7, fontWeight:800 }}>{tournament?.name}</div>
        <div style={{ marginTop:18 }}>
          <span style={{ padding:'14px 44px', background:pal.accentA, borderRadius:999, fontSize:42, fontWeight:900, letterSpacing:'.2em', textTransform:'uppercase', boxShadow:`0 10px 30px ${hexAlpha(pal.accentA,.5)}` }}>
            {ROUND_LABELS[match.round ?? ''] ?? match.round ?? 'PARTIDO'}
          </span>
        </div>
      </div>
      {/* Teams + VS */}
      <div style={{ position:'absolute', left:80, right:80, top:300, bottom:140, display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:48, alignItems:'center' }}>
        {teams.map((t,idx) => (
          <TeamCard key={idx} entry={t.entry} accent={t.accent} align={t.side} isDoubles={isDoubles} pal={pal}/>
        ))}
        {/* VS block — positioned center column */}
        <div style={{ position:'absolute', left:'50%', top:'48%', transform:'translate(-50%,-50%)', zIndex:2, textAlign:'center' }}>
          <div style={{ fontSize:320, fontWeight:900, lineHeight:.85, letterSpacing:'-.05em', color:pal.accentA,
            textShadow:`0 30px 80px ${hexAlpha(pal.accentA,.55)}` }}>VS</div>
        </div>
      </div>
    </div>
  )
}

function TeamCard({ entry, accent, align, isDoubles, pal }: { entry:any, accent:string, align:'left'|'right', isDoubles:boolean, pal:any }) {
  const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems: align==='right'?'flex-end':'flex-start', gap:24, padding:'40px 52px',
      borderRadius:18, background:pal.glass, border:`1px solid rgba(255,255,255,.1)`, borderTop:`10px solid ${accent}` }}>
      <div style={{ display:'flex', gap:22, flexDirection: align==='right'?'row-reverse':'row' }}>
        {players.map((p:any,i:number) => (
          <div key={i} style={{ width:isDoubles?170:220, height:isDoubles?170:220, borderRadius:20, overflow:'hidden',
            background:`linear-gradient(135deg,${hexAlpha(accent,.35)},${hexAlpha(accent,.08)})`, border:`1px solid ${hexAlpha(accent,.35)}`,
            display:'grid', placeItems:'center', boxShadow:`0 20px 50px rgba(0,0,0,.45)` }}>
            {p?.photo_url
              ? <img src={p.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <span style={{ fontWeight:900, fontSize:isDoubles?80:100, color:pal.text }}>{(p?.last_name??'?').charAt(0)}</span>}
          </div>
        ))}
      </div>
      {entry?.seed && (
        <div style={{ fontSize:40, fontWeight:900, letterSpacing:'.25em', color:hexAlpha(accent,.85) }}>({entry.seed})</div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:14, alignItems: align==='right'?'flex-end':'flex-start' }}>
        {players.map((p:any,i:number) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:20, flexDirection: align==='right'?'row-reverse':'row' }}>
            <img src={flagPath(p?.nationality)} alt="" style={{ width:82, height:56, borderRadius:6, objectFit:'cover', boxShadow:'0 2px 8px rgba(0,0,0,.4)' }}/>
            <span style={{ fontSize: players.length===1?110:82, fontWeight:900, lineHeight:.9, textTransform:'uppercase', whiteSpace:'nowrap' }}>
              {(p?.last_name ?? '').toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 4) PLAYER BIO                                                            ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function PlayerBio({ visible, player, team, tournament }: { visible:boolean, player: Player | null, team: 1|2, tournament: Tournament | null }) {
  if (!player) return null
  const pal = palette(tournament?.scoreboard_config)
  const accent = team===1 ? pal.accentA : pal.accentB
  const side: 'left'|'right' = team===1 ? 'left' : 'right'
  const rows: Array<[string,string|null]> = [
    ['Nacionalidad', player.nationality?.toUpperCase() ?? null],
    ['Edad', player.birth_date ? String(ageFrom(player.birth_date)) : player.age_manual ? String(player.age_manual) : null],
    ['Nacimiento', player.birth_city ?? null],
    ['Altura', player.height_cm ? `${player.height_cm} cm` : null],
    ['Lateralidad', player.laterality ? LATERALITY[player.laterality] : null],
    ['Ranking RFET', player.ranking_rfet ? `#${player.ranking_rfet}` : null],
    ['Ranking ITF',  player.ranking_itf  ? `#${player.ranking_itf}`  : null],
    ['Club', player.club ?? null],
    ['Federación', player.federacion_autonomica ?? null],
  ].filter(([,v]) => v && v !== 'null') as Array<[string,string]>

  return (
    <div style={{ position:'absolute', top:90, [side]:60, width:680, maxHeight:900, borderRadius:20, overflow:'hidden',
      background: pal.panelBg, border:`1px solid ${hexAlpha(accent,.35)}`, borderTop:`8px solid ${accent}`,
      boxShadow:`0 30px 80px rgba(0,0,0,.6)`, padding:'32px 38px',
      ...animStyle(visible, side==='left' ? 'sgSlideLeft' : 'sgSlideRight', side==='left' ? 'sgSlideRight' : 'sgSlideLeft', 700) } as any}>
      <div style={{ display:'flex', gap:26, alignItems:'center', marginBottom:26 }}>
        <div style={{ width:180, height:180, borderRadius:16, overflow:'hidden',
          background:`linear-gradient(135deg,${hexAlpha(accent,.35)},${hexAlpha(accent,.08)})`,
          border:`1px solid ${hexAlpha(accent,.35)}`, display:'grid', placeItems:'center', flex:'none' }}>
          {player.photo_url
            ? <img src={player.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            : <span style={{ fontSize:88, fontWeight:900 }}>{player.last_name?.charAt(0) ?? '?'}</span>}
        </div>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:10 }}>
            <img src={flagPath(player.nationality)} alt="" style={{ width:58, height:40, borderRadius:4, objectFit:'cover' }}/>
            <span style={{ fontSize:20, letterSpacing:'.26em', textTransform:'uppercase', opacity:.6, fontWeight:800 }}>JUGADOR</span>
          </div>
          <div style={{ fontSize:44, fontWeight:900, lineHeight:.95, textTransform:'uppercase' }}>{player.first_name}</div>
          <div style={{ fontSize:56, fontWeight:900, lineHeight:.95, textTransform:'uppercase', color:accent }}>{player.last_name}</div>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 26px' }}>
        {rows.map(([k,v]) => (
          <div key={k} style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <span style={{ fontSize:16, letterSpacing:'.22em', textTransform:'uppercase', opacity:.5, fontWeight:800 }}>{k}</span>
            <span style={{ fontSize:28, fontWeight:800 }}>{v}</span>
          </div>
        ))}
      </div>
      {player.titles?.length > 0 && (
        <div style={{ marginTop:22, padding:'16px 20px', background:hexAlpha(accent,.1), borderRadius:12, border:`1px solid ${hexAlpha(accent,.3)}` }}>
          <div style={{ fontSize:16, letterSpacing:'.22em', textTransform:'uppercase', opacity:.7, fontWeight:800, marginBottom:8 }}>PALMARÉS</div>
          {player.titles.slice(0,3).map((t,i) => (
            <div key={i} style={{ fontSize:22, fontWeight:700 }}>• {t.year} — {t.name}</div>
          ))}
        </div>
      )}
      {player.bio && (
        <div style={{ marginTop:18, fontSize:22, lineHeight:1.4, opacity:.85, maxHeight:160, overflow:'hidden' }}>
          {player.bio}
        </div>
      )}
    </div>
  )
}
const LATERALITY: Record<string,string> = { right:'Diestro/a', left:'Zurdo/a', ambidextrous:'Ambidiestro/a' }
function ageFrom(iso:string) { const d = new Date(iso); const now = new Date(); let a = now.getFullYear()-d.getFullYear(); const m = now.getMonth()-d.getMonth(); if (m<0 || (m===0 && now.getDate()<d.getDate())) a--; return a }

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 5) REFEREE LOWER THIRD                                                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function RefereeLowerThird({ visible, referee, tournament }: { visible:boolean, referee:{ full_name:string, federacion?:string|null } | null, tournament: Tournament | null }) {
  if (!referee) return null
  const pal = palette(tournament?.scoreboard_config)
  return (
    <div style={{ position:'absolute', left:80, right:80, bottom:100, height:170,
      background:`linear-gradient(90deg, ${hexAlpha(pal.accentA,.95)} 0%, ${hexAlpha(pal.accentB,.9)} 100%)`,
      borderRadius:14, overflow:'hidden', display:'flex', alignItems:'stretch',
      boxShadow:'0 30px 80px rgba(0,0,0,.5)',
      ...animStyle(visible, 'sgSlideLeft', 'sgSlideRight', 650) }}>
      <div style={{ width:280, background:'rgba(0,0,0,.45)', display:'grid', placeItems:'center', borderRight:'3px solid rgba(255,255,255,.2)' }}>
        <span style={{ fontSize:44, fontWeight:900, letterSpacing:'.32em', textTransform:'uppercase' }}>ÁRBITRO</span>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 40px', gap:6 }}>
        <span style={{ fontSize:70, fontWeight:900, lineHeight:.95, textTransform:'uppercase', letterSpacing:'.01em' }}>{referee.full_name}</span>
        {referee.federacion && <span style={{ fontSize:28, opacity:.9, letterSpacing:'.18em', textTransform:'uppercase', fontWeight:700 }}>{referee.federacion}</span>}
      </div>
      {/* Sheen */}
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:0, bottom:0, width:220, background:'linear-gradient(90deg,transparent,rgba(255,255,255,.25),transparent)', animation:'sgSheen 3s ease-in-out infinite' }}/>
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 6) STATS PANEL                                                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function StatsPanel({ visible, match, tournament, scope }: { visible:boolean, match:any, tournament: Tournament | null, scope:'set_1'|'set_2'|'set_3'|'match'|'auto' }) {
  if (!match?.stats) return null
  const pal = palette(tournament?.scoreboard_config)
  const resolvedScope = scope === 'auto' ? autoScope(match) : scope
  const stats = match.stats // match stats are cumulative in this DB; set-split would require per-point re-aggregation (future enhancement).
  const t1 = match.entry1, t2 = match.entry2
  const rows: Array<{label:string, a:number|string, b:number|string, pct?:boolean}> = [
    { label:'Aces', a: stats.t1.aces, b: stats.t2.aces },
    { label:'Dobles faltas', a: stats.t1.double_faults, b: stats.t2.double_faults },
    { label:'Winners', a: stats.t1.winners, b: stats.t2.winners },
    { label:'Errores no forzados', a: stats.t1.unforced_errors, b: stats.t2.unforced_errors },
    { label:'% 1er saque', a: `${Math.round(stats.t1.serve_points_won_pct||0)}%`, b: `${Math.round(stats.t2.serve_points_won_pct||0)}%` },
    { label:'% resto ganado', a: `${Math.round(stats.t1.return_points_won_pct||0)}%`, b: `${Math.round(stats.t2.return_points_won_pct||0)}%` },
    { label:'Breaks ganados', a: stats.t1.break_points_won, b: stats.t2.break_points_won },
    { label:'Breaks salvados', a: stats.t1.break_points_saved, b: stats.t2.break_points_saved },
    { label:'Racha máxima', a: stats.t1.max_points_streak, b: stats.t2.max_points_streak },
    { label:'Puntos totales', a: stats.t1.total_points_won, b: stats.t2.total_points_won },
  ]
  const title = resolvedScope === 'match' ? 'ESTADÍSTICAS DEL PARTIDO' : `ESTADÍSTICAS — ${resolvedScope.replace('set_','SET ')}`

  return (
    <div style={{ position:'absolute', right:60, top:80, width:780, maxHeight:920, borderRadius:20, overflow:'hidden',
      background:pal.panelBg, border:`1px solid rgba(255,255,255,.08)`, borderTop:`8px solid ${pal.accentA}`,
      boxShadow:'0 30px 80px rgba(0,0,0,.55)', padding:'28px 32px',
      ...animStyle(visible, 'sgSlideRight' as any, 'sgSlideRight', 700) }}>
      <div style={{ fontSize:22, letterSpacing:'.3em', textTransform:'uppercase', opacity:.65, fontWeight:800 }}>{title}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:14, marginTop:14, marginBottom:22, alignItems:'center' }}>
        <NameCell entry={t1} align="left" accent={pal.accentA} doubles={match.match_type==='doubles'}/>
        <span style={{ fontSize:28, opacity:.4, fontWeight:900 }}>·</span>
        <NameCell entry={t2} align="right" accent={pal.accentB} doubles={match.match_type==='doubles'}/>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {rows.map((r,i) => <StatRow key={i} {...r} accentA={pal.accentA} accentB={pal.accentB}/>)}
      </div>
    </div>
  )
}
function autoScope(match:any): 'set_1'|'set_2'|'set_3'|'match' {
  const sets = match?.score?.sets?.length ?? 0
  if (match?.status === 'finished') return 'match'
  if (sets === 1) return 'set_1'
  if (sets === 2) return 'set_2'
  if (sets >= 3) return 'set_3'
  return 'match'
}
function NameCell({ entry, align, accent, doubles }:{ entry:any, align:'left'|'right', accent:string, doubles:boolean }) {
  const p1 = entry?.player1, p2 = doubles ? entry?.player2 : null
  return (
    <div style={{ textAlign: align, borderLeft: align==='left'?`6px solid ${accent}`:'none', borderRight: align==='right'?`6px solid ${accent}`:'none', paddingLeft: align==='left'?14:0, paddingRight: align==='right'?14:0 }}>
      <div style={{ fontSize:22, fontWeight:800, letterSpacing:'.02em', textTransform:'uppercase', lineHeight:1 }}>{p1?.last_name ?? '—'}</div>
      {p2 && <div style={{ fontSize:18, fontWeight:700, opacity:.7, textTransform:'uppercase' }}>{p2.last_name}</div>}
    </div>
  )
}
function StatRow({ label, a, b, accentA, accentB }: { label:string, a:number|string, b:number|string, accentA:string, accentB:string }) {
  const numA = typeof a === 'number' ? a : parseFloat(String(a)) || 0
  const numB = typeof b === 'number' ? b : parseFloat(String(b)) || 0
  const total = numA + numB || 1
  const pctA = Math.round((numA / total) * 100)
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 80px', alignItems:'center', gap:14 }}>
        <span style={{ fontSize:30, fontWeight:900, textAlign:'right', color: numA>=numB?accentA:'rgba(255,255,255,.8)' }}>{a}</span>
        <span style={{ fontSize:18, letterSpacing:'.22em', textAlign:'center', opacity:.6, textTransform:'uppercase', fontWeight:700 }}>{label}</span>
        <span style={{ fontSize:30, fontWeight:900, color: numB>numA?accentB:'rgba(255,255,255,.8)' }}>{b}</span>
      </div>
      <div style={{ display:'flex', height:6, background:'rgba(255,255,255,.08)', borderRadius:3, overflow:'hidden', marginTop:4 }}>
        <div style={{ width:`${pctA}%`, background:accentA, transition:'width .5s ease' }}/>
        <div style={{ width:`${100-pctA}%`, background:accentB }}/>
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 7) SCOREBUG (persistent top-left corner)                                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function Scorebug({ visible, match, tournament, flag }: { visible:boolean, match:any, tournament: Tournament | null, flag:{ kind:string|null, team?:1|2, label:string } }) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const serving = match.serving_team as 1|2|null

  const rows = [1,2].map(t => {
    const team = t as 1|2
    const entry = team===1 ? match.entry1 : match.entry2
    const accent = team===1 ? pal.accentA : pal.accentB
    const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
    const setsWon = score?.sets_won?.[team===1?'t1':'t2'] ?? 0
    const games = score?.current_set?.[team===1?'t1':'t2'] ?? 0
    const pt = gamePoint(score, team)
    return { team, accent, players, setsWon, games, pt, serving: serving===team }
  })

  const flagColors: Record<string,string> = {
    match_point:'#ef4444', championship_point:'#f59e0b', set_point:'#a855f7', break_point:'#22d3ee', golden_point:'#fbbf24'
  }
  const flagColor = flag.kind ? flagColors[flag.kind] ?? pal.accentA : null

  return (
    <div style={{ position:'absolute', top:40, left:40, width:640, borderRadius:14, overflow:'hidden',
      background:'linear-gradient(180deg, rgba(10,16,32,.95), rgba(5,8,18,.97))', border:'1px solid rgba(255,255,255,.08)',
      boxShadow:'0 24px 60px rgba(0,0,0,.6)',
      ...animStyle(visible, 'sgSlideLeft', 'sgSlideRight', 500) }}>
      {/* Tournament strip */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', background:'rgba(255,255,255,.04)', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
        <span style={{ fontSize:16, letterSpacing:'.24em', textTransform:'uppercase', opacity:.7, fontWeight:800 }}>{tournament?.name?.slice(0,28)}</span>
        <span style={{ fontSize:14, letterSpacing:'.24em', textTransform:'uppercase', opacity:.5, fontWeight:800 }}>{ROUND_LABELS[match.round ?? ''] ?? match.round}</span>
      </div>
      {rows.map(r => (
        <div key={r.team} style={{ display:'grid', gridTemplateColumns:'14px 1fr auto auto auto', alignItems:'center', gap:0, borderBottom:r.team===1?'1px solid rgba(255,255,255,.06)':'none', padding:'10px 0' }}>
          <div style={{ height:'100%', background:r.accent }}/>
          <div style={{ padding:'0 12px', minWidth:0, display:'flex', flexDirection:'column', gap:2 }}>
            {r.players.map((p:any,i:number) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                <img src={flagPath(p.nationality)} alt="" style={{ width:30, height:20, borderRadius:3, objectFit:'cover', flex:'none' }}/>
                <span style={{ fontSize:r.players.length===1?36:26, fontWeight:900, textTransform:'uppercase', letterSpacing:'.01em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1 }}>
                  {(p.last_name ?? '').toUpperCase()}
                </span>
                {r.serving && (!isDoubles || p.id === match.current_server_id) &&
                  <span style={{ width:12, height:12, borderRadius:'50%', background:pal.serve, flex:'none', boxShadow:`0 0 0 3px ${hexAlpha(pal.serve,.3)}`, animation:'sgPulse 1.4s infinite' }}/>}
              </div>
            ))}
          </div>
          <div style={{ width:50, textAlign:'center', fontSize:34, fontWeight:900, opacity:.75, borderLeft:'1px solid rgba(255,255,255,.06)' }}>{r.setsWon}</div>
          <div style={{ width:60, textAlign:'center', fontSize:44, fontWeight:900, borderLeft:'1px solid rgba(255,255,255,.06)' }}>{r.games}</div>
          <div style={{ width:80, textAlign:'center', fontSize:44, fontWeight:900, background:r.accent, color:'#fff' }}>{r.pt}</div>
        </div>
      ))}
      {flag.kind && flag.label && (
        <div style={{ padding:'8px 14px', background:flagColor!, color:'#000', fontSize:22, fontWeight:900, letterSpacing:'.28em', textAlign:'center', textTransform:'uppercase', animation:'sgBlink 1.2s infinite' }}>
          {flag.label}{flag.team ? ` · ${flag.team===1?'Eq.1':'Eq.2'}` : ''}
        </div>
      )}
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 8) BIG SCOREBOARD (lower third)                                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function BigScoreboard({ visible, match, tournament, sponsor }: { visible:boolean, match:any, tournament: Tournament | null, sponsor: Sponsor | null }) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const totalSecs = useTicker(match.started_at, match.finished_at)

  const setTimes = (score?.sets ?? []).map((_, i) => {
    // Best-effort: uniformly distribute; DB doesn't store per-set end time — display index only.
    return `SET ${i+1}`
  })

  return (
    <div style={{ position:'absolute', left:0, right:0, bottom:0, height:380, background:pal.panelBg, borderTop:`3px solid ${pal.accentA}`,
      display:'grid', gridTemplateColumns:'240px 1fr 320px',
      ...animStyle(visible, 'sgSlideUp', 'sgSlideDown', 650) }}>
      {/* Left: tournament logo + round */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, borderRight:'1px solid rgba(255,255,255,.06)', padding:20 }}>
        {tournament?.logo_url
          ? <img src={tournament.logo_url} style={{ width:140, height:140, objectFit:'contain' }}/>
          : <div style={{ width:120, height:120, borderRadius:20, background:pal.accentA }}/>}
        <div style={{ fontSize:20, fontWeight:900, letterSpacing:'.2em', textTransform:'uppercase', textAlign:'center', opacity:.8 }}>
          {ROUND_LABELS[match.round ?? ''] ?? match.round}
        </div>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:26, opacity:.75 }}>{fmtClock(totalSecs)}</div>
      </div>

      {/* Middle: teams and scores */}
      <div style={{ padding:'18px 28px', display:'flex', flexDirection:'column', justifyContent:'center', gap:12 }}>
        <div style={{ fontSize:16, letterSpacing:'.3em', textTransform:'uppercase', opacity:.55, fontWeight:800 }}>{tournament?.name}</div>
        {[1,2].map(tn => {
          const team = tn as 1|2
          const entry = team===1 ? match.entry1 : match.entry2
          const accent = team===1 ? pal.accentA : pal.accentB
          const sets = (score?.sets ?? [])
          const setsWon = score?.sets_won?.[team===1?'t1':'t2'] ?? 0
          const totalSets = sets.length + ((score?.match_status==='finished')?0:1)
          const won = match.status==='finished' && score?.winner_team===team
          const players = [entry?.player1, isDoubles?entry?.player2:null].filter(Boolean)
          return (
            <div key={team} style={{ display:'grid', gridTemplateColumns:`14px 1fr repeat(${Math.max(1,sets.length)}, 72px) 90px`, alignItems:'center', background: won ? hexAlpha(accent,.14) : 'rgba(255,255,255,.03)', borderRadius:10, overflow:'hidden' }}>
              <div style={{ height:'100%', background:accent }}/>
              <div style={{ padding:'10px 16px', display:'flex', flexDirection:'column', gap:4, minWidth:0 }}>
                {players.map((p:any,i:number) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:14, minWidth:0 }}>
                    <img src={flagPath(p.nationality)} alt="" style={{ width:44, height:30, borderRadius:4, objectFit:'cover' }}/>
                    <span style={{ fontSize:players.length===1?44:32, fontWeight:900, textTransform:'uppercase', lineHeight:1 }}>{(p.last_name ?? '').toUpperCase()}</span>
                  </div>
                ))}
              </div>
              {sets.length === 0 ? <div/> : sets.map((s,i) => {
                const my = team===1?s.t1:s.t2, op = team===1?s.t2:s.t1, w = my>op
                return (
                  <div key={i} style={{ textAlign:'center', fontSize:58, fontWeight:900, color:w?pal.text:pal.text2, background:'rgba(0,0,0,.2)', borderLeft:'1px solid rgba(255,255,255,.05)' }}>{my}</div>
                )
              })}
              <div style={{ textAlign:'center', fontSize:72, fontWeight:900, color: won ? accent : pal.text2, background:'rgba(0,0,0,.35)' }}>{setsWon}</div>
            </div>
          )
        })}
      </div>

      {/* Right: main sponsor + total time */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:20, borderLeft:'1px solid rgba(255,255,255,.06)' }}>
        <div style={{ fontSize:14, letterSpacing:'.3em', textTransform:'uppercase', opacity:.5, fontWeight:800 }}>PATROCINADOR PRINCIPAL</div>
        <div style={{ flex:1, display:'grid', placeItems:'center', width:'100%', maxHeight:180 }}>
          {sponsor?.logo_url
            ? <img src={sponsor.logo_url} alt={sponsor.name} style={{ maxWidth:260, maxHeight:160, objectFit:'contain' }}/>
            : <span style={{ fontSize:36, fontWeight:900, letterSpacing:'.1em', textTransform:'uppercase', opacity:.8, textAlign:'center' }}>{sponsor?.name ?? '—'}</span>}
        </div>
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 9) RESULTS GRID                                                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function ResultsGrid({ visible, matches, highlightMatchId, tournament, category }:
  { visible:boolean, matches:any[], highlightMatchId?:string|null, tournament: Tournament | null, category?: string }) {
  const pal = palette(tournament?.scoreboard_config)
  return (
    <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:1560, maxHeight:900, borderRadius:22, overflow:'hidden',
      background:pal.panelBg, border:'1px solid rgba(255,255,255,.08)', borderTop:`10px solid ${pal.accentA}`,
      boxShadow:'0 40px 100px rgba(0,0,0,.65)',
      ...animStyle(visible, 'sgZoomIn', 'sgZoomOut', 700) }}>
      <div style={{ padding:'22px 36px', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:18, letterSpacing:'.3em', opacity:.55, textTransform:'uppercase', fontWeight:800 }}>Resultados</div>
          <div style={{ fontSize:40, fontWeight:900, letterSpacing:'-.01em', textTransform:'uppercase' }}>{category ?? tournament?.name}</div>
        </div>
        {tournament?.logo_url && <img src={tournament.logo_url} style={{ height:64 }}/>}
      </div>
      <div style={{ padding:'14px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 28px', maxHeight:720, overflow:'hidden' }}>
        {matches.slice(0,24).map(m => {
          const hot = m.id === highlightMatchId
          const isDoubles = m.match_type === 'doubles'
          const score = m.score as Score | null
          return (
            <div key={m.id} style={{ display:'grid', gridTemplateColumns:'60px 1fr auto', alignItems:'center', gap:14, padding:'10px 14px',
              borderRadius:10, background: hot ? hexAlpha(pal.accentA,.18) : 'rgba(255,255,255,.04)',
              border: hot ? `2px solid ${pal.accentA}` : '1px solid rgba(255,255,255,.06)' }}>
              <span style={{ fontSize:16, letterSpacing:'.22em', opacity:.55, textTransform:'uppercase', fontWeight:800 }}>{m.round ?? ''}</span>
              <div style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
                <MatchRow entry={m.entry1} score={score} team={1} isDoubles={isDoubles} accent={pal.accentA}/>
                <MatchRow entry={m.entry2} score={score} team={2} isDoubles={isDoubles} accent={pal.accentB}/>
              </div>
              <span style={{ fontSize:14, letterSpacing:'.22em', textTransform:'uppercase', fontWeight:800,
                color: m.status==='finished' ? '#22c55e' : m.status==='in_progress' ? pal.accentA : pal.text2 }}>
                {m.status==='finished' ? 'FINAL' : m.status==='in_progress' ? '● EN VIVO' : m.status}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
function MatchRow({ entry, score, team, isDoubles, accent }:{ entry:any, score: Score|null, team:1|2, isDoubles:boolean, accent:string }) {
  const players = [entry?.player1, isDoubles?entry?.player2:null].filter(Boolean)
  const setsW = score?.sets_won?.[team===1?'t1':'t2'] ?? 0
  const winner = (score?.winner_team ?? null) === team
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
      <span style={{ width:6, height:'22px', background:accent, borderRadius:2 }}/>
      <span style={{ fontSize:22, fontWeight: winner?900:700, color: winner?'#fff':'rgba(255,255,255,.75)', textTransform:'uppercase', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>
        {players.map(p => (p as any)?.last_name).join(' / ')}
      </span>
      <span style={{ fontSize:26, fontWeight:900, color: winner?accent:'rgba(255,255,255,.6)', minWidth:20, textAlign:'right' }}>{setsW}</span>
      {(score?.sets ?? []).map((s,i) => (
        <span key={i} style={{ fontSize:20, fontWeight:800, opacity: ((team===1?s.t1:s.t2) > (team===1?s.t2:s.t1)) ? 1 : .5 }}>
          {team===1?s.t1:s.t2}
        </span>
      ))}
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 10) COIN TOSS                                                            ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const CHOICE_LABEL: Record<string,string> = { serve:'ELIGE SACAR', receive:'ELIGE RESTAR', side_left:'ELIGE CAMPO (IZQ)', side_right:'ELIGE CAMPO (DCHA)' }
const CHOICE_ICON:  Record<string,string> = { serve:'🎾', receive:'↩', side_left:'◀', side_right:'▶' }

export function CoinToss({ visible, match, tournament }: { visible:boolean, match:any, tournament: Tournament | null }) {
  if (!match?.toss_winner) return null
  const pal = palette(tournament?.scoreboard_config)
  const winnerEntry = match.toss_winner === 1 ? match.entry1 : match.entry2
  const accent = match.toss_winner === 1 ? pal.accentA : pal.accentB
  const isDoubles = match.match_type === 'doubles'
  const label = CHOICE_LABEL[match.toss_choice] ?? match.toss_choice
  const players = [winnerEntry?.player1, isDoubles?winnerEntry?.player2:null].filter(Boolean)

  return (
    <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:1000, borderRadius:24, overflow:'hidden',
      background:pal.panelBg, border:`1px solid rgba(255,255,255,.1)`, borderTop:`12px solid ${accent}`,
      boxShadow:'0 40px 120px rgba(0,0,0,.65)', padding:'44px 60px',
      ...animStyle(visible, 'sgZoomIn', 'sgZoomOut', 750) }}>
      <div style={{ fontSize:26, letterSpacing:'.5em', textTransform:'uppercase', opacity:.55, fontWeight:800, textAlign:'center' }}>SORTEO · GANADOR</div>
      <div style={{ textAlign:'center', margin:'18px 0 24px 0' }}>
        {players.map((p:any,i:number) => (
          <div key={i} style={{ fontSize:88, fontWeight:900, lineHeight:.95, textTransform:'uppercase', letterSpacing:'-.005em', color:accent,
            textShadow:`0 10px 40px ${hexAlpha(accent,.45)}` }}>
            {p?.last_name ?? ''}
          </div>
        ))}
      </div>
      <div style={{ display:'grid', placeItems:'center', gap:16, marginTop:18 }}>
        <div style={{ fontSize:90, lineHeight:1 }}>{CHOICE_ICON[match.toss_choice] ?? '🪙'}</div>
        <div style={{ padding:'16px 42px', borderRadius:999, background:hexAlpha(accent,.18), border:`2px solid ${hexAlpha(accent,.55)}`,
          fontSize:42, fontWeight:900, letterSpacing:'.18em', textTransform:'uppercase', color:'#fff' }}>
          {label}
        </div>
      </div>
    </div>
  )
}
