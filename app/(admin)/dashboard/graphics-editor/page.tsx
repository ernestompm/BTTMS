'use client'
// ============================================================================
// Graphics Editor — vista en vivo + sliders para tamaños
// ============================================================================
// Iframe del marcador de un partido real + panel lateral de sliders. Cada
// cambio en los sliders se guarda en tournament.scoreboard_config
// .graphics_overrides y el iframe se recarga para mostrarlo al instante.
//
// Esto rompe el bucle de "te explico el problema -> me lees mal -> redibujo".
// El director ajusta directamente y ve el resultado.
//
// MVP: solo cubre el marcador de pista (pre-match) — name_fs, vs_fs, padding.
// Es la pieza más quejada hasta ahora. Añadir más knobs es trivial: extender
// la sección "Slider rows" abajo con más entradas y exponerlas en el
// componente correspondiente con el mismo patrón (cfg.graphics_overrides...).
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Tournament } from '@/types'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

interface MatchOption {
  id: string
  status: string
  round: string | null
  category: string
  match_type: string
  entry1?: any
  entry2?: any
}

const DEFAULTS = {
  venue_pre_match: {
    name_fs_singles: 156,
    name_fs_doubles: 110,
    vs_fs: 300,
    card_padding: 48,
  },
}

export default function GraphicsEditorPage() {
  const supabase = createClient()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<MatchOption[]>([])
  const [matchId, setMatchId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(0)

  useEffect(() => {
    async function load() {
      const [t, m] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', TOURNAMENT_ID).single(),
        supabase.from('matches')
          .select('id, status, round, category, match_type, scheduled_at, entry1:draw_entries!entry1_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name)), entry2:draw_entries!entry2_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name))')
          .eq('tournament_id', TOURNAMENT_ID)
          .order('scheduled_at', { nullsFirst: false }).limit(50),
      ])
      setTournament(t.data as any)
      setMatches((m.data as any) ?? [])
      // Pick a "good" preview default: prefer scheduled match (pre-match
      // shows the layout we're tuning); else first available
      const scheduled = (m.data as any)?.find((x: any) => x.status === 'scheduled')
      if (scheduled) setMatchId(scheduled.id)
      else if (m.data?.[0]) setMatchId((m.data as any)[0].id)
    }
    load()
  }, [])

  const cfg = tournament?.scoreboard_config as any
  const ov = cfg?.graphics_overrides?.venue_pre_match ?? {}

  function getVal(key: keyof typeof DEFAULTS.venue_pre_match): number {
    return ov[key] ?? DEFAULTS.venue_pre_match[key]
  }

  async function setVal(key: keyof typeof DEFAULTS.venue_pre_match, value: number) {
    if (!tournament) return
    const newCfg = {
      ...cfg,
      graphics_overrides: {
        ...(cfg?.graphics_overrides ?? {}),
        venue_pre_match: {
          ...(cfg?.graphics_overrides?.venue_pre_match ?? {}),
          [key]: value,
        },
      },
    }
    setTournament({ ...tournament, scoreboard_config: newCfg } as any)
    setSaving(true)
    await supabase.from('tournaments').update({ scoreboard_config: newCfg }).eq('id', TOURNAMENT_ID)
    setSaving(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 800)
    // Recarga el iframe para que aplique el nuevo valor (el SSR de
    // /scoreboard lee tournament.scoreboard_config en cada render)
    setIframeKey(k => k + 1)
  }

  async function resetSection() {
    if (!tournament || !confirm('Quitar TODOS los ajustes manuales y volver a los valores por defecto?')) return
    const newCfg = { ...cfg, graphics_overrides: { ...(cfg?.graphics_overrides ?? {}), venue_pre_match: undefined } }
    setTournament({ ...tournament, scoreboard_config: newCfg } as any)
    await supabase.from('tournaments').update({ scoreboard_config: newCfg }).eq('id', TOURNAMENT_ID)
    setIframeKey(k => k + 1)
  }

  function matchLabel(m: MatchOption): string {
    const t1 = m.entry1?.player1?.last_name ?? '?'
    const t2 = m.entry2?.player1?.last_name ?? '?'
    return `${t1} vs ${t2} · ${m.round ?? ''} · ${m.status}`
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white font-score">Editor de gráficos</h1>
          <p className="text-gray-400 text-sm">Ajusta tamaños y aplícalos en vivo. Los valores se guardan automáticamente.</p>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="text-yellow-300 text-xs">Guardando…</span>}
          {savedFlash && <span className="text-green-400 text-xs">✓ Guardado</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">

        {/* Live preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <label className="text-sm text-gray-400">
              Vista en vivo:
              <select
                value={matchId}
                onChange={(e) => { setMatchId(e.target.value); setIframeKey(k => k + 1) }}
                className="ml-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-brand-red max-w-md"
              >
                <option value="">— Selecciona un partido —</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>{matchLabel(m)}</option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button onClick={() => setIframeKey(k => k + 1)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg text-xs">
                ↻ Refrescar
              </button>
              {matchId && (
                <Link href={`/scoreboard/${matchId}`} target="_blank"
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg text-xs">
                  Abrir en pestaña nueva ↗
                </Link>
              )}
            </div>
          </div>

          {/* Iframe — 16:9 con padding-bottom trick */}
          {matchId ? (
            <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#000', borderRadius: 12, overflow: 'hidden', border: '1px solid #1f2937' }}>
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={`/scoreboard/${matchId}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              />
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-500">
              Selecciona un partido para ver la vista previa en vivo
            </div>
          )}

          <p className="text-gray-500 text-xs">
            💡 Para tunear el <strong className="text-gray-300">pre-match</strong> elige un partido en estado <code className="text-gray-300 bg-gray-800 rounded px-1">scheduled</code>.
            Para tunear el <strong className="text-gray-300">marcador en juego</strong>, uno <code className="text-gray-300 bg-gray-800 rounded px-1">in_progress</code>.
            Para el <strong className="text-gray-300">finalizado</strong>, uno <code className="text-gray-300 bg-gray-800 rounded px-1">finished</code>.
          </p>
        </div>

        {/* Slider panel */}
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Pre-match (PRÓXIMO PARTIDO)</h3>
              <button onClick={resetSection}
                className="text-gray-500 hover:text-red-400 text-xs underline">
                Reset
              </button>
            </div>

            <SliderRow
              label="Nombre · individuales"
              value={getVal('name_fs_singles')}
              defaultValue={DEFAULTS.venue_pre_match.name_fs_singles}
              min={60} max={220} step={2}
              unit="px"
              onChange={(v) => setVal('name_fs_singles', v)}
            />
            <SliderRow
              label="Nombre · dobles"
              value={getVal('name_fs_doubles')}
              defaultValue={DEFAULTS.venue_pre_match.name_fs_doubles}
              min={60} max={180} step={2}
              unit="px"
              onChange={(v) => setVal('name_fs_doubles', v)}
            />
            <SliderRow
              label="Tamaño VS centro"
              value={getVal('vs_fs')}
              defaultValue={DEFAULTS.venue_pre_match.vs_fs}
              min={120} max={420} step={4}
              unit="px"
              onChange={(v) => setVal('vs_fs', v)}
            />
            <SliderRow
              label="Padding vertical card"
              value={getVal('card_padding')}
              defaultValue={DEFAULTS.venue_pre_match.card_padding}
              min={20} max={120} step={2}
              unit="px"
              onChange={(v) => setVal('card_padding', v)}
            />
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-2">
            <h3 className="text-white font-semibold text-sm">Próximamente</h3>
            <p className="text-gray-500 text-xs">
              Más secciones (marcador en juego, finalizado, gráficos del overlay vMix) llegarán siguiendo el mismo patrón. Si quieres priorizar alguna, dímelo y la añado.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}

function SliderRow({ label, value, defaultValue, min, max, step, unit, onChange }: {
  label: string, value: number, defaultValue: number, min: number, max: number, step: number, unit: string,
  onChange: (v: number) => void,
}) {
  const isModified = value !== defaultValue
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-gray-400">{label}</label>
        <div className="flex items-center gap-2">
          {isModified && <span className="text-yellow-400 text-[10px]">●</span>}
          <span className={`text-xs font-mono ${isModified ? 'text-yellow-300' : 'text-gray-500'}`}>
            {value}{unit}
          </span>
          <span className="text-gray-600 text-[10px]">/ {defaultValue}{unit}</span>
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-red h-1.5 cursor-pointer"
      />
    </div>
  )
}
