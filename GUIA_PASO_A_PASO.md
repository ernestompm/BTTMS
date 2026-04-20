# GUIA COMPLETA — Poner BTTMS en internet GRATIS
## Para alguien que nunca ha hecho esto antes
### Tiempo total: ~30-40 minutos

---

# ANTES DE EMPEZAR — Instalar herramientas (5 min)

Necesitas tener instalado en tu PC:

## 1. Instalar Node.js
1. Ve a: https://nodejs.org
2. Haz clic en el botón verde grande que dice **"LTS"** (la versión estable)
3. Descarga el instalador (.msi para Windows)
4. Ejecuta el instalador → siguiente, siguiente, instalar (todo por defecto)
5. Cuando termine, abre el **Símbolo del sistema** (busca "cmd" en Windows)
6. Escribe esto y pulsa Enter:
   ```
   node --version
   ```
7. Si ves algo como `v20.11.0` → correcto, Node está instalado

## 2. Instalar Git
1. Ve a: https://git-scm.com/download/win
2. Descarga el instalador de Windows
3. Ejecuta → siguiente en todo (opciones por defecto)
4. Verifica en cmd:
   ```
   git --version
   ```
5. Si ves `git version 2.x.x` → correcto

---

# PARTE 1 — SUPABASE (Base de datos) ~10 min

Supabase es donde se guardan todos los datos (partidos, jugadores, etc.)

## Paso 1.1 — Crear cuenta en Supabase
1. Ve a: **https://supabase.com**
2. Clic en **"Start your project"** (botón verde)
3. Clic en **"Sign up"**
4. Usa tu cuenta de GitHub o Google para registrarte (más fácil)
5. Verifica tu email si te lo pide

## Paso 1.2 — Crear el proyecto
1. Una vez dentro, clic en **"New project"**
2. Rellena así:
   - **Name**: `bttms`
   - **Database Password**: haz clic en **"Generate"** y GUARDA esa contraseña en un bloc de notas
   - **Region**: `West EU (Ireland)` o `EU Central (Frankfurt)`
3. Clic en **"Create new project"**
4. **ESPERA** — tarda 1-2 minutos en crearse. Verás una barra de progreso.

## Paso 1.3 — Copiar las claves de Supabase
Cuando el proyecto esté listo:
1. En el menú de la izquierda, haz clic en el icono de engranaje ⚙️ (**"Settings"**)
2. Clic en **"API"**
3. Verás esta pantalla — COPIA y GUARDA en un bloc de notas:

```
Project URL:     https://xxxxxxxxxxxxxxxx.supabase.co
                 (copia el tuyo, es diferente para cada proyecto)

anon public:     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                 (una cadena muy larga)

service_role:    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                 (otra cadena muy larga, DIFERENTE a la anterior)
```

> ⚠️ IMPORTANTE: La clave `service_role` es secreta. No la compartas nunca.

## Paso 1.4 — Crear la base de datos (ejecutar las migraciones SQL)
Ahora vas a crear todas las tablas. Es como darle a la base de datos el "plano" de cómo organizarse.

1. En el menú de la izquierda, haz clic en **"SQL Editor"** (icono de base de datos con código)
2. Verás un editor de texto vacío
3. Abre el archivo: `bttms/supabase/migrations/001_schema.sql` con el Bloc de notas
4. **Selecciona TODO el texto** (Ctrl+A) y **cópialo** (Ctrl+C)
5. **Pégalo** en el editor de Supabase (Ctrl+V)
6. Clic en el botón verde **"Run"** (o Ctrl+Enter)
7. Abajo verás: `Success. No rows returned` → CORRECTO

8. **Repite los pasos 3-7 para los otros 3 archivos**, en este orden:
   - `002_rls.sql`
   - `003_functions.sql`
   - `004_seed_admin.sql`

> Cada vez que ejecutes uno, borra el texto anterior antes de pegar el nuevo.

## Paso 1.5 — Activar Realtime (para que el marcador se actualice en vivo)
1. En el menú de la izquierda, busca **"Database"**
2. Clic en **"Replication"**
3. Busca la tabla **`matches`** y activa el toggle para que esté en verde
4. Haz lo mismo con la tabla **`points`**

---

# PARTE 2 — GITHUB (Guardar el código) ~5 min

GitHub es donde se guarda el código. Vercel lo leerá desde aquí.

## Paso 2.1 — Crear cuenta en GitHub
1. Ve a: **https://github.com**
2. Clic en **"Sign up"**
3. Introduce tu email, una contraseña y un nombre de usuario
4. Verifica tu email

## Paso 2.2 — Crear un repositorio vacío
1. Una vez dentro de GitHub, clic en el **"+"** arriba a la derecha
2. Clic en **"New repository"**
3. Rellena:
   - **Repository name**: `bttms`
   - **Private** (para que nadie más vea el código)
4. Clic en **"Create repository"**
5. GitHub te mostrará una página con instrucciones. **NO CIERRES ESA PÁGINA**, la necesitarás.

## Paso 2.3 — Subir el código a GitHub
1. Abre el **Símbolo del sistema** (cmd) de Windows
2. Navega a la carpeta del proyecto. Escribe esto y pulsa Enter:
   ```
   cd "C:\Users\grafi\Desktop\DESARROLLOS\Tenis Playa\bttms"
   ```
3. Ahora ejecuta estos comandos, **uno por uno**, pulsando Enter después de cada uno:
   ```
   git init
   ```
   ```
   git add .
   ```
   ```
   git commit -m "BTTMS v2.0 inicial"
   ```
   ```
   git branch -M main
   ```
4. Ahora necesitas el comando que te dio GitHub en el paso anterior.
   En la página de GitHub que dejaste abierta, busca la sección **"…or push an existing repository"**
   Verás una línea que empieza por `git remote add origin https://github.com/...`
   **Cópiala** y pégala en el cmd, luego pulsa Enter.

5. Por último:
   ```
   git push -u origin main
   ```
6. Te pedirá tu usuario y contraseña de GitHub. Introdúcelos.
7. Si ves líneas con "Writing objects: 100%" → el código se subió correctamente ✅

---

# PARTE 3 — VERCEL (Publicar en internet) ~10 min

Vercel es quien pone la web en internet de forma gratuita.

## Paso 3.1 — Crear cuenta en Vercel
1. Ve a: **https://vercel.com**
2. Clic en **"Sign Up"**
3. Elige **"Continue with GitHub"** (usa la misma cuenta que acabas de crear)
4. Autoriza Vercel a acceder a tu GitHub

## Paso 3.2 — Importar el proyecto
1. En Vercel, clic en **"Add New..."** → **"Project"**
2. Verás tu repositorio `bttms` en la lista
3. Clic en **"Import"** junto a `bttms`

## Paso 3.3 — Configurar las variables de entorno
Esta es la parte más importante. Aquí le dices a Vercel dónde está tu base de datos.

En la pantalla que aparece, busca la sección **"Environment Variables"** y añade estas 5 variables. Para cada una: escribe el nombre, pega el valor, y clic en "Add".

| Nombre (Name) | Valor (Value) |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | El "Project URL" que copiaste de Supabase (https://xxxx.supabase.co) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La clave "anon public" de Supabase (empieza por eyJ...) |
| `SUPABASE_SERVICE_KEY` | La clave "service_role" de Supabase (empieza por eyJ...) |
| `BROADCAST_ENCRYPTION_KEY` | Copia exactamente esto: `a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2` |
| `NEXT_PUBLIC_APP_URL` | Pon por ahora: `https://bttms.vercel.app` (lo actualizaremos después) |

## Paso 3.4 — Desplegar
1. Clic en el botón **"Deploy"**
2. Vercel empezará a construir la web. Verás una pantalla con logs.
3. **Espera 2-3 minutos** hasta que veas una pantalla con confeti 🎉 y el mensaje **"Congratulations!"**
4. Vercel te dará una URL como: `https://bttms-abc123.vercel.app`
   **COPIA ESA URL** — es la dirección de tu web.

## Paso 3.5 — Actualizar la URL en las variables de entorno
Ahora que ya tienes la URL real:
1. En Vercel, clic en tu proyecto → **"Settings"** → **"Environment Variables"**
2. Busca `NEXT_PUBLIC_APP_URL`
3. Clic en los 3 puntitos → **"Edit"**
4. Cambia el valor por tu URL real (ej: `https://bttms-abc123.vercel.app`)
5. Clic en **"Save"**
6. Ve a **"Deployments"** → clic en los 3 puntitos del último deploy → **"Redeploy"**

---

# PARTE 4 — CREAR EL PRIMER USUARIO ADMINISTRADOR ~2 min

Esto se hace UNA SOLA VEZ. Crea el usuario que podrá acceder al panel.

## Opción A — Con PowerShell (Windows)
1. Abre **PowerShell** (busca "powershell" en el menú de inicio)
2. Copia este bloque completo, **cambia los 3 datos marcados** y pégalo:

```powershell
Invoke-RestMethod -Method POST `
  -Uri "https://TU-URL-DE-VERCEL.vercel.app/api/setup" `
  -ContentType "application/json" `
  -Body '{"email":"TU-EMAIL@gmail.com","password":"TuContraseña123!","full_name":"Tu Nombre Completo"}'
```

Ejemplo real:
```powershell
Invoke-RestMethod -Method POST `
  -Uri "https://bttms-abc123.vercel.app/api/setup" `
  -ContentType "application/json" `
  -Body '{"email":"director@rfet.es","password":"Rfet2026!","full_name":"Director RFET"}'
```

3. Pulsa Enter
4. Si ves `success: True` → el usuario se creó correctamente ✅

## Opción B — Con el navegador (más fácil)
1. Ve a esta URL en tu navegador (cambia la URL por la tuya):
   ```
   https://TU-URL.vercel.app/api/setup
   ```
2. Verás: `{"error":"Method not allowed"}` — eso es normal, solo acepta POST.
   Usa la Opción A con PowerShell.

---

# PARTE 5 — PRIMER ACCESO Y CONFIGURACIÓN ~5 min

## Paso 5.1 — Iniciar sesión
1. Ve a tu URL: `https://TU-URL.vercel.app/login`
2. Introduce el email y contraseña que pusiste en el paso anterior
3. Deberías ver el **Panel de Control** de BTTMS ✅

## Paso 5.2 — Configurar el torneo
1. Clic en **"Torneo"** en el menú de la izquierda
2. Actualiza el nombre, venue, ciudad y fechas del torneo
3. Las coordenadas GPS de Marbella ya están cargadas (para el tiempo meteorológico)
4. Clic en **"Guardar cambios"**

## Paso 5.3 — Crear jugadores
1. Clic en **"Jugadores"** → **"+ Nuevo jugador"**
2. Rellena los datos (al menos nombre y apellidos)
3. Repite para todos los jugadores del torneo

## Paso 5.4 — Crear usuarios para árbitros y staff
1. Clic en **"Usuarios"** → **"+ Nuevo usuario"**
2. Para cada árbitro:
   - Nombre completo
   - Email (el que usará para entrar)
   - Contraseña temporal (se la das tú)
   - Rol: **"Juez árbitro"**
3. El árbitro accederá a: `TU-URL.vercel.app/judge`

## Paso 5.5 — Crear un partido de prueba
1. Clic en **"Partidos"** → **"+ Nuevo partido"**
2. Selecciona categoría, ronda, pista y árbitro
3. Clic en **"Crear partido"**

## Paso 5.6 — Ver el marcador en directo
1. Cuando el árbitro inicie el partido desde `/judge`, el marcador se actualizará en:
   ```
   TU-URL.vercel.app/scoreboard/ID-DEL-PARTIDO
   ```
2. Esta URL es pública (sin login). Puedes ponerla en una pantalla grande.

---

# RESUMEN — URLs del sistema

Una vez todo funcione, estas son las URLs que usaréis:

| Quién | URL | Para qué |
|---|---|---|
| Director/Admin | `/login` | Entrar al panel |
| Director/Admin | `/dashboard` | Panel de control |
| Director/Admin | `/dashboard/matches` | Gestionar partidos |
| Director/Admin | `/dashboard/players` | Jugadores |
| Director/Admin | `/broadcast` | Control TV |
| Árbitro (tablet) | `/judge` | Ver sus partidos |
| Árbitro (tablet) | `/judge/[id]` | Arbitrar partido |
| Pantalla gigante | `/scoreboard/[id]` | Marcador en vivo (sin login) |
| Público general | `/players/[id]` | Perfil del jugador |

---

# ¿ALGO NO FUNCIONA?

## Problema: "No puedo entrar al login"
→ Asegúrate de haber ejecutado el paso 4 (crear usuario con PowerShell)

## Problema: "Error 500 al entrar"
→ Revisa que las 5 variables de entorno en Vercel estén correctas
→ Ve a Vercel → tu proyecto → "Functions" para ver el error exacto

## Problema: "El marcador no se actualiza solo"
→ Ve a Supabase → Database → Replication → activa Realtime en la tabla `matches`

## Problema: "La build de Vercel falla"
→ Ve a Vercel → Deployments → clic en el deploy fallido → mira los logs
→ El error más común: una variable de entorno mal escrita o faltante

## Necesito ayuda
→ Dime exactamente qué paso estás haciendo y qué mensaje de error ves.
   Yo te ayudo a solucionarlo.
