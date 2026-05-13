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

interface FormState {
  email: string
  full_name: string
  role: string
  password: string
  is_active: boolean
}
const emptyForm = (): FormState => ({ email: '', full_name: '', role: 'judge', password: '', is_active: true })

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [me, setMe] = useState<{ id: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)

  // Modal compartido para crear / editar
  const [mode, setMode] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Confirm delete
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filtros
  const [filterRole, setFilterRole] = useState<string>('')
  const [filterText, setFilterText] = useState('')

  async function load() {
    const [usersRes, meRes] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/auth/me').catch(() => null),
    ])
    const data = await usersRes.json()
    setUsers(data.users ?? [])
    if (meRes?.ok) {
      const meData = await meRes.json()
      setMe(meData?.user ? { id: meData.user.id, role: meData.user.role } : null)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setMode('create')
    setEditingId(null)
    setForm(emptyForm())
    setError('')
  }
  function openEdit(u: AppUser) {
    setMode('edit')
    setEditingId(u.id)
    setForm({
      email: u.email,
      full_name: u.full_name ?? '',
      role: u.role,
      password: '',
      is_active: u.is_active !== false,
    })
    setError('')
  }
  function closeModal() {
    setMode(null); setEditingId(null); setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      if (mode === 'create') {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email, password: form.password, full_name: form.full_name, role: form.role,
            tournament_id: TOURNAMENT_ID,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Error al crear'); return }
        closeModal(); await load()
      } else if (mode === 'edit' && editingId) {
        const body: any = {
          email: form.email,
          full_name: form.full_name,
          role: form.role,
          is_active: form.is_active,
        }
        if (form.password.trim()) body.password = form.password
        const res = await fetch(`/api/users/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Error al guardar'); return }
        closeModal(); await load()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deletingId) return
    setDeleting(true)
    const res = await fetch(`/api/users/${deletingId}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setDeleting(false)
    if (!res.ok) {
      alert(`✗ ${data.error || 'No se pudo borrar el usuario'}`)
      return
    }
    setDeletingId(null)
    await load()
  }

  const filtered = users
    .filter(u => !filterRole || u.role === filterRole)
    .filter(u => !filterText
      || u.full_name?.toLowerCase().includes(filterText.toLowerCase())
      || u.email?.toLowerCase().includes(filterText.toLowerCase()))

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-score">Usuarios</h1>
          <p className="text-gray-400 text-sm">{users.length} usuarios · {filtered.length} mostrados</p>
        </div>
        <button onClick={openCreate}
          className="bg-brand-red hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          + Nuevo usuario
        </button>
      </div>

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
            <button onClick={openCreate}
              className="bg-brand-red hover:bg-red-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors">
              + Crear primer usuario
            </button>
          </div>
        )}

        {!loading && filtered.map((u) => {
          const isSelf = me?.id === u.id
          const canEdit = !(me?.role === 'tournament_director' && u.role === 'super_admin')
          const canDelete = canEdit && !isSelf
          return (
            <div key={u.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-gray-700 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-white font-medium truncate flex items-center gap-2">
                  {u.full_name}
                  {isSelf && <span className="text-[10px] uppercase tracking-widest text-brand-red font-bold">· tú</span>}
                </p>
                <p className="text-gray-500 text-sm truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={roleColors[u.role] ?? 'default'}>{roleLabel(u.role)}</Badge>
                {!u.is_active && <Badge variant="warning">Inactivo</Badge>}
                <button
                  onClick={() => openEdit(u)}
                  disabled={!canEdit}
                  title={!canEdit ? 'Sin permisos sobre este usuario' : 'Editar'}
                  className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 text-xs font-medium transition-colors">
                  ✎ Editar
                </button>
                <button
                  onClick={() => setDeletingId(u.id)}
                  disabled={!canDelete}
                  title={isSelf ? 'No puedes borrarte a ti mismo' : !canEdit ? 'Sin permisos' : 'Borrar'}
                  className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 disabled:opacity-25 disabled:cursor-not-allowed text-red-300 text-xs font-medium border border-red-900/40 transition-colors">
                  🗑
                </button>
              </div>
            </div>
          )
        })}

        {!loading && users.length > 0 && filtered.length === 0 && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 text-center">
            <p className="text-gray-500 text-sm">Ningún usuario coincide con los filtros.</p>
          </div>
        )}
      </div>

      {/* ── Modal crear / editar ── */}
      {mode !== null && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={closeModal}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-lg space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-white text-lg font-semibold">
                {mode === 'create' ? 'Crear usuario' : 'Editar usuario'}
              </h2>
              <button type="button" onClick={closeModal} className="text-gray-500 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Nombre completo</label>
                <input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Juan García" required
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="juez@vinteon.com" required
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Rol</label>
                <select value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red">
                  <option value="judge">Juez árbitro</option>
                  <option value="commentator">🎙️ Comentarista</option>
                  <option value="staff">Staff</option>
                  <option value="tournament_director">Director de torneo</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">
                  {mode === 'create' ? 'Contraseña temporal' : 'Nueva contraseña (opcional)'}
                </label>
                <input type="password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={mode === 'create' ? '········' : 'Dejar vacío para no cambiarla'}
                  required={mode === 'create'}
                  autoComplete="new-password"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red" />
              </div>
              {mode === 'edit' && (
                <div className="col-span-2 flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={form.is_active}
                      onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      className="w-4 h-4 accent-brand-red" />
                    <span className="text-sm text-gray-300">Usuario activo</span>
                  </label>
                  <span className="text-[10px] text-gray-600 italic">
                    Desmarcado: el usuario no podrá iniciar sesión.
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-2 text-red-300 text-sm">{error}</div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={submitting}
                className="bg-brand-red hover:bg-red-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
                {submitting ? 'Guardando...' : (mode === 'create' ? 'Crear usuario' : 'Guardar cambios')}
              </button>
              <button type="button" onClick={closeModal}
                className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-sm">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal confirmar borrado ── */}
      {deletingId !== null && (() => {
        const target = users.find(u => u.id === deletingId)
        if (!target) return null
        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={() => !deleting && setDeletingId(null)}>
            <div className="bg-gray-900 rounded-2xl border border-red-900/60 p-6 w-full max-w-md space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div>
                <h2 className="text-red-300 text-lg font-semibold">🗑 Borrar usuario</h2>
                <p className="text-gray-400 text-sm mt-2">
                  Vas a borrar a <strong className="text-white">{target.full_name}</strong> ({target.email}).
                </p>
                <p className="text-gray-500 text-xs mt-3 leading-relaxed">
                  Esta acción borra al usuario tanto de Supabase Auth como de la tabla de usuarios.
                  Los partidos que arbitró siguen existiendo pero pierden la referencia al juez (FK queda en null).
                  No se puede deshacer.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button onClick={handleDelete} disabled={deleting}
                  className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold">
                  {deleting ? 'Borrando...' : 'Sí, borrar definitivamente'}
                </button>
                <button onClick={() => setDeletingId(null)} disabled={deleting}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
