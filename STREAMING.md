# 🎬 BTTMS — Streaming Graphics Engine

Herramienta de grafismo broadcast con **10 gráficos animados de calidad TV**, salida alpha para vMix, operación manual + automática por estado de partido, y URL independiente por partido para operar varios streams en paralelo.

---

## 1. Pasos en base de datos (ejecutar **en orden** en Supabase SQL Editor)

### 1.1 Migración principal
Ejecuta el contenido de:

```
supabase/migrations/015_streaming_graphics.sql
```

Esto crea:
- `stream_sessions` · sesión por partido (toggleable)
- `stream_state` · estado en vivo de los 10 gráficos (JSONB, realtime)
- `stream_automation_rules` · reglas trigger → acciones (por torneo)
- `stream_events` · log de todo lo que pasa (auditoría)
- RLS abierta en lectura (los overlays son anónimos) y escritura restringida a staff
- Trigger que inicializa `stream_state` automáticamente al crear sesión
- Realtime sobre `stream_state` y `stream_sessions`
- RPC `stream_patch_graphic(session_id, key, patch)` para mutaciones atómicas
- RPC `stream_hide_all(session_id)` para el botón STOP
- Función `seed_default_stream_rules(tournament_id)` que crea 7 reglas por defecto
- Seed automático para torneos existentes

### 1.2 Sembrar reglas para torneos nuevos
Cada vez que crees un torneo nuevo, ejecuta:

```sql
SELECT seed_default_stream_rules('<TOURNAMENT_ID>');
```

(Opcional: añade esto a tu flujo de creación de torneos.)

---

## 2. URLs generadas por partido

| URL                              | Uso                                  |
|----------------------------------|--------------------------------------|
| `/overlay/<matchId>`             | **Fuente para vMix (alpha)**         |
| `/stream/<matchId>`              | **Botonera operador** (control)      |
| `/dashboard/streaming`           | Admin: activar partidos, copiar URLs |

> **vMix**: Input → Web Browser → URL `http://tu-dominio/overlay/<matchId>` → activa "Supports transparent backgrounds".

---

## 3. Catálogo de gráficos (10)

| #  | Key                   | Tipo          | Atajo | Z-idx |
|----|-----------------------|---------------|-------|-------|
| 1  | `tournament_intro`    | Fullscreen    | `1`   | 400   |
| 2  | `venue_card`          | Fullscreen    | `2`   | 400   |
| 3  | `match_presentation`  | Fullscreen VS | `3`   | 400   |
| 4  | `player_bio`          | Side panel    | `4`   | 600   |
| 5  | `coin_toss`           | Center modal  | `5`   | 450   |
| 6  | `referee_lower_third` | Lower third   | `6`   | 800   |
| 7  | `scorebug`            | Top-left bug  | `Q`   | 1000  |
| 8  | `big_scoreboard`      | Lower third   | `W`   | 850   |
| 9  | `stats_panel`         | Right panel   | `E`   | 700   |
| 10 | `results_grid`        | Center modal  | `R`   | 500   |

- `ESC` oculta todos los gráficos (**STOP**).
- Transiciones de entrada/salida con curva `cubic-bezier(.22,.9,.25,1)` y duraciones 500–900 ms.
- Proporciones pensadas para **1920×1080** con mínimos legibles en móvil (texto mínimo 22 px a escala nativa → ≥40 px en fullscreens, 110 px en apellidos de presentación, 168 px en marcador grande).
- Banderas desde `/public/Flags/<ISO>.jpg`.
- Paleta heredada de `scoreboard_config` del torneo (consistente con venue-scoreboard).

### Flags automáticos del scorebug
Se detectan y se pintan con color/parpadeo:
- 🔴 **PUNTO DE PARTIDO**
- 🟠 **PUNTO DE CAMPEONATO** (cuando `round === 'F'`)
- 🟣 **PUNTO DE SET**
- 🔵 **BOLA DE BREAK**
- 🟡 **PUNTO DE ORO** (deuce beach tennis)

Lógica en `lib/streaming/flags.ts`.

---

## 4. Automatización

**Dónde se ejecuta**: cliente, dentro del panel operador (`OperatorPanel` → `AutomationRunner`). Escucha `matches` por Realtime, diferencia snapshots y dispara los triggers.

### Triggers disponibles

```
match_status:<scheduled|judge_on_court|players_on_court|warmup|in_progress|suspended|finished|retired|walkover>
game_end
set_end
match_end
toss_set
manual
```

### Formato de `actions`

```json
[
  { "type":"show", "graphic":"scorebug",       "delay_ms":0 },
  { "type":"show", "graphic":"big_scoreboard", "delay_ms":2000 },
  { "type":"hide", "graphic":"big_scoreboard", "delay_ms":12000 }
]
```

Cada acción se programa con `setTimeout(delay_ms)` desde el momento del trigger. Si un gráfico recibe una nueva cadena, la anterior se cancela (evita conflictos).

### Reglas sembradas por defecto

1. **Árbitro en pista** → lower third del árbitro (0.5 s → 8 s → ocultar)
2. **Calentamiento** → presentación del partido (12 s)
3. **Sorteo registrado** → coin toss (7 s)
4. **Partido en juego** → scorebug persistente
5. **Fin de juego** → big scoreboard (espera 2 s, mantiene 10 s, oculta)
6. **Fin de set** → oculta scorebug, estadísticas 15 s, vuelve scorebug
7. **Fin de partido** → big scoreboard + stats totales

Las reglas son editables por tournament_director / super_admin vía SQL (tabla `stream_automation_rules`).

---

## 5. Arquitectura

```
┌────────────────────┐    postgres_changes    ┌────────────────────┐
│  OperatorPanel     │ ─────────────────────▶ │  OverlayStage      │
│  /stream/[id]      │                        │  /overlay/[id]     │
│  · 10 botones      │  RPC stream_patch_*    │  · render 10 SVG/  │
│  · AutomationRunner│ ─────────────────────▶ │    HTML graphics   │
│  · iframe preview  │                        │  · bg transparent  │
└──────────┬─────────┘                        └─────────┬──────────┘
           │                                            │
           │ UPDATE matches                             │ UPDATE matches
           │ (Realtime)                                 │ (Realtime)
           │                                            │
           ▼                                            ▼
    ┌──────────────────────────────────────────────────────┐
    │             Supabase Postgres + Realtime             │
    │  matches · stream_state · stream_sessions · rules    │
    └──────────────────────────────────────────────────────┘
```

### Comunicación operador ↔ overlay
- **Operador** llama `showGraphic / hideGraphic` en `lib/streaming/commands.ts`
- Éstos hacen un UPDATE atómico sobre `stream_state.graphics` (JSONB)
- **Overlay** subscribe a `stream_state` y re-renderiza al cambiar

---

## 6. Varios streams simultáneos

Cada partido tiene **una única** `stream_sessions` (constraint `UNIQUE(match_id)`) y por tanto **una URL y un operador independientes**. Dos operadores pueden trabajar en paralelo sin interferencia porque:

1. Los canales Realtime van filtrados por `session_id`
2. Los RPCs operan sobre un único `session_id`
3. El `AutomationRunner` en un operador solo toca su sesión

Ejemplo: si tienes una final en Pista Central y otra en Pista 2, activas ambos en `/dashboard/streaming`, abres dos pestañas con `/stream/<id1>` y `/stream/<id2>`, y metes `http://.../overlay/<id1>` y `.../overlay/<id2>` como 2 inputs diferentes en vMix.

---

## 7. Diseño tipográfico

Todas las medidas en px nativos 1920×1080; en móvil escalan proporcionalmente por el `transform: scale()` del stage.

| Zona                              | Tamaño | Peso |
|-----------------------------------|--------|------|
| Intro torneo · nombre             | 170    | 900  |
| Intro torneo · edición            | 38     | 700  |
| Venue · nombre                    | 220    | 900  |
| Match pres · apellido             | 110    | 900  |
| Match pres · VS                   | 320    | 900  |
| Bio · apellido                    | 56     | 900  |
| Bio · datos                       | 28     | 800  |
| Referee LT · nombre               | 70     | 900  |
| Scorebug · apellido (singles)     | 36     | 900  |
| Scorebug · puntos                 | 44     | 900  |
| Big scoreboard · sets ganados     | 72     | 900  |
| Big scoreboard · apellido         | 44     | 900  |
| Stats panel · valor               | 30     | 900  |

Todo usa `Barlow Condensed` (apilado con `system-ui` como fallback). Los números marcan `fontVariantNumeric: 'tabular-nums'` para no "bailar".

---

## 8. Atajos teclado (operador)

```
1 → Intro torneo
2 → Venue
3 → Presentación partido
4 → Bio jugador (seleccionar primero con chip)
5 → Coin toss
6 → Árbitro
Q → Scorebug
W → Marcador grande
E → Estadísticas
R → Resultados
ESC → STOP (oculta todo)
```

---

## 9. Troubleshooting

- **El overlay no se transparenta en vMix**: confirma que has marcado *Supports transparent backgrounds* en el input de vMix.
- **El overlay carga pero no se ven gráficos**: verifica que existe la fila en `stream_state` (se crea automáticamente al crear la sesión; si falta, reinserta con `INSERT INTO stream_state (session_id) VALUES ('<id>')`).
- **Realtime no actualiza**: ejecuta `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename IN ('stream_state','stream_sessions');` — deben aparecer ambas. Si no, ejecuta manualmente `ALTER PUBLICATION supabase_realtime ADD TABLE stream_state, stream_sessions;`
- **Reglas no disparan**: revisa `stream_events` de la sesión; los eventos aparecen con `kind='auto_trigger'` y `kind='auto_action'`. Si faltan, confirma que `automation_enabled=true` en `stream_sessions`.

---

## 10. Extensibilidad

- **Añadir un 11.º gráfico**: componente nuevo en `components/streaming/graphics.tsx`, entrada en `lib/streaming/catalog.ts` (`GRAPHICS[...]` + `GRAPHIC_ORDER`), render en `OverlayStage`, tipado del payload en `types/streaming.ts`. No hay cambios de DB (JSONB abierto).
- **Añadir un trigger**: lo detecta `AutomationRunner.onMatchChange()` a partir de un diff de snapshots. Añade el tipo a `TriggerType` y dispara con `this.fire('mi_trigger', context)`.
- **Temas por sesión**: la columna `stream_state.theme` (JSONB) está reservada para override de paleta/fuentes sin tocar el torneo.
