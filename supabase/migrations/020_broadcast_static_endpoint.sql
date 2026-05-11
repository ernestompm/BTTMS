-- Broadcast endpoint estático opcional — separa el payload en dos PUTs:
--  - broadcast_endpoint           → datos dinámicos (score, stats, tiempos)
--                                    se envía en cada punto / transición.
--  - broadcast_endpoint_static    → datos estáticos (tournament, teams,
--                                    judge, weather, draw, rules)
--                                    se envía solo al activar EN AIRE y
--                                    cuando cambia algo "estructural"
--                                    (cambio de match, refresh de weather).
--
-- Si broadcast_endpoint_static = NULL: comportamiento anterior — el endpoint
-- principal recibe el payload completo.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS broadcast_endpoint_static text;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS broadcast_method_static text
    DEFAULT 'PUT'
    CHECK (broadcast_method_static IN ('POST', 'PUT'));
