import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PortalContext } from '../../auth/session/PortalContext';
import { incomingOrdersService, type IncomingOrder } from '../../../core/services/incomingOrdersService';
import { useIncomingOrders } from './useIncomingOrders';
import { desbloquearSonido, sonarCampana, sonidoBloqueado } from './alertSound';
import './IncomingOrderAlert.css';

/** Cada cuánto vuelve a sonar mientras el pedido siga sin atender. */
const REPETIR_SONIDO_MS = 12000;
/** Cada cuánto alterna el título de la pestaña cuando el portal está de fondo. */
const PARPADEO_MS = 1400;

function esperaLegible(desde: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 60000));
  if (min < 1) return 'recién llegado';
  if (min === 1) return 'hace 1 minuto';
  if (min < 60) return `hace ${min} minutos`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
  const d = Math.floor(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

function soles(n: number): string {
  return `S/ ${n.toFixed(2)}`;
}

/**
 * Aviso de pedido nuevo para el local.
 *
 * Está pensado para no poder ignorarse: tapa la pantalla, suena cada pocos
 * segundos y no tiene botón de cerrar. La única forma de quitarlo es aceptar el
 * pedido, que es justo lo que se quiere que pase.
 *
 * "Ver pedido" no lo descarta: lo reduce a una barra fija arriba para poder
 * trabajar, y el aviso sigue ahí hasta que alguien acepte. Como todo se deriva
 * del estado del pedido y no de un evento, recargar o cambiar de computadora no
 * lo hace desaparecer.
 */
export function IncomingOrderAlert() {
  const portal = useContext(PortalContext);
  const navigate = useNavigate();
  const location = useLocation();

  const enabled = Boolean(
    portal.sessionUserId && !portal.mustChangePassword && portal.isAccountActive &&
    (portal.currentBranch?.id || portal.currentMerchant?.id)
  );

  const { orders, marcarVisto } = useIncomingOrders({
    branchId: portal.currentBranch?.id ?? null,
    merchantId: portal.currentBranch?.id ? null : portal.currentMerchant?.id ?? null,
    enabled,
  });

  const [reducido, setReducido] = useState(false);
  const [aceptando, setAceptando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mudo, setMudo] = useState(() => sonidoBloqueado());

  const pedido: IncomingOrder | undefined = orders[0];
  const hay = orders.length > 0;

  // ── Sonido, mientras haya algo sin atender ──────────────────────────────
  useEffect(() => {
    if (!hay) return;
    sonarCampana();
    const t = window.setInterval(sonarCampana, REPETIR_SONIDO_MS);
    return () => window.clearInterval(t);
  }, [hay, mudo]);

  // ── Título de la pestaña, para cuando el portal quedó de fondo ──────────
  useEffect(() => {
    if (!hay) return;
    const original = document.title;
    let alterno = false;
    const t = window.setInterval(() => {
      alterno = !alterno;
      document.title = alterno
        ? `(${orders.length}) ¡PEDIDO NUEVO!`
        : original;
    }, PARPADEO_MS);
    return () => {
      window.clearInterval(t);
      document.title = original;
    };
  }, [hay, orders.length]);

  // Al cambiar de página el aviso vuelve a mostrarse entero: si alguien lo
  // redujo para mirar el pedido y luego se fue a otro lado, no puede quedar
  // escondido para siempre.
  const rutaAnterior = useRef(location.pathname);
  useEffect(() => {
    if (rutaAnterior.current !== location.pathname) {
      rutaAnterior.current = location.pathname;
      if (!location.pathname.includes('/orders/')) setReducido(false);
    }
  }, [location.pathname]);

  const activarSonido = async () => {
    await desbloquearSonido();
    setMudo(sonidoBloqueado());
    sonarCampana();
  };

  const verPedido = (o: IncomingOrder) => {
    marcarVisto();
    setReducido(true);
    navigate(`/portal/orders/${o.id}`);
  };

  const aceptar = async (o: IncomingOrder) => {
    setAceptando(o.id);
    setError(null);
    const { error: err } = await incomingOrdersService.accept(o.id);
    setAceptando(null);
    if (err) {
      setError('No se pudo aceptar el pedido. Revisa tu conexión e inténtalo de nuevo.');
      return;
    }
    marcarVisto();
    setReducido(false);
  };

  const restantes = useMemo(() => Math.max(0, orders.length - 1), [orders.length]);

  if (!enabled || !hay || !pedido) return null;

  const pagado = pedido.payment_status === 'paid';

  // ── Barra reducida: sigue visible mientras el pedido no se atienda ──────
  if (reducido) {
    return (
      <div className="pedido-barra" role="status">
        <span className="pedido-barra__punto" aria-hidden="true" />
        <span className="pedido-barra__texto">
          <strong>{orders.length === 1 ? '1 pedido sin atender' : `${orders.length} pedidos sin atender`}</strong>
          {' · '}#{pedido.order_code} {esperaLegible(pedido.created_at)}
        </span>
        <button type="button" className="pedido-barra__btn" onClick={() => setReducido(false)}>
          Ver aviso
        </button>
      </div>
    );
  }

  // ── Aviso completo ──────────────────────────────────────────────────────
  return (
    <div className="pedido-aviso" role="alertdialog" aria-modal="true" aria-labelledby="pedido-aviso-titulo">
      <div className="pedido-aviso__caja">
        <div className="pedido-aviso__cabecera">
          <span className="pedido-aviso__pulso" aria-hidden="true" />
          <span className="pedido-aviso__eyebrow">Pedido nuevo</span>
          {restantes > 0 && (
            <span className="pedido-aviso__cola">
              +{restantes} {restantes === 1 ? 'más esperando' : 'más esperando'}
            </span>
          )}
        </div>

        <h2 className="pedido-aviso__codigo" id="pedido-aviso-titulo">
          #{pedido.order_code ?? '—'}
        </h2>
        <p className="pedido-aviso__espera">{esperaLegible(pedido.created_at)}</p>

        <dl className="pedido-aviso__datos">
          <div>
            <dt>Cliente</dt>
            <dd>{pedido.recipient_name ?? 'Sin nombre'}</dd>
          </div>
          <div>
            <dt>{pedido.items_count === 1 ? 'Producto' : 'Productos'}</dt>
            <dd>{pedido.items_preview || `${pedido.items_count} en total`}</dd>
          </div>
        </dl>

        <div className={`pedido-aviso__cobro ${pagado ? 'is-pagado' : 'is-porcobrar'}`}>
          <span className="pedido-aviso__total">{soles(pedido.total)}</span>
          <span className="pedido-aviso__cobro-txt">
            {pagado ? 'Ya está pagado' : 'Pago pendiente'}
          </span>
        </div>

        {error && <p className="pedido-aviso__error">{error}</p>}

        {mudo && (
          <button type="button" className="pedido-aviso__sonido" onClick={activarSonido}>
            Activar sonido del aviso
          </button>
        )}

        <div className="pedido-aviso__acciones">
          <button
            type="button"
            className="pedido-aviso__btn pedido-aviso__btn--ghost"
            onClick={() => verPedido(pedido)}
          >
            Ver pedido
          </button>
          <button
            type="button"
            className="pedido-aviso__btn pedido-aviso__btn--principal"
            onClick={() => aceptar(pedido)}
            disabled={aceptando === pedido.id}
          >
            {aceptando === pedido.id ? 'Aceptando…' : 'Aceptar y preparar'}
          </button>
        </div>

        <p className="pedido-aviso__pie">
          Este aviso no se cierra solo: se va cuando aceptas el pedido.
        </p>
      </div>
    </div>
  );
}
