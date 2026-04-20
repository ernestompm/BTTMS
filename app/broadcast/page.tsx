'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { CATEGORY_LABELS } from '@/types'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

export default function BroadcastPage() {
  const supabase = createClient()
  const [matches, setMatches] = useState<any[]>([])
  const [logs, setLogs] = useState<{ time: string; event: string; status: number | string }[]>([])
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null)
  const [endpoint, setEndpoint] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [saveResult, setSaveResult] = useState('')

  useEffect(() => {
    loadMatches()
    loadTournament()
    // Realtime: subscribe to matches changes
    const channel = supabase.channel('broadcast-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${TOURNAMENT_ID}` },
        () => loadMatches()
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadMatches() {
    const { data } = await supabase.from('matches')
      .select('id, status, category, round, broadcast_active, score, entry1:draw_entries!entry1_id(player1:players!player1_id(first_name,last_name)), entry2:draw_entries!entry2_id(player1:players!player1_id(first_name,last_name))')
      .eq('tournament_id', TOURNAMENT_ID)
      .in('status', ['in_progress', 'scheduled'])
      .order('scheduled_at')
    setMatches(data ?? [])
    const active = (data ?? []).find((m: any) => m.broadcast_active)
    if (active) setActiveMatchId(active.id)
  }

  async function loadTournament() {
    const { data } = await supabase.from('tournaments').select('broadcast_endpoint, broadcast_api_key').eq('id', TOURNAMENT_ID).single()
    if (data) { setEndpoint(data.broadcast_endpoint ?? ''); setApiKey(data.broadcast_api_key ?? '') }
  }

  async function toggleBroadcast(matchId: string, activate: boolean) {
    if (activate) {
      // Deactivate others, then activate chosen — two targeted updates
      await supabase.from('matches').update({ broadcast_active: false })
        .eq('tournament_id', TOURNAMENT_ID).neq('id', matchId)
      await supabase.from('matches').update({ broadcast_active: true }).eq('id', matchId)
      setActiveMatchId(matchId)
    } else {
      await supabase.from('matches').update({ broadcast_active: false }).eq('id', matchId)
      setActiveMatchId(null)
    }
    addLog(activate ? `Partido activado: ${matchId.slice(0, 8)}` : 'Broadcast desactivado', '—')
    loadMatches()
  }

  async function saveConfig() {
    setSavingConfig(true)
    setSaveResult('')
    const { error } = await supabase.from('tournaments').update({
      broadcast_endpoint: endpoint || null,
      broadcast_api_key: apiKey || null,
    }).eq('id', TOURNAMENT_ID)
    setSavingConfig(false)
    setSaveResult(error ? `✗ ${error.message}` : '✓ Guardado')
    if (!error) setTimeout(() => setSaveResult(''), 3000)
  }

  async function testEndpoint() {
    if (!endpoint) return
    setTesting(true)
    setTestResult('')
    try {
      const res = await fetch('/api/broadcast/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, api_key: apiKey }),
      })
      const data = await res.json()
      setTestResult(res.ok ? `✓ OK (${data.status ?? res.status})` : `✗ Error: ${data.error}`)
      addLog('Test endpoint', res.status)
    } catch (e) {
      setTestResult('✗ Error de conexión')
      addLog('Test endpoint', 'error')
    }
    setTesting(false)
  }

  function addLog(event: string, status: number | string) {
    const time = new Date().toLocaleTimeString('es-ES')
    setLogs((l) => [{ time, event, status }, ...l].slice(0, 50))
  }

  function teamName(entry: any): string {
    const p = entry?.player1
    return p ? `${p.first_name} ${p.last_name}` : '—'
  }

  return (
    <div className="min-h-screen bg-gray-950 p-5">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white font-score">TV Broadcast Dashboard</h1>
            <p className="text-gray-400 text-sm">Control de emisión en directo</p>
          </div>
          <a href="/dashboard" className="text-gray-500 hover:text-white text-sm">← Panel</a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Matches */}
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <h2 className="text-white font-semibold mb-4">Partidos disponibles</h2>
            <div className="space-y-2">
              {matches.map((m) => (
                <div key={m.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${m.broadcast_active ? 'border-brand-red bg-brand-red/10' : 'border-gray-800 bg-gray-800/30'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-2 mb-1">
                      <Badge variant={m.status === 'in_progress' ? 'danger' : 'outline'}>{m.status}</Badge>
                      <span className="text-gray-500 text-xs">{m.round}</span>
                    </div>
                    <p className="text-white text-sm truncate">{teamName(m.entry1)} vs {teamName(m.entry2)}</p>
                    {m.score && (
                      <p className="text-brand-red text-xs font-score font-bold">
                        {m.score.sets_won?.t1 ?? 0}-{m.score.sets_won?.t2 ?? 0}
                      </p>
                    )}
                  </div>
                  <button onClick={() => toggleBroadcast(m.id, !m.broadcast_active)}
                    className={`ml-3 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${m.broadcast_active ? 'bg-brand-red text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                    {m.broadcast_active ? '● EN AIRE' : 'ACTIVAR'}
                  </button>
                </div>
              ))}
              {matches.length === 0 && <p className="text-gray-600 text-sm">No hay partidos en juego</p>}
            </div>
          </div>

          {/* Config + logs */}
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
              <h2 className="text-white font-semibold mb-4">Configuración del endpoint</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">URL del endpoint</label>
                  <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="https://productora.tv/api/score"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">API Key</label>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <button onClick={saveConfig} disabled={savingConfig}
                    className="bg-brand-red hover:bg-red-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm transition-colors">
                    {savingConfig ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button onClick={testEndpoint} disabled={testing || !endpoint}
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm transition-colors">
                    {testing ? 'Probando...' : 'Probar conexión'}
                  </button>
                  {saveResult && (
                    <span className={`text-sm ${saveResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{saveResult}</span>
                  )}
                  {testResult && (
                    <span className={`text-sm ${testResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{testResult}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
              <h2 className="text-white font-semibold mb-3">Log de envíos</h2>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {logs.map((l, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="text-gray-700 font-mono w-16 flex-shrink-0">{l.time}</span>
                    <span className="flex-1">{l.event}</span>
                    <span className={`font-mono ${String(l.status).startsWith('2') ? 'text-green-500' : 'text-red-500'}`}>{l.status}</span>
                  </div>
                ))}
                {logs.length === 0 && <p className="text-gray-700 text-xs">Sin actividad</p>}
              </div>
            </div>
          </div>
        </div>

        {/* JSON Preview */}
        {activeMatchId && (
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <h2 className="text-white font-semibold mb-3">Preview JSON (último estado)</h2>
            <pre className="text-xs text-gray-400 overflow-x-auto bg-gray-950 rounded-xl p-4 max-h-60">
              {JSON.stringify(matches.find((m) => m.id === activeMatchId), null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
