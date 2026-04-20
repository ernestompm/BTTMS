'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

const ic = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-brand-red text-sm"
const lc = "block text-sm font-medium text-gray-300 mb-1"

function calcAge(birthDate: string): number {
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
}

export default function NewPlayerPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    first_name: '', last_name: '', nationality: 'ESP',
    birth_date: '', age_manual: '', height_cm: '', laterality: 'right',
    ranking_rfet: '', ranking_itf: '', club: '', federacion_autonomica: '',
    bio: '', social_instagram: '', birth_city: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const displayedAge = form.birth_date
    ? calcAge(form.birth_date)
    : form.age_manual ? parseInt(form.age_manual) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    let photo_url: string | null = null

    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const fileName = `${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('player-photos')
        .upload(fileName, photoFile, { upsert: true })
      if (!uploadError) {
        const { data } = supabase.storage.from('player-photos').getPublicUrl(fileName)
        photo_url = data.publicUrl
      }
    }

    const { error } = await supabase.from('players').insert({
      first_name: form.first_name,
      last_name: form.last_name,
      nationality: form.nationality.toUpperCase(),
      birth_date: form.birth_date || null,
      birth_city: form.birth_city || null,
      age_manual: !form.birth_date && form.age_manual ? parseInt(form.age_manual) : null,
      height_cm: form.height_cm ? parseInt(form.height_cm) : null,
      laterality: form.laterality,
      ranking_rfet: form.ranking_rfet ? parseInt(form.ranking_rfet) : null,
      ranking_itf: form.ranking_itf ? parseInt(form.ranking_itf) : null,
      club: form.club || null,
      federacion_autonomica: form.federacion_autonomica || null,
      bio: form.bio || null,
      social_instagram: form.social_instagram || null,
      photo_url,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = '/dashboard/players'
    }
  }

  return (
    <div className="space-y-6 fade-in">
      <div>
        <button onClick={() => window.history.back()} className="text-gray-400 hover:text-white text-sm mb-3 flex items-center gap-1">← Volver</button>
        <h1 className="text-2xl font-bold text-white font-score">Nuevo Jugador</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-5">

        {/* Photo */}
        <div>
          <label className={lc}>Foto del jugador</label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-gray-800 border-2 border-dashed border-gray-700 overflow-hidden flex items-center justify-center flex-shrink-0">
              {photoPreview
                ? <img src={photoPreview} className="w-full h-full object-cover" alt="preview" />
                : <span className="text-3xl">👤</span>}
            </div>
            <label className="cursor-pointer bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-4 py-2.5 rounded-xl transition-colors">
              Subir foto
              <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
            </label>
          </div>
        </div>

        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lc}>Nombre *</label>
            <input className={ic} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Carlos" required />
          </div>
          <div>
            <label className={lc}>Apellidos *</label>
            <input className={ic} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="García Martínez" required />
          </div>
        </div>

        {/* Nationality + flag preview */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lc}>Nacionalidad (código 3 letras)</label>
            <div className="flex items-center gap-3">
              <input className={ic} value={form.nationality}
                onChange={e => set('nationality', e.target.value.toUpperCase().slice(0, 3))}
                maxLength={3} placeholder="ESP" />
              {form.nationality.length === 3 && (
                <img src={`/Flags/${form.nationality.toUpperCase()}.jpg`}
                  alt={form.nationality} className="h-6 w-9 object-cover rounded flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              )}
            </div>
          </div>
          <div>
            <label className={lc}>Ciudad de nacimiento</label>
            <input className={ic} value={form.birth_city} onChange={e => set('birth_city', e.target.value)} placeholder="Madrid" />
          </div>
        </div>

        {/* Age / birth date */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={lc}>Fecha de nacimiento</label>
            <input type="date" className={ic} value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
          </div>
          <div>
            <label className={lc}>
              Edad {form.birth_date ? <span className="text-green-400 text-xs">(calculada)</span> : <span className="text-gray-500 text-xs">(manual)</span>}
            </label>
            {form.birth_date
              ? <div className="flex items-center h-10 px-4 bg-gray-800/50 border border-gray-700 rounded-xl text-white text-sm">{calcAge(form.birth_date)} años</div>
              : <input type="number" className={ic} value={form.age_manual} onChange={e => set('age_manual', e.target.value)} placeholder="25" />
            }
          </div>
          <div>
            <label className={lc}>Altura (cm)</label>
            <input type="number" className={ic} value={form.height_cm} onChange={e => set('height_cm', e.target.value)} placeholder="185" />
          </div>
        </div>

        {/* Club + federation */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lc}>Club</label>
            <input className={ic} value={form.club} onChange={e => set('club', e.target.value)} placeholder="Club Tenis Playa Madrid" />
          </div>
          <div>
            <label className={lc}>Federación autonómica</label>
            <input className={ic} value={form.federacion_autonomica} onChange={e => set('federacion_autonomica', e.target.value)} placeholder="FBTM Madrid" />
          </div>
        </div>

        {/* Rankings + laterality */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={lc}>Lateralidad</label>
            <select className={ic} value={form.laterality} onChange={e => set('laterality', e.target.value)}>
              <option value="right">Derecho</option>
              <option value="left">Zurdo</option>
              <option value="ambidextrous">Ambidiestro</option>
            </select>
          </div>
          <div>
            <label className={lc}>Ranking RFET</label>
            <input type="number" className={ic} value={form.ranking_rfet} onChange={e => set('ranking_rfet', e.target.value)} placeholder="1" />
          </div>
          <div>
            <label className={lc}>Ranking ITF</label>
            <input type="number" className={ic} value={form.ranking_itf} onChange={e => set('ranking_itf', e.target.value)} placeholder="50" />
          </div>
        </div>

        {/* Bio + Instagram */}
        <div>
          <label className={lc}>Biografía</label>
          <textarea className={ic + " resize-none"} value={form.bio} onChange={e => set('bio', e.target.value)} rows={3} placeholder="Breve bio del jugador..." />
        </div>
        <div>
          <label className={lc}>Instagram (@handle)</label>
          <input className={ic} value={form.social_instagram} onChange={e => set('social_instagram', e.target.value)} placeholder="carlosrfet" />
        </div>

        {error && <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading || !form.first_name || !form.last_name}
            className="bg-brand-red hover:bg-red-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors">
            {loading ? 'Guardando...' : 'Crear jugador'}
          </button>
          <button type="button" onClick={() => window.history.back()} className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2.5 rounded-xl transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
