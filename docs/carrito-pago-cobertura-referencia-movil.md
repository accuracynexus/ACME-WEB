# Carrito, pago y cobertura — referencia técnica para la app móvil

**Confidencial — uso interno.** Documento de referencia para portar a la app móvil el flujo de carrito, cálculo de tarifa por ubicación, mapa de cobertura y pago. Basado en el estado actual de `src/modules/public/cart/CartPage.tsx` y servicios asociados en el proyecto web (rama `mejoras-paginas-publicas`).

---

## 1. Arquitectura general

```
App (web/móvil)
  │
  ├─ Supabase (auth, DB, RLS) ─── datos de catálogo, direcciones, pedidos, sesión
  │
  └─ Backend propio "ACME Operaciones" (API REST externa, fuera de este repo)
        https://acme-operacione.vercel.app
        - Calcula precios reales (el frontend NUNCA calcula ni envía precios)
        - Expone: cotización, geocodificación, creación de pedido, pagos Culqi
```

Regla de oro que ya sigue el web y **debe respetarse en móvil**: el cliente arma el carrito (productos, cantidades, modificadores) pero **el precio final y el total de cobro siempre vienen del backend** (`/api/courier/quote` y `orders.total`). La app nunca calcula ni envía montos a Culqi.

---

## 2. Variables de entorno / API keys necesarias

| Variable | Uso | Dónde se usa hoy | ¿Ya resuelta? |
|---|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Cliente Supabase (auth, tablas con RLS) | `src/integrations/supabase/client.ts` | Sí — valores reales en `.env` de este repo |
| `VITE_ACME_API_URL` | Base URL del backend de operaciones | `courierPaymentService.ts` | **Sí, sin configurar nada.** El código trae hardcodeado el default `https://acme-operacione.vercel.app` (línea `DEFAULT_API_URL`) y NO es un placeholder — es la API real en producción. Verificado en vivo (`/` y `/docs` responden 200). Usar esta URL fija en la app móvil. |
| `VITE_ROUTING_API_URL` | Motor de ruteo por calles | `CartPage.tsx` | **Sí, sin configurar nada.** Default hardcodeado `https://router.project-osrm.org` (demo pública de OSRM, gratis, sin key). Usar fijo en móvil. |
| `VITE_CULQI_PUBLIC_KEY` | Public key de Culqi Checkout v4 (front) | `CartPage.tsx` — si empieza con `pk_test` se asume sandbox | **No.** El fallback en código es `''` (vacío); sin este valor el checkout de Culqi no abre. Hay que conseguirlo del dashboard de Culqi/Vercel. |
| `VITE_CULQI_RSA_ID`, `VITE_CULQI_RSA_PUBLIC_KEY` | Habilitan pago con **tarjeta** en el checkout de Culqi (RSA anti-fraude). Sin esto, Culqi solo ofrece Yape/billeteras/agente | `CartPage.tsx` (`openCulqiForOrder`) | **No.** Igual que arriba, fallback vacío, no están en ningún archivo del repo. |
| `GOOGLE_MAPS_API_KEY` | Presente en `.env` del proyecto pero **no se usa hoy en el carrito web** (el mapa web usa Leaflet + tiles gratis de CARTO). Evaluar si móvil sí lo necesita para Google Maps SDK nativo | `.env` (solo declarada) | No — el valor en `.env` es un placeholder literal (`tu_google_maps_api_key_aqui`), no una key real. |

> En resumen: de las 4 variables "externas" (no Supabase), **solo las 3 de Culqi requieren conseguir un valor real** de alguien con acceso a esos dashboards. `VITE_ACME_API_URL` y `VITE_ROUTING_API_URL` ya apuntan a servicios reales y funcionando vía sus defaults en código — no hace falta pedirle nada a nadie para esas dos.

---

## 3. Carrito

- Estado global en `PublicStoreProvider` (React Context), persistido en `localStorage` bajo la key `publicCartV1`.
- Cada ítem: `{ id, merchant_id, merchant_name, branch_id, branch_name, product_id, product_name, unit_price, quantity, notes, modifiers[] }`.
- **Regla de negocio activa (reciente):** el carrito solo puede contener productos de **un mismo local (merchant + branch)**. Si se agrega un producto de otro local, el carrito anterior se reemplaza automáticamente (con aviso). Ver `normalizeSingleBranchCart` / `hasSameCartScope` en `PublicStoreProvider.tsx`.
- No hay campo de "instrucciones especiales" en el carrito actual (se eliminó recientemente); si móvil lo necesita, es una decisión nueva a tomar, no algo que replicar.

---

## 4. Ubicación del cliente y dirección de entrega

### 4.1 Direcciones guardadas
- Tablas: `addresses` (dato geográfico compartido) + `customer_addresses` (relación cliente↔dirección, con `label`, `is_default`, `delivery_use_count`, `last_used_at`).
- El cliente puede tener varias; se filtran a las "operacionales" (dentro de Huancavelica o con lat/lng válido) — ver `isOperationalSavedAddress`.
- Servicio: `publicCustomerService.fetchCustomerAddresses / saveAddress / deleteAddress / markAddressUsed`.
- Al guardar una dirección nueva se deduplica por cercanía (~5m) o por texto (calle+distrito+ciudad+referencia) — ver `areSameAddress` / `dedupeCustomerAddresses`.

### 4.2 Selección del punto de entrega (mapa)
El punto de entrega se obtiene por una de estas vías (cualquiera dispara reverse-geocoding para autocompletar la dirección):
1. **"Mi ubicación"** → `navigator.geolocation.getCurrentPosition`.
2. **Tap/click en el mapa.**
3. **Arrastrar el marcador de destino.**
4. **Búsqueda de texto** → `courierPaymentService.searchAddresses(query)` (debounce, ≥3 caracteres) → backend hace geocoding.

### 4.3 Geocodificación (backend externo, no en este repo)
- `GET /api/courier/reverse-geocode?lat=&lng=` → `{ line1, district, city, region, country, display_name }`
- `GET /api/courier/geocode-search?q=&limit=` → lista de `{ label, lat, lng, ...mismos campos }`
- El frontend nunca llama a Google/Nominatim directamente; todo pasa por el backend propio.

### 4.4 Ruteo (distancia real por calles)
- `fetchRoadRoute(origin, destination)` llama directo (desde el navegador, sin pasar por el backend propio) a OSRM:
  `GET {ROUTING_API_URL}/route/v1/driving/{lngO},{latO};{lngD},{latD}?overview=full&geometries=geojson`
- Devuelve geometría de la ruta, distancia (km) y duración (min). Si falla, se usa línea recta (`source: 'direct'`) como fallback visual, pero la distancia real para tarifa la determina el backend en la cotización.

---

## 5. Mapa y zona de cobertura

### 5.1 Implementación web (a reemplazar en móvil por mapa nativo)
- Librería: **Leaflet 1.9.4** cargado por CDN (`unpkg.com/leaflet@1.9.4`), sin API key.
- Tiles: **CARTO Positron** (`{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`) — gratuito, estilo claro tipo Google Maps, atribución OSM+CARTO obligatoria.
- Marcadores: origen = local (naranja, "O"), destino = entrega (morado, "D", arrastrable).
- Polígono de cobertura urbana dibujado sobre el mapa (verde, semi-transparente).

En móvil, esto se traduce a un SDK de mapas nativo (Google Maps / Mapbox / MapLibre) dibujando el mismo polígono y los mismos dos marcadores + línea de ruta.

### 5.2 Polígono de cobertura — Huancavelica urbano
Constante `HUANCAVELICA_COVERAGE_POINTS` en `CartPage.tsx` (41 puntos, en orden, cierra el polígono automáticamente entre el último y el primero). **Copiar tal cual y en el mismo orden** al proyecto móvil para que el cálculo de "dentro/fuera de cobertura" sea idéntico en ambas plataformas:

```
PUNTO_5  : lat -12.7800974, lng -75.0372666
PUNTO_6  : lat -12.7730799, lng -75.0300459
PUNTO_7  : lat -12.76676,   lng -75.0227074
PUNTO_8  : lat -12.7636211, lng -75.0114636
PUNTO_9  : lat -12.7629497, lng -74.992224
PUNTO_10 : lat -12.7748462, lng -74.986897
PUNTO_11 : lat -12.778864,  lng -74.9765115
PUNTO_12 : lat -12.774361,  lng -74.9657448
PUNTO_13 : lat -12.764023,  lng -74.9623545
PUNTO_14 : lat -12.7699248, lng -74.9588354
PUNTO_15 : lat -12.7742357, lng -74.9578484
PUNTO_16 : lat -12.7788814, lng -74.9484499
PUNTO_17 : lat -12.7780443, lng -74.9401673
PUNTO_18 : lat -12.771306,  lng -74.9319704
PUNTO_19 : lat -12.7733568, lng -74.9295243
PUNTO_20 : lat -12.7877748, lng -74.9404677
PUNTO_21 : lat -12.7978141, lng -74.9413395
PUNTO_22 : lat -12.7985229, lng -74.9449901
PUNTO_23 : lat -12.7871119, lng -74.9553437
PUNTO_24 : lat -12.7916459, lng -74.9641773
PUNTO_25 : lat -12.7920597, lng -74.971565
PUNTO_26 : lat -12.7934826, lng -74.9789679
PUNTO_27 : lat -12.7960145, lng -74.984504
PUNTO_28 : lat -12.7922419, lng -74.9855645
PUNTO_29 : lat -12.7905888, lng -74.9805648
PUNTO_30 : lat -12.7877011, lng -74.9885471
PUNTO_31 : lat -12.7910493, lng -74.9889333
PUNTO_32 : lat -12.7896473, lng -74.9970873
PUNTO_33 : lat -12.788626,  lng -75.0077407
PUNTO_34 : lat -12.7805905, lng -75.0069682
PUNTO_35 : lat -12.7795023, lng -75.0187271
PUNTO_36 : lat -12.7828087, lng -75.0266664
PUNTO_37 : lat -12.7885423, lng -75.0318162
PUNTO_38 : lat -12.7917648, lng -75.0347345
PUNTO_39 : lat -12.7942339, lng -75.0357215
PUNTO_40 : lat -12.7920577, lng -75.0412147
PUNTO_41 : lat -12.7855709, lng -75.0389402
```

(Nota: la constante en código empieza en `PUNTO_5` — no hay puntos 1-4 en el archivo fuente; es simplemente el nombre/código original de cada punto, no faltan datos.)

### 5.3 Bounding box operacional (filtro rápido, no reemplaza el polígono)
```
HUANCAVELICA_CITY_BOUNDS = {
  minLat: -13.05, maxLat: -12.55,
  minLng: -75.25, maxLng: -74.65,
}
```
Se usa para descartar coordenadas basura (`0,0`, direcciones fuera de la región) antes incluso de evaluar el polígono. Una dirección guardada solo se considera "operacional" si cae dentro de este bounding box (o si el texto menciona "Huancavelica").

### 5.4 Algoritmo punto-en-polígono
Ray casting estándar con tolerancia para puntos sobre el borde — función `isPointInsidePolygon(point, polygon)`. Determina:
- **`inside`** → "Dentro de cobertura urbana": aplica tarifa urbana por zona A/B/C según distancia, subida y servicio.
- **`outside`** → "Fuera de cobertura urbana": no bloquea la compra; se cotiza como **Zona D** por kilometraje (`is_out_of_city: true` se manda automáticamente al backend en la cotización).

> Importante: estar fuera del polígono **no impide comprar**, solo cambia la tarifa/zona aplicada.

---

## 6. Cotización de tarifa (quote) — contrato con el backend

**Endpoint:** `POST /api/courier/quote`
**Auth:** Bearer token de sesión Supabase (`Authorization: Bearer <access_token>`), automático en cada request de `courierPaymentService`.

### Request (`CourierQuoteRequest`)
```ts
{
  branch_id: string,
  payment_method?: string,        // el web siempre manda 'card'
  tip_amount?: number,
  latitude?: number | null,       // punto de entrega
  longitude?: number | null,
  fulfillment_type?: 'delivery' | 'pickup',  // la app SIEMPRE manda 'delivery' — somos delivery-only
  is_out_of_city?: boolean,       // true si el punto cae fuera del polígono de cobertura
  items: [{ product_id, quantity, modifier_ids: string[] }],
}
```
Notas:
- **Ya no existe la opción de "recojo en tienda" (pickup) en el carrito.** Se eliminó del frontend web (toggle Delivery/Pickup, validaciones y ramas de lógica condicionadas por `fulfillment_type`). El campo sigue existiendo en el contrato del backend por compatibilidad, pero **la app móvil no debe implementar UI para elegir pickup** — mandar siempre `'delivery'` (o directamente omitir el campo, ya que es opcional).
- El tipo también soporta `zone`, `weight_kg`, `service_type`, `is_difficult_zone`, `wait_or_second_visit` (controles manuales de courier) — **ya no se envían desde la UI web actual** (se ocultaron/eliminaron), pero el backend los sigue aceptando si móvil decidiera exponerlos.

### Response (`CourierQuoteResponse`)
```ts
{
  quote_id: string,              // se usa luego para crear el pedido
  subtotal, discount, service_fee, service_fee_rate,  // 3.6% sobre productos - descuento
  delivery_fee, tip_amount,
  taxable_base, igv_rate, igv_amount,                 // IGV/IPM referencial (18%), ya incluido en precios
  payment_processing_fee, payment_processing_rate,
  payment_processing_fixed, payment_processing_provider, // 'culqi'
  payment_processing_note,
  payment_processing_tax_amount,
  total,                          // monto real a cobrar
  distance_km: number | null,
  coverage_status: 'inside' | 'outside' | 'unknown' | 'pickup',  // 'pickup' es un valor heredado del contrato; con delivery-only no debería aparecer
  coverage_label, coverage_detail,
  is_out_of_city,
  delivery_zone, delivery_zone_label, delivery_detail,
  delivery_surcharges_total,
  delivery_surcharges: [{ code, label, amount }],
  expires_at: string,             // ISO — la cotización expira
}
```
- **La cotización expira a los 5 minutos** (`expires_at`); el frontend la invalida localmente a los 4.5 min (`QUOTE_TTL_MS`) para evitar mandar una vencida.
- Cualquier cambio en carrito/dirección/propina invalida la cotización activa (`invalidateQuote()`); hay que pedir una nueva antes de pagar.

### Tarifas base de referencia (seed en Supabase, `delivery_zones`)
| Zona | Descripción | Tarifa base | Tiempo estimado |
|---|---|---|---|
| A | Casco urbano céntrico | S/ 5.50 | 25 min |
| B | Zona urbana conectada | S/ 8.00 | 35 min |
| C | Periferia urbana / zonas altas | S/ 12.00 | 45 min |
| D | Fuera de ciudad | S/ 10.00 | 60 min |

> Estos son valores **semilla** (`supabase/migrations/202606250001_seed_huancavelica_courier_zones.sql`); el cálculo real y definitivo (incluyendo recargos por distancia/peso/servicio) vive en el backend externo, fuera de este repo. Para exactitud, siempre confiar en el response de `/api/courier/quote`, no hardcodear estos montos en la app móvil.

### Comisión y tasas conocidas
- **Fee de servicio ACME:** 3.6% sobre `(productos − descuento)`.
- **IGV/IPM:** 18% (ya incluido en los precios mostrados, es solo desglose informativo).
- **Comisión de pasarela (Culqi):** variable, la retorna el backend en `payment_processing_*` (no hardcodear).

---

## 7. Creación del pedido

**Endpoint:** `POST /api/courier/orders`
```ts
{
  quote_id: string,               // de la cotización vigente
  fulfillment_type?: 'delivery' | 'pickup',  // la app SIEMPRE manda 'delivery'
  recipient_name?: string,
  recipient_phone?: string,
  address: {                      // ya no es opcional en la práctica: siempre hay dirección de entrega
    line1, line2?, reference?, district?, city?, region?, country?,
    lat?, lng?,
  },
}
```
Response: `{ order_id, order_code, total, payment_status }`.

> El campo `address` era condicional a `fulfillment_type === 'delivery'` cuando existía pickup; ahora, al ser delivery-only, la app móvil debe mandarlo siempre.

Flujo web (`handleCheckout` en `CartPage.tsx`):
1. Si el modo de dirección es "nueva" y el usuario marcó "guardar", primero se guarda en `customer_addresses` (`publicCustomerService.saveAddress`).
2. Se llama `createOrder(quote_id, ...)`.
3. Se marca la dirección usada (`markAddressUsed`) para estadísticas (`delivery_use_count`).
4. Con el `order_id` devuelto, se abre el checkout de pago (sección 8).

---

## 8. Pago — Culqi Checkout v4

### 8.1 Carga del SDK
- Script cargado dinámicamente: `https://checkout.culqi.com/js/v4` (no hay SDK nativo móvil propio en este código; en la app móvil habría que usar el SDK nativo de Culqi para Android/iOS o un WebView con este mismo checkout web).
- Se precarga en background apenas hay algo en el carrito (no bloquea la UI).

### 8.2 Crear orden Culqi (paso intermedio obligatorio)
**Endpoint:** `POST /api/courier/payments/order`
```ts
{ order_id, email_cliente?, nombre_cliente?, telefono_cliente?, descripcion? }
```
Response: `{ order_id, courier_order_id, payment_id, monto_centimos, mensaje }`
- `monto_centimos` viene del backend (`orders.total * 100`) — **nunca se calcula en el frontend**.

### 8.3 Abrir el checkout
```ts
culqi.publicKey = VITE_CULQI_PUBLIC_KEY;
culqi.settings({ title, currency: 'PEN', amount: monto_centimos, order: courier_order_id });
culqi.options({
  lang: 'es',
  installments: false,
  paymentMethods: { tarjeta: <requiere RSA id/key>, yape: true, bancaMovil: true, agente: true, billetera: true, cuotealo: true },
  style: { buttonBackground: '#ff6200', buttonText: 'Pagar', buttonTextColor: '#ffffff', priceColor: '#111827' },
});
culqi.open();
```
- El pago con **tarjeta** solo se habilita si `VITE_CULQI_RSA_ID` + `VITE_CULQI_RSA_PUBLIC_KEY` están configurados (seguridad anti-fraude RSA de Culqi). Sin ellos, solo Yape/billeteras/agente/banca móvil.
- **Sandbox:** si la key pública empieza con `pk_test`, se muestra ayuda: Yape de prueba = `900 000 001` + cualquier código de 6 dígitos.

### 8.4 Callback de Culqi → cobro real
Culqi invoca `window.culqi()` (callback global) al cerrar su modal:
- Si generó **token** (tarjeta): `POST /api/courier/payments/charge` con `{ order_id, token, payment_id, email_cliente, nombre_cliente }` → backend cobra con Culqi server-side y responde `{ exito, courier_order_id, payment_id, transaccion_id, mensaje }`.
- Si generó **order** (Yape/billetera/agente): el pago queda asíncrono/pendiente de confirmación por webhook del lado backend; no hay charge inmediato desde el frontend.
- Si hay error: se muestra `Culqi.error.user_message` (o `merchant_message`).

### 8.5 Estado final
- Pago exitoso → `publicStore.clearCart()` + redirect a `/mi-cuenta?tab=orders&orderId=<id>`.
- Pago pendiente/fallido → el pedido queda creado (`payment_status: pending|failed`); se puede reintentar el pago después (`pendingOrderId` reabre `openCulqiForOrder`).
- Consulta de estado: `courierPaymentService.getPaymentStatus(orderId)` — lee directo de Supabase `orders.payment_status` (no requiere backend externo).

---

## 9. Notas para la implementación móvil

1. **No hardcodear tarifas ni el % de comisión** — siempre pedir `/api/courier/quote` y confiar en su response. Los valores de esta tabla son solo referencia para entender el orden de magnitud.
2. **Copiar el polígono de cobertura exacto** (41 puntos, sección 5.2) para que un mismo punto dé el mismo resultado inside/outside en ambas plataformas.
3. **Mapa nativo:** reemplazar Leaflet/CARTO por el SDK de mapas que use la app (Google Maps si se usa `GOOGLE_MAPS_API_KEY`, o Mapbox/MapLibre). Mantener: marcador de origen (local), marcador de destino arrastrable, polígono de cobertura, línea de ruta.
4. **Ruteo:** se puede seguir usando OSRM público (gratis) o migrar a un proveedor con SLA si el volumen lo justifica; hoy es un endpoint sin autenticación llamado directo desde el cliente.
5. **Culqi en móvil:** evaluar SDK nativo de Culqi (Android/iOS) vs. WebView del checkout v4 actual. La lógica de negocio (crear orden Culqi → abrir checkout → cobrar con token → confirmar) debe mantenerse igual porque vive en el backend.
6. **Un solo local por carrito** es una regla de negocio activa — replicarla evita pedidos mixtos que el backend no soporta.
7. **Todas las llamadas al backend propio** (`courierPaymentService`) requieren el `access_token` de la sesión Supabase — asegurar que el cliente móvil de Supabase esté autenticado antes de cotizar/pagar.
8. Pedir a quien administre Culqi/Vercel los valores reales de `VITE_CULQI_PUBLIC_KEY` y `VITE_CULQI_RSA_ID/PUBLIC_KEY` antes de integrar el pago — no están en este repo. `VITE_ACME_API_URL` (`https://acme-operacione.vercel.app`) y `VITE_ROUTING_API_URL` (`https://router.project-osrm.org`) NO requieren gestión: ya son los defaults reales hardcodeados en el código y verificados en vivo.
9. **No implementar "recojo en tienda" (pickup).** Es una decisión de producto: ACME es delivery-only. Se eliminó del carrito web (toggle, validaciones y ramas condicionales por `fulfillment_type`). La app móvil no debe tener UI de selección de modalidad — el flujo entero (formulario de entrega, mapa, dirección) asume siempre `delivery`.
