import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AppRoutes } from '../../../core/constants/routes';
import { BusinessInfo } from '../../../core/constants/business';
import { publicContactService } from '../../../core/services/publicContactService';
import { openCookieSettings } from '../../../core/consent/cookieConsent';
import './Legal.css';

const ACTUALIZADO = 'octubre de 2026';

function LegalLayout({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="legal-page">
      <div className="legal-container">
        <header className="legal-header">
          <h1>{title}</h1>
          {intro && <p className="legal-intro">{intro}</p>}
          <p className="legal-updated">Última actualización: {ACTUALIZADO}</p>
        </header>
        <div className="legal-body">{children}</div>
        <footer className="legal-footer">
          <p>
            {BusinessInfo.legalName} · RUC {BusinessInfo.ruc} · {BusinessInfo.address}
            <br />
            {BusinessInfo.email}
          </p>
          <nav className="legal-nav">
            <Link to={AppRoutes.public.terms}>Términos y condiciones</Link>
            <Link to={AppRoutes.public.privacy}>Privacidad</Link>
            <Link to={AppRoutes.public.cookies}>Cookies</Link>
            <Link to={AppRoutes.public.refunds}>Devoluciones</Link>
            <Link to={AppRoutes.public.complaints}>Libro de Reclamaciones</Link>
          </nav>
        </footer>
      </div>
    </section>
  );
}

export function TermsPage() {
  return (
    <LegalLayout
      title="Términos y condiciones"
      intro={`Estas condiciones rigen el uso de ${BusinessInfo.brand}, la plataforma de delivery que conecta a clientes con locales y repartidores en ${BusinessInfo.city}.`}
    >
      <h2>1. Quiénes somos</h2>
      <p>
        {BusinessInfo.brand} es operado por {BusinessInfo.legalName}, con RUC {BusinessInfo.ruc} y
        domicilio en {BusinessInfo.address}. Actuamos como intermediarios entre el cliente, el
        local que prepara el pedido y el repartidor que lo entrega.
      </p>

      <h2>2. Cuenta de usuario</h2>
      <p>
        Para pedir necesitas una cuenta con un correo verificado y un teléfono de contacto válido.
        Eres responsable de la veracidad de esos datos: los usamos para coordinar la entrega y para
        avisarte de cualquier incidencia con tu pedido, conforme a nuestra{' '}
        <Link to={AppRoutes.public.privacy}>Política de privacidad</Link>.
      </p>
      <p>
        La plataforma está dirigida a mayores de edad. Los menores de 14 años no pueden crear una
        cuenta sin el consentimiento de sus padres o tutores.
      </p>
      <p>
        Solo te enviaremos promociones si lo aceptaste expresamente, y puedes dejar de recibirlas
        cuando quieras.
      </p>

      <h2>3. Pedidos y precios</h2>
      <p>
        Todos los precios se muestran en soles (PEN) e incluyen IGV. Antes de pagar verás el
        desglose completo: productos, tarifa de servicio, envío, impuestos y propina si decides
        dejarla. El total que aparece antes de confirmar es el que se te cobra.
      </p>
      <p>
        El costo de envío depende de la distancia entre el local y tu dirección, y de la zona de
        cobertura. Si tu dirección queda fuera de cobertura, te lo indicamos antes de cobrar.
      </p>

      <h2>4. Medios de pago</h2>
      <p>
        Los pagos se procesan a través de Izipay, pasarela autorizada en Perú. Aceptamos tarjetas de
        crédito y débito y los demás medios que la pasarela muestre al pagar. No almacenamos los
        datos de tu tarjeta: los administra Izipay bajo estándares PCI DSS.
      </p>

      <h2>5. Entrega</h2>
      <p>
        Los tiempos que mostramos son estimados y dependen de la preparación del local, el tráfico y
        el clima. Debes estar disponible en el teléfono registrado durante la entrega. Si el
        repartidor no logra contactarte ni entregar el pedido tras llegar a la dirección indicada,
        el pedido puede darse por entregado sin derecho a reembolso.
      </p>

      <h2>6. Cancelaciones y devoluciones</h2>
      <p>
        Se rigen por nuestra <Link to={AppRoutes.public.refunds}>política de devoluciones y
        cancelaciones</Link>, que forma parte de estos términos.
      </p>

      <h2>7. Conducta</h2>
      <p>
        No está permitido usar la plataforma para fines ilícitos, suplantar a otra persona, hacer
        pedidos falsos ni maltratar a repartidores o personal de los locales. Podemos suspender
        cuentas que incumplan estas reglas.
      </p>

      <h2>8. Responsabilidad</h2>
      <p>
        La calidad, composición e inocuidad de los productos es responsabilidad del local que los
        prepara. Nosotros respondemos por el servicio de intermediación y entrega. Si tu pedido
        llega incompleto, equivocado o en mal estado, repórtalo dentro de las{' '}
        {BusinessInfo.claimWindowHours} horas siguientes y lo resolvemos.
      </p>

      <h2>9. Libro de Reclamaciones</h2>
      <p>
        Conforme al Código de Protección y Defensa del Consumidor, contamos con un{' '}
        <Link to={AppRoutes.public.complaints}>Libro de Reclamaciones virtual</Link>.
      </p>

      <h2>10. Cambios</h2>
      <p>
        Podemos actualizar estas condiciones. Los cambios rigen desde su publicación en esta página
        y no afectan pedidos ya confirmados.
      </p>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Política de privacidad"
      intro="Explicamos qué datos personales tratamos, para qué, con quién los compartimos y cómo ejercer tus derechos, conforme a la Ley 29733 de Protección de Datos Personales y su Reglamento (D.S. 016-2024-JUS)."
    >
      <h2>1. Responsable del tratamiento</h2>
      <p>
        {BusinessInfo.legalName}, RUC {BusinessInfo.ruc}, con domicilio en {BusinessInfo.address}.
        Puedes escribirnos a {BusinessInfo.email} para cualquier asunto sobre tus datos.
      </p>
      <p>
        Tus datos se almacenan en el banco de datos personales “{BusinessInfo.dataBankName}”,
        inscrito en el Registro Nacional de Protección de Datos Personales con el código{' '}
        {BusinessInfo.dataBankCode}.
      </p>

      <h2>2. Qué datos recogemos</h2>
      <ul>
        <li><strong>De tu cuenta:</strong> nombre, correo electrónico, teléfono y, en la app, fecha de nacimiento y DNI.</li>
        <li><strong>De la entrega:</strong> dirección, referencia y ubicación del punto de entrega.</li>
        <li><strong>De tus pedidos:</strong> productos, montos, estado, fecha y mensajes con el repartidor o el local.</li>
        <li><strong>Del pago:</strong> el resultado de la transacción. Los datos de tu tarjeta los procesa Izipay; nosotros no los vemos ni los guardamos.</li>
        <li><strong>Del dispositivo:</strong> la información técnica mínima que guarda tu navegador o la app para mantener tu sesión (ver la <Link to={AppRoutes.public.cookies}>Política de cookies</Link>).</li>
      </ul>
      <p>
        Los datos marcados como obligatorios en los formularios son necesarios para crear tu cuenta
        y entregar tus pedidos; si no nos los das, no podremos prestarte el servicio. Los demás son
        opcionales.
      </p>

      <h2>3. Para qué los usamos</h2>
      <p>
        <strong>Finalidades necesarias</strong> (sin ellas no podemos atenderte): crear y gestionar tu
        cuenta, procesar, cobrar y entregar tus pedidos, comunicarnos contigo sobre el estado de la
        entrega, atender reclamos y cumplir obligaciones tributarias y legales.
      </p>
      <p>
        <strong>Finalidades opcionales</strong> (solo si las aceptas expresamente): enviarte
        promociones, novedades y encuestas por correo, SMS, WhatsApp o notificaciones. Puedes aceptar
        o rechazar esta finalidad al registrarte y cambiar de opinión cuando quieras desde{' '}
        <Link to={AppRoutes.public.account}>Mi cuenta</Link> o escribiendo a {BusinessInfo.email}.
        Rechazarla no afecta tu uso de la plataforma.
      </p>

      <h2>4. Ubicación</h2>
      <p>
        Usamos tu ubicación solo con tu permiso, para ubicar el punto de entrega, calcular la ruta y
        el costo de envío, y para que puedas seguir a tu repartidor mientras el pedido está en
        camino. Puedes negar el permiso e ingresar la dirección manualmente, y retirarlo en cualquier
        momento desde los ajustes de tu navegador o de tu teléfono.
      </p>

      <h2>5. Con quién compartimos tus datos</h2>
      <ul>
        <li><strong>El local</strong> que prepara tu pedido: tu nombre y el detalle del pedido.</li>
        <li><strong>El repartidor</strong> asignado: tu nombre, dirección, referencia y teléfono, solo durante la entrega.</li>
        <li><strong>Izipay</strong> (procesador de pagos), para cobrar y prevenir fraudes.</li>
        <li>
          <strong>Proveedores tecnológicos</strong> que actúan por encargo nuestro y solo para
          prestar el servicio: Supabase (base de datos y autenticación), Vercel y Netlify
          (alojamiento de la web y la app), Google (mapas y notificaciones) y proveedores de mapas
          como OpenStreetMap/CARTO.
        </li>
        <li>Autoridades, cuando una norma o un mandato judicial o administrativo lo exija.</li>
      </ul>
      <p>
        No vendemos ni alquilamos tus datos personales.
      </p>

      <h2>6. Transferencia internacional</h2>
      <p>
        Algunos de estos proveedores guardan la información en servidores ubicados fuera del Perú
        (principalmente en Estados Unidos). Este flujo transfronterizo es necesario para prestar el
        servicio y se hace con proveedores que aplican medidas de seguridad y confidencialidad
        adecuadas, conforme al artículo 15 de la Ley 29733.
      </p>

      <h2>7. Conservación</h2>
      <p>
        Conservamos los datos mientras tu cuenta esté activa. Si la eliminas, borramos o
        anonimizamos tus datos, salvo los que debamos guardar por los plazos que exige la normativa
        tributaria y de protección al consumidor. Los datos de promociones se dejan de usar en cuanto
        retiras tu consentimiento.
      </p>

      <h2>8. Menores de edad</h2>
      <p>
        La plataforma está dirigida a mayores de edad. Si eres menor de 14 años no puedes crear una
        cuenta sin el consentimiento de tus padres o tutores. Si detectamos datos de un menor
        registrados sin ese consentimiento, los eliminaremos.
      </p>

      <h2>9. Tus derechos</h2>
      <p>
        Puedes ejercer en cualquier momento tus derechos de información, acceso, rectificación,
        cancelación (supresión) y oposición, y revocar tu consentimiento, escribiendo a{' '}
        {BusinessInfo.email} con el asunto “Protección de datos” e indicando tu nombre, tu DNI y lo
        que solicitas. Es gratuito. Respondemos en los plazos de ley: hasta 20 días hábiles para
        solicitudes de acceso y hasta 10 días hábiles para las demás.
      </p>
      <p>
        Si consideras que no atendimos tu solicitud, puedes presentar una reclamación ante la
        Autoridad Nacional de Protección de Datos Personales del Ministerio de Justicia y Derechos
        Humanos.
      </p>

      <h2>10. Seguridad</h2>
      <p>
        El sitio opera sobre HTTPS y los pagos se procesan en el entorno seguro de Izipay. Aplicamos
        controles de acceso para que solo el personal autorizado vea la información necesaria.
      </p>

      <h2>11. Repartidores y negocios aliados</h2>
      <p>
        Si te registras como repartidor tratamos además tu DNI, licencia de conducir, datos del
        vehículo, cuenta bancaria para tus liquidaciones y tu ubicación mientras tienes la app
        activa o un pedido asignado, con el fin de asignarte pedidos, permitir el seguimiento de las
        entregas y pagarte. Si representas a un negocio aliado, tratamos los datos de contacto y de
        facturación necesarios para la relación comercial.
      </p>

      <h2>12. Cambios</h2>
      <p>
        Si cambiamos esta política te lo avisaremos en la plataforma. Si el cambio implica nuevas
        finalidades, te pediremos nuevamente tu consentimiento.
      </p>
    </LegalLayout>
  );
}

export function CookiesPage() {
  return (
    <LegalLayout
      title="Política de cookies"
      intro="Qué cookies y almacenamiento del navegador usamos, para qué sirven y cómo puedes configurarlos."
    >
      <h2>1. Qué son</h2>
      <p>
        Las cookies y el almacenamiento local son pequeños archivos o registros que el navegador
        guarda al visitar una web. Nos permiten, por ejemplo, recordar que iniciaste sesión o qué
        tienes en el carrito.
      </p>

      <h2>2. Cookies necesarias</h2>
      <p>
        Son indispensables para que la tienda funcione y no requieren tu consentimiento, aunque te
        informamos de ellas:
      </p>
      <ul>
        <li><strong>Sesión</strong> (almacenamiento local, Supabase): mantiene tu sesión iniciada de forma segura.</li>
        <li><strong>Carrito</strong> (almacenamiento local): recuerda los productos que agregaste.</li>
        <li><strong>Registro pendiente</strong> (almacenamiento local): conserva los datos de un registro mientras confirmas tu correo.</li>
        <li><strong>Pago</strong> (almacenamiento de sesión): guarda el código de pago de PagoEfectivo para mostrártelo en tu pedido.</li>
        <li><strong>Preferencias de cookies</strong> (almacenamiento local): recuerda lo que elegiste en este aviso.</li>
        <li>
          <strong>Izipay</strong> (tercero): al pagar, la pasarela de pagos usa sus propias cookies
          para procesar el cobro y prevenir fraudes.
        </li>
      </ul>
      <p>
        Al mostrar mapas cargamos imágenes de OpenStreetMap/CARTO, que reciben la dirección IP de tu
        conexión para servirlas.
      </p>

      <h2>3. Cookies opcionales</h2>
      <p>
        Las cookies de <strong>analítica</strong> (medir el uso de la web) y de{' '}
        <strong>publicidad</strong> (mostrarte promociones en otros sitios) solo se activan si las
        aceptas en el aviso de cookies. Hoy no usamos ninguna; si las incorporamos, las detallaremos
        aquí y solo funcionarán con tu consentimiento.
      </p>

      <h2>4. Cómo configurarlas</h2>
      <p>
        Puedes cambiar tu elección en cualquier momento desde{' '}
        <a href="#" onClick={(e) => { e.preventDefault(); openCookieSettings(); }}>Configurar cookies</a>,
        también disponible al pie de cada página. Además puedes borrar o bloquear las cookies desde
        la configuración de tu navegador; si bloqueas las necesarias, es posible que no puedas
        iniciar sesión ni hacer pedidos.
      </p>

      <h2>5. Más información</h2>
      <p>
        El tratamiento de los datos que se obtienen mediante cookies se rige por nuestra{' '}
        <Link to={AppRoutes.public.privacy}>Política de privacidad</Link>. Para cualquier consulta
        escríbenos a {BusinessInfo.email}.
      </p>
    </LegalLayout>
  );
}

export function RefundsPage() {
  return (
    <LegalLayout
      title="Devoluciones y cancelaciones"
      intro="Qué puedes hacer si quieres cancelar un pedido o si algo salió mal con tu entrega."
    >
      <h2>1. Cancelar un pedido</h2>
      <p>
        Puedes cancelar <strong>sin costo</strong> mientras el local todavía no haya empezado a
        preparar tu pedido, es decir, mientras figure como “Pedido recibido” en{' '}
        <Link to={AppRoutes.public.myOrders}>Mis pedidos</Link>. En ese caso te devolvemos el 100%
        de lo pagado.
      </p>
      <p>
        Una vez que el local empieza la preparación, el pedido ya no puede cancelarse, porque los
        insumos y el trabajo ya se consumieron. Si aun así necesitas cancelarlo, escríbenos y
        evaluamos el caso junto con el local.
      </p>

      <h2>2. Cuándo devolvemos tu dinero</h2>
      <p>Reembolsamos el total del pedido cuando:</p>
      <ul>
        <li>el pedido nunca llegó;</li>
        <li>el local no pudo prepararlo y lo canceló;</li>
        <li>se cobró dos veces la misma compra;</li>
        <li>el pedido llegó en mal estado o claramente equivocado.</li>
      </ul>
      <p>
        Si solo falta parte del pedido, reembolsamos la parte no entregada.
      </p>

      <h2>3. Cómo pedirlo</h2>
      <p>
        Repórtalo dentro de las <strong>{BusinessInfo.claimWindowHours} horas</strong> siguientes a
        la entrega, desde <Link to={AppRoutes.public.contact}>Contacto</Link> o escribiendo a{' '}
        {BusinessInfo.email}, indicando el número de pedido. Si ayuda, adjunta una foto. Te
        respondemos con una decisión y, si corresponde el reembolso, lo iniciamos de inmediato.
      </p>

      <h2>4. Plazos y forma del reembolso</h2>
      <p>
        El reembolso se hace <strong>al mismo medio de pago</strong> que usaste. Nosotros lo
        solicitamos apenas se aprueba; el tiempo en que verás el dinero depende de tu banco o
        billetera y suele tomar entre {BusinessInfo.refundBusinessDays} días hábiles.
      </p>
      <p>
        Las anulaciones solicitadas el mismo día de la compra se procesan como anulación; pasado ese
        plazo, como devolución.
      </p>

      <h2>5. Qué no se devuelve</h2>
      <ul>
        <li>Pedidos entregados correctamente y conforme a lo solicitado.</li>
        <li>Pedidos que no se pudieron entregar por datos de dirección errados o por no poder contactarte en el teléfono registrado.</li>
        <li>La propina, una vez entregado el pedido, ya que corresponde al repartidor.</li>
      </ul>

      <h2>6. Si no estás conforme</h2>
      <p>
        Puedes registrar tu caso en el{' '}
        <Link to={AppRoutes.public.complaints}>Libro de Reclamaciones</Link>. Tenemos 15 días
        hábiles para responderte formalmente.
      </p>
    </LegalLayout>
  );
}

function generarCodigo() {
  return `LR-${Date.now().toString(36).toUpperCase()}`;
}

function ComplaintForm() {
  const [kind, setKind] = useState<'reclamo' | 'queja'>('reclamo');
  const [form, setForm] = useState({
    fullName: '', document: '', address: '', phone: '', email: '',
    orderCode: '', detail: '', request: '',
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Minimos que exige el reglamento: nombre, DNI, domicilio o correo, detalle.
    if (!form.fullName.trim() || !form.document.trim() || !form.detail.trim()) {
      setError('Completa tu nombre, DNI y el detalle de lo ocurrido.');
      return;
    }
    if (!form.email.trim() && !form.address.trim()) {
      setError('Indica al menos un correo electrónico o un domicilio para responderte.');
      return;
    }

    setSending(true);
    const nuevoCodigo = generarCodigo();
    const { error: err } = await publicContactService.submitComplaint({
      code: nuevoCodigo, kind, ...form,
    });
    setSending(false);

    if (err) {
      setError('No pudimos registrar tu reclamo. Inténtalo de nuevo o escríbenos a ' + BusinessInfo.email);
      return;
    }
    setCode(nuevoCodigo);
  };

  if (code) {
    return (
      <div className="legal-success">
        <h2>Reclamo registrado</h2>
        <p>
          Tu código es <strong>{code}</strong>. Guárdalo: con él puedes hacer seguimiento.
        </p>
        <p>
          Te responderemos en un plazo máximo de <strong>15 días hábiles</strong>
          {form.email.trim() ? ` al correo ${form.email.trim()}` : ''}.
        </p>
      </div>
    );
  }

  return (
    <form className="legal-form" onSubmit={handleSubmit}>
      <div className="legal-form__kind">
        <label className={kind === 'reclamo' ? 'is-active' : ''}>
          <input type="radio" name="kind" checked={kind === 'reclamo'}
            onChange={() => setKind('reclamo')} />
          Reclamo
        </label>
        <label className={kind === 'queja' ? 'is-active' : ''}>
          <input type="radio" name="kind" checked={kind === 'queja'}
            onChange={() => setKind('queja')} />
          Queja
        </label>
      </div>

      <div className="legal-form__row">
        <label>
          Nombre completo <span aria-hidden="true">*</span>
          <input value={form.fullName} onChange={set('fullName')} required autoComplete="name" />
        </label>
        <label>
          DNI <span aria-hidden="true">*</span>
          <input value={form.document} onChange={set('document')} required inputMode="numeric" />
        </label>
      </div>

      <div className="legal-form__row">
        <label>
          Correo electrónico
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" />
        </label>
        <label>
          Teléfono
          <input value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" />
        </label>
      </div>

      <label>
        Domicilio
        <input value={form.address} onChange={set('address')} autoComplete="street-address" />
      </label>

      <label>
        Número de pedido <small>(si aplica)</small>
        <input value={form.orderCode} onChange={set('orderCode')} placeholder="Ej. 1021" />
      </label>

      <label>
        Detalle de lo ocurrido <span aria-hidden="true">*</span>
        <textarea rows={5} value={form.detail} onChange={set('detail')} required />
      </label>

      <label>
        ¿Qué esperas que hagamos?
        <textarea rows={3} value={form.request} onChange={set('request')} />
      </label>

      <p className="legal-form__note">
        Debes indicar al menos un correo o un domicilio para poder responderte.
      </p>

      {error && <div className="account-alert account-alert--error">{error}</div>}

      <button type="submit" className="legal-form__submit" disabled={sending}>
        {sending ? 'Registrando…' : 'Registrar reclamo'}
      </button>
    </form>
  );
}

export function ComplaintsBookPage() {
  return (
    <LegalLayout
      title="Libro de Reclamaciones"
      intro="Conforme al Código de Protección y Defensa del Consumidor y al D.S. 011-2011-PCM, ponemos a tu disposición nuestro Libro de Reclamaciones virtual."
    >
      <div className="legal-callout">
        <strong>Reclamo:</strong> disconformidad con el producto o el servicio recibido.
        <br />
        <strong>Queja:</strong> malestar por la atención, sin relación directa con el producto.
      </div>

      <h2>Registra tu reclamo o queja</h2>
      <ComplaintForm />

      <h2>Plazo de respuesta</h2>
      <p>
        Damos respuesta en un plazo máximo de <strong>quince (15) días hábiles</strong> desde que
        recibimos tu reclamo. Registrarlo aquí no impide que acudas a otras vías de reclamo ante
        INDECOPI.
      </p>

      <h2>Datos del proveedor</h2>
      <ul>
        <li><strong>Razón social:</strong> {BusinessInfo.legalName}</li>
        <li><strong>RUC:</strong> {BusinessInfo.ruc}</li>
        <li><strong>Domicilio:</strong> {BusinessInfo.address}</li>
        <li><strong>Correo:</strong> {BusinessInfo.email}</li>
        <li><strong>Teléfono:</strong> {BusinessInfo.phone}</li>
        <li><strong>Horario de atención:</strong> {BusinessInfo.supportHours}</li>
      </ul>
    </LegalLayout>
  );
}
