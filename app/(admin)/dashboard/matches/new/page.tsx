'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { DrawEntry, Court } from '@/types'
import { CATEGORY_LABELS } from '@/types'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

export default function NewMatchPage() {
  const router = useRouter()
  const supabase = createClient()
  const [courts, setCourts] = useState<Court[]>([])
  const [judges, setJudges] = useState<any[]>([])
  const [entries, setEntries] = useState<DrawEntry[]>([])
  const [draws, setDraws] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    category: 'absolute_m', match_type: 'doubles', round: 'QF',
    court_id: '', judge_id: '', scheduled_at: '',
    entry1_id: '', entry2_id: '',
    draw_id: '', scoring_system: 'best_of_2_sets_super_tb',
  })

  useEffect(() => {
    async function load() {
      const [courtsRes, judgesRes, entriesRes, drawsRes] = await Promise.all([
        supabase.from('courts').select('*').eq('tournament_id', TOURNAMENT_ID),
        supabase.from('app_users').select('*').eq('role', 'judge'),
        supabase.from('draw_entries').select('*, player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name)').eq('status', 'confirmed'),
        supabase.from('draws').select('id, category, match_type, structure').eq('tournament_id', TOURNAMENT_ID),
      ])
      setCourts((courtsRes.data as Court[]) ?? [])
      setJudges(judgesRes.data ?? [])
      setEntries((entriesRes.data as DrawEntry[]) ?? [])
      setDraws(drawsRes.data ?? [])
    }
    load()
  }, [])

  function onDrawChange(drawId: string) {
    const draw = draws.find((d) => d.id === drawId)
    if (!draw) {
      setForm((f) => ({ ...f, draw_id: drawId }))
      return
    }
    const scoringSystem = (draw.structure as any)?.scoring_system ?? 'best_of_2_sets_super_tb'
    setForm((f) => ({
      ...f,
      draw_id: drawId,
      category: draw.category ?? f.category,
      match_type: draw.match_type ?? f.match_type,
      scoring_system: scoringSystem,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.entry1_id && form.entry2_id && form.entry1_id === form.entry2_id) {
      setError('Los dos lados del partido no pueden ser el mismo equipo.')
      return
    }
    if (form.scheduled_at) {
      const when = new Date(form.scheduled_at)
      if (isNaN(when.getTime())) { setError('Fecha/hora programada inválida.'); return }
    }
    setLoading(true)
    const { error } = await supabase.from('matches').insert({
      tournament_id: TOURNAMENT_ID,
      draw_id: form.draw_id || null,
      category: form.category,
      match_type: form.match_type,
      round: form.round || null,
      court_id: form.court_id || null,
      judge_id: form.judge_id || null,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      entry1_id: form.entry1_id || null,
      entry2_id: form.entry2_id || null,
      scoring_system: form.scoring_system,
      status: 'scheduled',
    })
    if (error) { setError(error.message) } else { router.push('/dashboard/matches') }
    setLoading(false)
  }

  function entryName(entry: DrawEntry): string {
    const p1 = entry.player1 ? `${(entry.player1 as any).first_name} ${(entry.player1 as any).last_name}` : ''
    const p2 = entry.player2 ? ` / ${(entry.player2 as any).first_name} ${(entry.player2 as any).last_name}` : ''
    return p1 + p2
  }

  const selectClass = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red"

  return (
    <div className="space-y-6 fade-in">
      <div>
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm mb-3 flex items-center gap-1">← Volver</button>
        <h1 className="text-2xl font-bold text-white font-score">Nuevo Partido</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">

        {/* Draw selector — auto-fills category, match_type, scoring_system */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Cuadro (opcional — rellena categoría y puntuación automáticamente)</label>
          <select value={form.draw_id} onChange={(e) => onDrawChange(e.target.value)} className={selectClass}>
            <option value="">Sin asignar a cuadro</option>
            {draws.map((d) => (
              <option key={d.id} value={d.id}>
                {(CATEGORY_LABELS as Record<string, string>)[d.category] ?? d.category} · {d.match_type}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Categoría</label>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={selectClass}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tipo</label>
            <select value={form.match_type} onChange={(e) => setForm((f) => ({ ...f, match_type: e.target.value }))} className={selectClass}>
              <option value="doubles">Dobles</option>
              <option value="singles">Individual</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Sistema de puntuación</label>
          <select value={form.scoring_system} onChange={(e) => setForm((f) => ({ ...f, scoring_system: e.target.value }))} className={selectClass}>
            <option value="best_of_2_sets_super_tb">Mejor de 2 sets + Super TB (Dobles Absoluto)</option>
            <option value="best_of_3_sets_tb">Mejor de 3 sets con TB</option>
            <option value="7_games_tb">7 juegos + TB si 6-6 (Individual)</option>
            <option value="pro_set">Pro Set (1 set a 7)</option>
            <option value="short_sets">Sets cortos a 4</option>
            <option value="best_of_3_tiebreaks">Mejor de 3 tie-breaks</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Ronda</label>
            <select value={form.round} onChange={(e) => setForm((f) => ({ ...f, round: e.target.value }))} className={selectClass}>
              {['Q1','Q2','R32','R16','QF','SF','F','RR','GRP','CON'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Hora programada</label>
            <input type="datetime-local" value={form.scheduled_at}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
              className={selectClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Pista</label>
            <select value={form.court_id} onChange={(e) => setForm((f) => ({ ...f, court_id: e.target.value }))} className={selectClass}>
              <option value="">Sin asignar</option>
              {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Árbitro</label>
            <select value={form.judge_id} onChange={(e) => setForm((f) => ({ ...f, judge_id: e.target.value }))} className={selectClass}>
              <option value="">Sin asignar</option>
              {judges.map((j) => <option key={j.id} value={j.id}>{j.full_name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Pareja/Jugador 1</label>
            <select value={form.entry1_id} onChange={(e) => setForm((f) => ({ ...f, entry1_id: e.target.value }))} className={selectClass}>
              <option value="">Por determinar</option>
              {entries.filter((e) => e.id !== form.entry2_id).map((e) => <option key={e.id} value={e.id}>{entryName(e)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Pareja/Jugador 2</label>
            <select value={form.entry2_id} onChange={(e) => setForm((f) => ({ ...f, entry2_id: e.target.value }))} className={selectClass}>
              <option value="">Por determinar</option>
              {entries.filter((e) => e.id !== form.entry1_id).map((e) => <option key={e.id} value={e.id}>{entryName(e)}</option>)}
            </select>
          </div>
        </div>

        {error && <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="bg-brand-red hover:bg-red-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors">
            {loading ? 'Creando...' : 'Crear partido'}
          </button>
          <button type="button" onClick={() => router.back()} className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2.5 rounded-xl transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
