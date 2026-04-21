'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

// ─── CSV helpers (parser mínimo que entiende comillas y comas) ─────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i+1] === '"') { cell += '"'; i++ } else { inQuotes = false }
      } else cell += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(cell); cell = '' }
      else if (c === '\r') continue
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
      else cell += c
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim().length > 0))
}

const HEADERS = [
  'first_name', 'last_name', 'nationality', 'birth_date', 'birth_city',
  'height_cm', 'laterality', 'ranking_rfet', 'ranking_itf',
  'club', 'federacion_autonomica', 'social_instagram', 'bio',
] as const
type Header = typeof HEADERS[number]

const HEADER_LABELS: Record<Header, string> = {
  first_name: 'Nombre *',
  last_name: 'Apellidos *',
  nationality: 'Nacionalidad ISO3 (ESP, ITA, FRA...) *',
  birth_date: 'Fecha nacim. (YYYY-MM-DD)',
  birth_city: 'Ciudad nacim.',
  height_cm: 'Altura (cm)',
  laterality: 'Lateralidad (right|left|ambidextrous)',
  ranking_rfet: 'Ranking RFET',
  ranking_itf: 'Ranking ITF',
  club: 'Club',
  federacion_autonomica: 'Federación autonómica',
  social_instagram: 'Instagram',
  bio: 'Biografía',
}

const SAMPLE_ROW: Record<Header, string> = {
  first_name: 'Carlos',
  last_name: 'García Martínez',
  nationality: 'ESP',
  birth_date: '1995-07-24',
  birth_city: 'Marbella',
  height_cm: '185',
  laterality: 'right',
  ranking_rfet: '5',
  ranking_itf: '42',
  club: 'CT Marbella',
  federacion_autonomica: 'FAT Andalucía',
  social_instagram: '@carlos_gm',
  bio: 'Dos veces campeón nacional absoluto',
}

function buildTemplateCSV(): string {
  const head = HEADERS.join(',')
  const row  = HEADERS.map(h => {
    const v = SAMPLE_ROW[h] ?? ''
    return /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  }).join(',')
  return `${head}\n${row}\n`
}

interface ParsedRow {
  ok: boolean
  error?: string
  data?: Record<string, any>
  raw: Record<string, string>
  line: number
}

function normalizeRow(record: Record<string,string>, line: number): ParsedRow {
  const errs: string[] = []
  const first = (record.first_name ?? '').trim()
  const last  = (record.last_name ?? '').trim()
  const nat   = (record.nationality ?? '').trim().toUpperCase()
  if (!first) errs.push('first_name vacío')
  if (!last)  errs.push('last_name vacío')
  if (!nat)   errs.push('nationality vacía (usa ISO3 ej. ESP)')
  else if (!/^[A-Z]{2,3}$/.test(nat)) errs.push(`nationality inválida "${nat}"`)

  const birth = (record.birth_date ?? '').trim()
  if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) errs.push(`birth_date debe ser YYYY-MM-DD (recibido "${birth}")`)

  const lat = (record.laterality ?? '').trim().toLowerCase()
  if (lat && !['right','left','ambidextrous'].includes(lat)) errs.push(`laterality debe ser right|left|ambidextrous (recibido "${lat}")`)

  const height = record.height_cm ? parseInt(record.height_cm, 10) : null
  if (record.height_cm && (!Number.isFinite(height!) || height! < 100 || height! > 250)) errs.push(`height_cm fuera de rango (recibido "${record.height_cm}")`)

  const rRfet = record.ranking_rfet ? parseInt(record.ranking_rfet, 10) : null
  const rItf  = record.ranking_itf  ? parseInt(record.ranking_itf, 10)  : null
  if (record.ranking_rfet && !Number.isFinite(rRfet!)) errs.push('ranking_rfet no es número')
  if (record.ranking_itf  && !Number.isFinite(rItf!))  errs.push('ranking_itf no es número')

  if (errs.length) return { ok:false, error: errs.join(' · '), raw: record, line }

  return {
    ok: true,
    line,
    raw: record,
    data: {
      first_name: first,
      last_name: last,
      nationality: nat,
      birth_date: birth || null,
      birth_city: record.birth_city?.trim() || null,
      height_cm: height,
      laterality: (lat as 'right'|'left'|'ambidextrous') || null,
      ranking_rfet: rRfet,
      ranking_itf: rItf,
      club: record.club?.trim() || null,
      federacion_autonomica: record.federacion_autonomica?.trim() || null,
      social_instagram: record.social_instagram?.trim() || null,
      bio: record.bio?.trim() || null,
      titles: [],
    },
  }
}

// ─── UI ────────────────────────────────────────────────────────────────────
export function PlayersImportClient() {
  const supabase = createClient()
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ inserted: number, failed: number, errors: string[] } | null>(null)

  function downloadTemplate() {
    const blob = new Blob([buildTemplateCSV()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'plantilla-jugadores.csv'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  async function onFile(f: File | null) {
    setFile(f); setResult(null); setRows([])
    if (!f) return
    const text = await f.text()
    const matrix = parseCSV(text)
    if (matrix.length < 2) { alert('El CSV está vacío o sin filas de datos'); return }
    const header = matrix[0].map(h => h.trim().toLowerCase())
    const parsed: ParsedRow[] = []
    for (let i = 1; i < matrix.length; i++) {
      const record: Record<string,string> = {}
      matrix[i].forEach((c, idx) => { record[header[idx] ?? ''] = c })
      parsed.push(normalizeRow(record, i + 1))
    }
    setRows(parsed)
  }

  async function doImport() {
    const ok = rows.filter(r => r.ok && r.data) as (ParsedRow & { data: any })[]
    if (ok.length === 0) return
    setSaving(true)
    const batchSize = 50
    let inserted = 0
    const errors: string[] = []
    for (let i = 0; i < ok.length; i += batchSize) {
      const batch = ok.slice(i, i + batchSize).map(r => r.data)
      const { error, count } = await supabase.from('players').insert(batch, { count: 'exact' })
      if (error) errors.push(`Lote ${i/batchSize + 1}: ${error.message}`)
      else inserted += count ?? batch.length
    }
    setSaving(false)
    setResult({ inserted, failed: rows.length - inserted, errors })
  }

  const validCount = rows.filter(r => r.ok).length
  const errorCount = rows.length - validCount

  return (
    <div className="space-y-6 fade-in max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-score">Importar jugadores</h1>
          <p className="text-gray-400 text-sm">Sube un CSV con los jugadores. Descarga la plantilla para el formato exacto.</p>
        </div>
        <Link href="/dashboard/players" className="text-gray-500 hover:text-white text-sm">← Volver a jugadores</Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-white font-bold">1 · Descarga la plantilla</div>
            <p className="text-gray-500 text-xs mt-1">CSV con cabeceras exactas. Los campos marcados con * son obligatorios.</p>
          </div>
          <button onClick={downloadTemplate}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            ⬇ Descargar plantilla CSV
          </button>
        </div>
        <details className="text-gray-400 text-sm">
          <summary className="cursor-pointer hover:text-white">Ver columnas soportadas</summary>
          <ul className="mt-2 pl-5 list-disc space-y-1">
            {HEADERS.map(h => (
              <li key={h}><code className="text-brand-red text-xs">{h}</code> — {HEADER_LABELS[h]}</li>
            ))}
          </ul>
        </details>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div className="text-white font-bold">2 · Subir archivo CSV</div>
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-brand-red file:text-white file:font-bold hover:file:bg-red-600" />
        {file && (
          <p className="text-gray-400 text-xs">{file.name} · {(file.size / 1024).toFixed(1)} KB · {rows.length} filas</p>
        )}
      </div>

      {rows.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-white font-bold">3 · Revisar y confirmar</div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-400">✓ {validCount} válidos</span>
              <span className="text-red-400">✗ {errorCount} con errores</span>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto border border-gray-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-left">Apellidos</th>
                  <th className="px-3 py-2 text-left">Nac.</th>
                  <th className="px-3 py-2 text-left">Club</th>
                  <th className="px-3 py-2 text-left">Detalle / Error</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-t border-gray-800 ${r.ok ? '' : 'bg-red-950/30'}`}>
                    <td className="px-3 py-1.5 text-gray-500 text-xs">{r.line}</td>
                    <td className="px-3 py-1.5">{r.ok ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}</td>
                    <td className="px-3 py-1.5 text-white">{r.raw.first_name}</td>
                    <td className="px-3 py-1.5 text-white">{r.raw.last_name}</td>
                    <td className="px-3 py-1.5 text-gray-300">{r.raw.nationality?.toUpperCase()}</td>
                    <td className="px-3 py-1.5 text-gray-400">{r.raw.club}</td>
                    <td className="px-3 py-1.5 text-gray-400 text-xs">{r.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button onClick={doImport} disabled={saving || validCount === 0}
              className="bg-brand-red hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">
              {saving ? 'Importando...' : `Importar ${validCount} jugadores válidos`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
          <div className="text-white font-bold">Resultado</div>
          <div className="flex gap-4 text-sm">
            <span className="text-green-400">✓ Insertados: {result.inserted}</span>
            <span className="text-red-400">✗ Fallidos: {result.failed}</span>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-3 text-sm">
              <div className="text-red-300 font-bold mb-1">Errores:</div>
              {result.errors.map((e, i) => <div key={i} className="text-red-400 text-xs font-mono">{e}</div>)}
            </div>
          )}
          <div>
            <Link href="/dashboard/players" className="text-brand-red hover:underline text-sm">Ver jugadores →</Link>
          </div>
        </div>
      )}
    </div>
  )
}
