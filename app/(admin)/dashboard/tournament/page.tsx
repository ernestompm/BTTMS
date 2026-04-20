'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Tournament, ScoreboardConfig } from '@/types'
import { DEFAULT_SCOREBOARD_CONFIG } from '@/types'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

export default function TournamentPage() {
  const supabase = createClient()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState('')
  const [showFixSql, setShowFixSql] = useState(false)

  useEffect(() => {
    supabase.from('tournaments').select('*').eq('id', TOURNAMENT_ID).single()
      .then(({ data }) => { setTournament(data); setLoading(false) })
  }, [])

  async function handleSave() {
    if (!tournament) return
    setSaving(true)
    await supabase.from('tournaments').update({
      name: tournament.name,
      venue_name: tournament.venue_name,
      venue_city: tournament.venue_city,
      venue_lat: tournament.venue_lat,
      venue_lng: tournament.venue_lng,
      start_date: tournament.start_date,
      end_date: tournament.end_date,
      status: tournament.status,
      broadcast_endpoint: tournament.broadcast_endpoint,
      broadcast_api_key: tournament.broadcast_api_key,
      scoreboard_config: tournament.scoreboard_config,
    }).eq('id', TOURNAMENT_ID)
    setSaving(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  function updateField(field: string, value: any) {
    setTournament((t) => t ? { ...t, [field]: value } : t)
  }

  function updateScoreboardColor(key: string, value: string) {
    setTournament((t) => {
      if (!t) return t
      const cfg = t.scoreboard_config ?? DEFAULT_SCOREBOARD_CONFIG
      return {
        ...t,
        scoreboard_config: { ...cfg, colors: { ...(cfg.colors ?? DEFAULT_SCOREBOARD_CONFIG.colors), [key]: value } }
      }
    })
  }

  if (loading) return <div className="text-gray-400 fade-in">Cargando...</div>
  if (!tournament) return <div className="text-red-400">Torneo no encontrado. Ejecuta el seed SQL primero.</div>

  async function handleReset() {
    if (!confirm('⚠️ Esto borrará TODOS los jugadores, cuadros, partidos y puntos. El usuario admin se conserva. ¿Continuar?')) return
    setResetting(true)
    setSeedMsg('')
    const res = await fetch('/api/admin/reset', { method: 'POST' })
    const data = await res.json()
    if (res.ok) { window.location.reload(); return }
    setResetting(false)
    setSeedMsg(`✗ ${data.error}`)
    if (data.needs_sql_fix) setShowFixSql(true)
  }

  async function handleSeed() {
    if (!confirm('Esto BORRARÁ los datos actuales y creará 32 jugadores + cuadro de octavos (16 equipos, 8 partidos). ¿Continuar?')) return
    setSeeding(true)
    setSeedMsg('')
    const res = await fetch('/api/admin/seed', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setSeedMsg(`✓ ${data.message} — recargando...`)
      setTimeout(() => window.location.reload(), 800)
      return
    }
    setSeeding(false)
    setSeedMsg(`✗ ${data.error}`)
    if (data.needs_sql_fix) setShowFixSql(true)
  }

  const cfg = tournament.scoreboard_config ?? DEFAULT_SCOREBOARD_CONFIG

  return (
    <div className="space-y-6 fade-in">
      <h1 className="text-2xl font-bold text-white font-score">Configuración del Torneo</h1>

      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
        <h2 className="text-white font-semibold">Información General</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nombre del torneo</label>
            <input value={tournament.name} onChange={(e) => updateField('name', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Venue</label>
              <input value={tournament.venue_name} onChange={(e) => updateField('venue_name', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Ciudad</label>
              <input value={tournament.venue_city} onChange={(e) => updateField('venue_city', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Latitud GPS</label>
              <input type="number" step="0.0001" value={tournament.venue_lat ?? ''}
                onChange={(e) => updateField('venue_lat', parseFloat(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Longitud GPS</label>
              <input type="number" step="0.0001" value={tournament.venue_lng ?? ''}
                onChange={(e) => updateField('venue_lng', parseFloat(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha inicio</label>
              <input type="date" value={tournament.start_date ?? ''}
                onChange={(e) => updateField('start_date', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha fin</label>
              <input type="date" value={tournament.end_date ?? ''}
                onChange={(e) => updateField('end_date', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Estado</label>
              <select value={tournament.status} onChange={(e) => updateField('status', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red">
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="finished">Finalizado</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast config */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
        <h2 className="text-white font-semibold">TV Broadcast</h2>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Endpoint de la productora</label>
          <input value={tournament.broadcast_endpoint ?? ''}
            onChange={(e) => updateField('broadcast_endpoint', e.target.value)}
            placeholder="https://productora.tv/api/score"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">API Key de la productora</label>
          <input type="password" value={tournament.broadcast_api_key ?? ''}
            onChange={(e) => updateField('broadcast_api_key', e.target.value)}
            placeholder="••••••••••••"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
        </div>
      </div>

      {/* Scoreboard colors */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
        <h2 className="text-white font-semibold">Colores del Marcador Venue</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { key: 'team1_accent', label: 'Equipo 1 (acento)' },
            { key: 'team2_accent', label: 'Equipo 2 (acento)' },
            { key: 'serving_indicator', label: 'Indicador saque' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm text-gray-400 mb-2">{label}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={(cfg.colors as any)[key] ?? '#ffffff'}
                  onChange={(e) => updateScoreboardColor(key, e.target.value)}
                  className="w-10 h-10 rounded-lg border-0 cursor-pointer" />
                <span className="text-gray-300 text-sm font-mono">{(cfg.colors as any)[key]}</span>
              </div>
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Layout del marcador</label>
          <select value={cfg.layout}
            onChange={(e) => setTournament((t) => t ? { ...t, scoreboard_config: { ...cfg, layout: e.target.value as any } } : t)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red">
            <option value="horizontal_full">Horizontal Full</option>
            <option value="vertical">Vertical</option>
            <option value="minimal">Minimal</option>
            <option value="stats_panel">Con Panel de Stats</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={handleSave} disabled={saving}
          className="bg-brand-red hover:bg-red-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {success && <span className="text-green-400 text-sm">✓ Guardado correctamente</span>}
      </div>

      {/* Test Data */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-blue-900/50 space-y-4">
        <h2 className="text-blue-300 font-semibold">🧪 Datos de prueba</h2>
        <p className="text-gray-400 text-sm">
          Genera 32 jugadores españoles, un cuadro absoluto masculino (dobles, 16 equipos) y 8 partidos de octavos listos para jugar.
          Reemplaza los datos existentes.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <button onClick={handleSeed} disabled={seeding}
            className="bg-blue-900/40 hover:bg-blue-800 border border-blue-700 disabled:opacity-50 text-blue-200 font-semibold px-6 py-2.5 rounded-xl transition-colors">
            {seeding ? 'Generando...' : '🎾 Generar octavos de dobles'}
          </button>
          {seedMsg && <span className={`text-sm ${seedMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{seedMsg}</span>}
        </div>

        {showFixSql && (
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 mt-2">
            <p className="text-yellow-200 font-semibold text-sm mb-2">⚠️ Falta una migración SQL (una sola vez)</p>
            <p className="text-gray-400 text-xs mb-3">
              Ve al <strong>SQL Editor</strong> de Supabase y ejecuta este bloque. Después, vuelve aquí y reintenta los botones.
            </p>
            <pre className="bg-gray-950 rounded-lg p-3 text-xs text-green-400 overflow-x-auto font-mono leading-relaxed whitespace-pre">{`-- Quita el trigger que fuerza net_height a un valor inválido
DROP TRIGGER IF EXISTS trg_set_match_rules ON matches;

-- Permite borrar puntos (reglas append-only bloqueaban el reset)
DROP RULE IF EXISTS no_delete_points ON points;
DROP RULE IF EXISTS no_update_points ON points;`}</pre>
            <button onClick={() => setShowFixSql(false)}
              className="mt-3 text-xs text-gray-500 hover:text-gray-300">Cerrar</button>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-red-900/50 space-y-4">
        <h2 className="text-red-400 font-semibold">⚠️ Zona de peligro (solo tests)</h2>
        <p className="text-gray-400 text-sm">Borra todos los jugadores, cuadros, partidos y puntos. El usuario administrador se conserva. Úsalo para limpiar datos de prueba.</p>
        <div className="flex items-center gap-4">
          <button onClick={handleReset} disabled={resetting}
            className="bg-red-900/50 hover:bg-red-800 border border-red-700 disabled:opacity-50 text-red-300 font-semibold px-6 py-2.5 rounded-xl transition-colors">
            {resetting ? 'Reseteando...' : '🗑 Resetear base de datos'}
          </button>
          {resetDone && <span className="text-green-400 text-sm">✓ Base de datos reseteada</span>}
        </div>
      </div>
    </div>
  )
}
