-- ============================================================
-- ACME Courier — Motor Financiero Fase 2: Pedido Seguro
-- Fecha: 2026-06-19
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Secuencia para order_code (reemplaza "último + 1" del frontend)
-- ----------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.order_code_seq
  START WITH 1000
  INCREMENT BY 1
  NO CYCLE;

-- Ajustar la secuencia para que arranque después del order_code más alto existente
DO $$
DECLARE
  max_code integer;
BEGIN
  SELECT COALESCE(MAX(order_code), 999) INTO max_code FROM public.orders;
  IF max_code >= 1000 THEN
    PERFORM setval('public.order_code_seq', max_code);
  END IF;
END;
$$;

-- Asignar el default a la columna order_code (si es integer)
-- Nota: Si order_code ya tiene un default diferente, este lo reemplaza de forma segura
ALTER TABLE public.orders
  ALTER COLUMN order_code SET DEFAULT nextval('public.order_code_seq');

-- ----------------------------------------------------------------
-- 2. Tabla payment_attempts (idempotencia de cobros)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL,
  provider             text NOT NULL DEFAULT 'culqi',
  provider_payment_id  text,
  idempotency_key      text NOT NULL,
  amount               numeric(10,2) NOT NULL,
  status               text NOT NULL DEFAULT 'pending',
  metadata             jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payment_attempts_idempotency UNIQUE (idempotency_key)
);

-- Índice para búsqueda por order_id
CREATE INDEX IF NOT EXISTS idx_payment_attempts_order
  ON public.payment_attempts (order_id, status);

-- ----------------------------------------------------------------
-- 3. RLS para payment_attempts (solo service role puede escribir)
-- ----------------------------------------------------------------
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_attempts" ON public.payment_attempts;
CREATE POLICY "service_role_all_attempts"
  ON public.payment_attempts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Los clientes pueden leer sus propios intentos (via order_id → orders.customer_id)
DROP POLICY IF EXISTS "customers_read_own_attempts" ON public.payment_attempts;
CREATE POLICY "customers_read_own_attempts"
  ON public.payment_attempts FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE customer_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 4. Función RPC para creación atómica de pedido desde quote
--    Llama a esta función desde el backend con service role
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_from_quote(
  p_quote_id           uuid,
  p_customer_id        uuid,
  p_merchant_id        uuid,
  p_branch_id          uuid,
  p_fulfillment_type   text,
  p_special_instructions text,
  p_payment_method_id  uuid DEFAULT NULL,
  p_address_id         uuid DEFAULT NULL,
  p_address_snapshot   text DEFAULT NULL,
  p_reference_snapshot text DEFAULT NULL,
  p_district_snapshot  text DEFAULT NULL,
  p_city_snapshot      text DEFAULT NULL,
  p_region_snapshot    text DEFAULT NULL,
  p_recipient_name     text DEFAULT NULL,
  p_recipient_phone    text DEFAULT NULL,
  p_lat                numeric DEFAULT NULL,
  p_lng                numeric DEFAULT NULL,
  p_items              jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote          public.order_quotes%ROWTYPE;
  v_order_id       uuid;
  v_order_code     integer;
  v_item           jsonb;
  v_order_item_id  uuid;
  v_now            timestamptz := now();
BEGIN
  -- 1. Obtener y validar la cotización
  SELECT * INTO v_quote
  FROM public.order_quotes
  WHERE id = p_quote_id
    AND status = 'active'
    AND expires_at > v_now;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUOTE_INVALID: La cotizacion no existe, ya fue usada o ha expirado.';
  END IF;

  -- Validar que la cotización pertenece al cliente
  IF v_quote.customer_id IS NOT NULL AND v_quote.customer_id != p_customer_id THEN
    RAISE EXCEPTION 'QUOTE_FORBIDDEN: La cotizacion no pertenece a este cliente.';
  END IF;

  -- 2. Generar order_code desde secuencia
  v_order_code := nextval('public.order_code_seq');
  v_order_id   := gen_random_uuid();

  -- 3. Crear el pedido
  INSERT INTO public.orders (
    id, order_code, customer_id, merchant_id, branch_id,
    status, payment_status, fulfillment_type,
    special_instructions,
    subtotal, products_total, discount_total,
    service_fee, service_fee_rate, delivery_fee, tip_amount,
    tax_amount, total, currency,
    quote_id, payment_method_id,
    placed_at, created_at, updated_at
  ) VALUES (
    v_order_id, v_order_code, p_customer_id, p_merchant_id, p_branch_id,
    'placed', 'pending', p_fulfillment_type,
    p_special_instructions,
    v_quote.subtotal, v_quote.subtotal, v_quote.discount,
    v_quote.service_fee, v_quote.service_fee_rate, v_quote.delivery_fee, v_quote.tip_amount,
    0, v_quote.total, 'PEN',
    p_quote_id, p_payment_method_id,
    v_now, v_now, v_now
  );

  -- 4. Insertar items del pedido
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_order_item_id := gen_random_uuid();
    INSERT INTO public.order_items (
      id, order_id, product_id, product_name_snapshot,
      unit_price, quantity, notes, line_total,
      customer_unit_price, merchant_unit_price, platform_margin,
      created_at
    ) VALUES (
      v_order_item_id,
      v_order_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name_snapshot',
      (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::integer,
      v_item->>'notes',
      (v_item->>'line_total')::numeric,
      (v_item->>'customer_unit_price')::numeric,
      (v_item->>'merchant_unit_price')::numeric,
      (v_item->>'platform_margin')::numeric,
      v_now
    );
  END LOOP;

  -- 5. Detalles de entrega (solo para delivery)
  IF p_fulfillment_type = 'delivery' AND p_address_snapshot IS NOT NULL THEN
    INSERT INTO public.order_delivery_details (
      order_id, address_id,
      address_snapshot, reference_snapshot, district_snapshot,
      city_snapshot, region_snapshot,
      lat, lng,
      recipient_name, recipient_phone,
      created_at, updated_at
    ) VALUES (
      v_order_id, p_address_id,
      p_address_snapshot, p_reference_snapshot, p_district_snapshot,
      p_city_snapshot, p_region_snapshot,
      p_lat, p_lng,
      p_recipient_name, p_recipient_phone,
      v_now, v_now
    );
  END IF;

  -- 6. Historial de estado inicial
  INSERT INTO public.order_status_history (
    id, order_id, from_status, to_status,
    actor_user_id, actor_type, note, created_at
  ) VALUES (
    gen_random_uuid(), v_order_id,
    'placed', 'placed',
    p_customer_id, 'customer',
    'Pedido creado desde cotizacion ' || p_quote_id::text,
    v_now
  );

  -- 7. Marcar la cotización como usada
  UPDATE public.order_quotes
  SET status = 'used'
  WHERE id = p_quote_id;

  -- 8. Devolver resultado
  RETURN jsonb_build_object(
    'order_id',   v_order_id,
    'order_code', v_order_code,
    'total',      v_quote.total,
    'payment_status', 'pending'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback automático por ser plpgsql transaccional
    RAISE;
END;
$$;

-- Grant de ejecución al service role y anon (el backend usa service role)
GRANT EXECUTE ON FUNCTION public.create_order_from_quote TO service_role;
