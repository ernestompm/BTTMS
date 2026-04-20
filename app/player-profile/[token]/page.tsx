'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'

const ic = "w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/60 text-sm backdrop-blur"

function calcAge(birthDate: string) {
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
}

function timeLeft(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expirado'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

export default function PlayerProfilePage() {
  const { token } = useParams<{ token: string }>()
  const fileRef = useRef<HTMLInputElement>(null)

  const [state, setState] = useState<'loading' | 'ready' | 'expired' | 'error'>('loading')
  const [expiresAt, setExpiresAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [form, setForm] = useState({
    birth_date: '', birth_city: '', age_manual: '', height_cm: '',
    laterality: 'right', bio: '', social_instagram: '', club: '',
    federacion_autonomica: '', photo_url: '',
  })

  useEffect(() => {
    fetch(`/api/player-profile/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setState('expired'); return }
        const p = data.player
        setExpiresAt(data.expires_at)
        setPlayerName(`${p.first_name} ${p.last_name}`)
        setPhotoPreview(p.photo_url || null)
        setForm({
          birth_date: p.birth_date ?? '',
          birth_city: p.birth_city ?? '',
          age_manual: p.age_manual?.toString() ?? '',
          height_cm: p.height_cm?.toString() ?? '',
          laterality: p.laterality ?? 'right',
          bio: p.bio ?? '',
          social_instagram: p.social_instagram ?? '',
          club: p.club ?? '',
          federacion_autonomica: p.federacion_autonomica ?? '',
          photo_url: p.photo_url ?? '',
        })
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [token])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoPreview(URL.createObjectURL(file))
    setUploadingPhoto(true)
    const fd = new FormData()
    fd.append('photo', file)
    const res = await fetch(`/api/player-profile/${token}/photo`, { method: 'POST', body: fd })
    const data = await res.json()
    if (data.url) { set('photo_url', data.url); setPhotoPreview(data.url) }
    setUploadingPhoto(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const body = {
      birth_date: form.birth_date || null,
      birth_city: form.birth_city || null,
      age_manual: !form.birth_date && form.age_manual ? parseInt(form.age_manual) : null,
      height_cm: form.height_cm ? parseInt(form.height_cm) : null,
      laterality: form.laterality || null,
      bio: form.bio || null,
      social_instagram: form.social_instagram || null,
      club: form.club || null,
      federacion_autonomica: form.federacion_autonomica || null,
      photo_url: form.photo_url || null,
    }
    const res = await fetch(`/api/player-profile/${token}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) { setSaved(true) }
  }

  if (state === 'loading') return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
      <div className="text-white text-lg opacity-60">Cargando...</div>
    </div>
  )

  if (state === 'expired') return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-6xl">⏰</div>
        <h1 className="text-white text-2xl font-bold">Enlace expirado</h1>
        <p className="text-gray-400">Este enlace de perfil ya no es válido. Pide a la organización que te envíe uno nuevo.</p>
      </div>
    </div>
  )

  if (state === 'error') return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-6xl">❌</div>
        <h1 className="text-white text-2xl font-bold">Enlace inválido</h1>
        <p className="text-gray-400">Este enlace no existe o ya ha sido utilizado.</p>
      </div>
    </div>
  )

  if (saved) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-7xl">🏆</div>
        <h1 className="text-white text-3xl font-black">¡Perfil actualizado!</h1>
        <p className="text-gray-300 text-lg">Gracias, {playerName}. Tu información ya está guardada.</p>
        {photoPreview && (
          <img src={photoPreview} alt={playerName} className="w-32 h-32 rounded-full object-cover mx-auto border-4 border-white/20" />
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <div className="bg-black/30 border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-black text-sm">V</div>
          <span className="text-white font-semibold text-sm">Marcador Vinteon · Tenis Playa</span>
        </div>
        <div className="text-xs text-amber-400 font-medium">
          ⏱ Expira en {timeLeft(expiresAt)}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-8 space-y-6">
        <div>
          <h1 className="text-white text-2xl font-black">Hola, {playerName} 👋</h1>
          <p className="text-gray-400 text-sm mt-1">
            Completa tu perfil para el torneo. Solo tú puedes ver y editar estos datos a través de este enlace.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Photo */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 space-y-3">
            <p className="text-white font-semibold text-sm">Foto de perfil</p>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white/10 border-2 border-dashed border-white/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                {photoPreview
                  ? <img src={photoPreview} className="w-full h-full object-cover" alt="foto" />
                  : <span className="text-3xl">👤</span>
                }
              </div>
              <div className="space-y-2">
                <label className={`inline-block cursor-pointer text-sm font-medium px-4 py-2.5 rounded-xl transition-colors border ${uploadingPhoto ? 'opacity-50 cursor-wait border-white/10 text-white/40' : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'}`}>
                  {uploadingPhoto ? 'Subiendo...' : 'Elegir foto'}
                  <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" disabled={uploadingPhoto} />
                </label>
                <p className="text-gray-500 text-xs">JPG, PNG o WebP · máx. 5 MB</p>
              </div>
            </div>
          </div>

          {/* Personal data */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 space-y-4">
            <p className="text-white font-semibold text-sm">Datos personales</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Fecha de nacimiento</label>
                <input type="date" className={ic} value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Edad {form.birth_date ? <span className="text-green-400">(auto)</span> : '(manual)'}
                </label>
                {form.birth_date
                  ? <div className="flex items-center h-11 px-4 bg-white/5 border border-white/10 rounded-xl text-white text-sm">{calcAge(form.birth_date)} años</div>
                  : <input type="number" className={ic} value={form.age_manual} onChange={e => set('age_manual', e.target.value)} placeholder="25" />
                }
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Ciudad de nacimiento</label>
                <input className={ic} value={form.birth_city} onChange={e => set('birth_city', e.target.value)} placeholder="Madrid" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Altura (cm)</label>
                <input type="number" className={ic} value={form.height_cm} onChange={e => set('height_cm', e.target.value)} placeholder="180" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Mano dominante</label>
              <select className={ic} value={form.laterality} onChange={e => set('laterality', e.target.value)}>
                <option value="right">Derecho</option>
                <option value="left">Zurdo</option>
                <option value="ambidextrous">Ambidiestro</option>
              </select>
            </div>
          </div>

          {/* Club & federation */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 space-y-4">
            <p className="text-white font-semibold text-sm">Club y Federación</p>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Club</label>
              <input className={ic} value={form.club} onChange={e => set('club', e.target.value)} placeholder="Club Tenis Playa Madrid" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Federación autonómica</label>
              <input className={ic} value={form.federacion_autonomica} onChange={e => set('federacion_autonomica', e.target.value)} placeholder="FBTM Madrid" />
            </div>
          </div>

          {/* Bio & social */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 space-y-4">
            <p className="text-white font-semibold text-sm">Bio y redes</p>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Biografía breve</label>
              <textarea className={ic + ' resize-none'} value={form.bio} onChange={e => set('bio', e.target.value)} rows={3} placeholder="Cuéntanos algo sobre ti..." />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Instagram (@handle)</label>
              <input className={ic} value={form.social_instagram} onChange={e => set('social_instagram', e.target.value)} placeholder="@miusuario" />
            </div>
          </div>

          <button type="submit" disabled={saving || uploadingPhoto}
            className="w-full py-4 rounded-2xl font-black text-lg text-white disabled:opacity-50 transition-all active:scale-98"
            style={{ background: 'linear-gradient(90deg,#ef6a4c,#d94a2e)' }}>
            {saving ? 'Guardando...' : 'Guardar mi perfil →'}
          </button>
        </form>
      </div>
    </div>
  )
}
