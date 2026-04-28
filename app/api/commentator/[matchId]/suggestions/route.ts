// ============================================================================
// POST /api/commentator/[matchId]/suggestions
// ============================================================================
// Genera 5 sugerencias de comentario usando un proveedor de IA. Soporta:
//   - Google Gemini (GRATIS, 1500 req/dia) — set GOOGLE_AI_API_KEY
//   - Groq (GRATIS, 30 req/min, Llama 3.3) — set GROQ_API_KEY
//   - Mistral (GRATIS limitado) — set MISTRAL_API_KEY
//   - Anthropic Claude (de pago, calidad alta) — set ANTHROPIC_API_KEY
//
// Prioridad: la primera key que encuentre. Asi puedes empezar gratis y
// pasarte a Claude cuando quieras. Sin ninguna key → error 503 con
// instrucciones claras.
//
// Request body:
//   { tone, previousMatches, pointLog }
// Response:
//   { suggestions: string[], provider: 'gemini'|'groq'|'mistral'|'anthropic' }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

const TONE_INSTRUCTIONS: Record<string, string> = {
  analytical: 'Tono ANALÍTICO: bésate en porcentajes, conteos, eficacia. Cita datos concretos del partido.',
  colorful: 'Tono COLOR: anécdotas, atmósfera, picadillos divertidos. Lenguaje vivo y cálido.',
  historical: 'Tono HISTÓRICO: trayectoria de los jugadores, palmarés, antecedentes en este torneo.',
  tactical: 'Tono TÁCTICO: estrategia, lectura del juego, fortalezas/debilidades observadas en los puntos.',
}

// Lista de TODOS los proveedores configurados (no solo el primero) — asi
// podemos hacer fallback si uno da 429 / 5xx
type ProviderName = 'gemini' | 'groq' | 'mistral' | 'anthropic'
type Provider = { name: ProviderName, key: string }
function listProviders(): Provider[] {
  const out: Provider[] = []
  const gem = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY
  if (gem) out.push({ name: 'gemini', key: gem })
  if (process.env.GROQ_API_KEY) out.push({ name: 'groq', key: process.env.GROQ_API_KEY })
  if (process.env.MISTRAL_API_KEY) out.push({ name: 'mistral', key: process.env.MISTRAL_API_KEY })
  if (process.env.ANTHROPIC_API_KEY) out.push({ name: 'anthropic', key: process.env.ANTHROPIC_API_KEY })
  return out
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const providers = listProviders()
  if (providers.length === 0) {
    return NextResponse.json({
      error: 'No hay ningún proveedor de IA configurado. En Vercel > Settings > Environment Variables, añade UNA de estas keys (recomendada Groq, gratis y rápida):\n' +
        '• GROQ_API_KEY (GRATIS, 30 req/min, modelo Llama 3.3 70B) — https://console.groq.com/keys\n' +
        '• GOOGLE_AI_API_KEY (GRATIS pero solo 15 req/min) — https://aistudio.google.com/apikey\n' +
        '• MISTRAL_API_KEY (gratis limitado) — https://console.mistral.ai/api-keys\n' +
        '• ANTHROPIC_API_KEY (de pago, calidad alta) — https://console.anthropic.com',
    }, { status: 503 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const tone = (body?.tone ?? 'analytical') as keyof typeof TONE_INSTRUCTIONS
  const previousMatches = Array.isArray(body?.previousMatches) ? body.previousMatches : []
  const pointLog = Array.isArray(body?.pointLog) ? body.pointLog : []

  // Refetch match con full detail para tener datos canonicos
  const service = createServiceSupabase()
  const { data: match } = await service.from('matches')
    .select(`*,
      court:courts(name),
      entry1:draw_entries!entry1_id(*, player1:players!player1_id(*), player2:players!player2_id(*)),
      entry2:draw_entries!entry2_id(*, player1:players!player1_id(*), player2:players!player2_id(*))
    `).eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  // Construir el contexto del partido en formato compacto
  const m = match as any
  const ctx = {
    torneo: 'Beach Tennis Tournament',
    ronda: m.round,
    modalidad: m.match_type,
    categoria: m.category,
    estado: m.status,
    pista: m.court?.name,
    saque_actual: m.serving_team,
    duracion_min: m.started_at ? Math.floor((Date.now() - new Date(m.started_at).getTime()) / 60000) : null,
    equipo1: {
      jugadores: [m.entry1?.player1, m.entry1?.player2].filter(Boolean).map((p: any) => ({
        nombre: `${p.first_name} ${p.last_name}`,
        nacionalidad: p.nationality,
        edad: p.birth_date ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / (365.25*24*3600*1000)) : null,
        ranking_rfet: p.ranking_rfet,
        ranking_itf: p.ranking_itf,
        club: p.club,
        lateralidad: p.laterality,
        bio: p.bio,
        palmares: p.titles,
      })),
      seed: m.entry1?.seed,
    },
    equipo2: {
      jugadores: [m.entry2?.player1, m.entry2?.player2].filter(Boolean).map((p: any) => ({
        nombre: `${p.first_name} ${p.last_name}`,
        nacionalidad: p.nationality,
        edad: p.birth_date ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / (365.25*24*3600*1000)) : null,
        ranking_rfet: p.ranking_rfet,
        ranking_itf: p.ranking_itf,
        club: p.club,
        lateralidad: p.laterality,
        bio: p.bio,
        palmares: p.titles,
      })),
      seed: m.entry2?.seed,
    },
    score: m.score,
    stats: m.stats,
    ultimos_puntos: pointLog.slice(0, 15).map((p: any) => ({
      seq: p.sequence,
      ganador_equipo: p.winner_team,
      tipo_punto: p.point_type,
      direccion: p.shot_direction,
    })),
    historial_torneo: previousMatches.slice(0, 10).map((pm: any) => ({
      ronda: pm.round,
      ganador: pm.score?.winner_team,
      sets: pm.score?.sets,
      equipo1: pm.entry1 ? [pm.entry1.player1, pm.entry1.player2].filter(Boolean).map((p:any) => p.last_name).join(' / ') : null,
      equipo2: pm.entry2 ? [pm.entry2.player1, pm.entry2.player2].filter(Boolean).map((p:any) => p.last_name).join(' / ') : null,
    })),
  }

  const systemPrompt = `Eres un comentarista experto en tenis playa retransmitiendo en TV. Tu trabajo es ofrecer al comentarista del partido 5 frases CORTAS (entre 1 y 3 frases cada una, máximo 240 caracteres por sugerencia) que pueda decir EN VOZ ALTA durante la retransmisión.

REGLAS ESTRICTAS:
- Español de España, registro periodístico deportivo natural.
- ${TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.analytical}
- Cada sugerencia es independiente y autónoma — el comentarista la escogerá y soltará en directo.
- NUNCA inventes datos. Si un dato no aparece en el contexto, NO lo digas.
- Usa los nombres reales de los jugadores tal como aparecen en el contexto.
- No uses emojis, ni asteriscos, ni markdown.
- Cada sugerencia debe poder leerse en menos de 8 segundos.
- Devuelve EXACTAMENTE 5 sugerencias, una por línea, NUMERADAS (1. 2. 3. 4. 5.).
- No añadas introducción ni cierre, solo las 5 frases numeradas.`

  const userPrompt = `Contexto del partido (datos en JSON):
\`\`\`json
${JSON.stringify(ctx, null, 2)}
\`\`\`

Genera ahora las 5 sugerencias en español, numeradas del 1 al 5.`

  // Llamar a un proveedor concreto. Devuelve { ok, text, status, errText }.
  async function callProvider(p: Provider): Promise<{ ok: boolean, text?: string, status?: number, errText?: string }> {
    if (p.name === 'gemini') {
      const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${p.key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { maxOutputTokens: 1500, temperature: 0.7 },
        }),
      })
      if (!r.ok) return { ok: false, status: r.status, errText: await r.text() }
      const data = await r.json()
      return { ok: true, text: data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '' }
    }
    if (p.name === 'groq') {
      const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.key}` },
        body: JSON.stringify({
          model, max_tokens: 1500, temperature: 0.7,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        }),
      })
      if (!r.ok) return { ok: false, status: r.status, errText: await r.text() }
      const data = await r.json()
      return { ok: true, text: data?.choices?.[0]?.message?.content ?? '' }
    }
    if (p.name === 'mistral') {
      const model = process.env.MISTRAL_MODEL ?? 'mistral-small-latest'
      const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.key}` },
        body: JSON.stringify({
          model, max_tokens: 1500, temperature: 0.7,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        }),
      })
      if (!r.ok) return { ok: false, status: r.status, errText: await r.text() }
      const data = await r.json()
      return { ok: true, text: data?.choices?.[0]?.message?.content ?? '' }
    }
    if (p.name === 'anthropic') {
      const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest'
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', 'x-api-key': p.key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model, max_tokens: 1500, temperature: 0.7,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })
      if (!r.ok) return { ok: false, status: r.status, errText: await r.text() }
      const data = await r.json()
      return { ok: true, text: data?.content?.[0]?.text ?? '' }
    }
    return { ok: false, errText: 'unknown provider' }
  }

  try {
    let text = ''
    let usedProvider: ProviderName | null = null
    const errors: Array<{ provider: ProviderName, status?: number, message: string }> = []

    // Intentar cada proveedor por orden. Fallback ante 429 (cuota), 5xx (servidor caido)
    // o errores transitorios de fetch. Para 4xx que no es 429 (auth invalida, etc)
    // seguimos al siguiente proveedor tambien — la idea es: pruebes lo que pruebes,
    // si tienes >=2 keys configuradas, una de las dos te debe funcionar.
    for (const p of providers) {
      try {
        const result = await callProvider(p)
        if (result.ok && result.text) {
          text = result.text
          usedProvider = p.name
          break
        }
        const msg = result.errText?.slice(0, 200) ?? 'unknown'
        errors.push({ provider: p.name, status: result.status, message: msg })
        console.error(`[${p.name}] error ${result.status}:`, msg)
      } catch (e: any) {
        errors.push({ provider: p.name, message: e?.message ?? String(e) })
        console.error(`[${p.name}] fetch fail:`, e)
      }
    }

    if (!usedProvider) {
      // Todos fallaron — devolver un mensaje compuesto con los errores de cada uno
      const summary = errors.map(e => `• ${e.provider}${e.status ? ` (${e.status})` : ''}: ${e.message}`).join('\n')
      const tip = errors.some(e => e.status === 429)
        ? '\n\n💡 Has llegado al límite de cuota. Recomendación: añade GROQ_API_KEY (https://console.groq.com/keys) — gratis con 30 req/min, mucho más generoso que Gemini.'
        : ''
      return NextResponse.json({
        error: `Todos los proveedores fallaron:\n${summary}${tip}`,
      }, { status: 502 })
    }

    // Parsear "1. ...\n2. ...\n3. ..." → array de strings
    const suggestions = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => /^\d+[\.\)]\s*/.test(l))
      .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(Boolean)

    if (suggestions.length === 0) {
      return NextResponse.json({
        suggestions: [text.trim()].filter(Boolean),
        provider: usedProvider,
        fallbackErrors: errors.length ? errors : undefined,
      })
    }

    return NextResponse.json({
      suggestions,
      provider: usedProvider,
      fallbackErrors: errors.length ? errors : undefined,
    })
  } catch (e: any) {
    console.error('AI suggestions error:', e)
    return NextResponse.json({ error: e?.message ?? 'Error inesperado' }, { status: 500 })
  }
}
