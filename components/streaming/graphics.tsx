'use client'
// ============================================================================
// Streaming Graphics — visual components
// ============================================================================
// 12 components, all bounded cards (no fullscreen overlays). Each supports
// enter + exit animations triggered via the `visible` prop (used together
// with <Presence> in OverlayStage). Consistent visual language:
//  · dark glass card  · 6-8px accent top bar  · 'Barlow Condensed'
// ============================================================================

import React, { useEffect, useState, useMemo } from 'react'
import type { Score, Player, Sponsor, Tournament, WeatherData, Category } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import { animStyle, hexAlpha, flagPath, palette, firstSurname, CARD, KICKER } from './stage-shared'
import { Presence } from './presence'

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
function fmtHHmm(secs: number) {
  const s = Math.max(0, secs|0)
  const hh = Math.floor(s/3600), mm = Math.floor((s%3600)/60)
  return `${hh}:${String(mm).padStart(2,'0')}`
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
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 750) }}>

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
        <div style={{ ...KICKER, fontSize:24, marginBottom:6 }}>SEDE</div>
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

  // FICHA rows (sin nacionalidad — la bandera ya la indica; rankings en seccion aparte)
  const ficha: Array<[string,string]> = []
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
    fontSize:26, letterSpacing:'.34em', textTransform:'uppercase', fontWeight:900, color:accent,
  }
  const divider: React.CSSProperties = { height:1, background:'rgba(255,255,255,.1)', margin:'22px 0' }

  return (
    <div style={{ ...pos, ...CARD, padding:'0',
      borderTop:`10px solid ${accent}`,
      display:'flex', flexDirection:'column',
      ...animStyle(visible, enter, exit, 700) } as any}>

      {/* HEADER — foto (si hay) + nombre con bandera alineada junto al nombre */}
      <div style={{ padding:'30px 36px 26px', display:'flex', gap:24, alignItems:'center' }}>
        {hasPhoto && (
          <div style={{ flex:'none', width:240, height:240, borderRadius:16, overflow:'hidden',
            border:`1px solid ${hexAlpha(accent,.35)}`, boxShadow:`0 12px 30px rgba(0,0,0,.45)` }}>
            <img src={player.photo_url!} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          </div>
        )}
        <div style={{ minWidth:0, flex:1, display:'flex', alignItems:'center', gap:20 }}>
          <img src={flagPath(player.nationality)} alt="" style={{ flex:'none', width:96, height:64, borderRadius:6, objectFit:'cover', boxShadow:'0 4px 14px rgba(0,0,0,.4)' }}/>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:42, fontWeight:700, letterSpacing:'.02em', textTransform:'uppercase', lineHeight:1, opacity:.88 }}>
              {player.first_name}
            </div>
            <div style={{ fontSize:82, fontWeight:900, lineHeight:.92, textTransform:'uppercase', color:accent, letterSpacing:'-.005em' }}>
              {player.last_name}
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ padding:'0 36px 30px', display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>

        {/* FICHA */}
        {ficha.length > 0 && (
          <>
            <div style={divider}/>
            <div style={sectionTitle}>FICHA</div>
            <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px 30px' }}>
              {ficha.map(([k,v]) => (
                <div key={k}>
                  <div style={{ fontSize:24, letterSpacing:'.24em', textTransform:'uppercase', fontWeight:800, opacity:.6 }}>{k}</div>
                  <div style={{ fontSize:36, fontWeight:900, marginTop:3, lineHeight:1.05 }}>{v}</div>
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
            <div style={{ marginTop:14, display:'flex', gap:22 }}>
              {player.ranking_rfet && (
                <div style={{ flex:1, background:hexAlpha(accent,.14), border:`1px solid ${hexAlpha(accent,.35)}`, borderRadius:14, padding:'16px 22px' }}>
                  <div style={{ fontSize:26, letterSpacing:'.28em', textTransform:'uppercase', fontWeight:900, opacity:.8 }}>RFET</div>
                  <div style={{ fontSize:82, fontWeight:900, lineHeight:1, color:accent, fontVariantNumeric:'tabular-nums' }}>#{player.ranking_rfet}</div>
                </div>
              )}
              {player.ranking_itf && (
                <div style={{ flex:1, background:hexAlpha(accent,.14), border:`1px solid ${hexAlpha(accent,.35)}`, borderRadius:14, padding:'16px 22px' }}>
                  <div style={{ fontSize:26, letterSpacing:'.28em', textTransform:'uppercase', fontWeight:900, opacity:.8 }}>ITF</div>
                  <div style={{ fontSize:82, fontWeight:900, lineHeight:1, color:accent, fontVariantNumeric:'tabular-nums' }}>#{player.ranking_itf}</div>
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
            <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:10 }}>
              {player.titles.slice(0,4).map((t,i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'110px 1fr', gap:18, alignItems:'baseline' }}>
                  <span style={{ fontSize:32, fontWeight:900, color:accent, fontVariantNumeric:'tabular-nums' }}>{t.year}</span>
                  <span style={{ fontSize:28, fontWeight:700, lineHeight:1.15 }}>{t.name}</span>
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
            <div style={{ marginTop:12, fontSize:26, lineHeight:1.4, opacity:.9, overflow:'hidden', flex:1 }}>
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
        {referee.federacion && <span style={{ fontSize:28, opacity:.75, letterSpacing:'.16em', textTransform:'uppercase', fontWeight:700 }}>{referee.federacion}</span>}
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
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 700),
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

      {/* FOOTER — fase del partido + categoria */}
      <div style={{ marginTop:18, paddingTop:16, borderTop:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'center', gap:18, flexWrap:'wrap' }}>
        <span style={{ fontSize:26, letterSpacing:'.28em', textTransform:'uppercase', fontWeight:900, color:pal.accentA }}>
          {roundLabel(match.round)}
        </span>
        <span style={{ width:6, height:6, borderRadius:'50%', background:'rgba(255,255,255,.3)' }}/>
        <span style={{ fontSize:24, letterSpacing:'.22em', textTransform:'uppercase', fontWeight:800, opacity:.75 }}>
          {CATEGORY_LABELS[match.category as Category] ?? match.category}
        </span>
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
          <span style={{ fontSize:24, letterSpacing:'.26em', fontWeight:900, opacity:.55 }}>SET {s.num}</span>
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
        <span style={{ fontSize:28, letterSpacing:'.22em', textAlign:'center', opacity:.75, textTransform:'uppercase', fontWeight:800 }}>{label}</span>
        <span style={{ fontSize:40, fontWeight:900, textAlign:'left',  color: bWins ? accentB : 'rgba(255,255,255,.88)', fontVariantNumeric:'tabular-nums', lineHeight:1 }}>{b}</span>
      </div>
      <div style={{ height:1, background:'rgba(255,255,255,.06)' }}/>
    </>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 7) SCOREBUG — solo sets jugados, dobles en una linea, sin labels         ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export function Scorebug({ visible, match, tournament, flag, tickerStat }: { visible:boolean, match:any, tournament: Tournament | null, flag:{ kind:string|null, label:string }, tickerStat?: string | null }) {
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

  // Ticker: si está activo, REEMPLAZA el valor de la columna de puntos con
  // el valor de la estadística. Muestra además un pill con el label.
  const showTicker = !!tickerStat && !!match.stats
  const tickerLabel = tickerStat ? (STAT_LABELS[tickerStat] ?? tickerStat.toUpperCase()) : ''
  const labelHasPct = tickerLabel.includes('%')
  const _tickerValues = showTicker ? statValuePair(match.stats, tickerStat!) : { a:'', b:'' }
  // Si el label lleva %, quita el % del número (evita el doble % y el overflow)
  const tickerValues = labelHasPct
    ? { a: String(_tickerValues.a).replace('%',''), b: String(_tickerValues.b).replace('%','') }
    : _tickerValues

  const colW = 54
  // Grid sin columna extra: la de puntos sirve para ambos (pts o stat)
  const gridCols = `12px minmax(220px, max-content) ${Array(setCount + 1).fill(`${colW}px`).join(' ')}`

  return (
    <div style={{ position:'absolute', top:40, left:40, minWidth: 420, maxWidth: 820, ...CARD, padding:0, overflow:'hidden',
      ...animStyle(visible, 'sgInR', 'sgOutR', 500) }}>

      <div style={{ display:'grid', gridTemplateColumns:gridCols, gridTemplateRows:'54px 54px' }}>
        {rows.map((r, ri) => {
          const row = ri + 1
          const tickerVal = ri === 0 ? tickerValues.a : tickerValues.b
          return (
            <div key={r.team} style={{ display:'contents' }}>
              {/* Accent bar */}
              <div style={{ gridRow:row, gridColumn:1, background:r.accent }}/>
              {/* Name cell */}
              <div style={{ gridRow:row, gridColumn:2, padding:'0 14px', display:'flex', alignItems:'center', gap:10,
                borderBottom: ri===0 ? '1px solid rgba(255,255,255,.06)' : 'none' }}>
                {isDoubles ? (
                  <>
                    <div style={{ display:'flex', gap:3, flex:'none' }}>
                      {r.players.map((p:any,i:number) => (
                        <img key={i} src={flagPath(p.nationality)} alt="" style={{ width:26, height:18, borderRadius:3, objectFit:'cover' }}/>
                      ))}
                    </div>
                    <span style={{ fontSize:28, fontWeight:900, textTransform:'uppercase', whiteSpace:'nowrap', lineHeight:1 }}>
                      {r.players.map((p:any) => firstSurname(p).toUpperCase()).join(' / ')}
                    </span>
                    {r.serving && <span style={{ width:12, height:12, borderRadius:'50%', background:pal.serve, flex:'none', animation:'sgSrvPulse 1.4s infinite', marginLeft:2 }}/>}
                  </>
                ) : (
                  <>
                    <img src={flagPath(r.players[0]?.nationality)} alt="" style={{ width:34, height:23, borderRadius:3, objectFit:'cover', flex:'none' }}/>
                    <span style={{ fontSize:36, fontWeight:900, textTransform:'uppercase', whiteSpace:'nowrap', lineHeight:1 }}>
                      {(r.players[0]?.last_name ?? '').toUpperCase()}
                    </span>
                    {r.serving && <span style={{ width:12, height:12, borderRadius:'50%', background:pal.serve, flex:'none', animation:'sgSrvPulse 1.4s infinite', marginLeft:2 }}/>}
                  </>
                )}
              </div>
              {/* Sets */}
              {r.sets.map((v,i) => (
                <div key={i} style={{ gridRow:row, gridColumn:3+i, display:'grid', placeItems:'center', fontSize:32, fontWeight:900, borderLeft:'1px solid rgba(255,255,255,.06)', borderBottom: ri===0 ? '1px solid rgba(255,255,255,.06)' : 'none',
                  background: i === currentSetIdx ? hexAlpha(r.accent,.25) : 'rgba(0,0,0,.22)',
                  color: v===null ? 'rgba(255,255,255,.3)' : '#fff', fontVariantNumeric:'tabular-nums', overflow:'hidden' }}>
                  <span key={`t${r.team}-s${i}-${v ?? '-'}`} style={{ display:'inline-block', animation:'sgDigitIn 380ms cubic-bezier(.22,.9,.25,1) both' }}>
                    {v===null ? '–' : v}
                  </span>
                </div>
              ))}
              {/* Puntos / Stat (misma celda 54px, sin cambio de layout).
                  El LABEL de la stat no va dentro — va como pill debajo. */}
              <div style={{ gridRow:row, gridColumn:3+setCount, display:'grid', placeItems:'center',
                background: showTicker ? 'rgba(0,0,0,.35)' : hexAlpha(r.accent,.92),
                color:'#fff', fontSize:32, fontWeight:900, letterSpacing:'-.01em',
                borderBottom: ri===0 ? '1px solid rgba(255,255,255,.12)' : 'none',
                borderLeft: showTicker ? '1px solid rgba(255,255,255,.06)' : 'none',
                overflow:'hidden', fontVariantNumeric:'tabular-nums' }}>
                {showTicker
                  ? <span key={`st-${r.team}-${tickerStat}-${tickerVal}`} style={{ display:'inline-block', color: r.accent, animation:'sgDigitIn 380ms cubic-bezier(.22,.9,.25,1) both' }}>
                      {tickerVal}
                    </span>
                  : <span key={`pt${r.team}-${r.pt}`} style={{ display:'inline-block', animation:'sgDigitIn 380ms cubic-bezier(.22,.9,.25,1) both' }}>
                      {r.pt}
                    </span>
                }
              </div>
            </div>
          )
        })}
      </div>

      {/* Pills derechos (stat label + flag banner) — ancho auto, alineados
          al borde derecho del card. Cada uno tiene su propio slot flex así
          que aparecen uno encima del otro, siempre anclados a la derecha. */}
      {/* Pills — el wrapper se queda siempre montado y anima max-height
          junto con opacity/translateX del pill interno. As\u00ed el card no
          se encoge de golpe cuando el pill desaparece. */}
      <TickerPill
        show={showTicker}
        text={tickerLabel}
        fg={pal.accentA}
        bg={'rgba(255,255,255,.08)'}
        borderTop={`1px solid ${hexAlpha(pal.accentA,.3)}`}
      />
      <TickerPill
        show={!!(flag.kind && flag.label)}
        text={flag.label}
        fg={'#000'}
        bg={flagColor ?? '#ef6a4c'}
      />
    </div>
  )
}

// ─── TickerPill — pill right-aligned con CSS transitions ──────────────────
// Se queda SIEMPRE montado. Anima max-height + opacity + translateX con
// transitions. Evita el snap al desmontar (el card no se encoge de golpe).
function TickerPill({ show, text, fg, bg, borderTop }: { show: boolean, text: string, fg: string, bg: string, borderTop?: string }) {
  const ease = 'cubic-bezier(.19,1,.22,1)'
  return (
    <div style={{
      overflow:'hidden',
      textAlign:'right',
      maxHeight: show ? 46 : 0,
      transition: `max-height 600ms ${ease}`,
    }}>
      <span style={{
        display:'inline-block',
        padding:'5px 12px',
        background: bg,
        color: fg,
        fontSize:20, fontWeight:900, letterSpacing:'.18em', textTransform:'uppercase', whiteSpace:'nowrap',
        borderTop: borderTop,
        opacity: show ? 1 : 0,
        transform: show ? 'translateX(0)' : 'translateX(44px)',
        transition: `opacity 550ms ${ease}, transform 550ms ${ease}`,
      }}>
        {text || '\u00A0'}
      </span>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 8) BIG SCOREBOARD — centrado, sponsor como panel lateral armonico        ║
// ╚══════════════════════════════════════════════════════════════════════════╝
export interface BigScoreboardOpts {
  show_sponsor?: boolean
  set_durations?: number[]
}
export function BigScoreboard({ visible, match, tournament, sponsor, opts }: { visible:boolean, match:any, tournament: Tournament | null, sponsor: Sponsor | null, opts?: BigScoreboardOpts }) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const totalSecs = useTicker(match.started_at, match.finished_at)
  const showSponsor = opts?.show_sponsor !== false && !!sponsor
  const serving = match.serving_team as 1|2|null

  // ── SETS A MOSTRAR ───────────────────────────────────────────────────────
  // No queremos ver nunca un set 0-0. Asi que el set en curso solo se muestra
  // si al menos uno de los equipos ha anotado.
  const finishedSetCount = score?.sets?.length ?? 0
  const inProgress = score?.match_status === 'in_progress'
  const cs = score?.current_set ?? { t1: 0, t2: 0 }
  const tb = score?.tiebreak_score ?? { t1: 0, t2: 0 }
  const tbActive = !!(score?.tiebreak_active || score?.super_tiebreak_active)
  const currentT1 = tbActive ? (tb.t1 ?? 0) : (cs.t1 ?? 0)
  const currentT2 = tbActive ? (tb.t2 ?? 0) : (cs.t2 ?? 0)
  const currentHasScore = inProgress && (currentT1 > 0 || currentT2 > 0)
  const setCount = Math.min(3, finishedSetCount + (currentHasScore ? 1 : 0))

  // ── ORIGINAL ORDER (set 1, 2, 3) — para set winner detection
  const setIdx = Array.from({ length: setCount }, (_, i) => i)  // [0,1,2]
  // En el render visual, los sets se completan de DERECHA a IZQUIERDA: el
  // set 1 (mas antiguo) queda anclado al borde derecho del bloque de sets,
  // y los siguientes se anaden a la izquierda. Para conseguirlo invertimos
  // el indice de columna: setIdx i -> gridColumn 3 + (setCount-1-i).
  const colForSet = (i: number) => 3 + (setCount - 1 - i)

  const setColW = 92
  const sponsorColW = 230
  const cardMaxW = showSponsor ? 1420 : 1100
  const serveColor = pal.serve

  return (
    <div style={{ position:'absolute', left:0, right:0, bottom:50, display:'flex', justifyContent:'center', pointerEvents:'none' }}>
      <div style={{ width:'fit-content', maxWidth:cardMaxW, ...CARD, padding:0, overflow:'hidden', pointerEvents:'auto',
        borderTop:`6px solid ${pal.accentA}`,
        ...animStyle(visible, 'sgInU', 'sgOutU', 700) }}>

        {/* HEADER — compacto */}
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', alignItems:'center', padding:'10px 22px', borderBottom:'1px solid rgba(255,255,255,.07)', gap:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height:42, objectFit:'contain' }}/>}
            <div style={{ display:'flex', flexDirection:'column', lineHeight:1 }}>
              <span style={{ fontSize:22, fontWeight:900, letterSpacing:'.02em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{tournament?.name}</span>
              <span style={{ fontSize:18, letterSpacing:'.22em', textTransform:'uppercase', opacity:.7, fontWeight:800, marginTop:3 }}>
                {CATEGORY_LABELS[match.category as Category] ?? match.category}
              </span>
            </div>
          </div>
          <div style={{ textAlign:'center' }}>
            <span style={{ padding:'5px 18px', borderRadius:999, background:hexAlpha(pal.accentA,.18), border:`1.5px solid ${hexAlpha(pal.accentA,.55)}`,
              fontSize:20, fontWeight:900, letterSpacing:'.2em', textTransform:'uppercase', color:pal.accentA, whiteSpace:'nowrap' }}>
              {roundLabel(match.round) || '—'}
            </span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', lineHeight:1 }}>
            <span style={{ ...KICKER, fontSize:13 }}>TIEMPO TOTAL</span>
            <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:24, fontWeight:800, letterSpacing:'.02em', marginTop:3 }}>{fmtHHmm(totalSecs)}</span>
          </div>
        </div>

        {/* BODY */}
        <div style={{ display:'grid',
          gridTemplateColumns: setCount > 0
            ? (showSponsor
                ? `8px minmax(380px, max-content) repeat(${setCount}, ${setColW}px) ${sponsorColW}px`
                : `8px minmax(380px, max-content) repeat(${setCount}, ${setColW}px)`)
            : (showSponsor
                ? `8px minmax(380px, max-content) ${sponsorColW}px`
                : `8px minmax(380px, max-content)`),
          gridTemplateRows: setCount > 0 ? '28px 1fr 1fr' : '1fr 1fr',
        }}>

          {/* Set headers — solo si hay sets a mostrar */}
          {setCount > 0 && (
            <>
              <div style={{ gridColumn:`1 / span 2`, gridRow:1, borderBottom:'1px solid rgba(255,255,255,.05)' }}/>
              {setIdx.map(i => {
                const dur = opts?.set_durations?.[i]
                return (
                  <div key={`st${i}`} style={{
                    gridColumn: colForSet(i), gridRow:1,
                    display:'grid', placeItems:'center',
                    fontSize:14, letterSpacing:'.22em', fontWeight:800, opacity:.65, textTransform:'uppercase',
                    borderLeft:'1px solid rgba(255,255,255,.05)', borderBottom:'1px solid rgba(255,255,255,.05)',
                  }}>
                    SET {i+1}{dur ? ` · ${fmtClock(dur)}` : ''}
                  </div>
                )
              })}
            </>
          )}

          {/* TEAM ROWS */}
          {[1,2].map(tn => {
            const team = tn as 1|2
            const opTeam = (team === 1 ? 2 : 1) as 1|2
            const entry = team===1 ? match.entry1 : match.entry2
            const accent = team===1 ? pal.accentA : pal.accentB
            const setsT = threeSetsFor(score, team).slice(0, setCount)
            const setsOp = threeSetsFor(score, opTeam).slice(0, setCount)
            const matchWon = match.status==='finished' && score?.winner_team===team
            const players = [entry?.player1, isDoubles?entry?.player2:null].filter(Boolean)
            const row = setCount > 0 ? 1 + team : team
            const isServingTeam = serving === team
            const rowBg = matchWon ? hexAlpha(accent,.14) : isServingTeam ? hexAlpha(accent,.07) : 'transparent'
            return (
              <div key={team} style={{ display:'contents' }}>
                {/* Accent bar */}
                <div style={{ gridColumn:1, gridRow:row, background:accent }}/>
                {/* Names */}
                <div style={{ gridColumn:2, gridRow:row, display:'flex', flexDirection:'column', justifyContent:'center', gap: isDoubles ? 4 : 0, padding:'10px 22px', background: rowBg, borderTop: team===2 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
                  {players.map((p:any,i:number) => {
                    const isServer = isServingTeam && (!isDoubles || p.id === match.current_server_id)
                    return (
                      <BigScoreboardPlayer key={i}
                        player={p}
                        accent={accent}
                        isDoubles={isDoubles}
                        isServer={isServer}
                        servingColor={serveColor}
                      />
                    )
                  })}
                </div>
                {/* Set scores */}
                {setIdx.map(i => {
                  const v = setsT[i]
                  const opV = setsOp[i]
                  const isFinishedSet = i < finishedSetCount
                  const isCurrent = isFinishedSet === false && currentHasScore
                  const isSetWon = isFinishedSet && v != null && opV != null && v > opV
                  return (
                    <div key={i} style={{
                      gridColumn: colForSet(i), gridRow:row,
                      display:'grid', placeItems:'center',
                      fontSize:52, fontWeight:900,
                      borderLeft:'1px solid rgba(255,255,255,.05)',
                      borderTop: team===2 ? '1px solid rgba(255,255,255,.05)' : 'none',
                      // Set ganado: fondo solido accent + texto negro bold (alto contraste)
                      // Set en curso: fondo accent muy suave
                      // Set perdido o sin terminar: fondo neutro
                      background: isSetWon
                        ? accent
                        : isCurrent
                          ? hexAlpha(accent, .18)
                          : 'rgba(0,0,0,.22)',
                      color: isSetWon
                        ? '#0a0a14'
                        : v === null ? 'rgba(255,255,255,.35)' : '#fff',
                      fontVariantNumeric:'tabular-nums',
                      textShadow: isSetWon ? '0 1px 0 rgba(255,255,255,.25)' : 'none',
                    }}>
                      {v === null ? '–' : v}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* SPONSOR — anclado al borde derecho del card, span de todas las filas */}
          {showSponsor && (
            <div style={{
              gridColumn: setCount > 0 ? `${3 + setCount} / ${4 + setCount}` : '3 / 4',
              gridRow: setCount > 0 ? '1 / 4' : '1 / 3',
              borderLeft: '1px solid rgba(255,255,255,.08)',
              background: 'rgba(255,255,255,.02)',
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'12px',
            }}>
              <div style={{ fontSize:11, letterSpacing:'.3em', fontWeight:900, opacity:.5, textTransform:'uppercase', marginBottom:6 }}>Patrocinador oficial</div>
              <div style={{ flex:1, display:'grid', placeItems:'center', width:'100%' }}>
                {sponsor?.logo_url
                  ? <img src={sponsor.logo_url} alt={sponsor.name} style={{ maxWidth:200, maxHeight:90, objectFit:'contain' }}/>
                  : <span style={{ fontSize:18, fontWeight:900, letterSpacing:'.06em', textAlign:'center', opacity:.85, textTransform:'uppercase' }}>{sponsor?.name ?? ''}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BigScoreboardPlayer({ player, accent, isDoubles, isServer, servingColor }: {
  player: any, accent: string, isDoubles: boolean, isServer: boolean, servingColor: string,
}) {
  if (!player) return null
  // Mismas dimensiones para singles/doubles (la diferencia ahora es solo el
  // numero de filas dentro del card). Tamanos reducidos vs version anterior
  // para que el card sea mas compacto.
  const lastFs  = isDoubles ? 30 : 42
  const firstFs = isDoubles ? 18 : 24
  const flagSz  = isDoubles ? { w: 38, h: 26 } : { w: 50, h: 34 }
  return (
    <div style={{ display:'flex', alignItems:'baseline', gap:14, minWidth:0, whiteSpace:'nowrap' }}>
      <img src={flagPath(player.nationality)} alt="" style={{ flex:'none', width:flagSz.w, height:flagSz.h, borderRadius:3, objectFit:'cover', alignSelf:'center' }}/>
      {/* Nombre y apellido en la MISMA linea (first nombre mas pequenno + bold less) */}
      {player.first_name && (
        <span style={{ fontSize:firstFs, fontWeight:600, letterSpacing:'.02em', textTransform:'uppercase', color:'#ffffff', opacity:.78 }}>
          {player.first_name.toUpperCase()}
        </span>
      )}
      <span style={{ fontSize:lastFs, fontWeight:900, textTransform:'uppercase', letterSpacing:'-.005em', color:accent, lineHeight:.95 }}>
        {(player.last_name ?? '').toUpperCase()}
      </span>
      {/* Serve indicator: pelota de tenis con glow + label PROXIMO SAQUE
          asi se ve mucho mejor "quien va a sacar el siguiente juego". */}
      {isServer && (
        <span aria-label="saca" style={{
          flex:'none', display:'inline-flex', alignItems:'center', gap:8,
          marginLeft:6, padding:'3px 10px 3px 6px', borderRadius:999,
          background: hexAlpha(servingColor, .18),
          border: `1px solid ${hexAlpha(servingColor, .6)}`,
          alignSelf:'center',
        }}>
          <span style={{
            width:14, height:14, borderRadius:'50%', background:servingColor,
            boxShadow:`0 0 12px ${servingColor}`,
            animation:'sgSrvPulse 1.3s infinite',
            display:'inline-block',
          }}/>
          <span style={{ fontSize:11, fontWeight:900, letterSpacing:'.22em', textTransform:'uppercase', color: servingColor }}>
            SAQUE
          </span>
        </span>
      )}
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 9) RESULTS GRID — Order of Play: todos los partidos; hora si no empezo   ║
// ╚══════════════════════════════════════════════════════════════════════════╝
function fmtSchedule(iso: string | null | undefined, courtName?: string | null) {
  if (!iso && !courtName) return '— POR CONFIRMAR —'
  const parts: string[] = []
  if (iso) {
    const d = new Date(iso)
    const day = d.toLocaleDateString('es-ES', { weekday:'short', day:'2-digit', month:'short' }).toUpperCase().replace('.', '')
    const time = d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })
    parts.push(day, time)
  }
  if (courtName) parts.push(courtName)
  return parts.join(' · ')
}

export function ResultsGrid({ visible, matches, highlightMatchId, tournament, category }:
  { visible:boolean, matches:any[], highlightMatchId?:string|null, tournament: Tournament | null, category?: string }) {
  const pal = palette(tournament?.scoreboard_config)

  const ROUND_ORDER = ['F','SF','QF','R16','R32','RR','GRP','CON','Q1','Q2']
  const cat = (category ?? matches[0]?.category) as Category | undefined
  const catMatches = cat ? matches.filter((m:any) => m.category === cat) : matches
  // Mostrar SOLO la fase en curso. Heuristica:
  //   1. Si hay un partido en juego (in_progress), su ronda es la actual
  //   2. Si no, la primera ronda con partidos NO terminados (scheduled/etc)
  //   3. Si todos terminados, la ultima ronda (la final)
  const liveMatch = catMatches.find((m:any) => m.status === 'in_progress')
  let activeRound: string | null = null
  if (liveMatch) activeRound = liveMatch.round
  else {
    const pending = ROUND_ORDER.find(r => catMatches.some((m:any) => m.round === r && m.status !== 'finished'))
    if (pending) activeRound = pending
    else {
      const lastFinished = [...ROUND_ORDER].reverse().find(r => catMatches.some((m:any) => m.round === r))
      activeRound = lastFinished ?? null
    }
  }
  const groups: Record<string, any[]> = {}
  catMatches
    .filter((m:any) => activeRound === null || m.round === activeRound)
    .forEach((m:any) => { const r = m.round ?? 'OTHER'; (groups[r] ??= []).push(m) })
  const rounds = Object.keys(groups).sort((a,b) => (ROUND_ORDER.indexOf(a)+1 || 99) - (ROUND_ORDER.indexOf(b)+1 || 99))

  return (
    <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:1680, maxHeight:980, ...CARD, padding:0, overflow:'hidden',
      borderTop:`10px solid ${pal.accentA}`,
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 700) }}>

      {/* HEADER */}
      <div style={{ padding:'22px 40px', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:26, letterSpacing:'.34em', textTransform:'uppercase', fontWeight:900, opacity:.55, marginBottom:4 }}>Orden de juego · Resultados</div>
          <div style={{ fontSize:50, fontWeight:900, lineHeight:.95, letterSpacing:'-.005em', textTransform:'uppercase' }}>
            {CATEGORY_LABELS[(category ?? matches[0]?.category) as Category] ?? tournament?.name}
          </div>
        </div>
        {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height:72 }}/>}
      </div>

      {/* BODY — rondas apiladas, todos los partidos */}
      <div style={{ padding:'18px 32px 24px', display:'flex', flexDirection:'column', gap:22, maxHeight:860, overflow:'hidden' }}>
        {rounds.map(r => {
          const matchList = groups[r]
          return (
            <div key={r}>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:10 }}>
                <span style={{ padding:'6px 18px', borderRadius:8, background:hexAlpha(pal.accentA,.22), border:`1px solid ${hexAlpha(pal.accentA,.5)}`,
                  fontSize:28, letterSpacing:'.22em', textTransform:'uppercase', fontWeight:900, color:pal.accentA }}>
                  {roundLabel(r)}
                </span>
                <span style={{ flex:1, height:1, background:'rgba(255,255,255,.08)' }}/>
                <span style={{ fontSize:24, letterSpacing:'.24em', fontWeight:800, opacity:.55 }}>{matchList.length} PARTIDOS</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(370px, 1fr))', gap:12 }}>
                {matchList.map(m => <OopMatchCard key={m.id} m={m} hot={m.id===highlightMatchId} accentA={pal.accentA} accentB={pal.accentB}/>)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OopMatchCard({ m, hot, accentA, accentB }: { m:any, hot:boolean, accentA:string, accentB:string }) {
  const score = m.score as Score | null
  const hasStarted = !!(score && ((score.sets && score.sets.length > 0) || m.status === 'in_progress' || m.status === 'finished'))
  const isDoubles = m.match_type === 'doubles'
  return (
    <div style={{ padding:'10px 14px', borderRadius:10,
      background: hot ? hexAlpha(accentA,.2) : 'rgba(255,255,255,.04)',
      border: hot ? `2px solid ${accentA}` : '1px solid rgba(255,255,255,.07)' }}>
      <OopMatchLine entry={m.entry1} score={score} team={1} accent={accentA} isDoubles={isDoubles} hasStarted={hasStarted}/>
      <div style={{ height:1, background:'rgba(255,255,255,.07)', margin:'4px 0' }}/>
      <OopMatchLine entry={m.entry2} score={score} team={2} accent={accentB} isDoubles={isDoubles} hasStarted={hasStarted}/>
      {!hasStarted && (
        <div style={{ marginTop:6, fontSize:24, letterSpacing:'.2em', textTransform:'uppercase', fontWeight:800, color:'rgba(255,255,255,.65)', textAlign:'center' }}>
          {fmtSchedule(m.scheduled_at, m.court?.name)}
        </div>
      )}
      {m.status === 'in_progress' && (
        <div style={{ marginTop:4, fontSize:24, letterSpacing:'.28em', fontWeight:900, color:accentA, textAlign:'right' }}>● EN VIVO</div>
      )}
      {m.status === 'finished' && (
        <div style={{ marginTop:4, fontSize:24, letterSpacing:'.28em', fontWeight:900, color:'#22c55e', textAlign:'right' }}>FINAL</div>
      )}
    </div>
  )
}
function OopMatchLine({ entry, score, team, accent, isDoubles, hasStarted }:{ entry:any, score:Score|null, team:1|2, accent:string, isDoubles:boolean, hasStarted:boolean }) {
  const players = [entry?.player1, isDoubles?entry?.player2:null].filter(Boolean)
  const sets = threeSetsFor(score, team)
  const winner = (score?.winner_team ?? null) === team
  const nameStr = isDoubles
    ? players.map((p:any) => firstSurname(p)).filter(Boolean).join(' / ')
    : (players[0]?.last_name ?? '')
  return (
    <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto auto auto', alignItems:'center', gap:10, padding:'3px 0' }}>
      <div style={{ display:'flex', gap:3, flex:'none' }}>
        {players.map((p:any,i:number) => (
          <img key={i} src={flagPath(p?.nationality)} alt="" style={{ width:28, height:19, borderRadius:3, objectFit:'cover' }}/>
        ))}
      </div>
      <span style={{ fontSize:26, fontWeight: winner?900:700, color: winner?'#fff':'rgba(255,255,255,.8)', textTransform:'uppercase', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
        {nameStr.toUpperCase()}
      </span>
      {hasStarted ? sets.map((v,i) => (
        <span key={i} style={{ fontSize:28, fontWeight:900, minWidth:24, textAlign:'center', color: v===null?'rgba(255,255,255,.22)':winner?accent:'rgba(255,255,255,.78)', fontVariantNumeric:'tabular-nums' }}>
          {v===null ? '' : v}
        </span>
      )) : <></>}
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
    <div style={{ position:'absolute', right:90, bottom:90, width:520, ...CARD, padding:'22px 28px',
      borderTop:`6px solid ${accent}`,
      ...animStyle(visible, 'sgInL', 'sgOutL', 650) }}>
      <div style={{ textAlign:'center', fontSize:26, fontWeight:900, letterSpacing:'.26em', textTransform:'uppercase', color:pal.text, opacity:.9 }}>
        Ganador del sorteo
      </div>

      <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
        {players.map((p:any,i:number) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
            <img src={flagPath(p?.nationality)} alt="" style={{ flex:'none', width:48, height:32, borderRadius:4, objectFit:'cover' }}/>
            <div style={{ display:'flex', flexDirection:'column', lineHeight:1 }}>
              {p?.first_name && (
                <span style={{ fontSize:24, fontWeight:700, letterSpacing:'.02em', opacity:.85, textTransform:'uppercase' }}>{p.first_name}</span>
              )}
              <span style={{ fontSize:34, fontWeight:900, lineHeight:.95, textTransform:'uppercase', whiteSpace:'nowrap', color:accent }}>
                {(p?.last_name ?? '').toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:16, display:'grid', placeItems:'center' }}>
        <div style={{ padding:'10px 26px', borderRadius:999, background:hexAlpha(accent,.18), border:`2px solid ${hexAlpha(accent,.55)}`,
          fontSize:28, fontWeight:900, letterSpacing:'.18em', textTransform:'uppercase', color:'#fff' }}>
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
    <div style={{ position:'absolute', left:90, bottom:90, width:560, ...CARD, padding:0,
      borderLeft:`6px solid ${pal.accentA}`, overflow:'hidden',
      ...animStyle(visible, 'sgInR', 'sgOutR', 650) }}>
      {/* HEADER — VENUE · CITY */}
      <div style={{ padding:'10px 18px', background:'rgba(255,255,255,.05)', borderBottom:'1px solid rgba(255,255,255,.07)' }}>
        <span style={{ fontSize:28, letterSpacing:'.24em', textTransform:'uppercase', fontWeight:900, color:pal.text,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'block' }}>
          {header || 'SEDE'}
        </span>
      </div>
      {/* BODY — icono a la izquierda, stack temp/condicion/sensacion a la derecha */}
      <div style={{ padding:'18px 24px 14px', display:'grid', gridTemplateColumns:'auto 1fr', gap:22, alignItems:'center' }}>
        <div style={{ fontSize:106, lineHeight:1, filter:'drop-shadow(0 6px 16px rgba(0,0,0,.35))' }}>
          {WX_ICON[weather.condition] ?? '🌡️'}
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:92, fontWeight:900, lineHeight:.92, color:pal.text, fontVariantNumeric:'tabular-nums', letterSpacing:'-.02em' }}>
            {Math.round(weather.temperature_c)}°
          </div>
          <div style={{ marginTop:2, fontSize:28, fontWeight:900, letterSpacing:'.18em', textTransform:'uppercase', color:pal.accentA, lineHeight:1.15 }}>
            {weather.condition}
          </div>
          <div style={{ marginTop:4, fontSize:26, fontWeight:800, letterSpacing:'.2em', textTransform:'uppercase', opacity:.7, lineHeight:1.2 }}>
            SENSACIÓN {Math.round(weather.feels_like_c)}°
          </div>
        </div>
      </div>
      {/* Metricas — icono + valor grande, sin label */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', borderTop:'1px solid rgba(255,255,255,.07)' }}>
        <WxMetric icon="💨" value={`${Math.round(weather.wind_speed_kmh)}`} unit="km/h" extra={weather.wind_direction}/>
        <WxMetric icon="💧" value={`${weather.humidity_pct}`}              unit="%"/>
        <WxMetric icon="☂"  value={`${weather.rain_probability_pct}`}       unit="%"/>
      </div>
    </div>
  )
}
function WxMetric({ icon, value, unit, extra }: { icon:string, value:string, unit:string, extra?:string }) {
  return (
    <div style={{ padding:'14px 10px', display:'flex', alignItems:'center', justifyContent:'center', gap:12, borderLeft:'1px solid rgba(255,255,255,.06)' }}>
      <span style={{ fontSize:36, lineHeight:1 }}>{icon}</span>
      <div style={{ display:'flex', flexDirection:'column', lineHeight:1 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
          <span style={{ fontSize:40, fontWeight:900, fontVariantNumeric:'tabular-nums' }}>{value}</span>
          <span style={{ fontSize:24, fontWeight:800, opacity:.75, letterSpacing:'.05em' }}>{unit}</span>
        </div>
        {extra && (
          <span style={{ fontSize:24, fontWeight:800, opacity:.7, letterSpacing:'.16em', textTransform:'uppercase', marginTop:3 }}>
            {extra}
          </span>
        )}
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 12) BRACKET — desde CUARTOS hasta FINAL (R32/R16 fuera por decision UX)  ║
// ║                                                                          ║
// ║ El cuadro en pantalla siempre arranca en QF: en R16 (8 partidos) la      ║
// ║ vista es demasiado densa y poco legible, asi que en R16 mostramos        ║
// ║ ResultsGrid en su lugar. A partir de cuartos el cuadro entra en escena.  ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const BRACKET_KO_ROUNDS = ['QF','SF','F'] as const
type KoRound = typeof BRACKET_KO_ROUNDS[number]
const BRACKET_HEADER_LBL: Record<KoRound,string> = {
  QF:  'CUARTOS',
  SF:  'SEMIFINALES',
  F:   'FINAL',
}
const BRACKET_SLOTS: Record<KoRound, number> = { QF:4, SF:2, F:1 }

export function BracketView({ visible, matches, highlightMatchId, tournament, category }:
  { visible:boolean, matches:any[], highlightMatchId?:string|null, tournament: Tournament | null, category?: string }) {
  const pal = palette(tournament?.scoreboard_config)
  const LC = 'rgba(255,255,255,.3)'

  // Filtrar por categoria — si no, los partidos de otras categorias colisionan
  // en el mismo bucket por compartir match_number/round y el cuadro se rompe.
  const cat = (category ?? matches[0]?.category) as Category | undefined
  const catMatches = cat ? matches.filter((m:any) => m.category === cat) : matches

  // Agrupar por ronda y ordenar — solo contemplamos QF/SF/F en pantalla
  const byRound: Record<string, any[]> = { QF:[], SF:[], F:[] }
  catMatches.forEach((m:any) => { if (byRound[m.round]) byRound[m.round].push(m) })
  BRACKET_KO_ROUNDS.forEach(r => byRound[r].sort((a,b) => (a.match_number||0) - (b.match_number||0)))

  // Empezamos siempre en QF — si todavia no hay datos en QF, los slots seran
  // "Por determinar" hasta que octavos vaya cerrando partidos
  const firstRound: KoRound = 'QF'
  const firstIdx = BRACKET_KO_ROUNDS.indexOf(firstRound)
  const visibleRounds = BRACKET_KO_ROUNDS.slice(firstIdx) as KoRound[]

  // Por cada ronda visible, rellenar a tamaño esperado mapeando por match_number
  const roundsData: Array<{ round: KoRound, slots: any[] }> = visibleRounds.map(r => {
    const expected = BRACKET_SLOTS[r]
    const byNum: Record<number, any> = {}
    byRound[r].forEach((m:any) => { if (m.match_number) byNum[m.match_number] = m })
    const slots: any[] = []
    for (let i = 1; i <= expected; i++) slots.push(byNum[i] ?? null)
    return { round: r, slots }
  })

  const totalRows = BRACKET_SLOTS[firstRound] * 2  // ej. R16 -> 16 filas
  const N_COLS = visibleRounds.length

  // Plantilla de columnas: alterna [ronda 1fr] [conector 60px] [ronda 1fr] ...
  const colTracks: string[] = []
  for (let i = 0; i < N_COLS; i++) {
    if (i > 0) colTracks.push('60px')
    colTracks.push('1fr')
  }
  const gridCols = colTracks.join(' ')

  return (
    <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:1760, height:960, ...CARD, padding:0, overflow:'hidden',
      borderTop:`10px solid ${pal.accentA}`,
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 700) }}>
      {/* HEADER */}
      <div style={{ padding:'20px 36px', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:24, letterSpacing:'.34em', textTransform:'uppercase', fontWeight:900, opacity:.55, marginBottom:4 }}>Cuadro</div>
          <div style={{ fontSize:42, fontWeight:900, textTransform:'uppercase', lineHeight:.95 }}>{CATEGORY_LABELS[(category ?? matches[0]?.category) as Category] ?? ''}</div>
        </div>
        {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height:60 }}/>}
      </div>

      {/* ROUND HEADERS */}
      <div style={{ display:'grid', gridTemplateColumns:gridCols, padding:'14px 32px 0', gap:0 }}>
        {visibleRounds.map((r, i) => (
          <React.Fragment key={r}>
            {i > 0 && <div/>}
            <div style={{ textAlign:'center', fontSize:22, letterSpacing:'.3em', fontWeight:900, color:pal.accentA, textTransform:'uppercase' }}>
              {BRACKET_HEADER_LBL[r]}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* BRACKET GRID */}
      <div style={{ display:'grid', gridTemplateColumns:gridCols, gridTemplateRows:`repeat(${totalRows}, 1fr)`, height:780, padding:'10px 32px 24px' }}>
        {roundsData.map(({ round, slots }, colIdx) => {
          const slotsCount = slots.length
          const span = totalRows / slotsCount  // filas que ocupa cada slot
          const gridColumn = colIdx === 0 ? 1 : colIdx * 2 + 1
          return (
            <React.Fragment key={round}>
              {slots.map((m, i) => {
                const startRow = i * span + 1
                const endRow = startRow + span
                return (
                  <div key={`${round}-${i}`} style={{ gridColumn, gridRow:`${startRow}/${endRow}`, display:'flex', alignItems:'center', padding:'4px 0' }}>
                    <BracketSlot m={m} hot={m?.id===highlightMatchId} accentA={pal.accentA} accentB={pal.accentB} isFinal={round==='F'}/>
                  </div>
                )
              })}
              {/* Conector hacia la columna siguiente */}
              {colIdx < roundsData.length - 1 && (
                <div style={{ gridColumn: colIdx*2 + 2, gridRow:`1/${totalRows+1}`, position:'relative' }}>
                  {/* Por cada par (i, i+1) -> dibuja H+V+H */}
                  {Array.from({ length: slotsCount / 2 }).map((_, p) => {
                    const i1 = p*2, i2 = p*2 + 1
                    const c1 = ((i1 + 0.5) / slotsCount) * 100  // % vertical centro slot 1
                    const c2 = ((i2 + 0.5) / slotsCount) * 100  // centro slot 2
                    const cMid = (c1 + c2) / 2                  // centro del par (= centro siguiente slot)
                    return (
                      <React.Fragment key={p}>
                        {/* H desde slot 1 a la mitad */}
                        <div style={{ position:'absolute', left:0, width:'50%', top:`calc(${c1}% - 1px)`, height:2, background:LC }}/>
                        {/* H desde slot 2 a la mitad */}
                        <div style={{ position:'absolute', left:0, width:'50%', top:`calc(${c2}% - 1px)`, height:2, background:LC }}/>
                        {/* V uniendo c1 y c2 */}
                        <div style={{ position:'absolute', left:'calc(50% - 1px)', top:`${c1}%`, height:`${c2 - c1}%`, width:2, background:LC }}/>
                        {/* H desde el midpoint hacia la siguiente columna */}
                        <div style={{ position:'absolute', left:'50%', right:0, top:`calc(${cMid}% - 1px)`, height:2, background:LC }}/>
                      </React.Fragment>
                    )
                  })}
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

function BracketSlot({ m, hot, accentA, accentB, isFinal=false }: { m:any, hot:boolean, accentA:string, accentB:string, isFinal?:boolean }) {
  if (!m) {
    return (
      <div style={{ flex:1, padding:'18px 16px', borderRadius:10, background:'rgba(255,255,255,.02)', border:'1px dashed rgba(255,255,255,.15)', textAlign:'center' }}>
        <span style={{ fontSize:24, letterSpacing:'.22em', fontWeight:800, opacity:.4, textTransform:'uppercase' }}>Por determinar</span>
      </div>
    )
  }
  const score = m.score as Score | null
  const isDoubles = m.match_type === 'doubles'
  return (
    <div style={{ flex:1, padding:'10px 12px', borderRadius:10,
      background: hot ? hexAlpha(accentA,.22) : isFinal ? hexAlpha(accentA,.1) : 'rgba(255,255,255,.04)',
      border: hot ? `2px solid ${accentA}` : isFinal ? `1px solid ${hexAlpha(accentA,.5)}` : '1px solid rgba(255,255,255,.1)' }}>
      <BracketLine entry={m.entry1} score={score} team={1} accent={accentA} isDoubles={isDoubles}/>
      <div style={{ height:1, background:'rgba(255,255,255,.08)', margin:'4px 0' }}/>
      <BracketLine entry={m.entry2} score={score} team={2} accent={accentB} isDoubles={isDoubles}/>
    </div>
  )
}
function BracketLine({ entry, score, team, accent, isDoubles }:{ entry:any, score:Score|null, team:1|2, accent:string, isDoubles:boolean }) {
  if (!entry) return <div style={{ padding:'3px 0', fontSize:24, opacity:.35 }}>—</div>
  const players = [entry?.player1, isDoubles?entry?.player2:null].filter(Boolean)
  const sets = threeSetsFor(score, team)
  const winner = (score?.winner_team ?? null) === team
  const nameStr = isDoubles
    ? players.map((p:any) => firstSurname(p)).filter(Boolean).join(' / ')
    : (players[0]?.last_name ?? '')
  return (
    <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto auto auto', alignItems:'center', gap:8 }}>
      <div style={{ display:'flex', gap:3 }}>
        {players.map((p:any,i:number) => (
          <img key={i} src={flagPath(p?.nationality)} alt="" style={{ width:26, height:18, borderRadius:3, objectFit:'cover' }}/>
        ))}
      </div>
      <span style={{ fontSize:28, fontWeight: winner?900:700, textTransform:'uppercase', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color: winner?'#fff':'rgba(255,255,255,.8)' }}>
        {nameStr.toUpperCase()}
      </span>
      {sets.map((v,i) => (
        <span key={i} style={{ fontSize:28, fontWeight:900, minWidth:22, textAlign:'center', fontVariantNumeric:'tabular-nums', color: v===null?'rgba(255,255,255,.2)':winner?accent:'rgba(255,255,255,.78)' }}>
          {v===null?'':v}
        </span>
      ))}
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 13) AWARDS PODIUM — Campeón / Subcampeón / Tercero (lower third grande)  ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const RANK_CFG: Record<string, { label:string, medal:string, gradFrom:string, gradTo:string, text:string }> = {
  champion:  { label: 'CAMPEÓN',    medal: '🏆', gradFrom: '#fde68a', gradTo: '#d97706', text: '#1f1200' },
  runner_up: { label: 'SUBCAMPEÓN', medal: '🥈', gradFrom: '#e2e8f0', gradTo: '#64748b', text: '#0f172a' },
  third:     { label: 'TERCERO',    medal: '🥉', gradFrom: '#fdba74', gradTo: '#7c2d12', text: '#1a0800' },
}

interface AwardsData {
  rank: 'champion'|'runner_up'|'third'
  players: Array<{ first_name:string, last_name:string, nationality?:string|null, photo_url?:string|null }>
  category_label?: string
}

export function AwardsPodium({ visible, data, tournament }: { visible:boolean, data:AwardsData|null, tournament: Tournament | null }) {
  if (!data || !data.players || data.players.length === 0) return null
  const pal = palette(tournament?.scoreboard_config)
  const cfg = RANK_CFG[data.rank] ?? RANK_CFG.champion
  return (
    <div style={{ position:'absolute', left:'50%', bottom:90, transform:'translateX(-50%)', width:1440, ...CARD, padding:0, overflow:'hidden',
      borderTop:`10px solid ${cfg.gradFrom}`,
      ...animStyle(visible, 'sgInU', 'sgOutU', 750) }}>
      <div style={{ display:'grid', gridTemplateColumns:'240px 1fr auto', alignItems:'center', padding:'26px 32px', gap:30,
        background:`linear-gradient(90deg, ${hexAlpha(cfg.gradFrom,.22)} 0%, ${hexAlpha(cfg.gradTo,.08)} 60%, transparent 100%)` }}>

        {/* Left: medal + rank label */}
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:140, lineHeight:1 }}>{cfg.medal}</div>
          <div style={{ marginTop:6, padding:'8px 18px', borderRadius:999,
            background:`linear-gradient(90deg, ${cfg.gradFrom} 0%, ${cfg.gradTo} 100%)`,
            color:cfg.text, fontSize:26, fontWeight:900, letterSpacing:'.28em', textTransform:'uppercase', display:'inline-block' }}>
            {cfg.label}
          </div>
        </div>

        {/* Center: players */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {data.category_label && (
            <div style={{ fontSize:28, fontWeight:800, letterSpacing:'.22em', textTransform:'uppercase', color:pal.text2 }}>
              {data.category_label}
            </div>
          )}
          {data.players.map((p, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:18 }}>
              {p.nationality && (
                <img src={flagPath(p.nationality)} alt="" style={{ flex:'none', width:72, height:48, borderRadius:5, objectFit:'cover', boxShadow:'0 4px 14px rgba(0,0,0,.4)' }}/>
              )}
              <div style={{ lineHeight:1 }}>
                <div style={{ fontSize:32, fontWeight:700, letterSpacing:'.02em', textTransform:'uppercase', opacity:.85 }}>
                  {p.first_name}
                </div>
                <div style={{ fontSize:64, fontWeight:900, lineHeight:.94, textTransform:'uppercase', color:cfg.gradFrom, textShadow:`0 4px 18px ${hexAlpha(cfg.gradFrom,.35)}` }}>
                  {p.last_name}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: tournament logo */}
        <div style={{ textAlign:'right' }}>
          {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height:140, objectFit:'contain' }}/>}
        </div>
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 14) STATS TICKER — sidecar del scorebug (un stat a la vez)               ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// Se despliega a la derecha del scorebug, mismo top. Operador elige QUÉ
// stat mostrar (ACES, WINNERS, etc.). Se desliza desde la izquierda como
// si saliera del scorebug.
const STAT_LABELS: Record<string, string> = {
  aces: 'ACES',
  double_faults: 'DOBLES FALTAS',
  winners: 'WINNERS',
  unforced_errors: 'ERR. NO FORZADOS',
  serve_pct: '% PUNTOS AL SERVICIO',
  return_pct: '% PUNTOS AL RESTO',
  break_points_won: 'BREAKS GANADOS',
  break_points_saved: 'BREAKS SALVADOS',
  total_points_won: 'PUNTOS',
  max_streak: 'RACHA MÁX.',
}

function statValuePair(stats:any, key:string): { a:string, b:string } {
  const t1 = stats?.t1 ?? {}, t2 = stats?.t2 ?? {}
  switch (key) {
    case 'aces':                return { a: String(t1.aces ?? 0),               b: String(t2.aces ?? 0) }
    case 'double_faults':       return { a: String(t1.double_faults ?? 0),      b: String(t2.double_faults ?? 0) }
    case 'winners':             return { a: String(t1.winners ?? 0),            b: String(t2.winners ?? 0) }
    case 'unforced_errors':     return { a: String(t1.unforced_errors ?? 0),    b: String(t2.unforced_errors ?? 0) }
    case 'serve_pct':           return { a: `${Math.round(t1.serve_points_won_pct ?? 0)}%`,  b: `${Math.round(t2.serve_points_won_pct ?? 0)}%` }
    case 'return_pct':          return { a: `${Math.round(t1.return_points_won_pct ?? 0)}%`, b: `${Math.round(t2.return_points_won_pct ?? 0)}%` }
    case 'break_points_won':    return { a: `${t1.break_points_won ?? 0}/${t1.break_points_played_on_return ?? 0}`, b: `${t2.break_points_won ?? 0}/${t2.break_points_played_on_return ?? 0}` }
    case 'break_points_saved':  return { a: `${t1.break_points_saved ?? 0}/${t1.break_points_faced ?? 0}`,          b: `${t2.break_points_saved ?? 0}/${t2.break_points_faced ?? 0}` }
    case 'total_points_won':    return { a: String(t1.total_points_won ?? 0),   b: String(t2.total_points_won ?? 0) }
    case 'max_streak':          return { a: String(t1.max_points_streak ?? 0),  b: String(t2.max_points_streak ?? 0) }
    default:                    return { a: '0', b: '0' }
  }
}

/**
 * StatsTicker ya no es un gráfico independiente — se renderiza como una
 * columna extra DENTRO del Scorebug (ver la prop `tickerStat` en Scorebug).
 * Se exporta aquí como no-op para mantener la compatibilidad del catálogo.
 */
export function StatsTicker(_: any) { return null }
