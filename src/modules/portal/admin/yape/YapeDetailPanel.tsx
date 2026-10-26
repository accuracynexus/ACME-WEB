import { ReactNode, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StatusPill } from '../../../../components/admin/AdminScaffold';
import { AppRoutes } from '../../../../core/constants/routes';
import { getFinanceStatus } from '../../../../core/admin/utils/financeLabels';
import { getAdminOrderStatusLabel } from '../../../../core/admin/utils/orderWorkflow';
import type {
  YapeCobro,
  YapeConciliacion,
  YapeDevolucion,
  YapeRecibido,
} from '../../../../core/services/adminYapeService';
import { COBRO_VEREDICTO, METODO, YAPE_VEREDICTO, fechaHora, hora, soles } from './yapeLabels';

export type Seleccion = { tipo: 'yape'; id: string } | { tipo: 'cobro'; id: string };

type Tono = 'ok' | 'atencion' | 'alto' | 'neutro';

/** La respuesta que soporte necesita antes de tocar dinero. */
interface Dictamen {
  tono: Tono;
  titulo: string;
  texto: ReactNode;
  pasos?: ReactNode[];
}

function pedidoLink(datos: YapeConciliacion, referencia: string | null | undefined) {
  if (!referencia) return null;
  const pedido = datos.pedidos[referencia];
  const texto = pedido?.codigo ? `Pedido #${pedido.codigo}` : `Referencia ${referencia.slice(0, 8)}`;
  if (!pedido) return <span>{texto}</span>;
  return <Link to={AppRoutes.portal.admin.orderDetail.replace(':orderId', referencia)}>{texto}</Link>;
}

function nombreCliente(datos: YapeConciliacion, cobro: YapeCobro | undefined) {
  if (!cobro) return null;
  const pedido = datos.pedidos[cobro.referencia];
  return pedido?.cliente_nombre || (cobro.cliente_id ? datos.clientes[cobro.cliente_id]?.nombre : null) || null;
}

/** Cobros que pudieron ser de un yape sin dueño: monto parecido y abiertos cerca de esa hora. */
export function cobrosCandidatos(datos: YapeConciliacion, yape: YapeRecibido) {
  const t = new Date(yape.recibido_en).getTime();
  return datos.cobros.filter((c) => {
    if (c.estado === 'pagada' || c.veredicto === 'reemplazado') return false;
    const abierto = new Date(c.creada_en).getTime();
    if (t < abierto - 60_000 || t > abierto + 6 * 3_600_000) return false;
    const falta = c.monto_base_centimos - c.abonado_centimos;
    return Math.abs(yape.monto_centimos - falta) <= 100 || Math.abs(yape.monto_centimos - c.monto_centimos) <= 100;
  });
}

/** Yapes sin dueño que podrian ser del cobro de un cliente que dice que pago. */
export function yapesCandidatos(datos: YapeConciliacion, cobro: YapeCobro) {
  return datos.yapeos.filter((y) => (y.veredicto === 'huerfano' || y.veredicto === 'por_verificar') && cobrosCandidatos(datos, y).some((c) => c.id === cobro.id));
}

function dictamenYape(datos: YapeConciliacion, yape: YapeRecibido, cobro: YapeCobro | undefined): Dictamen {
  const quien = <strong>{yape.nombre_pagador}</strong>;
  switch (yape.veredicto) {
    case 'conciliado':
      return {
        tono: 'ok',
        titulo: 'Pagó un pedido. No hay nada que devolver.',
        texto: (
          <>
            Este yape de {soles(yape.monto_centimos)} quedó ligado a {pedidoLink(datos, cobro?.referencia)} y el cobro está
            pagado exacto. Si el pedido se cancela, se devuelve por Pagos, solo a un Yape a nombre de {quien}.
          </>
        ),
      };
    case 'de_mas':
      return {
        tono: 'atencion',
        titulo: `Pagó ${soles(cobro?.excedente_centimos)} de más.`,
        texto: (
          <>
            El pedido quedó pagado. Solo el excedente se devuelve
            {cobro && cobro.saldo_favor_abonado_centimos > 0
              ? `; ${soles(cobro.saldo_favor_abonado_centimos)} ya quedaron como saldo a favor del cliente`
              : ''}
            . Lo devuelto va solo a un Yape cuyo titular sea {quien}.
          </>
        ),
        pasos: [
          'Revisa la pestaña Devoluciones: si el cliente la pidió, ahí está el celular.',
          'Al escribir el número en Yape, el nombre que aparece debe ser el del pagador. Si no coincide, no envíes.',
        ],
      };
    case 'parcial':
      return {
        tono: 'atencion',
        titulo: 'Abono: no cubre el pedido.',
        texto: (
          <>
            {quien} yapeó {soles(yape.monto_centimos)} para {pedidoLink(datos, cobro?.referencia)}, que cuesta{' '}
            {soles(cobro?.monto_base_centimos)}. Se abonó {soles(cobro?.abonado_centimos)} en total; falta{' '}
            {soles((cobro?.monto_base_centimos ?? 0) - (cobro?.abonado_centimos ?? 0))}.
          </>
        ),
        pasos: ['Si el cliente deja la compra, el abono se devuelve completo y solo a un Yape a nombre del pagador.'],
      };
    case 'anulado':
      return {
        tono: 'atencion',
        titulo: 'El cliente dejó la compra con este dinero de por medio.',
        texto: <>Revisa su devolución en la pestaña Devoluciones. Solo se devuelve a un Yape a nombre de {quien}.</>,
      };
    case 'por_verificar': {
      const propuesto = datos.cobros.find((c) => c.id === yape.sesion_propuesta_id);
      return {
        tono: 'alto',
        titulo: 'Llegó, pero aún no se sabe de quién es.',
        texto: (
          <>
            Parece de {pedidoLink(datos, propuesto?.referencia) ?? 'un pedido'}, pero el cliente no lo confirmó con su código o el
            nombre del titular. El dinero está en la cuenta y no pagó nada todavía.
          </>
        ),
        pasos: [
          'No lo asignes ni lo devuelvas por teléfono sin la constancia.',
          <>
            Pide al cliente su constancia de Yape. Debe decir {quien}, {soles(yape.monto_centimos)}, a las {hora(yape.publicado_en ?? yape.recibido_en)}
            {yape.codigo_seguridad ? ', y su código de seguridad' : ''}. No le dictes estos datos: que los lea el cliente.
          </>,
        ],
      };
    }
    case 'huerfano':
      return {
        tono: 'alto',
        titulo: 'Entró dinero que no es de ningún pedido.',
        texto: (
          <>
            {soles(yape.monto_centimos)} de {quien} llegaron al celular receptor y no se ligaron a ningún cobro. Es dinero real en la
            cuenta: se puede devolver, pero solo a su dueño.
          </>
        ),
        pasos: [
          <>
            Pide la constancia: nombre {quien}, monto {soles(yape.monto_centimos)}, hora {hora(yape.publicado_en ?? yape.recibido_en)}
            {yape.codigo_seguridad ? ' y el código de seguridad' : ''}. Que te los lea el cliente.
          </>,
          'Devuelve solo a un Yape cuyo titular sea ese mismo nombre, y por ese monto como máximo.',
          'Si ya se devolvió por otro lado, no lo vuelvas a devolver: anota el número de operación.',
        ],
      };
    default:
      return {
        tono: 'neutro',
        titulo: 'Descartado por el sistema.',
        texto: 'Era un aviso repetido o no era un yape. No movió dinero en ningún pedido.',
      };
  }
}

function dictamenCobro(datos: YapeConciliacion, cobro: YapeCobro): Dictamen {
  const total = soles(cobro.monto_base_centimos);
  switch (cobro.veredicto) {
    case 'conciliado':
      return { tono: 'ok', titulo: 'Pagado exacto.', texto: `Entró ${soles(cobro.recibido_centimos)} por un pedido de ${total}, confirmado por el celular receptor.` };
    case 'de_mas':
      return {
        tono: 'atencion',
        titulo: `Pagado, con ${soles(cobro.excedente_centimos)} de más.`,
        texto: `Se devuelve solo el excedente, una vez, y a un Yape a nombre de quien yapeó. Ya devuelto: ${soles(cobro.devuelto_centimos)}.`,
      };
    case 'deuda':
      return {
        tono: 'alto',
        titulo: 'Figuraba pagado, pero se le quitó un yape que era de otro cliente.',
        texto: `Quedan ${soles(cobro.abonado_centimos)} de ${total}; se quitaron ${soles(cobro.quitado_centimos)}. El cliente quedó con una deuda y no puede usar saldo a favor hasta pagarla. No devuelvas nada de este cobro.`,
      };
    case 'incompleto':
      return {
        tono: 'atencion',
        titulo: 'Pago incompleto.',
        texto: `Entró ${soles(cobro.abonado_centimos)} de ${total}. El pedido no está pagado. Si el cliente no completa, el abono se devuelve a quien yapeó.`,
      };
    case 'anulado':
      return {
        tono: 'atencion',
        titulo: 'Compra anulada con dinero de por medio.',
        texto: `Se abonó ${soles(cobro.abonado_centimos)}; ya devuelto ${soles(cobro.devuelto_centimos)}. Revisa la devolución.`,
      };
    case 'reclamado':
      return {
        tono: 'alto',
        titulo: 'El cliente dice que pagó, pero no llegó ningún yape.',
        texto: (
          <>
            El celular receptor no recibió ningún yape para este cobro de {total}. No lo des por pagado ni devuelvas nada: sin yape recibido,
            no entró dinero.
          </>
        ),
        pasos: [
          'Mira abajo los yapes sin dueño de un monto parecido. Si uno coincide con la constancia del cliente (nombre, monto, hora y código), es ese.',
          'Si ninguno coincide, pide al cliente que reenvíe el correo de Yape a soporte antes de hacer nada.',
        ],
      };
    case 'en_curso':
      return { tono: 'neutro', titulo: 'La ventana de pago sigue abierta.', texto: `El cliente puede yapear ${soles(cobro.monto_centimos)} hasta las ${hora(cobro.expira_en, true)}.` };
    case 'reemplazado':
      return { tono: 'neutro', titulo: 'Reemplazado por otro cobro del mismo pedido.', texto: 'No cuenta para la conciliación.' };
    default:
      return { tono: 'neutro', titulo: 'Cerró sin pago.', texto: 'No entró dinero y el cliente no reclamó. No hay nada que devolver.' };
  }
}

function DictamenBox({ dictamen }: { dictamen: Dictamen }) {
  return (
    <div className={`yape-dictamen yape-dictamen--${dictamen.tono}`}>
      <strong className="yape-dictamen__titulo">{dictamen.titulo}</strong>
      <p className="yape-dictamen__texto">{dictamen.texto}</p>
      {dictamen.pasos?.length ? (
        <ol className="yape-dictamen__pasos">
          {dictamen.pasos.map((paso, i) => (
            <li key={i}>{paso}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function Dato({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="yape-dato">
      <span className="yape-dato__label">{label}</span>
      <span className={`yape-dato__valor${mono ? ' yape-dato__valor--mono' : ''}`}>{children ?? '—'}</span>
    </div>
  );
}

function Linea({ items }: { items: { momento: string | null; texto: ReactNode; tono?: Tono }[] }) {
  const visibles = items.filter((i) => i.momento).sort((a, b) => new Date(a.momento!).getTime() - new Date(b.momento!).getTime());
  return (
    <ol className="yape-linea">
      {visibles.map((item, i) => (
        <li key={i} className={`yape-linea__item yape-linea__item--${item.tono ?? 'neutro'}`} style={{ animationDelay: `${i * 60}ms` }}>
          <span className="yape-linea__hora">{fechaHora(item.momento)}</span>
          <span>{item.texto}</span>
        </li>
      ))}
    </ol>
  );
}

function CobroResumen({ datos, cobro }: { datos: YapeConciliacion; cobro: YapeCobro }) {
  const pedido = datos.pedidos[cobro.referencia];
  const cliente = cobro.cliente_id ? datos.clientes[cobro.cliente_id] : undefined;
  const diferencia = cobro.recibido_centimos - (cobro.monto_base_centimos - cobro.saldo_favor_usado_centimos);
  return (
    <>
      <div className="yape-datos">
        <Dato label="Pedido">{pedidoLink(datos, cobro.referencia)}</Dato>
        <Dato label="Comercio">{pedido?.comercio}</Dato>
        <Dato label="Cliente">{nombreCliente(datos, cobro) ?? 'Invitado'}</Dato>
        <Dato label="Celular del cliente">{pedido?.cliente_celular ?? cliente?.celular}</Dato>
        <Dato label="Estado del pedido">{pedido
            ? `${getAdminOrderStatusLabel(pedido.estado ?? '', pedido.estado_pago)} · pago ${getFinanceStatus(pedido.estado_pago).label.toLowerCase()}`
            : 'No está en ACME'}</Dato>
        <Dato label="Nombre que dijo antes de pagar">{cobro.nombre_esperado}</Dato>
      </div>
      <div className="yape-cuentas">
        <div>
          <span>Pedido</span>
          <strong>{soles(cobro.monto_base_centimos)}</strong>
        </div>
        <div>
          <span>Se pidió yapear</span>
          <strong>{soles(cobro.monto_base_centimos + cobro.extra_centimos - cobro.saldo_favor_usado_centimos)}</strong>
        </div>
        <div>
          <span>Recibido</span>
          <strong>{soles(cobro.recibido_centimos)}</strong>
        </div>
        <div className={diferencia === 0 ? '' : diferencia > 0 ? 'yape-cuentas--mas' : 'yape-cuentas--menos'}>
          <span>Diferencia</span>
          <strong>
            {diferencia > 0 ? '+' : ''}
            {soles(diferencia)}
          </strong>
        </div>
      </div>
      {cobro.saldo_favor_usado_centimos > 0 || cobro.devuelto_centimos > 0 || cobro.quitado_centimos > 0 ? (
        <div className="yape-datos">
          {cobro.saldo_favor_usado_centimos > 0 ? <Dato label="Pagado con saldo a favor">{soles(cobro.saldo_favor_usado_centimos)}</Dato> : null}
          {cobro.devuelto_centimos > 0 ? <Dato label="Ya devuelto">{soles(cobro.devuelto_centimos)}</Dato> : null}
          {cobro.quitado_centimos > 0 ? <Dato label="Quitado (era de otro cliente)">{soles(cobro.quitado_centimos)}</Dato> : null}
        </div>
      ) : null}
    </>
  );
}

function lineaCobro(cobro: YapeCobro, devoluciones: YapeDevolucion[]) {
  return [
    { momento: cobro.creada_en, texto: `Se abrió el cobro por ${soles(cobro.monto_centimos)}` },
    { momento: cobro.declaro_pago_en, texto: 'El cliente tocó "Ya yapeé"', tono: 'atencion' as Tono },
    ...cobro.yapeos.map((y) => ({
      momento: y.recibido_en,
      texto: `Llegó ${soles(y.monto_centimos)} de ${y.nombre_pagador}`,
      tono: 'ok' as Tono,
    })),
    {
      momento: cobro.pagada_en,
      texto: `Pagado · ${METODO[cobro.metodo_confirmacion ?? ''] ?? cobro.metodo_confirmacion ?? ''}`,
      tono: 'ok' as Tono,
    },
    {
      momento: cobro.webhook_enviado_en,
      texto: 'ACME recibió el aviso y marcó el pedido pagado',
    },
    ...devoluciones.map((d) => ({
      momento: d.resuelta_en ?? d.creada_en,
      texto: `Devolución ${d.estado} de ${soles(d.monto_centimos)} al ${d.celular}`,
      tono: 'atencion' as Tono,
    })),
  ];
}

export function YapeDetailPanel({
  datos,
  seleccion,
  onSelect,
  onClose,
}: {
  datos: YapeConciliacion;
  seleccion: Seleccion | null;
  onSelect: (s: Seleccion) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!seleccion) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seleccion, onClose]);

  if (!seleccion) return null;

  const yape = seleccion.tipo === 'yape' ? datos.yapeos.find((y) => y.id === seleccion.id) : undefined;
  const cobro =
    seleccion.tipo === 'cobro'
      ? datos.cobros.find((c) => c.id === seleccion.id)
      : datos.cobros.find((c) => c.id === (yape?.sesion_id ?? yape?.sesion_propuesta_id));
  if (!yape && !cobro) return null;

  const devoluciones = cobro ? datos.devoluciones.filter((d) => d.sesion_id === cobro.id) : [];
  const reclamos = cobro ? datos.reclamos.filter((r) => r.referencia === cobro.referencia) : [];
  const capturas = cobro ? datos.capturas.filter((c) => c.sesion_id === cobro.id) : [];

  return (
    <div className="yape-panel" role="dialog" aria-modal="true">
      <div className="yape-panel__fondo" onClick={onClose} />
      <aside className="yape-panel__hoja" key={`${seleccion.tipo}-${seleccion.id}`}>
        <header className="yape-panel__cabecera">
          <div>
            <span className="yape-panel__tipo">{yape ? 'Yape recibido' : 'Cobro'}</span>
            <h2>{yape ? `${soles(yape.monto_centimos)} · ${yape.nombre_pagador}` : `${soles(cobro!.monto_base_centimos)} · ${nombreCliente(datos, cobro) ?? 'Invitado'}`}</h2>
            <StatusPill
              label={yape ? YAPE_VEREDICTO[yape.veredicto].label : COBRO_VEREDICTO[cobro!.veredicto].label}
              tone={yape ? YAPE_VEREDICTO[yape.veredicto].tone : COBRO_VEREDICTO[cobro!.veredicto].tone}
            />
          </div>
          <button type="button" className="btn btn--secondary btn--sm" onClick={onClose}>
            Cerrar
          </button>
        </header>

        <div className="yape-panel__cuerpo">
          <DictamenBox dictamen={yape ? dictamenYape(datos, yape, cobro) : dictamenCobro(datos, cobro!)} />

          {yape ? (
            <section className="yape-bloque">
              <h3>El yape</h3>
              <div className="yape-datos">
                <Dato label="Titular que pagó">{yape.nombre_pagador}</Dato>
                <Dato label="Monto">{soles(yape.monto_centimos)}</Dato>
                <Dato label="Hora en Yape">{fechaHora(yape.publicado_en)}</Dato>
                <Dato label="Llegó al servidor">{fechaHora(yape.recibido_en)}</Dato>
                <Dato label="Código de seguridad" mono>
                  {yape.codigo_seguridad ?? 'Sin código (Plin o banco)'}
                </Dato>
                <Dato label="Celular receptor">{yape.dispositivo_id}</Dato>
              </div>
              <div className="yape-original">
                <span>Notificación original</span>
                <code>{yape.texto_original}</code>
              </div>
            </section>
          ) : null}

          {cobro ? (
            <section className="yape-bloque">
              <h3>{yape ? (yape.sesion_id ? 'Cobro al que se ligó' : 'Cobro al que se propuso') : 'El cobro'}</h3>
              <CobroResumen datos={datos} cobro={cobro} />
              {yape ? (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onSelect({ tipo: 'cobro', id: cobro.id })}>
                  Ver el cobro completo
                </button>
              ) : null}
            </section>
          ) : null}

          {cobro && !yape ? (
            <section className="yape-bloque">
              <h3>Qué pasó</h3>
              <Linea items={lineaCobro(cobro, devoluciones)} />
              {cobro.intentos_registrados > 0 ? (
                <p className="yape-nota">
                  {cobro.intentos_registrados} intento(s) de código o nombre registrados para este cobro.
                </p>
              ) : null}
              {cobro.estado === 'pagada' && !cobro.webhook_enviado_en ? (
                <p className="yape-nota yape-nota--alto">
                  Pagado en Yape, pero ACME aún no recibió el aviso ({cobro.webhook_intentos} intentos
                  {cobro.webhook_error ? `: ${cobro.webhook_error}` : ''}). El pedido puede seguir figurando sin pagar.
                </p>
              ) : null}
            </section>
          ) : null}

          {cobro && !yape && cobro.yapeos.length > 0 ? (
            <section className="yape-bloque">
              <h3>Yapes que pagaron este cobro</h3>
              <ul className="yape-lista">
                {cobro.yapeos.map((y) => (
                  <li key={y.id}>
                    <button type="button" onClick={() => onSelect({ tipo: 'yape', id: y.id })} disabled={!datos.yapeos.some((x) => x.id === y.id)}>
                      <span>{y.nombre_pagador}</span>
                      <span>{fechaHora(y.recibido_en)}</span>
                      <strong>{soles(y.monto_centimos)}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {yape && (yape.veredicto === 'huerfano' || yape.veredicto === 'por_verificar') ? (
            <Candidatos
              titulo="Cobros de un monto parecido abiertos cerca de esa hora"
              vacio="Ningún cobro del periodo se parece a este yape."
              filas={cobrosCandidatos(datos, yape).map((c) => ({
                id: c.id,
                a: nombreCliente(datos, c) ?? 'Invitado',
                b: fechaHora(c.creada_en),
                c: soles(c.monto_base_centimos),
                onClick: () => onSelect({ tipo: 'cobro', id: c.id }),
              }))}
            />
          ) : null}

          {cobro && !yape && cobro.veredicto === 'reclamado' ? (
            <Candidatos
              titulo="Yapes sin dueño de un monto parecido"
              vacio="No hay ningún yape sin dueño que se parezca. No entró dinero para este cobro."
              filas={yapesCandidatos(datos, cobro).map((y) => ({
                id: y.id,
                a: y.nombre_pagador,
                b: fechaHora(y.recibido_en),
                c: soles(y.monto_centimos),
                onClick: () => onSelect({ tipo: 'yape', id: y.id }),
              }))}
            />
          ) : null}

          {devoluciones.length || reclamos.length || capturas.length ? (
            <section className="yape-bloque">
              <h3>Devoluciones, reclamos y capturas</h3>
              <ul className="yape-eventos">
                {devoluciones.map((d) => (
                  <li key={d.id}>
                    <StatusPill label={`Devolución ${d.estado}`} tone={d.estado === 'hecha' ? 'success' : d.estado === 'rechazada' ? 'neutral' : 'warning'} />
                    <span>
                      {soles(d.monto_centimos)} al {d.celular} · titular debe ser {d.titulares.join(' o ')}
                      {d.numero_operacion ? ` · op. ${d.numero_operacion}` : ''}
                    </span>
                  </li>
                ))}
                {reclamos.map((r) => (
                  <li key={r.id}>
                    <StatusPill label={`Reclamo: ${r.resultado.replace('_', ' ')}`} tone={r.resultado === 'aplicado' ? 'success' : 'danger'} />
                    <span>
                      {soles(r.monto_centimos)} {r.por_nombre ? 'por nombre del titular' : 'con código'} · {fechaHora(r.creado_en)}
                    </span>
                  </li>
                ))}
                {capturas.map((c) => (
                  <li key={c.id}>
                    <StatusPill label={`Captura ${c.estado}`} tone={c.estado === 'asignada' ? 'success' : c.estado === 'revision' ? 'warning' : 'neutral'} />
                    <span>
                      {c.monto_centimos != null ? soles(c.monto_centimos) : 'Monto ilegible'}
                      {c.numero_operacion ? ` · op. ${c.numero_operacion}` : ''}
                      {c.motivo ? ` · ${c.motivo}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function Candidatos({
  titulo,
  vacio,
  filas,
}: {
  titulo: string;
  vacio: string;
  filas: { id: string; a: string; b: string; c: string; onClick: () => void }[];
}) {
  return (
    <section className="yape-bloque">
      <h3>{titulo}</h3>
      {filas.length ? (
        <ul className="yape-lista">
          {filas.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={f.onClick}>
                <span>{f.a}</span>
                <span>{f.b}</span>
                <strong>{f.c}</strong>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="yape-nota">{vacio}</p>
      )}
    </section>
  );
}
