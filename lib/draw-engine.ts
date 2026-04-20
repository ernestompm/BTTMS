import type { DrawEntry } from '@/types'

export interface DrawPosition {
  position: number
  entry_id: string | null
  is_bye: boolean
  seed: number | null
}

/** Generate bracket positions following RFET seeding rules */
export function generateBracket(size: number, entries: DrawEntry[]): DrawPosition[] {
  const positions: DrawPosition[] = Array.from({ length: size }, (_, i) => ({
    position: i + 1,
    entry_id: null,
    is_bye: false,
    seed: null,
  }))

  // Sort entries by seed first, then by ranking_sum
  const seeded = entries.filter((e) => e.seed !== null).sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))
  const unseeded = entries.filter((e) => e.seed === null).sort((a, b) => (a.ranking_sum ?? 9999) - (b.ranking_sum ?? 9999))

  // Place seeds in standard positions
  const seedPositions = getSeedPositions(size, seeded.length)
  seeded.forEach((entry, i) => {
    const pos = seedPositions[i]
    if (pos !== undefined) {
      positions[pos - 1].entry_id = entry.id
      positions[pos - 1].seed = entry.seed
    }
  })

  // Fill remaining positions with shuffled unseeded
  const shuffled = shuffleArray(unseeded)
  let unseededIdx = 0
  for (const pos of positions) {
    if (pos.entry_id === null && unseededIdx < shuffled.length) {
      pos.entry_id = shuffled[unseededIdx].id
      unseededIdx++
    }
  }

  // Mark remaining empty positions as byes
  for (const pos of positions) {
    if (pos.entry_id === null) pos.is_bye = true
  }

  return positions
}

function getSeedPositions(size: number, numSeeds: number): number[] {
  const positions: number[] = []
  if (numSeeds >= 1) positions.push(1)
  if (numSeeds >= 2) positions.push(size)
  if (numSeeds >= 3) positions.push(Math.ceil(size / 2))
  if (numSeeds >= 4) positions.push(Math.ceil(size / 2) + 1)
  // Add more seed positions for larger draws
  if (size >= 16 && numSeeds >= 5) {
    positions.push(Math.ceil(size / 4))
    positions.push(Math.ceil(size / 4) + 1)
    positions.push(Math.ceil(3 * size / 4))
    positions.push(Math.ceil(3 * size / 4) + 1)
  }
  return positions.slice(0, numSeeds)
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Distribute entries into groups (snake order by ranking) */
export function distributeGroups(numGroups: number, entries: DrawEntry[]): Record<string, string[]> {
  const sorted = [...entries].sort((a, b) => (a.ranking_sum ?? 9999) - (b.ranking_sum ?? 9999))
  const groups: Record<string, string[]> = {}
  for (let g = 0; g < numGroups; g++) {
    groups[`Grupo ${String.fromCharCode(65 + g)}`] = []
  }
  let groupNames = Object.keys(groups)

  sorted.forEach((entry, i) => {
    const row = Math.floor(i / numGroups)
    const col = row % 2 === 0 ? i % numGroups : numGroups - 1 - (i % numGroups)
    groups[groupNames[col]].push(entry.id)
  })

  return groups
}

/** Get round name from position in bracket */
export function getRoundName(size: number, roundNum: number): string {
  const totalRounds = Math.log2(size)
  const fromFinal = totalRounds - roundNum
  if (fromFinal === 0) return 'F'
  if (fromFinal === 1) return 'SF'
  if (fromFinal === 2) return 'QF'
  if (fromFinal === 3) return 'R16'
  if (fromFinal === 4) return 'R32'
  return `R${Math.pow(2, fromFinal + 1)}`
}
