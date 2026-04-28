// ============================================================================
// POST /api/commentator/[matchId]/suggestions
// ============================================================================
// Genera 5 sugerencias de comentario para el partido actual usando Claude.
// Auth: cualquier usuario logado (los comentaristas tambien).
//
// Request body:
//   { tone: 'analytical' | 'colorful' | 'historical' | 'tactical',
//     previousMatches: [...], pointLog: [...] }
//
// Response:
//   { suggestions: string[] }
//
// Requiere ANTHROPIC_API_KEY en env. Sin la key devuelve error 503.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest'
const API_URL = 'https://api.anthropic.com/v1/messages'

const TONE_INSTRUCTIONS: Record<string, string> = {
  analytical: 'Tono ANALÍTICO: bésate en porcentajes, conteos, eficacia. Cita datos concretos del partido.',
  colorful: 'Tono COLOR: anécdotas, atmósfera, picadillos divertidos. Lenguaje vivo y cálido.',
  historical: 'Tono HISTÓRICO: trayectoria de los jugadores, palmarés, antecedentes en este torneo.',
  tactical: 'Tono TÁCTICO: estrategia, lectura del juego, fortalezas/debilidades observadas en los puntos.',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      error: 'ANTHROPIC_API_KEY no está configurada en el entorno. Ve a Vercel > Settings > Environment Variables y añade la clave para activar las sugerencias de IA.',
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
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!r.ok) {
      const errText = await r.text()
      console.error('Anthropic API error:', r.status, errText)
      return NextResponse.json({
        error: `Error de la API de Claude (${r.status}): ${errText.slice(0, 200)}`,
      }, { status: 502 })
    }

    const data = await r.json()
    const text = (data?.content?.[0]?.text ?? '') as string

    // Parsear "1. ...\n2. ...\n3. ..." → array de strings
    const suggestions = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => /^\d+[\.\)]\s*/.test(l))
      .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(Boolean)

    if (suggestions.length === 0) {
      // Fallback: devolver el texto entero como una sola sugerencia
      return NextResponse.json({ suggestions: [text.trim()].filter(Boolean) })
    }

    return NextResponse.json({ suggestions })
  } catch (e: any) {
    console.error('AI suggestions error:', e)
    return NextResponse.json({ error: e?.message ?? 'Error inesperado' }, { status: 500 })
  }
}
