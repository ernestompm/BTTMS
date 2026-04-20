# BTTMS v2.0 — Guía de Despliegue Gratuito
## Vercel (frontend) + Supabase (DB + Auth + Realtime)

**Tiempo estimado: 20–30 minutos**
**Coste: 0 € (tier gratuito cubre un campeonato nacional)**

---

## PASO 1 — Crear proyecto en Supabase

1. Ve a https://supabase.com y crea una cuenta (GitHub login recomendado)
2. Crea un nuevo proyecto:
   - Nombre: `bttms`
   - Contraseña de DB: genera una fuerte y guárdala
   - Región: `West EU (Ireland)` o la más cercana
3. Espera ~2 min a que el proyecto se inicie
4. Ve a **Settings → API** y copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_KEY` (⚠️ nunca en el cliente)

---

## PASO 2 — Ejecutar las migraciones SQL

En Supabase, ve a **SQL Editor** y ejecuta los archivos en este orden:

```
1. supabase/migrations/001_schema.sql
2. supabase/migrations/002_rls.sql
3. supabase/migrations/003_functions.sql
4. supabase/migrations/004_seed_admin.sql
```

Copia el contenido de cada archivo y haz clic en "Run".

---

## PASO 3 — Subir código a GitHub

```bash
# En la carpeta bttms/
git init
git add .
git commit -m "feat: BTTMS v2.0 initial commit"

# Crea un repo en github.com y sigue las instrucciones para subir
git remote add origin https://github.com/TU_USUARIO/bttms.git
git push -u origin main
```

---

## PASO 4 — Desplegar en Vercel

1. Ve a https://vercel.com y crea cuenta (conecta con GitHub)
2. Clic en **"Add New → Project"**
3. Importa el repo `bttms` de GitHub
4. En **Environment Variables**, agrega estas variables:

| Variable | Valor | Visibilidad |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Public |
| `SUPABASE_SERVICE_KEY` | `eyJ...` | **Secret** |
| `BROADCAST_ENCRYPTION_KEY` | genera con el comando de abajo | **Secret** |
| `NEXT_PUBLIC_APP_URL` | `https://bttms.vercel.app` | Public |

Para generar BROADCAST_ENCRYPTION_KEY:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. Clic en **Deploy** — Vercel construye y despliega automáticamente
6. Tu URL será algo como: `https://bttms-xxx.vercel.app`
7. Actualiza `NEXT_PUBLIC_APP_URL` con la URL real de Vercel

---

## PASO 5 — Crear el primer usuario Super Admin

Con el proyecto desplegado, haz esta llamada API (una sola vez):

```bash
curl -X POST https://TU-URL.vercel.app/api/setup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@tuclub.es",
    "password": "TuContraseñaSegura123!",
    "full_name": "Administrador RFET"
  }'
```

O con PowerShell (Windows):
```powershell
Invoke-RestMethod -Method POST `
  -Uri "https://TU-URL.vercel.app/api/setup" `
  -ContentType "application/json" `
  -Body '{"email":"admin@tuclub.es","password":"TuContraseña123!","full_name":"Admin RFET"}'
```

Respuesta esperada: `{"success":true,"message":"Super admin created: admin@tuclub.es"}`

---

## PASO 6 — Primer acceso y configuración

1. Ve a `https://TU-URL.vercel.app/login`
2. Inicia sesión con el email y contraseña del paso 5
3. Llegarás al **Dashboard de control**
4. Ve a **Torneo → Configurar** y actualiza los datos del torneo
5. Ve a **Usuarios** y crea los usuarios para jueces y staff
6. Ve a **Jugadores** y registra los jugadores

---

## FLUJO COMPLETO DE USO

### Para crear y arbitrar un partido:
1. Crea jugadores en `/dashboard/players`
2. Crea una inscripción (draw entry) en `/dashboard/draws`
3. Crea el partido en `/dashboard/matches/new` asignando:
   - Categoría, ronda, pista, árbitro y las dos parejas
4. El árbitro accede a `/judge` desde su tablet
5. Selecciona el partido → hace el sorteo → arbitraje en tiempo real
6. El marcador se ve en `/scoreboard/[matchId]` (URL pública, sin login)

### URLs clave del sistema:
```
/login                    → Login
/dashboard                → Panel de control (admin)
/dashboard/matches        → Lista de partidos
/dashboard/players        → Jugadores
/dashboard/draws          → Cuadros
/dashboard/tournament     → Config torneo + scoreboard
/dashboard/users          → Gestión de usuarios
/dashboard/stats          → Stats Center
/broadcast                → Dashboard TV
/judge                    → Judge App (árbitros)
/judge/[matchId]          → Arbitraje de partido específico
/scoreboard/[matchId]     → Marcador público (sin login)
/players/[id]             → Perfil público del jugador
```

---

## TESTAR EN LOCAL (desarrollo)

```bash
cd bttms
npm install

# Crear .env.local con tus credenciales de Supabase
cp .env.local.example .env.local
# Edita .env.local con tus valores reales

npm run dev
# Abre http://localhost:3000
```

---

## HABILITAR REALTIME en Supabase

Para que el marcador y la Judge App se actualicen en tiempo real:

1. Ve a **Supabase → Database → Replication**
2. En "Tables", activa **Realtime** para la tabla `matches`
3. Opcionalmente activa también `points`

---

## COSTES DEL TIER GRATUITO

| Servicio | Límite free | ¿Suficiente? |
|---|---|---|
| Vercel Hobby | Sin límite de deploys, 100GB bandwidth/mes | ✅ Sí |
| Supabase Free | 500MB DB, 50MB Storage, 50k MAU Auth | ✅ Para 1 torneo |
| Open-Meteo API | Sin límites, sin API key | ✅ |
| GitHub | Repos privados gratuitos | ✅ |

**Si se escala** (circuito completo >50 torneos/año):
- Vercel Pro: $20/mes
- Supabase Pro: $25/mes
- **Total: $45/mes máximo**

---

## DOMINIO PERSONALIZADO (opcional, gratuito en Vercel)

1. En Vercel → Settings → Domains
2. Añade tu dominio (ej: `bttms.rfet.es`)
3. Configura los DNS en tu proveedor de dominio (registros CNAME/A)
4. Vercel gestiona SSL automáticamente (Let's Encrypt)

---

## SOLUCIÓN DE PROBLEMAS COMUNES

**Error "User not found" al login:**
→ Asegúrate de haber ejecutado `/api/setup` y que el usuario existe en `app_users`

**El marcador no se actualiza en tiempo real:**
→ Activa Realtime en Supabase para la tabla `matches`

**Error 500 en API routes:**
→ Verifica que `SUPABASE_SERVICE_KEY` esté configurada en Vercel (sin prefijo NEXT_PUBLIC_)

**RLS blocking queries:**
→ Verifica que ejecutaste `002_rls.sql` correctamente en Supabase

**Build falla en Vercel:**
→ Asegúrate de que todas las variables de entorno están configuradas antes del deploy
