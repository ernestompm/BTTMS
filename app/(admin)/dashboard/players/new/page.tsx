'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

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

  function handleChange(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
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

  const Field = ({ label, name, type = 'text', placeholder = '' }: { label: string; name: string; type?: string; placeholder?: string }) => (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input type={type} value={(form as any)[name]} onChange={(e) => handleChange(name, e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-brand-red text-sm" />
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6 fade-in">
      <div>
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm mb-3 flex items-center gap-1">
          ← Volver
        </button>
        <h1 className="text-2xl font-bold text-white font-score">Nuevo Jugador</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre *" name="first_name" placeholder="Carlos" />
          <Field label="Apellidos *" name="last_name" placeholder="García Martínez" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nacionalidad</label>
            <input value={form.nationality} onChange={(e) => handleChange('nationality', e.target.value.toUpperCase().slice(0, 3))}
              maxLength={3} placeholder="ESP"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand-red text-sm" />
          </div>
          <Field label="Fecha nac." name="birth_date" type="date" />
          <Field label="Altura (cm)" name="height_cm" type="number" placeholder="185" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Lateralidad</label>
            <select value={form.laterality} onChange={(e) => handleChange('laterality', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand-red text-sm">
              <option value="right">Derecho</option>
              <option value="left">Zurdo</option>
              <option value="ambidextrous">Ambidiestro</option>
            </select>
          </div>
          <Field label="Ranking RFET" name="ranking_rfet" type="number" placeholder="1" />
          <Field label="Ranking ITF" name="ranking_itf" type="number" placeholder="50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Biografía</label>
          <textarea value={form.bio} onChange={(e) => handleChange('bio', e.target.value)} rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand-red text-sm resize-none"
            placeholder="Breve bio del jugador..." />
        </div>
        <Field label="Instagram (@handle)" name="social_instagram" placeholder="carlosrfet" />

        {error && <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading || !form.first_name || !form.last_name}
            className="bg-brand-red hover:bg-red-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors">
            {loading ? 'Guardando...' : 'Crear jugador'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2.5 rounded-xl transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
