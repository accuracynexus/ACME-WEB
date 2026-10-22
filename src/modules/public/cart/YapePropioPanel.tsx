import { useEffect, useRef, useState } from 'react';
import {
  consultarSesion,
  declararPago,
  subirCaptura,
  verificarCodigo,
  type YapePropioSesion,
} from '../../../core/payments/yapePropio';

interface Props {
  sesion: YapePropioSesion;
  apiUrl: string;
  token: string;
  /** El yapeo se confirmo (por el celular de ACME, el codigo o la captura). */
  onPaid: () => void;
  /** Abre una sesion nueva para el mismo pedido. */
  onRetry: () => void;
}

// Despues de la ventana se sigue consultando un rato: un yapeo que llega
// despues de cerrar puede quedar por verificar con el codigo de seguridad.
const CONSULTA_MS = 3000;
const SEGUIR_TRAS_VENCER_MS = 5 * 60 * 1000;

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function YapePropioPanel({ sesion: inicial, apiUrl, token, onPaid, onRetry }: Props) {
  const [sesion, setSesion] = useState(inicial);
  const [restantes, setRestantes] = useState(inicial.segundos_restantes);
  const [subiendo, setSubiendo] = useState(false);
  const [avisando, setAvisando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const pagado = useRef(false);
  // onPaid cambia en cada render del carrito; la consulta usa siempre el ultimo.
  const alPagar = useRef(onPaid);
  alPagar.current = onPaid;
  const vencioEn = useRef<number | null>(null);
  // El fin se calcula con los segundos que da el servidor y no con expira_en:
  // el reloj del celular del cliente puede estar adelantado o atrasado.
  const fin = useRef(Date.now() + inicial.segundos_restantes * 1000);

  const aplicar = (actual: YapePropioSesion) => {
    setSesion(actual);
    fin.current = Date.now() + actual.segundos_restantes * 1000;
    setRestantes(actual.segundos_restantes);
    if (actual.estado === 'pagada' && !pagado.current) {
      pagado.current = true;
      alPagar.current();
    }
    if (actual.estado === 'abierta') vencioEn.current = null;
  };

  useEffect(() => {
    const reloj = window.setInterval(() => {
      setRestantes(Math.max(0, Math.round((fin.current - Date.now()) / 1000)));
    }, 500);
    return () => window.clearInterval(reloj);
  }, []);

  useEffect(() => {
    let activo = true;
    const consultar = async () => {
      if (!activo || pagado.current) return;
      if (vencioEn.current && Date.now() - vencioEn.current > SEGUIR_TRAS_VENCER_MS) return;
      try {
        const actual = await consultarSesion(apiUrl, inicial.sesion_id, token);
        if (!activo) return;
        aplicar(actual);
        if (pagado.current) return;
        if (actual.estado !== 'abierta' && !vencioEn.current) vencioEn.current = Date.now();
      } catch {
        // Un fallo de red no corta la espera; se reintenta en la siguiente vuelta.
      }
      if (activo) window.setTimeout(consultar, CONSULTA_MS);
    };
    const primero = window.setTimeout(consultar, CONSULTA_MS);
    return () => {
      activo = false;
      window.clearTimeout(primero);
    };
  }, [apiUrl, inicial.sesion_id, token]);

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Sin portapapeles el numero igual se ve en pantalla.
    }
  };

  // "Ya yapeé": el monto queda reservado 1 minuto mas. Si el yapeo no llega en
  // ese minuto, la venta se cierra.
  const avisarPago = async () => {
    setAvisando(true);
    setError(null);
    try {
      aplicar(await declararPago(apiUrl, inicial.sesion_id, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo avisar tu pago.');
    } finally {
      setAvisando(false);
    }
  };

  const enviarCodigo = async () => {
    if (!/^\d{3}$/.test(codigo)) {
      setError('El código de seguridad tiene 3 dígitos.');
      return;
    }
    setVerificando(true);
    setError(null);
    setMensaje(null);
    try {
      const resultado = await verificarCodigo(apiUrl, inicial.sesion_id, token, codigo);
      aplicar(resultado.sesion);
      setCodigo('');
      if (resultado.resultado === 'asignado' || resultado.resultado === 'abonado' || resultado.resultado === 'ya_pagada') {
        setMensaje(resultado.mensaje);
      } else {
        setError(resultado.mensaje);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar el código.');
    } finally {
      setVerificando(false);
    }
  };

  const enviarCaptura = async (archivo: File | undefined) => {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    setMensaje('Revisando tu constancia...');
    try {
      const resultado = await subirCaptura(apiUrl, inicial.sesion_id, token, archivo);
      aplicar(resultado.sesion);
      setMensaje(resultado.mensaje);
      if (resultado.resultado === 'rechazada') {
        setError(resultado.mensaje);
        setMensaje(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la constancia.');
      setMensaje(null);
    } finally {
      setSubiendo(false);
    }
  };

  const abierta = sesion.estado === 'abierta' && restantes > 0;
  const minutos = Math.floor(restantes / 60);
  const segundos = String(restantes % 60).padStart(2, '0');
  const porVerificar = sesion.pago_por_verificar;
  const conSaldo = Boolean(sesion.saldo_centimos && sesion.abonado_centimos);

  const formularioCodigo = sesion.puede_ingresar_codigo && (
    <form
      className="yape-propio__codigo"
      onSubmit={(e) => {
        e.preventDefault();
        void enviarCodigo();
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={3}
        placeholder="000"
        aria-label="Código de seguridad de tu constancia de Yape"
        value={codigo}
        disabled={verificando}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 3))}
      />
      <button type="submit" disabled={verificando || codigo.length !== 3}>
        {verificando ? 'Verificando...' : 'Verificar'}
      </button>
      {sesion.intentos_codigo_restantes !== undefined && sesion.intentos_codigo_restantes < 3 && (
        <small>
          Te queda{sesion.intentos_codigo_restantes === 1 ? '' : 'n'} {sesion.intentos_codigo_restantes} intento
          {sesion.intentos_codigo_restantes === 1 ? '' : 's'}.
        </small>
      )}
    </form>
  );

  return (
    <div className="yape-propio">
      <div className="yape-propio__sello">
        <ShieldIcon />
        <span>
          Pago verificado por <strong>Acuraci Nexus</strong>
        </span>
      </div>
      <p className="yape-propio__aviso">
        Cada yapeo se valida con el titular de la cuenta y el código de seguridad de la constancia. Los intentos de
        fraude quedan registrados.
      </p>

      {porVerificar ? (
        <>
          <p className="yape-propio__paso">
            Recibimos un yapeo de <strong>{porVerificar.monto_texto}</strong>
            {porVerificar.nombre_pagador ? ` de ${porVerificar.nombre_pagador}` : ''}.
          </p>
          <p className="yape-propio__nota">
            Para confirmar que es tuyo, ingresa el código de seguridad de 3 dígitos que aparece en tu constancia de Yape.
          </p>
          {formularioCodigo}
        </>
      ) : abierta ? (
        <>
          {conSaldo && (
            <p className="yape-propio__nota">
              Ya recibimos {sesion.abonado_texto}. Para completar tu compra falta el saldo.
            </p>
          )}
          <p className="yape-propio__paso">
            Yapea <strong>exactamente {sesion.monto_texto}</strong> antes de que termine el tiempo.
          </p>
          {sesion.extra_centimos > 0 && (
            <p className="yape-propio__nota">
              Incluye {sesion.extra_centimos} céntimo{sesion.extra_centimos === 1 ? '' : 's'} para identificar tu pago.
              Yapea el monto exacto.
            </p>
          )}
          <div className="yape-propio__reloj" aria-live="polite">
            {minutos}:{segundos}
          </div>
          {sesion.yape.qr_url && (
            <img className="yape-propio__qr" src={sesion.yape.qr_url} alt="Código QR de Yape de ACME" />
          )}
          <button type="button" className="yape-propio__numero" onClick={() => void copiar(sesion.yape.numero)}>
            <span>{sesion.yape.numero}</span>
            <small>{copiado ? 'Copiado' : 'Copiar número'}</small>
          </button>
          {sesion.yape.titular && <p className="yape-propio__titular">A nombre de {sesion.yape.titular}</p>}
          {sesion.declaro_pago ? (
            <p className="yape-propio__espera">
              Verificando tu yapeo. Si no se recibe en este tiempo, la venta se cierra.
            </p>
          ) : (
            <>
              <p className="yape-propio__espera">Esperando tu yapeo... se confirma solo.</p>
              <button
                type="button"
                className="yape-propio__ya-pague"
                onClick={() => void avisarPago()}
                disabled={avisando}
              >
                {avisando ? 'Avisando...' : 'Ya yapeé'}
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <p className="yape-propio__paso">No recibimos tu yapeo a tiempo y la venta se cerró.</p>
          {sesion.puede_ingresar_codigo && (
            <>
              <p className="yape-propio__nota">
                ¿Ya yapeaste? Ingresa el código de seguridad de 3 dígitos de tu constancia de Yape.
              </p>
              {formularioCodigo}
            </>
          )}
          <button
            type="button"
            className="yape-propio__reintentar"
            onClick={onRetry}
            disabled={subiendo || verificando}
          >
            {conSaldo ? `Yapear el saldo de ${sesion.saldo_texto}` : 'Aún no yapeé: generar otro monto'}
          </button>
          {!sesion.puede_ingresar_codigo && sesion.puede_subir_captura && (
            <label className={`yape-propio__captura${subiendo ? ' is-disabled' : ''}`}>
              {subiendo ? 'Enviando...' : 'Subir mi constancia de Yape'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={subiendo}
                onChange={(e) => {
                  void enviarCaptura(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </>
      )}

      {mensaje && <p className="yape-propio__mensaje">{mensaje}</p>}
      {error && <p className="yape-propio__error">{error}</p>}
    </div>
  );
}
