'use client'
// ============================================================================
// CommentatorAIPanel — sugerencias de comentario asistidas por IA
// ============================================================================
// Manda el contexto del partido (score, stats, last points, history) a un
// endpoint del servidor que llama a Claude. Devuelve 5 sugerencias de
// comentario en español listas para soltar en directo.
// ============================================================================

import { useState } from 'react'
import type { Tournament } from '@/types'

interface Props {
  match: any
  tournament: Tournament
  previousMatches: any[]
  pointLog: any[]
}

const PROVIDER_LABEL: Record<string, string> = {
  gemini: '✨ Gemini · gratis',
  groq: '⚡ Groq · gratis',
  mistral: '🌬 Mistral · gratis',
  anthropic: '💎 Claude · de pago',
}

const QUICK_PROMPTS = [
  'Cuéntame sobre los jugadores',
  'Comenta el cuadro y los próximos rivales',
  'Habla de las estadísticas más interesantes',
  'Anécdotas o curiosidades del torneo',
  'Análisis táctico de los últimos puntos',
  'Datos sobre rankings y palmarés',
]

export function CommentatorAIPanel({ match, tournament, previousMatches, pointLog }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [provider, setProvider] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tone, setTone] = useState<'analytical' | 'colorful' | 'historical' | 'tactical'>('analytical')
  const [customPrompt, setCustomPrompt] = useState('')
  const [diag, setDiag] = useState<any>(null)
  const [diagLoading, setDiagLoading] = useState(false)

  async function generate() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/commentator/${match.id}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tone,
          customPrompt: customPrompt.trim() || undefined,
          previousMatches,
          pointLog: pointLog.slice(0, 20),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
      setSuggestions(data.suggestions ?? [])
      setProvider(data.provider ?? null)
    } catch (e: any) {
      setError(e.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  async function runDiagnostics() {
    setDiagLoading(true); setDiag(null)
    try {
      const r = await fetch('/api/ai-status')
      const data = await r.json()
      setDiag(data)
    } catch (e: any) {
      setDiag({ error: e?.message ?? String(e) })
    } finally {
      setDiagLoading(false)
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div className="bg-gradient-to-br from-purple-950/30 to-cyan-950/20 rounded-2xl border border-purple-900/40 overflow-hidden">
      <div className="px-5 py-3 border-b border-purple-900/40 flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          🤖 Sugerencias de comentario
          <span className="text-[10px] font-normal text-purple-300/70 uppercase tracking-widest">
            {provider ? `IA · ${PROVIDER_LABEL[provider] ?? provider}` : 'IA'}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as any)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500">
            <option value="analytical">📊 Analítico (datos y stats)</option>
            <option value="colorful">🎨 Color (anécdotas y atmósfera)</option>
            <option value="historical">📜 Histórico (palmarés y trayectoria)</option>
            <option value="tactical">⚙️ Táctico (estrategia y juego)</option>
          </select>
          <button
            onClick={generate}
            disabled={loading}
            className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-lg text-xs transition-colors">
            {loading ? 'Generando…' : suggestions.length > 0 ? '↻ Regenerar' : '✨ Generar'}
          </button>
        </div>
      </div>

      {/* Custom prompt input */}
      <div className="px-5 pt-4 pb-2 border-b border-purple-900/30 space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-purple-300/80">
          ¿Sobre qué quieres que enfoque las sugerencias? <span className="text-gray-500 font-normal normal-case tracking-normal">(opcional)</span>
        </label>
        <div className="flex gap-2 items-stretch">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                if (!loading) generate()
              }
            }}
            placeholder="Ej: cuéntame sobre el cuadro · datos curiosos del torneo · habla del saque de Carlos · qué está fallando en el resto del equipo 2…"
            rows={2}
            className="flex-1 bg-gray-900/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500"
          />
          {customPrompt && (
            <button
              onClick={() => setCustomPrompt('')}
              title="Vaciar"
              className="text-gray-500 hover:text-white px-2 self-start py-1 text-xs">
              ✕
            </button>
          )}
        </div>
        {/* Quick chip suggestions */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => setCustomPrompt(p)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${customPrompt === p
                ? 'bg-purple-700 border-purple-500 text-white'
                : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:text-white hover:border-purple-700'}`}>
              {p}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-600">
          💡 Tip: <kbd className="bg-gray-800 px-1 rounded text-gray-400">Ctrl/Cmd + Enter</kbd> en el cuadro de texto para generar
        </p>
      </div>

      <div className="p-5">
        {error && (
          <div className="mb-3 bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm whitespace-pre-line">
            <div>✗ {error}</div>
            <button onClick={runDiagnostics}
              className="mt-3 text-xs underline text-red-200 hover:text-white">
              {diagLoading ? 'Diagnosticando…' : 'Ver diagnóstico de configuración →'}
            </button>
          </div>
        )}

        {diag && (
          <div className="mb-3 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-xs space-y-2 font-mono">
            <div className="text-purple-300 font-bold mb-1">🔧 DIAGNÓSTICO IA</div>
            <div>
              <span className="text-gray-500">Variables detectadas:</span>
              <div className="mt-1 space-y-0.5 pl-2">
                {Object.entries(diag.envVarsDetected ?? {}).map(([k, v]) => (
                  <div key={k}>
                    <span className={v ? 'text-green-400' : 'text-gray-600'}>{v ? '✓' : '✗'}</span>{' '}
                    <span className={v ? 'text-white' : 'text-gray-600'}>{k}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Proveedor activo:</span>{' '}
              <span className="text-white font-bold">{diag.activeProvider ?? 'NINGUNO'}</span>
            </div>
            {diag.pingResult && (
              <div>
                <span className="text-gray-500">Test ping:</span>
                <div className={`mt-1 pl-2 ${diag.pingResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {diag.pingResult.ok
                    ? `✓ Status ${diag.pingResult.status} · ${diag.pingResult.body}`
                    : `✗ Status ${diag.pingResult.status} · ${diag.pingResult.body ?? diag.pingResult.error}`}
                  {diag.pingResult.model && <div className="text-gray-500 mt-1">Modelo: {diag.pingResult.model}</div>}
                </div>
              </div>
            )}
            <div className="text-gray-500 italic pt-2 border-t border-gray-800">
              💡 {diag.hint}
            </div>
            <div className="text-yellow-300 text-[11px] pt-1">
              ⚠️ Recuerda: tras añadir/cambiar una env var en Vercel TIENES QUE HACER REDEPLOY del último deployment para que aplique.
            </div>
          </div>
        )}

        {suggestions.length === 0 && !error && !loading && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Pulsa <strong className="text-purple-300">✨ Generar</strong> para que la IA te dé 5 frases listas para comentar el partido en directo.
            </p>
            <button onClick={runDiagnostics}
              className="text-xs text-gray-500 hover:text-purple-300 underline">
              {diagLoading ? 'Diagnosticando…' : '🔧 Ver diagnóstico de IA (qué key está activa)'}
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 text-sm text-purple-300">
            <span className="w-4 h-4 border-2 border-purple-300 border-t-transparent rounded-full animate-spin"/>
            Analizando partido y generando sugerencias…
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="group bg-gray-900/60 border border-gray-800 rounded-xl p-3 flex gap-3 items-start hover:border-purple-700 transition-colors">
                <span className="flex-none w-7 h-7 rounded-full bg-purple-900/50 text-purple-300 grid place-items-center text-xs font-bold">{i+1}</span>
                <p className="text-sm text-gray-200 flex-1 leading-relaxed">{s}</p>
                <button
                  onClick={() => copy(s)}
                  className="flex-none opacity-0 group-hover:opacity-100 text-xs text-gray-500 hover:text-white px-2 py-1 transition-all"
                  title="Copiar al portapapeles">
                  📋
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
