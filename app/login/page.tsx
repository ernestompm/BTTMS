'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 relative overflow-hidden p-12"
        style={{ background: 'linear-gradient(135deg, #0a0010 0%, #1a0028 40%, #2d0015 100%)' }}>

        {/* Animated background orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #f31948, transparent)' }} />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl"
            style={{ background: 'radial-gradient(circle, #fc6f43, transparent)' }} />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full opacity-10 blur-2xl -translate-x-1/2 -translate-y-1/2"
            style={{ background: 'radial-gradient(circle, #af005f, transparent)' }} />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <img src="/logo-full.png" alt="Vinteon" className="h-14 w-auto object-contain" />
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-brand-red font-semibold text-sm uppercase tracking-widest mb-3">Sistema de gestión</p>
            <h1 className="text-5xl font-black text-white leading-tight font-score">
              Marcador<br />
              <span style={{ background: 'linear-gradient(90deg, #f31948, #fc6f43)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Vinteon
              </span>
            </h1>
            <p className="text-gray-300 text-xl mt-3 font-light">Tenis Playa</p>
          </div>
          <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
            Gestión profesional de torneos, árbitros, cuadros y marcadores en tiempo real.
          </p>
        </div>

        {/* Bottom stats */}
        <div className="relative z-10 flex gap-8">
          {[
            { value: 'Live', label: 'Marcador en tiempo real' },
            { value: '7+', label: 'Módulos integrados' },
            { value: '0€', label: 'Coste de operación' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-white font-black text-2xl font-score">{value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-950">

        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <img src="/logo-full.png" alt="Vinteon" className="h-12 w-auto object-contain mx-auto mb-3" />
          <h1 className="text-2xl font-black text-white font-score">Marcador Vinteon</h1>
          <p className="text-gray-400 text-sm">Tenis Playa</p>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">Acceder</h2>
            <p className="text-gray-400 text-sm mt-1">Introduce tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red transition-colors"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-bold py-3.5 rounded-xl transition-all btn-press disabled:opacity-50 mt-2"
              style={{ background: loading ? '#666' : 'linear-gradient(90deg, #f31948, #fc6f43)' }}
            >
              {loading ? 'Entrando...' : 'Entrar →'}
            </button>
          </form>

          <p className="text-center text-gray-600 text-xs mt-8">
            Vinteon Media · Campeonato de España de Tenis Playa 2026
          </p>
        </div>
      </div>
    </div>
  )
}
