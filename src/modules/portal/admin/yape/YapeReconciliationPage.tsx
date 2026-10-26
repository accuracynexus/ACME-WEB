import { ReactNode, Suspense, lazy, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AdminPageFrame, StatusPill } from '../../../../components/admin/AdminScaffold';
import { AdminSearchBar } from '../../../../components/admin/AdminSearchBar';
import { AdminTabs } from '../../../../components/admin/AdminTabs';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { AppRoutes } from '../../../../core/constants/routes';
import { adminYapeService, YapeCobro, YapeConciliacion, YapeRecibido } from '../../../../core/services/adminYapeService';
import { PortalContext } from '../../../auth/session/PortalContext';
import { Seleccion, YapeDetailPanel, cobrosCandidatos } from './YapeDetailPanel';
import type { TraficoPunto } from './YapeTrafficChart';
import {
  COBRO_VEREDICTO,
  GRUPOS,
  Grupo,
  VISTAS,
  Vista,
  YAPE_VEREDICTO,
  corteDe,
  fechaHora,
  grupoDe,
  haceCuanto,
  hora,
  moverAncla,
  periodoDe,
  soles,
} from './yapeLabels';

const YapeTrafficChart = lazy(() => import('./YapeTrafficChart'));

type Pestana = 'yapes' | 'cobros' | 'devoluciones' | 'reclamos';
type FiltroYape = 'todos' | Grupo;
type FiltroCobro = 'todos' | 'pagados' | 'diferencia' | 'reclamados' | 'sin_pago' | 'en_curso';

// Con la vista en el periodo actual, se refresca solo.
const REFRESCO_MS = 30_000;
// Sin latido en este tiempo, el celular receptor no esta recibiendo.
const LATIDO_MAX_MS = 3 * 60_000;

function prefiereSinMovimiento() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Cifra que sube hasta su valor en lugar de saltar. */
function useCuentaAnimada(valor: number, duracion = 700) {
  const [mostrado, setMostrado] = useState(valor);
  const desde = useRef(valor);
  useEffect(() => {
    if (prefiereSinMovimiento()) {
      setMostrado(valor);
      return;
    }
    const inicio = performance.now();
    const origen = desde.current;
    let frame = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracion);
      const suave = 1 - Math.pow(1 - p, 3);
      setMostrado(origen + (valor - origen) * suave);
      if (p < 1) frame = requestAnimationFrame(tick);
      else desde.current = valor;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      desde.current = valor;
    };
  }, [valor, duracion]);
  return mostrado;
}

function Cifra({
  label,
  cantidad,
  centimos,
  color,
  activo,
  onClick,
  nota,
}: {
  label: string;
  cantidad: number;
  centimos: number;
  color: string;
  activo?: boolean;
  onClick?: () => void;
  nota?: string;
}) {
  const n = useCuentaAnimada(cantidad);
  const s = useCuentaAnimada(centimos);
  return (
    <button type="button" className={`yape-cifra${activo ? ' yape-cifra--activa' : ''}`} onClick={onClick} style={{ ['--yape-color' as string]: color }}>
      <span className="yape-cifra__label">
        <i />
        {label}
      </span>
      <strong className="yape-cifra__monto">{soles(Math.round(s))}</strong>
      <span className="yape-cifra__cantidad">
        {Math.round(n)} {Math.round(n) === 1 ? 'yape' : 'yapes'}
        {nota ? <em> · {nota}</em> : null}
      </span>
    </button>
  );
}

function Receptores({ datos, ahora }: { datos: YapeConciliacion; ahora: number }) {
  if (!datos.receptores.length) {
    return (
      <div className="yape-receptor yape-receptor--caido">
        <i />
        Ningún celular receptor se ha conectado. Sin él no se abren cobros con Yape directo.
      </div>
    );
  }
  return (
    <>
      {datos.receptores.map((r) => {
        const vivo = ahora - new Date(r.ultimo_latido).getTime() < LATIDO_MAX_MS && r.notificaciones_activas !== false;
        return (
          <div key={r.id} className={`yape-receptor${vivo ? '' : ' yape-receptor--caido'}`}>
            <i />
            <strong>{r.id}</strong>
            <span>{vivo ? 'recibiendo' : 'sin señal'}</span>
            <span>latido {haceCuanto(r.ultimo_latido, ahora)}</span>
            {r.bateria != null ? <span>batería {r.bateria}%</span> : null}
            {r.version_app ? <span>app {r.version_app}</span> : null}
            {r.notificaciones_activas === false ? <span>sin acceso a notificaciones</span> : null}
          </div>
        );
      })}
    </>
  );
}

/** Barra de proporciones: en que quedo cada sol que entro. */
function Proporcion({ partes }: { partes: { grupo: Grupo; centimos: number }[] }) {
  const total = partes.reduce((a, p) => a + p.centimos, 0);
  return (
    <div className="yape-proporcion" aria-hidden>
      {partes.map((p) => (
        <span key={p.grupo} style={{ width: total ? `${(p.centimos / total) * 100}%` : '0%', background: GRUPOS[p.grupo].color }} />
      ))}
    </div>
  );
}

function Tabla<T>({
  filas,
  id,
  columnas,
  onFila,
  vacio,
}: {
  filas: T[];
  id: (f: T) => string;
  columnas: { titulo: string; celda: (f: T) => ReactNode; derecha?: boolean; ancho?: string }[];
  onFila: (f: T) => void;
  vacio: string;
}) {
  if (!filas.length) return <div className="yape-vacio">{vacio}</div>;
  return (
    <div className="yape-tabla-envoltura">
      <table className="yape-tabla">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.titulo} style={{ textAlign: c.derecha ? 'right' : 'left', width: c.ancho }}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={id(f)} onClick={() => onFila(f)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onFila(f)} style={{ animationDelay: `${Math.min(i, 20) * 22}ms` }}>
              {columnas.map((c) => (
                <td key={c.titulo} style={{ textAlign: c.derecha ? 'right' : 'left' }}>
                  {c.celda(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dos({ main, sub }: { main: ReactNode; sub?: ReactNode }) {
  return (
    <div className="yape-dos">
      <strong>{main}</strong>
      {sub ? <span>{sub}</span> : null}
    </div>
  );
}

export function YapeReconciliationPage() {
  const portal = useContext(PortalContext);
  const [vista, setVista] = useState<Vista>('dia');
  const [ancla, setAncla] = useState(() => new Date());
  const [datos, setDatos] = useState<YapeConciliacion | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>('yapes');
  const [filtroYape, setFiltroYape] = useState<FiltroYape>('todos');
  const [filtroCobro, setFiltroCobro] = useState<FiltroCobro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [animarGrafico, setAnimarGrafico] = useState(true);

  const periodo = useMemo(() => periodoDe(vista, ancla), [vista, ancla]);
  const enCurso = ahora >= periodo.desde.getTime() && ahora < periodo.hasta.getTime();

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCargando(true);
      setError(null);
      try {
        setDatos(await adminYapeService.fetchConciliacion(periodo.desde, periodo.hasta));
        setAhora(Date.now());
      } catch (e) {
        setError((e as Error).message);
      } finally {
        if (!silencioso) setCargando(false);
      }
    },
    [periodo],
  );

  useEffect(() => {
    setAnimarGrafico(!prefiereSinMovimiento());
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!enCurso) return;
    const t = window.setInterval(() => {
      // Al refrescar solo, el grafico no vuelve a crecer desde cero.
      setAnimarGrafico(false);
      cargar(true);
    }, REFRESCO_MS);
    return () => window.clearInterval(t);
  }, [enCurso, cargar]);

  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 10_000);
    return () => window.clearInterval(t);
  }, []);

  const cobroDe = useMemo(() => {
    const m = new Map<string, YapeCobro>();
    datos?.cobros.forEach((c) => m.set(c.id, c));
    return m;
  }, [datos]);

  const yapesPeriodo = useMemo(() => (datos?.yapeos ?? []).filter((y) => y.del_periodo), [datos]);

  const resumen = useMemo(() => {
    const base = { conciliado: [0, 0], diferencia: [0, 0], aire: [0, 0], ignorado: [0, 0] } as Record<Grupo, [number, number]>;
    yapesPeriodo.forEach((y) => {
      const g = grupoDe(y);
      base[g][0] += 1;
      base[g][1] += y.monto_centimos;
    });
    const entro: [number, number] = [
      base.conciliado[0] + base.diferencia[0] + base.aire[0],
      base.conciliado[1] + base.diferencia[1] + base.aire[1],
    ];
    const aireAntes = (datos?.yapeos ?? []).filter((y) => !y.del_periodo).length;
    const devolucionesPendientes = (datos?.devoluciones ?? []).filter((d) => d.estado === 'pendiente');
    const reclamados = (datos?.cobros ?? []).filter((c) => c.veredicto === 'reclamado');
    const sinAviso = (datos?.cobros ?? []).filter((c) => c.estado === 'pagada' && !c.webhook_enviado_en);
    return { ...base, entro, aireAntes, devolucionesPendientes, reclamados, sinAviso };
  }, [yapesPeriodo, datos]);

  const trafico = useMemo<TraficoPunto[]>(() => {
    const puntos = periodo.cortes.map((c) => ({
      etiqueta: periodo.etiqueta(c),
      conciliado: 0,
      diferencia: 0,
      aire: 0,
      conciliado_centimos: 0,
      diferencia_centimos: 0,
      aire_centimos: 0,
    }));
    yapesPeriodo.forEach((y) => {
      const g = grupoDe(y);
      if (g === 'ignorado') return;
      const i = corteDe(periodo, y.recibido_en);
      if (i < 0) return;
      puntos[i][g] += 1;
      puntos[i][`${g}_centimos`] += y.monto_centimos;
    });
    return puntos;
  }, [periodo, yapesPeriodo]);

  const q = busqueda.trim().toLowerCase();

  const textoCobro = useCallback(
    (c: YapeCobro | undefined) => {
      if (!c || !datos) return '';
      const p = datos.pedidos[c.referencia];
      return [c.referencia, p?.codigo, p?.cliente_nombre, p?.comercio, c.nombre_esperado, soles(c.monto_base_centimos)].join(' ');
    },
    [datos],
  );

  const yapesFiltrados = useMemo(() => {
    let filas = datos?.yapeos ?? [];
    if (filtroYape !== 'todos') filas = filas.filter((y) => grupoDe(y) === filtroYape);
    else filas = filas.filter((y) => y.veredicto !== 'ignorado');
    if (q) {
      filas = filas.filter((y) =>
        [y.nombre_pagador, soles(y.monto_centimos), y.codigo_seguridad, textoCobro(cobroDe.get(y.sesion_id ?? y.sesion_propuesta_id ?? ''))]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    return filas;
  }, [datos, filtroYape, q, cobroDe, textoCobro]);

  const cobrosFiltrados = useMemo(() => {
    let filas = (datos?.cobros ?? []).filter((c) => c.veredicto !== 'reemplazado');
    const por: Record<FiltroCobro, (c: YapeCobro) => boolean> = {
      todos: () => true,
      pagados: (c) => c.veredicto === 'conciliado',
      diferencia: (c) => ['de_mas', 'deuda', 'incompleto', 'anulado'].includes(c.veredicto),
      reclamados: (c) => c.veredicto === 'reclamado',
      sin_pago: (c) => c.veredicto === 'sin_pago',
      en_curso: (c) => c.veredicto === 'en_curso',
    };
    filas = filas.filter(por[filtroCobro]);
    if (q) filas = filas.filter((c) => textoCobro(c).toLowerCase().includes(q));
    return filas;
  }, [datos, filtroCobro, q, textoCobro]);

  if (portal.currentScopeType !== 'platform') {
    return <div>Esta vista es solo para administradores de ACME.</div>;
  }

  const porResolver = resumen.aire[0] + resumen.aireAntes + resumen.devolucionesPendientes.length + resumen.reclamados.length;
  const cuadra = !!datos && porResolver === 0 && resumen.sinAviso.length === 0;

  const verYapes = (g: FiltroYape) => {
    setPestana('yapes');
    setFiltroYape((actual) => (actual === g ? 'todos' : g));
  };

  const pedidoDeCobro = (c: YapeCobro | undefined) => {
    if (!c || !datos) return null;
    const p = datos.pedidos[c.referencia];
    return <Dos main={p?.codigo ? `#${p.codigo}` : 'Sin pedido en ACME'} sub={p?.cliente_nombre ?? (c.cliente_id ? datos.clientes[c.cliente_id]?.nombre : null) ?? 'Invitado'} />;
  };

  return (
    <AdminPageFrame
      title="Conciliación Yape"
      description="Cada yape que llegó al celular receptor, a qué pedido se ligó y qué quedó sin dueño. Para decidir una devolución con certeza."
      breadcrumbs={[{ label: 'Admin', to: AppRoutes.portal.admin.root }, { label: 'Pagos', to: AppRoutes.portal.admin.payments }, { label: 'Conciliación Yape' }]}
      contextItems={[]}
      actions={
        <button type="button" className="btn btn--secondary" onClick={() => cargar()} disabled={cargando}>
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
      }
    >
      <div className="yape-periodo">
        <div className="yape-segmento" role="tablist">
          {VISTAS.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={vista === v.id} className={vista === v.id ? 'activo' : ''} onClick={() => setVista(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="yape-navegar">
          <button type="button" aria-label="Periodo anterior" onClick={() => setAncla((a) => moverAncla(vista, a, -1))}>
            ‹
          </button>
          <strong>{periodo.titulo}</strong>
          <button type="button" aria-label="Periodo siguiente" onClick={() => setAncla((a) => moverAncla(vista, a, 1))} disabled={enCurso}>
            ›
          </button>
          {!enCurso ? (
            <button type="button" className="yape-hoy" onClick={() => setAncla(new Date())}>
              Ir a ahora
            </button>
          ) : (
            <span className="yape-vivo">
              <i />
              En vivo · {hora(datos?.generado_en, true)}
            </span>
          )}
        </div>
      </div>

      {datos ? (
        <div className="yape-receptores">
          <Receptores datos={datos} ahora={ahora} />
        </div>
      ) : null}

      {error ? <div className="yape-error">{error}</div> : null}

      {!datos && cargando ? (
        <SectionSkeleton lines={6} />
      ) : datos ? (
        <>
          <section className={`yape-cierre${cuadra ? ' yape-cierre--ok' : ''}`}>
            <div className="yape-cierre__texto">
              <span className="yape-cierre__sello">{cuadra ? 'Todo cuadra' : `${porResolver} ${porResolver === 1 ? 'caso' : 'casos'} por resolver`}</span>
              <p>
                Entraron <strong>{soles(resumen.entro[1])}</strong> en {resumen.entro[0]} {resumen.entro[0] === 1 ? 'yape' : 'yapes'}.{' '}
                <strong>{soles(resumen.conciliado[1])}</strong> pagaron pedidos exactos
                {resumen.diferencia[0] ? (
                  <>
                    , <strong>{soles(resumen.diferencia[1])}</strong> llegaron con un monto distinto al pedido
                  </>
                ) : null}
                {resumen.aire[0] ? (
                  <>
                    {' '}y <strong className="yape-rojo">{soles(resumen.aire[1])}</strong> no tienen dueño confirmado
                  </>
                ) : null}
                .
                {resumen.aireAntes
                  ? ` Además ${resumen.aireAntes === 1 ? 'sigue sin dueño 1 yape' : `siguen sin dueño ${resumen.aireAntes} yapes`} de periodos anteriores.`
                  : ''}
                {resumen.reclamados.length
                  ? ` ${resumen.reclamados.length} ${resumen.reclamados.length === 1 ? 'cliente dice' : 'clientes dicen'} que pagó sin que llegara ningún yape.`
                  : ''}
                {resumen.sinAviso.length
                  ? ` ${resumen.sinAviso.length === 1 ? '1 cobro pagado aún no se avisó' : `${resumen.sinAviso.length} cobros pagados aún no se avisaron`} a ACME.`
                  : ''}
              </p>
            </div>
            <Proporcion
              partes={[
                { grupo: 'conciliado', centimos: resumen.conciliado[1] },
                { grupo: 'diferencia', centimos: resumen.diferencia[1] },
                { grupo: 'aire', centimos: resumen.aire[1] },
              ]}
            />
          </section>

          <div className="yape-cifras">
            <Cifra label="Entraron" cantidad={resumen.entro[0]} centimos={resumen.entro[1]} color="var(--acme-purple)" activo={pestana === 'yapes' && filtroYape === 'todos'} onClick={() => verYapes('todos')} />
            <Cifra label={GRUPOS.conciliado.label} cantidad={resumen.conciliado[0]} centimos={resumen.conciliado[1]} color={GRUPOS.conciliado.color} activo={pestana === 'yapes' && filtroYape === 'conciliado'} onClick={() => verYapes('conciliado')} />
            <Cifra label={GRUPOS.diferencia.label} cantidad={resumen.diferencia[0]} centimos={resumen.diferencia[1]} color={GRUPOS.diferencia.color} activo={pestana === 'yapes' && filtroYape === 'diferencia'} onClick={() => verYapes('diferencia')} />
            <Cifra
              label={GRUPOS.aire.label}
              cantidad={resumen.aire[0]}
              centimos={resumen.aire[1]}
              color={GRUPOS.aire.color}
              activo={pestana === 'yapes' && filtroYape === 'aire'}
              onClick={() => verYapes('aire')}
              nota={resumen.aireAntes ? `+${resumen.aireAntes} de antes` : undefined}
            />
          </div>

          <section className="section-card yape-grafico">
            <div className="section-card__header">
              <div>
                <h2 className="section-card__title">Tráfico de yapes</h2>
                <p className="section-card__subtitle">
                  Yapes que llegaron {vista === 'hora' ? 'cada 5 minutos' : vista === 'dia' ? 'por hora' : 'por día'}, según en qué quedaron.
                </p>
              </div>
              <div className="yape-leyenda">
                {(['conciliado', 'diferencia', 'aire'] as Grupo[]).map((g) => (
                  <span key={g}>
                    <i style={{ background: GRUPOS[g].color }} />
                    {GRUPOS[g].label}
                  </span>
                ))}
              </div>
            </div>
            <Suspense fallback={<div style={{ height: 220 }} />}>
              <YapeTrafficChart puntos={trafico} animar={animarGrafico} />
            </Suspense>
          </section>

          <section className="section-card">
            <AdminTabs
              tabs={[
                { id: 'yapes', label: 'Yapes recibidos', badge: String((datos.yapeos ?? []).filter((y) => y.veredicto !== 'ignorado').length) },
                { id: 'cobros', label: 'Cobros', badge: String(datos.cobros.filter((c) => c.veredicto !== 'reemplazado').length) },
                { id: 'devoluciones', label: 'Devoluciones', badge: resumen.devolucionesPendientes.length ? `${resumen.devolucionesPendientes.length} pend.` : undefined },
                { id: 'reclamos', label: 'Reclamos y capturas', badge: datos.reclamos.length + datos.capturas.length ? String(datos.reclamos.length + datos.capturas.length) : undefined },
              ]}
              activeTabId={pestana}
              onChange={(id) => setPestana(id as Pestana)}
            />

            {pestana === 'yapes' || pestana === 'cobros' ? (
              <div className="yape-filtros">
                <div className="filter-bar" style={{ marginBottom: 0 }}>
                  {pestana === 'yapes'
                    ? (
                        [
                          ['todos', 'Todos'],
                          ['conciliado', GRUPOS.conciliado.label],
                          ['diferencia', GRUPOS.diferencia.label],
                          ['aire', GRUPOS.aire.label],
                          ['ignorado', GRUPOS.ignorado.label],
                        ] as [FiltroYape, string][]
                      ).map(([id, label]) => (
                        <button key={id} type="button" className={`filter-chip${filtroYape === id ? ' filter-chip--active' : ''}`} onClick={() => setFiltroYape(id)}>
                          {label}
                        </button>
                      ))
                    : (
                        [
                          ['todos', 'Todos'],
                          ['pagados', 'Pagados exacto'],
                          ['diferencia', 'Con diferencia'],
                          ['reclamados', 'Dicen que pagaron'],
                          ['sin_pago', 'Sin pago'],
                          ['en_curso', 'En curso'],
                        ] as [FiltroCobro, string][]
                      ).map(([id, label]) => (
                        <button key={id} type="button" className={`filter-chip${filtroCobro === id ? ' filter-chip--active' : ''}`} onClick={() => setFiltroCobro(id)}>
                          {label}
                        </button>
                      ))}
                </div>
                <AdminSearchBar
                  value={busqueda}
                  onChange={setBusqueda}
                  placeholder="Buscar por nombre, pedido, monto o código"
                  label="Buscar yapes"
                  total={pestana === 'yapes' ? datos.yapeos.length : datos.cobros.length}
                  shown={pestana === 'yapes' ? yapesFiltrados.length : cobrosFiltrados.length}
                  noun={pestana === 'yapes' ? 'yapes' : 'cobros'}
                />
              </div>
            ) : null}

            {pestana === 'yapes' ? (
              <Tabla<YapeRecibido>
                filas={yapesFiltrados}
                id={(y) => y.id}
                onFila={(y) => setSeleccion({ tipo: 'yape', id: y.id })}
                vacio={filtroYape === 'aire' ? 'No hay yapes sin dueño. Todo lo que entró está ligado a un pedido.' : 'No llegaron yapes en este periodo.'}
                columnas={[
                  { titulo: 'Hora', ancho: '92px', celda: (y) => <Dos main={hora(y.recibido_en, true)} sub={y.del_periodo ? undefined : fechaHora(y.recibido_en).split(',')[0]} /> },
                  { titulo: 'Pagó', celda: (y) => <Dos main={y.nombre_pagador} sub={y.codigo_seguridad ? `código ${y.codigo_seguridad}` : 'sin código'} /> },
                  { titulo: 'Monto', derecha: true, celda: (y) => <strong className="yape-num">{soles(y.monto_centimos)}</strong> },
                  {
                    titulo: 'Pedido',
                    celda: (y) => {
                      const c = cobroDe.get(y.sesion_id ?? y.sesion_propuesta_id ?? '');
                      if (c) return pedidoDeCobro(c);
                      const posibles = y.veredicto === 'huerfano' ? cobrosCandidatos(datos, y).length : 0;
                      return <Dos main="—" sub={posibles ? `${posibles} cobro(s) parecido(s)` : 'ningún cobro coincide'} />;
                    },
                  },
                  {
                    titulo: 'Esperado',
                    derecha: true,
                    celda: (y) => {
                      const c = cobroDe.get(y.sesion_id ?? y.sesion_propuesta_id ?? '');
                      if (!c) return <span className="yape-tenue">—</span>;
                      const dif = y.monto_centimos - c.monto_centimos;
                      return <Dos main={soles(c.monto_centimos)} sub={dif && y.veredicto !== 'conciliado' ? `${dif > 0 ? '+' : ''}${soles(dif)}` : undefined} />;
                    },
                  },
                  { titulo: 'Veredicto', celda: (y) => <StatusPill label={YAPE_VEREDICTO[y.veredicto].label} tone={YAPE_VEREDICTO[y.veredicto].tone} /> },
                ]}
              />
            ) : null}

            {pestana === 'cobros' ? (
              <Tabla<YapeCobro>
                filas={cobrosFiltrados}
                id={(c) => c.id}
                onFila={(c) => setSeleccion({ tipo: 'cobro', id: c.id })}
                vacio="No hubo cobros con Yape directo en este periodo."
                columnas={[
                  { titulo: 'Abierto', ancho: '92px', celda: (c) => <Dos main={hora(c.creada_en, true)} sub={c.del_periodo ? undefined : fechaHora(c.creada_en).split(',')[0]} /> },
                  { titulo: 'Pedido', celda: (c) => pedidoDeCobro(c) },
                  { titulo: 'Pedido S/', derecha: true, celda: (c) => <span className="yape-num">{soles(c.monto_base_centimos)}</span> },
                  { titulo: 'Recibido', derecha: true, celda: (c) => <strong className="yape-num">{soles(c.recibido_centimos)}</strong> },
                  {
                    titulo: 'Confirmado por',
                    celda: (c) => <span className="yape-tenue">{c.metodo_confirmacion ? c.metodo_confirmacion.replace('_', ' ') : '—'}</span>,
                  },
                  { titulo: 'Veredicto', celda: (c) => <StatusPill label={COBRO_VEREDICTO[c.veredicto].label} tone={COBRO_VEREDICTO[c.veredicto].tone} /> },
                ]}
              />
            ) : null}

            {pestana === 'devoluciones' ? (
              <Tabla
                filas={datos.devoluciones}
                id={(d) => d.id}
                onFila={(d) => setSeleccion({ tipo: 'cobro', id: d.sesion_id })}
                vacio="No hay devoluciones en este periodo ni pendientes."
                columnas={[
                  { titulo: 'Pedida', ancho: '120px', celda: (d) => <span className="yape-tenue">{fechaHora(d.creada_en)}</span> },
                  { titulo: 'Pedido', celda: (d) => pedidoDeCobro(cobroDe.get(d.sesion_id)) ?? d.referencia.slice(0, 8) },
                  { titulo: 'Motivo', celda: (d) => (d.motivo === 'excedente' ? 'Pagó de más' : 'Dejó la compra') },
                  { titulo: 'Monto', derecha: true, celda: (d) => <strong className="yape-num">{soles(d.monto_centimos)}</strong> },
                  { titulo: 'A Yape', celda: (d) => <Dos main={d.celular} sub={`titular: ${d.titulares.join(' o ')}`} /> },
                  {
                    titulo: 'Estado',
                    celda: (d) => (
                      <StatusPill
                        label={d.estado === 'pendiente' ? 'Pendiente' : d.estado === 'hecha' ? `Hecha${d.numero_operacion ? ` · ${d.numero_operacion}` : ''}` : 'Rechazada'}
                        tone={d.estado === 'hecha' ? 'success' : d.estado === 'pendiente' ? 'warning' : 'neutral'}
                      />
                    ),
                  },
                ]}
              />
            ) : null}

            {pestana === 'reclamos' ? (
              <div style={{ display: 'grid', gap: '18px' }}>
                <Tabla
                  filas={datos.reclamos}
                  id={(r) => r.id}
                  onFila={(r) => r.sesion_id && setSeleccion({ tipo: 'cobro', id: r.sesion_id })}
                  vacio="Sin reclamos de clientes en este periodo."
                  columnas={[
                    { titulo: 'Reclamo', ancho: '120px', celda: (r) => <span className="yape-tenue">{fechaHora(r.creado_en)}</span> },
                    { titulo: 'Pedido', celda: (r) => pedidoDeCobro(datos.cobros.find((c) => c.referencia === r.referencia)) ?? r.referencia.slice(0, 8) },
                    { titulo: 'Con', celda: (r) => (r.por_nombre ? 'Nombre del titular' : 'Código de seguridad') },
                    { titulo: 'Monto', derecha: true, celda: (r) => <strong className="yape-num">{soles(r.monto_centimos)}</strong> },
                    {
                      titulo: 'Resultado',
                      celda: (r) => (
                        <StatusPill
                          label={{ aplicado: 'Aplicado', en_espera: 'En espera', revision: 'En revisión', no_encontrado: 'No encontrado' }[r.resultado]}
                          tone={r.resultado === 'aplicado' ? 'success' : r.resultado === 'en_espera' ? 'info' : 'danger'}
                        />
                      ),
                    },
                  ]}
                />
                <Tabla
                  filas={datos.capturas}
                  id={(c) => c.id}
                  onFila={(c) => setSeleccion({ tipo: 'cobro', id: c.sesion_id })}
                  vacio="Sin capturas subidas en este periodo."
                  columnas={[
                    { titulo: 'Captura', ancho: '120px', celda: (c) => <span className="yape-tenue">{fechaHora(c.creada_en)}</span> },
                    { titulo: 'Pedido', celda: (c) => pedidoDeCobro(cobroDe.get(c.sesion_id)) },
                    { titulo: 'Leído', celda: (c) => <Dos main={c.monto_centimos != null ? soles(c.monto_centimos) : 'Monto ilegible'} sub={c.numero_operacion ? `op. ${c.numero_operacion}` : undefined} /> },
                    { titulo: 'Motivo', celda: (c) => <span className="yape-tenue">{c.motivo ?? '—'}</span> },
                    {
                      titulo: 'Estado',
                      celda: (c) => (
                        <StatusPill label={{ asignada: 'Asignada', revision: 'En revisión', rechazada: 'Rechazada' }[c.estado]} tone={c.estado === 'asignada' ? 'success' : c.estado === 'revision' ? 'warning' : 'neutral'} />
                      ),
                    },
                  ]}
                />
              </div>
            ) : null}
          </section>

          {datos.avisos_no_leidos ? (
            <p className="yape-nota yape-nota--alto">
              {datos.avisos_no_leidos} notificaciones del celular no se pudieron leer en este periodo. Si Yape cambió su texto, puede haber pagos que no
              aparecen aquí.
            </p>
          ) : null}
          {datos.aviso ? <p className="yape-nota">{datos.aviso}</p> : null}

          <YapeDetailPanel datos={datos} seleccion={seleccion} onSelect={setSeleccion} onClose={() => setSeleccion(null)} />
        </>
      ) : null}
    </AdminPageFrame>
  );
}
