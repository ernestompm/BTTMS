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
  analytical: 'Tono ANALÍTICO: máxima densidad de datos. Cifras concretas (% saque, % resto, aces, breaks, dobles faltas, conteos exactos). Comparativas numéricas entre los dos equipos.',
  colorful: 'Tono COLOR: anécdotas, atmósfera, picadillos divertidos. Lenguaje vivo y cálido — pero apoyado en datos concretos del jugador (edad, club, federación, palmarés con años) para no caer en lo genérico.',
  historical: 'Tono HISTÓRICO: trayectoria con AÑOS y nombres de torneos del palmarés, ranking RFET/ITF actual, posición en este torneo (ronda, partidos previos, set scores), y datos del club/federación.',
  tactical: 'Tono TÁCTICO: estrategia y lectura del juego, anclada en cifras del partido. Cita % al saque, breaks ganados/salvados, errores no forzados, winners. Identifica qué está funcionando y qué no.',
}

// Compactar un equipo a los datos esenciales para el comentario.
// Bio truncada a 200 chars (mucho menos input al modelo) y palmarés a top 3.
function compactTeam(entry: any) {
  if (!entry) return null
  return {
    seed: entry.seed,
    jugadores: [entry.player1, entry.player2].filter(Boolean).map((p: any) => {
      const edad = p.birth_date
        ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / (365.25*24*3600*1000))
        : (p.age_manual ?? null)
      const out: any = { nombre: `${p.first_name} ${p.last_name}`.trim() }
      if (p.nationality) out.pais = p.nationality
      if (edad) out.edad = edad
      if (p.ranking_rfet) out.rfet = p.ranking_rfet
      if (p.ranking_itf) out.itf = p.ranking_itf
      if (p.club) out.club = p.club
      if (p.laterality && p.laterality !== 'right') out.mano = p.laterality
      if (p.bio) out.bio = String(p.bio).slice(0, 200)
      if (Array.isArray(p.titles) && p.titles.length) {
        out.palmares = p.titles.slice(0, 3).map((t: any) => `${t.year}: ${t.name}`)
      }
      return out
    }),
  }
}

// Compactar stats — quitar campos que la IA casi nunca usa
function compactStats(s: any) {
  if (!s) return null
  const summarize = (t: any) => ({
    pts: t.total_points_won,
    aces: t.aces,
    df: t.double_faults,
    win: t.winners ?? 0,
    err: t.unforced_errors ?? 0,
    pct_saque: Math.round(t.serve_points_won_pct ?? 0),
    pct_resto: Math.round(t.return_points_won_pct ?? 0),
    breaks_ganados: t.break_points_won,
    breaks_oport: t.break_points_played_on_return ?? 0,
    breaks_salv: t.break_points_saved,
    breaks_face: t.break_points_faced ?? 0,
  })
  return { t1: summarize(s.t1 ?? {}), t2: summarize(s.t2 ?? {}) }
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
  const customPrompt = typeof body?.customPrompt === 'string' ? body.customPrompt.trim().slice(0, 500) : ''
  const previousMatches = Array.isArray(body?.previousMatches) ? body.previousMatches : []
  const pointLog = Array.isArray(body?.pointLog) ? body.pointLog : []

  // Refetch match con full detail para tener datos canonicos
  const service = createServiceSupabase()
  const { data: match } = await service.from('matches')
    .select(`*,
      court:courts(*),
      entry1:draw_entries!entry1_id(*, player1:players!player1_id(*), player2:players!player2_id(*)),
      entry2:draw_entries!entry2_id(*, player1:players!player1_id(*), player2:players!player2_id(*))
    `).eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  // Refetch tournament con datos completos (nombre, edicion, fechas, venue,
  // sponsors). Antes el contexto tenia "Beach Tennis Tournament" hardcodeado
  // — bug. Ahora la IA tiene acceso al nombre real del torneo, las fechas,
  // la sede, y el listado de patrocinadores con tier.
  const { data: tournament } = await service.from('tournaments')
    .select('*').eq('id', (match as any).tournament_id).single()

  // Construir el contexto del partido en formato compacto
  const m = match as any
  const t = tournament as any
  const ctx: any = {
    torneo: t ? {
      nombre: t.name,
      edicion: t.edition,
      fechas: t.start_date && t.end_date
        ? `${new Date(t.start_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })} – ${new Date(t.end_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`
        : null,
      desde: t.start_date,
      hasta: t.end_date,
    } : null,
    sede: t ? {
      nombre: t.venue_name,
      ciudad: t.venue_city,
      coords: (t.venue_lat && t.venue_lng) ? { lat: t.venue_lat, lng: t.venue_lng } : undefined,
    } : null,
    patrocinadores: Array.isArray(t?.sponsors) && t.sponsors.length > 0
      ? t.sponsors.map((s: any) => ({
          nombre: s.name,
          tier: s.tier || null,
          es_principal: !!s.is_main,
        }))
      : null,
    ronda: m.round,
    modalidad: m.match_type,
    categoria: m.category,
    estado: m.status,
    pista: m.court?.name,
    saque_actual: m.serving_team,
    duracion_min: m.started_at ? Math.floor((Date.now() - new Date(m.started_at).getTime()) / 60000) : null,
    // Jugadores compactos — solo los campos verdaderamente utiles para
    // generar comentarios. Bio truncada a 200 chars y palmarés a 3 títulos
    // recientes para no llenar el prompt con texto enorme.
    equipo1: compactTeam(m.entry1),
    equipo2: compactTeam(m.entry2),
    // Solo sets jugados + sets ganados (no toda la struct interna del score)
    score: m.score ? {
      sets_jugados: m.score.sets,
      sets_ganados: m.score.sets_won,
      set_actual: m.score.current_set,
      juego_actual: m.score.current_game,
      tiebreak_activo: m.score.tiebreak_active || m.score.super_tiebreak_active,
      ganador_partido: m.score.winner_team,
    } : null,
    // Stats simplificadas — solo los campos clave que la IA suele usar
    stats: m.stats ? compactStats(m.stats) : null,
    // Solo los 8 ultimos puntos (suficiente para hablar del momento)
    ultimos_puntos: pointLog.slice(0, 8).map((p: any) => ({
      seq: p.sequence,
      ganador: p.winner_team,
      tipo: p.point_type,
    })),
    // Solo los 5 ultimos partidos del torneo
    historial_torneo: previousMatches.slice(0, 5).map((pm: any) => ({
      ronda: pm.round,
      ganador: pm.score?.winner_team,
      sets: pm.score?.sets,
    })),
  }
  // Eliminar campos null/undefined del contexto top-level para limpiar JSON
  Object.keys(ctx).forEach(k => { if (ctx[k] == null) delete ctx[k] })

  // Si el usuario ha pedido un enfoque concreto ("habla de X", "cuéntame
  // sobre Y") incorporamos ese hint a las reglas. La estructura sigue
  // siendo 5 frases numeradas para la pantalla, solo cambia el tema.
  const focusBlock = customPrompt
    ? `\n- ENFOQUE PEDIDO POR EL COMENTARISTA: "${customPrompt}". Las 5 sugerencias deben girar alrededor de ESTE tema concreto. Si los datos del contexto no soportan el tema, di una variante que se aproxime sin inventar.`
    : ''

  const systemPrompt = `Eres un comentarista experto en tenis playa retransmitiendo en TV. Tu trabajo es ofrecer al comentarista del partido 5 frases CORTAS (entre 1 y 3 frases cada una, máximo 240 caracteres por sugerencia) que pueda decir EN VOZ ALTA durante la retransmisión.

REGLAS ESTRICTAS:
- Español de España, registro periodístico deportivo natural.
- ${TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.analytical}${focusBlock}
- Cada sugerencia es independiente y autónoma — el comentarista la escogerá y soltará en directo.
- NUNCA inventes datos. Si un dato no aparece en el contexto, NO lo digas.
- Usa los nombres reales de los jugadores tal como aparecen en el contexto.
- No uses emojis, ni asteriscos, ni markdown.
- Cada sugerencia debe poder leerse en menos de 8 segundos.
- Devuelve EXACTAMENTE 5 sugerencias, una por línea, NUMERADAS (1. 2. 3. 4. 5.).
- No añadas introducción ni cierre, solo las 5 frases numeradas.

CALIDAD DE LAS SUGERENCIAS (CRÍTICO):
- USA NÚMEROS CONCRETOS del contexto siempre que puedas: aces, dobles faltas, % saque, % resto, breaks ganados/oportunidades, sets ganados, ranking, edad, palmarés con años, etc.
- Cita estadísticas específicas, no afirmaciones genéricas. Si una stat es relevante en el contexto, MENCIÓNALA con su valor exacto.
- Datos que casi siempre son útiles: ranking RFET/ITF, aces acumulados, % puntos al saque, breaks, palmarés con año, edad de los jugadores, partidos previos del torneo, club o federación.
- Cuando hables de un jugador, intenta combinar 2-3 datos suyos para dar contexto rico.

INFORMACIÓN DEL TORNEO Y SEDE (úsala cuando aporte contexto):
- El campo "torneo.nombre" contiene el nombre EXACTO del campeonato. NUNCA inventes nombres de torneos.
- "torneo.edicion" es el número de edición. Cítalo cuando sea relevante (ej. "XXIV Campeonato de España...").
- "torneo.fechas" es el rango de fechas oficiales (ej. "12 de junio – 18 de junio de 2026").
- "sede.nombre" y "sede.ciudad" son los datos REALES del lugar. Cítalos para introducir el partido o entre puntos.
- "patrocinadores" lista a los sponsors del torneo. El campo "es_principal: true" identifica al patrocinador principal. Puedes mencionarlos en sugerencias tipo "presented by", "este torneo cuenta con el respaldo de…" o como crédito puntual.

EJEMPLOS de buena vs mala calidad:

❌ MAL (genérico, sin datos):
   "Carlos está jugando muy bien al saque en este partido"
   "Pareja española con experiencia en el circuito"
   "Han tenido un set complicado pero remontaron"

✅ BIEN (con datos concretos):
   "Carlos García, número 12 del ranking RFET con 28 años, ha clavado 6 aces y un 78% al saque en este primer set"
   "García y Ruiz, pareja del CT Marbella, llegan a estos cuartos tras eliminar a los terceros cabezas de serie con un 6-3 6-4"
   "Cámara y Castaño han salvado 3 de 5 break points, pero perdieron el set 6-4 con dos dobles faltas decisivas"

✅ EJEMPLOS con torneo / sede / sponsors:
   "Estamos en la pista central del Club de Mar de Las Palmas, sede oficial del XXIV Campeonato de España de Tenis Playa, del 12 al 18 de junio."
   "El torneo, patrocinado oficialmente por Atlantic Air, encara la jornada decisiva tras tres días de competición intensa."
   "García y Ruiz buscan revalidar el título conquistado el año pasado en este mismo Club de Mar."

Cuando los datos lo permitan, prefiere SIEMPRE el formato "BIEN" con cifras concretas. Si el comentarista pide datos del torneo, sede o sponsors, úsalos sin reservas.`

  // JSON sin pretty-print para ahorrar tokens
  const ctxJson = JSON.stringify(ctx)
  const userPrompt = customPrompt
    ? `Contexto del partido (JSON):\n${ctxJson}\n\nEnfoque del comentarista: "${customPrompt}"\n\nGenera 5 sugerencias en español sobre ese enfoque, numeradas del 1 al 5.`
    : `Contexto del partido (datos en JSON):\n${ctxJson}\n\nGenera ahora las 5 sugerencias en español, numeradas del 1 al 5.`

  // Log tamaño aproximado del prompt para debug — visible en logs de Vercel
  const approxTokens = Math.round((systemPrompt.length + userPrompt.length) / 4)
  console.log(`[AI suggestions] prompt size ~${approxTokens} tokens (${systemPrompt.length + userPrompt.length} chars)`)

  // Llamar a un proveedor concreto. Devuelve { ok, text, status, errText }.
  async function callProvider(p: Provider): Promise<{ ok: boolean, text?: string, status?: number, errText?: string }> {
    if (p.name === 'gemini') {
      // Default 'gemini-3.1-flash-lite-preview' — multimodal mas economico
      // y rapido de Google, gratis en free tier. 1M tokens input, 65K output.
      // Configurable via env GEMINI_MODEL si quieres usar otro
      // (gemini-2.5-flash, gemini-2.0-flash, etc.).
      const model = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite-preview'
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
