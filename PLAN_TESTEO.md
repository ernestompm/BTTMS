# Plan de Testeo — BTTMS v2.0

**Proyecto:** Beach Tennis Tournament Management System
**Cliente:** Vinteon Media / RFET
**Objetivo:** Validar el sistema antes del Campeonato de España de Tenis Playa 2026
**Duración estimada:** 3-5 días de testing intensivo

---

## 1. Roles del equipo de testeo

| Rol | Responsabilidad | Nº personas sugeridas |
|---|---|---|
| **Super Admin** | Configuración global, usuarios, torneos | 1 |
| **Admin de torneo** | Inscripciones, sorteos, calendario | 1-2 |
| **Juez de silla** | Marcar puntos en partidos en vivo | 2-3 |
| **Jugador** | Perfil, inscripción, consulta de resultados | 3-5 |
| **Espectador / Streaming** | Scoreboard público, overlay OBS | 1-2 |

---

## 2. Pre-requisitos (antes de empezar)

- [ ] Proyecto desplegado en Vercel + Supabase (ver `DEPLOY.md`)
- [ ] Migraciones SQL 001–017 aplicadas en Supabase
- [ ] Super Admin creado vía `POST /api/setup`
- [ ] URL del entorno de pruebas compartida con el equipo
- [ ] Crear hoja compartida (Google Sheets / Notion) para registrar bugs
- [ ] Dispositivos: 1 PC, 2 tablets, 3 móviles (iOS + Android)
- [ ] Probar con red 4G real (no solo wifi) para los jueces

---

## 3. Fases de testeo

### FASE 1 — Smoke test (2 horas)
Validar que el sistema arranca y los flujos básicos no rompen.

- [ ] Login con super_admin
- [ ] Crear un torneo de prueba
- [ ] Crear un jugador manualmente
- [ ] Crear un partido y abrirlo en `/judge`
- [ ] Marcar 1 punto y ver que aparece en `/scoreboard`
- [ ] Cerrar sesión

**Criterio de paso:** ningún 500, ningún crash de cliente.

---

### FASE 2 — Gestión administrativa (1 día)

#### 2.1 Usuarios y roles (`/dashboard/users`)
- [ ] Crear usuario admin, juez y jugador
- [ ] Cambiar rol de un usuario existente
- [ ] Desactivar usuario y verificar que no puede entrar
- [ ] Probar permisos: un juez NO debe ver `/dashboard/users`

#### 2.2 Torneos (`/dashboard/tournament`)
- [ ] Crear torneo con todas las categorías RFET
- [ ] Editar fechas, sede, formato
- [ ] Cerrar torneo y verificar bloqueo de inscripciones

#### 2.3 Jugadores (`/dashboard/players`)
- [ ] Importar CSV de jugadores (si aplica)
- [ ] Editar perfil (foto, ranking, club)
- [ ] Invitar jugador por email (`player_invites`)
- [ ] Verificar que el jugador puede acceder a `/player-profile`

#### 2.4 Sorteos (`/dashboard/draws`)
- [ ] Generar cuadro de eliminación directa
- [ ] Generar fase de grupos
- [ ] Re-sortear y verificar que los partidos se regeneran
- [ ] Verificar `lib/draw-engine.ts` con cabezas de serie

#### 2.5 Calendario (`/dashboard/schedule`)
- [ ] Asignar pista y horario a un partido
- [ ] Detectar choques de horario (mismo jugador, dos pistas)
- [ ] Reprogramar y verificar notificación

---

### FASE 3 — Reglas de puntuación RFET (CRÍTICO — 1 día)

> Este es el módulo más sensible. `lib/score-engine.ts` debe respetar las reglas RFET de tenis playa.

#### 3.1 Saque
- [ ] Solo se permite **un saque** (no hay segundo)
- [ ] Falta de saque = punto para el rival
- [ ] Doble falta NO existe (validar que la UI no lo permite)

#### 3.2 Zona prohibida
- [ ] Punto en zona prohibida = anula y penaliza
- [ ] Probar el botón en `/judge` y comprobar log

#### 3.3 Super tie-break
- [ ] Set se decide a 6 con diferencia de 2
- [ ] A 6-6 se juega tie-break a 7
- [ ] Tercer set = super tie-break a 10

#### 3.4 Estados del partido (`009_match_states.sql`)
- [ ] `scheduled → in_progress → finished`
- [ ] Pausa por lluvia → estado `suspended`
- [ ] Walkover y retirada
- [ ] Verificar que estados se guardan tras refrescar

#### 3.5 Amonestaciones (`008_warnings.sql`)
- [ ] Warning verbal
- [ ] Punto de penalización
- [ ] Game de penalización
- [ ] Descalificación

---

### FASE 4 — Tiempo real y conexión (1 día)

#### 4.1 Realtime Supabase (`010_realtime.sql`)
- [ ] Abrir `/judge` en tablet y `/scoreboard` en otro dispositivo
- [ ] Marcar punto → debe aparecer en <1 segundo en scoreboard
- [ ] Probar con 5 partidos simultáneos
- [ ] Probar con 50 espectadores conectados al scoreboard

#### 4.2 Modo offline (`lib/use-offline-queue.ts`)
- [ ] Activar modo avión en la tablet del juez durante un punto
- [ ] Marcar 5 puntos sin conexión
- [ ] Restaurar conexión → verificar que se sincronizan en orden
- [ ] No debe haber puntos duplicados ni perdidos

#### 4.3 Estadísticas por punto (`007_stats_per_point.sql`, `011_advanced_stats.sql`)
- [ ] Contar aces, winners, errores no forzados
- [ ] Verificar que se reflejan en `/dashboard/stats`
- [ ] Exportar estadísticas (si hay export)

---

### FASE 5 — Streaming y broadcast (medio día)

#### 5.1 Overlay OBS (`/overlay`, `STREAMING.md`)
- [ ] Cargar URL de overlay en OBS Studio
- [ ] Verificar transparencia
- [ ] Cambio de marcador en vivo
- [ ] Logos de patrocinadores RFET / Vinteon

#### 5.2 Stream público (`/stream`, `015_streaming_graphics.sql`)
- [ ] Configurar gráficos en `/dashboard/streaming`
- [ ] Preview en `/stream`
- [ ] Cambiar plantilla y ver actualización

#### 5.3 Broadcast push (`lib/broadcast-push.ts`)
- [ ] Forzar push manual
- [ ] Verificar logs en `014_match_close_and_broadcast_logs.sql`

---

### FASE 6 — UX en dispositivos reales (medio día)

| Dispositivo | Ruta a probar | Qué validar |
|---|---|---|
| Tablet iPad | `/judge` | Botones grandes, no se duerme la pantalla |
| Móvil Android | `/player-profile` | Formularios, foto |
| Móvil iOS Safari | `/scoreboard` | Sin parpadeo, fuentes legibles |
| PC Chrome | `/dashboard/*` | Tablas, exports |
| Smart TV / proyector | `/overlay` | Resolución 1920x1080 |

- [ ] Probar bajo sol directo (legibilidad)
- [ ] Probar con guantes / dedos mojados (jueces en playa)
- [ ] Latencia con red 4G en zona costera

---

### FASE 7 — Seguridad y permisos (medio día)

- [ ] RLS de Supabase: un jugador NO puede leer datos de otro torneo
- [ ] Un juez NO puede modificar partidos que no le asignaron
- [ ] Token de invitación de jugador caduca
- [ ] `/api/setup` se desactiva tras crear el primer admin
- [ ] Middleware (`middleware.ts`) bloquea rutas privadas sin sesión

---

## 4. Plantilla de reporte de bugs

Cada bug debe registrarse con:

```
ID: BUG-001
Severidad: [Crítica / Alta / Media / Baja]
Módulo: [Judge / Admin / Streaming / ...]
Dispositivo: [iPad iOS 17 / Chrome 120 / ...]
Pasos para reproducir:
1.
2.
3.
Resultado esperado:
Resultado obtenido:
Captura / vídeo:
Asignado a:
```

**Severidades:**
- **Crítica** — bloquea un partido en vivo (puntos perdidos, crash del juez)
- **Alta** — afecta a un torneo pero hay workaround
- **Media** — UX mejorable, no bloquea
- **Baja** — cosmético

---

## 5. Criterios de aceptación final

El sistema está listo para el Campeonato cuando:

- [ ] 0 bugs críticos abiertos
- [ ] ≤ 3 bugs altos con workaround documentado
- [ ] Score engine validado por un juez RFET certificado
- [ ] Prueba de carga: 10 partidos simultáneos + 200 espectadores sin caídas
- [ ] Modo offline probado en 3 dispositivos diferentes
- [ ] Overlay OBS aprobado por equipo de producción de Vinteon

---

## 6. Cronograma sugerido

| Día | Fase | Responsable |
|---|---|---|
| 1 (mañana) | Fase 1 — Smoke | Todo el equipo |
| 1 (tarde) | Fase 2 — Admin | Admins |
| 2 | Fase 3 — Scoring RFET | Jueces + dev |
| 3 | Fase 4 — Realtime / Offline | Jueces + QA |
| 4 (mañana) | Fase 5 — Streaming | Producción Vinteon |
| 4 (tarde) | Fase 6 — Devices | Todo el equipo |
| 5 | Fase 7 — Seguridad + retest | QA + dev |

---

**Contacto técnico:** [completar]
**Hoja de bugs:** [enlace a Sheet/Notion]
**Repositorio:** `bttms/`
