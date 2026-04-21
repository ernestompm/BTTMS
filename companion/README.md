# 🎛 BTTMS + Bitfocus Companion (Stream Deck)

Config lista para importar en **[Bitfocus Companion](https://bitfocus.io/companion)** que expone los 11 gráficos principales en un Stream Deck de 15 botones (5×3) con workflow **preview → take**.

---

## Layout del deck (5 × 3)

```
┌────────┬────────┬────────┬────────┬─────────┐
│  TAKE  │OUT PGM │OUT PVW │  STOP  │ MATCH   │
├────────┼────────┼────────┼────────┼─────────┤
│SCORE   │MARC.   │ STATS  │RESULT. │BRACKET  │
│ BUG    │GRANDE  │        │        │         │
├────────┼────────┼────────┼────────┼─────────┤
│ VENUE  │ INTRO  │ÁRBITRO │ TIEMPO │ SORTEO  │
└────────┴────────┴────────┴────────┴─────────┘
```

- **TAKE** (verde) · lleva preview → programa
- **OUT PGM** (naranja) · ocultar todo del programa
- **OUT PVW** (azul) · vaciar preview sin tocar programa
- **STOP** (rojo) · oculta todo + limpia preview
- El resto · carga el gráfico correspondiente en **preview**. Pulsa TAKE para sacarlo al aire

> Para hacer **take directo** (bypass preview) duplica el botón y cambia su acción a `POST /api/stream/:matchId/show` con el mismo body.

---

## Pasos

### 1 · Instalar módulo
En Companion → **Connections** → añade **"HTTP Requests" (generic-http)** si no lo tienes.

### 2 · Importar el archivo
- Companion → **Import / Export** → **Import Page**
- Carga `bttms-streamdeck.companionconfig`
- Asígnalo a la página 1 de tu Stream Deck

### 3 · Definir variables custom
Companion → **Custom Variables**. El import ya las crea vacías, sólo rellenar:

| Variable   | Valor                                                 |
|------------|-------------------------------------------------------|
| `baseUrl`  | `https://tu-dominio.vercel.app` (sin slash final)     |
| `matchId`  | El UUID del partido (lo ves en `/dashboard/streaming`)|
| `apiKey`   | El valor de `STREAM_API_KEY` configurado en Vercel    |

### 4 · Probar
Pulsa `SCOREBUG` → debe aparecer en la URL `/overlay/<matchId>/preview`.
Pulsa `TAKE` → pasa a `/overlay/<matchId>` (programa).

---

## Fallback: si el import no funciona

Algunas versiones de Companion cambian el formato. Si el archivo no importa limpio, configura cada botón manualmente — todos comparten la misma estructura:

1. Añade acción **HTTP Requests: POST**
2. URL: `{{$(internal:custom_baseUrl)}}/api/stream/{{$(internal:custom_matchId)}}/preview` *(o `/show`, `/take`, `/stop`…)*
3. Body: JSON con la clave del gráfico (ver tabla abajo)
4. Header: `Authorization: Bearer {{$(internal:custom_apiKey)}}`
5. Content-Type: `application/json`

### Bodies para cada botón

| Botón      | Endpoint                   | Body JSON                                             |
|------------|----------------------------|-------------------------------------------------------|
| TAKE       | `/take` POST               | (vacío)                                               |
| OUT PGM    | `/stop` POST               | (vacío)                                               |
| OUT PVW    | `/preview` **DELETE**      | (vacío)                                               |
| STOP       | `/stop` POST               | (vacío)                                               |
| SCOREBUG   | `/preview` POST            | `{"key":"scorebug"}`                                  |
| MARC.GRANDE| `/preview` POST            | `{"key":"big_scoreboard","data":{"show_sponsor":true}}` |
| STATS      | `/preview` POST            | `{"key":"stats_panel","data":{"scope":"auto"}}`       |
| RESULT.    | `/preview` POST            | `{"key":"results_grid"}`                              |
| BRACKET    | `/preview` POST            | `{"key":"bracket"}`                                   |
| MATCH PRES | `/preview` POST            | `{"key":"match_presentation"}`                        |
| VENUE      | `/preview` POST            | `{"key":"venue_card"}`                                |
| INTRO      | `/preview` POST            | `{"key":"tournament_intro"}`                          |
| ÁRBITRO    | `/preview` POST            | `{"key":"referee_lower_third"}`                       |
| TIEMPO     | `/preview` POST            | `{"key":"weather"}`                                   |
| SORTEO     | `/preview` POST            | `{"key":"coin_toss"}`                                 |

### Botones BIO por jugador
Un botón por jugador del partido:
```json
POST /api/stream/<matchId>/preview
{"key":"player_bio","data":{"player_id":"<uuid>","team":1}}
```
Los IDs los sacas de `/dashboard/streaming` o de `GET /api/stream/<matchId>/state`.

---

## Feedbacks dinámicos (opcional)

Para que los botones se iluminen cuando su gráfico está en aire, usa la acción periódica **Polling** del módulo HTTP Requests:

- **URL**: `{{$(internal:custom_baseUrl)}}/api/stream/{{$(internal:custom_matchId)}}/state`
- **Intervalo**: 1000 ms
- **Variable destino**: `state`

Luego crea un *boolean feedback* en cada botón que compare el JSON devuelto:
```
$(streamapi:state)  contiene  "scorebug":{"visible":true
```
→ aplica bg color verde cuando esté visible.

Esto es opcional — sin feedbacks, los botones funcionan igual, sólo que no reflejan el estado actual en tiempo real en el deck.

---

## Múltiples partidos

Cada partido tiene su propio `matchId`. Tres opciones:

1. **Una página Companion por partido**: duplica la página, cambia la var custom `matchId` por página vía *Internal: Set custom variable*.
2. **Variables de deck diferentes**: configura un deck físico por partido.
3. **Selector de partido**: añade botones que ejecuten `Set custom variable matchId = '...'` antes de ejecutar las acciones del gráfico.
