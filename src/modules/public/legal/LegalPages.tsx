import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AppRoutes } from '../../../core/constants/routes';
import { BusinessInfo } from '../../../core/constants/business';
import './Legal.css';

const ACTUALIZADO = 'agosto de 2026';

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
        avisarte de cualquier incidencia con tu pedido.
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
        Los pagos se procesan a través de Culqi, pasarela autorizada en Perú. Aceptamos tarjetas de
        crédito y débito, Yape, banca móvil, agentes y billeteras digitales. No almacenamos los
        datos de tu tarjeta: los administra Culqi bajo estándares PCI DSS.
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
      intro="Explicamos qué datos personales tratamos, para qué y qué derechos tienes sobre ellos."
    >
      <h2>1. Responsable del tratamiento</h2>
      <p>
        {BusinessInfo.legalName}, RUC {BusinessInfo.ruc}, con domicilio en {BusinessInfo.address}.
        Puedes escribirnos a {BusinessInfo.email} para cualquier asunto sobre tus datos.
      </p>

      <h2>2. Qué datos recogemos</h2>
      <ul>
        <li><strong>De tu cuenta:</strong> nombre, correo electrónico y teléfono.</li>
        <li><strong>De la entrega:</strong> dirección, referencia y ubicación del punto de entrega.</li>
        <li><strong>De tus pedidos:</strong> productos, montos, estado y fecha.</li>
        <li><strong>Del pago:</strong> el resultado de la transacción. Los datos de tu tarjeta los procesa Culqi; nosotros no los vemos ni los guardamos.</li>
      </ul>

      <h2>3. Para qué los usamos</h2>
      <p>
        Para procesar y entregar tus pedidos, cobrarlos, comunicarnos contigo sobre el estado de la
        entrega, atender reclamos y cumplir obligaciones tributarias y legales. Compartimos con el
        local únicamente lo necesario para preparar el pedido, y con el repartidor la dirección y el
        teléfono de contacto durante la entrega.
      </p>

      <h2>4. Ubicación</h2>
      <p>
        Usamos tu ubicación solo para calcular la ruta y el costo de envío, y para que puedas seguir
        a tu repartidor en tiempo real mientras el pedido está en camino. Puedes ingresar la
        dirección manualmente si prefieres no compartirla.
      </p>

      <h2>5. Conservación</h2>
      <p>
        Conservamos los datos mientras tu cuenta esté activa y, después, por los plazos que exige la
        normativa tributaria y de protección al consumidor.
      </p>

      <h2>6. Tus derechos</h2>
      <p>
        Conforme a la Ley 29733 de Protección de Datos Personales, puedes acceder, rectificar,
        cancelar u oponerte al tratamiento de tus datos escribiendo a {BusinessInfo.email}.
        Responderemos en los plazos que fija la ley.
      </p>

      <h2>7. Seguridad</h2>
      <p>
        El sitio opera sobre HTTPS y los pagos se procesan en el entorno seguro de Culqi. Aplicamos
        controles de acceso para que solo el personal autorizado vea la información necesaria.
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

export function ComplaintsBookPage() {
  const asunto = encodeURIComponent('Libro de Reclamaciones - ACME Pedidos');
  const cuerpo = encodeURIComponent(
    [
      'Tipo (reclamo o queja):',
      'Nombre completo:',
      'DNI:',
      'Domicilio:',
      'Teléfono:',
      'Correo electrónico:',
      'Número de pedido:',
      'Fecha del hecho:',
      'Detalle:',
      'Pedido concreto:',
    ].join('\n'),
  );

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

      <h2>Cómo registrarlo</h2>
      <p>
        Envíanos tu reclamo o queja a <strong>{BusinessInfo.email}</strong> con la información
        mínima que exige el reglamento: nombre completo, DNI, domicilio o correo electrónico, y el
        detalle de lo ocurrido con tu pedido.
      </p>

      <p className="legal-cta">
        <a className="btn-primary" href={`mailto:${BusinessInfo.email}?subject=${asunto}&body=${cuerpo}`}>
          Abrir formulario de reclamo
        </a>
      </p>

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
