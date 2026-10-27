import './AboutPage.css';
import { Link } from 'react-router-dom';
import { AppRoutes } from '../../../core/constants/routes';
import packageImg from '../../../images/repartidor-preparando.png';

// ── ICONS ────────────────────────────────────────────────────────────────────

function IconSearch() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function IconTruck() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <path d="M16 8h4l3 5v3h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function IconStar2() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2c-2.5 3-4 5.5-4 10s1.5 7 4 10M12 2c2.5 3 4 5.5 4 10s-1.5 7-4 10" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconRealtime() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconBarChart() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

// ── WAVE DIVIDER ─────────────────────────────────────────────────────────────

function SectionWave({ fromColor, toColor, flip = false }: { fromColor: string; toColor: string; flip?: boolean }) {
  return (
    <div style={{ background: fromColor, lineHeight: 0, fontSize: 0, overflow: 'hidden' }}>
      <svg
        viewBox="0 0 1440 70"
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: 60, transform: flip ? 'scaleX(-1)' : 'none', verticalAlign: 'bottom' }}
      >
        <path d="M0,35 C180,70 360,0 540,35 C720,70 900,0 1080,35 C1260,70 1380,15 1440,35 L1440,90 L0,90 Z" fill={toColor} />
      </svg>
    </div>
  );
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────

export function AboutPage() {
  return (
    <div className="about-page">

      {/* ── HERO ── */}
      <section className="about-hero">
        <div className="about-hero__container">
          <div className="about-hero__text">
            <div className="about-hero__eyebrow about-animate">
              <div className="about-hero__eyebrow-dot" />
              Plataforma ACME Pedidos
            </div>
            <h1 className="about-animate delay-1">
              Cómo funciona <span>ACME</span> PEDIDOS
            </h1>
            <p className="about-hero__lead about-animate delay-2">
              Un ecosistema completo que conecta clientes, negocios y repartidores en tiempo real. Descubre cómo cada pieza encaja para ofrecerte la mejor experiencia de delivery en Huancavelica.
            </p>

            <div className="about-hero-stats about-animate delay-3">
              <div className="about-hero-stat">
                <span className="about-hero-stat__num">3</span>
                <span className="about-hero-stat__label">Tipos de usuario</span>
              </div>
              <div className="about-hero-stat">
                <span className="about-hero-stat__num">∞</span>
                <span className="about-hero-stat__label">Pedidos en tiempo real</span>
              </div>
              <div className="about-hero-stat">
                <span className="about-hero-stat__num">24h</span>
                <span className="about-hero-stat__label">Soporte disponible</span>
              </div>
              <div className="about-hero-stat">
                <span className="about-hero-stat__num">100%</span>
                <span className="about-hero-stat__label">Control por local</span>
              </div>
            </div>
          </div>

          <div className="about-hero__image about-animate delay-2">
            <img src={packageImg} alt="Repartidor de ACME guardando un pedido en la mochila" />
          </div>
        </div>
      </section>

      {/* Hero wave */}
      <div style={{ background: '#4d148c', lineHeight: 0, fontSize: 0, overflow: 'hidden' }}>
        <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 60, verticalAlign: 'bottom' }}>
          <path d="M0,35 C180,70 360,0 540,35 C720,70 900,0 1080,35 C1260,70 1380,15 1440,35 L1440,90 L0,90 Z" fill="#f8f9fa" />
        </svg>
      </div>

      {/* ── CUSTOMER FLOW ── */}
      <section className="about-section about-section--muted">
        <div className="about-section-header">
          <div className="about-section-eyebrow about-section-eyebrow--orange">
            <span />
            Para clientes
          </div>
          <h2 className="about-section-title">Pide en 4 pasos simples</h2>
          <p className="about-section-subtitle">
            Desde explorar el catálogo hasta recibir tu pedido en casa, la experiencia está diseñada para ser rápida e intuitiva.
          </p>
        </div>

        <div className="about-flow">
          <div className="about-flow-step">
            <div className="about-flow-step__num">
              <IconSearch />
            </div>
            <h4>Explora</h4>
            <p>Busca tu restaurante o tienda favorita en el marketplace de ACME.</p>
          </div>
          <div className="about-flow-step">
            <div className="about-flow-step__num">
              <IconCart />
            </div>
            <h4>Selecciona</h4>
            <p>Arma tu pedido, personaliza tus productos y agrégalos al carrito.</p>
          </div>
          <div className="about-flow-step">
            <div className="about-flow-step__num">
              <IconTruck />
            </div>
            <h4>Sigue tu pedido</h4>
            <p>Visualiza en tiempo real el estado de tu pedido y la ubicación del driver.</p>
          </div>
          <div className="about-flow-step">
            <div className="about-flow-step__num">
              <IconStar2 />
            </div>
            <h4>¡Disfruta!</h4>
            <p>Recibe tu pedido y califica la experiencia para mejorar el servicio.</p>
          </div>
        </div>
      </section>

      {/* ── SECTION WAVE ── */}
      <SectionWave fromColor="#f8f9fa" toColor="#ffffff" flip />

      {/* ── PLATFORM ZONES ── */}
      <section className="about-section about-section--white">
        <div className="about-section-header">
          <div className="about-section-eyebrow about-section-eyebrow--purple">
            <span />
            Arquitectura de la plataforma
          </div>
          <h2 className="about-section-title">Dos zonas, un ecosistema</h2>
          <p className="about-section-subtitle">
            ACME combina una plataforma pública de captación con un potente panel privado para que cada negocio gestione su operación de manera autónoma.
          </p>
        </div>

        <div className="about-zones">
          {/* Zona pública */}
          <div className="about-zone-card">
            <div className="about-zone-card__bar about-zone-card__bar--orange" />
            <div className="about-zone-card__body">
              <div className="about-zone-card__icon about-zone-card__icon--orange">
                <IconGlobe />
              </div>
              <span className="about-zone-card__badge about-zone-card__badge--orange">Acceso abierto</span>
              <h3>Zona Pública</h3>
              <p>Página de presentación orientada a atraer nuevos comercios y usuarios finales al ecosistema ACME.</p>
              <ul className="about-zone-feature-list">
                {[
                  'Presentación de beneficios ACME',
                  'Descarga de apps móviles',
                  'Formulario de captación de negocios',
                  'Información sobre ser driver',
                  'Casos de éxito y testimonios',
                  'Preguntas frecuentes',
                ].map(item => (
                  <li key={item}>
                    <i className="orange"><IconCheck /></i>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Zona privada */}
          <div className="about-zone-card">
            <div className="about-zone-card__bar about-zone-card__bar--purple" />
            <div className="about-zone-card__body">
              <div className="about-zone-card__icon about-zone-card__icon--purple">
                <IconLock />
              </div>
              <span className="about-zone-card__badge about-zone-card__badge--purple">Acceso restringido</span>
              <h3>Panel del Negocio</h3>
              <p>Panel exclusivo para cada local aprobado. Administra tu operación completa desde un solo lugar.</p>
              <ul className="about-zone-feature-list">
                {[
                  'Gestión de pedidos en tiempo real',
                  'Control total del menú y precios',
                  'Configuración de horarios y zonas',
                  'Estado operativo del local',
                  'Métricas y reportes de ventas',
                  'Comunicación directa con drivers',
                ].map(item => (
                  <li key={item}>
                    <i className="purple"><IconCheck /></i>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION WAVE ── */}
      <SectionWave fromColor="#ffffff" toColor="#f8f9fa" />

      {/* ── PLATFORM FEATURES ── */}
      <section className="about-section about-section--muted">
        <div className="about-section-header">
          <div className="about-section-eyebrow about-section-eyebrow--orange">
            <span />
            Tecnología
          </div>
          <h2 className="about-section-title">Todo lo que necesitas para operar</h2>
          <p className="about-section-subtitle">
            Herramientas de nivel enterprise, diseñadas para la realidad del delivery local en Huancavelica.
          </p>
        </div>

        <div className="about-features-grid">
          <div className="about-feature-item">
            <div className="about-feature-item__icon"><IconRealtime /></div>
            <div>
              <h4>Pedidos en tiempo real</h4>
              <p>Notificaciones instantáneas y actualizaciones de estado para clientes, negocios y drivers simultáneamente.</p>
            </div>
          </div>
          <div className="about-feature-item">
            <div className="about-feature-item__icon about-feature-item__icon--purple"><IconMap /></div>
            <div>
              <h4>Seguimiento GPS</h4>
              <p>Monitorea la ubicación del driver durante toda la entrega y calcula tiempos de llegada precisos.</p>
            </div>
          </div>
          <div className="about-feature-item">
            <div className="about-feature-item__icon"><IconMenu /></div>
            <div>
              <h4>Gestión de menú dinámica</h4>
              <p>Actualiza productos, precios, fotos y disponibilidad desde la app del negocio en segundos.</p>
            </div>
          </div>
          <div className="about-feature-item">
            <div className="about-feature-item__icon about-feature-item__icon--purple"><IconBarChart /></div>
            <div>
              <h4>Reportes y métricas</h4>
              <p>Analiza ventas, horarios pico, productos más pedidos y performance de drivers con dashboards claros.</p>
            </div>
          </div>
          <div className="about-feature-item">
            <div className="about-feature-item__icon"><IconBell /></div>
            <div>
              <h4>Notificaciones inteligentes</h4>
              <p>Push notifications para cada cambio de estado del pedido, desde la confirmación hasta la entrega.</p>
            </div>
          </div>
          <div className="about-feature-item">
            <div className="about-feature-item__icon about-feature-item__icon--purple"><IconShield /></div>
            <div>
              <h4>Pagos seguros</h4>
              <p>Procesamiento seguro de transacciones con múltiples métodos de pago y liquidaciones automáticas.</p>
            </div>
          </div>
          <div className="about-feature-item">
            <div className="about-feature-item__icon"><IconPhone /></div>
            <div>
              <h4>App nativa para drivers</h4>
              <p>Aplicación móvil dedicada con GPS, lista de pedidos, historial de ganancias y soporte integrado.</p>
            </div>
          </div>
          <div className="about-feature-item">
            <div className="about-feature-item__icon about-feature-item__icon--purple"><IconTruck /></div>
            <div>
              <h4>Asignación automática</h4>
              <p>El sistema asigna al driver más cercano y disponible para minimizar tiempos de espera en cada pedido.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <div style={{ background: '#f8f9fa', lineHeight: 0, fontSize: 0, overflow: 'hidden' }}>
        <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 60, transform: 'scaleX(-1)', verticalAlign: 'bottom' }}>
          <path d="M0,35 C180,70 360,0 540,35 C720,70 900,0 1080,35 C1260,70 1380,15 1440,35 L1440,90 L0,90 Z" fill="#4d148c" />
        </svg>
      </div>

      <section className="about-cta">
        <h2>¿Listo para ser parte de ACME?</h2>
        <p>
          Únete a la plataforma de delivery que está transformando Huancavelica. Ya seas un negocio, un driver o un cliente, tenemos un lugar para ti.
        </p>
        <div className="about-cta-buttons">
          <Link to={AppRoutes.public.businesses} className="about-cta-btn about-cta-btn--primary">
            <IconGlobe /> Registra tu negocio
          </Link>
          <Link to={AppRoutes.public.hazteDriver} className="about-cta-btn about-cta-btn--secondary">
            <IconTruck /> Únete como driver
          </Link>
        </div>
      </section>

    </div>
  );
}