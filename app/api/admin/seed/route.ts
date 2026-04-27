import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

const PLAYERS = [
  { f: 'Carlos',    l: 'García Martínez',   rfet: 1,  club: 'CT Playa Madrid',        fed: 'FTM Madrid' },
  { f: 'Pablo',     l: 'Ruiz Hernández',    rfet: 2,  club: "CT Platja d'Aro",        fed: 'FCT Cataluña' },
  { f: 'Miguel',    l: 'López Torres',      rfet: 3,  club: 'RCN Palma',              fed: 'FBT Baleares' },
  { f: 'Javier',    l: 'Moreno Gil',        rfet: 4,  club: 'CT Marbella',            fed: 'FAT Andalucía' },
  { f: 'Antonio',   l: 'Jiménez Navarro',   rfet: 5,  club: 'CN Benidorm',            fed: 'FVT Valencia' },
  { f: 'Daniel',    l: 'Sánchez Ortega',    rfet: 6,  club: 'CT Gijón',               fed: 'FPAT Asturias' },
  { f: 'Sergio',    l: 'Domínguez Rubio',   rfet: 7,  club: 'CT Tarifa',              fed: 'FAT Andalucía' },
  { f: 'Alejandro', l: 'Vázquez Molina',    rfet: 8,  club: 'CT Sitges',              fed: 'FCT Cataluña' },
  { f: 'Rubén',     l: 'Álvarez Serrano',   rfet: 9,  club: 'CN Sanxenxo',            fed: 'FGT Galicia' },
  { f: 'Iván',      l: 'Muñoz Iglesias',    rfet: 10, club: 'CT Playa Madrid',        fed: 'FTM Madrid' },
  { f: 'Diego',     l: 'Alonso Castro',     rfet: 12, club: 'RCN Valencia',           fed: 'FVT Valencia' },
  { f: 'Álvaro',    l: 'Gutiérrez Medina',  rfet: 14, club: 'CT Cádiz',               fed: 'FAT Andalucía' },
  { f: 'Fernando',  l: 'Ramos Delgado',     rfet: 16, club: 'CD Arenas',              fed: 'FPVT País Vasco' },
  { f: 'Jorge',     l: 'Blanco Ortiz',      rfet: 18, club: 'RCN Arrecife',           fed: 'FCnT Canarias' },
  { f: 'Raúl',      l: 'Marín Pérez',       rfet: 20, club: 'CP Salou',               fed: 'FCT Cataluña' },
  { f: 'Marcos',    l: 'Suárez Morales',    rfet: 22, club: 'CT Ibiza',               fed: 'FBT Baleares' },
  { f: 'Pedro',     l: 'Lozano Cabrera',    rfet: 25, club: 'CT Playa Madrid',        fed: 'FTM Madrid' },
  { f: 'Luis',      l: 'Herrero Vidal',     rfet: 28, club: 'CT Marbella',            fed: 'FAT Andalucía' },
  { f: 'Mario',     l: 'Ibáñez Reyes',      rfet: 30, club: 'RCN Palma',              fed: 'FBT Baleares' },
  { f: 'Adrián',    l: 'Peña Prieto',       rfet: 33, club: 'CT Sitges',              fed: 'FCT Cataluña' },
  { f: 'Ricardo',   l: 'Cortés Santana',    rfet: 35, club: 'CN Benidorm',            fed: 'FVT Valencia' },
  { f: 'Óscar',     l: 'Flores Soto',       rfet: 37, club: 'CT Tarifa',              fed: 'FAT Andalucía' },
  { f: 'Víctor',    l: 'Guerrero Pascual',  rfet: 40, club: 'CT Gijón',               fed: 'FPAT Asturias' },
  { f: 'Francisco', l: 'Cano Lara',         rfet: 42, club: 'CN Sanxenxo',            fed: 'FGT Galicia' },
  { f: 'Rodrigo',   l: 'Arias Bravo',       rfet: 45, club: 'CT Cádiz',               fed: 'FAT Andalucía' },
  { f: 'Ignacio',   l: 'Esteban Pineda',    rfet: 48, club: 'RCN Valencia',           fed: 'FVT Valencia' },
  { f: 'Manuel',    l: 'Rojas León',        rfet: 50, club: 'CD Arenas',              fed: 'FPVT País Vasco' },
  { f: 'Andrés',    l: 'Vega Sanz',         rfet: 55, club: 'CT Ibiza',               fed: 'FBT Baleares' },
  { f: 'Samuel',    l: 'Carrasco Fuentes',  rfet: 60, club: 'CP Salou',               fed: 'FCT Cataluña' },
  { f: 'Hugo',      l: 'Peral Nieto',       rfet: 65, club: 'RCN Arrecife',           fed: 'FCnT Canarias' },
  { f: 'David',     l: 'Cámara Expósito',   rfet: 72, club: 'CT Playa Madrid',        fed: 'FTM Madrid' },
  { f: 'Eduardo',   l: 'Castaño Parra',     rfet: 80, club: 'CT Marbella',            fed: 'FAT Andalucía' },
]

// Standard R16 bracket seeding (1v16, 8v9, 5v12, 4v13, 3v14, 6v11, 7v10, 2v15)
const R16_PAIRS: [number, number][] = [[1,16],[8,9],[5,12],[4,13],[3,14],[6,11],[7,10],[2,15]]

// Simula un score "best of 2 + super TB" en 2 sets para un ganador concreto.
// Devuelve un objeto Score válido para la columna jsonb.
function fakeScore(winnerTeam: 1 | 2) {
  const w = winnerTeam
  const set = (a: number, b: number) => ({
    t1: w === 1 ? a : b,
    t2: w === 1 ? b : a,
  })
  return {
    sets: [set(6, 3), set(6, 4)],
    current_set: { t1: 0, t2: 0 },
    current_game: { t1: 0, t2: 0 },
    tiebreak_active: false,
    tiebreak_score: { t1: 0, t2: 0 },
    super_tiebreak_active: false,
    deuce: false,
    advantage_team: null,
    winner_team: w,
    match_status: 'finished' as const,
    loser_team: winnerTeam === 1 ? 2 : 1,
  }
}

export async function POST(req: Request) {
  // Modo del seed: 'skeleton' (default) crea R16 listos para jugar + huecos
  // QF/SF/F. 'simulated' simula R16+QF+SF finalizados para ver bracket lleno.
  const url = new URL(req.url)
  const mode = (url.searchParams.get('mode') ?? 'skeleton') as 'skeleton' | 'simulated'

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceSupabase()
  const { data: appUser } = await service.from('app_users').select('role').eq('id', user.id).single()
  if (appUser?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 1. Clean up any existing test data (in FK order)
  await service.from('points').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await service.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await service.from('draw_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await service.from('groups').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await service.from('draws').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await service.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // 2. Insert players (use minimal safe columns first; include optional ones only if supported)
  const base = PLAYERS.map((p) => ({
    first_name: p.f,
    last_name: p.l,
    nationality: 'ESP',
    ranking_rfet: p.rfet,
    laterality: 'right',
    birth_date: `19${90 + (p.rfet % 10)}-0${1 + (p.rfet % 9)}-15`,
  }))
  const extended = PLAYERS.map((p, i) => ({ ...base[i], club: p.club, federacion_autonomica: p.fed }))

  // Try with extended columns; fallback to base if column doesn't exist
  let { data: players, error: pErr } = await service.from('players').insert(extended).select('id')
  if (pErr && (pErr.message.includes('club') || pErr.message.includes('federacion'))) {
    const retry = await service.from('players').insert(base).select('id')
    players = retry.data
    pErr = retry.error
  }
  if (pErr || !players) return NextResponse.json({ error: 'Jugadores: ' + (pErr?.message ?? 'unknown') }, { status: 500 })

  // 3. Create draw
  const { data: draw, error: dErr } = await service.from('draws').insert({
    tournament_id: TOURNAMENT_ID,
    category: 'absolute_m',
    draw_type: 'single_elimination',
    size: 16,
    status: 'in_progress',
    structure: { scoring_system: 'best_of_2_sets_super_tb' },
  }).select('id, structure').single()
  if (dErr || !draw) return NextResponse.json({ error: 'Cuadro: ' + (dErr?.message ?? 'unknown') }, { status: 500 })

  // 4. Create 16 teams (draw_entries)
  const entryInserts = Array.from({ length: 16 }, (_, i) => ({
    draw_id: draw.id,
    player1_id: players![i * 2].id,
    player2_id: players![i * 2 + 1].id,
    seed: i + 1,
    entry_type: 'direct',
    ranking_sum: PLAYERS[i * 2].rfet + PLAYERS[i * 2 + 1].rfet,
    status: 'confirmed',
  }))
  const { data: entries, error: eErr } = await service.from('draw_entries')
    .insert(entryInserts)
    .select('id, seed')
  if (eErr || !entries) return NextResponse.json({ error: 'Inscripciones: ' + (eErr?.message ?? 'unknown') }, { status: 500 })

  const entryBySeed: Record<number, string> = {}
  for (const e of entries) entryBySeed[e.seed!] = e.id

  // 5. Create FULL BRACKET SKELETON — R16 (8) + QF (4) + SF (2) + F (1)
  // Asi el cuadro siempre se ve entero desde el principio aunque las rondas
  // siguientes esten vacias (slots = "Por determinar").
  const drawScoring = (draw as any).structure?.scoring_system ?? 'best_of_2_sets_super_tb'
  const baseFields = {
    tournament_id: TOURNAMENT_ID,
    draw_id: draw.id,
    category: 'absolute_m',
    match_type: 'doubles',
    scoring_system: drawScoring,
  }
  const r16Matches = R16_PAIRS.map(([s1, s2], idx) => ({
    ...baseFields,
    round: 'R16',
    match_number: idx + 1,
    entry1_id: entryBySeed[s1],
    entry2_id: entryBySeed[s2],
    status: 'scheduled',
  }))
  const qfMatches = Array.from({ length: 4 }, (_, i) => ({
    ...baseFields,
    round: 'QF',
    match_number: i + 1,
    entry1_id: null,
    entry2_id: null,
    status: 'scheduled',
  }))
  const sfMatches = Array.from({ length: 2 }, (_, i) => ({
    ...baseFields,
    round: 'SF',
    match_number: i + 1,
    entry1_id: null,
    entry2_id: null,
    status: 'scheduled',
  }))
  const fMatches = [{
    ...baseFields,
    round: 'F',
    match_number: 1,
    entry1_id: null,
    entry2_id: null,
    status: 'scheduled',
  }]

  const { error: mErr } = await service.from('matches').insert([...r16Matches, ...qfMatches, ...sfMatches, ...fMatches])
  if (mErr) {
    return NextResponse.json({
      error: 'Partidos: ' + mErr.message,
      needs_sql_fix: mErr.message.includes('net_height'),
    }, { status: 500 })
  }

  // 6. Si modo === 'simulated', cerramos R16 + QF + SF con marcadores ficticios
  // para que el cuadro se vea propagado hasta la final. La final queda
  // pendiente para verla "en vivo" si se quiere.
  //
  // No dependemos del trigger de migracion 018: aunque exista, ademas
  // hacemos el avance manualmente para garantizar que funciona aunque la
  // migracion no este aplicada todavia.
  let simulated = 0
  if (mode === 'simulated') {
    // Helper: cierra un partido y devuelve el entry ganador (entry1)
    const finishAndGetWinner = async (matchId: string, entry1: string | null) => {
      await service.from('matches').update({
        status: 'finished',
        score: fakeScore(1),  // siempre gana entry1 (el seed mas alto)
        finished_at: new Date().toISOString(),
      }).eq('id', matchId)
      simulated++
      return entry1
    }
    // Helper: rellena el slot del siguiente partido. Pairing standard:
    //   match N -> match CEIL(N/2). Impar -> entry1, Par -> entry2.
    const advanceWinner = async (round: 'QF' | 'SF' | 'F', fromNumber: number, winner: string | null) => {
      if (!winner) return
      const nextNum = Math.ceil(fromNumber / 2)
      const slot = fromNumber % 2 === 1 ? 'entry1_id' : 'entry2_id'
      // COALESCE: solo rellenar si esta vacio (no machacar lo que ya pueda
      // haber colocado el trigger 018 si esta activo)
      const { data: existing } = await service.from('matches')
        .select(`id, ${slot}`)
        .eq('tournament_id', TOURNAMENT_ID).eq('round', round).eq('match_number', nextNum)
        .single()
      if (existing && !(existing as any)[slot]) {
        await service.from('matches').update({ [slot]: winner }).eq('id', (existing as any).id)
      }
    }

    // R16 -> QF
    const { data: r16Rows } = await service.from('matches')
      .select('id, match_number, entry1_id')
      .eq('tournament_id', TOURNAMENT_ID).eq('round', 'R16').order('match_number')
    for (const m of r16Rows ?? []) {
      const w = await finishAndGetWinner(m.id, m.entry1_id)
      await advanceWinner('QF', m.match_number, w)
    }

    // QF -> SF
    const { data: qfRows } = await service.from('matches')
      .select('id, match_number, entry1_id, entry2_id')
      .eq('tournament_id', TOURNAMENT_ID).eq('round', 'QF').order('match_number')
    for (const m of qfRows ?? []) {
      if (!m.entry1_id || !m.entry2_id) continue
      const w = await finishAndGetWinner(m.id, m.entry1_id)
      await advanceWinner('SF', m.match_number, w)
    }

    // SF -> F
    const { data: sfRows } = await service.from('matches')
      .select('id, match_number, entry1_id, entry2_id')
      .eq('tournament_id', TOURNAMENT_ID).eq('round', 'SF').order('match_number')
    for (const m of sfRows ?? []) {
      if (!m.entry1_id || !m.entry2_id) continue
      const w = await finishAndGetWinner(m.id, m.entry1_id)
      await advanceWinner('F', m.match_number, w)
    }
  }

  const totalMatches = r16Matches.length + qfMatches.length + sfMatches.length + fMatches.length
  return NextResponse.json({
    success: true,
    players: PLAYERS.length,
    teams: 16,
    matches: totalMatches,
    simulated,
    message: mode === 'simulated'
      ? `32 jugadores · 16 equipos · ${totalMatches} partidos (R16+QF+SF+F) · ${simulated} simulados como terminados`
      : `32 jugadores · 16 equipos · ${totalMatches} partidos (R16+QF+SF+F, R16 listos para jugar)`,
  })
}
