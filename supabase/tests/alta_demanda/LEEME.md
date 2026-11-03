# Pruebas de alta demanda

Se corren en un Postgres vacio (no en produccion): crean tablas falsas, clientes y motos simulados.

```
createdb sim
psql -d sim -f 01_esquema_simulado.sql
psql -d sim -c "alter table orders add column payment_status text default 'paid'"
psql -d sim -f ../../migrations/202611020001_alta_demanda.sql
psql -d sim -f 02_simulacion.sql
```

Cada escenario imprime `OK ...`; si algo falla se detiene con `FALLO: ...`.
