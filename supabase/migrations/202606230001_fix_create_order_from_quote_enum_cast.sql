-- ============================================================
-- ACME Courier - Fix RPC enum cast for fulfillment_type
-- Fecha: 2026-06-23
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_order_from_quote(
  p_quote_id             uuid,
  p_customer_id          uuid,
  p_merchant_id          uuid,
  p_branch_id            uuid,
  p_fulfillment_type     text,
  p_special_instructions text,
  p_payment_method_id    uuid DEFAULT NULL,
  p_address_id           uuid DEFAULT NULL,
  p_address_snapshot     text DEFAULT NULL,
  p_reference_snapshot   text DEFAULT NULL,
  p_district_snapshot    text DEFAULT NULL,
  p_city_snapshot        text DEFAULT NULL,
  p_region_snapshot      text DEFAULT NULL,
  p_recipient_name       text DEFAULT NULL,
  p_recipient_phone      text DEFAULT NULL,
  p_lat                  numeric DEFAULT NULL,
  p_lng                  numeric DEFAULT NULL,
  p_items                jsonb DEFAULT '[]'::jsonb
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
  SELECT * INTO v_quote
  FROM public.order_quotes
  WHERE id = p_quote_id
    AND status = 'active'
    AND expires_at > v_now;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUOTE_INVALID: La cotizacion no existe, ya fue usada o ha expirado.';
  END IF;

  IF v_quote.customer_id IS NOT NULL AND v_quote.customer_id != p_customer_id THEN
    RAISE EXCEPTION 'QUOTE_FORBIDDEN: La cotizacion no pertenece a este cliente.';
  END IF;

  IF p_fulfillment_type NOT IN ('delivery', 'pickup') THEN
    RAISE EXCEPTION 'FULFILLMENT_INVALID: Tipo de entrega invalido.';
  END IF;

  v_order_code := nextval('public.order_code_seq');
  v_order_id   := gen_random_uuid();

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
    'placed', 'pending', p_fulfillment_type::public.fulfillment_type,
    p_special_instructions,
    v_quote.subtotal, v_quote.subtotal, v_quote.discount,
    v_quote.service_fee, v_quote.service_fee_rate, v_quote.delivery_fee, v_quote.tip_amount,
    0, v_quote.total, 'PEN',
    p_quote_id, p_payment_method_id,
    v_now, v_now, v_now
  );

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

  UPDATE public.order_quotes
  SET status = 'used'
  WHERE id = p_quote_id;

  RETURN jsonb_build_object(
    'order_id',       v_order_id,
    'order_code',     v_order_code,
    'total',          v_quote.total,
    'payment_status', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_from_quote TO service_role;
