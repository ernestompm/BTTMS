// ============================================================================
// GET /api/ai-status — diagnostico del proveedor de IA configurado
// ============================================================================
// Devuelve qué env vars están detectadas y permite hacer un ping de prueba
// al provider sin necesidad de pasar por todo el flujo del CIS. Útil para
// debugging cuando el usuario configura una key y no le funciona.
// ============================================================================

import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Detectar qué keys están en el entorno (sin revelar el valor)
  const envStatus = {
    GOOGLE_AI_API_KEY: !!process.env.GOOGLE_AI_API_KEY,
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    GROQ_API_KEY: !!process.env.GROQ_API_KEY,
    MISTRAL_API_KEY: !!process.env.MISTRAL_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
  }

  // Determinar proveedor activo
  let activeProvider: string | null = null
  if (envStatus.GOOGLE_AI_API_KEY || envStatus.GEMINI_API_KEY) activeProvider = 'gemini'
  else if (envStatus.GROQ_API_KEY) activeProvider = 'groq'
  else if (envStatus.MISTRAL_API_KEY) activeProvider = 'mistral'
  else if (envStatus.ANTHROPIC_API_KEY) activeProvider = 'anthropic'

  // Test ping para verificar que la key es válida
  let pingResult: any = null
  if (activeProvider === 'gemini') {
    const key = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY!
    const model = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash'
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Responde solo con "OK"' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      })
      const text = await r.text()
      pingResult = {
        status: r.status,
        ok: r.ok,
        body: r.ok ? 'API responde correctamente' : text.slice(0, 400),
        model,
      }
    } catch (e: any) {
      pingResult = { error: e?.message ?? String(e) }
    }
  } else if (activeProvider === 'groq') {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY!}` },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Responde solo "OK"' }],
        }),
      })
      const text = await r.text()
      pingResult = { status: r.status, ok: r.ok, body: r.ok ? 'API responde correctamente' : text.slice(0, 400) }
    } catch (e: any) {
      pingResult = { error: e?.message ?? String(e) }
    }
  }

  return NextResponse.json({
    envVarsDetected: envStatus,
    activeProvider,
    pingResult,
    hint: activeProvider
      ? 'Pulsa "Test ping" para validar que la key es correcta. Si falla, revisa la key en Vercel y haz Redeploy.'
      : 'No hay ningún proveedor configurado. Añade una env var en Vercel y haz Redeploy del último deployment.',
  })
}
