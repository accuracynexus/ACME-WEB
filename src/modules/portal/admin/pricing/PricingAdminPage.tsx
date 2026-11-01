import { ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AdminPageFrame, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { AdminTabs } from '../../../../components/admin/AdminTabs';
import { CheckboxField, FieldGroup, SelectField } from '../../../../components/admin/AdminFields';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { AppRoutes } from '../../../../core/constants/routes';
import {
  adminPricingService,
  BranchOption,
  ClientGroup,
  GatewayKey,
  GatewayMode,
  MerchantRule,
  PricingConfig,
  PricingConfigResponse,
  PricingVersion,
  SimResponse,
  SimResult,
} from '../../../../core/services/adminPricingService';
import { MAX_CART_BRANCHES } from '../../../public/store/PublicStoreContext';
import { PortalContext } from '../../../auth/session/PortalContext';
import { PricingMap, colorDePrecio } from './PricingMap';
import './PricingAdminPage.css';

type Pestana = 'simulador' | 'tarifa' | 'productos' | 'envio' | 'igv' | 'pasarelas' | 'cliente' | 'historial';

const GRUPOS: { value: ClientGroup; label: string }[] = [
  { value: 'producto', label: 'Producto' },
  { value: 'envio', label: 'Envío' },
  { value: 'comision', label: 'Comisión' },
];

const PASARELAS: { key: GatewayKey; titulo: string }[] = [
  { key: 'yape_directo', titulo: 'Yape directo (BCP Yape empresa + Accuracy Nexus)' },
  { key: 'izipay', titulo: 'Tarjeta por Izipay' },
  { key: 'culqi_yape', titulo: 'Yape por Culqi' },
  { key: 'culqi_card', titulo: 'Tarjeta por Culqi' },
];

const MODOS_PASARELA: { value: GatewayMode; label: string }[] = [
  { value: 'cost', label: 'Cobrar al cliente lo que cobra la pasarela (exacto)' },
  { value: 'percent', label: 'Cobrar un porcentaje propio del total' },
  { value: 'absorb', label: 'ACME lo paga (el cliente no ve comisión)' },
];

const soles = (n: number) => `S/ ${(Math.round(n * 100) / 100).toFixed(2)}`;
const clonar = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Campo de porcentaje: se escribe 12 y se guarda 0.12. */
function Porcentaje({ value, onChange, max = 100, step = 0.1 }: { value: number; onChange: (v: number) => void; max?: number; step?: number }) {
  const [texto, setTexto] = useState(String(r2(value * 100)));
  useEffect(() => {
    if (Math.abs(parseFloat(texto || '0') / 100 - value) > 1e-9) setTexto(String(r2(value * 100)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="cobros-input cobros-input--sufijo">
      <input
        type="number"
        min={0}
        max={max}
        step={step}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          const n = parseFloat(e.target.value);
          onChange(Number.isFinite(n) ? Math.max(0, n) / 100 : 0);
        }}
      />
      <span>%</span>
    </div>
  );
}

function Soles({ value, onChange, step = 0.1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  const [texto, setTexto] = useState(String(value));
  useEffect(() => {
    if (Math.abs(parseFloat(texto || '0') - value) > 1e-9) setTexto(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="cobros-input cobros-input--prefijo">
      <span>S/</span>
      <input
        type="number"
        min={0}
        step={step}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          const n = parseFloat(e.target.value);
          onChange(Number.isFinite(n) ? Math.max(0, n) : 0);
        }}
      />
    </div>
  );
}

function Numero({ value, onChange, step = 1, sufijo }: { value: number; onChange: (v: number) => void; step?: number; sufijo?: string }) {
  return (
    <div className={`cobros-input${sufijo ? ' cobros-input--sufijo' : ''}`}>
      <input type="number" min={0} step={step} value={value} onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))} />
      {sufijo ? <span>{sufijo}</span> : null}
    </div>
  );
}

function Grupo({ value, onChange, label = 'El cliente lo ve dentro de' }: { value: ClientGroup; onChange: (v: ClientGroup) => void; label?: string }) {
  return (
    <FieldGroup label={label}>
      <SelectField value={value} onChange={(e) => onChange(e.target.value as ClientGroup)} options={GRUPOS} />
    </FieldGroup>
  );
}

/** Como FieldGroup, pero sin <label>: para varios controles juntos (un label dentro de otro marca el primero al hacer clic). */
function Bloque({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--acme-text)' }}>{label}</span>
      {children}
      {hint ? <span style={{ fontSize: '12px', color: 'var(--acme-text-muted)' }}>{hint}</span> : null}
    </div>
  );
}

function Fila({ children }: { children: ReactNode }) {
  return <div className="cobros-fila">{children}</div>;
}

function Nota({ children }: { children: ReactNode }) {
  return <p className="cobros-nota">{children}</p>;
}

/* ——— Simulador ——————————————————————————————————————— */

interface ItemSim {
  price: number;
  quantity: number;
  merchant_id: string;
  exempt: boolean;
}

function TarjetaResultado({ r }: { r: SimResult }) {
  if (r.error) {
    return (
      <div className="cobros-resultado cobros-resultado--error">
        <h3>{r.label}</h3>
        <p>{r.error}</p>
      </div>
    );
  }
  return (
    <div className="cobros-resultado">
      <h3>{r.label}</h3>
      <div className="cobros-cliente">
        <span className="cobros-etiqueta">Lo que ve el cliente</span>
        {r.client_groups.map((g) => (
          <div key={g.key} className="cobros-linea">
            <span>
              {g.label}
              {r.client_group_details[g.key]?.length > 1 ? <em> · {r.client_group_details[g.key].join(' + ')}</em> : null}
            </span>
            <strong>{soles(g.amount)}</strong>
          </div>
        ))}
        {r.tip > 0 ? (
          <div className="cobros-linea">
            <span>Propina</span>
            <strong>{soles(r.tip)}</strong>
          </div>
        ) : null}
        <div className="cobros-linea cobros-linea--total">
          <span>Total</span>
          <strong>{soles(r.total)}</strong>
        </div>
      </div>
      <details className="cobros-interno" open>
        <summary>Desglose interno (solo gerente)</summary>
        {r.concepts
          .filter((c) => c.amount > 0)
          .map((c) => (
            <div key={c.key} className="cobros-linea cobros-linea--chica">
              <span>
                {c.label}
                <em> → {c.to}</em>
              </span>
              <span>{soles(c.amount)}</span>
            </div>
          ))}
        <span className="cobros-etiqueta" style={{ marginTop: 10 }}>
          Quién recibe qué
        </span>
        {r.payout
          .filter((p) => p.amount !== 0)
          .map((p) => (
            <div key={p.to} className={`cobros-linea cobros-linea--chica${p.to.startsWith('ACME') ? ' cobros-linea--acme' : ''}`}>
              <span>{p.to}</span>
              <strong>{soles(p.amount)}</strong>
            </div>
          ))}
        <Nota>
          Comisión cobrada {soles(r.gateway_fee)} · la pasarela descuenta {soles(r.gateway_cost)} · a ACME le {r.acme_gateway_margin >= 0 ? 'queda' : 'cuesta'}{' '}
          {soles(Math.abs(r.acme_gateway_margin))}.
        </Nota>
      </details>
    </div>
  );
}

function Simulador({
  draft,
  coverage,
  branches,
}: {
  draft: PricingConfig;
  coverage: { lat: number; lng: number }[];
  branches: BranchOption[];
}) {
  const [items, setItems] = useState<ItemSim[]>([{ price: 8, quantity: 1, merchant_id: '', exempt: false }]);
  const [modoEnvio, setModoEnvio] = useState<'manual' | 'mapa' | 'pickup'>('manual');
  const [envio, setEnvio] = useState(7);
  const [branchId, setBranchId] = useState('');
  const [destino, setDestino] = useState<{ lat: number; lng: number } | null>(null);
  const [locales, setLocales] = useState(1);
  const [propina, setPropina] = useState(0);
  const [express, setExpress] = useState(false);
  const [res, setRes] = useState<SimResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const branch = branches.find((b) => b.id === branchId);
  const origen = branch && branch.lat != null && branch.lng != null ? { lat: branch.lat, lng: branch.lng } : null;
  const negocios = useMemo(() => {
    const m = new Map<string, string>();
    branches.forEach((b) => m.set(b.merchant_id, b.merchant_name));
    return [...m.entries()].map(([value, label]) => ({ value, label }));
  }, [branches]);

  useEffect(() => {
    if (modoEnvio === 'mapa' && !destino) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setCargando(true);
      adminPricingService
        .simulate(
          {
            config: draft,
            items: items.map((i) => ({ ...i, merchant_id: i.merchant_id || (branch?.merchant_id ?? null) })),
            delivery_fee: modoEnvio === 'manual' ? envio : null,
            origin: modoEnvio === 'mapa' ? origen : null,
            destination: modoEnvio === 'mapa' ? destino : null,
            branch_count: locales,
            tip: propina,
            fulfillment_type: modoEnvio === 'pickup' ? 'pickup' : 'delivery',
            service_type: express ? 'express' : 'normal',
          },
          ctrl.signal,
        )
        .then((r) => {
          setRes(r);
          setError(null);
        })
        .catch((e: Error) => {
          if (e.name !== 'AbortError') setError(e.message);
        })
        .finally(() => setCargando(false));
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [draft, items, modoEnvio, envio, origen?.lat, origen?.lng, destino, locales, propina, express, branch?.merchant_id]);

  const cambiarItem = (i: number, cambio: Partial<ItemSim>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...cambio } : x)));

  return (
    <div className="cobros-sim">
      <SectionCard title="Pedido de prueba" description="Simula con los cambios que tienes en pantalla, aunque todavía no los guardes.">
        <div className="cobros-tabla">
          <div className="cobros-tabla__cab">
            <span>Precio del local</span>
            <span>Cantidad</span>
            <span>Negocio</span>
            <span>Exenta de tarifa</span>
            <span />
          </div>
          {items.map((it, i) => (
            <div key={i} className="cobros-tabla__fila">
              <Soles value={it.price} onChange={(v) => cambiarItem(i, { price: v })} />
              <Numero value={it.quantity} onChange={(v) => cambiarItem(i, { quantity: Math.max(1, v) })} />
              <SelectField
                value={it.merchant_id}
                onChange={(e) => cambiarItem(i, { merchant_id: e.target.value })}
                options={[{ value: '', label: branch ? `${branch.merchant_name} (del local)` : 'Cualquiera' }, ...negocios]}
              />
              <CheckboxField label="Bebidas ACME" checked={it.exempt} onChange={(e) => cambiarItem(i, { exempt: e.target.checked })} />
              <button type="button" className="btn btn--ghost" disabled={items.length === 1} onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>
                Quitar
              </button>
            </div>
          ))}
        </div>
        <div>
          <button type="button" className="btn btn--secondary" onClick={() => setItems((xs) => [...xs, { price: 10, quantity: 1, merchant_id: '', exempt: false }])}>
            Añadir producto
          </button>
        </div>
        <Fila>
          <FieldGroup label="Envío">
            <SelectField
              value={modoEnvio}
              onChange={(e) => setModoEnvio(e.target.value as typeof modoEnvio)}
              options={[
                { value: 'manual', label: 'Escribir el monto' },
                { value: 'mapa', label: 'Calcular en el mapa' },
                { value: 'pickup', label: 'Recojo en tienda' },
              ]}
            />
          </FieldGroup>
          {modoEnvio === 'manual' ? (
            <FieldGroup label="Monto del envío">
              <Soles value={envio} onChange={setEnvio} step={0.5} />
            </FieldGroup>
          ) : null}
          {modoEnvio === 'mapa' ? (
            <FieldGroup label="Local de origen">
              <SelectField
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                options={[{ value: '', label: 'Elige un local' }, ...branches.map((b) => ({ value: b.id, label: `${b.merchant_name} · ${b.name}` }))]}
              />
            </FieldGroup>
          ) : null}
          <FieldGroup label="Locales en el pedido" hint="2 o más suman el recargo por locales.">
            <Numero value={locales} onChange={(v) => setLocales(Math.max(1, Math.round(v)))} />
          </FieldGroup>
          <FieldGroup label="Propina">
            <Soles value={propina} onChange={setPropina} step={0.5} />
          </FieldGroup>
          <Bloque label="Servicio">
            <CheckboxField label="Express" checked={express} onChange={(e) => setExpress(e.target.checked)} />
          </Bloque>
        </Fila>
        {modoEnvio === 'mapa' ? (
          <>
            <Nota>Toca el mapa donde está el cliente. Los números son el precio de envío de cada punto que diste.</Nota>
            <PricingMap
              points={draft.delivery.sector_pricing.points}
              coverage={coverage}
              origin={origen}
              destination={destino}
              onMapClick={setDestino}
              height={380}
            />
          </>
        ) : null}
        {res?.delivery?.source === 'map' ? (
          <div className="cobros-envio-detalle">
            <StatusPill label={res.delivery.coverage ?? 'Cobertura'} tone={res.delivery.coverage?.includes('Fuera') ? 'warning' : 'success'} />
            <span>
              {res.delivery.zone_label} · {res.delivery.distance_km?.toFixed(2)} km · envío {soles(res.delivery.fee ?? 0)}
            </span>
            <em>{res.delivery.detail}</em>
          </div>
        ) : null}
      </SectionCard>

      {error ? <div className="account-alert account-alert--error">{error}</div> : null}
      {modoEnvio === 'mapa' && !destino ? <Nota>Marca el destino en el mapa para ver el precio.</Nota> : null}
      <div className={`cobros-resultados${cargando ? ' cobros-resultados--cargando' : ''}`}>
        {res?.results.map((r) => <TarjetaResultado key={r.method} r={r} />)}
      </div>
    </div>
  );
}

/* ——— Página ————————————————————————————————————————— */

function mostrarValor(v: unknown, path: string): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  const esTasa = /(^|\.)(rate|rates)$/.test(path);
  if (typeof v === 'number') return esTasa && v <= 1 ? `${r2(v * 100)}%` : String(v);
  if (Array.isArray(v)) {
    if (v.every((t) => t && typeof t === 'object' && 'rate' in (t as object) && 'up_to' in (t as object))) {
      return (v as { up_to: number | null; rate: number }[])
        .map((t) => `${t.up_to == null ? 'resto' : `hasta S/ ${t.up_to}`}: ${r2(t.rate * 100)}%`)
        .join(', ');
    }
    if (v.every((x) => typeof x === 'number')) return (v as number[]).map((x) => (esTasa && x <= 1 ? `${r2(x * 100)}%` : x)).join(', ');
    if (v.every((x) => typeof x === 'string')) return (v as string[]).join(', ') || '—';
    return `${v.length} elementos`;
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function Historial({ sucio, onRestaurado }: { sucio: boolean; onRestaurado: (version: number) => Promise<void> }) {
  const [items, setItems] = useState<PricingVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [volviendo, setVolviendo] = useState<number | null>(null);

  const cargar = useCallback(() => {
    adminPricingService
      .fetchHistory()
      .then((r) => setItems(r.items))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => cargar(), [cargar]);

  const volver = async (v: PricingVersion) => {
    const aviso = sucio ? '\n\nOjo: tienes cambios sin guardar en las otras pestañas y se van a perder.' : '';
    if (!window.confirm(`¿Volver a cobrar como en la versión ${v.version}? Se guarda como una versión nueva.${aviso}`)) return;
    setVolviendo(v.version);
    try {
      const r = await adminPricingService.restoreVersion(v.version);
      await onRestaurado(r.version_id);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setVolviendo(null);
    }
  };

  return (
    <SectionCard
      title="Historial de cambios"
      description="Cada vez que se guarda queda una versión con quién, cuándo, por qué y qué cambió. Cada pedido guarda con qué versión se cobró y cuánto le tocó a cada quien, así los números siempre cuadran aunque la tarifa cambie después."
    >
      {error ? <div className="account-alert account-alert--error">{error}</div> : null}
      {!items && !error ? <SectionSkeleton /> : null}
      {items && items.length === 0 ? (
        <Nota>Todavía no hay versiones guardadas. Se está cobrando con los valores de siempre; la primera vez que guardes aparece aquí la versión 1.</Nota>
      ) : null}
      <div className="cobros-historial">
        {(items ?? []).map((v) => (
          <article key={v.id} className={`cobros-version${v.is_current ? ' cobros-version--actual' : ''}`}>
            <header>
              <strong>Versión {v.version}</strong>
              {v.is_current ? <StatusPill label="Se cobra con esta" tone="success" /> : null}
              <span className="cobros-tenue">
                {new Date(v.created_at).toLocaleString('es-PE')}
                {v.updated_by_name ? ` · ${v.updated_by_name}` : ''}
              </span>
              {!v.is_current ? (
                <button type="button" className="btn btn--ghost" disabled={volviendo !== null} onClick={() => void volver(v)}>
                  {volviendo === v.version ? 'Volviendo…' : 'Volver a esta versión'}
                </button>
              ) : null}
            </header>
            {v.note ? <p className="cobros-version__nota">“{v.note}”</p> : null}
            {v.changes?.length ? (
              <ul className="cobros-cambios">
                {v.changes.map((c) => (
                  <li key={c.path}>
                    <span>{c.label}</span>
                    <em>
                      {mostrarValor(c.before, c.path)} → <b>{mostrarValor(c.after, c.path)}</b>
                    </em>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cobros-tenue">Sin cambios respecto a la anterior.</p>
            )}
            <div className="cobros-cuadre">
              <div className="cobros-linea cobros-linea--chica">
                <span>Pedidos cobrados con esta versión</span>
                <span>
                  {v.stats.paid_orders} de {v.stats.orders}
                </span>
              </div>
              <div className="cobros-linea cobros-linea--chica">
                <span>Total cobrado (pagados o entregados)</span>
                <span>{soles(v.stats.paid_total)}</span>
              </div>
              {Object.entries(v.stats.payout).map(([quien, monto]) => (
                <div key={quien} className="cobros-linea cobros-linea--chica">
                  <span className="cobros-tenue">{quien}</span>
                  <span>{soles(monto)}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      {items && items.length ? (
        <Nota>Los pedidos de antes de que existiera el historial no tienen versión y no aparecen aquí. No cuentan los cancelados ni los devueltos.</Nota>
      ) : null}
    </SectionCard>
  );
}

export function PricingAdminPage() {
  const portal = useContext(PortalContext);
  const [datos, setDatos] = useState<PricingConfigResponse | null>(null);
  const [draft, setDraft] = useState<PricingConfig | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [pestana, setPestana] = useState<Pestana>('simulador');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [punto, setPunto] = useState<number | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [negocioNuevo, setNegocioNuevo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [historialClave, setHistorialClave] = useState(0);
  const primera = useRef(true);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await adminPricingService.fetchConfig();
      setDatos(r);
      setDraft(clonar(r.config));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!primera.current) return;
    primera.current = false;
    void cargar();
    adminPricingService
      .fetchBranches()
      .then(setBranches)
      .catch(() => setBranches([]));
  }, [cargar]);

  const sucio = useMemo(() => !!datos && !!draft && JSON.stringify(datos.config) !== JSON.stringify(draft), [datos, draft]);

  const negocios = useMemo(() => {
    const m = new Map<string, string>();
    branches.forEach((b) => m.set(b.merchant_id, b.merchant_name));
    return [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [branches]);

  const sectores = useMemoSectores(draft);

  if (portal.currentScopeType !== 'platform') {
    return <div>Esta vista es solo para administradores de ACME.</div>;
  }

  const editar = (fn: (c: PricingConfig) => void) =>
    setDraft((actual) => {
      if (!actual) return actual;
      const c = clonar(actual);
      fn(c);
      return c;
    });

  const guardar = async () => {
    if (!draft) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await adminPricingService.saveConfig(draft, motivo);
      await cargar();
      setMotivo('');
      setHistorialClave((k) => k + 1);
      setAviso(`Guardado como versión ${r.version_id}. Los pedidos nuevos ya se cobran así (en menos de un minuto).`);
      setTimeout(() => setAviso(null), 6000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const coverage = datos?.coverage?.points ?? [];
  const costos = datos?.gateway_costs;

  return (
    <AdminPageFrame
      title="Cobros"
      description="Todo lo que ACME le cobra al cliente: tarifa, condición en productos, envío por zonas del mapa, varios locales, IGV y pasarelas. El cliente solo ve producto, envío y comisión."
      breadcrumbs={[{ label: 'Admin', to: AppRoutes.portal.admin.root }, { label: 'Cobros' }]}
      contextItems={[]}
      actions={
        <>
          {sucio ? (
            <input
              className="cobros-motivo"
              placeholder="Motivo del cambio (queda en el historial)"
              value={motivo}
              maxLength={500}
              onChange={(e) => setMotivo(e.target.value)}
            />
          ) : null}
          <button type="button" className="btn btn--ghost" disabled={!sucio || guardando} onClick={() => datos && setDraft(clonar(datos.config))}>
            Descartar cambios
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={!datos || guardando}
            onClick={() => {
              if (datos && window.confirm('¿Volver a los valores de siempre? Se aplican recién al guardar.')) setDraft(clonar(datos.defaults));
            }}
          >
            Valores de siempre
          </button>
          <button type="button" className="btn btn--primary" disabled={!sucio || guardando} onClick={() => void guardar()}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      <div className="cobros-estado">
        <StatusPill label={sucio ? 'Cambios sin guardar' : 'Sin cambios'} tone={sucio ? 'warning' : 'success'} />
        {datos ? (
          <span>
            {datos.saved && datos.updated_at
              ? `${datos.version_id ? `Versión ${datos.version_id} vigente. ` : ''}Última vez guardado: ${new Date(datos.updated_at).toLocaleString('es-PE')}`
              : 'Aún no se guardó nada: se cobra con los valores de siempre.'}
          </span>
        ) : null}
        {aviso ? <StatusPill label={aviso} tone="success" /> : null}
      </div>
      {error ? <div className="account-alert account-alert--error">{error}</div> : null}

      {!draft || !datos ? (
        error ? null : <SectionSkeleton />
      ) : (
        <>
          <AdminTabs
            activeTabId={pestana}
            onChange={(id) => setPestana(id as Pestana)}
            tabs={[
              { id: 'simulador', label: 'Simulador' },
              { id: 'tarifa', label: 'Tarifa de servicio' },
              { id: 'productos', label: 'Productos y negocios' },
              { id: 'envio', label: 'Envío y mapa' },
              { id: 'igv', label: 'IGV' },
              { id: 'pasarelas', label: 'Pasarelas' },
              { id: 'cliente', label: 'Lo que ve el cliente' },
              { id: 'historial', label: 'Historial' },
            ]}
          />

          {pestana === 'historial' ? (
            <Historial
              key={historialClave}
              sucio={sucio}
              onRestaurado={async (v) => {
                await cargar();
                setAviso(`Se volvió a esa configuración. Quedó como versión ${v}.`);
                setTimeout(() => setAviso(null), 6000);
              }}
            />
          ) : null}

          {pestana === 'simulador' ? <Simulador draft={draft} coverage={coverage} branches={branches} /> : null}

          {pestana === 'tarifa' ? (
            <SectionCard title="Tarifa de servicio" description="Lo que ACME cobra por comprar con la app. Elige sobre qué monto se calcula y sus porcentajes.">
              <CheckboxField label="Cobrar tarifa de servicio" checked={draft.service_fee.enabled} onChange={(e) => editar((c) => void (c.service_fee.enabled = e.target.checked))} />
              <Bloque label="Se calcula sobre" hint="Puedes marcar varios: por ejemplo, productos y envío.">
                <div className="cobros-checks">
                  {(
                    [
                      ['products', 'Los productos'],
                      ['delivery', 'El envío de la moto'],
                      ['multi_store', 'El recargo por varios locales'],
                    ] as const
                  ).map(([k, label]) => (
                    <CheckboxField
                      key={k}
                      label={label}
                      checked={draft.service_fee.base.includes(k)}
                      onChange={(e) =>
                        editar((c) => {
                          const set = new Set(c.service_fee.base);
                          if (e.target.checked) set.add(k);
                          else set.delete(k);
                          c.service_fee.base = [...set];
                        })
                      }
                    />
                  ))}
                </div>
              </Bloque>
              <Fila>
                <FieldGroup label="El tramo lo decide">
                  <SelectField
                    value={draft.service_fee.tier_by}
                    onChange={(e) => editar((c) => void (c.service_fee.tier_by = e.target.value as 'products' | 'base'))}
                    options={[
                      { value: 'base', label: 'El mismo monto sobre el que se cobra' },
                      { value: 'products', label: 'Lo que suman los productos' },
                    ]}
                  />
                </FieldGroup>
                <FieldGroup label="Cómo se aplican los tramos">
                  <SelectField
                    value={draft.service_fee.tier_mode}
                    onChange={(e) => editar((c) => void (c.service_fee.tier_mode = e.target.value as 'whole' | 'progressive'))}
                    options={[
                      { value: 'whole', label: 'El % del tramo va sobre todo (S/ 150 → 8% de 150)' },
                      { value: 'progressive', label: 'Escalonado (12% de 100 + 8% de los 50 que pasan)' },
                    ]}
                  />
                </FieldGroup>
              </Fila>
              <div className="cobros-tabla">
                <div className="cobros-tabla__cab cobros-tabla__cab--3">
                  <span>Hasta (S/)</span>
                  <span>Porcentaje</span>
                  <span />
                </div>
                {draft.service_fee.tiers.map((t, i) => {
                  const ultimo = i === draft.service_fee.tiers.length - 1;
                  return (
                    <div key={i} className="cobros-tabla__fila cobros-tabla__fila--3">
                      {ultimo ? (
                        <span className="cobros-tenue">{i === 0 ? 'Cualquier monto' : `Más de S/ ${draft.service_fee.tiers[i - 1].up_to}`}</span>
                      ) : (
                        <Soles value={t.up_to ?? 0} onChange={(v) => editar((c) => void (c.service_fee.tiers[i].up_to = v))} step={10} />
                      )}
                      <Porcentaje value={t.rate} onChange={(v) => editar((c) => void (c.service_fee.tiers[i].rate = v))} />
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={draft.service_fee.tiers.length === 1}
                        onClick={() =>
                          editar((c) => {
                            c.service_fee.tiers.splice(i, 1);
                            c.service_fee.tiers[c.service_fee.tiers.length - 1].up_to = null;
                          })
                        }
                      >
                        Quitar
                      </button>
                    </div>
                  );
                })}
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() =>
                    editar((c) => {
                      const t = c.service_fee.tiers;
                      const prev = t.length > 1 ? t[t.length - 2].up_to ?? 0 : 0;
                      t[t.length - 1].up_to = prev + 100;
                      t.push({ up_to: null, rate: t[t.length - 1].rate });
                    })
                  }
                >
                  Añadir tramo
                </button>
              </div>
              <Fila>
                <FieldGroup label="Monto fijo por pedido" hint="Se suma a la tarifa.">
                  <Soles value={draft.service_fee.fixed} onChange={(v) => editar((c) => void (c.service_fee.fixed = v))} />
                </FieldGroup>
                <FieldGroup label="Tarifa mínima" hint="0 = sin mínimo.">
                  <Soles value={draft.service_fee.min} onChange={(v) => editar((c) => void (c.service_fee.min = v))} />
                </FieldGroup>
                <FieldGroup label="Tarifa máxima" hint="0 = sin tope.">
                  <Soles value={draft.service_fee.max} onChange={(v) => editar((c) => void (c.service_fee.max = v))} />
                </FieldGroup>
              </Fila>
              <Bloque label="Categorías que no pagan tarifa" hint="Se compara sin mayúsculas ni tildes. Ej.: Bebidas ACME.">
                <div className="cobros-chips">
                  {draft.service_fee.exempt_categories.map((cat) => (
                    <span key={cat} className="cobros-chip">
                      {cat}
                      <button type="button" onClick={() => editar((c) => void (c.service_fee.exempt_categories = c.service_fee.exempt_categories.filter((x) => x !== cat)))}>
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    className="cobros-chip-input"
                    placeholder="Añadir categoría y Enter"
                    value={nuevaCategoria}
                    onChange={(e) => setNuevaCategoria(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && nuevaCategoria.trim()) {
                        e.preventDefault();
                        const v = nuevaCategoria.trim();
                        editar((c) => void (c.service_fee.exempt_categories = [...new Set([...c.service_fee.exempt_categories, v])]));
                        setNuevaCategoria('');
                      }
                    }}
                  />
                </div>
              </Bloque>
              <CheckboxField
                label="Si el pedido es solo de esas categorías, igual paga la tarifa sobre todo (mantenimiento)"
                checked={draft.service_fee.exempt_only_orders_pay}
                onChange={(e) => editar((c) => void (c.service_fee.exempt_only_orders_pay = e.target.checked))}
              />
              <Grupo value={draft.service_fee.group} onChange={(v) => editar((c) => void (c.service_fee.group = v))} />
            </SectionCard>
          ) : null}

          {pestana === 'productos' ? (
            <>
              <SectionCard
                title="Condición en el precio de los productos"
                description="Ganancia de ACME puesta dentro del producto. El local recibe su precio completo; la diferencia es de ACME. 0 = no se usa."
              >
                <Fila>
                  <FieldGroup label="Porcentaje sobre cada producto">
                    <Porcentaje value={draft.product_markup.rate} onChange={(v) => editar((c) => void (c.product_markup.rate = v))} max={500} />
                  </FieldGroup>
                  <FieldGroup label="Monto fijo por unidad">
                    <Soles value={draft.product_markup.fixed_per_unit} onChange={(v) => editar((c) => void (c.product_markup.fixed_per_unit = v))} />
                  </FieldGroup>
                </Fila>
                <Grupo value={draft.product_markup.group} onChange={(v) => editar((c) => void (c.product_markup.group = v))} />
                <Nota>Las categorías exentas de tarifa (Bebidas ACME) tampoco llevan esta condición.</Nota>
              </SectionCard>
              <SectionCard title="Reglas por negocio" description="Para un negocio en particular: su propia condición, su propia tarifa o sin tarifa. Lo que dejes vacío usa la regla general.">
                {draft.merchant_rules.length ? (
                  <div className="cobros-tabla">
                    <div className="cobros-tabla__cab cobros-tabla__cab--6">
                      <span>Negocio</span>
                      <span>Condición %</span>
                      <span>Condición S/ por unidad</span>
                      <span>Tarifa propia %</span>
                      <span>Sin tarifa</span>
                      <span />
                    </div>
                    {draft.merchant_rules.map((rule, i) => {
                      const set = (cambio: Partial<MerchantRule>) => editar((c) => void Object.assign(c.merchant_rules[i], cambio));
                      return (
                        <div key={rule.merchant_id} className="cobros-tabla__fila cobros-tabla__fila--6">
                          <strong>{rule.name || negocios.find((n) => n.value === rule.merchant_id)?.label || rule.merchant_id.slice(0, 8)}</strong>
                          <Opcional value={rule.markup_rate} onChange={(v) => set({ markup_rate: v })} porcentaje />
                          <Opcional value={rule.markup_fixed_per_unit} onChange={(v) => set({ markup_fixed_per_unit: v })} />
                          <Opcional value={rule.service_fee_rate} onChange={(v) => set({ service_fee_rate: v })} porcentaje disabled={rule.service_fee_exempt} />
                          <CheckboxField label="Exento" checked={rule.service_fee_exempt} onChange={(e) => set({ service_fee_exempt: e.target.checked })} />
                          <button type="button" className="btn btn--ghost" onClick={() => editar((c) => void c.merchant_rules.splice(i, 1))}>
                            Quitar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Nota>Ningún negocio tiene reglas propias.</Nota>
                )}
                <Fila>
                  <FieldGroup label="Añadir negocio">
                    <SelectField
                      value={negocioNuevo}
                      onChange={(e) => setNegocioNuevo(e.target.value)}
                      options={[
                        { value: '', label: 'Elige un negocio' },
                        ...negocios.filter((n) => !draft.merchant_rules.some((r) => r.merchant_id === n.value)),
                      ]}
                    />
                  </FieldGroup>
                  <div style={{ alignSelf: 'end' }}>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled={!negocioNuevo}
                      onClick={() => {
                        const n = negocios.find((x) => x.value === negocioNuevo);
                        editar((c) =>
                          void c.merchant_rules.push({
                            merchant_id: negocioNuevo,
                            name: n?.label ?? '',
                            markup_rate: null,
                            markup_fixed_per_unit: null,
                            service_fee_rate: null,
                            service_fee_exempt: false,
                          }),
                        );
                        setNegocioNuevo('');
                      }}
                    >
                      Añadir regla
                    </button>
                  </div>
                </Fila>
              </SectionCard>
            </>
          ) : null}

          {pestana === 'envio' ? (
            <>
              <SectionCard
                title="Precio de envío por partes del mapa"
                description="Cada número es un punto de referencia con su precio. El cliente paga el del punto más cercano; si el local está en una zona más cara, se cobra el mayor."
                actions={
                  <button type="button" className={`btn ${agregando ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setAgregando((v) => !v)}>
                    {agregando ? 'Toca el mapa para poner el punto' : 'Añadir punto'}
                  </button>
                }
              >
                <CheckboxField
                  label="Usar precios por puntos del mapa dentro de la ciudad"
                  checked={draft.delivery.sector_pricing.enabled}
                  onChange={(e) => editar((c) => void (c.delivery.sector_pricing.enabled = e.target.checked))}
                />
                <PricingMap
                  points={draft.delivery.sector_pricing.points}
                  coverage={coverage}
                  selected={punto}
                  onPointClick={(i) => {
                    setPunto(i);
                    setAgregando(false);
                  }}
                  onMapClick={(pos) => {
                    if (!agregando) return;
                    editar((c) =>
                      void c.delivery.sector_pricing.points.push({
                        ...pos,
                        fee: draft.delivery.sector_pricing.center_fee,
                        sector: punto != null ? draft.delivery.sector_pricing.points[punto]?.sector ?? 'Nuevo sector' : 'Nuevo sector',
                        source: 'admin',
                      }),
                    );
                    setPunto(draft.delivery.sector_pricing.points.length);
                    setAgregando(false);
                  }}
                />
                {punto != null && draft.delivery.sector_pricing.points[punto] ? (
                  <div className="cobros-punto">
                    <strong>Punto elegido</strong>
                    <FieldGroup label="Precio de envío">
                      <Soles
                        value={draft.delivery.sector_pricing.points[punto].fee}
                        onChange={(v) => editar((c) => void (c.delivery.sector_pricing.points[punto].fee = v))}
                        step={0.5}
                      />
                    </FieldGroup>
                    <FieldGroup label="Sector">
                      <input
                        className="cobros-texto"
                        value={draft.delivery.sector_pricing.points[punto].sector}
                        onChange={(e) => editar((c) => void (c.delivery.sector_pricing.points[punto].sector = e.target.value))}
                      />
                    </FieldGroup>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => {
                        editar((c) => void c.delivery.sector_pricing.points.splice(punto, 1));
                        setPunto(null);
                      }}
                    >
                      Borrar punto
                    </button>
                  </div>
                ) : (
                  <Nota>Toca un número del mapa para cambiar su precio o borrarlo.</Nota>
                )}
                <Bloque label="Cambiar un sector completo" hint="Cambia el precio de todos los puntos de ese sector a la vez.">
                  <div className="cobros-sectores">
                    {sectores.map((s) => (
                      <div key={s.sector} className="cobros-sector">
                        <i style={{ background: colorDePrecio(s.fee ?? s.hasta, sectores[0]?.min ?? 0, sectores[0]?.max ?? 0) }} />
                        <span>
                          {s.sector} <em>({s.count} puntos)</em>
                        </span>
                        <Opcional
                          value={s.fee}
                          placeholder={`${s.desde}–${s.hasta}`}
                          onChange={(v) =>
                            v != null && editar((c) => c.delivery.sector_pricing.points.forEach((p) => p.sector === s.sector && (p.fee = v)))
                          }
                        />
                        {s.fee == null ? <em className="cobros-tenue">precios distintos ({s.desde} a {s.hasta}); escribe uno para igualarlos</em> : null}
                      </div>
                    ))}
                  </div>
                </Bloque>
              </SectionCard>
              <SectionCard title="Zonas por distancia" description="Se usan cuando no hay coordenadas del cliente o los precios por mapa están apagados.">
                <div className="cobros-tabla">
                  <div className="cobros-tabla__cab cobros-tabla__cab--3">
                    <span>Zona</span>
                    <span>Hasta km</span>
                    <span>Precio</span>
                  </div>
                  {draft.delivery.zones.map((z, i) => (
                    <div key={z.code} className="cobros-tabla__fila cobros-tabla__fila--3">
                      <span>
                        <strong>{z.label ?? `Zona ${z.code}`}</strong> <em className="cobros-tenue">{z.name}</em>
                      </span>
                      {z.code === 'D' ? (
                        <span className="cobros-tenue">Fuera de ciudad</span>
                      ) : (
                        <Numero value={z.max_distance_km ?? 0} step={0.5} sufijo="km" onChange={(v) => editar((c) => void (c.delivery.zones[i].max_distance_km = v))} />
                      )}
                      <Soles value={z.base_fee} step={0.5} onChange={(v) => editar((c) => void (c.delivery.zones[i].base_fee = v))} />
                    </div>
                  ))}
                </div>
                <Fila>
                  <FieldGroup label="Fuera de la ciudad: base">
                    <Soles value={draft.delivery.outside_city.base_fee} onChange={(v) => editar((c) => void (c.delivery.outside_city.base_fee = v))} />
                  </FieldGroup>
                  <FieldGroup label="Fuera de la ciudad: por km">
                    <Soles value={draft.delivery.outside_city.cost_per_km} onChange={(v) => editar((c) => void (c.delivery.outside_city.cost_per_km = v))} />
                  </FieldGroup>
                  <FieldGroup label="Redondear el envío a" hint="0 = sin redondeo.">
                    <Soles value={draft.delivery.rounding_increment} step={0.1} onChange={(v) => editar((c) => void (c.delivery.rounding_increment = v))} />
                  </FieldGroup>
                  <FieldGroup label="Redondeo">
                    <SelectField
                      value={draft.delivery.rounding_mode}
                      onChange={(e) => editar((c) => void (c.delivery.rounding_mode = e.target.value as 'nearest'))}
                      options={[
                        { value: 'nearest', label: 'Al más cercano' },
                        { value: 'up', label: 'Hacia arriba' },
                        { value: 'down', label: 'Hacia abajo' },
                      ]}
                    />
                  </FieldGroup>
                </Fila>
              </SectionCard>
              <SectionCard title="Recargos del envío">
                <Fila>
                  <FieldGroup label="Express">
                    <Porcentaje value={draft.delivery.service_surcharges.express ?? 0} onChange={(v) => editar((c) => void (c.delivery.service_surcharges.express = v))} />
                  </FieldGroup>
                  <FieldGroup label="Zona alta o difícil">
                    <Soles value={draft.delivery.difficult_zone_fee} onChange={(v) => editar((c) => void (c.delivery.difficult_zone_fee = v))} />
                  </FieldGroup>
                  <FieldGroup label="Espera o segunda visita">
                    <Soles value={draft.delivery.wait_or_second_visit_fee} onChange={(v) => editar((c) => void (c.delivery.wait_or_second_visit_fee = v))} />
                  </FieldGroup>
                </Fila>
                <Fila>
                  <FieldGroup label="Peso incluido">
                    <Numero value={draft.delivery.weight.included_kg} sufijo="kg" onChange={(v) => editar((c) => void (c.delivery.weight.included_kg = v))} />
                  </FieldGroup>
                  <FieldGroup label="Cada">
                    <Numero value={draft.delivery.weight.step_kg} sufijo="kg" step={0.5} onChange={(v) => editar((c) => void (c.delivery.weight.step_kg = Math.max(0.01, v)))} />
                  </FieldGroup>
                  <FieldGroup label="se cobra">
                    <Soles value={draft.delivery.weight.fee_per_step} onChange={(v) => editar((c) => void (c.delivery.weight.fee_per_step = v))} />
                  </FieldGroup>
                </Fila>
                <Grupo value={draft.delivery.group} onChange={(v) => editar((c) => void (c.delivery.group = v))} />
              </SectionCard>
              <SectionCard
                title="Pedido con 2 o más locales"
                description="Por cada local extra se suma un porcentaje del envío, acumulado. La cantidad de filas fija cuántos locales se pueden juntar."
              >
                <div className="cobros-tabla">
                  {draft.multi_store.rates.map((rate, i) => (
                    <div key={i} className="cobros-tabla__fila cobros-tabla__fila--3">
                      <span>
                        {i + 2}° local <em className="cobros-tenue">(acumulado {r2(draft.multi_store.rates.slice(0, i + 1).reduce((a, b) => a + b, 0) * 100)}%)</em>
                      </span>
                      <Porcentaje value={rate} onChange={(v) => editar((c) => void (c.multi_store.rates[i] = v))} />
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={i !== draft.multi_store.rates.length - 1}
                        onClick={() => editar((c) => void c.multi_store.rates.pop())}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
                <Fila>
                  <div>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled={draft.multi_store.rates.length + 1 >= MAX_CART_BRANCHES}
                      onClick={() => editar((c) => void c.multi_store.rates.push(c.multi_store.rates[c.multi_store.rates.length - 1] ?? 0.1))}
                    >
                      Permitir un local más
                    </button>
                  </div>
                  <Nota>
                    Máximo por pedido: {draft.multi_store.rates.length + 1} locales. La web y la app aceptan hasta {MAX_CART_BRANCHES}; para más hay que
                    actualizarlas.
                  </Nota>
                </Fila>
                <Fila>
                  <FieldGroup label="Tope del recargo" hint="0 = sin tope.">
                    <Soles value={draft.multi_store.max_amount} onChange={(v) => editar((c) => void (c.multi_store.max_amount = v))} />
                  </FieldGroup>
                  <Grupo value={draft.multi_store.group} onChange={(v) => editar((c) => void (c.multi_store.group = v))} />
                </Fila>
              </SectionCard>
            </>
          ) : null}

          {pestana === 'igv' ? (
            <SectionCard title="IGV" description="El IGV de los productos lo ve cada local. Aquí decides el IGV de lo que cobra ACME.">
              <Fila>
                <FieldGroup label="Cómo se cobra">
                  <SelectField
                    value={draft.igv.mode}
                    onChange={(e) => editar((c) => void (c.igv.mode = e.target.value as PricingConfig['igv']['mode']))}
                    options={[
                      { value: 'added', label: 'Sumado encima (el envío llega completo)' },
                      { value: 'included', label: 'Incluido en el precio (sale más barato)' },
                      { value: 'none', label: 'No se cobra IGV' },
                    ]}
                  />
                </FieldGroup>
                <FieldGroup label="Tasa">
                  <Porcentaje value={draft.igv.rate} onChange={(v) => editar((c) => void (c.igv.rate = v))} />
                </FieldGroup>
              </Fila>
              <Bloque label="Se aplica a" hint="El IGV de cada parte se le muestra al cliente dentro del mismo grupo que esa parte.">
                <div className="cobros-checks">
                  {(
                    [
                      ['delivery', 'Envío de la moto'],
                      ['multi_store', 'Recargo por locales'],
                      ['service_fee', 'Tarifa de servicio'],
                      ['product_markup', 'Condición en productos'],
                    ] as const
                  ).map(([k, label]) => (
                    <CheckboxField
                      key={k}
                      label={label}
                      disabled={draft.igv.mode === 'none'}
                      checked={draft.igv.applies_to[k]}
                      onChange={(e) => editar((c) => void (c.igv.applies_to[k] = e.target.checked))}
                    />
                  ))}
                </div>
              </Bloque>
            </SectionCard>
          ) : null}

          {pestana === 'pasarelas' ? (
            <>
              {PASARELAS.map(({ key, titulo }) => {
                const g = draft.gateways[key];
                const costo = costos?.[key];
                return (
                  <SectionCard key={key} title={titulo}>
                    {costo ? (
                      <div className="cobros-costo">
                        <span className="cobros-etiqueta">Lo que la pasarela le cobra a ACME (contrato, no se cambia aquí)</span>
                        <span>
                          {r2(costo.rate * 100)}%{costo.fixed ? ` + S/ ${costo.fixed.toFixed(2)}` : ''}
                          {costo.igv ? ' + IGV' : ''}
                          {costo.min_fee ? ` · mínimo S/ ${costo.min_fee.toFixed(2)} bajo S/ ${costo.min_fee_below?.toFixed(2)}` : ''}
                        </span>
                        <em>{costo.note}</em>
                      </div>
                    ) : null}
                    <Fila>
                      <FieldGroup label="Al cliente se le cobra">
                        <SelectField
                          value={g.mode}
                          onChange={(e) => editar((c) => void (c.gateways[key].mode = e.target.value as GatewayMode))}
                          options={MODOS_PASARELA}
                        />
                      </FieldGroup>
                      {g.mode === 'percent' ? (
                        <>
                          <FieldGroup label="Porcentaje del total" hint="Del total que paga el cliente, comisión incluida.">
                            <Porcentaje value={g.rate} onChange={(v) => editar((c) => void (c.gateways[key].rate = v))} step={0.05} />
                          </FieldGroup>
                          <FieldGroup label="Más un fijo">
                            <Soles value={g.fixed} onChange={(v) => editar((c) => void (c.gateways[key].fixed = v))} />
                          </FieldGroup>
                        </>
                      ) : null}
                    </Fila>
                  </SectionCard>
                );
              })}
              <SectionCard title="Dónde lo ve el cliente">
                <Grupo value={draft.gateways.group} onChange={(v) => editar((c) => void (c.gateways.group = v))} />
              </SectionCard>
            </>
          ) : null}

          {pestana === 'cliente' ? (
            <SectionCard
              title="Lo que ve el cliente al pagar"
              description="Al pagar solo hay 3 líneas. Elige el nombre de cada una y qué cobros entran en cada línea. El detalle interno solo lo ves tú en el simulador."
            >
              <Fila>
                {GRUPOS.map((g) => (
                  <FieldGroup key={g.value} label={`Nombre de la línea "${g.label}"`}>
                    <input
                      className="cobros-texto"
                      value={draft.display.labels[g.value]}
                      onChange={(e) => editar((c) => void (c.display.labels[g.value] = e.target.value))}
                    />
                  </FieldGroup>
                ))}
              </Fila>
              <div className="cobros-tabla">
                <div className="cobros-tabla__cab cobros-tabla__cab--3">
                  <span>Cobro interno</span>
                  <span>Va en la línea</span>
                  <span />
                </div>
                {(
                  [
                    ['Condición en productos', draft.product_markup.group, (c: PricingConfig, v: ClientGroup) => (c.product_markup.group = v)],
                    ['Envío de la moto', draft.delivery.group, (c: PricingConfig, v: ClientGroup) => (c.delivery.group = v)],
                    ['Recargo por locales', draft.multi_store.group, (c: PricingConfig, v: ClientGroup) => (c.multi_store.group = v)],
                    ['Tarifa de servicio', draft.service_fee.group, (c: PricingConfig, v: ClientGroup) => (c.service_fee.group = v)],
                    ['Comisión de pago', draft.gateways.group, (c: PricingConfig, v: ClientGroup) => (c.gateways.group = v)],
                  ] as const
                ).map(([label, value, set]) => (
                  <div key={label} className="cobros-tabla__fila cobros-tabla__fila--3">
                    <span>{label}</span>
                    <SelectField value={value} onChange={(e) => editar((c) => void set(c, e.target.value as ClientGroup))} options={GRUPOS} />
                    <span />
                  </div>
                ))}
              </div>
              <Nota>El precio del local siempre va en la línea de producto. El IGV de cada cobro va en la misma línea que ese cobro. La propina, si la dejan, sale aparte.</Nota>
            </SectionCard>
          ) : null}
        </>
      )}
    </AdminPageFrame>
  );
}

function useMemoSectores(draft: PricingConfig | null) {
  return useMemo(() => {
    const pts = draft?.delivery.sector_pricing.points ?? [];
    const fees = pts.map((p) => p.fee);
    const min = fees.length ? Math.min(...fees) : 0;
    const max = fees.length ? Math.max(...fees) : 0;
    const m = new Map<string, { sector: string; count: number; fees: Set<number> }>();
    pts.forEach((p) => {
      const s = m.get(p.sector) ?? { sector: p.sector, count: 0, fees: new Set<number>() };
      s.count += 1;
      s.fees.add(p.fee);
      m.set(p.sector, s);
    });
    return [...m.values()]
      .map((s) => ({
        sector: s.sector,
        count: s.count,
        fee: s.fees.size === 1 ? [...s.fees][0] : null,
        desde: Math.min(...s.fees),
        hasta: Math.max(...s.fees),
        min,
        max,
      }))
      .sort((a, b) => (a.fee ?? 0) - (b.fee ?? 0));
  }, [draft]);
}

/** Valor que puede quedar vacio (= usa la regla general). */
function Opcional({
  value,
  onChange,
  porcentaje,
  disabled,
  placeholder = 'general',
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  porcentaje?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const mostrado = value == null ? '' : porcentaje ? String(r2(value * 100)) : String(value);
  return (
    <div className={`cobros-input ${porcentaje ? 'cobros-input--sufijo' : 'cobros-input--prefijo'}`}>
      {!porcentaje ? <span>S/</span> : null}
      <input
        type="number"
        min={0}
        step={porcentaje ? 0.5 : 0.1}
        placeholder={placeholder}
        disabled={disabled}
        value={mostrado}
        onChange={(e) => {
          if (e.target.value === '') return onChange(null);
          const n = Math.max(0, parseFloat(e.target.value) || 0);
          onChange(porcentaje ? n / 100 : n);
        }}
      />
      {porcentaje ? <span>%</span> : null}
    </div>
  );
}
