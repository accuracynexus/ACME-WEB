-- ============================================================
-- Fix: el admin no ve las liquidaciones en la ficha del repartidor
-- Fecha: 2026-08-26
-- Continua 202608260001_driver_admin_rls_policies.sql
--
-- Al revisar el resto de las tablas que toca el panel de Reparto,
-- estas dos son las unicas que quedaron sin acceso de admin:
--
--   driver_settlements       -> solo dsettle_select_own
--                               (driver_id = auth.uid())
--   driver_settlement_items  -> solo dsettle_item_select_own
--                               (via el settlement del propio driver)
--
-- El resto ya lo resuelve private.is_admin() en sus policies:
-- profiles, orders, order_assignments, cash_collections y
-- merchant_branches. vehicle_types es de lectura publica.
--
-- Sin esto, fetchDriverDetail trae 0 liquidaciones y la pestana
-- queda vacia en silencio, igual que pasaba con la lista.
--
-- Solo SELECT: el panel declara estas tablas como
-- readonly_backend en moduleRegistry y nunca las escribe.
-- ============================================================

drop policy if exists driver_settlements_admin_select on public.driver_settlements;
create policy driver_settlements_admin_select on public.driver_settlements
  for select to authenticated
  using (private.is_portal_admin());

drop policy if exists driver_settlement_items_admin_select on public.driver_settlement_items;
create policy driver_settlement_items_admin_select on public.driver_settlement_items
  for select to authenticated
  using (private.is_portal_admin());
