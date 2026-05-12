/**
 * Constantes del torneo — seguras de importar desde client y server.
 *
 * No incluyas aquí nada que necesite Supabase / next/headers. Para
 * resolución dinámica del torneo activo (con DB lookup), usa
 * lib/active-tournament.ts — pero solo desde server components o
 * route handlers.
 */

/** ID del torneo por defecto en instalaciones single-tenant. */
export const DEFAULT_TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'
