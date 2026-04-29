// ============================================================================
// /dashboard/svg-mockups — galería de SVG editables del skin Broadcast
// ============================================================================
// Cada SVG se renderiza inline en su tamaño real + tiene botón "Descargar".
// El usuario abre Figma/Inkscape, importa, edita, y luego me pasa el SVG
// modificado. Yo lo mapeo de vuelta al componente React.
// ============================================================================

import Link from 'next/link'

const MOCKUPS = [
  { file: 'scorebug.svg', label: 'Scorebug', description: 'Top-left durante el partido. Pill cells, doble accent al pie, header integrado.' },
  { file: 'big-scoreboard.svg', label: 'Marcador grande (lower-third)', description: 'Bottom-center con todos los sets, nombres completos, saque, sponsor.' },
  { file: 'match-presentation.svg', label: 'Presentación de partido', description: 'Takeover centrado con VS gigante en gradiente cyan/coral y meta-boxes.' },
  { file: 'player-bio.svg', label: 'Bio del jugador', description: 'Card lateral con foto + nombre + ficha de datos.' },
  { file: 'weather.svg', label: 'Tiempo / Clima', description: 'Bottom-left. Icono según condición, temperatura grande.' },
  { file: 'tournament-intro.svg', label: 'Presentación torneo', description: 'Top-right pequeño con nombre del torneo y categoría.' },
  { file: 'referee.svg', label: 'Juez árbitro (lower-third)', description: 'Bottom-right. Nombre del juez y federación.' },
  { file: 'stats-panel.svg', label: 'Panel de estadísticas', description: 'Takeover centrado. Stats por set con nombres y filas alternadas.' },
]

export default function SvgMockupsPage() {
  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white font-score">📐 SVG mockups · skin Broadcast</h1>
        <p className="text-gray-400 text-sm mt-1 max-w-3xl">
          Plantillas SVG editables del skin Broadcast actual. Descarga el archivo, ábrelo en
          <strong className="text-gray-200"> Figma / Inkscape / Illustrator</strong>, modifícalo a tu gusto y
          envíamelo de vuelta. Yo mapeo los cambios de vuelta al código.
        </p>
      </div>

      <div className="bg-blue-900/20 border border-blue-700/40 rounded-2xl p-4 text-sm">
        <p className="text-blue-200 font-semibold mb-1">💡 Cómo funciona el flujo</p>
        <ol className="text-gray-300 text-xs space-y-1 list-decimal list-inside">
          <li>Descarga el SVG del gráfico que quieras tunear</li>
          <li>Ábrelo en Figma (o tu editor preferido) — verás el diseño igual que se renderiza en el overlay</li>
          <li>Mueve, redimensiona, cambia colores, fonts, posiciones — lo que quieras</li>
          <li>Exporta como SVG (en Figma: Export → SVG)</li>
          <li>Mándamelo y te lo aplico al skin Broadcast directamente</li>
        </ol>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MOCKUPS.map((m) => (
          <div key={m.file} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="p-4">
              <h3 className="text-white font-bold">{m.label}</h3>
              <p className="text-gray-500 text-xs mt-1">{m.description}</p>
            </div>
            {/* Preview */}
            <div className="bg-[repeating-conic-gradient(#1f2937_0_25%,#111827_0_50%)] bg-[length:24px_24px] p-4 flex items-center justify-center min-h-[200px]">
              <img
                src={`/mockups/broadcast/${m.file}`}
                alt={m.label}
                className="max-w-full max-h-[260px] object-contain drop-shadow-2xl"
              />
            </div>
            <div className="p-3 border-t border-gray-800 flex items-center gap-2 flex-wrap">
              <a
                href={`/mockups/broadcast/${m.file}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                👁️ Ver en grande
              </a>
              <a
                href={`/mockups/broadcast/${m.file}`}
                download={m.file}
                className="bg-purple-700 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                ⬇️ Descargar SVG
              </a>
              <span className="text-gray-600 text-xs ml-auto font-mono">{m.file}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-bold mb-3">📦 Otros recursos</h2>
        <ul className="text-sm text-gray-300 space-y-2">
          <li>
            <Link href="/dashboard/graphics-editor" className="text-purple-400 hover:underline">→ Editor de gráficos en vivo</Link>
            <span className="text-gray-500 text-xs ml-2">(sliders para tunear tamaños sin tocar diseño)</span>
          </li>
          <li>
            <span className="text-gray-400">SVGs en raw:</span>{' '}
            <code className="text-xs bg-gray-800 px-2 py-1 rounded">/mockups/broadcast/[archivo].svg</code>
          </li>
        </ul>
      </div>
    </div>
  )
}
