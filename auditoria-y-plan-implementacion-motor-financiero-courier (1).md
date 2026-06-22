# Plan esencial de pagos y costos para ACME Courier

**Fecha:** 19 de junio de 2026  
**Objetivo:** completar únicamente la lógica necesaria para calcular, cobrar y distribuir correctamente el dinero de cada pedido.

---

## 1. Estado actual

El proyecto ya tiene:

- carrito y checkout;
- creación de pedidos;
- conexión con Culqi;
- zonas de reparto;
- tablas de pagos, reembolsos y liquidaciones.

Pero el cálculo todavía está incompleto:

```text
delivery_fee = 0
service_fee  = 0
tip_amount   = 0
total        = subtotal
```

Además, el navegador envía el precio de los productos directamente a Supabase. Esto permite que el monto pueda ser alterado antes de crear el pedido.

---

## 2. Cálculo oficial

El precio mostrado en el menú ya contiene el 30% de recargo. No se debe sumar otro 30%.

```text
productos = suma de productos y modificadores
descuento = cupón o promoción válida
base = productos - descuento

tarifa_pago = base × 3.6%
envío = tarifa calculada, mínimo S/ 5.00
propina = monto opcional

total = base + tarifa_pago + envío + propina
```

La tarifa de 3.6% se calculará sobre los productos después de descuentos. No incluirá envío, propina ni la propia tarifa.

Ejemplo:

```text
Productos:       S/ 60.00
Tarifa 3.6%:     S/  2.16
Envío:           S/  5.00
Propina:         S/  3.00
Total:           S/ 70.16
```

---

## 3. Envío indispensable

Usar inicialmente reglas simples y configurables:

| Distancia | Tarifa |
|---|---:|
| Hasta 2.5 km | S/ 5.00 |
| De 2.5 a 4 km | S/ 7.00 |
| De 4 a 6 km | S/ 9.00 |
| Más de 6 km | Fuera de cobertura |

Recargos opcionales:

| Condición | Recargo |
|---|---:|
| Lluvia | S/ 2.00 |
| Alta demanda | S/ 2.00 |

Reglas:

- El delivery nunca será menor a S/ 5.00.
- El recojo en tienda tendrá envío S/ 0.00.
- La dirección debe tener latitud y longitud.
- Si está fuera de cobertura, no se permitirá pagar.
- El cliente debe ver cualquier recargo antes de confirmar.

---

## 4. Archivos que deben modificarse

### `src/modules/public/cart/CartPage.tsx`

Actualmente muestra subtotal como total y crea el pedido antes de calcular los cargos.

Debe:

- solicitar el cálculo al backend;
- mostrar productos, 3.6%, envío, propina y total;
- permitir propina de S/ 0, sugerida o libre;
- abrir Culqi usando exactamente el total del backend;
- mostrar pago pendiente, aprobado o rechazado;
- limpiar el carrito únicamente cuando el pago esté confirmado.

### `src/app/providers/PublicStoreProvider.tsx`

Debe conservar el carrito, pero su subtotal será solo referencial.

No debe considerarse un monto válido para cobrar.

### `src/core/services/publicCustomerService.ts`

Debe dejar de crear pedidos directamente desde el navegador.

Eliminar del flujo financiero:

- cálculo mediante `unit_price` recibido del cliente;
- generación de `order_code` usando “último + 1”;
- inserciones separadas del pedido;
- totales calculados en frontend.

Mantener únicamente perfil, direcciones e historial.

### `src/core/services/courierPaymentService.ts`

Debe incorporar:

```text
createQuote()
createOrder()
createPayment()
getPaymentStatus()
```

Todas las llamadas deben utilizar el token de sesión.

### `src/core/services/adminOrdersService.ts`

Debe dejar de permitir que un administrador marque manualmente un pago como aprobado.

Los pagos y reembolsos finales deben actualizarse desde el backend después de comunicarse con Culqi.

### `src/core/services/adminSettlementsService.ts`

Debe calcular únicamente:

- monto que corresponde al comercio;
- monto que corresponde al repartidor;
- propina;
- ajustes o reembolsos.

---

## 5. Backend necesario

El backend de `/api/courier/payments/*` no está incluido en el ZIP y debe revisarse o incorporarse al proyecto.

Solo se necesitan estos endpoints:

### Calcular pedido

```http
POST /api/courier/quote
```

El frontend enviará:

```json
{
  "branch_id": "uuid",
  "payment_method": "card",
  "tip_amount": 3,
  "latitude": -12.78,
  "longitude": -74.97,
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2,
      "modifier_ids": ["uuid"]
    }
  ]
}
```

El backend consultará los precios reales y devolverá:

```json
{
  "quote_id": "uuid",
  "subtotal": 60,
  "discount": 0,
  "service_fee": 2.16,
  "delivery_fee": 5,
  "tip_amount": 3,
  "total": 70.16,
  "expires_at": "fecha"
}
```

### Crear pedido

```http
POST /api/courier/orders
```

Recibirá solamente `quote_id` y datos de entrega. Creará en una sola transacción:

- pedido;
- productos;
- modificadores;
- dirección;
- desglose de costos;
- estado inicial;
- intento de pago.

Si una parte falla, no debe guardarse nada.

### Cobrar

```http
POST /api/courier/payments/charge
```

El backend obtendrá el monto desde el pedido. Nunca recibirá el monto calculado por el navegador.

### Confirmación de Culqi

```http
POST /api/webhooks/culqi
```

El webhook será la fuente oficial para marcar:

```text
paid
failed
expired
refunded
```

### Reembolso

```http
POST /api/admin/refunds
```

Debe ejecutar el reembolso real en Culqi y luego actualizar la base de datos.

---

## 6. Cambios mínimos en base de datos

### Agregar a `products`

```text
merchant_price
customer_price
```

- `merchant_price`: monto que recibirá el comercio.
- `customer_price`: precio mostrado, con 30% incluido.

### Agregar a `orders`

```text
products_total
discount_total
service_fee_rate
service_fee
delivery_fee
tip_amount
total
quote_id
payment_status
```

### Agregar a `order_items`

```text
merchant_unit_price
customer_unit_price
platform_margin
```

Estos valores deben guardarse como fotografía histórica del momento de compra.

### Crear `order_quotes`

Campos esenciales:

```text
id
customer_id
branch_id
subtotal
discount
service_fee
delivery_fee
tip_amount
total
distance_km
expires_at
status
```

### Crear `payment_attempts`

Campos esenciales:

```text
id
order_id
provider
provider_payment_id
idempotency_key
amount
status
created_at
```

`idempotency_key` debe ser única para impedir cobros duplicados.

### Corregir `order_code`

No utilizar “último código + 1”.

Usar una secuencia de PostgreSQL y una restricción única.

---

## 7. Reglas de seguridad obligatorias

- El frontend nunca define precios finales.
- El backend consulta productos y modificadores reales.
- El monto enviado a Culqi sale de `orders.total`.
- Un pedido solo puede pertenecer al usuario autenticado.
- Una cotización vence después de cinco minutos.
- Una clave de idempotencia no puede usarse dos veces.
- Un webhook repetido no puede duplicar el pago.
- El cliente no puede escribir directamente en `payments`, `payment_attempts` o `refunds`.
- Un administrador no puede inventar una transacción Culqi.

---

## 8. Distribución básica del dinero

Por cada pedido pagado se debe registrar:

```text
Comercio:
  suma de merchant_price
  menos descuentos financiados por el comercio

ACME:
  margen incluido en los productos
  más tarifa de servicio
  más diferencia disponible del envío

Repartidor:
  pago de entrega definido
  más 100% de la propina
```

La comisión real cobrada por Culqi debe guardarse por separado cuando esté disponible. No debe confundirse con el 3.6% cobrado al cliente.

---

## 9. Orden de implementación

## Fase 1 — Cálculo

- [ ] Separar `merchant_price` y `customer_price`.
- [ ] Crear `order_quotes`.
- [ ] Implementar fórmula del 3.6%.
- [ ] Implementar envío por distancia.
- [ ] Implementar propina.
- [ ] Crear endpoint `/quote`.

**Resultado:** el backend devuelve un total correcto y no manipulable.

## Fase 2 — Pedido seguro

- [ ] Crear pedido desde `quote_id`.
- [ ] Guardar todo en una transacción.
- [ ] Usar secuencia para `order_code`.
- [ ] Guardar precios y desglose histórico.
- [ ] Validar sucursal, producto, horario y cobertura.

**Resultado:** no existen pedidos incompletos ni con precios alterados.

## Fase 3 — Pago Culqi

- [ ] Cobrar `orders.total`.
- [ ] Agregar idempotencia.
- [ ] Implementar webhook.
- [ ] Manejar aprobado, fallido y expirado.
- [ ] Mantener carrito hasta confirmación.
- [ ] Implementar reembolso real.

**Resultado:** no existen cobros duplicados ni pagos falsamente aprobados.

## Fase 4 — Liquidación básica

- [ ] Calcular monto del comercio.
- [ ] Calcular monto del repartidor.
- [ ] Separar propina.
- [ ] Descontar reembolsos.
- [ ] Marcar pedidos ya liquidados.

**Resultado:** cada pedido pagado puede distribuirse una sola vez.

---

## 10. Pruebas indispensables

- [ ] El precio modificado desde el navegador es ignorado.
- [ ] El 3.6% se calcula correctamente.
- [ ] El delivery mínimo es S/ 5.00.
- [ ] Pickup cobra S/ 0.00 de envío.
- [ ] Una dirección fuera de cobertura no puede pagar.
- [ ] La propina se suma una sola vez.
- [ ] Dos pedidos simultáneos reciben códigos distintos.
- [ ] Dos clics en pagar generan un solo cobro.
- [ ] Un webhook repetido no duplica la transacción.
- [ ] Un pago fallido no marca el pedido como pagado.
- [ ] Un reembolso registrado aparece también en Culqi.
- [ ] El monto mostrado coincide con el monto cobrado.
- [ ] El comercio y el repartidor no reciben dos veces el mismo pedido.

---

## 11. Criterio final de funcionamiento

El sistema estará listo cuando se cumpla todo lo siguiente:

```text
1. El backend calcula el total.
2. Los precios no pueden alterarse desde el navegador.
3. El menú no vuelve a sumar el 30%.
4. Se cobra el 3.6% correctamente.
5. El envío mínimo es S/ 5.00.
6. La propina es opcional y pertenece al repartidor.
7. Culqi cobra exactamente el total mostrado.
8. No existen cobros duplicados.
9. El webhook confirma el pago.
10. Los reembolsos se ejecutan realmente.
11. Se conoce cuánto recibe comercio, ACME y repartidor.
12. Un pedido solo puede liquidarse una vez.
```

No es necesario añadir más módulos antes de cerrar estos doce puntos.
