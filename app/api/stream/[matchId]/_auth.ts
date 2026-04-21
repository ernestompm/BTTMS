// ============================================================================
// Stream API auth helper
// ============================================================================
// Todas las rutas bajo /api/stream/[matchId] requieren header
//   Authorization: Bearer <STREAM_API_KEY>
// donde STREAM_API_KEY es la variable de entorno definida en Vercel.
// ============================================================================

export function checkStreamApiKey(req: Request): { ok: true } | { ok: false, message: string, status: number } {
  const key = process.env.STREAM_API_KEY
  if (!key) return { ok: false, message: 'STREAM_API_KEY not configured', status: 500 }
  const auth = req.headers.get('authorization') ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim())
  if (!m || m[1].trim() !== key) return { ok: false, message: 'Unauthorized', status: 401 }
  return { ok: true }
}

export function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status })
}
