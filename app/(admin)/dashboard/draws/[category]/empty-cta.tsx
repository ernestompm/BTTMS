'use client'
// ============================================================================
// EmptyDrawCTA — botones que rompen el bucle "no hay cuadro -> crea uno"
// ============================================================================
// El boton primario llama al endpoint de seed (mismo que el de la pagina de
// configuracion) y recarga: en una sola accion se generan jugadores, cuadro
// y los 15 partidos. Asi el usuario sale del loop independientemente de si
// el formulario manual fallaba por RLS, columna ausente, etc.
// ============================================================================

import { useState } from 'react'
import Link from 'next/link'

export function EmptyDrawCTA() {
  const [loading, setLoading] = useState<'skeleton' | 'simulated' | null>(null)
  const [error, setError] = useState('')

  async function handleSeed(mode: 'skeleton' | 'simulated') {
    if (!confirm(mode === 'simulated'
      ? 'Esto BORRA los datos actuales y crea 32 jugadores + cuadro completo (15 partidos) con R16+QF+SF simulados como TERMINADOS. ¿Continuar?'
      : 'Esto BORRA los datos actuales y crea 32 jugadores + cuadro completo de 15 partidos (R16 listos para jugar). ¿Continuar?')) return
    setLoading(mode)
    setError('')
    const res = await fetch(`/api/admin/seed?mode=${mode}`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Error inesperado')
      setLoading(null)
      return
    }
    // Recargar para que la pagina vuelva a leer el cuadro recien creado
    window.location.href = '/dashboard/draws/absolute_m'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button
          onClick={() => handleSeed('skeleton')}
          disabled={!!loading}
          className="bg-brand-red hover:bg-red-600 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
          {loading === 'skeleton' ? 'Generando...' : '🎾 Sembrar cuadro vacío (R16 listos)'}
        </button>
        <button
          onClick={() => handleSeed('simulated')}
          disabled={!!loading}
          className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
          {loading === 'simulated' ? 'Generando...' : '🏆 Sembrar cuadro avanzado (R16+QF+SF terminados)'}
        </button>
      </div>
      <div className="text-center">
        <Link href="/dashboard/draws/new" className="text-gray-500 hover:text-gray-300 text-xs underline">
          O crear un cuadro manualmente desde el formulario →
        </Link>
      </div>
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-2 text-red-300 text-xs text-center">
          ✗ {error}
        </div>
      )}
    </div>
  )
}
