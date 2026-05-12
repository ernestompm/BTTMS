# Plantillas editables en Dreamweaver — BTTMS v2.0

Estos HTML son **espejos estáticos** de las plantillas React (`bttms/components/streaming/*.tsx` y `bttms/components/scoreboard/venue-scoreboard.tsx`). Sirven para que tú las abras en Dreamweaver, muevas cosas, cambies tipografías/colores/tamaños hasta que veas exactamente lo que quieres, y luego me pases el HTML editado para que yo replique los cambios en los componentes TSX reales.

## Cómo usar

1. **Abre el `.html` que quieras tocar en Dreamweaver** (Vista Diseño + Vista Código en split).
2. **Edita lo que quieras** — todos los estilos están **en `style="..."` inline** dentro del propio HTML, igual que en los TSX, así que ves el efecto en directo.
3. Cada lienzo es **1920×1080 a escala 0.5** (960×540 en pantalla) para que entren varios en una página y los puedas comparar. El zoom no afecta a las medidas reales.
4. Cuando termines, pásame el archivo (o solo los bloques cambiados) y yo aplico los cambios a los TSX correspondientes.

## Mapa de archivos → componentes reales

| Archivo HTML                   | Componente TSX                                                                  | Propósito                                  |
|--------------------------------|---------------------------------------------------------------------------------|--------------------------------------------|
| `venue-scoreboard.html`        | `components/scoreboard/venue-scoreboard.tsx`                                    | Marcador de pista (sede) — 3 estados       |
| `graphics-default.html`        | `components/streaming/graphics.tsx`                                             | Skin default — glass dark genérico         |
| `graphics-broadcast.html`      | `components/streaming/graphics-broadcast.tsx`                                   | Skin BROADCAST — TV en vivo, skew + sheen  |
| `graphics-tour.html`           | `components/streaming/graphics-tour.tsx`                                        | Skin TOUR — navy compacto estilo WTA       |
| `graphics-pacific.html`        | `components/streaming/graphics-pacific.tsx`                                     | Skin PACIFIC — beach, splashes orgánicos   |
| `graphics-championship.html`   | `components/streaming/graphics-championship.tsx`                                | Skin CHAMPIONSHIP — premium, naranja líder |

## Datos de ejemplo (los mismos en todos los archivos)

- **Torneo:** Campeonato de España de Tenis Playa 2026
- **Sede:** Estadio Municipal · Marbella
- **Equipo A:** (1) JUAN CARLOS · MARTÍNEZ · ESP  &nbsp;/&nbsp; en dobles + LUIS GARCÍA
- **Equipo B:** (4) FRANCESCO · ROSSI · ITA  &nbsp;/&nbsp; en dobles + MARCO BIANCHI
- **Marcador en vivo:** SET1 6-4 · SET2 (en juego) 3-2 · puntos 30-40
- **Saque:** Equipo A
- **Categoría:** SUB-18 Masculino · OCTAVOS DE FINAL

## Notas técnicas

- Todas las fuentes que se usan (`Barlow Condensed`, `Inter`, `Roboto Condensed`, `JetBrains Mono`) se cargan desde Google Fonts en el `<head>` de cada HTML — funcionan offline solo si Dreamweaver tiene caché previa.
- Las **banderas** se referencian como `../public/Flags/ESP.jpg`, así que abre los HTML con el proyecto montado en Dreamweaver para que se vean. Si no, sustituye por placeholders.
- Los lienzos están escalados al 50% para encajar en pantalla; el HTML interior está a 1920×1080 reales — no edites el `transform: scale(.5)` del wrapper, edita SOLO lo que está dentro de `.stage`.
