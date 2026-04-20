import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint, api_key } = await req.json()
  if (!endpoint) return NextResponse.json({ error: 'endpoint requerido' }, { status: 400 })

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(api_key ? { 'X-API-Key': api_key } : {}),
      },
      body: JSON.stringify({ event: 'ping', source: 'bttms', timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    })
    return NextResponse.json({ status: res.status, ok: res.ok })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error de conexión' }, { status: 502 })
  }
}
