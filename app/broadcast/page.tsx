'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

type HttpMethod = 'POST' | 'PUT'

export default function BroadcastPage() {
  const supabase = createClient()
  const [matches, setMatches] = useState<any[]>([])
  const [logs, setLogs] = useState<{ time: string; event: string; status: number | string }[]>([])
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null)
  const [endpoint, setEndpoint] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [method, setMethod] = useState<HttpMethod>('POST')
  const [headersText, setHeadersText] = useState('')
  const [headersError, setHeadersError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [saveResult, setSaveResult] = useState('')
  const [previewJson, setPreviewJson] = useState<string>('')
  const [loadingPreview, setLoadingPreview] = useState(false)

  useEffect(() => {
    loadMatches()
    loadTournament()
    const channel = supabase.channel('broadcast-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${TOURNAMENT_ID}` },
        () => loadMatches()
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (activeMatchId) loadPreview(activeMatchId)
    else setPreviewJson('')
  }, [activeMatchId])

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
    // Select * to tolerate installs where migration 013 hasn't been run yet
    const { data } = await supabase.from('tournaments')
      .select('*')
      .eq('id', TOURNAMENT_ID).single()
    if (data) {
      setEndpoint((data as any).broadcast_endpoint ?? '')
      setApiKey((data as any).broadcast_api_key ?? '')
      setMethod(((data as any).broadcast_method === 'PUT' ? 'PUT' : 'POST') as HttpMethod)
      const h = (data as any).broadcast_headers
      setHeadersText(h && typeof h === 'object' && Object.keys(h).length > 0 ? JSON.stringify(h, null, 2) : '')
    }
  }

  async function loadPreview(matchId: string) {
    setLoadingPreview(true)
    try {
      const res = await fetch(`/api/broadcast/export?tournament=${TOURNAMENT_ID}&match=${matchId}`)
      if (res.ok) { const data = await res.json(); setPreviewJson(JSON.stringify(data, null, 2)) }
      else setPreviewJson(`Error ${res.status}`)
    } catch { setPreviewJson('Error de red') }
    setLoadingPreview(false)
  }

  async function toggleBroadcast(matchId: string, activate: boolean) {
    if (activate) {
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

  function parseHeaders(): Record<string, string> | null {
    if (!headersText.trim()) return {}
    try {
      const parsed = JSON.parse(headersText)
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) throw new Error('Debe ser un objeto')
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v !== 'string') throw new Error(`Header "${k}" debe ser string`)
      }
      return parsed as Record<string, string>
    } catch (e: any) { setHeadersError(e?.message ?? 'JSON inválido'); return null }
  }

  async function saveConfig() {
    setHeadersError('')
    const parsedHeaders = parseHeaders()
    if (parsedHeaders === null) return
    setSavingConfig(true); setSaveResult('')
    const { error } = await supabase.from('tournaments').update({
      broadcast_endpoint: endpoint || null,
      broadcast_api_key: apiKey || null,
      broadcast_method: method,
      broadcast_headers: parsedHeaders,
    }).eq('id', TOURNAMENT_ID)
    setSavingConfig(false)
    if (error) {
      const missing = /broadcast_(method|headers)/.test(error.message)
      setSaveResult(missing
        ? '✗ Falta migración 013. Ejecuta supabase/migrations/013_broadcast_config.sql'
        : `✗ ${error.message}`)
    } else {
      setSaveResult('✓ Guardado')
      setTimeout(() => setSaveResult(''), 3000)
    }
  }

  async function testEndpoint() {
    if (!endpoint) return
    setHeadersError('')
    const parsedHeaders = parseHeaders()
    if (parsedHeaders === null) return
    setTesting(true); setTestResult('')
    try {
      const res = await fetch('/api/broadcast/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, api_key: apiKey, method, headers: parsedHeaders }),
      })
      const data = await res.json()
      setTestResult(res.ok ? `✓ ${method} OK (${data.status ?? res.status})` : `✗ Error: ${data.error}`)
      addLog(`Test ${method} endpoint`, res.status)
    } catch {
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
            <p className="text-gray-400 text-sm">Control de emisión en directo · payload v2.0</p>
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
                <div className="grid grid-cols-[110px_1fr] gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Método</label>
                    <select value={method} onChange={(e) => setMethod(e.target.value as HttpMethod)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red">
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">API Key (cabecera X-API-Key)</label>
                    <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Cabeceras extra (JSON — opcional, ej. <code className="text-gray-500">{`{"Authorization":"Bearer XYZ"}`}</code>)
                  </label>
                  <textarea value={headersText} onChange={(e) => { setHeadersText(e.target.value); setHeadersError('') }}
                    placeholder='{"Authorization":"Bearer ..."}'
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-brand-red" />
                  {headersError && <p className="text-red-400 text-xs mt-1">{headersError}</p>}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <button onClick={saveConfig} disabled={savingConfig}
                    className="bg-brand-red hover:bg-red-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm transition-colors">
                    {savingConfig ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button onClick={testEndpoint} disabled={testing || !endpoint}
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm transition-colors">
                    {testing ? 'Probando...' : `Probar ${method}`}
                  </button>
                  {saveResult && (
                    <span className={`text-sm ${saveResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{saveResult}</span>
                  )}
                  {testResult && (
                    <span className={`text-sm ${testResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{testResult}</span>
                  )}
                </div>
                <p className="text-gray-600 text-xs leading-relaxed pt-1">
                  El payload se envía con Content-Type <code className="text-gray-500">application/json</code>.
                  Se dispara automáticamente tras cada punto, sanción, retirada y fin del partido en emisión.
                </p>
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

        {/* JSON Preview — canonical broadcast payload (lo que realmente se envía) */}
        {activeMatchId && (
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">
                Preview JSON broadcast <span className="text-gray-500 text-xs font-normal">· payload que se envía a {method} {endpoint || '[sin endpoint]'}</span>
              </h2>
              <button onClick={() => activeMatchId && loadPreview(activeMatchId)}
                className="text-xs text-gray-400 hover:text-white">
                {loadingPreview ? 'Cargando...' : '↻ Refrescar'}
              </button>
            </div>
            <pre className="text-xs text-gray-300 overflow-x-auto bg-gray-950 rounded-xl p-4 max-h-[500px]">
              {previewJson || 'Selecciona un partido para ver el preview'}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
