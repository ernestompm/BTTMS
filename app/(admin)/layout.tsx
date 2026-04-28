import { redirect } from 'next/navigation'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { AdminNav } from '@/components/admin/nav'
import { NavProgress } from '@/components/ui/nav-progress'
import type { AppUser } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const service = createServiceSupabase()
  const { data: appUser } = await service
    .from('app_users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!appUser) redirect('/login')
  // Roles que no tienen acceso al panel de admin → redirige a su area
  if ((appUser as any).role === 'commentator') redirect('/commentator')
  if ((appUser as any).role === 'judge') {
    // Los jueces sí pueden navegar a /dashboard si quieren (algunas
    // cosas como /dashboard/stats les sirven), no los bloqueo.
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      <NavProgress />
      <AdminNav user={appUser as AppUser} />
      <main className="flex-1 md:ml-56 pt-16 md:pt-6 px-4 pb-8 md:px-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  )
}
