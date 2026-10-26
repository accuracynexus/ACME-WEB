import { useEffect, useRef, useState } from "react";
import {
  consultarSesion,
  declararPago,
  pedirDevolucion,
  subirCaptura,
  verificarCodigo,
  verificarNombreTitular,
  type YapePropioSesion,
} from "../../../core/payments/yapePropio";
import {
  CabeceraVerificacion,
  MarcaDeAgua,
  PieVerificacion,
} from "./YapePropioMarcas";

interface Props {
  sesion: YapePropioSesion;
  apiUrl: string;
  token: string;
  /** El yapeo se confirmo (por el celular de ACME, el codigo o la captura). */
  onPaid: () => void;
  /** Abre una sesion nueva para el mismo pedido. */
  onRetry: () => void;
}

// Despues de la ventana se sigue consultando un rato: un yapeo que llega tarde
// con el nombre del cliente se confirma solo.
const CONSULTA_MS = 3000;
const SEGUIR_TRAS_VENCER_MS = 15 * 60 * 1000;

export function YapePropioPanel({
  sesion: inicial,
  apiUrl,
  token,
  onPaid,
  onRetry,
}: Props) {
  const [sesion, setSesion] = useState(inicial);
  const [restantes, setRestantes] = useState(inicial.segundos_restantes);
  const [subiendo, setSubiendo] = useState(false);
  const [avisando, setAvisando] = useState(false);
  const [codigo, setCodigo] = useState("");
  // Su comprobante no trae codigo (pago desde Plin o un banco): da el nombre
  // completo del titular de la cuenta con la que pago.
  const [sinCodigo, setSinCodigo] = useState(false);
  const [titular, setTitular] = useState("");
  const [celular, setCelular] = useState("");
  const [pidiendoDevolucion, setPidiendoDevolucion] = useState(false);
  const [quiereDevolucion, setQuiereDevolucion] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [aFavor, setAFavor] = useState<string | null>(null);
  const pagado = useRef(false);
  // onPaid cambia en cada render del carrito; la consulta usa siempre el ultimo.
  const alPagar = useRef(onPaid);
  alPagar.current = onPaid;
  const vencioEn = useRef<number | null>(null);
  // El fin se calcula con los segundos que da el servidor y no con expira_en:
  // el reloj del celular del cliente puede estar adelantado o atrasado.
  const fin = useRef(Date.now() + inicial.segundos_restantes * 1000);
  const cierre = useRef(Date.now() + (inicial.segundos_cierre ?? 0) * 1000);
  const [paraCierre, setParaCierre] = useState(inicial.segundos_cierre ?? 0);

  const aplicar = (actual: YapePropioSesion) => {
    setSesion(actual);
    fin.current = Date.now() + actual.segundos_restantes * 1000;
    setRestantes(actual.segundos_restantes);
    cierre.current = Date.now() + (actual.segundos_cierre ?? 0) * 1000;
    setParaCierre(actual.segundos_cierre ?? 0);
    if (actual.estado === "pagada" && !pagado.current) {
      pagado.current = true;
      if (actual.saldo_favor_abonado_texto) {
        // Pago de mas: se le muestra un momento el saldo a favor que le quedo.
        setAFavor(actual.saldo_favor_abonado_texto);
        window.setTimeout(() => alPagar.current(), 3500);
      } else {
        alPagar.current();
      }
    }
    if (actual.estado === "abierta") vencioEn.current = null;
  };

  useEffect(() => {
    const reloj = window.setInterval(() => {
      setRestantes(Math.max(0, Math.round((fin.current - Date.now()) / 1000)));
      setParaCierre(
        Math.max(0, Math.round((cierre.current - Date.now()) / 1000)),
      );
    }, 500);
    return () => window.clearInterval(reloj);
  }, []);

  useEffect(() => {
    let activo = true;
    const consultar = async () => {
      if (!activo || pagado.current) return;
      if (
        vencioEn.current &&
        Date.now() - vencioEn.current > SEGUIR_TRAS_VENCER_MS
      )
        return;
      try {
        const actual = await consultarSesion(apiUrl, inicial.sesion_id, token);
        if (!activo) return;
        aplicar(actual);
        if (pagado.current) return;
        if (actual.estado !== "abierta" && !vencioEn.current)
          vencioEn.current = Date.now();
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
      setError(
        err instanceof Error ? err.message : "No se pudo avisar tu pago.",
      );
    } finally {
      setAvisando(false);
    }
  };

  const enviarCodigo = async () => {
    const nombre = titular.trim();
    if (
      sinCodigo &&
      nombre.split(/\s+/).filter((parte) => parte.length >= 2).length < 2
    ) {
      setError(
        "Escribe el nombre y el apellido del titular, tal como sale en tu comprobante.",
      );
      return;
    }
    if (!sinCodigo && !/^\d{3}$/.test(codigo)) {
      setError("El código de seguridad tiene 3 dígitos.");
      return;
    }
    setVerificando(true);
    setError(null);
    setMensaje(null);
    try {
      const resultado = sinCodigo
        ? await verificarNombreTitular(apiUrl, inicial.sesion_id, token, nombre)
        : await verificarCodigo(apiUrl, inicial.sesion_id, token, codigo);
      aplicar(resultado.sesion);
      setCodigo("");
      setTitular("");
      if (
        resultado.resultado === "asignado" ||
        resultado.resultado === "abonado" ||
        resultado.resultado === "ya_pagada" ||
        resultado.resultado === "en_espera"
      ) {
        setMensaje(resultado.mensaje);
      } else {
        setError(resultado.mensaje);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo verificar tu pago.",
      );
    } finally {
      setVerificando(false);
    }
  };

  const enviarDevolucion = async () => {
    const conCelular = sesion.devolucion_requiere_celular !== false;
    if (conCelular && !/^9\d{8}$/.test(celular)) {
      setError("Escribe tu número de Yape de 9 dígitos.");
      return;
    }
    setPidiendoDevolucion(true);
    setError(null);
    setMensaje(null);
    try {
      const resultado = await pedirDevolucion(
        apiUrl,
        inicial.sesion_id,
        token,
        conCelular ? celular : undefined,
      );
      aplicar(resultado.sesion);
      if (resultado.resultado === "nada_que_devolver")
        setError(resultado.mensaje);
      else setMensaje(resultado.mensaje);
      setQuiereDevolucion(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo pedir la devolución.",
      );
    } finally {
      setPidiendoDevolucion(false);
    }
  };

  const enviarCaptura = async (archivo: File | undefined) => {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    setMensaje("Revisando tu constancia...");
    try {
      const resultado = await subirCaptura(
        apiUrl,
        inicial.sesion_id,
        token,
        archivo,
      );
      aplicar(resultado.sesion);
      setMensaje(resultado.mensaje);
      if (resultado.resultado === "rechazada") {
        setError(resultado.mensaje);
        setMensaje(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo enviar la constancia.",
      );
      setMensaje(null);
    } finally {
      setSubiendo(false);
    }
  };

  const abierta = sesion.estado === "abierta" && restantes > 0;
  const minutos = Math.floor(restantes / 60);
  const segundos = String(restantes % 60).padStart(2, "0");
  const porVerificar = sesion.pago_por_verificar;
  const conSaldo = Boolean(sesion.saldo_centimos && sesion.abonado_centimos);
  const anulada = sesion.estado === "anulada";

  const devolucion =
    sesion.puede_pedir_devolucion &&
    !porVerificar &&
    (sesion.devolucion_requiere_celular === false ? (
      <button
        type="button"
        className="yape-propio__reintentar"
        onClick={() => void enviarDevolucion()}
        disabled={pidiendoDevolucion}
      >
        {pidiendoDevolucion
          ? "Liberando..."
          : `No completaré la compra: devolver ${sesion.saldo_favor_usado_texto ?? "mi saldo"} a mi saldo a favor`}
      </button>
    ) : quiereDevolucion ? (
      <form
        className="yape-propio__codigo"
        onSubmit={(e) => {
          e.preventDefault();
          void enviarDevolucion();
        }}
      >
        <input
          type="tel"
          inputMode="numeric"
          maxLength={9}
          placeholder="9XXXXXXXX"
          aria-label="Tu número de Yape para la devolución"
          value={celular}
          disabled={pidiendoDevolucion}
          onChange={(e) =>
            setCelular(e.target.value.replace(/\D/g, "").slice(0, 9))
          }
        />
        <button
          type="submit"
          disabled={pidiendoDevolucion || celular.length !== 9}
        >
          {pidiendoDevolucion ? "Enviando..." : "Pedir devolución"}
        </button>
        <small>
          Se devuelve solo al Yape que está a nombre de quien hizo el pago. Si
          pides la devolución, esta compra se anula.
          {sesion.saldo_favor_usado_texto
            ? ` Los ${sesion.saldo_favor_usado_texto} de tu saldo a favor vuelven a tu cuenta.`
            : ""}
        </small>
      </form>
    ) : (
      <button
        type="button"
        className="yape-propio__reintentar"
        onClick={() => setQuiereDevolucion(true)}
      >
        No completaré la compra: devolverme {sesion.devolucion_posible_texto}
      </button>
    ));

  const avisoDevoluciones = (sesion.devoluciones ?? []).map((d) => (
    <p key={d.motivo} className="yape-propio__nota">
      {d.estado === "hecha"
        ? `Te devolvimos ${d.monto_texto} al ${d.celular}.`
        : d.estado === "rechazada"
          ? `No pudimos devolver ${d.monto_texto} al ${d.celular}: ese Yape no está a nombre de quien pagó. Escríbenos.`
          : `Te devolveremos ${d.monto_texto} al ${d.celular}.`}
    </p>
  ));

  const formularioCodigo = sesion.puede_ingresar_codigo && (
    <form
      className="yape-propio__codigo"
      onSubmit={(e) => {
        e.preventDefault();
        void enviarCodigo();
      }}
    >
      {sinCodigo ? (
        <input
          type="text"
          className="yape-propio__titular"
          autoComplete="name"
          maxLength={120}
          placeholder="Nombre del titular que pagó"
          aria-label="Nombre completo del titular de la cuenta con la que pagaste"
          value={titular}
          disabled={verificando}
          onChange={(e) => setTitular(e.target.value)}
        />
      ) : (
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={3}
          placeholder="000"
          aria-label="Código de seguridad de tu constancia de Yape"
          value={codigo}
          disabled={verificando}
          onChange={(e) =>
            setCodigo(e.target.value.replace(/\D/g, "").slice(0, 3))
          }
        />
      )}
      <button
        type="submit"
        disabled={
          verificando ||
          (sinCodigo ? titular.trim().length < 5 : codigo.length !== 3)
        }
      >
        {verificando ? "Verificando..." : "Verificar"}
      </button>
      <button
        type="button"
        className="yape-propio__sin-codigo"
        onClick={() => {
          setSinCodigo(!sinCodigo);
          setError(null);
        }}
      >
        {sinCodigo
          ? "Mi constancia sí tiene código"
          : "Mi comprobante no tiene código (Plin o mi banco)"}
      </button>
      {sesion.intentos_codigo_restantes !== undefined &&
        sesion.intentos_codigo_restantes < 2 && (
          <small>
            Te queda{sesion.intentos_codigo_restantes === 1 ? "" : "n"}{" "}
            {sesion.intentos_codigo_restantes} intento
            {sesion.intentos_codigo_restantes === 1 ? "" : "s"}.
          </small>
        )}
    </form>
  );

  return (
    <div className="yape-propio">
      <CabeceraVerificacion />
      <MarcaDeAgua />
      <div className="yape-propio__cuerpo">
        {aFavor ? (
          <p className="yape-propio__paso">
            Pago confirmado. Te quedaron <strong>{aFavor}</strong> de saldo a
            favor para tu próxima compra con Yape directo.
          </p>
        ) : anulada ? (
          <>
            <p className="yape-propio__paso">Esta compra quedó anulada.</p>
            {avisoDevoluciones}
            <button
              type="button"
              className="yape-propio__reintentar"
              onClick={onRetry}
            >
              Pagar de nuevo
            </button>
          </>
        ) : porVerificar ? (
          <>
            <p className="yape-propio__paso">
              Recibimos un yapeo de <strong>{porVerificar.monto_texto}</strong>
              {porVerificar.nombre_pagador
                ? ` de ${porVerificar.nombre_pagador}`
                : ""}
              .
            </p>
            <p className="yape-propio__nota">
              {porVerificar.se_confirma_solo
                ? "Lo estamos validando y se confirma solo en unos momentos. Si quieres confirmarlo ya, ingresa el código de seguridad de 3 dígitos de tu constancia de Yape."
                : "Para confirmar que es tuyo, ingresa el código de seguridad de 3 dígitos que aparece en tu constancia de Yape."}
            </p>
            {formularioCodigo}
          </>
        ) : abierta ? (
          <>
            {conSaldo &&
              (sesion.saldo_favor_usado_texto ? (
                <p className="yape-propio__nota">
                  Usamos {sesion.saldo_favor_usado_texto} de tu saldo a favor.
                  Yapea el resto.
                </p>
              ) : (
                <p className="yape-propio__nota">
                  Ya recibimos {sesion.abonado_texto}. Para completar tu compra
                  falta el saldo.
                </p>
              ))}
            <p className="yape-propio__paso">
              Yapea <strong>exactamente {sesion.monto_texto}</strong> antes de
              que termine el tiempo.
            </p>
            {sesion.extra_centimos > 0 && (
              <p className="yape-propio__nota">
                Incluye {sesion.extra_centimos} céntimo
                {sesion.extra_centimos === 1 ? "" : "s"} para identificar tu
                pago. Yapea el monto exacto.
              </p>
            )}
            <div className="yape-propio__reloj" aria-live="polite">
              {minutos}:{segundos}
            </div>
            {sesion.yape.qr_url && (
              <img
                className="yape-propio__qr"
                src={sesion.yape.qr_url}
                alt="Código QR de Yape de ACME"
              />
            )}
            <button
              type="button"
              className="yape-propio__numero"
              onClick={() => void copiar(sesion.yape.numero)}
            >
              <span>{sesion.yape.numero}</span>
              <small>{copiado ? "Copiado" : "Copiar número"}</small>
            </button>
            {sesion.yape.titular && (
              <p className="yape-propio__titular">
                A nombre de {sesion.yape.titular}
              </p>
            )}
            {conSaldo && devolucion}
            {sesion.declaro_pago ? (
              <p className="yape-propio__espera">
                Verificando tu yapeo... se confirma solo.
              </p>
            ) : (
              <>
                <p className="yape-propio__espera">
                  Esperando tu yapeo... se confirma solo.
                </p>
                <button
                  type="button"
                  className="yape-propio__ya-pague"
                  onClick={() => void avisarPago()}
                  disabled={avisando}
                >
                  {avisando ? "Avisando..." : "Ya yapeé"}
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <p className="yape-propio__paso">El tiempo para yapear terminó.</p>
            {sesion.puede_ingresar_codigo && paraCierre > 0 ? (
              <>
                <p className="yape-propio__nota">
                  ¿Ya yapeaste? Lo seguimos esperando{" "}
                  <strong>
                    {Math.floor(paraCierre / 60)}:
                    {String(paraCierre % 60).padStart(2, "0")}
                  </strong>{" "}
                  más y se confirma solo. Si yapeaste otro monto o desde otra
                  cuenta, ingresa el código de seguridad de 3 dígitos de tu
                  constancia. Si pagaste con Plin o desde tu banco, tu
                  comprobante no tiene código: usa el enlace de abajo.
                </p>
                {formularioCodigo}
              </>
            ) : (
              !conSaldo && (
                <p className="yape-propio__nota">
                  Si yapeaste y no se confirmó, reclámalo desde tu pedido en Mis
                  pedidos. Tu pedido no se cancela.
                </p>
              )
            )}
            <button
              type="button"
              className="yape-propio__reintentar"
              onClick={onRetry}
              disabled={subiendo || verificando}
            >
              {conSaldo
                ? `Yapear el saldo de ${sesion.saldo_texto}`
                : "Generar el pago otra vez para validar rápido"}
            </button>
            {devolucion}
            {!sesion.puede_ingresar_codigo && sesion.puede_subir_captura && (
              <label
                className={`yape-propio__captura${subiendo ? " is-disabled" : ""}`}
              >
                {subiendo ? "Enviando..." : "Subir mi constancia de Yape"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={subiendo}
                  onChange={(e) => {
                    void enviarCaptura(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </>
        )}

        {mensaje && <p className="yape-propio__mensaje">{mensaje}</p>}
        {error && <p className="yape-propio__error">{error}</p>}
      </div>
      <PieVerificacion />
    </div>
  );
}
