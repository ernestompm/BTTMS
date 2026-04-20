'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Tournament, ScoreboardConfig, Sponsor } from '@/types'
import { DEFAULT_SCOREBOARD_CONFIG } from '@/types'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

const SKINS = [
  { id: 'marbella', label: 'Marbella', desc: 'Azul marino mediterráneo', preview: 'linear-gradient(135deg,#1d3a5f 0%,#0a1627 100%)' },
  { id: 'noche',    label: 'Noche',    desc: 'Oscuro elegante',           preview: 'linear-gradient(135deg,#122a4a 0%,#04070e 100%)' },
  { id: 'arena',    label: 'Arena',    desc: 'Claro veraniego',           preview: 'linear-gradient(135deg,#f3e4c7 0%,#d9bf8a 100%)' },
]

const TIER_LABELS: Record<string, string> = {
  title: 'Title Sponsor', gold: 'Gold', silver: 'Silver',
  partner: 'Partner', media: 'Media Partner', '': 'Sin categoría',
}

const ROUND_LABELS: Record<string, string> = {
  F: 'Final', SF: 'Semifinal', QF: 'Cuartos', R16: 'Octavos', R32: 'Dieciseisavos',
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors focus:outline-none ${checked ? 'bg-brand-red' : 'bg-gray-600'}`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )
}

export default function ScoreboardConfigPage() {
  const supabase = createClient()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeMatches, setActiveMatches] = useState<any[]>([])
  const [courts, setCourts] = useState<any[]>([])

  // New sponsor form
  const [newName, setNewName] = useState('')
  const [newTier, setNewTier] = useState('')
  const [newLogoUrl, setNewLogoUrl] = useState('')
  const [logoMode, setLogoMode] = useState<'url' | 'upload'>('url')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Tournament logo
  const [tournamentLogoMode, setTournamentLogoMode] = useState<'url' | 'upload'>('url')
  const [uploadingTournamentLogo, setUploadingTournamentLogo] = useState(false)
  const [tournamentLogoError, setTournamentLogoError] = useState('')
  const tournamentLogoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('tournaments').select('*').eq('id', TOURNAMENT_ID).single(),
      supabase.from('courts').select('id,name,current_match_id').eq('tournament_id', TOURNAMENT_ID),
      supabase.from('matches')
        .select('id,round,match_type,status,court_id,entry1:draw_entries!entry1_id(player1:players!player1_id(last_name)),entry2:draw_entries!entry2_id(player1:players!player1_id(last_name))')
        .eq('tournament_id', TOURNAMENT_ID)
        .in('status', ['in_progress', 'warmup', 'players_on_court', 'judge_on_court'])
        .limit(10),
    ]).then(([{ data: t }, { data: c }, { data: m }]) => {
      setTournament(t)
      setCourts(c ?? [])
      setActiveMatches(m ?? [])
      setLoading(false)
    })
  }, [])

  // ---- Derived config ----
  const cfg: ScoreboardConfig & { skin?: string } = (tournament?.scoreboard_config as any) ?? DEFAULT_SCOREBOARD_CONFIG
  const sponsors: Sponsor[] = (tournament?.sponsors as Sponsor[]) ?? []
  const skin = cfg.skin ?? 'marbella'

  // ---- Config updaters ----
  function patchCfg(patch: Partial<ScoreboardConfig & { skin?: string }>) {
    setTournament(t => t ? { ...t, scoreboard_config: { ...(t.scoreboard_config ?? DEFAULT_SCOREBOARD_CONFIG), ...patch } as any } : t)
  }
  function setDisplay(key: keyof ScoreboardConfig['display'], val: boolean) {
    patchCfg({ display: { ...cfg.display, [key]: val } })
  }
  function setColors(key: keyof ScoreboardConfig['colors'], val: string) {
    patchCfg({ colors: { ...cfg.colors, [key]: val } })
  }
  function setSpCfg(key: keyof ScoreboardConfig['sponsors'], val: any) {
    patchCfg({ sponsors: { ...cfg.sponsors, [key]: val } })
  }
  function setLogos(key: keyof ScoreboardConfig['logos'], val: string) {
    patchCfg({ logos: { ...(cfg.logos ?? { tournament_logo_url: '', rfet_logo_url: '', sponsor_logos: [] }), [key]: val } })
  }

  // ---- Sponsor management ----
  function addSponsor() {
    const name = newName.trim()
    if (!name) return
    const sp: Sponsor = { name, tier: newTier, logo_url: newLogoUrl.trim(), display_order: sponsors.length }
    setTournament(t => t ? { ...t, sponsors: [...(t.sponsors as Sponsor[] ?? []), sp] as any } : t)
    setNewName(''); setNewTier(''); setNewLogoUrl(''); setUploadError('')
  }
  function removeSponsor(idx: number) {
    setTournament(t => t ? { ...t, sponsors: (t.sponsors as Sponsor[]).filter((_, i) => i !== idx) as any } : t)
  }
  function moveSponsor(idx: number, dir: -1 | 1) {
    const arr = [...sponsors]; const ni = idx + dir
    if (ni < 0 || ni >= arr.length) return
    ;[arr[idx], arr[ni]] = [arr[ni], arr[idx]]
    setTournament(t => t ? { ...t, sponsors: arr as any } : t)
  }

  // ---- Tournament logo upload ----
  async function uploadTournamentLogo(file: File) {
    setUploadingTournamentLogo(true); setTournamentLogoError('')
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const path = `tournament/${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('sponsor-logos').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: ud } = supabase.storage.from('sponsor-logos').getPublicUrl(data.path)
      setLogos('tournament_logo_url', ud.publicUrl)
    } catch {
      setTournamentLogoError('Error al subir. Verifica el bucket "sponsor-logos" en Supabase Storage.')
    } finally {
      setUploadingTournamentLogo(false)
    }
  }

  // ---- Sponsor logo upload ----
  async function uploadLogo(file: File) {
    setUploading(true); setUploadError('')
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const path = `logos/${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('sponsor-logos').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: ud } = supabase.storage.from('sponsor-logos').getPublicUrl(data.path)
      setNewLogoUrl(ud.publicUrl)
    } catch {
      setUploadError('Error al subir. Crea el bucket "sponsor-logos" en Supabase Storage (acceso público) e inténtalo de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  // ---- Save ----
  async function handleSave() {
    if (!tournament) return
    setSaving(true)
    await supabase.from('tournaments').update({
      sponsors: tournament.sponsors,
      scoreboard_config: tournament.scoreboard_config,
    }).eq('id', TOURNAMENT_ID)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="text-gray-400 fade-in">Cargando configuración...</div>
  if (!tournament) return <div className="text-red-400">Torneo no encontrado. Ejecuta el seed SQL primero.</div>

  // Map courts → match for quick-links
  const courtMatches = courts.map(c => ({
    ...c,
    match: activeMatches.find(m => m.court_id === c.id || m.id === c.current_match_id) ?? null,
  }))

  return (
    <div className="space-y-6 fade-in pb-12">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white font-score">Marcador Venue</h1>
          <p className="text-gray-400 text-sm mt-0.5">Apariencia y contenido del marcador LED de pista</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-green-400 text-sm font-medium">✓ Guardado</span>}
          <button onClick={handleSave} disabled={saving}
            className="bg-brand-red hover:bg-red-600 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* ── Acceso rápido ────────────────────────────────────── */}
      {(courts.length > 0 || activeMatches.length > 0) && (
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-white font-semibold mb-4">Acceso rápido a marcadores</h2>

          {/* Pistas con partido activo */}
          {courtMatches.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {courtMatches.map(c => {
                const m = c.match
                const p1 = m?.entry1?.player1?.last_name ?? '–'
                const p2 = m?.entry2?.player1?.last_name ?? '–'
                const round = m ? (ROUND_LABELS[m.round ?? ''] ?? m.round ?? '') : ''
                return (
                  <div key={c.id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between gap-3 border border-gray-700">
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm">{c.name}</p>
                      {m ? (
                        <p className="text-gray-400 text-xs mt-0.5 truncate">{round} · {p1} vs {p2}</p>
                      ) : (
                        <p className="text-gray-600 text-xs mt-0.5">Sin partido activo</p>
                      )}
                    </div>
                    {m ? (
                      <a href={`/scoreboard/${m.id}`} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 bg-brand-red/20 hover:bg-brand-red/30 border border-brand-red/40 text-brand-red text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                        Abrir →
                      </a>
                    ) : (
                      <span className="text-gray-700 text-lg">—</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Partidos activos sin pista asignada */}
          {activeMatches.filter(m => !courtMatches.some(c => c.match?.id === m.id)).length > 0 && (
            <div>
              <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider">Otros partidos activos</p>
              <div className="flex flex-wrap gap-2">
                {activeMatches.filter(m => !courtMatches.some(c => c.match?.id === m.id)).map(m => (
                  <a key={m.id} href={`/scoreboard/${m.id}`} target="_blank" rel="noopener noreferrer"
                    className="bg-gray-800 border border-gray-700 hover:border-brand-red/50 text-gray-300 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                    {m.entry1?.player1?.last_name ?? '?'} / {m.entry2?.player1?.last_name ?? '?'} →
                  </a>
                ))}
              </div>
            </div>
          )}

          {courts.length === 0 && activeMatches.length === 0 && (
            <p className="text-gray-600 text-sm">No hay pistas ni partidos activos en este momento.</p>
          )}
        </div>
      )}

      {/* ── Apariencia ───────────────────────────────────────── */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-6">
        <h2 className="text-white font-semibold">Apariencia</h2>

        {/* Skin */}
        <div>
          <label className="block text-sm text-gray-400 mb-3">Skin del marcador</label>
          <div className="grid grid-cols-3 gap-3">
            {SKINS.map(s => (
              <button key={s.id} onClick={() => patchCfg({ skin: s.id })}
                className={`relative rounded-xl overflow-hidden border-2 text-left transition-all ${
                  skin === s.id ? 'border-brand-red' : 'border-gray-700 hover:border-gray-600'
                }`}>
                <div style={{ background: s.preview, height: 68 }} />
                <div className="bg-gray-800 px-3 py-2.5">
                  <p className={`text-sm font-bold ${skin === s.id ? 'text-brand-red' : 'text-white'}`}>{s.label}</p>
                  <p className="text-gray-500 text-xs leading-tight">{s.desc}</p>
                </div>
                {skin === s.id && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-red flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 5l3.5 4L11 1" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Accent colors */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm text-gray-400">Colores de acento</label>
            <button
              onClick={() => {
                setColors('team1_accent', '#f31948')
                setColors('team2_accent', '#ef6a4c')
                setColors('serving_indicator', '#fc6f43')
              }}
              className="text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1 rounded-lg transition-colors">
              ↺ Restaurar originales
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {([
              { key: 'team1_accent',      label: 'Acento equipo 1',     default: '#f31948' },
              { key: 'team2_accent',      label: 'Acento equipo 2',     default: '#ef6a4c' },
              { key: 'serving_indicator', label: 'Indicador de saque',  default: '#fc6f43' },
            ] as const).map(({ key, label, default: def }) => {
              const val = (cfg.colors as any)?.[key] ?? def
              return (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-2">{label}</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={val} onChange={e => setColors(key as any, e.target.value)}
                      className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent p-0 flex-shrink-0" />
                    <div>
                      <p className="text-white text-sm font-mono">{val}</p>
                      <div className="w-24 h-1.5 rounded-full mt-1" style={{ background: val }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tournament logo */}
        <div>
          <label className="block text-sm text-gray-400 mb-3">Logo del torneo</label>
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {cfg.logos?.tournament_logo_url
                ? <img src={cfg.logos.tournament_logo_url} alt="Logo torneo" className="w-full h-full object-contain p-1" />
                : <span className="text-gray-600 text-xs text-center leading-tight px-2">Sin logo</span>
              }
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs w-fit">
                <button onClick={() => setTournamentLogoMode('url')}
                  className={`px-3 py-1.5 transition-colors ${tournamentLogoMode === 'url' ? 'bg-brand-red text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  URL
                </button>
                <button onClick={() => setTournamentLogoMode('upload')}
                  className={`px-3 py-1.5 transition-colors ${tournamentLogoMode === 'upload' ? 'bg-brand-red text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  Subir archivo
                </button>
              </div>
              {tournamentLogoMode === 'url' ? (
                <input
                  value={cfg.logos?.tournament_logo_url ?? ''}
                  onChange={e => setLogos('tournament_logo_url', e.target.value)}
                  placeholder="https://ejemplo.com/logo-torneo.png"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red"
                />
              ) : (
                <div className="flex items-center gap-3">
                  <input ref={tournamentLogoRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadTournamentLogo(f) }} />
                  <button onClick={() => tournamentLogoRef.current?.click()} disabled={uploadingTournamentLogo}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
                    {uploadingTournamentLogo ? <><span className="animate-spin">⟳</span> Subiendo...</> : <>📁 Seleccionar imagen</>}
                  </button>
                  {tournamentLogoError && <p className="text-red-400 text-xs">{tournamentLogoError}</p>}
                </div>
              )}
              {cfg.logos?.tournament_logo_url && (
                <button onClick={() => setLogos('tournament_logo_url', '')} className="text-xs text-red-400/70 hover:text-red-400 transition-colors">
                  Eliminar logo
                </button>
              )}
              <p className="text-gray-600 text-xs">PNG con fondo transparente recomendado. Se muestra en la esquina superior del marcador.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Visibilidad ──────────────────────────────────────── */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
        <h2 className="text-white font-semibold">Elementos visibles en pantalla</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { key: 'show_flags',           label: 'Banderas de nacionalidad',  desc: 'Bandera junto al nombre del jugador' },
            { key: 'show_rankings',        label: 'Número de cabeza de serie', desc: 'Seed a la izquierda de cada equipo' },
            { key: 'show_serve_indicator', label: 'Indicador de saque',        desc: 'Punto animado junto al sacador' },
            { key: 'show_round',           label: 'Ronda del partido',         desc: 'Cuartos, Semifinal, Final...' },
            { key: 'show_court_name',      label: 'Nombre de la pista',        desc: 'Pista Central, Pista 1...' },
          ] as const).map(({ key, label, desc }) => {
            const val = cfg.display?.[key] !== false
            return (
              <label key={key}
                className="flex items-center gap-3 bg-gray-800 hover:bg-gray-800/80 rounded-xl px-4 py-3.5 cursor-pointer transition-colors border border-gray-700">
                <Toggle checked={val} onChange={v => setDisplay(key, v)} />
                <div>
                  <p className="text-white text-sm font-medium">{label}</p>
                  <p className="text-gray-500 text-xs">{desc}</p>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      {/* ── Patrocinadores ───────────────────────────────────── */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-6">
        {/* Header + global toggle */}
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-white font-semibold">Patrocinadores</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <Toggle checked={cfg.sponsors?.enabled !== false} onChange={v => setSpCfg('enabled', v)} />
            <span className="text-sm text-gray-300">Mostrar franja</span>
          </label>
        </div>

        {/* Speed */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Velocidad del carrusel</label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-12">Rápido</span>
            <input type="range" min={5} max={60} step={1}
              value={cfg.sponsors?.rotation_interval_seconds ?? 10}
              onChange={e => setSpCfg('rotation_interval_seconds', Number(e.target.value))}
              className="flex-1 accent-brand-red h-1.5 cursor-pointer" />
            <span className="text-xs text-gray-500 w-12 text-right">Lento</span>
            <span className="text-gray-300 text-sm w-16 text-right font-mono">
              {cfg.sponsors?.rotation_interval_seconds ?? 10}s
            </span>
          </div>
          <p className="text-gray-600 text-xs mt-1">Duración por vuelta completa del carrusel</p>
        </div>

        {/* Sponsor list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm text-gray-400">Patrocinadores ({sponsors.length})</label>
            {sponsors.length > 1 && <span className="text-xs text-gray-600">Usa ↑↓ para reordenar</span>}
          </div>

          {sponsors.length === 0 ? (
            <div className="bg-gray-800 rounded-xl px-4 py-6 text-center border border-dashed border-gray-700">
              <p className="text-gray-500 text-sm">No hay patrocinadores añadidos.</p>
              <p className="text-gray-600 text-xs mt-1">Usa el formulario de abajo para añadir el primero.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sponsors.map((sp, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3 border border-gray-700">
                  {/* Logo preview */}
                  <div className="w-14 h-10 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {sp.logo_url ? (
                      <img src={sp.logo_url} alt={sp.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="text-gray-500 text-xs font-bold">IMG</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{sp.name}</p>
                    <p className="text-gray-500 text-xs">{TIER_LABELS[sp.tier] ?? (sp.tier || 'Sin categoría')}</p>
                  </div>
                  {/* Controls */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={() => moveSponsor(i, -1)} disabled={i === 0}
                      className="text-gray-500 hover:text-white px-2 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed text-sm transition-colors">↑</button>
                    <button onClick={() => moveSponsor(i, 1)} disabled={i === sponsors.length - 1}
                      className="text-gray-500 hover:text-white px-2 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed text-sm transition-colors">↓</button>
                    <button onClick={() => removeSponsor(i)}
                      className="text-red-500/70 hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-900/20 ml-1 text-sm transition-colors">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add sponsor form */}
        <div className="border-t border-gray-800 pt-5 space-y-4">
          <p className="text-sm text-gray-400 font-medium">Añadir patrocinador</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Nombre *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSponsor()}
                placeholder="Nombre del patrocinador"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Categoría</label>
              <select value={newTier} onChange={e => setNewTier(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red">
                <option value="">Sin categoría</option>
                <option value="title">Title Sponsor</option>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="partner">Partner</option>
                <option value="media">Media Partner</option>
              </select>
            </div>
          </div>

          {/* Logo section */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <label className="text-xs text-gray-500">Logo del patrocinador</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs flex-shrink-0">
                <button onClick={() => setLogoMode('url')}
                  className={`px-3 py-1.5 transition-colors ${logoMode === 'url' ? 'bg-brand-red text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  URL
                </button>
                <button onClick={() => setLogoMode('upload')}
                  className={`px-3 py-1.5 transition-colors ${logoMode === 'upload' ? 'bg-brand-red text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  Subir archivo
                </button>
              </div>
            </div>

            {logoMode === 'url' ? (
              <div className="flex items-center gap-3">
                <input value={newLogoUrl} onChange={e => setNewLogoUrl(e.target.value)}
                  placeholder="https://ejemplo.com/logo.png"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
                {newLogoUrl && (
                  <div className="w-14 h-10 rounded-lg bg-gray-700 flex-shrink-0 overflow-hidden">
                    <img src={newLogoUrl} alt="preview" className="w-full h-full object-contain p-1"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }} />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
                    {uploading ? (
                      <><span className="animate-spin">⟳</span> Subiendo...</>
                    ) : (
                      <>📁 Seleccionar imagen</>
                    )}
                  </button>
                  {newLogoUrl && (
                    <div className="w-14 h-10 rounded-lg bg-gray-700 overflow-hidden">
                      <img src={newLogoUrl} alt="preview" className="w-full h-full object-contain p-1" />
                    </div>
                  )}
                </div>
                {uploadError && (
                  <p className="text-red-400 text-xs leading-relaxed">{uploadError}</p>
                )}
                <p className="text-gray-600 text-xs">PNG, JPG o SVG. Recomendado: fondo transparente (PNG).</p>
              </div>
            )}
          </div>

          <button onClick={addSponsor} disabled={!newName.trim()}
            className="bg-brand-red hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm">
            + Añadir patrocinador
          </button>
        </div>
      </div>

      {/* ── Save bottom ────────────────────────────────────── */}
      <div className="flex items-center gap-4 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="bg-brand-red hover:bg-red-600 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
          {saving ? 'Guardando...' : 'Guardar todos los cambios'}
        </button>
        {saved && <span className="text-green-400 text-sm font-medium">✓ Guardado correctamente</span>}
      </div>

    </div>
  )
}
