import { useCallback, useEffect, useState } from 'react';
import { BusinessInfo } from '../../../core/constants/business';
import { courierPaymentService, type YapeReclamoEstado } from '../../../core/services/courierPaymentService';

/**
 * Reclamo autoatendido de Yape directo: cuando la ventana de pago ya cerro y
 * el yapeo no se reconocio. Un solo intento por pedido con el monto de la
 * constancia y su codigo de seguridad; si el comprobante no trae codigo (pago
 * desde Plin o un banco), el nombre completo del titular que pago. Hasta un dia
 * despues del pago. Si no
 * se resuelve, el cliente llama citando el dia y la hora en que intento pagar;
 * pasado el dia, reenvia el correo de Yape a soporte. El pedido no se cancela.
 */
function fechaIncidente(valor: string | null) {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
}

function montoACentimos(texto: string): number | null {
  const limpio = texto.replace(/[sS]\/\.?/g, '').replace(',', '.').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const centimos = Math.round(Number(limpio) * 100);
  return centimos > 0 ? centimos : null;
}

export function YapeReclamoPanel({ orderId, orderCode, onCambio }: {
  orderId: string;
  orderCode: string;
  onCambio: () => void;
}) {
  const [estado, setEstado] = useState<YapeReclamoEstado | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState('');
  // Comprobante sin codigo (Plin o un banco): se identifica por el nombre.
  const [sinCodigo, setSinCodigo] = useState(false);
  const [titular, setTitular] = useState('');
  const [monto, setMonto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback(async () => {
    try {
      setEstado(await courierPaymentService.verReclamoYape(orderId));
    } catch {
      // Sin Yape directo o sin conexion: no se muestra nada.
    }
  }, [orderId]);

  useEffect(() => { void consultar(); }, [consultar]);

  // Encontrado pero esperando que terminen los pagos de otros clientes.
  const enEspera = estado?.reclamo?.resultado === 'en_espera';
  useEffect(() => {
    if (!enEspera) return;
    const timer = setInterval(() => {
      void consultar().then(onCambio);
    }, 20000);
    return () => clearInterval(timer);
  }, [enEspera, consultar, onCambio]);

  if (!estado || !['disponible', 'reclamado', 'bloqueado', 'plazo_vencido'].includes(estado.estado)) return null;

  const enviar = async () => {
    const centimos = montoACentimos(monto);
    const nombre = titular.trim();
    if (sinCodigo && nombre.split(/\s+/).filter((parte) => parte.length >= 2).length < 2) {
      setError('Escribe el nombre y el apellido del titular, tal como sale en tu comprobante.');
      return;
    }
    if (!sinCodigo && !/^\d{3}$/.test(codigo)) { setError('El código de seguridad tiene 3 dígitos.'); return; }
    if (!centimos) { setError('Escribe el monto exacto que pagaste, por ejemplo 25.50.'); return; }
    setEnviando(true);
    setError(null);
    try {
      const r = await courierPaymentService.reclamarYape(
        orderId, centimos, sinCodigo ? { nombreTitular: nombre } : { codigo },
      );
      setMensaje(r.mensaje);
      setEstado(r);
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar tu reclamo. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const incidente = fechaIncidente(estado.incidente_en);
  const reclamo = estado.reclamo;
  const ayuda = (
    <p>
      Llama o escribe al <strong>{BusinessInfo.phone}</strong> ({BusinessInfo.supportHours}) y di el día y la
      hora de tu incidente{incidente ? <>: <strong>{incidente}</strong></> : null}, tu pedido
      {' '}<strong>#{orderCode}</strong> y ten a mano tu constancia de Yape.
    </p>
  );

  if (!reclamo && estado.estado === 'plazo_vencido') {
    return (
      <div className="orders-panel yape-reclamo">
        <h2>¿Yapeaste y tu pago no se confirmó?</h2>
        <div className="yape-reclamo__ayuda">
          <p>
            Pasó más de un día desde tu pago. Reenvía el correo de Yape de tu yapeo a{' '}
            <a href={`mailto:${BusinessInfo.email}?subject=${encodeURIComponent(`Yapeo del pedido #${orderCode}`)}`}>
              <strong>{BusinessInfo.email}</strong>
            </a>{' '}
            con tu pedido <strong>#{orderCode}</strong>
            {incidente ? <> y el día y la hora en que pagaste: <strong>{incidente}</strong></> : null}. Lo validamos y
            te avisamos.
          </p>
          <p className="yape-reclamo__nota">Tu pedido sigue registrado mientras lo revisamos.</p>
        </div>
      </div>
    );
  }

  if (!reclamo && estado.estado === 'bloqueado') {
    return (
      <div className="orders-panel yape-reclamo">
        <h2>¿Yapeaste y tu pago no se confirmó?</h2>
        <div className="yape-reclamo__ayuda">
          <p>Te ayudamos por teléfono.</p>
          {ayuda}
          <p className="yape-reclamo__nota">Tu pedido sigue registrado mientras lo revisamos.</p>
        </div>
      </div>
    );
  }

  if (reclamo) {
    return (
      <div className="orders-panel yape-reclamo">
        <h2>Reclamo de tu yapeo</h2>
        {mensaje && <p className="yape-reclamo__mensaje">{mensaje}</p>}
        {!mensaje && reclamo.resultado === 'aplicado' && (
          <p className="yape-reclamo__mensaje">Encontramos tu yapeo de {reclamo.monto_texto} y se aplicó a tu pedido.</p>
        )}
        {!mensaje && reclamo.resultado === 'en_espera' && (
          <p className="yape-reclamo__mensaje">
            Encontramos tu yapeo de {reclamo.monto_texto}. Se confirma solo en unos minutos, cuando terminen los
            pagos de otros clientes que estaban en curso.
          </p>
        )}
        {reclamo.requiere_ayuda && (
          <div className="yape-reclamo__ayuda">
            <p>
              {reclamo.resultado === 'revision'
                ? 'Tu yapeo necesita una revisión. Te ayudamos por teléfono.'
                : 'No pudimos encontrar tu yapeo. Si de verdad pagaste, te ayudamos por teléfono.'}
            </p>
            {ayuda}
            <p className="yape-reclamo__nota">Tu pedido sigue registrado mientras lo revisamos.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="orders-panel yape-reclamo">
      {!abierto ? (
        <button type="button" className="yape-reclamo__abrir" onClick={() => setAbierto(true)}>
          ¿Yapeaste y tu pago no se confirmó?
        </button>
      ) : (
        <>
          <h2>Reclamar mi pago</h2>
          <p className="yape-reclamo__aviso">
            <strong>Tienes un solo intento.</strong>{' '}
            {sinCodigo
              ? 'Escribe el nombre completo del titular de la cuenta con la que pagaste y el monto exacto, tal como salen en tu comprobante.'
              : 'Escribe el código de seguridad (3 dígitos) y el monto exacto de tu constancia de Yape.'}{' '}
            Solo cuenta un pago hecho después de abrir el pago de este pedido, desde tu cuenta o la del titular que
            indicaste, que no se haya confirmado en otro pedido.
          </p>
          <div className="yape-reclamo__campos">
            {sinCodigo ? (
              <label>
                Nombre del titular que pagó
                <input
                  autoComplete="name"
                  placeholder="Rosa Díaz Soto"
                  value={titular}
                  onChange={(e) => setTitular(e.target.value)}
                />
              </label>
            ) : (
              <label>
                Código de seguridad
                <input
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="123"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 3))}
                />
              </label>
            )}
            <label>
              Monto pagado (S/)
              <input
                inputMode="decimal"
                placeholder="25.50"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="yape-reclamo__sin-codigo"
            onClick={() => { setSinCodigo(!sinCodigo); setError(null); }}
          >
            {sinCodigo
              ? 'Mi constancia sí tiene código de seguridad'
              : 'Mi comprobante no tiene código (pagué con Plin o desde mi banco)'}
          </button>
          {error && <p className="yape-reclamo__error">{error}</p>}
          <button type="button" className="btn-primary" disabled={enviando} onClick={() => void enviar()}>
            {enviando ? 'Buscando tu yapeo…' : 'Enviar reclamo (único intento)'}
          </button>
        </>
      )}
    </div>
  );
}
