'use client'

import { useEffect, useState } from 'react'
import type { AppUser } from '@/types'
import { Badge } from '@/components/ui/badge'
import { roleLabel } from '@/lib/labels'
import { DEFAULT_TOURNAMENT_ID } from '@/lib/tournament-constants'

const TOURNAMENT_ID = DEFAULT_TOURNAMENT_ID
const roleColors: Record<string, any> = {
  super_admin: 'danger', tournament_director: 'warning', staff: 'info', judge: 'success', commentator: 'default',
}

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'judge', password: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  // Filtros — antes la lista era plana sin manera de buscar por rol
  // o nombre. Con 20+ árbitros se hacía ilegible.
  const [filterRole, setFilterRole] = useState<string>('')
  const [filterText, setFilterText] = useState('')

  async function load() {
    const res = await fetch('/api/users')
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, tournament_id: TOURNAMENT_ID }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error) } else { setShowForm(false); load() }
    setCreating(false)
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-score">Usuarios</h1>
          <p className="text-gray-400 text-sm">{users.length} usuarios</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-brand-red hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          + Nuevo usuario
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-900 rounded-2xl p-5 border border-gray-800 space-y-4">
          <h2 className="text-white font-semibold">Crear usuario</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'full_name', label: 'Nombre completo', placeholder: 'Juan García' },
              { key: 'email', label: 'Email', placeholder: 'juez@rfet.es', type: 'email' },
              { key: 'password', label: 'Contraseña temporal', placeholder: '········', type: 'password' },
            ].map(({ key, label, placeholder, type = 'text' }) => (
              <div key={key}>
                <label className="block text-sm text-gray-400 mb-1">{label}</label>
                <input type={type} value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder} required
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
              </div>
            ))}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Rol</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red">
                <option value="judge">Juez árbitro</option>
                <option value="commentator">🎙️ Comentarista</option>
                <option value="staff">Staff</option>
                <option value="tournament_director">Director de torneo</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>
          {error && <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-2 text-red-300 text-sm">{error}</div>}
          <div className="flex gap-3">
            <button type="submit" disabled={creating}
              className="bg-brand-red hover:bg-red-600 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm">
              {creating ? 'Creando...' : 'Crear usuario'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2 rounded-xl text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Filtros */}
      {!loading && users.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Buscar por nombre o email…"
            className="flex-1 min-w-[200px] bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-brand-red"
          />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-red"
          >
            <option value="">Todos los roles</option>
            <option value="super_admin">Super admin</option>
            <option value="tournament_director">Director</option>
            <option value="staff">Personal</option>
            <option value="judge">Árbitro</option>
            <option value="commentator">Comentarista</option>
          </select>
        </div>
      )}

      <div className="space-y-2">
        {loading && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <p className="text-gray-500 text-sm">Cargando usuarios...</p>
          </div>
        )}

        {!loading && users.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-3">👥</div>
            <p className="text-white font-medium mb-1">No hay usuarios todavía</p>
            <p className="text-gray-500 text-sm mb-4">Crea el primero para que puedan acceder al sistema</p>
            <button onClick={() => setShowForm(true)}
              className="bg-brand-red hover:bg-red-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors">
              + Crear primer usuario
            </button>
          </div>
        )}

        {!loading && users
          .filter(u => !filterRole || u.role === filterRole)
          .filter(u => !filterText
            || u.full_name?.toLowerCase().includes(filterText.toLowerCase())
            || u.email?.toLowerCase().includes(filterText.toLowerCase()))
          .map((u) => (
            <div key={u.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-white font-medium truncate">{u.full_name}</p>
                <p className="text-gray-500 text-sm truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={roleColors[u.role] ?? 'default'}>{roleLabel(u.role)}</Badge>
                {!u.is_active && <Badge variant="warning">Inactivo</Badge>}
              </div>
            </div>
          ))}

        {!loading && users.length > 0 &&
          users.filter(u => !filterRole || u.role === filterRole)
            .filter(u => !filterText
              || u.full_name?.toLowerCase().includes(filterText.toLowerCase())
              || u.email?.toLowerCase().includes(filterText.toLowerCase())).length === 0 && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 text-center">
            <p className="text-gray-500 text-sm">Ningún usuario coincide con los filtros.</p>
          </div>
        )}
      </div>
    </div>
  )
}
