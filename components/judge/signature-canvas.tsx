'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onChange: (dataUrl: string | null) => void
  /** Line color — high-contrast on the card background */
  stroke?: string
  /** CSS class for the outer wrapper */
  className?: string
}

/**
 * Pointer-based signature pad. Works with mouse, pen and touch.
 * Emits a PNG data URL on every stroke (debounced via requestAnimationFrame);
 * emits null when cleared. Tested on tablet with damp fingers.
 */
export function SignatureCanvas({ onChange, stroke = '#111827', className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [empty, setEmpty] = useState(true)
  const drawingRef = useRef(false)
  const lastRef = useRef<{ x: number; y: number } | null>(null)

  // Resize the canvas to its display size (avoids blurry strokes on HiDPI)
  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const resize = () => {
      const rect = cvs.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      cvs.width = Math.round(rect.width * dpr)
      cvs.height = Math.round(rect.height * dpr)
      const ctx = cvs.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 2.5
        ctx.strokeStyle = stroke
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(cvs)
    return () => ro.disconnect()
  }, [stroke])

  function pointerPos(e: PointerEvent | React.PointerEvent): { x: number; y: number } {
    const cvs = canvasRef.current!
    const rect = cvs.getBoundingClientRect()
    return { x: (e as any).clientX - rect.left, y: (e as any).clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const cvs = canvasRef.current!
    try { cvs.setPointerCapture(e.pointerId) } catch {}
    drawingRef.current = true
    lastRef.current = pointerPos(e)
    const ctx = cvs.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(lastRef.current.x, lastRef.current.y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const cvs = canvasRef.current!
    const ctx = cvs.getContext('2d')
    if (!ctx) return
    const p = pointerPos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    lastRef.current = p
  }

  function end() {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastRef.current = null
    setEmpty(false)
    const cvs = canvasRef.current!
    requestAnimationFrame(() => onChange(cvs.toDataURL('image/png')))
  }

  function clear() {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, cvs.width, cvs.height)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
        className="w-full h-44 bg-white rounded-xl touch-none select-none"
        aria-label="Firma del juez árbitro"
      />
      {empty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-gray-400 text-sm italic">Firme aquí con el dedo o stylus</p>
        </div>
      )}
      <button type="button" onClick={clear}
        className="absolute top-2 right-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded-lg font-semibold shadow-sm">
        Borrar
      </button>
    </div>
  )
}
