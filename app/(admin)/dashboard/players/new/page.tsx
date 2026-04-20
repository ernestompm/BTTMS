'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-brand-red text-sm"
const labelClass = "block text-sm font-medium text-gray-300 mb-1"

export default function NewPlayerPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: '', last_name: '', nationality: 'ESP',
    birth_date: '', height_cm: '', laterality: 'right',
    ranking_rfet: '', ranking_itf: '',
    bio: '', social_instagram: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.from('players').insert({
      ...form,
      height_cm: form.height_cm ? parseInt(form.height_cm) : null,
      ranking_rfet: form.ranking_rfet ? parseInt(form.ranking_rfet) : null,
      ranking_itf: form.ranking_itf ? parseInt(form.ranking_itf) : null,
      birth_date: form.birth_date || null,
    })
    if (error) { setError(error.message) } else { router.push('/dashboard/players') }
    setLoading(false)
  }

  return (
    <div className="space-y-6 fade-in">
      <div>
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm mb-3 flex items-center gap-1">← Volver</button>
        <h1 className="text-2xl font-bold text-white font-score">Nuevo Jugador</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nombre *</label>
            <input className={inputClass} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Carlos" required />
          </div>
          <div>
            <label className={labelClass}>Apellidos *</label>
            <input className={inputClass} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="García Martínez" required />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Nacionalidad</label>
            <input className={inputClass} value={form.nationality} onChange={e => set('nationality', e.target.value.toUpperCase().slice(0, 3))} maxLength={3} placeholder="ESP" />
          </div>
          <div>
            <label className={labelClass}>Fecha nac.</label>
            <input type="date" className={inputClass} value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Altura (cm)</label>
            <input type="number" className={inputClass} value={form.height_cm} onChange={e => set('height_cm', e.target.value)} placeholder="185" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Lateralidad</label>
            <select className={inputClass} value={form.laterality} onChange={e => set('laterality', e.target.value)}>
              <option value="right">Derecho</option>
              <option value="left">Zurdo</option>
              <option value="ambidextrous">Ambidiestro</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Ranking RFET</label>
            <input type="number" className={inputClass} value={form.ranking_rfet} onChange={e => set('ranking_rfet', e.target.value)} placeholder="1" />
          </div>
          <div>
            <label className={labelClass}>Ranking ITF</label>
            <input type="number" className={inputClass} value={form.ranking_itf} onChange={e => set('ranking_itf', e.target.value)} placeholder="50" />
          </div>
        </div>

        <div>
          <label className={labelClass}>Biografía</label>
          <textarea className={inputClass + " resize-none"} value={form.bio} onChange={e => set('bio', e.target.value)} rows={3} placeholder="Breve bio del jugador..." />
        </div>

        <div>
          <label className={labelClass}>Instagram (@handle)</label>
          <input className={inputClass} value={form.social_instagram} onChange={e => set('social_instagram', e.target.value)} placeholder="carlosrfet" />
        </div>

        {error && <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading || !form.first_name || !form.last_name}
            className="bg-brand-red hover:bg-red-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors">
            {loading ? 'Guardando...' : 'Crear jugador'}
          </button>
          <button type="button" onClick={() => router.back()} className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2.5 rounded-xl transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
