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

// Detectar proveedor disponible (en orden de preferencia: gratis primero)
function pickProvider() {
  if (process.env.GOOGLE_AI_API_KEY) return { name: 'gemini' as const, key: process.env.GOOGLE_AI_API_KEY }
  if (process.env.GEMINI_API_KEY) return { name: 'gemini' as const, key: process.env.GEMINI_API_KEY }
  if (process.env.GROQ_API_KEY) return { name: 'groq' as const, key: process.env.GROQ_API_KEY }
  if (process.env.MISTRAL_API_KEY) return { name: 'mistral' as const, key: process.env.MISTRAL_API_KEY }
  if (process.env.ANTHROPIC_API_KEY) return { name: 'anthropic' as const, key: process.env.ANTHROPIC_API_KEY }
  return null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const provider = pickProvider()
  if (!provider) {
    return NextResponse.json({
      error: 'No hay ningún proveedor de IA configurado. En Vercel > Settings > Environment Variables, añade UNA de estas keys:\n' +
        '• GOOGLE_AI_API_KEY (GRATIS, 1500 req/día) — https://aistudio.google.com/apikey\n' +
        '• GROQ_API_KEY (GRATIS, 30 req/min) — https://console.groq.com/keys\n' +
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

  try {
    let text = ''

    if (provider.name === 'gemini') {
      // Google Gemini — gratis. Default 'gemini-2.0-flash' (modelo flash actual,
      // free tier generoso). Configurable via env GEMINI_MODEL.
      const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${provider.key}`
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { maxOutputTokens: 1500, temperature: 0.7 },
        }),
      })
      if (!r.ok) {
        const errText = await r.text()
        console.error('Gemini API error:', r.status, errText)
        return NextResponse.json({ error: `Error de Gemini (${r.status}): ${errText.slice(0, 200)}` }, { status: 502 })
      }
      const data = await r.json()
      text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    } else if (provider.name === 'groq') {
      // Groq — gratis 30 req/min, hostea Llama 3.3
      const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.key}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          temperature: 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })
      if (!r.ok) {
        const errText = await r.text()
        console.error('Groq API error:', r.status, errText)
        return NextResponse.json({ error: `Error de Groq (${r.status}): ${errText.slice(0, 200)}` }, { status: 502 })
      }
      const data = await r.json()
      text = data?.choices?.[0]?.message?.content ?? ''

    } else if (provider.name === 'mistral') {
      // Mistral — free tier limitado
      const model = process.env.MISTRAL_MODEL ?? 'mistral-small-latest'
      const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.key}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          temperature: 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })
      if (!r.ok) {
        const errText = await r.text()
        console.error('Mistral API error:', r.status, errText)
        return NextResponse.json({ error: `Error de Mistral (${r.status}): ${errText.slice(0, 200)}` }, { status: 502 })
      }
      const data = await r.json()
      text = data?.choices?.[0]?.message?.content ?? ''

    } else if (provider.name === 'anthropic') {
      // Claude — de pago, calidad alta
      const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest'
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': provider.key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          temperature: 0.7,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })
      if (!r.ok) {
        const errText = await r.text()
        console.error('Anthropic API error:', r.status, errText)
        return NextResponse.json({ error: `Error de Claude (${r.status}): ${errText.slice(0, 200)}` }, { status: 502 })
      }
      const data = await r.json()
      text = data?.content?.[0]?.text ?? ''
    }

    // Parsear "1. ...\n2. ...\n3. ..." → array de strings
    const suggestions = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => /^\d+[\.\)]\s*/.test(l))
      .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(Boolean)

    if (suggestions.length === 0) {
      return NextResponse.json({ suggestions: [text.trim()].filter(Boolean), provider: provider.name })
    }

    return NextResponse.json({ suggestions, provider: provider.name })
  } catch (e: any) {
    console.error('AI suggestions error:', e)
    return NextResponse.json({ error: e?.message ?? 'Error inesperado' }, { status: 500 })
  }
}
