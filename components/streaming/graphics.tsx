'use client'
// ============================================================================
// Streaming Graphics — visual components
// ============================================================================
// 12 components, all bounded cards (no fullscreen overlays). Each supports
// enter + exit animations triggered via the `visible` prop (used together
// with <Presence> in OverlayStage). Consistent visual language:
//  · dark glass card  · 6-8px accent top bar  · 'Barlow Condensed'
// ============================================================================

import { useEffect, useState } from 'react'
import type { Score, Player, Sponsor, Tournament, WeatherData, Category } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import { animStyle, hexAlpha, flagPath, palette, CARD, KICKER } from './stage-shared'

// ─── Labels ─────────────────────────────────────────────────────────────────
const ROUND_LABELS: Record<string, string> = {
  F:   'FINAL',
  SF:  'SEMIFINAL',
  QF:  'CUARTOS DE FINAL',
  R16: 'OCTAVOS DE FINAL',
  R32: 'DIECISEISAVOS',
  RR:  'FASE DE GRUPOS',
  GRP: 'FASE DE GRUPOS',
  CON: 'CONSOLACIÓN',
  Q1:  'CLASIFICATORIA 1',
  Q2:  'CLASIFICATORIA 2',
}
function roundLabel(r: any) { return ROUND_LABELS[r ?? ''] ?? (r ?? '') }

// ─── Helpers ────────────────────────────────────────────────────────────────
const PTS = ['0','15','30','40']
function gamePoint(score: Score | null, team: 1|2): string {
  if (!score) return '0'
  const k = team===1 ? 't1' : 't2'
  if (score.super_tiebreak_active || score.tiebreak_active) return String(score.tiebreak_score?.[k] ?? 0)
  // Beach tennis 40-40 is the golden point itself — show 40-40 in the scorebug.
  if (score.deuce) return '40'
  return PTS[score.current_game?.[k] ?? 0] ?? '0'
}
function threeSetsFor(score: Score | null, team: 1|2): Array<number|null> {
  const out: Array<number|null> = [null, null, null]
  if (!score) return out
  const k = team===1 ? 't1' : 't2'
  const sets = score.sets ?? []
  for (let i = 0; i < Math.min(3, sets.length); i++) out[i] = sets[i][k]
  // Current set (only while match in progress)
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
function ageFrom(iso:string) { const d = new Date(iso); const now = new Date(); let a = now.getFullYear()-d.getFullYear(); const m = now.getMonth()-d.getMonth(); if (m<0 || (m===0 && now.getDate()<d.getDate())) a--; return a }

/** Laterality text adapted to gender context (category _m vs _f). */
function lateralityText(laterality: 'right'|'left'|'ambidextrous', category?: Category) {
  const female = (category ?? '').endsWith('_f')
  if (laterality === 'right') return female ? 'Diestra' : 'Diestro'
  if (laterality === 'left')  return female ? 'Zurda'   : 'Zurdo'
  return female ? 'Ambidiestra' : 'Ambidiestro'
}

// Small reusable player name+flag line
function PlayerLine({ p, fs, bold=900, flagH=40 }: { p:any, fs:number, bold?:number, flagH?:number }) {
  if (!p) return null
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, minWidth:0 }}>
      <img src={flagPath(p.nationality)} alt="" style={{ flex:'none', width:flagH*1.45, height:flagH, borderRadius:4, objectFit:'cover' }}/>
      <span style={{ fontSize:fs, fontWeight:bold, lineHeight:.95, textTransform:'uppercase', whiteSpace:'nowrap', letterSpacing:'.005em' }}>
        {(p.last_name ?? '').toUpperCase()}
      </span>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 1) TOURNAMENT INTRO — vertical centered card                             ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function TournamentIntro({ visible, tournament }: { visible: boolean, tournament: Tournament | null }) {
  if (!tournament) return null
  const pal = palette(tournament.scoreboard_config)
  const start = new Date(tournament.start_date).toLocaleDateString('es-ES', { day:'2-digit', month:'short' })
  const end   = new Date(tournament.end_date  ).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })
  const subtitle = [tournament.venue_name, tournament.venue_city, `${start} — ${end}`].filter(Boolean).join('  ·  ')

  return (
    <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
      width:1400, height:720, ...CARD, padding:'60px 80px',
      borderTop:`8px solid ${pal.accentA}`,
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:36, textAlign:'center',
      ...animStyle(visible, 'sgInZ', 'sgOutZ', 750) }}>

      {tournament.logo_url && (
        <img src={tournament.logo_url} alt="" style={{ maxWidth:320, maxHeight:280, objectFit:'contain' }}/>
      )}

      <div style={{ fontSize:120, fontWeight:900, lineHeight:.9, letterSpacing:'-.012em', textTransform:'uppercase', color:pal.text, maxWidth:'100%' }}>
        {tournament.name}
      </div>

      <div style={{ fontSize:30, fontWeight:800, letterSpacing:'.16em', textTransform:'uppercase', color:pal.accentA }}>
        {subtitle}
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 2) VENUE CARD — small bottom-right badge                                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function VenueCard({ visible, tournament }: { visible: boolean, tournament: Tournament | null }) {
  if (!tournament) return null
  const pal = palette(tournament.scoreboard_config)
  return (
    <div style={{ position:'absolute', right:90, bottom:90, width:560, ...CARD, padding:'22px 30px',
      borderLeft:`6px solid ${pal.accentA}`,
      display:'grid', gridTemplateColumns:'1fr auto', gap:20, alignItems:'center',
      ...animStyle(visible, 'sgInL', 'sgOutL', 650) }}>
      <div style={{ minWidth:0 }}>
        <div style={{ ...KICKER, fontSize:14, marginBottom:6 }}>SEDE</div>
        <div style={{ fontSize:44, fontWeight:900, lineHeight:.95, textTransform:'uppercase', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:pal.text }}>
          {tournament.venue_name || tournament.venue_city}
        </div>
        <div style={{ marginTop:8, fontSize:32, fontWeight:800, letterSpacing:'.16em', textTransform:'uppercase', color:pal.accentA, lineHeight:1 }}>
          {tournament.venue_city}
        </div>
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 3) MATCH PRESENTATION — nombre torneo grande, pill de fase centrado,     ║
// ║    nombres completos, espacio repartido (sin seed)                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function MatchPresentation({ visible, match, tournament }: { visible: boolean, match: any, tournament: Tournament | null }) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const isDoubles = match.match_type === 'doubles'
  const phaseLabel = roundLabel(match.round)
  const categoryLabel = CATEGORY_LABELS[match.category as Category] ?? match.category ?? ''
  const pillText = [phaseLabel, categoryLabel].filter(Boolean).join('  ·  ')

  return (
    <div style={{ position:'absolute', left:170, right:170, top:160, bottom:160, ...CARD, padding:0,
      borderTop:`8px solid ${pal.accentA}`,
      display:'flex', flexDirection:'column',
      ...animStyle(visible, 'sgInZ', 'sgOutZ', 750) }}>

      {/* HEADER — logo + nombre torneo grande (hasta 2 lineas) */}
      <div style={{ padding:'34px 60px 28px 60px', display:'flex', alignItems:'center', justifyContent:'center', gap:40, borderBottom:'1px solid rgba(255,255,255,.06)' }}>
        {tournament?.logo_url && (
          <img src={tournament.logo_url} alt="" style={{ height:120, width:120, objectFit:'contain', flex:'none' }}/>
        )}
        <div style={{ fontSize:76, fontWeight:900, lineHeight:.95, letterSpacing:'-.005em', textTransform:'uppercase', color:pal.text, textAlign:'center', maxWidth:1120 }}>
          {tournament?.name}
        </div>
      </div>

      {/* PHASE + CATEGORY pill centrado */}
      {pillText && (
        <div style={{ textAlign:'center', padding:'22px 0 10px 0' }}>
          <span style={{ display:'inline-block', padding:'14px 52px', borderRadius:999,
            background:hexAlpha(pal.accentA,.18), border:`2px solid ${hexAlpha(pal.accentA,.55)}`,
            fontSize:34, fontWeight:900, letterSpacing:'.2em', textTransform:'uppercase', color:pal.accentA }}>
            {pillText}
          </span>
        </div>
      )}

      {/* TEAMS */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 280px 1fr', alignItems:'center', padding:'10px 40px 36px' }}>
        <TeamBlock entry={match.entry1} accent={pal.accentA} align="right" isDoubles={isDoubles} pal={pal}/>
        <div style={{ display:'grid', placeItems:'center' }}>
          <div style={{ fontSize:230, fontWeight:900, lineHeight:.82, letterSpacing:'-.04em', color:pal.accentA }}>VS</div>
        </div>
        <TeamBlock entry={match.entry2} accent={pal.accentB} align="left" isDoubles={isDoubles} pal={pal}/>
      </div>
    </div>
  )
}

function TeamBlock({ entry, accent, align, isDoubles, pal }: { entry:any, accent:string, align:'left'|'right', isDoubles:boolean, pal:any }) {
  const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
  const hasAnyPhoto = players.some((p:any) => !!p?.photo_url)
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems: align==='right'?'flex-end':'flex-start', justifyContent:'center', gap:24, padding:'0 32px' }}>
      {/* Photos row — only visible players with photo */}
      {hasAnyPhoto && (
        <div style={{ display:'flex', gap:22, flexDirection: align==='right'?'row-reverse':'row' }}>
          {players.map((p:any,i:number) => p?.photo_url && (
            <div key={i} style={{ width:isDoubles?160:210, height:isDoubles?160:210, borderRadius:18, overflow:'hidden',
              border:`1px solid ${hexAlpha(accent,.35)}` }}>
              <img src={p.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            </div>
          ))}
        </div>
      )}
      {/* Names with flag */}
      <div style={{ display:'flex', flexDirection:'column', gap:16, alignItems: align==='right'?'flex-end':'flex-start' }}>
        {players.map((p:any,i:number) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:18, flexDirection: align==='right'?'row-reverse':'row' }}>
            <img src={flagPath(p?.nationality)} alt="" style={{ flex:'none', width:72, height:48, borderRadius:5, objectFit:'cover' }}/>
            <div style={{ display:'flex', flexDirection:'column', alignItems: align==='right'?'flex-end':'flex-start', lineHeight:1 }}>
              {p?.first_name && (
                <span style={{ fontSize: players.length===1?32:24, fontWeight:700, letterSpacing:'.02em', opacity:.8, textTransform:'uppercase' }}>
                  {p.first_name}
                </span>
              )}
              <span style={{ fontSize: players.length===1?78:54, fontWeight:900, lineHeight:.92, textTransform:'uppercase', whiteSpace:'nowrap', color:accent }}>
                {(p?.last_name ?? '').toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 4) PLAYER BIO — card alto, tipografía grande y secciones diferenciadas   ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function PlayerBio({ visible, player, team, category, tournament }: { visible:boolean, player: Player | null, team: 1|2, category?: Category, tournament: Tournament | null }) {
  if (!player) return null
  const pal = palette(tournament?.scoreboard_config)
  const accent = team===1 ? pal.accentA : pal.accentB
  const side: 'left'|'right' = team===1 ? 'left' : 'right'
  const enter = side==='left' ? 'sgInR' : 'sgInL'
  const exit  = side==='left' ? 'sgOutR' : 'sgOutL'

  // FICHA rows (excluyendo rankings que tienen sección propia)
  const ficha: Array<[string,string]> = []
  if (player.nationality)            ficha.push(['Nacionalidad', player.nationality.toUpperCase()])
  if (player.birth_date)             ficha.push(['Edad', String(ageFrom(player.birth_date))])
  else if (player.age_manual)        ficha.push(['Edad', String(player.age_manual)])
  if (player.birth_city)             ficha.push(['Nacimiento', player.birth_city])
  if (player.height_cm)              ficha.push(['Altura', `${player.height_cm} cm`])
  if (player.laterality)             ficha.push(['Lateralidad', lateralityText(player.laterality, category)])
  if (player.club)                   ficha.push(['Club', player.club])
  if (player.federacion_autonomica)  ficha.push(['Federación', player.federacion_autonomica])

  const hasPhoto    = !!player.photo_url
  const hasRanking  = !!(player.ranking_rfet || player.ranking_itf)
  const hasTitles   = (player.titles?.length ?? 0) > 0
  const hasBio      = !!player.bio

  const pos: React.CSSProperties = { position:'absolute', top:60, bottom:60, width:740 }
  if (side==='left')  pos.left = 60
  if (side==='right') pos.right = 60

  const sectionTitle: React.CSSProperties = {
    fontSize:20, letterSpacing:'.34em', textTransform:'uppercase', fontWeight:900, color:accent,
  }
  const divider: React.CSSProperties = { height:1, background:'rgba(255,255,255,.1)', margin:'22px 0' }

  return (
    <div style={{ ...pos, ...CARD, padding:'0',
      borderTop:`10px solid ${accent}`,
      display:'flex', flexDirection:'column',
      ...animStyle(visible, enter, exit, 700) } as any}>

      {/* HEADER — foto + nombre grande */}
      <div style={{ padding:'30px 36px 26px', display:'flex', gap:24, alignItems:'center' }}>
        {hasPhoto && (
          <div style={{ flex:'none', width:240, height:240, borderRadius:16, overflow:'hidden',
            border:`1px solid ${hexAlpha(accent,.35)}`, boxShadow:`0 12px 30px rgba(0,0,0,.45)` }}>
            <img src={player.photo_url!} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          </div>
        )}
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:6 }}>
            <img src={flagPath(player.nationality)} alt="" style={{ width:60, height:40, borderRadius:4, objectFit:'cover' }}/>
            <span style={{ fontSize:22, letterSpacing:'.3em', textTransform:'uppercase', fontWeight:900, opacity:.6 }}>JUGADOR</span>
          </div>
          <div style={{ fontSize:38, fontWeight:700, letterSpacing:'.02em', textTransform:'uppercase', lineHeight:1, opacity:.88 }}>
            {player.first_name}
          </div>
          <div style={{ fontSize:80, fontWeight:900, lineHeight:.92, textTransform:'uppercase', color:accent, letterSpacing:'-.005em' }}>
            {player.last_name}
          </div>
        </div>
      </div>

      {/* BODY scrollable-like: flex column with gaps */}
      <div style={{ padding:'0 36px 30px', display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>

        {/* FICHA */}
        {ficha.length > 0 && (
          <>
            <div style={divider}/>
            <div style={sectionTitle}>FICHA</div>
            <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 28px' }}>
              {ficha.map(([k,v]) => (
                <div key={k}>
                  <div style={{ fontSize:15, letterSpacing:'.22em', textTransform:'uppercase', fontWeight:800, opacity:.55 }}>{k}</div>
                  <div style={{ fontSize:30, fontWeight:900, marginTop:2, lineHeight:1.05 }}>{v}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* RANKING */}
        {hasRanking && (
          <>
            <div style={divider}/>
            <div style={sectionTitle}>RANKING</div>
            <div style={{ marginTop:12, display:'flex', gap:40 }}>
              {player.ranking_rfet && (
                <div style={{ flex:1, background:hexAlpha(accent,.12), border:`1px solid ${hexAlpha(accent,.3)}`, borderRadius:14, padding:'14px 20px' }}>
                  <div style={{ fontSize:16, letterSpacing:'.28em', textTransform:'uppercase', fontWeight:900, opacity:.75 }}>RFET</div>
                  <div style={{ fontSize:72, fontWeight:900, lineHeight:1, color:accent, fontVariantNumeric:'tabular-nums' }}>#{player.ranking_rfet}</div>
                </div>
              )}
              {player.ranking_itf && (
                <div style={{ flex:1, background:hexAlpha(accent,.12), border:`1px solid ${hexAlpha(accent,.3)}`, borderRadius:14, padding:'14px 20px' }}>
                  <div style={{ fontSize:16, letterSpacing:'.28em', textTransform:'uppercase', fontWeight:900, opacity:.75 }}>ITF</div>
                  <div style={{ fontSize:72, fontWeight:900, lineHeight:1, color:accent, fontVariantNumeric:'tabular-nums' }}>#{player.ranking_itf}</div>
                </div>
              )}
            </div>
          </>
        )}

        {/* PALMARÉS */}
        {hasTitles && (
          <>
            <div style={divider}/>
            <div style={sectionTitle}>PALMARÉS</div>
            <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:8 }}>
              {player.titles.slice(0,4).map((t,i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'90px 1fr', gap:16, alignItems:'baseline' }}>
                  <span style={{ fontSize:28, fontWeight:900, color:accent, fontVariantNumeric:'tabular-nums' }}>{t.year}</span>
                  <span style={{ fontSize:24, fontWeight:700, lineHeight:1.15 }}>{t.name}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* BIO */}
        {hasBio && (
          <>
            <div style={divider}/>
            <div style={sectionTitle}>BIO</div>
            <div style={{ marginTop:10, fontSize:24, lineHeight:1.4, opacity:.9, overflow:'hidden', flex:1 }}>
              {player.bio}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 5) REFEREE LOWER THIRD                                                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function RefereeLowerThird({ visible, referee, tournament }: { visible:boolean, referee:{ full_name:string, federacion?:string|null } | null, tournament: Tournament | null }) {
  if (!referee) return null
  const pal = palette(tournament?.scoreboard_config)
  return (
    <div style={{ position:'absolute', left:'50%', bottom:100, transform:'translateX(-50%)', width:1240, height:140, ...CARD, padding:0,
      display:'grid', gridTemplateColumns:'260px 1fr',
      ...animStyle(visible, 'sgInClip', 'sgOutClip', 700) }}>
      <div style={{ background:`linear-gradient(90deg, ${pal.accentA} 0%, ${pal.accentB} 100%)`, display:'grid', placeItems:'center' }}>
        <span style={{ fontSize:34, fontWeight:900, letterSpacing:'.3em', textTransform:'uppercase', color:'#fff' }}>ÁRBITRO</span>
      </div>
      <div style={{ padding:'0 32px', display:'flex', flexDirection:'column', justifyContent:'center', gap:4 }}>
        <span style={{ fontSize:60, fontWeight:900, lineHeight:.95, textTransform:'uppercase' }}>{referee.full_name}</span>
        {referee.federacion && <span style={{ fontSize:22, opacity:.75, letterSpacing:'.16em', textTransform:'uppercase', fontWeight:700 }}>{referee.federacion}</span>}
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 6) STATS PANEL — centrado, nombres tipo presentacion, marcador hasta     ║
// ║    el set del scope, breaks ganados/totales, advanced solo si activo     ║
// ╚══════════════════════════════════════════════════════════════════════════╝
function autoScope(match:any): 'set_1'|'set_2'|'set_3'|'match' {
  const sets = match?.score?.sets?.length ?? 0
  if (match?.status === 'finished') return 'match'
  if (sets <= 1) return 'set_1'
  if (sets === 2) return 'set_2'
  return 'set_3'
}

const SCOPE_TITLE: Record<string,string> = {
  set_1: 'PRIMER SET', set_2: 'SEGUNDO SET', set_3: 'TERCER SET', match: 'PARTIDO',
}

export function StatsPanel({ visible, match, tournament, scope }: { visible:boolean, match:any, tournament: Tournament | null, scope:'set_1'|'set_2'|'set_3'|'match'|'auto' }) {
  if (!match?.stats) return null
  const pal = palette(tournament?.scoreboard_config)
  const advanced = !!tournament?.advanced_stats_enabled
  const resolvedScope = scope === 'auto' ? autoScope(match) : scope
  const s = match.stats
  const isDoubles = match.match_type === 'doubles'

  // Breaks: ganados/totales y salvados/totales
  const breaksWonA  = s.t1.break_points_won
  const breaksWonTotA = s.t1.break_points_played_on_return ?? 0
  const breaksWonB  = s.t2.break_points_won
  const breaksWonTotB = s.t2.break_points_played_on_return ?? 0
  const breaksSavedA = s.t1.break_points_saved
  const breaksFacedA = s.t1.break_points_faced ?? 0
  const breaksSavedB = s.t2.break_points_saved
  const breaksFacedB = s.t2.break_points_faced ?? 0

  const rows: Array<{label:string, a:number|string, b:number|string}> = [
    { label: 'Aces',           a: s.t1.aces,          b: s.t2.aces },
    { label: 'Dobles faltas',  a: s.t1.double_faults, b: s.t2.double_faults },
    ...(advanced ? [
      { label: 'Winners',             a: s.t1.winners,          b: s.t2.winners },
      { label: 'Errores no forzados', a: s.t1.unforced_errors,  b: s.t2.unforced_errors },
    ] : []),
    { label: '% Puntos saque',          a: `${Math.round(s.t1.serve_points_won_pct||0)}%`, b: `${Math.round(s.t2.serve_points_won_pct||0)}%` },
    { label: '% Puntos resto',          a: `${Math.round(s.t1.return_points_won_pct||0)}%`, b: `${Math.round(s.t2.return_points_won_pct||0)}%` },
    { label: 'Breaks ganados / total',  a: `${breaksWonA}/${breaksWonTotA}`,   b: `${breaksWonB}/${breaksWonTotB}` },
    { label: 'Breaks salvados / total', a: `${breaksSavedA}/${breaksFacedA}`,  b: `${breaksSavedB}/${breaksFacedB}` },
    { label: 'Puntos totales',          a: s.t1.total_points_won,              b: s.t2.total_points_won },
  ]

  // Score hasta el scope
  const sets = match.score?.sets ?? []
  const currentSet = match.score?.current_set
  let showCount = resolvedScope === 'set_1' ? 1 : resolvedScope === 'set_2' ? 2 : resolvedScope === 'set_3' ? 3 : Math.max(1, sets.length)
  const visibleSets: Array<{num:number, t1:number, t2:number, isCurrent:boolean}> = []
  for (let i = 0; i < showCount; i++) {
    if (sets[i]) visibleSets.push({ num:i+1, t1:sets[i].t1, t2:sets[i].t2, isCurrent:false })
    else if (i === sets.length && currentSet && match.status === 'in_progress') {
      visibleSets.push({ num:i+1, t1:currentSet.t1 ?? 0, t2:currentSet.t2 ?? 0, isCurrent:true })
    }
  }

  return (
    <div style={{
      position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
      width:1180, ...CARD, padding:'34px 48px',
      borderTop:`6px solid ${pal.accentA}`,
      ...animStyle(visible, 'sgInZ', 'sgOutZ', 700),
    }}>
      {/* TITULO GRANDE */}
      <div style={{ textAlign:'center', marginBottom:20 }}>
        <div style={{ fontSize:52, fontWeight:900, lineHeight:.95, letterSpacing:'-.005em', textTransform:'uppercase' }}>ESTADÍSTICAS</div>
        <div style={{ marginTop:6, fontSize:26, fontWeight:900, letterSpacing:'.3em', textTransform:'uppercase', color:pal.accentA }}>
          {SCOPE_TITLE[resolvedScope] ?? ''}
        </div>
      </div>

      {/* JUGADORES + MARCADOR centrado */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:28, alignItems:'center', marginBottom:22 }}>
        <PlayerBlockSmall entry={match.entry1} align="right" accent={pal.accentA} doubles={isDoubles}/>
        <ScoreMini visibleSets={visibleSets}/>
        <PlayerBlockSmall entry={match.entry2} align="left"  accent={pal.accentB} doubles={isDoubles}/>
      </div>

      {/* FILAS ESTADISTICAS — divisor fino, sin barra de color */}
      <div>
        <div style={{ height:1, background:'rgba(255,255,255,.06)' }}/>
        {rows.map((r,i) => (
          <StatRow key={i} label={r.label} a={r.a} b={r.b} accentA={pal.accentA} accentB={pal.accentB}/>
        ))}
      </div>
    </div>
  )
}

function PlayerBlockSmall({ entry, align, accent, doubles }: { entry:any, align:'left'|'right', accent:string, doubles:boolean }) {
  const players = [entry?.player1, doubles ? entry?.player2 : null].filter(Boolean)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems: align==='right'?'flex-end':'flex-start' }}>
      {players.map((p:any, i:number) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:14, flexDirection: align==='right' ? 'row-reverse' : 'row' }}>
          <img src={flagPath(p?.nationality)} alt="" style={{ flex:'none', width:56, height:38, borderRadius:4, objectFit:'cover' }}/>
          <div style={{ display:'flex', flexDirection:'column', lineHeight:1, alignItems: align==='right' ? 'flex-end' : 'flex-start' }}>
            {p?.first_name && (
              <span style={{ fontSize: players.length===1?22:18, fontWeight:700, letterSpacing:'.02em', opacity:.82, textTransform:'uppercase' }}>
                {p.first_name}
              </span>
            )}
            <span style={{ fontSize: players.length===1?50:34, fontWeight:900, lineHeight:.95, textTransform:'uppercase', whiteSpace:'nowrap', color:accent }}>
              {(p?.last_name ?? '').toUpperCase()}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ScoreMini({ visibleSets }: { visibleSets: Array<{num:number, t1:number, t2:number, isCurrent:boolean}> }) {
  if (visibleSets.length === 0) return <div style={{ opacity:.3, fontSize:28, fontWeight:900 }}>—</div>
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'center', minWidth:200 }}>
      {visibleSets.map(s => (
        <div key={s.num} style={{ display:'flex', alignItems:'baseline', gap:14 }}>
          <span style={{ fontSize:15, letterSpacing:'.26em', fontWeight:900, opacity:.55 }}>SET {s.num}</span>
          <span style={{ fontSize:36, fontWeight:900, fontVariantNumeric:'tabular-nums', lineHeight:1 }}>
            {s.t1}<span style={{ opacity:.35, margin:'0 10px' }}>—</span>{s.t2}
          </span>
        </div>
      ))}
    </div>
  )
}

function StatRow({ label, a, b, accentA, accentB }: { label:string, a:number|string, b:number|string, accentA:string, accentB:string }) {
  const numA = parseFloat(String(a).replace('%','').split('/')[0]) || 0
  const numB = parseFloat(String(b).replace('%','').split('/')[0]) || 0
  const aWins = numA > numB
  const bWins = numB > numA
  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr 1fr', alignItems:'center', gap:24, padding:'14px 4px' }}>
        <span style={{ fontSize:40, fontWeight:900, textAlign:'right', color: aWins ? accentA : 'rgba(255,255,255,.88)', fontVariantNumeric:'tabular-nums', lineHeight:1 }}>{a}</span>
        <span style={{ fontSize:22, letterSpacing:'.22em', textAlign:'center', opacity:.75, textTransform:'uppercase', fontWeight:800 }}>{label}</span>
        <span style={{ fontSize:40, fontWeight:900, textAlign:'left',  color: bWins ? accentB : 'rgba(255,255,255,.88)', fontVariantNumeric:'tabular-nums', lineHeight:1 }}>{b}</span>
      </div>
      <div style={{ height:1, background:'rgba(255,255,255,.06)' }}/>
    </>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 7) SCOREBUG — solo sets jugados, dobles en una linea, sin labels         ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function Scorebug({ visible, match, tournament, flag }: { visible:boolean, match:any, tournament: Tournament | null, flag:{ kind:string|null, label:string } }) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const serving = match.serving_team as 1|2|null

  const setsPlayed = score?.sets?.length ?? 0
  const inProgress = score?.match_status === 'in_progress'
  const setCount = Math.max(1, Math.min(3, setsPlayed + (inProgress ? 1 : 0)))
  const currentSetIdx = inProgress ? setsPlayed : -1

  const rows = [1,2].map(t => {
    const team = t as 1|2
    const entry = team===1 ? match.entry1 : match.entry2
    const accent = team===1 ? pal.accentA : pal.accentB
    const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
    const allSets = threeSetsFor(score, team).slice(0, setCount)
    return { team, accent, players, sets: allSets, pt: gamePoint(score, team), serving: serving===team }
  })

  const flagColors: Record<string,string> = {
    match_point:'#ef4444', championship_point:'#f59e0b', set_point:'#a855f7', break_point:'#22d3ee',
  }
  const flagColor = flag.kind ? (flagColors[flag.kind] ?? pal.accentA) : null

  const setColW = 42
  const gridCols = `10px 1fr ${Array(setCount).fill(`${setColW}px`).join(' ')} 64px`

  return (
    <div style={{ position:'absolute', top:40, left:40, width: 280 + setCount*setColW, ...CARD, padding:0, overflow:'hidden',
      ...animStyle(visible, 'sgInR', 'sgOutR', 500) }}>
      {/* Header — tournament name + round (full label) */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', padding:'8px 14px', background:'rgba(255,255,255,.04)', borderBottom:'1px solid rgba(255,255,255,.06)', gap:14 }}>
        <span style={{ fontSize:13, letterSpacing:'.2em', textTransform:'uppercase', opacity:.8, fontWeight:800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {tournament?.name ?? ''}
        </span>
        <span style={{ fontSize:12, letterSpacing:'.22em', textTransform:'uppercase', opacity:.55, fontWeight:800, whiteSpace:'nowrap' }}>
          {roundLabel(match.round)}
        </span>
      </div>

      {/* Rows */}
      {rows.map((r,ri) => (
        <div key={r.team} style={{ display:'grid', gridTemplateColumns:gridCols, alignItems:'stretch', borderBottom: ri===0 ? '1px solid rgba(255,255,255,.06)' : 'none', height:48 }}>
          <div style={{ background:r.accent }}/>
          <div style={{ padding:'0 10px', display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
            {isDoubles ? (
              <>
                <div style={{ display:'flex', gap:3, flex:'none' }}>
                  {r.players.map((p:any,i:number) => (
                    <img key={i} src={flagPath(p.nationality)} alt="" style={{ width:22, height:15, borderRadius:2, objectFit:'cover' }}/>
                  ))}
                </div>
                <span style={{ fontSize:22, fontWeight:900, textTransform:'uppercase', letterSpacing:'.005em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1, flex:1 }}>
                  {r.players.map((p:any) => (p.last_name ?? '').toUpperCase()).join(' / ')}
                </span>
                {r.serving && (
                  <span style={{ width:10, height:10, borderRadius:'50%', background:pal.serve, flex:'none', animation:'sgSrvPulse 1.4s infinite' }}/>
                )}
              </>
            ) : (
              <>
                <img src={flagPath(r.players[0]?.nationality)} alt="" style={{ width:28, height:19, borderRadius:3, objectFit:'cover', flex:'none' }}/>
                <span style={{ fontSize:28, fontWeight:900, textTransform:'uppercase', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1, flex:1 }}>
                  {(r.players[0]?.last_name ?? '').toUpperCase()}
                </span>
                {r.serving && (
                  <span style={{ width:10, height:10, borderRadius:'50%', background:pal.serve, flex:'none', animation:'sgSrvPulse 1.4s infinite' }}/>
                )}
              </>
            )}
          </div>
          {r.sets.map((v,i) => (
            <div key={i} style={{ display:'grid', placeItems:'center', fontSize:26, fontWeight:900, borderLeft:'1px solid rgba(255,255,255,.06)',
              background: i === currentSetIdx ? hexAlpha(r.accent,.18) : 'rgba(0,0,0,.2)',
              color: v===null ? 'rgba(255,255,255,.3)' : '#fff', fontVariantNumeric:'tabular-nums' }}>
              {v===null ? '–' : v}
            </div>
          ))}
          <div style={{ display:'grid', placeItems:'center', background:r.accent, color:'#fff', fontSize:30, fontWeight:900, letterSpacing:'-.01em' }}>{r.pt}</div>
        </div>
      ))}
      {/* Flag banner — NO blink */}
      {flag.kind && flag.label && (
        <div style={{ padding:'6px 14px', background:flagColor!, color:'#000', fontSize:17, fontWeight:900, letterSpacing:'.3em', textAlign:'center', textTransform:'uppercase' }}>
          {flag.label}
        </div>
      )}
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 8) BIG SCOREBOARD — bounded card, phase in header, per-set times         ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export interface BigScoreboardOpts {
  show_sponsor?: boolean
  set_durations?: number[] // seconds per completed set, optional
}
export function BigScoreboard({ visible, match, tournament, sponsor, opts }: { visible:boolean, match:any, tournament: Tournament | null, sponsor: Sponsor | null, opts?: BigScoreboardOpts }) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const totalSecs = useTicker(match.started_at, match.finished_at)
  const showSponsor = opts?.show_sponsor !== false && !!sponsor
  const setCount = Math.max(1, Math.min(3, (score?.sets?.length ?? 0) + (score?.match_status==='in_progress' ? 1 : 0)))
  const setColW = 120
  const nameColMin = 540

  return (
    <div style={{ position:'absolute', left:'50%', bottom:50, transform:'translateX(-50%)', width:1580, ...CARD, padding:0, overflow:'hidden',
      borderTop:`8px solid ${pal.accentA}`,
      ...animStyle(visible, 'sgInU', 'sgOutU', 700) }}>

      {/* HEADER — tournament (big) + phase + total time */}
      <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', alignItems:'center', padding:'14px 28px', borderBottom:'1px solid rgba(255,255,255,.07)', gap:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height:54, objectFit:'contain' }}/>}
          <div style={{ display:'flex', flexDirection:'column', lineHeight:1 }}>
            <span style={{ fontSize:30, fontWeight:900, letterSpacing:'.04em', textTransform:'uppercase' }}>{tournament?.name}</span>
            <span style={{ fontSize:16, letterSpacing:'.24em', textTransform:'uppercase', opacity:.6, fontWeight:700, marginTop:4 }}>
              {CATEGORY_LABELS[match.category as Category] ?? match.category}
            </span>
          </div>
        </div>
        <div style={{ textAlign:'center' }}>
          <span style={{ padding:'10px 36px', borderRadius:999, background:hexAlpha(pal.accentA,.18), border:`2px solid ${hexAlpha(pal.accentA,.55)}`,
            fontSize:26, fontWeight:900, letterSpacing:'.2em', textTransform:'uppercase', color:pal.accentA }}>
            {roundLabel(match.round) || '—'}
          </span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
          <span style={{ ...KICKER, fontSize:12 }}>TIEMPO TOTAL</span>
          <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:30, fontWeight:800 }}>{fmtClock(totalSecs)}</span>
        </div>
      </div>

      {/* Set time row — one cell above each set column */}
      <div style={{ display:'grid', gridTemplateColumns:`12px minmax(${nameColMin}px, 1fr) repeat(${setCount}, ${setColW}px)${showSponsor ? ' 260px' : ''}`, alignItems:'center', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
        <div/><div/>
        {Array.from({ length: setCount }).map((_, i) => {
          const dur = opts?.set_durations?.[i]
          return (
            <div key={i} style={{ textAlign:'center', fontSize:13, letterSpacing:'.2em', fontWeight:800, opacity:.55, textTransform:'uppercase' }}>
              SET {i+1}{dur ? ` · ${fmtClock(dur)}` : ''}
            </div>
          )
        })}
        {showSponsor && <div style={{ fontSize:11, letterSpacing:'.22em', opacity:.5, textAlign:'center', fontWeight:800 }}>PATROCINADOR</div>}
      </div>

      {/* TEAM ROWS */}
      {[1,2].map(tn => {
        const team = tn as 1|2
        const entry = team===1 ? match.entry1 : match.entry2
        const accent = team===1 ? pal.accentA : pal.accentB
        const sets = threeSetsFor(score, team).slice(0, setCount)
        const won = match.status==='finished' && score?.winner_team===team
        const players = [entry?.player1, isDoubles?entry?.player2:null].filter(Boolean)
        return (
          <div key={team} style={{ display:'grid', gridTemplateColumns:`12px minmax(${nameColMin}px, 1fr) repeat(${setCount}, ${setColW}px)${showSponsor ? ' 260px' : ''}`, alignItems:'stretch', borderBottom: team===1 ? '1px solid rgba(255,255,255,.05)' : 'none', height: isDoubles ? 112 : 100, background: won ? hexAlpha(accent,.1) : 'transparent' }}>
            <div style={{ background: accent }}/>
            <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap:6, padding:'0 18px' }}>
              {players.map((p:any,i:number) => (
                <PlayerLine key={i} p={p} fs={players.length===1 ? 52 : 36} flagH={players.length===1 ? 42 : 32}/>
              ))}
              {entry?.seed && <span style={{ fontSize:14, letterSpacing:'.22em', opacity:.6, fontWeight:700 }}>CABEZA DE SERIE ({entry.seed})</span>}
            </div>
            {sets.map((v,i) => (
              <div key={i} style={{ display:'grid', placeItems:'center', fontSize:64, fontWeight:900, borderLeft:'1px solid rgba(255,255,255,.05)',
                background: (score?.sets?.length ?? 0) === i ? hexAlpha(accent, .14) : 'rgba(0,0,0,.2)',
                color: v===null ? 'rgba(255,255,255,.35)' : '#fff', fontVariantNumeric:'tabular-nums' }}>
                {v===null ? '–' : v}
              </div>
            ))}
            {showSponsor && (
              team===1 ? (
                <div style={{ gridRow:'1 / span 2', borderLeft:'1px solid rgba(255,255,255,.05)', display:'grid', placeItems:'center', padding:'10px' }}>
                  {sponsor?.logo_url
                    ? <img src={sponsor.logo_url} alt={sponsor.name} style={{ maxWidth:220, maxHeight:160, objectFit:'contain' }}/>
                    : <span style={{ fontSize:24, fontWeight:900, letterSpacing:'.1em', textAlign:'center', opacity:.8, textTransform:'uppercase' }}>{sponsor?.name ?? ''}</span>}
                </div>
              ) : null
            )}
          </div>
        )
      })}
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 9) RESULTS GRID — centrado, tipografia grande, agrupado por ronda        ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function ResultsGrid({ visible, matches, highlightMatchId, tournament, category }:
  { visible:boolean, matches:any[], highlightMatchId?:string|null, tournament: Tournament | null, category?: string }) {
  const pal = palette(tournament?.scoreboard_config)

  const ROUND_ORDER = ['F','SF','QF','R16','R32','RR','GRP','CON','Q1','Q2']
  const groups: Record<string, any[]> = {}
  matches.forEach(m => { const r = m.round ?? 'OTHER'; (groups[r] ??= []).push(m) })
  const rounds = Object.keys(groups).sort((a,b) => (ROUND_ORDER.indexOf(a)+1 || 99) - (ROUND_ORDER.indexOf(b)+1 || 99))

  return (
    <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:1600, maxHeight:940, ...CARD, padding:0, overflow:'hidden',
      borderTop:`10px solid ${pal.accentA}`,
      ...animStyle(visible, 'sgInZ', 'sgOutZ', 700) }}>

      {/* HEADER */}
      <div style={{ padding:'22px 40px', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:20, letterSpacing:'.34em', textTransform:'uppercase', fontWeight:900, opacity:.55, marginBottom:4 }}>Resultados</div>
          <div style={{ fontSize:52, fontWeight:900, lineHeight:.95, letterSpacing:'-.005em', textTransform:'uppercase' }}>
            {CATEGORY_LABELS[(category ?? matches[0]?.category) as Category] ?? tournament?.name}
          </div>
        </div>
        {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height:74 }}/>}
      </div>

      {/* BODY — rondas apiladas con encabezado de progresion */}
      <div style={{ padding:'18px 32px 24px', display:'flex', flexDirection:'column', gap:20, maxHeight:820, overflow:'hidden' }}>
        {rounds.slice(0,4).map(r => {
          const matchList = groups[r].slice(0, 6)
          return (
            <div key={r}>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:10 }}>
                <span style={{ padding:'6px 18px', borderRadius:8, background:hexAlpha(pal.accentA,.22), border:`1px solid ${hexAlpha(pal.accentA,.5)}`,
                  fontSize:22, letterSpacing:'.22em', textTransform:'uppercase', fontWeight:900, color:pal.accentA }}>
                  {roundLabel(r)}
                </span>
                <span style={{ flex:1, height:1, background:'rgba(255,255,255,.08)' }}/>
                <span style={{ fontSize:14, letterSpacing:'.26em', fontWeight:800, opacity:.5 }}>{groups[r].length} PARTIDOS</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns: matchList.length > 3 ? '1fr 1fr' : '1fr', gap:'10px 22px' }}>
                {matchList.map(m => {
                  const hot = m.id === highlightMatchId
                  const isDoubles = m.match_type === 'doubles'
                  const score = m.score as Score | null
                  return (
                    <div key={m.id} style={{ padding:'12px 16px', borderRadius:10,
                      background: hot ? hexAlpha(pal.accentA,.2) : 'rgba(255,255,255,.04)',
                      border: hot ? `2px solid ${pal.accentA}` : '1px solid rgba(255,255,255,.07)' }}>
                      <ResultMatchRow entry={m.entry1} score={score} team={1} accent={pal.accentA} isDoubles={isDoubles}/>
                      <div style={{ height:1, background:'rgba(255,255,255,.07)', margin:'4px 0' }}/>
                      <ResultMatchRow entry={m.entry2} score={score} team={2} accent={pal.accentB} isDoubles={isDoubles}/>
                      {m.status === 'in_progress' && (
                        <div style={{ marginTop:6, fontSize:13, letterSpacing:'.28em', fontWeight:900, color:pal.accentA, textAlign:'right' }}>● EN VIVO</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
function ResultMatchRow({ entry, score, team, accent, isDoubles }:{ entry:any, score:Score|null, team:1|2, accent:string, isDoubles:boolean }) {
  const players = [entry?.player1, isDoubles?entry?.player2:null].filter(Boolean)
  const sets = threeSetsFor(score, team)
  const winner = (score?.winner_team ?? null) === team
  return (
    <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto auto auto', alignItems:'center', gap:10, padding:'3px 0' }}>
      <div style={{ display:'flex', gap:3, flex:'none' }}>
        {players.map((p:any,i:number) => (
          <img key={i} src={flagPath(p?.nationality)} alt="" style={{ width:32, height:22, borderRadius:3, objectFit:'cover' }}/>
        ))}
      </div>
      <span style={{ fontSize:24, fontWeight: winner?900:700, color: winner?'#fff':'rgba(255,255,255,.8)', textTransform:'uppercase', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
        {players.map((p:any) => p?.last_name).filter(Boolean).join(' / ')}
      </span>
      {sets.map((v,i) => (
        <span key={i} style={{ fontSize:26, fontWeight:900, minWidth:28, textAlign:'center', color: v===null?'rgba(255,255,255,.22)':winner?accent:'rgba(255,255,255,.75)', fontVariantNumeric:'tabular-nums' }}>
          {v===null ? '' : v}
        </span>
      ))}
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 10) COIN TOSS — smaller, keeping accent top bar                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const CHOICE_LABEL: Record<string,string> = { serve:'ELIGE SACAR', receive:'ELIGE RESTAR', side_left:'ELIGE CAMPO (IZQ)', side_right:'ELIGE CAMPO (DCHA)' }

export function CoinToss({ visible, match, tournament }: { visible:boolean, match:any, tournament: Tournament | null }) {
  if (!match?.toss_winner) return null
  const pal = palette(tournament?.scoreboard_config)
  const winnerEntry = match.toss_winner === 1 ? match.entry1 : match.entry2
  const accent = match.toss_winner === 1 ? pal.accentA : pal.accentB
  const isDoubles = match.match_type === 'doubles'
  const label = CHOICE_LABEL[match.toss_choice] ?? match.toss_choice
  const players = [winnerEntry?.player1, isDoubles?winnerEntry?.player2:null].filter(Boolean)

  return (
    <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:720, ...CARD, padding:'28px 44px',
      borderTop:`8px solid ${accent}`,
      ...animStyle(visible, 'sgInZ', 'sgOutZ', 700) }}>
      <div style={{ textAlign:'center', fontSize:28, fontWeight:900, letterSpacing:'.28em', textTransform:'uppercase', color:pal.text }}>
        Ganador del sorteo
      </div>

      <div style={{ marginTop:22, display:'flex', flexDirection:'column', gap:14, alignItems:'center' }}>
        {players.map((p:any,i:number) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:16 }}>
            <img src={flagPath(p?.nationality)} alt="" style={{ flex:'none', width:64, height:44, borderRadius:5, objectFit:'cover' }}/>
            <div style={{ display:'flex', flexDirection:'column', lineHeight:1 }}>
              {p?.first_name && (
                <span style={{ fontSize:24, fontWeight:700, letterSpacing:'.02em', opacity:.85, textTransform:'uppercase' }}>{p.first_name}</span>
              )}
              <span style={{ fontSize:52, fontWeight:900, lineHeight:.95, textTransform:'uppercase', whiteSpace:'nowrap', color:accent }}>
                {(p?.last_name ?? '').toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:26, display:'grid', placeItems:'center' }}>
        <div style={{ padding:'14px 40px', borderRadius:999, background:hexAlpha(accent,.18), border:`2px solid ${hexAlpha(accent,.55)}`,
          fontSize:34, fontWeight:900, letterSpacing:'.2em', textTransform:'uppercase', color:'#fff' }}>
          {label}
        </div>
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 11) WEATHER CARD — header VENUE · CITY, icono grande, metricas legibles  ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// Datos reales de open-meteo.com vía lib/weather.ts (getWeather). El campo
// weather.condition sale del weather_code mapeado en 9 condiciones, todas
// con icono (ver WX_ICON abajo).
const WX_ICON: Record<string,string> = {
  'Despejado':'☀️', 'Parcialmente nublado':'⛅', 'Niebla':'🌫️', 'Llovizna':'🌦️',
  'Lluvia':'🌧️', 'Nieve':'❄️', 'Chubascos':'🌦️', 'Tormenta':'⛈️', 'Desconocido':'🌡️',
}
export function WeatherCard({ visible, weather, tournament }: { visible:boolean, weather: WeatherData | null, tournament: Tournament | null }) {
  if (!weather) return null
  const pal = palette(tournament?.scoreboard_config)
  const header = [tournament?.venue_name, tournament?.venue_city].filter(Boolean).join(' · ')
  return (
    <div style={{ position:'absolute', left:90, bottom:90, width:620, ...CARD, padding:0,
      borderLeft:`6px solid ${pal.accentA}`, overflow:'hidden',
      ...animStyle(visible, 'sgInR', 'sgOutR', 650) }}>
      {/* HEADER — VENUE · CITY */}
      <div style={{ padding:'12px 22px', background:'rgba(255,255,255,.04)', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
        <span style={{ fontSize:18, letterSpacing:'.26em', textTransform:'uppercase', fontWeight:900, color:pal.text, opacity:.95,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'block' }}>
          {header || 'SEDE'}
        </span>
      </div>
      {/* BODY */}
      <div style={{ padding:'22px 26px', display:'grid', gridTemplateColumns:'auto 1fr', gap:24, alignItems:'center' }}>
        <div style={{ fontSize:110, lineHeight:1 }}>{WX_ICON[weather.condition] ?? '🌡️'}</div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:18, letterSpacing:'.24em', textTransform:'uppercase', fontWeight:900, color:pal.accentA, marginBottom:4 }}>
            {weather.condition}
          </div>
          <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
            <span style={{ fontSize:80, fontWeight:900, lineHeight:1, color:pal.text, fontVariantNumeric:'tabular-nums' }}>{Math.round(weather.temperature_c)}°</span>
            <span style={{ fontSize:22, opacity:.7, fontWeight:700 }}>SENSACIÓN {Math.round(weather.feels_like_c)}°</span>
          </div>
          <div style={{ marginTop:10, display:'grid', gridTemplateColumns:'auto auto auto', gap:'0 24px', fontSize:20, fontWeight:700, opacity:.92 }}>
            <span>💨 {Math.round(weather.wind_speed_kmh)} km/h {weather.wind_direction}</span>
            <span>💧 {weather.humidity_pct}%</span>
            <span>☂ {weather.rain_probability_pct}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 12) BRACKET — knockout cuadro with highlighted current match             ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const BRACKET_ORDER: string[] = ['R32','R16','QF','SF','F']
export function BracketView({ visible, matches, highlightMatchId, tournament, category }:
  { visible:boolean, matches:any[], highlightMatchId?:string|null, tournament: Tournament | null, category?: string }) {
  const pal = palette(tournament?.scoreboard_config)
  const byRound: Record<string, any[]> = {}
  matches.forEach(m => { if (!BRACKET_ORDER.includes(m.round)) return; (byRound[m.round] ??= []).push(m) })
  const rounds = BRACKET_ORDER.filter(r => byRound[r]?.length)

  return (
    <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:1600, maxHeight:840, ...CARD, padding:0, overflow:'hidden',
      borderTop:`8px solid ${pal.accentA}`,
      ...animStyle(visible, 'sgInZ', 'sgOutZ', 700) }}>
      <div style={{ padding:'18px 32px', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ ...KICKER, fontSize:14, marginBottom:2 }}>Cuadro</div>
          <div style={{ fontSize:32, fontWeight:900, textTransform:'uppercase' }}>{CATEGORY_LABELS[(category ?? matches[0]?.category) as Category] ?? ''}</div>
        </div>
        {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height:50 }}/>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${rounds.length || 1}, 1fr)`, gap:24, padding:'18px 26px', maxHeight:720, overflow:'hidden' }}>
        {rounds.map(r => (
          <div key={r} style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ ...KICKER, fontSize:14, color:pal.accentA, opacity:1 }}>{roundLabel(r)}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, justifyContent:'space-around', flex:1 }}>
              {byRound[r].slice(0, 16).map(m => <BracketMatch key={m.id} m={m} hot={m.id===highlightMatchId} accentA={pal.accentA} accentB={pal.accentB}/>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
function BracketMatch({ m, hot, accentA, accentB }: { m:any, hot:boolean, accentA:string, accentB:string }) {
  const score = m.score as Score | null
  const isDoubles = m.match_type === 'doubles'
  return (
    <div style={{ padding:'8px 10px', borderRadius:8,
      background: hot ? hexAlpha(accentA, .18) : 'rgba(255,255,255,.03)',
      border: hot ? `2px solid ${accentA}` : '1px solid rgba(255,255,255,.06)' }}>
      <BracketLine entry={m.entry1} score={score} team={1} accent={accentA} isDoubles={isDoubles}/>
      <div style={{ height:1, background:'rgba(255,255,255,.08)', margin:'4px 0' }}/>
      <BracketLine entry={m.entry2} score={score} team={2} accent={accentB} isDoubles={isDoubles}/>
    </div>
  )
}
function BracketLine({ entry, score, team, accent, isDoubles }:{ entry:any, score:Score|null, team:1|2, accent:string, isDoubles:boolean }) {
  const players = [entry?.player1, isDoubles?entry?.player2:null].filter(Boolean)
  const sets = threeSetsFor(score, team)
  const winner = (score?.winner_team ?? null) === team
  const nat = players[0]?.nationality ?? null
  return (
    <div style={{ display:'grid', gridTemplateColumns:'20px auto 1fr auto auto auto', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:11, fontWeight:800, opacity:.55 }}>{entry?.seed ?? ''}</span>
      <img src={flagPath(nat)} alt="" style={{ width:22, height:15, borderRadius:2, objectFit:'cover' }}/>
      <span style={{ fontSize:15, fontWeight: winner?900:600, textTransform:'uppercase', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color: winner?'#fff':'rgba(255,255,255,.72)' }}>
        {players.map((p:any) => p?.last_name).filter(Boolean).join(' / ')}
      </span>
      {sets.map((v,i) => (
        <span key={i} style={{ fontSize:15, fontWeight:800, minWidth:16, textAlign:'center', fontVariantNumeric:'tabular-nums', color: v===null?'rgba(255,255,255,.2)':winner?accent:'rgba(255,255,255,.7)' }}>
          {v===null?'':v}
        </span>
      ))}
    </div>
  )
}
