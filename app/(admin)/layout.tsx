import { redirect } from 'next/navigation'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { AdminNav } from '@/components/admin/nav'
import type { AppUser } from '@/types'

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

  return (
    <div className="flex min-h-screen bg-gray-950">
      <AdminNav user={appUser as AppUser} />
      <main className="ml-56 flex-1 p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
