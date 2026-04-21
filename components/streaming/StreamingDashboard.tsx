'use client'
// ============================================================================
// StreamingDashboard — select which matches get streaming graphics.
// Each active match yields a unique overlay URL and its own operator page,
// so two (or more) parallel streams can operate simultaneously.
// ============================================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { StreamSession } from '@/types/streaming'

interface Props {
  tournamentId: string
  matches: any[]
  initialSessions: StreamSession[]
}

export function StreamingDashboard({ tournamentId, matches, initialSessions }: Props) {
  const supabase = createClient()
  const [sessions, setSessions] = useState<StreamSession[]>(initialSessions)
  const [filter, setFilter] = useState<'live'|'scheduled'|'all'>('live')
  const [copied, setCopied] = useState<string|null>(null)

  useEffect(() => {
    const ch = supabase.channel(`stream-dash-${tournamentId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'stream_sessions', filter:`tournament_id=eq.${tournamentId}` },
        () => refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tournamentId])

  async function refresh() {
    const { data } = await supabase.from('stream_sessions').select('*').eq('tournament_id', tournamentId)
    setSessions((data as any) ?? [])
  }

  const bySession = useMemo(() => {
    const m = new Map<string, StreamSession>()
    for (const s of sessions) m.set(s.match_id, s)
    return m
  }, [sessions])

  const filtered = matches.filter(m => {
    if (filter === 'live') return m.status === 'in_progress' || m.status === 'warmup' || m.status === 'players_on_court' || m.status === 'judge_on_court'
    if (filter === 'scheduled') return m.status === 'scheduled'
    return true
  })

  async function activate(matchId: string) {
    await supabase.from('stream_sessions').upsert({
      match_id: matchId, tournament_id: tournamentId, active: true,
    }, { onConflict: 'match_id' })
    refresh()
  }

  async function toggleActive(s: StreamSession) {
    await supabase.from('stream_sessions').update({ active: !s.active }).eq('id', s.id)
    refresh()
  }

  async function deactivate(s: StreamSession) {
    if (!confirm('¿Eliminar sesión? Se cortará la URL de overlay.')) return
    await supabase.from('stream_sessions').delete().eq('id', s.id)
    refresh()
  }

  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(()=>setCopied(null),1500) } catch {}
  }

  function teamLabel(entry:any) {
    return [entry?.player1?.last_name, entry?.player2?.last_name].filter(Boolean).join(' / ') || '—'
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🎬 Streaming · Gestión de gráficos</h1>
          <p className="text-gray-400 text-sm mt-1">Activa partidos para generar un overlay vMix independiente por cada uno. Permite operar varios streams en paralelo.</p>
        </div>
        <div className="flex gap-2">
          {(['live','scheduled','all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg font-bold ${filter===f ? 'bg-brand-red text-white':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
              {f === 'live' ? 'En juego' : f === 'scheduled' ? 'Próximos' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-widest">
            <tr>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Partido</th>
              <th className="px-4 py-3 text-left">Cat / Fase</th>
              <th className="px-4 py-3 text-left">Pista</th>
              <th className="px-4 py-3 text-left">Sesión</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const s = bySession.get(m.id)
              const overlayUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/overlay/${m.id}`
              const operatorUrl = `/stream/${m.id}`
              return (
                <tr key={m.id} className="border-t border-gray-800 hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${m.status==='in_progress'?'bg-red-500/20 text-red-300':'bg-gray-700 text-gray-300'}`}>{m.status}</span>
                  </td>
                  <td className="px-4 py-3 text-white">
                    <div className="font-bold">{teamLabel(m.entry1)}</div>
                    <div className="text-gray-400">vs {teamLabel(m.entry2)}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    <div>{m.category}</div>
                    <div className="text-gray-500 text-xs">{m.round}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{m.court?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {s ? (
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${s.active ? 'bg-green-500':'bg-gray-500'}`}/>
                        <span className="text-xs text-gray-300">{s.active ? 'ACTIVA' : 'PAUSADA'}</span>
                        {s.automation_enabled && <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">AUTO</span>}
                      </div>
                    ) : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {!s && <button onClick={() => activate(m.id)} className="px-2.5 py-1 bg-brand-red text-white rounded text-xs font-bold hover:bg-red-600">Activar</button>}
                      {s && (
                        <>
                          <Link href={operatorUrl} className="px-2.5 py-1 bg-cyan-600 text-white rounded text-xs font-bold hover:bg-cyan-500">Operar</Link>
                          <button onClick={() => copy(overlayUrl)} className="px-2.5 py-1 bg-gray-700 text-gray-200 rounded text-xs hover:bg-gray-600">
                            {copied===overlayUrl ? '✓ URL' : 'URL vMix'}
                          </button>
                          <button onClick={() => toggleActive(s)} className="px-2.5 py-1 bg-gray-700 text-gray-200 rounded text-xs hover:bg-gray-600">
                            {s.active ? 'Pausar' : 'Reanudar'}
                          </button>
                          <button onClick={() => deactivate(s)} className="px-2.5 py-1 bg-gray-800 text-red-300 rounded text-xs hover:bg-red-900/40">×</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">Sin partidos.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 text-sm text-gray-400 space-y-2">
        <div className="font-bold text-white">Guía rápida</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Pulsa <b>Activar</b> en cada partido que quieras grafismo. Cada partido recibe una URL de overlay exclusiva.</li>
          <li><b>Operar</b> abre la botonera (<code>/stream/[matchId]</code>) con atajos de teclado 1-6, Q, W, E, R y ESC para ocultar todo.</li>
          <li><b>URL vMix</b> es la URL de <code>/overlay/[matchId]</code>: añádela como entrada de navegador con fondo transparente.</li>
          <li>Activa la <b>automatización</b> desde el panel de operación para encadenar gráficos por estado del partido.</li>
        </ul>
      </div>
    </div>
  )
}
