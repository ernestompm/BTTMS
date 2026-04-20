'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { CATEGORY_LABELS } from '@/types'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

export default function NewDrawPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    category: 'absolute_m',
    draw_type: 'single_elimination',
    size: '16',
    consolation: false,
  })

  const selectClass = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.from('draws').insert({
      tournament_id: TOURNAMENT_ID,
      category: form.category,
      draw_type: form.draw_type,
      size: parseInt(form.size),
      consolation: form.consolation,
      status: 'draft',
    })
    if (error) {
      setError(error.message)
    } else {
      router.push('/dashboard/draws')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 fade-in">
      <div>
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm mb-3 flex items-center gap-1">← Volver</button>
        <h1 className="text-2xl font-bold text-white font-score">Nuevo Cuadro</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Categoría</label>
          <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} className={selectClass}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Tipo de cuadro</label>
          <select value={form.draw_type} onChange={(e) => setForm(f => ({ ...f, draw_type: e.target.value }))} className={selectClass}>
            <option value="single_elimination">Eliminación directa</option>
            <option value="double_elimination">Doble eliminación</option>
            <option value="round_robin">Todos contra todos</option>
            <option value="group_stage_ko">Fase de grupos + KO</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Plazas</label>
          <select value={form.size} onChange={(e) => setForm(f => ({ ...f, size: e.target.value }))} className={selectClass}>
            {[4, 8, 16, 32, 64].map(n => <option key={n} value={n}>{n} equipos</option>)}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="consolation" checked={form.consolation}
            onChange={(e) => setForm(f => ({ ...f, consolation: e.target.checked }))}
            className="w-4 h-4 rounded accent-brand-red" />
          <label htmlFor="consolation" className="text-sm text-gray-300">Incluir cuadro de consolación</label>
        </div>

        {error && <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="bg-brand-red hover:bg-red-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors">
            {loading ? 'Creando...' : 'Crear cuadro'}
          </button>
          <button type="button" onClick={() => router.back()} className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2.5 rounded-xl transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
