'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !signInData.user) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      setLoading(false)
    } else {
      // Redirect by role: ?redirect= en URL gana. Si no, deduce destino por rol
      const explicitRedirect = searchParams.get('redirect')
      let target = explicitRedirect ?? '/dashboard'
      if (!explicitRedirect) {
        const { data: appUser } = await supabase
          .from('app_users')
          .select('role')
          .eq('id', signInData.user.id)
          .single()
        const role = (appUser as any)?.role
        if (role === 'judge') target = '/judge'
        else if (role === 'commentator') target = '/commentator'
        else target = '/dashboard'
      }
      router.replace(target)
      router.refresh()
    }
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white placeholder-gray-400 focus:outline-none focus:border-brand-red focus:bg-white/15 transition-all"
          placeholder="tu@email.com" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Contraseña</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white placeholder-gray-400 focus:outline-none focus:border-brand-red focus:bg-white/15 transition-all"
          placeholder="••••••••" />
      </div>
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>
      )}
      <button type="submit" disabled={loading}
        className="w-full font-bold py-4 rounded-xl transition-all btn-press disabled:opacity-50 text-white text-base mt-1"
        style={{ background: loading ? '#555' : 'linear-gradient(90deg, #f31948 0%, #fc6f43 100%)' }}>
        {loading ? 'Entrando...' : 'Entrar →'}
      </button>
    </form>
  )

  return (
    <>
      {/* ── MOBILE (< lg) ─────────────────────────────────────── */}
      <div className="lg:hidden fixed inset-0 flex flex-col items-center justify-center px-6 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0a0010 0%, #1c0030 35%, #2d0015 70%, #0a0008 100%)' }}>

        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-30 blur-3xl"
            style={{ background: 'radial-gradient(circle, #f31948, transparent)' }} />
          <div className="absolute top-1/3 -left-16 w-56 h-56 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #fc6f43, transparent)' }} />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #af005f, transparent)' }} />
        </div>

        {/* Branding */}
        <div className="relative z-10 flex flex-col items-center mb-8">
          <img src="/logo-full.png" alt="Vinteon" className="w-24 h-24 object-contain mb-4" />
          <h1 className="text-3xl font-black text-white font-score text-center leading-tight">
            Marcador{' '}
            <span style={{ background: 'linear-gradient(90deg, #f31948, #fc6f43)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Vinteon
            </span>
          </h1>
          <p className="text-gray-400 text-xs mt-1 tracking-widest uppercase">Tenis Playa</p>
        </div>

        {/* Form card */}
        <div className="relative z-10 w-full max-w-sm p-6 rounded-3xl border border-white/10"
          style={{ background: 'rgba(15, 5, 25, 0.85)', backdropFilter: 'blur(20px)' }}>
          <h2 className="text-lg font-bold text-white mb-4">Acceder al sistema</h2>
          {form}
          <p className="text-center text-gray-600 text-xs mt-4">Vinteon Media · España 2026</p>
        </div>
      </div>

      {/* ── DESKTOP (≥ lg) ────────────────────────────────────── */}
      <div className="hidden lg:flex min-h-screen">

        {/* Left — branding */}
        <div className="w-1/2 flex flex-col justify-center gap-10 p-16 relative overflow-hidden"
          style={{ background: 'linear-gradient(145deg, #0a0010 0%, #1a0028 45%, #2d0015 100%)' }}>

          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full opacity-25 blur-3xl"
              style={{ background: 'radial-gradient(circle, #f31948, transparent)' }} />
            <div className="absolute bottom-1/4 right-1/3 w-96 h-96 rounded-full opacity-20 blur-3xl"
              style={{ background: 'radial-gradient(circle, #fc6f43, transparent)' }} />
          </div>

          {/* Logo */}
          <div className="relative z-10">
            <img src="/logo-full.png" alt="Vinteon" className="w-28 h-28 object-contain" />
          </div>

          {/* Main text */}
          <div className="relative z-10 space-y-6">
            <p className="text-brand-red font-semibold text-xs uppercase tracking-[0.3em]">Sistema de gestión</p>
            <h1 className="text-7xl font-black text-white leading-none font-score">
              Marcador<br />
              <span style={{ background: 'linear-gradient(90deg, #f31948, #fc6f43)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Vinteon
              </span>
            </h1>
            <p className="text-gray-300 text-2xl font-light tracking-widest uppercase">Tenis Playa</p>
            <p className="text-gray-500 text-sm max-w-xs leading-relaxed pt-2">
              Gestión de torneos, árbitros, cuadros y marcadores en tiempo real.
            </p>
          </div>

        </div>

        {/* Right — form */}
        <div className="w-1/2 flex items-center justify-center bg-gray-950 px-16">
          <div className="w-full max-w-md">
            <h2 className="text-3xl font-bold text-white mb-2">Acceder</h2>
            <p className="text-gray-400 text-sm mb-8">Introduce tus credenciales para continuar</p>
            {form}
            <p className="text-center text-gray-600 text-xs mt-8">Vinteon Media · Campeonato de España de Tenis Playa 2026</p>
          </div>
        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
