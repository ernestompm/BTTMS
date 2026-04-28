'use client'
// ============================================================================
// JudgeAssigner — selector inline para asignar/cambiar el juez de un partido
// ============================================================================
// Aparece en el detalle del partido (admin). Muestra los usuarios con rol
// 'judge' y permite asignarlos al partido. Sin recargar la pagina, refresca
// el server component con router.refresh().
// ============================================================================

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Props {
  matchId: string
  currentJudgeId?: string | null
  currentJudgeName?: string | null
}

export function JudgeAssigner({ matchId, currentJudgeId, currentJudgeName }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [judges, setJudges] = useState<Array<{ id: string, full_name: string }>>([])
  const [selected, setSelected] = useState<string>(currentJudgeId ?? '')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('app_users').select('id, full_name').eq('role', 'judge').order('full_name')
      .then(({ data }) => setJudges(data ?? []))
  }, [])

  async function handleSave() {
    setSaving(true); setError(''); setSavedMsg('')
    const { error: e } = await supabase.from('matches')
      .update({ judge_id: selected || null })
      .eq('id', matchId)
    setSaving(false)
    if (e) { setError(e.message); return }
    setSavedMsg('Juez asignado ✓')
    setTimeout(() => setSavedMsg(''), 2500)
    router.refresh()
  }

  const changed = (selected || null) !== (currentJudgeId || null)

  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">Juez árbitro</h3>
        {currentJudgeName && (
          <span className="text-xs text-gray-500">Actual: <span className="text-gray-300">{currentJudgeName}</span></span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red"
        >
          <option value="">— Sin juez asignado —</option>
          {judges.map((j) => <option key={j.id} value={j.id}>{j.full_name}</option>)}
        </select>
        <button
          onClick={handleSave}
          disabled={!changed || saving}
          className="bg-brand-red hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        {savedMsg && <span className="text-green-400 text-xs">{savedMsg}</span>}
        {error && <span className="text-red-400 text-xs">✗ {error}</span>}
      </div>
      {judges.length === 0 && (
        <p className="text-yellow-300 text-xs">
          ⚠️ No hay usuarios con rol <code className="bg-gray-800 px-1 rounded">judge</code> en la base de datos.
          {' '}
          <a href="/dashboard/users" className="underline">Crear uno desde Usuarios →</a>
        </p>
      )}
    </div>
  )
}

// ============================================================================
// BulkJudgeAssigner — accion rapida para asignar UN juez a TODOS los
// partidos del torneo. Util cuando hay un solo juez (caso comun en
// torneos pequenos).
// ============================================================================

interface BulkProps {
  tournamentId: string
}

export function BulkJudgeAssigner({ tournamentId }: BulkProps) {
  const supabase = createClient()
  const router = useRouter()
  const [judges, setJudges] = useState<Array<{ id: string, full_name: string }>>([])
  const [selected, setSelected] = useState('')
  const [scope, setScope] = useState<'all' | 'unassigned'>('unassigned')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('app_users').select('id, full_name').eq('role', 'judge').order('full_name')
      .then(({ data }) => setJudges(data ?? []))
  }, [])

  async function handleApply() {
    if (!selected) { setError('Selecciona un juez antes de aplicar'); return }
    if (!confirm(`¿Asignar este juez a ${scope === 'all' ? 'TODOS los partidos' : 'los partidos sin juez'} del torneo?`)) return
    setSaving(true); setError(''); setMsg('')
    let q = supabase.from('matches').update({ judge_id: selected }, { count: 'exact' }).eq('tournament_id', tournamentId)
    if (scope === 'unassigned') q = q.is('judge_id', null)
    const { error: e, count } = await q
    setSaving(false)
    if (e) { setError(e.message); return }
    setMsg(`✓ Juez asignado a ${count ?? 0} partido(s)`)
    setTimeout(() => setMsg(''), 4000)
    router.refresh()
  }

  return (
    <div className="bg-blue-900/20 border border-blue-900/50 rounded-2xl p-5 space-y-3">
      <div>
        <h3 className="text-blue-200 font-semibold text-sm">Asignación masiva de juez</h3>
        <p className="text-gray-400 text-xs mt-1">
          Asigna un mismo juez a varios partidos de un click. Útil cuando hay un único árbitro arbitrando
          todos los partidos del torneo.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red"
        >
          <option value="">— Selecciona el juez —</option>
          {judges.map((j) => <option key={j.id} value={j.id}>{j.full_name}</option>)}
        </select>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as any)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red"
        >
          <option value="unassigned">Solo partidos SIN juez</option>
          <option value="all">TODOS los partidos del torneo</option>
        </select>
        <button
          onClick={handleApply}
          disabled={!selected || saving}
          className="bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap"
        >
          {saving ? 'Aplicando…' : 'Aplicar'}
        </button>
        {msg && <span className="text-green-400 text-xs">{msg}</span>}
        {error && <span className="text-red-400 text-xs">✗ {error}</span>}
      </div>
    </div>
  )
}
