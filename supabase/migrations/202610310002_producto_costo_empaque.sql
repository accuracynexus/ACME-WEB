-- Costo de empaque por producto.
--
-- Todo es delivery: cada producto lleva taper, bolsa o caja. El local lo carga
-- al crear el producto. Es un dato del producto; por ahora NO se suma al total
-- del pedido (el total lo cotiza el backend), solo queda registrado.
--
-- Aditiva y segura: columna nueva con 0 por defecto, ninguna fila ni consulta
-- existente cambia. Mismo tipo que base_price (numeric con 2 decimales).
--
-- Rollback: alter table public.products drop column packaging_cost;

alter table public.products
  add column if not exists packaging_cost numeric(10,2) not null default 0
  check (packaging_cost >= 0);

comment on column public.products.packaging_cost is
  'Costo del empaque (taper, bolsa, caja) que lleva el producto en delivery, en soles. 0 si no lleva.';

notify pgrst, 'reload schema';
