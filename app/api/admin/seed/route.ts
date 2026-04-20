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

export async function POST() {
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

  // 5. Create 8 R16 matches, inheriting scoring_system from draw.structure
  const drawScoring = (draw as any).structure?.scoring_system ?? 'best_of_2_sets_super_tb'
  const matchInserts = R16_PAIRS.map(([s1, s2], idx) => ({
    tournament_id: TOURNAMENT_ID,
    draw_id: draw.id,
    category: 'absolute_m',
    round: 'R16',
    match_number: idx + 1,
    match_type: 'doubles',
    entry1_id: entryBySeed[s1],
    entry2_id: entryBySeed[s2],
    status: 'scheduled',
    scoring_system: drawScoring,
  }))
  const { error: mErr } = await service.from('matches').insert(matchInserts)
  if (mErr) {
    return NextResponse.json({
      error: 'Partidos: ' + mErr.message,
      needs_sql_fix: mErr.message.includes('net_height'),
    }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    players: PLAYERS.length,
    teams: 16,
    matches: 8,
    message: '32 jugadores · 16 equipos · 8 partidos de octavos',
  })
}
