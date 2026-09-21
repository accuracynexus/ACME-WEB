-- ============================================================
-- Publicar en Realtime las tablas que las apps ya escuchan
-- Fecha: 2026-09-21
--
-- La publicacion supabase_realtime solo contenia `messages`. Las tres
-- apps se suscriben a mas tablas, y esas suscripciones nunca emitian:
--
--   ACME-DRIVER  order_assignments  -> watchAssignments()
--                Las ofertas de reparto duran 45 s (offerTimeoutSeconds).
--                Sin Realtime, una oferta creada con la app abierta no
--                llega a pantalla: solo se ve si el repartidor entra a
--                "Pedidos" por casualidad dentro de esa ventana. Asi se
--                perdieron las dos ofertas del pedido #1047.
--
--   ACME-CLIENT  orders, order_status_history, profiles
--                El cliente no ve avanzar su pedido hasta recargar.
--
--   ACME-WEB     orders (alerta de pedidos entrantes)
--                Tambien hace polling, asi que funcionaba, pero lento.
--
-- Realtime respeta RLS: cada suscriptor recibe solo las filas que sus
-- policies le dejan leer (oa_select_own para el repartidor, etc.).
-- ============================================================

alter publication supabase_realtime add table public.order_assignments;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_status_history;
alter publication supabase_realtime add table public.profiles;

-- Para que postgres_changes incluya el registro completo en UPDATE y
-- DELETE (y no solo la clave), las tablas necesitan REPLICA IDENTITY FULL.
-- Sin esto los filtros por columna (eq('driver_id', ...)) no matchean.
alter table public.order_assignments replica identity full;
alter table public.orders replica identity full;
alter table public.order_status_history replica identity full;
alter table public.profiles replica identity full;
