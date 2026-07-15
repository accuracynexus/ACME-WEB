-- ============================================================
-- Fix: "infinite recursion detected in policy for relation orders"
-- Fecha: 2026-07-15
--
-- Causa: ciclo entre dos políticas que se referencian mutuamente
-- con subqueries directas (sujetas a RLS):
--
--   orders.orders_select_driver
--     -> EXISTS (... FROM order_assignments ...)   [dispara RLS de order_assignments]
--   order_assignments.customers_read_own_order_assignments
--     -> EXISTS (... FROM orders ...)              [dispara RLS de orders]  => bucle
--
-- Ambas políticas son redundantes: los mismos accesos ya están
-- cubiertos por políticas que usan funciones private.* con
-- SECURITY DEFINER (no disparan RLS y por eso no reculan):
--
--   * acceso de repartidor a orders:
--       orders_select_customer_staff_driver -> private.is_order_driver(orders.id)
--       (cubre current_driver_id Y order_assignments)
--   * acceso de cliente a order_assignments:
--       order_assignments_select_related_order -> private.is_order_customer(order_id)
--
-- Por lo tanto eliminar las dos políticas recursivas no quita
-- ningún acceso, solo rompe el ciclo.
-- ============================================================

drop policy if exists orders_select_driver on public.orders;
drop policy if exists customers_read_own_order_assignments on public.order_assignments;
