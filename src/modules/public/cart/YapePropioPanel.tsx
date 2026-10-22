import { useEffect, useRef, useState } from 'react';
import {
  consultarSesion,
  subirCaptura,
  type YapePropioSesion,
} from '../../../core/payments/yapePropio';

interface Props {
  sesion: YapePropioSesion;
  apiUrl: string;
  token: string;
  /** El yapeo se confirmo (por el celular de ACME o por la captura). */
  onPaid: () => void;
  /** Abre una sesion nueva para el mismo pedido. */
  onRetry: () => void;
}

// Despues de la ventana se sigue consultando un rato: un yapeo que llega
// tarde aun puede correlacionarse por el nombre del pagador.
const CONSULTA_MS = 3000;
const SEGUIR_TRAS_VENCER_MS = 5 * 60 * 1000;

export function YapePropioPanel({ sesion: inicial, apiUrl, token, onPaid, onRetry }: Props) {
  const [sesion, setSesion] = useState(inicial);
  const [restantes, setRestantes] = useState(inicial.segundos_restantes);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const pagado = useRef(false);
  // onPaid cambia en cada render del carrito; la consulta usa siempre el ultimo.
  const alPagar = useRef(onPaid);
  alPagar.current = onPaid;
  const vencioEn = useRef<number | null>(null);

  useEffect(() => {
    const fin = inicial.expira_en ? new Date(inicial.expira_en).getTime() : Date.now();
    const reloj = window.setInterval(() => {
      setRestantes(Math.max(0, Math.round((fin - Date.now()) / 1000)));
    }, 500);
    return () => window.clearInterval(reloj);
  }, [inicial.expira_en]);

  useEffect(() => {
    let activo = true;
    const consultar = async () => {
      if (!activo || pagado.current) return;
      if (vencioEn.current && Date.now() - vencioEn.current > SEGUIR_TRAS_VENCER_MS) return;
      try {
        const actual = await consultarSesion(apiUrl, inicial.sesion_id, token);
        if (!activo) return;
        setSesion(actual);
        if (actual.estado === 'pagada' && !pagado.current) {
          pagado.current = true;
          alPagar.current();
          return;
        }
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

  const enviarCaptura = async (archivo: File | undefined) => {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    setMensaje('Revisando tu captura...');
    try {
      const resultado = await subirCaptura(apiUrl, inicial.sesion_id, token, archivo);
      setSesion(resultado.sesion);
      setMensaje(resultado.mensaje);
      if ((resultado.resultado === 'asignado' || resultado.resultado === 'ya_pagada') && !pagado.current) {
        pagado.current = true;
        alPagar.current();
      }
      if (resultado.resultado === 'rechazada') {
        setError(resultado.mensaje);
        setMensaje(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la captura.');
      setMensaje(null);
    } finally {
      setSubiendo(false);
    }
  };

  const abierta = sesion.estado === 'abierta' && restantes > 0;
  const minutos = Math.floor(restantes / 60);
  const segundos = String(restantes % 60).padStart(2, '0');

  return (
    <div className="yape-propio">
      {abierta ? (
        <>
          <p className="yape-propio__paso">
            Yapea <strong>exactamente {sesion.monto_texto}</strong> antes de que termine el tiempo.
          </p>
          {sesion.extra_centimos > 0 && (
            <p className="yape-propio__nota">
              Incluye {sesion.extra_centimos} céntimo{sesion.extra_centimos === 1 ? '' : 's'} para distinguir tu pago
              de otro por el mismo monto. Yapea el monto exacto.
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
          <p className="yape-propio__espera">Esperando tu yapeo... se confirma solo.</p>
        </>
      ) : (
        <>
          <p className="yape-propio__paso">Se acabó el tiempo para yapear.</p>
          <p className="yape-propio__nota">
            Si ya yapeaste, espera unos segundos: lo buscamos por tu nombre. Si no se confirma, sube la captura de tu
            yapeo.
          </p>
          <button type="button" className="yape-propio__reintentar" onClick={onRetry} disabled={subiendo}>
            Aún no yapeé: generar otro monto
          </button>
        </>
      )}

      {sesion.puede_subir_captura && (
        <label className={`yape-propio__captura${subiendo ? ' is-disabled' : ''}`}>
          {subiendo ? 'Enviando...' : 'Ya yapeé: subir captura'}
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
      {mensaje && <p className="yape-propio__mensaje">{mensaje}</p>}
      {error && <p className="yape-propio__error">{error}</p>}
    </div>
  );
}
