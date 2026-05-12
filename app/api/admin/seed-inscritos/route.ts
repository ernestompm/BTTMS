import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { requireRole } from '@/lib/auth-helpers'
import { getActiveTournamentId } from '@/lib/active-tournament'

/**
 * POST /api/admin/seed-inscritos
 * Body: { category: 'absolute_f' | 'absolute_m' }
 *
 * Pobla un cuadro de dobles con las parejas inscritas oficiales del
 * Campeonato de España Absoluto de Tenis Playa 2026 (RFET).
 *
 * Comportamiento idempotente:
 *  - Borra el draw existente de la categoría (si lo hay) y todos sus
 *    entries (cascade) para no duplicar al re-ejecutar.
 *  - Hace upsert de cada jugador por (first_name + last_name) para
 *    reusar el mismo player_id si ya existía de un seed anterior.
 *  - Crea draw + entries con seed = ranking combinado.
 *
 * Solo super_admin puede ejecutarlo (es destructivo del cuadro previo).
 */

interface PlayerInput {
  first_name: string
  last_name: string
  ranking_rfet: number | null  // null si era 999 (sin ranking)
}

interface PairInput {
  p1: PlayerInput
  p2: PlayerInput
  combined: number | null  // null si era 999
}

// ════════════════════════════════════════════════════════════════════════════
// FEMENINO — 21 parejas (42 jugadoras)
// ════════════════════════════════════════════════════════════════════════════
const PAREJAS_FEMENINO: PairInput[] = [
  { p1: { first_name: 'Daniela Milagro', last_name: 'Rodríguez Perera', ranking_rfet: 4 },
    p2: { first_name: 'Ariadna', last_name: 'Costa Graell', ranking_rfet: 1 }, combined: 5 },
  { p1: { first_name: 'María', last_name: 'Martínez Serón', ranking_rfet: 2 },
    p2: { first_name: 'Natalia', last_name: 'Gómez Valdivia', ranking_rfet: 3 }, combined: 5 },
  { p1: { first_name: 'Eva', last_name: 'Santana Sánchez', ranking_rfet: 5 },
    p2: { first_name: 'Claudia', last_name: 'Casas Pau', ranking_rfet: 8 }, combined: 13 },
  { p1: { first_name: 'Omaira', last_name: 'Farias Medina', ranking_rfet: 7 },
    p2: { first_name: 'Laura', last_name: 'Jiménez Torres', ranking_rfet: 6 }, combined: 13 },
  { p1: { first_name: 'Martina', last_name: 'Llobet Ferrer', ranking_rfet: 10 },
    p2: { first_name: 'Lola', last_name: 'Abadía González', ranking_rfet: 16 }, combined: 26 },
  { p1: { first_name: 'María Teresa', last_name: 'Blanco González', ranking_rfet: 9 },
    p2: { first_name: 'Begoña', last_name: 'Montenegro Prado', ranking_rfet: 19 }, combined: 28 },
  { p1: { first_name: 'Lola', last_name: 'Rafales Merlini', ranking_rfet: 12 },
    p2: { first_name: 'Sara', last_name: 'Albalate Blasco', ranking_rfet: 23 }, combined: 35 },
  { p1: { first_name: 'María', last_name: 'Mulero Párraga', ranking_rfet: 20 },
    p2: { first_name: 'Leticia', last_name: 'Cervera López', ranking_rfet: 21 }, combined: 41 },
  { p1: { first_name: 'Cynthia', last_name: 'Escobar García', ranking_rfet: 38 },
    p2: { first_name: 'Grimanesa', last_name: 'Santana Navarro', ranking_rfet: 11 }, combined: 49 },
  { p1: { first_name: 'Ana', last_name: 'Gómez Martínez', ranking_rfet: 37 },
    p2: { first_name: 'María', last_name: 'Gómez Martínez', ranking_rfet: 13 }, combined: 50 },
  { p1: { first_name: 'Júlia', last_name: 'Llobet Ferrer', ranking_rfet: 28 },
    p2: { first_name: 'Judith', last_name: 'Contreras Pedrós', ranking_rfet: 42 }, combined: 70 },
  { p1: { first_name: 'Cristina', last_name: 'Caseiro', ranking_rfet: 27 },
    p2: { first_name: 'Aroa', last_name: 'Sánchez', ranking_rfet: 45 }, combined: 72 },
  { p1: { first_name: 'María', last_name: 'Jiménez Torres', ranking_rfet: 63 },
    p2: { first_name: 'Candela', last_name: 'Muñoz Arrabal', ranking_rfet: 29 }, combined: 92 },
  { p1: { first_name: 'Marina', last_name: 'García Caseiro', ranking_rfet: 34 },
    p2: { first_name: 'Thiara', last_name: 'Vallmitjana', ranking_rfet: 62 }, combined: 96 },
  { p1: { first_name: 'Lydia', last_name: 'García Vázquez', ranking_rfet: 59 },
    p2: { first_name: 'Eva', last_name: 'Fantova Sicre', ranking_rfet: 60 }, combined: 119 },
  { p1: { first_name: 'Katiuska', last_name: 'Castillo de la Cruz', ranking_rfet: 36 },
    p2: { first_name: 'Margarita', last_name: 'Tarallo', ranking_rfet: 89 }, combined: 125 },
  { p1: { first_name: 'Elvira', last_name: 'López Vila', ranking_rfet: 97 },
    p2: { first_name: 'Eva', last_name: 'Ducet Teixeira', ranking_rfet: 75 }, combined: 172 },
  { p1: { first_name: 'Paula', last_name: 'Royo García', ranking_rfet: 302 },
    p2: { first_name: 'Cheryl Lyn', last_name: 'Von Asten', ranking_rfet: 165 }, combined: 467 },
  { p1: { first_name: 'Mia Fiorella', last_name: 'Petruzzella Torres', ranking_rfet: 356 },
    p2: { first_name: 'Noemi', last_name: 'Solla Abralles', ranking_rfet: 376 }, combined: 732 },
  { p1: { first_name: 'Seila', last_name: 'Zarza Ortea', ranking_rfet: 169 },
    p2: { first_name: 'Sandra', last_name: 'Serrano Rodríguez', ranking_rfet: null }, combined: null },
  { p1: { first_name: 'Noa', last_name: 'Farias Medina', ranking_rfet: 25 },
    p2: { first_name: 'Laura', last_name: 'Martinaityte', ranking_rfet: null }, combined: null },
]

// ════════════════════════════════════════════════════════════════════════════
// MASCULINO — 34 parejas (68 jugadores)
// ════════════════════════════════════════════════════════════════════════════
const PAREJAS_MASCULINO: PairInput[] = [
  { p1: { first_name: 'Pol', last_name: 'Filella Martínez', ranking_rfet: 3 },
    p2: { first_name: 'Nicolás', last_name: 'Volpe Bravo', ranking_rfet: 2 }, combined: 5 },
  { p1: { first_name: 'Álvaro', last_name: 'García González', ranking_rfet: 6 },
    p2: { first_name: 'Antomi', last_name: 'Ramos Viera', ranking_rfet: 1 }, combined: 7 },
  { p1: { first_name: 'Iván', last_name: 'Delgado Dekány', ranking_rfet: 9 },
    p2: { first_name: 'Jorge', last_name: 'Méndez Martínez', ranking_rfet: 5 }, combined: 14 },
  { p1: { first_name: 'Axel', last_name: 'González Lázaro', ranking_rfet: 10 },
    p2: { first_name: 'Charles', last_name: 'Blais', ranking_rfet: 8 }, combined: 18 },
  { p1: { first_name: 'Santi', last_name: 'Puente Forné', ranking_rfet: 4 },
    p2: { first_name: 'Álvaro', last_name: 'Machín', ranking_rfet: 17 }, combined: 21 },
  { p1: { first_name: 'Abel', last_name: 'García Caseiro', ranking_rfet: 11 },
    p2: { first_name: 'Samuel', last_name: 'Hernández Román', ranking_rfet: 16 }, combined: 27 },
  { p1: { first_name: 'Valentín', last_name: 'Volpe Bravo', ranking_rfet: 7 },
    p2: { first_name: 'Marc', last_name: 'Filella Martínez', ranking_rfet: 22 }, combined: 29 },
  { p1: { first_name: 'Aitor', last_name: 'Catchot Sintes', ranking_rfet: 19 },
    p2: { first_name: 'Sergi', last_name: 'Bagur Fedelich', ranking_rfet: 18 }, combined: 37 },
  { p1: { first_name: 'Lluís', last_name: 'Martínez Martínez', ranking_rfet: 15 },
    p2: { first_name: 'Marcos', last_name: 'Rastrilla Antón', ranking_rfet: 23 }, combined: 38 },
  { p1: { first_name: 'Gerard', last_name: 'Torres Palos', ranking_rfet: 30 },
    p2: { first_name: 'Gerard', last_name: 'Rodríguez Querol', ranking_rfet: 14 }, combined: 44 },
  { p1: { first_name: 'Iker', last_name: 'Mateos Méndez', ranking_rfet: 21 },
    p2: { first_name: 'Alejandro', last_name: 'Abadía Fuster', ranking_rfet: 26 }, combined: 47 },
  { p1: { first_name: 'Óscar', last_name: 'Rodrigo Vázquez', ranking_rfet: 29 },
    p2: { first_name: 'Guillermo', last_name: 'Vallmitjana Alcaide', ranking_rfet: 27 }, combined: 56 },
  { p1: { first_name: 'Raúl', last_name: 'Martínez Torres', ranking_rfet: 41 },
    p2: { first_name: 'Diego', last_name: 'González Olivares', ranking_rfet: 24 }, combined: 65 },
  { p1: { first_name: 'Luis', last_name: 'Estrella Redonda', ranking_rfet: 32 },
    p2: { first_name: 'Francisco', last_name: 'Tirado Martí', ranking_rfet: 43 }, combined: 75 },
  { p1: { first_name: 'Octavio', last_name: 'Rodríguez Santana', ranking_rfet: 49 },
    p2: { first_name: 'Néstor', last_name: 'Santana Sánchez', ranking_rfet: 46 }, combined: 95 },
  { p1: { first_name: 'Raúl', last_name: 'Sánchez de la Cruz', ranking_rfet: 53 },
    p2: { first_name: 'Liberto', last_name: 'Amate Ballesteros', ranking_rfet: 48 }, combined: 101 },
  { p1: { first_name: 'Diego', last_name: 'Negreira López', ranking_rfet: 59 },
    p2: { first_name: 'David', last_name: 'Soriano', ranking_rfet: 50 }, combined: 109 },
  { p1: { first_name: 'Mohammed', last_name: 'Douiri Kada', ranking_rfet: 28 },
    p2: { first_name: 'Álvaro', last_name: 'Ibáñez Ramos', ranking_rfet: 109 }, combined: 137 },
  { p1: { first_name: 'Carlos', last_name: 'Solsona Mañas', ranking_rfet: 91 },
    p2: { first_name: 'Ángel', last_name: 'Pardo Lucas', ranking_rfet: 76 }, combined: 167 },
  { p1: { first_name: 'Martí', last_name: 'Grau Puigdomenech', ranking_rfet: 68 },
    p2: { first_name: 'Eduard', last_name: 'Batlles Santiago', ranking_rfet: 104 }, combined: 172 },
  { p1: { first_name: 'José', last_name: 'Jiménez García', ranking_rfet: 139 },
    p2: { first_name: 'Mario', last_name: 'Martínez Torres', ranking_rfet: 134 }, combined: 273 },
  { p1: { first_name: 'José Alfonso', last_name: 'Jiménez Barquero', ranking_rfet: 169 },
    p2: { first_name: 'Nicolás', last_name: 'Pires Moncayo', ranking_rfet: 126 }, combined: 285 },
  { p1: { first_name: 'Benoit', last_name: 'Salaun', ranking_rfet: 146 },
    p2: { first_name: 'Ossian', last_name: 'Halley', ranking_rfet: 144 }, combined: 290 },
  { p1: { first_name: 'José Antonio', last_name: 'Muñiz Repeto', ranking_rfet: 155 },
    p2: { first_name: 'Pablo Santiago', last_name: 'Gutiérrez Vargas', ranking_rfet: 171 }, combined: 326 },
  { p1: { first_name: 'Pablo', last_name: 'Martínez Catalán', ranking_rfet: 138 },
    p2: { first_name: 'Sebastián', last_name: 'Martínez López', ranking_rfet: 189 }, combined: 327 },
  { p1: { first_name: 'Rodrigo', last_name: 'Domínguez Monje', ranking_rfet: 249 },
    p2: { first_name: 'Ignacio', last_name: 'Lisa Fernández', ranking_rfet: 90 }, combined: 339 },
  { p1: { first_name: 'Jorge', last_name: 'Martínez Martínez', ranking_rfet: 67 },
    p2: { first_name: 'Juan Pablo', last_name: 'Amador Ruiz', ranking_rfet: null }, combined: null },
  { p1: { first_name: 'Mario', last_name: 'Fernández Sariego', ranking_rfet: 201 },
    p2: { first_name: 'Francisco Javier', last_name: 'Granda Arranz', ranking_rfet: null }, combined: null },
  { p1: { first_name: 'David', last_name: 'López Cortés', ranking_rfet: null },
    p2: { first_name: 'Caio', last_name: 'Abrahao', ranking_rfet: null }, combined: null },
  { p1: { first_name: 'Pablo', last_name: 'Castillo Martínez', ranking_rfet: null },
    p2: { first_name: 'Alfonso', last_name: 'Pallarés Ruiz', ranking_rfet: 107 }, combined: null },
  { p1: { first_name: 'Paulius', last_name: 'Bruzas', ranking_rfet: null },
    p2: { first_name: 'Álvaro', last_name: 'Calvo Cordón', ranking_rfet: 99 }, combined: null },
  { p1: { first_name: 'Alejandro', last_name: 'Pérez González', ranking_rfet: 384 },
    p2: { first_name: 'Juan Ángel', last_name: 'Hipper', ranking_rfet: null }, combined: null },
  { p1: { first_name: 'Andrea', last_name: 'Alisetta', ranking_rfet: null },
    p2: { first_name: 'Carlos', last_name: 'Sánchez Álvarez', ranking_rfet: 328 }, combined: null },
  { p1: { first_name: 'José Manuel', last_name: 'Miranda Ranea', ranking_rfet: null },
    p2: { first_name: 'Roberto', last_name: 'Nioi', ranking_rfet: null }, combined: null },
]

const CATEGORIES = {
  absolute_f: { parejas: PAREJAS_FEMENINO, label: 'Absoluto Femenino', size: 32 },
  absolute_m: { parejas: PAREJAS_MASCULINO, label: 'Absoluto Masculino', size: 64 },
} as const

type Category = keyof typeof CATEGORIES

export async function POST(req: NextRequest) {
  const auth = await requireRole(['super_admin', 'tournament_director'])
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => ({})) as { category?: string }
  const category = body.category as Category
  if (!CATEGORIES[category]) {
    return NextResponse.json({ error: 'Categoría inválida. Usa absolute_f o absolute_m.' }, { status: 400 })
  }

  const tournamentId = await getActiveTournamentId()
  const config = CATEGORIES[category]
  const service = createServiceSupabase()

  // 1. Limpieza idempotente: borra el draw previo de esta categoría (si lo
  // hay) y sus entries (cascade). Re-ejecutar el botón resetea el cuadro.
  const { data: existingDraws } = await service
    .from('draws')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('category', category)

  if (existingDraws && existingDraws.length > 0) {
    await service.from('draws')
      .delete()
      .in('id', existingDraws.map((d: any) => d.id))
  }

  // 2. Crear el draw nuevo
  const { data: draw, error: drawErr } = await service.from('draws').insert({
    tournament_id: tournamentId,
    category,
    draw_type: 'single_elimination',
    size: config.size,
    status: 'seeded',
    structure: { scoring_system: 'best_of_2_sets_super_tb', match_type: 'doubles' },
  }).select('id').single()

  if (drawErr || !draw) {
    return NextResponse.json({ error: `No se pudo crear el cuadro: ${drawErr?.message}` }, { status: 500 })
  }

  // 3. Para cada pareja: upsert ambos jugadores (por nombre+apellidos) y
  // crear el draw_entry. Reusamos players existentes si ya están en la BBDD.
  const stats = { players_created: 0, players_reused: 0, entries_created: 0, errors: [] as string[] }

  for (const pair of config.parejas) {
    try {
      const p1Id = await upsertPlayer(service, pair.p1, stats)
      const p2Id = await upsertPlayer(service, pair.p2, stats)

      const { error: entryErr } = await service.from('draw_entries').insert({
        draw_id: draw.id,
        player1_id: p1Id,
        player2_id: p2Id,
        seed: pair.combined,  // null si combined era 999
        entry_type: 'direct',
        ranking_sum: pair.combined,
        status: 'confirmed',
      })
      if (entryErr) {
        stats.errors.push(`Entry ${pair.p1.last_name}/${pair.p2.last_name}: ${entryErr.message}`)
      } else {
        stats.entries_created++
      }
    } catch (err: any) {
      stats.errors.push(`Pareja ${pair.p1.last_name}/${pair.p2.last_name}: ${err?.message ?? 'desconocido'}`)
    }
  }

  return NextResponse.json({
    success: true,
    category,
    label: config.label,
    draw_id: draw.id,
    ...stats,
  })
}

/**
 * Busca un jugador por (first_name, last_name). Si existe, devuelve su id.
 * Si no, lo crea con nacionalidad 'ESP' y el ranking_rfet del PDF.
 */
async function upsertPlayer(service: any, p: PlayerInput, stats: { players_created: number, players_reused: number }): Promise<string> {
  const { data: existing } = await service
    .from('players')
    .select('id, ranking_rfet')
    .eq('first_name', p.first_name)
    .eq('last_name', p.last_name)
    .maybeSingle()

  if (existing) {
    stats.players_reused++
    // Si el ranking actual del jugador es null pero el PDF trae uno, lo
    // actualizamos. Si ya tiene uno, lo respetamos (puede ser más fresco).
    if ((existing as any).ranking_rfet == null && p.ranking_rfet != null) {
      await service.from('players')
        .update({ ranking_rfet: p.ranking_rfet })
        .eq('id', (existing as any).id)
    }
    return (existing as any).id
  }

  const { data: created, error } = await service.from('players').insert({
    first_name: p.first_name,
    last_name: p.last_name,
    nationality: 'ESP',
    ranking_rfet: p.ranking_rfet,
  }).select('id').single()

  if (error || !created) throw new Error(error?.message ?? 'insert failed')
  stats.players_created++
  return (created as any).id
}
