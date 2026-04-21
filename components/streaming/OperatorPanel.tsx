'use client'
// ============================================================================
// OperatorPanel — manual graphics control + automation engine
// ============================================================================
// - Buttons for every graphic (show/hide) with hotkeys
// - Data selectors (Player Bio target, Stats scope, Results category)
// - Automation toggle + rule list with last-trigger feedback
// - Live preview iframe of /overlay/<matchId>
// - Copy-to-clipboard of the overlay URL for vMix
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { GRAPHICS, GRAPHIC_ORDER, GROUP_LABELS } from '@/lib/streaming/catalog'
import type { GraphicKey, GraphicsMap } from '@/types/streaming'
import { AutomationRunner } from '@/lib/streaming/automation'
import { showGraphic, hideGraphic, hideAll, logEvent } from '@/lib/streaming/commands'

interface Props {
  session: { id:string, match_id:string, tournament_id:string, active:boolean, automation_enabled:boolean }
  initialMatch: any
  tournament: any
  rules: any[]
  recentMatches: any[]
}

export function OperatorPanel({ session, initialMatch, tournament, rules, recentMatches }: Props) {
  const supabase = createClient()
  const [match, setMatch] = useState<any>(initialMatch)
  const [state, setState] = useState<GraphicsMap>({})
  const [autoEnabled, setAutoEnabled] = useState(session.automation_enabled)
  const [events, setEvents] = useState<any[]>([])
  const [bioTarget, setBioTarget] = useState<{ player_id:string, team:1|2 } | null>(null)
  const [statsScope, setStatsScope] = useState<'auto'|'set_1'|'set_2'|'set_3'|'match'>('auto')
  const [showSponsor, setShowSponsor] = useState(true)
  const [copyState, setCopyState] = useState<'idle'|'copied'>('idle')
  const runner = useRef<AutomationRunner | null>(null)

  // Overlay URL (for vMix)
  const overlayUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/overlay/${session.match_id}`
  }, [session.match_id])

  // Subscribe to state + match updates
  useEffect(() => {
    const chState = supabase.channel(`op-state-${session.id}`)
      .on('postgres_changes',
        { event: '*', schema:'public', table:'stream_state', filter:`session_id=eq.${session.id}` },
        (p) => setState(((p.new as any)?.graphics ?? {}) as GraphicsMap))
      .subscribe()
    supabase.from('stream_state').select('graphics').eq('session_id', session.id).single()
      .then(({ data }) => { if (data?.graphics) setState(data.graphics as any) })

    const chMatch = supabase.channel(`op-match-${session.match_id}`)
      .on('postgres_changes',
        { event:'UPDATE', schema:'public', table:'matches', filter:`id=eq.${session.match_id}` },
        (p) => setMatch((m:any) => ({ ...m, ...(p.new as any) })))
      .subscribe()

    const chEvt = supabase.channel(`op-evt-${session.id}`)
      .on('postgres_changes',
        { event:'INSERT', schema:'public', table:'stream_events', filter:`session_id=eq.${session.id}` },
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

  // Keyboard hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') { void hideAll(session.id); return }
      for (const k of GRAPHIC_ORDER) {
        const m = GRAPHICS[k]
        if (!m.hotkey) continue
        if (e.key.toUpperCase() === m.hotkey) { e.preventDefault(); toggle(k); return }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session.id, state, bioTarget, statsScope])

  const visible = (k: GraphicKey) => !!state[k]?.visible

  async function toggle(k: GraphicKey) {
    const data = resolveData(k)
    if (visible(k)) { await hideGraphic(session.id, k); logEvent(session.id, 'manual_hide', k) }
    else { await showGraphic(session.id, k, { data }); logEvent(session.id, 'manual_show', k, { data }) }
  }
  async function show(k: GraphicKey)  { const data = resolveData(k); await showGraphic(session.id, k, { data }); logEvent(session.id, 'manual_show', k, { data }) }
  async function hide(k: GraphicKey)  { await hideGraphic(session.id, k); logEvent(session.id, 'manual_hide', k) }

  function resolveData(k: GraphicKey) {
    if (k === 'player_bio')     return bioTarget
    if (k === 'stats_panel')    return { scope: statsScope }
    if (k === 'results_grid')   return { category: match.category }
    if (k === 'bracket')        return { category: match.category }
    if (k === 'big_scoreboard') return { show_sponsor: showSponsor }
    return undefined
  }

  async function toggleAutomation() {
    const next = !autoEnabled
    setAutoEnabled(next)
    await supabase.from('stream_sessions').update({ automation_enabled: next }).eq('id', session.id)
  }

  async function copyUrl() {
    try { await navigator.clipboard.writeText(overlayUrl); setCopyState('copied'); setTimeout(()=>setCopyState('idle'),1500) } catch {}
  }

  // Players list (for bio picker)
  const players = [
    { team:1 as const, p: match.entry1?.player1 },
    { team:1 as const, p: match.entry1?.player2 },
    { team:2 as const, p: match.entry2?.player1 },
    { team:2 as const, p: match.entry2?.player2 },
  ].filter(x => x.p)

  const grouped = GRAPHIC_ORDER.reduce<Record<string, GraphicKey[]>>((acc, k) => {
    const g = GRAPHICS[k].group; (acc[g] ??= []).push(k); return acc
  }, {})

  return (
    <div style={{ minHeight:'100vh', background:'#05080f', color:'#fff', fontFamily:'Barlow, system-ui, sans-serif' }}>
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 28px', borderBottom:'1px solid #141a2a', background:'#070b16' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:900, letterSpacing:'.05em' }}>STREAMING · OPERADOR</div>
          <div style={{ fontSize:13, opacity:.6 }}>{tournament?.name} · {match.round} · {match.category}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={copyUrl} style={btn('outline')}>{copyState==='copied' ? '✓ Copiada' : 'Copiar URL vMix'}</button>
          <a href={overlayUrl} target="_blank" rel="noreferrer" style={{ ...btn('outline'), textDecoration:'none' }}>Abrir overlay ↗</a>
          <button onClick={() => hideAll(session.id)} style={btn('danger')}>STOP · OCULTAR TODO <span style={{opacity:.6, marginLeft:8, fontSize:11}}>ESC</span></button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.15fr 1fr', gap:20, padding:20 }}>
        {/* LEFT — control */}
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

          {/* Selectors */}
          <section style={panel()}>
            <Title t="Selectores de contenido"/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div>
                <div style={labelSm()}>Jugador para BIO</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
                  {players.map(({team,p}) => (
                    <button key={p.id} onClick={() => setBioTarget({ player_id: p.id, team })}
                      style={chip(bioTarget?.player_id===p.id, team===1?'#ef6a4c':'#af005f')}>
                      {p.last_name?.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={labelSm()}>Alcance estadísticas</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
                  {(['auto','set_1','set_2','set_3','match'] as const).map(s => (
                    <button key={s} onClick={() => setStatsScope(s)} style={chip(statsScope===s, '#22d3ee')}>{s.toUpperCase()}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:10 }}>
              <div style={labelSm()}>Marcador grande</div>
              <button onClick={() => setShowSponsor(v => !v)} style={chip(showSponsor, '#a855f7')}>
                {showSponsor ? '✓ Mostrar patrocinador' : '○ Sin patrocinador'}
              </button>
            </div>
          </section>

          {/* Graphics grid */}
          {Object.entries(grouped).map(([group, keys]) => (
            <section key={group} style={panel()}>
              <Title t={GROUP_LABELS[group as keyof typeof GROUP_LABELS]}/>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:10 }}>
                {keys.map(k => {
                  const meta = GRAPHICS[k]
                  const on = visible(k)
                  return (
                    <button key={k} onClick={() => toggle(k)} style={graphicBtn(on)}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', fontSize:14 }}>{meta.label}</span>
                        <span style={{ fontSize:11, opacity:.6 }}>{meta.hotkey ? `[${meta.hotkey}]` : ''}</span>
                      </div>
                      <div style={{ fontSize:11, opacity:.6, marginTop:4 }}>{meta.description}</div>
                      <div style={{ marginTop:8, fontSize:11, letterSpacing:'.24em', fontWeight:900,
                        color: on ? '#22c55e' : '#64748b' }}>
                        {on ? '● EN EMISIÓN' : 'OCULTO'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}

          {/* Automation */}
          <section style={panel()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontSize:14, letterSpacing:'.28em', textTransform:'uppercase', fontWeight:800, color:'#8ea2c6' }}>Automatización por estado</div>
              <button onClick={toggleAutomation} style={btn(autoEnabled?'success':'outline')}>
                {autoEnabled ? '● AUTO ACTIVA' : 'ACTIVAR AUTO'}
              </button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {rules.map(r => (
                <div key={r.id} style={{ padding:'10px 12px', border:'1px solid #1a2236', borderRadius:10, background:'#0a1020' }}>
                  <div style={{ fontSize:12, letterSpacing:'.18em', textTransform:'uppercase', opacity:.7, fontWeight:800, color:'#7dd3fc' }}>{r.trigger_type}</div>
                  <div style={{ fontSize:14, fontWeight:700 }}>{r.name}</div>
                  <div style={{ fontSize:11, opacity:.55, marginTop:4 }}>
                    {r.actions.map((a:any,i:number) => <span key={i}>{a.type}:{a.graphic}{a.delay_ms?`+${a.delay_ms}ms`:''}  </span>)}
                  </div>
                </div>
              ))}
              {rules.length===0 && <div style={{ opacity:.55, fontSize:13 }}>No hay reglas. Ejecuta <code>seed_default_stream_rules(tournament_id)</code>.</div>}
            </div>
          </section>

          {/* Event log */}
          <section style={panel()}>
            <Title t="Registro de eventos"/>
            <div style={{ maxHeight:220, overflowY:'auto', fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>
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

        {/* RIGHT — preview */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <section style={{ ...panel(), padding:0, overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid #141a2a', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:12, letterSpacing:'.28em', textTransform:'uppercase', fontWeight:800, color:'#8ea2c6' }}>Preview overlay (alpha)</span>
              <code style={{ fontSize:11, opacity:.55 }}>{overlayUrl}</code>
            </div>
            <div style={{ position:'relative', width:'100%', aspectRatio:'16/9',
              background:'repeating-conic-gradient(#141a2a 0 25%, #0a0f1c 0 50%) 50% / 40px 40px' }}>
              <iframe src={overlayUrl} style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:0, background:'transparent' }}/>
            </div>
          </section>
          <section style={panel()}>
            <Title t="Estado del partido"/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:13 }}>
              <Row k="Estado" v={match.status}/>
              <Row k="Turno saque" v={match.serving_team ? `Eq.${match.serving_team}`:'—'}/>
              <Row k="Sorteo" v={match.toss_winner?`Eq.${match.toss_winner} · ${match.toss_choice}`:'—'}/>
              <Row k="Sets" v={`${match.score?.sets_won?.t1 ?? 0}-${match.score?.sets_won?.t2 ?? 0}`}/>
              <Row k="Juegos" v={`${match.score?.current_set?.t1 ?? 0}-${match.score?.current_set?.t2 ?? 0}`}/>
              <Row k="Punto" v={`${match.score?.current_game?.t1 ?? 0}-${match.score?.current_game?.t2 ?? 0}${match.score?.deuce?' ORO':''}`}/>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// ─── Tiny styled helpers ────────────────────────────────────────────────────
function panel(): React.CSSProperties { return { background:'#0a101e', border:'1px solid #141a2a', borderRadius:14, padding:16 } }
function Title({ t }:{t:string}) { return <div style={{ fontSize:12, letterSpacing:'.3em', textTransform:'uppercase', fontWeight:800, color:'#8ea2c6', marginBottom:10 }}>{t}</div> }

function btn(v:'outline'|'success'|'danger'|'primary'='outline'): React.CSSProperties {
  const base: React.CSSProperties = { padding:'8px 14px', borderRadius:10, fontSize:12, fontWeight:900, letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer', border:'1px solid transparent', transition:'all .15s' }
  if (v==='outline') return { ...base, background:'#0a101e', border:'1px solid #243250', color:'#cfd9ea' }
  if (v==='success') return { ...base, background:'#14532d', color:'#bbf7d0', border:'1px solid #166534' }
  if (v==='danger')  return { ...base, background:'#7f1d1d', color:'#fecaca', border:'1px solid #991b1b' }
  return { ...base, background:'#ef6a4c', color:'#fff' }
}

function chip(active:boolean, color:string): React.CSSProperties {
  return { padding:'6px 12px', borderRadius:999, border:'1px solid '+(active?color:'#243250'), background: active?color:'#0a101e', color: active?'#0b0f1c':'#cbd5e1', fontSize:11, fontWeight:900, letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer' }
}

function graphicBtn(on:boolean): React.CSSProperties {
  return { textAlign:'left', padding:'10px 12px', borderRadius:12, background: on?'#0a1f1a':'#0a101e', border:`1px solid ${on?'#166534':'#243250'}`, color:'#e5e7eb', cursor:'pointer', transition:'all .15s' }
}

function labelSm(): React.CSSProperties { return { fontSize:11, letterSpacing:'.2em', textTransform:'uppercase', fontWeight:800, opacity:.65 } }

function Row({k,v}:{k:string,v:React.ReactNode}) {
  return <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:'#0a101e', border:'1px solid #141a2a', borderRadius:8 }}><span style={{ opacity:.6 }}>{k}</span><span style={{ fontWeight:800 }}>{v}</span></div>
}
