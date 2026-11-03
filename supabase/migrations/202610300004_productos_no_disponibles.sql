-- Un producto desactivado por el local no se puede ordenar.
--
-- Stock: la comida no se maneja con cantidades. El local ve su menu completo y
-- activa o desactiva cada producto (products.is_active); la base le oculta al
-- publico los desactivados. Faltaba el ultimo paso: create_order_from_quote no
-- validaba nada, asi que un producto desactivado mientras estaba en el carrito
-- de un cliente se podia seguir comprando.
--
-- Rollback: volver a crear la funcion sin el bloque "Disponibilidad".

CREATE OR REPLACE FUNCTION public.create_order_from_quote(p_quote_id uuid, p_customer_id uuid, p_merchant_id uuid, p_branch_id uuid, p_fulfillment_type text, p_special_instructions text, p_payment_method_id uuid DEFAULT NULL::uuid, p_address_id uuid DEFAULT NULL::uuid, p_address_snapshot text DEFAULT NULL::text, p_reference_snapshot text DEFAULT NULL::text, p_district_snapshot text DEFAULT NULL::text, p_city_snapshot text DEFAULT NULL::text, p_region_snapshot text DEFAULT NULL::text, p_recipient_name text DEFAULT NULL::text, p_recipient_phone text DEFAULT NULL::text, p_lat numeric DEFAULT NULL::numeric, p_lng numeric DEFAULT NULL::numeric, p_items jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_quote          public.order_quotes%ROWTYPE;
  v_order_id       uuid;
  v_order_code     integer;
  v_item           jsonb;
  v_order_item_id  uuid;
  v_now            timestamptz := now();
  v_no_disponibles text;
BEGIN
  SELECT * INTO v_quote
  FROM public.order_quotes
  WHERE id = p_quote_id
    AND status = 'active'
    AND expires_at > v_now;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUOTE_INVALID: La cotizacion no existe, ya fue usada o ha expirado.';
  END IF;

  -- Disponibilidad. El local desactiva con products.is_active lo que se le
  -- acabo; un producto asi ya no se vende aunque siga en el carrito de un
  -- cliente o en una cotizacion todavia vigente. Los items sin product_id
  -- (el encargo de Recojos) no son del catalogo y se dejan pasar.
  SELECT string_agg(DISTINCT coalesce(p.name, i.item->>'product_name_snapshot', 'un producto'), ', ')
    INTO v_no_disponibles
  FROM jsonb_array_elements(p_items) AS i(item)
  LEFT JOIN public.products p ON p.id = (i.item->>'product_id')::uuid
  WHERE nullif(i.item->>'product_id', '') IS NOT NULL
    AND (p.id IS NULL OR NOT p.is_active);

  IF v_no_disponibles IS NOT NULL THEN
    RAISE EXCEPTION 'PRODUCTO_NO_DISPONIBLE: %', v_no_disponibles;
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
$function$;

-- La disponibilidad por sucursal (is_available, is_paused, pause_reason) y
-- stock_qty quedan en desuso: nadie las escribe. No se borran porque la
-- politica publica de product_branch_settings y apps ya publicadas las leen.
comment on column public.product_branch_settings.is_available is 'En desuso: la disponibilidad se maneja con products.is_active.';
comment on column public.product_branch_settings.is_paused    is 'En desuso: la disponibilidad se maneja con products.is_active.';
comment on column public.product_branch_settings.pause_reason is 'En desuso: la disponibilidad se maneja con products.is_active.';
comment on column public.product_branch_settings.stock_qty    is 'En desuso: la comida no se maneja con stock; se activa o desactiva el producto.';

notify pgrst, 'reload schema';
