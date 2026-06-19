-- ============================================================
-- ACME Courier — Motor Financiero Fase 4: Liquidación
-- Fecha: 2026-06-19
-- ============================================================

-- ----------------------------------------------------------------
-- 1. orders: columnas de liquidación
-- ----------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_settled  boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS settled_at  timestamptz;

-- ----------------------------------------------------------------
-- 2. Tabla order_settlements (distribución del dinero por pedido)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_settlements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL,
  merchant_amount   numeric(10,2) NOT NULL,
  driver_amount     numeric(10,2) NOT NULL,
  tip_amount        numeric(10,2) NOT NULL DEFAULT 0,
  platform_amount   numeric(10,2) NOT NULL,
  refund_adjustment numeric(10,2) NOT NULL DEFAULT 0,
  culqi_fee         numeric(10,2),
  notes             text,
  settled_at        timestamptz   NOT NULL DEFAULT now(),
  settled_by        uuid,
  CONSTRAINT uq_order_settlements_order UNIQUE (order_id)
);

-- ----------------------------------------------------------------
-- 3. RLS para order_settlements
-- ----------------------------------------------------------------
ALTER TABLE public.order_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_settlements" ON public.order_settlements;
CREATE POLICY "service_role_all_settlements"
  ON public.order_settlements FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins pueden leer
DROP POLICY IF EXISTS "admins_read_settlements" ON public.order_settlements;
CREATE POLICY "admins_read_settlements"
  ON public.order_settlements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND default_role IN ('admin', 'platform_admin', 'superadmin')
    )
  );
