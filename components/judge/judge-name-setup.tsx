'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Props {
  userId: string
  currentName?: string | null
}

/**
 * Pantalla de setup para que el juez introduzca su nombre y apellidos antes
 * de poder arbitrar. Se muestra cuando app_users.full_name está vacío.
 */
export function JudgeNameSetup({ userId, currentName }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [first, setFirst] = useState('')
  const [last, setLast]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    const fn = first.trim()
    const ln = last.trim()
    if (fn.length < 2 || ln.length < 2) {
      setError('Nombre y apellidos obligatorios (mínimo 2 caracteres cada uno)')
      return
    }
    setSaving(true)
    const full = `${fn} ${ln}`
    const { error: e } = await supabase.from('app_users').update({ full_name: full }).eq('id', userId)
    setSaving(false)
    if (e) { setError(e.message); return }
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
        <div>
          <h1 className="text-white font-score font-black text-2xl">Antes de empezar</h1>
          <p className="text-gray-400 text-sm mt-1">
            Como juez árbitro, necesitamos tu <b>nombre y apellidos reales</b> para mostrarlos
            en los gráficos de la retransmisión y en la firma del acta.
          </p>
          {currentName && (
            <p className="text-gray-600 text-xs mt-2">Actualmente: <code>{currentName}</code></p>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-gray-400 text-xs font-bold uppercase tracking-widest block mb-1">Nombre</label>
            <input value={first} onChange={(e) => setFirst(e.target.value)}
              placeholder="Juan"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-brand-red" />
          </div>
          <div>
            <label className="text-gray-400 text-xs font-bold uppercase tracking-widest block mb-1">Apellidos</label>
            <input value={last} onChange={(e) => setLast(e.target.value)}
              placeholder="García Martínez"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-brand-red" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={save} disabled={saving}
            className="w-full h-14 rounded-xl font-black font-score text-lg text-white disabled:opacity-50 active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(90deg,#f31948,#fc6f43)' }}>
            {saving ? 'Guardando...' : 'CONTINUAR'}
          </button>
        </div>
      </div>
    </div>
  )
}
