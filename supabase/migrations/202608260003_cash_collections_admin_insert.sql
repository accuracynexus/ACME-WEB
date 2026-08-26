-- ============================================================
-- Fix: el admin no puede registrar cobros en efectivo
-- Fecha: 2026-08-26
-- Continua 202608260001 y 202608260002
--
-- cash_collections ya deja al admin leer y actualizar
-- (cash_collections_select_driver_or_staff y
-- cash_collections_update_driver_or_staff, ambas con
-- private.is_admin()), pero sus dos policies de INSERT exigen
--
--   driver_id = auth.uid()
--
-- y el panel inserta con el driver_id del repartidor que se esta
-- viendo, nunca el del admin (saveDriverCashCollection en
-- src/core/services/adminDriversService.ts). Resultado: "Registrar
-- cobro" falla para cualquier admin.
--
-- Solo INSERT: lo demas ya estaba cubierto.
-- ============================================================

drop policy if exists cash_collections_admin_insert on public.cash_collections;
create policy cash_collections_admin_insert on public.cash_collections
  for insert to authenticated
  with check (private.is_portal_admin());
