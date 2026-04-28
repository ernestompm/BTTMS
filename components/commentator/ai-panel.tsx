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

export function CommentatorAIPanel({ match, tournament, previousMatches, pointLog }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [provider, setProvider] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tone, setTone] = useState<'analytical' | 'colorful' | 'historical' | 'tactical'>('analytical')

  async function generate() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/commentator/${match.id}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone, previousMatches, pointLog: pointLog.slice(0, 20) }),
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

      <div className="p-5">
        {error && (
          <div className="mb-3 bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm whitespace-pre-line">
            ✗ {error}
          </div>
        )}

        {suggestions.length === 0 && !error && !loading && (
          <p className="text-sm text-gray-400">
            Pulsa <strong className="text-purple-300">✨ Generar</strong> para que la IA te dé 5 frases listas para comentar el partido en directo. La IA analiza el marcador, las stats acumuladas, el historial reciente y los últimos puntos jugados.
          </p>
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
