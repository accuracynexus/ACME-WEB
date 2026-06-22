-- ============================================================
-- ACME Courier — Motor Financiero Fase 1: Cálculo
-- Fecha: 2026-06-19
-- ============================================================

-- ----------------------------------------------------------------
-- 1. products: precios separados (merchant vs cliente)
-- base_price ya existe y equivale al customer_price (precio con 30%)
-- merchant_price es el precio neto sin recargo para el comercio
-- ----------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS merchant_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS customer_price numeric(10,2);

-- Poblar customer_price con base_price existente (retrocompatibilidad)
UPDATE public.products
SET customer_price = base_price
WHERE customer_price IS NULL AND base_price IS NOT NULL;

-- ----------------------------------------------------------------
-- 2. orders: columnas del motor financiero
-- delivery_fee, service_fee, tip_amount, payment_status ya existen
-- Se agregan: products_total, service_fee_rate, quote_id
-- ----------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS products_total   numeric(10,2),
  ADD COLUMN IF NOT EXISTS service_fee_rate numeric(5,4) DEFAULT 0.036,
  ADD COLUMN IF NOT EXISTS quote_id         uuid;

-- Poblar products_total retroactivamente con subtotal
UPDATE public.orders
SET products_total = subtotal
WHERE products_total IS NULL AND subtotal IS NOT NULL;

-- ----------------------------------------------------------------
-- 3. order_items: precios históricos separados
-- ----------------------------------------------------------------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS merchant_unit_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS customer_unit_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS platform_margin     numeric(10,2);

-- Poblar customer_unit_price con unit_price existente
UPDATE public.order_items
SET customer_unit_price = unit_price
WHERE customer_unit_price IS NULL AND unit_price IS NOT NULL;

-- ----------------------------------------------------------------
-- 4. Tabla order_quotes (cotizaciones temporales)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_quotes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      uuid,
  branch_id        uuid NOT NULL,
  subtotal         numeric(10,2) NOT NULL,
  discount         numeric(10,2) NOT NULL DEFAULT 0,
  service_fee      numeric(10,2) NOT NULL,
  service_fee_rate numeric(5,4)  NOT NULL DEFAULT 0.036,
  delivery_fee     numeric(10,2) NOT NULL,
  tip_amount       numeric(10,2) NOT NULL DEFAULT 0,
  total            numeric(10,2) NOT NULL,
  distance_km      numeric(8,3),
  payment_method   text          NOT NULL DEFAULT 'card',
  fulfillment_type text          NOT NULL DEFAULT 'delivery',
  items_snapshot   jsonb,
  status           text          NOT NULL DEFAULT 'active',
  expires_at       timestamptz   NOT NULL,
  created_at       timestamptz   NOT NULL DEFAULT now()
);

-- Índice para búsquedas rápidas de cotizaciones activas por cliente
CREATE INDEX IF NOT EXISTS idx_order_quotes_customer_active
  ON public.order_quotes (customer_id, status, expires_at);

-- Referencia débil desde orders hacia quotes (sin FK estricta para evitar problemas de RLS)
-- La validación se hace en el backend

-- ----------------------------------------------------------------
-- 5. RLS para order_quotes (clientes solo ven sus propias cotizaciones)
-- ----------------------------------------------------------------
ALTER TABLE public.order_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_read_own_quotes" ON public.order_quotes;
CREATE POLICY "customers_read_own_quotes"
  ON public.order_quotes FOR SELECT
  USING (customer_id = auth.uid() OR customer_id IS NULL);

DROP POLICY IF EXISTS "service_role_all_quotes" ON public.order_quotes;
CREATE POLICY "service_role_all_quotes"
  ON public.order_quotes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
