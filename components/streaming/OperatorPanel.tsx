'use client'
// ============================================================================
// OperatorPanel — dashboard de control con 3 monitores + modos TAKE/PREVIEW-TAKE
// ============================================================================
// Monitores:   Venue (iframe scoreboard) · Preview (MiniStage local) · Program (iframe overlay)
// Modos:       TAKE        → click / hotkey salta directo a programa
//              PREVIEW-TAKE → click / hotkey carga en preview; N=TAKE, M=OUT, ESC=STOP
// Tabs:        Manual (botones + selectores) · Automático (reglas + log)
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Tournament, WeatherData } from '@/types'
import type { GraphicsMap, GraphicKey } from '@/types/streaming'
import { GRAPHICS, GRAPHIC_ORDER, GROUP_LABELS } from '@/lib/streaming/catalog'
import { AutomationRunner } from '@/lib/streaming/automation'
import { showGraphic, hideGraphic, hideAll, logEvent } from '@/lib/streaming/commands'
import { STREAM_KEYFRAMES } from './stage-shared'
import { MiniStage } from './OverlayStage'

interface Props {
  session: { id:string, match_id:string, tournament_id:string, active:boolean, automation_enabled:boolean }
  initialMatch: any
  tournament: Tournament
  rules: any[]
  allMatches: any[]
  referee: { full_name: string, federacion?: string|null } | null
  mainSponsor: any
  weather: WeatherData | null
}

type Mode = 'take' | 'preview-take'

export function OperatorPanel({ session, initialMatch, tournament, rules, allMatches, referee, mainSponsor, weather }: Props) {
  const supabase = createClient()
  const [match, setMatch] = useState<any>(initialMatch)
  const [program, setProgram] = useState<GraphicsMap>({})
  const [mode, setMode] = useState<Mode>('preview-take')
  const [previewKey, setPreviewKey] = useState<GraphicKey | null>(null)
  const [previewData, setPreviewData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual')
  const [autoEnabled, setAutoEnabled] = useState(session.automation_enabled)
  const [events, setEvents] = useState<any[]>([])
  const [statsScope, setStatsScope] = useState<'auto'|'set_1'|'set_2'|'set_3'|'match'>('auto')
  const [showSponsor, setShowSponsor] = useState(true)
  const [copyState, setCopyState] = useState<'idle'|'copied'>('idle')
  const runner = useRef<AutomationRunner | null>(null)

  // Persistencia del modo en localStorage
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('stream:mode') : null
    if (saved === 'take' || saved === 'preview-take') setMode(saved)
  }, [])
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('stream:mode', mode) }, [mode])

  // URLs
  const overlayUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/overlay/${session.match_id}`
  const venueUrl   = typeof window === 'undefined' ? '' : `${window.location.origin}/scoreboard/${session.match_id}`

  // Suscripciones
  useEffect(() => {
    const chState = supabase.channel(`op-state-${session.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'stream_state', filter:`session_id=eq.${session.id}` },
        (p) => setProgram(((p.new as any)?.graphics ?? {}) as GraphicsMap))
      .subscribe()
    supabase.from('stream_state').select('graphics').eq('session_id', session.id).single()
      .then(({ data }) => { if (data?.graphics) setProgram(data.graphics as any) })

    const chMatch = supabase.channel(`op-match-${session.match_id}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'matches', filter:`id=eq.${session.match_id}` },
        (p) => setMatch((m:any) => ({ ...m, ...(p.new as any) })))
      .subscribe()

    const chEvt = supabase.channel(`op-evt-${session.id}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'stream_events', filter:`session_id=eq.${session.id}` },
        (p) => setEvents(e => [p.new, ...e].slice(0, 40)))
      .subscribe()
    supabase.from('stream_events').select('*').eq('session_id', session.id).order('created_at',{ascending:false}).limit(40)
      .then(({ data }) => data && setEvents(data))

    return () => { supabase.removeChannel(chState); supabase.removeChannel(chMatch); supabase.removeChannel(chEvt) }
  }, [session.id, session.match_id])

  // Automation runner
  useEffect(() => {
    const r = new AutomationRunner(session.id, session.match_id, session.tournament_id)
    runner.current = r
    r.start().then(() => r.setEnabled(autoEnabled))
    return () => { r.stop(); runner.current = null }
  }, [session.id, session.match_id, session.tournament_id])
  useEffect(() => { runner.current?.setEnabled(autoEnabled) }, [autoEnabled])

  // Preview merge
  const previewGraphics = useMemo<GraphicsMap>(() => {
    if (!previewKey) return program
    return { ...program, [previewKey]: { visible: true, data: previewData } }
  }, [program, previewKey, previewData])

  const isInProgram = (k: GraphicKey) => !!program[k]?.visible

  function resolveData(k: GraphicKey, bioTarget?: { player_id:string, team:1|2 }): any {
    if (k === 'player_bio')     return bioTarget ?? null
    if (k === 'stats_panel')    return { scope: statsScope }
    if (k === 'results_grid')   return { category: match.category }
    if (k === 'bracket')        return { category: match.category }
    if (k === 'big_scoreboard') return { show_sponsor: showSponsor }
    return undefined
  }

  async function selectGraphic(k: GraphicKey, data?: any) {
    if (mode === 'take') {
      // Directo: toggle en programa
      if (isInProgram(k)) {
        await hideGraphic(session.id, k); logEvent(session.id, 'manual_hide', k)
      } else {
        await showGraphic(session.id, k, { data }); logEvent(session.id, 'manual_show', k, { data })
      }
    } else {
      // Preview
      setPreviewKey(k)
      setPreviewData(data ?? null)
    }
  }

  async function take() {
    if (!previewKey) return
    await showGraphic(session.id, previewKey, { data: previewData })
    logEvent(session.id, 'manual_show', previewKey, { data: previewData })
  }
  async function out() {
    if (!previewKey) return
    await hideGraphic(session.id, previewKey)
    logEvent(session.id, 'manual_hide', previewKey)
  }
  async function stopAll() {
    await hideAll(session.id)
    setPreviewKey(null); setPreviewData(null)
  }

  // Hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const up = e.key.toUpperCase()
      if (e.key === 'Escape') { e.preventDefault(); stopAll(); return }
      if (up === 'N') { e.preventDefault(); take(); return }
      if (up === 'M') { e.preventDefault(); out(); return }
      if (up === 'T') { e.preventDefault(); if (previewKey) selectGraphic(previewKey, previewData); return }
      for (const k of GRAPHIC_ORDER) {
        const meta = GRAPHICS[k]
        if (!meta.hotkey) continue
        if (up === meta.hotkey) {
          e.preventDefault()
          if (k === 'player_bio') return       // bio se selecciona por jugador (boton)
          selectGraphic(k, resolveData(k))
          return
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session.id, previewKey, previewData, mode, program, statsScope, showSponsor, match.category])

  async function toggleAutomation() {
    const next = !autoEnabled
    setAutoEnabled(next)
    await supabase.from('stream_sessions').update({ automation_enabled: next }).eq('id', session.id)
  }
  async function copyUrl() {
    try { await navigator.clipboard.writeText(overlayUrl); setCopyState('copied'); setTimeout(()=>setCopyState('idle'),1500) } catch {}
  }

  // Jugadores para botones de bio
  const playersList = [
    { team:1 as const, p: match.entry1?.player1 },
    { team:1 as const, p: match.entry1?.player2 },
    { team:2 as const, p: match.entry2?.player1 },
    { team:2 as const, p: match.entry2?.player2 },
  ].filter(x => x.p)

  // Graphics agrupados (sin player_bio — tiene sus botones per-player)
  const grouped = GRAPHIC_ORDER.filter(k => k !== 'player_bio').reduce<Record<string, GraphicKey[]>>((acc, k) => {
    const g = GRAPHICS[k].group; (acc[g] ??= []).push(k); return acc
  }, {})

  return (
    <div style={{ minHeight:'100vh', background:'#05080f', color:'#fff', fontFamily:'Barlow, system-ui, sans-serif' }}>
      {/* Keyframes globales (para que MiniStage anime igual que el overlay) */}
      <style jsx global>{STREAM_KEYFRAMES}</style>

      {/* TOP BAR */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 24px', borderBottom:'1px solid #141a2a', background:'#070b16', gap:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:900, letterSpacing:'.06em' }}>STREAMING · OPERADOR</div>
          <div style={{ fontSize:12, opacity:.6 }}>{tournament?.name} · {match.round} · {match.category}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          {/* Mode selector */}
          <div style={{ display:'flex', alignItems:'center', gap:0, background:'#0a101e', border:'1px solid #243250', borderRadius:10, padding:3 }}>
            {(['preview-take','take'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding:'7px 14px', borderRadius:7, fontSize:11, fontWeight:900, letterSpacing:'.1em', textTransform:'uppercase', border:'none', cursor:'pointer',
                background: mode===m ? '#ef6a4c' : 'transparent',
                color: mode===m ? '#fff' : '#8ea2c6',
              }}>
                {m === 'preview-take' ? 'PREVIEW · TAKE' : 'TAKE DIRECTO'}
              </button>
            ))}
          </div>
          <button onClick={copyUrl} style={btn('outline')}>{copyState==='copied' ? '✓ Copiada' : 'URL vMix'}</button>
          <a href={overlayUrl} target="_blank" rel="noreferrer" style={{ ...btn('outline'), textDecoration:'none' }}>Programa ↗</a>
          <button onClick={stopAll} style={btn('danger')}>STOP · OCULTAR TODO <span style={{opacity:.6, marginLeft:8, fontSize:11}}>ESC</span></button>
        </div>
      </div>

      {/* MONITORES */}
      <div style={{ padding:'14px 20px', display:'grid', gridTemplateColumns: mode==='preview-take' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap:14 }}>
        <Monitor label="VENUE" color="#8ea2c6">
          <iframe src={venueUrl} style={{ width:'100%', height:'100%', border:0, background:'#050810', pointerEvents:'none' }}/>
        </Monitor>

        {mode === 'preview-take' && (
          <Monitor
            label={previewKey ? `PREVIEW · ${GRAPHICS[previewKey].label.toUpperCase()}` : 'PREVIEW · VACÍO'}
            color="#22d3ee"
            indicator={previewKey ? 'ready' : undefined}
          >
            <div style={{ width:'100%', height:'100%', background:'repeating-conic-gradient(#141a2a 0 25%, #0a0f1c 0 50%) 50% / 40px 40px' }}>
              <MiniStage graphics={previewGraphics} match={match} tournament={tournament} allMatches={allMatches} referee={referee} mainSponsor={mainSponsor} weather={weather}/>
            </div>
          </Monitor>
        )}

        <Monitor label="PROGRAMA · EN AIRE" color="#ef4444" indicator="live">
          <iframe src={overlayUrl} style={{ width:'100%', height:'100%', border:0, background:'repeating-conic-gradient(#141a2a 0 25%, #0a0f1c 0 50%) 50% / 40px 40px', pointerEvents:'none' }}/>
        </Monitor>
      </div>

      {/* TAKE / OUT BAR (solo preview-take) */}
      {mode === 'preview-take' && (
        <div style={{ padding:'8px 20px 18px', display:'flex', gap:10, alignItems:'center', justifyContent:'center' }}>
          <button onClick={take}   disabled={!previewKey} style={bigBtn('#15803d', !previewKey)}>
            TAKE <span style={{ opacity:.7, marginLeft:8, fontSize:12 }}>[N]</span>
          </button>
          <button onClick={out}    disabled={!previewKey} style={bigBtn('#b45309', !previewKey)}>
            OUT <span style={{ opacity:.7, marginLeft:8, fontSize:12 }}>[M]</span>
          </button>
          <button onClick={stopAll} style={bigBtn('#991b1b', false)}>
            STOP <span style={{ opacity:.7, marginLeft:8, fontSize:12 }}>[ESC]</span>
          </button>
          <div style={{ marginLeft:14, fontSize:12, opacity:.6, letterSpacing:'.18em', textTransform:'uppercase' }}>
            {previewKey
              ? <>Preview: <b style={{ color:'#22d3ee' }}>{GRAPHICS[previewKey].label}</b> {isInProgram(previewKey) && <span style={{ color:'#ef4444', marginLeft:8 }}>● YA EN AIRE</span>}</>
              : 'Pulsa un gráfico para cargar en preview'}
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{ padding:'0 20px', borderBottom:'1px solid #141a2a', display:'flex', gap:6 }}>
        {(['manual','auto'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding:'12px 22px', border:'none', borderBottom: activeTab===t ? '3px solid #ef6a4c' : '3px solid transparent',
            background:'transparent', color: activeTab===t ? '#fff' : '#64748b', fontWeight:900, letterSpacing:'.14em', textTransform:'uppercase', fontSize:13, cursor:'pointer',
          }}>
            {t === 'manual' ? 'Manual' : 'Automático'}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div style={{ padding:'18px 20px 32px' }}>
        {activeTab === 'manual' ? (
          <ManualTab
            grouped={grouped}
            playersList={playersList}
            selectGraphic={selectGraphic}
            resolveData={resolveData}
            previewKey={previewKey}
            previewData={previewData}
            program={program}
            mode={mode}
            statsScope={statsScope}
            setStatsScope={setStatsScope}
            showSponsor={showSponsor}
            setShowSponsor={setShowSponsor}
          />
        ) : (
          <AutoTab
            autoEnabled={autoEnabled}
            toggleAutomation={toggleAutomation}
            rules={rules}
            events={events}
          />
        )}
      </div>
    </div>
  )
}

// ─── Monitor ─────────────────────────────────────────────────────────────────
function Monitor({ label, color, indicator, children }: { label:string, color:string, indicator?:'live'|'ready', children:React.ReactNode }) {
  return (
    <div style={{ background:'#0a101e', border:'1px solid #141a2a', borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', borderBottom:'1px solid #141a2a' }}>
        {indicator === 'live' && <span style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444', boxShadow:'0 0 10px #ef4444', animation:'sgBlink 1.2s infinite' }}/>}
        {indicator === 'ready' && <span style={{ width:8, height:8, borderRadius:'50%', background:'#22d3ee' }}/>}
        <span style={{ fontSize:11, letterSpacing:'.3em', fontWeight:900, textTransform:'uppercase', color }}>{label}</span>
      </div>
      <div style={{ position:'relative', width:'100%', aspectRatio:'16/9' }}>{children}</div>
    </div>
  )
}

// ─── Manual Tab ──────────────────────────────────────────────────────────────
function ManualTab({ grouped, playersList, selectGraphic, resolveData, previewKey, previewData, program, mode, statsScope, setStatsScope, showSponsor, setShowSponsor }: {
  grouped: Record<string, GraphicKey[]>
  playersList: Array<{ team:1|2, p:any }>
  selectGraphic: (k:GraphicKey, data?:any) => void
  resolveData: (k:GraphicKey, bio?:{player_id:string,team:1|2}) => any
  previewKey: GraphicKey | null
  previewData: any
  program: GraphicsMap
  mode: Mode
  statsScope: any
  setStatsScope: (v:any) => void
  showSponsor: boolean
  setShowSponsor: (v:any) => void
}) {
  const isInProgram = (k: GraphicKey) => !!program[k]?.visible
  const isInPreview = (k: GraphicKey, data?: any) => {
    if (previewKey !== k) return false
    if (k === 'player_bio' && previewData && data) return previewData.player_id === data.player_id
    return true
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Selectores contextuales */}
      <section style={panel()}>
        <Title t="Selectores de contenido"/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <div>
            <div style={labelSm()}>Alcance estadísticas</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
              {(['auto','set_1','set_2','set_3','match'] as const).map(s => (
                <button key={s} onClick={() => setStatsScope(s)} style={chip(statsScope===s, '#22d3ee')}>{s.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={labelSm()}>Marcador grande</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
              <button onClick={() => setShowSponsor(!showSponsor)} style={chip(showSponsor, '#a855f7')}>
                {showSponsor ? '✓ con patrocinador' : '○ sin patrocinador'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* BIO por jugador */}
      <section style={panel()}>
        <Title t="Bio de jugador"/>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:8 }}>
          {playersList.map(({ team, p }) => {
            const data = { player_id: p.id, team }
            const inPreview = isInPreview('player_bio', data)
            const inProg = isInProgram('player_bio') && (program.player_bio?.data as any)?.player_id === p.id
            return (
              <button key={p.id} onClick={() => selectGraphic('player_bio', data)} style={graphicBtn(inProg, inPreview, team===1?'#ef6a4c':'#af005f')}>
                <div style={{ fontSize:12, opacity:.7, letterSpacing:'.12em', textTransform:'uppercase', marginBottom:2 }}>Eq. {team} · Bio</div>
                <div style={{ fontSize:15, fontWeight:900, textTransform:'uppercase' }}>{p.first_name} {p.last_name}</div>
                <StateBadge inProg={inProg} inPreview={inPreview} mode={mode}/>
              </button>
            )
          })}
        </div>
      </section>

      {/* Resto de graphics agrupados */}
      {Object.entries(grouped).map(([group, keys]) => (
        <section key={group} style={panel()}>
          <Title t={GROUP_LABELS[group as keyof typeof GROUP_LABELS]}/>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:8 }}>
            {keys.map(k => {
              const meta = GRAPHICS[k]
              const data = resolveData(k)
              const inPreview = isInPreview(k, data)
              const inProg = isInProgram(k)
              return (
                <button key={k} onClick={() => selectGraphic(k, data)} style={graphicBtn(inProg, inPreview, '#ef6a4c')}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:13, fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase' }}>{meta.label}</span>
                    <span style={{ fontSize:11, opacity:.55 }}>{meta.hotkey ? `[${meta.hotkey}]` : ''}</span>
                  </div>
                  <div style={{ fontSize:11, opacity:.55, marginTop:4 }}>{meta.description}</div>
                  <StateBadge inProg={inProg} inPreview={inPreview} mode={mode}/>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
function StateBadge({ inProg, inPreview, mode }: { inProg:boolean, inPreview:boolean, mode:Mode }) {
  return (
    <div style={{ marginTop:8, display:'flex', gap:6, fontSize:10, letterSpacing:'.22em', fontWeight:900 }}>
      {inProg && <span style={{ color:'#ef4444' }}>● EN AIRE</span>}
      {inPreview && mode==='preview-take' && <span style={{ color:'#22d3ee' }}>○ EN PREVIEW</span>}
      {!inProg && !inPreview && <span style={{ color:'#475569' }}>─ OCULTO</span>}
    </div>
  )
}

// ─── Auto Tab ────────────────────────────────────────────────────────────────
function AutoTab({ autoEnabled, toggleAutomation, rules, events }: { autoEnabled:boolean, toggleAutomation:()=>void, rules:any[], events:any[] }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:14 }}>
      <section style={panel()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <Title t="Reglas del torneo"/>
          <button onClick={toggleAutomation} style={btn(autoEnabled?'success':'outline')}>
            {autoEnabled ? '● AUTO ACTIVA' : 'ACTIVAR AUTO'}
          </button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {rules.map(r => (
            <div key={r.id} style={{ padding:'10px 12px', border:'1px solid #1a2236', borderRadius:10, background:'#0a1020' }}>
              <div style={{ fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', opacity:.7, fontWeight:800, color:'#7dd3fc' }}>{r.trigger_type}</div>
              <div style={{ fontSize:13, fontWeight:700 }}>{r.name}</div>
              <div style={{ fontSize:10, opacity:.55, marginTop:4 }}>
                {r.actions.map((a:any,i:number) => <span key={i}>{a.type}:{a.graphic}{a.delay_ms?`+${a.delay_ms}ms`:''}  </span>)}
              </div>
            </div>
          ))}
          {rules.length===0 && <div style={{ opacity:.55, fontSize:13 }}>No hay reglas. Ejecuta <code>seed_default_stream_rules(tournament_id)</code>.</div>}
        </div>
      </section>

      <section style={panel()}>
        <Title t="Registro de eventos"/>
        <div style={{ maxHeight:480, overflowY:'auto', fontFamily:"'JetBrains Mono',monospace", fontSize:11 }}>
          {events.map(e => (
            <div key={e.id} style={{ display:'grid', gridTemplateColumns:'100px 120px 1fr', gap:10, padding:'3px 0', borderBottom:'1px solid #0f1529' }}>
              <span style={{ opacity:.5 }}>{new Date(e.created_at).toLocaleTimeString('es-ES')}</span>
              <span style={{ color: e.kind==='error'?'#f87171':e.kind.startsWith('auto')?'#a78bfa':'#34d399' }}>{e.kind}</span>
              <span style={{ opacity:.85 }}>{e.graphic ?? ''} {JSON.stringify(e.payload ?? {})}</span>
            </div>
          ))}
          {events.length===0 && <div style={{ opacity:.4 }}>Sin eventos</div>}
        </div>
      </section>
    </div>
  )
}

// ─── Style helpers ──────────────────────────────────────────────────────────
function panel(): React.CSSProperties { return { background:'#0a101e', border:'1px solid #141a2a', borderRadius:14, padding:14 } }
function Title({ t }:{t:string}) { return <div style={{ fontSize:11, letterSpacing:'.3em', textTransform:'uppercase', fontWeight:800, color:'#8ea2c6', marginBottom:10 }}>{t}</div> }
function btn(v:'outline'|'success'|'danger'|'primary'='outline'): React.CSSProperties {
  const base: React.CSSProperties = { padding:'8px 14px', borderRadius:10, fontSize:12, fontWeight:900, letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer', border:'1px solid transparent', transition:'all .15s' }
  if (v==='outline') return { ...base, background:'#0a101e', border:'1px solid #243250', color:'#cfd9ea' }
  if (v==='success') return { ...base, background:'#14532d', color:'#bbf7d0', border:'1px solid #166534' }
  if (v==='danger')  return { ...base, background:'#7f1d1d', color:'#fecaca', border:'1px solid #991b1b' }
  return { ...base, background:'#ef6a4c', color:'#fff' }
}
function bigBtn(bg: string, disabled: boolean): React.CSSProperties {
  return {
    padding:'16px 40px', borderRadius:12, fontSize:20, fontWeight:900, letterSpacing:'.18em', textTransform:'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer', border:'none',
    background: disabled ? '#1a2236' : bg,
    color: disabled ? '#475569' : '#fff',
    boxShadow: disabled ? 'none' : `0 6px 18px ${bg}55`,
    transition:'transform .1s ease',
  }
}
function chip(active:boolean, color:string): React.CSSProperties {
  return { padding:'6px 12px', borderRadius:999, border:'1px solid '+(active?color:'#243250'), background: active?color:'#0a101e', color: active?'#0b0f1c':'#cbd5e1', fontSize:11, fontWeight:900, letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer' }
}
function graphicBtn(inProg:boolean, inPreview:boolean, accent:string): React.CSSProperties {
  return {
    textAlign:'left', padding:'10px 12px', borderRadius:12,
    background: inProg ? 'rgba(239,68,68,.1)' : inPreview ? 'rgba(34,211,238,.1)' : '#0a101e',
    border: inProg ? '1px solid rgba(239,68,68,.55)' : inPreview ? `1px solid rgba(34,211,238,.6)` : '1px solid #243250',
    color:'#e5e7eb', cursor:'pointer', transition:'all .15s',
  }
}
function labelSm(): React.CSSProperties { return { fontSize:11, letterSpacing:'.2em', textTransform:'uppercase', fontWeight:800, opacity:.65 } }
