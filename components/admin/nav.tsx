'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { clsx } from 'clsx'
import type { AppUser } from '@/types'

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: '🏠', roles: ['super_admin','tournament_director','staff','judge'] },
  { href: '/dashboard/matches', label: 'Partidos', icon: '🎾', roles: ['super_admin','tournament_director','staff'] },
  { href: '/dashboard/players', label: 'Jugadores', icon: '👤', roles: ['super_admin','tournament_director','staff'] },
  { href: '/dashboard/draws', label: 'Cuadros', icon: '🏆', roles: ['super_admin','tournament_director'] },
  { href: '/dashboard/schedule', label: 'Horario', icon: '📅', roles: ['super_admin','tournament_director','staff'] },
  { href: '/dashboard/stats', label: 'Estadísticas', icon: '📊', roles: ['super_admin','tournament_director','staff'] },
  { href: '/dashboard/tournament', label: 'Torneo', icon: '⚙️', roles: ['super_admin','tournament_director'] },
  { href: '/dashboard/users', label: 'Usuarios', icon: '👥', roles: ['super_admin','tournament_director'] },
  { href: '/broadcast', label: 'TV Broadcast', icon: '📺', roles: ['super_admin','tournament_director'] },
]

export function AdminNav({ user }: { user: AppUser }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const filteredItems = navItems.filter((item) => item.roles.includes(user.role))

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-gray-900 border-r border-gray-800 flex flex-col z-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-red flex items-center justify-center text-white font-bold text-sm">B</div>
          <div>
            <p className="text-white font-bold text-sm font-score tracking-wide">BTTMS</p>
            <p className="text-gray-500 text-xs">v2.0</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-red/20 text-brand-red border border-brand-red/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User info + logout */}
      <div className="p-3 border-t border-gray-800">
        <div className="px-3 py-2 mb-2">
          <p className="text-white text-sm font-medium truncate">{user.full_name || user.email}</p>
          <p className="text-gray-500 text-xs capitalize">{user.role.replace('_', ' ')}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 text-sm transition-colors"
        >
          <span>🚪</span>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
