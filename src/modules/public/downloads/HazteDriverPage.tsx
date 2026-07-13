import './HazteDriverPage.css';
import repartidoresImg from '../../../images/repartidores.png';
import driverCelImg from '../../../images/driver-cel.png';

// ── ICON COMPONENTS ──────────────────────────────────────────────────────────
type IconProps = { size?: number };
const svg = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

const IconWallet = ({ size = 26 }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h3v-4z" />
  </svg>
);
const IconClock = ({ size = 26 }: IconProps) => (
  <svg {...svg(size)}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>
);
const IconHeadset = ({ size = 26 }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M4 13a8 8 0 0 1 16 0" />
    <rect x="2.5" y="13" width="4" height="7" rx="1.5" /><rect x="17.5" y="13" width="4" height="7" rx="1.5" />
    <path d="M20 20a3 3 0 0 1-3 3h-3" />
  </svg>
);
const IconRoute = ({ size = 26 }: IconProps) => (
  <svg {...svg(size)}>
    <circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" />
    <path d="M8.5 19H14a3.5 3.5 0 0 0 0-7H10a3.5 3.5 0 0 1 0-7h5.5" />
  </svg>
);
const IconMoto = ({ size = 22 }: IconProps) => (
  <svg {...svg(size)}>
    <circle cx="5.5" cy="17" r="3" /><circle cx="18.5" cy="17" r="3" />
    <path d="M8.5 17h6l3-6h-3l-2-3H8" /><path d="M14 8h4" /><path d="M5.5 14V11h3" />
  </svg>
);
const IconScooter = ({ size = 22 }: IconProps) => (
  <svg {...svg(size)}>
    <circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" />
    <path d="M8.5 18h7" /><path d="M15.5 18 18 7h2" /><path d="M5 11h6l3 5" /><path d="M4 11V8h4" />
  </svg>
);
const IconShieldCheck = ({ size = 22 }: IconProps) => (
  <svg {...svg(size)}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="8.5 11.5 11 14 16 8.5" /></svg>
);
const IconCalendar = ({ size = 22 }: IconProps) => (
  <svg {...svg(size)}>
    <rect x="3" y="4.5" width="18" height="17" rx="2.5" /><line x1="3" y1="9.5" x2="21" y2="9.5" />
    <line x1="8" y1="2.5" x2="8" y2="6.5" /><line x1="16" y1="2.5" x2="16" y2="6.5" />
  </svg>
);
const IconBolt = ({ size = 22 }: IconProps) => (
  <svg {...svg(size)}><polygon points="13 2 4 14 11 14 10 22 20 9 13 9 13 2" /></svg>
);
const IconCheck = ({ size = 17 }: IconProps) => (
  <svg {...svg(size)} strokeWidth={2.6}><polyline points="20 6 9 17 4 12" /></svg>
);
const IconStar = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);
const IconQuote = ({ size = 30 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M7.5 11H5a3 3 0 0 1 3-3V6a5 5 0 0 0-5 5v5a2 2 0 0 0 2 2h2.5a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2zm11 0H16a3 3 0 0 1 3-3V6a5 5 0 0 0-5 5v5a2 2 0 0 0 2 2h2.5a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2z" />
  </svg>
);
const IconPhone = ({ size = 18 }: IconProps) => (
  <svg {...svg(size)}><rect x="6" y="2" width="12" height="20" rx="3" /><line x1="11" y1="18" x2="13" y2="18" /></svg>
);

const GooglePlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M3 20.5v-17c0-.83 1-1.3 1.7-.8l14 8.5c.7.4.7 1.5 0 1.9l-14 8.5c-.7.5-1.7.03-1.7-.8z" /></svg>
);
const AppleIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
);

function StoreButtons() {
  return (
    <div className="store-buttons">
      <a href="#" className="store-button">
        <GooglePlayIcon />
        <span><span className="small">Descárgala en</span><span className="big">Google Play</span></span>
      </a>
      <a href="#" className="store-button">
        <AppleIcon />
        <span><span className="small">Consíguela en</span><span className="big">App Store</span></span>
      </a>
    </div>
  );
}

// ── WAVE DIVIDER ─────────────────────────────────────────────────────────────
function SectionWave({ fromColor, toColor, flip = false }: { fromColor: string; toColor: string; flip?: boolean }) {
  return (
    <div style={{ display: 'block', background: fromColor, lineHeight: 0, overflow: 'hidden', width: '100%', fontSize: 0 }}>
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 70, transform: flip ? 'scaleX(-1)' : 'none', verticalAlign: 'bottom' }}>
        <path d="M0,40 C180,80 360,0 540,40 C720,80 900,0 1080,40 C1260,80 1380,20 1440,40 L1440,100 L0,100 Z" fill={toColor} />
      </svg>
    </div>
  );
}

// ── DATA ─────────────────────────────────────────────────────────────────────
const BENEFITS = [
  { icon: <IconWallet />, title: 'Ganancias justas', desc: 'Cobras por cada entrega, sin comisiones ocultas. Tu pago llega completo y a tiempo, cada semana.' },
  { icon: <IconClock />, title: 'Tú pones el horario', desc: 'Conéctate cuando quieras: mañana, tarde o noche. Sin turnos forzados ni jefes encima.' },
  { icon: <IconHeadset />, title: 'Soporte cercano', desc: 'Un equipo local que responde rápido. Si algo pasa con un pedido, te resolvemos al toque.' },
  { icon: <IconRoute />, title: 'Rutas inteligentes', desc: 'La app te arma la ruta más corta de cada pedido. Menos vueltas, más entregas por hora.' },
];

const APP_FEATURES = [
  'Recibe y acepta pedidos al instante',
  'Sigue cada entrega con ruta en el mapa',
  'Historial completo de tus pedidos',
  'Ganancias y pagos semanales a la vista',
  'Tu perfil, vehículo y documentos en orden',
];

const TESTIMONIALS = [
  { name: 'Marco A.', role: 'Mototaxi · Ascensión', initials: 'MA', stars: 5, text: 'La activación fue rápida y cobro cada semana sin vueltas. La app me arma la ruta y ya no pierdo tiempo dando vueltas por la ciudad.' },
  { name: 'Lucía R.', role: 'Moto lineal · Centro', initials: 'LR', stars: 5, text: 'Reparto entre mis clases, cuando puedo. Nadie me presiona con horarios y eso para mí lo es todo. Ingreso extra sin complicarme.' },
  { name: 'Edwin Q.', role: 'Moto lineal · Yananaco', initials: 'EQ', stars: 4, text: 'Cuando tuve un problema con un pedido, el soporte respondió al toque. Se siente que hay gente real detrás cuidando al repartidor.' },
];

const STEPS = [
  { icon: <IconPhone size={22} />, title: 'Descarga la app', desc: 'Baja “ACME Driver” gratis desde Google Play o App Store.' },
  { icon: <IconShieldCheck />, title: 'Crea tu cuenta', desc: 'Regístrate con tu correo, agrega tu foto y verifica tu número.' },
  { icon: <IconCheck size={22} />, title: 'Sube tus documentos', desc: 'DNI, brevete y SOAT vigentes. Todo 100% digital desde el celular.' },
  { icon: <IconBolt />, title: '¡Empieza a ganar!', desc: 'Validamos tu cuenta en 24 h, te activas y recibes pedidos al instante.' },
];

const REQUIREMENTS = [
  'Ser mayor de 18 años',
  'Smartphone Android 8+ o iOS 14+',
  'Moto lineal o mototaxi propia',
  'Brevete vigente (A-I o superior)',
  'SOAT activo y vigente',
  'DNI o carnet de extranjería',
];

// ── PAGE ─────────────────────────────────────────────────────────────────────
export function HazteDriverPage() {
  return (
    <div className="driver-page">

      {/* ── HERO ── */}
      <section className="driver-hero">
        <div className="driver-hero__content animate-fade-in">
          <div className="driver-hero__eyebrow">
            <span className="eyebrow-dot" />
            Repartidores ACME · Huancavelica
          </div>
          <h1 className="driver-hero__title">
            Reparte a tu ritmo y<br />
            <span>gana con ACME</span>
          </h1>
          <p className="driver-hero__description">
            Únete a la red de repartidores de ACME Pedidos. Genera ingresos entregando pedidos en toda la ciudad: tú decides cuándo te conectas y cuánto quieres ganar.
          </p>
          <StoreButtons />
          <div className="hero-stats">
            <div className="hero-stat"><span className="hero-stat__num">S/ 0</span><span className="hero-stat__label">Comisión de ingreso</span></div>
            <div className="hero-stat__divider" />
            <div className="hero-stat"><span className="hero-stat__num">24 h</span><span className="hero-stat__label">Para activarte</span></div>
            <div className="hero-stat__divider" />
            <div className="hero-stat"><span className="hero-stat__num">Semanal</span><span className="hero-stat__label">Pago de tus ganancias</span></div>
          </div>
        </div>
        <div className="driver-hero__image">
          <div className="driver-hero__glow" aria-hidden="true" />
          <img src={repartidoresImg} alt="Repartidores de ACME en moto" />
        </div>
      </section>

      <SectionWave fromColor="#fbf4ee" toColor="#f8f9fa" />

      {/* ── BENEFITS ── */}
      <section className="driver-benefits">
        <span className="driver-eyebrow">Por qué ACME</span>
        <h2 className="section-title">Hecho para que ganes más</h2>
        <p className="section-subtitle">Huancavelica confía en ACME, y nuestros repartidores son el corazón de la operación. Esto es lo que te damos.</p>
        <div className="benefits-grid">
          {BENEFITS.map((b) => (
            <div key={b.title} className="benefit-card">
              <div className="benefit-icon">{b.icon}</div>
              <h3>{b.title}</h3>
              <p>{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <SectionWave fromColor="#f8f9fa" toColor="#4d148c" flip />

      {/* ── MOTORIZED ── */}
      <section className="motorized-section">
        <div className="motorized-inner">
          <div className="motorized-badge">Programa de repartidores 2026</div>
          <h2 className="section-title">Solo unidades motorizadas</h2>
          <p className="motorized-desc">
            Para mantener la rapidez que nos caracteriza en Huancavelica, por ahora solo abrimos registros a repartidores con <strong>moto lineal o mototaxi</strong> propia.
          </p>
          <div className="moto-pills">
            <span className="moto-pill"><IconMoto /> Moto lineal</span>
            <span className="moto-pill"><IconScooter /> Mototaxi</span>
          </div>
          <div className="moto-info-grid">
            <div className="moto-info-card">
              <div className="moto-info-card__icon"><IconShieldCheck /></div>
              <h4>Sin experiencia previa</h4>
              <p>No necesitas haber trabajado en delivery antes. Te guiamos paso a paso desde el primer día.</p>
            </div>
            <div className="moto-info-card">
              <div className="moto-info-card__icon"><IconCalendar /></div>
              <h4>Horario 100% libre</h4>
              <p>Conéctate cuando quieras y desconéctate cuando lo necesites. El control siempre es tuyo.</p>
            </div>
            <div className="moto-info-card">
              <div className="moto-info-card__icon"><IconWallet size={22} /></div>
              <h4>Pagos semanales</h4>
              <p>Cobra tus ganancias cada semana en tu cuenta bancaria o billetera digital (Yape / Plin).</p>
            </div>
          </div>
        </div>
      </section>

      <SectionWave fromColor="#4d148c" toColor="#ffffff" />

      {/* ── APP DOWNLOAD (con captura real) ── */}
      <section className="driver-download">
        <div className="download-image animate-fade-in">
          <div className="download-image__glow" aria-hidden="true" />
          <img src={driverCelImg} alt="App ACME Driver — pantalla de perfil del repartidor" />
        </div>
        <div className="download-content">
          <span className="driver-eyebrow">App ACME Driver</span>
          <h2 className="section-title">Todo en la palma de tu mano</h2>
          <p className="download-desc">
            Una app simple y potente para repartir sin estrés: pedidos en tiempo real, rutas en el mapa, tus ganancias y tu perfil, todo en un solo lugar.
          </p>
          <ul className="app-features-list">
            {APP_FEATURES.map((f) => (
              <li key={f}><i><IconCheck /></i> {f}</li>
            ))}
          </ul>
          <StoreButtons />
        </div>
      </section>

      <SectionWave fromColor="#ffffff" toColor="#f8f9fa" flip />

      {/* ── TESTIMONIALS (comentarios de drivers) ── */}
      <section className="driver-reviews">
        <span className="driver-eyebrow">Comentarios de repartidores</span>
        <h2 className="section-title">Lo que dicen quienes ya reparten</h2>
        <p className="section-subtitle">Historias reales de repartidores que se mueven con ACME en Huancavelica.</p>
        <div className="reviews-grid">
          {TESTIMONIALS.map((t) => (
            <article key={t.name} className="review-card">
              <span className="review-quote" aria-hidden="true"><IconQuote /></span>
              <div className="review-stars" aria-label={`${t.stars} de 5 estrellas`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={i <= t.stars ? 'review-star review-star--on' : 'review-star'}><IconStar size={16} /></span>
                ))}
              </div>
              <p className="review-text">{t.text}</p>
              <div className="review-author">
                <span className="review-avatar">{t.initials}</span>
                <div>
                  <strong>{t.name}</strong>
                  <span>{t.role}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <SectionWave fromColor="#f8f9fa" toColor="#ffffff" />

      {/* ── STEPS ── */}
      <section className="steps-section">
        <span className="driver-eyebrow">Empieza hoy</span>
        <h2 className="section-title">Actívate en 4 pasos</h2>
        <p className="section-subtitle">El registro es 100% digital y se completa en menos de 10 minutos.</p>
        <div className="steps-grid">
          {STEPS.map((s) => (
            <div key={s.title} className="step-item">
              <div className="step-item__icon">{s.icon}</div>
              <h4>{s.title}</h4>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── REQUIREMENTS + CTA ── */}
      <section className="requirements-section">
        <div className="requirements-container">
          <div className="requirements-head">
            <span className="driver-eyebrow">Requisitos</span>
            <h2 className="section-title">¿Qué necesitas para unirte?</h2>
            <p className="requirements-sub">Probablemente ya cumples casi todo. Este es el detalle completo:</p>
          </div>
          <div className="requirement-list">
            {REQUIREMENTS.map((r) => (
              <div key={r} className="requirement-item"><i><IconCheck /></i> {r}</div>
            ))}
          </div>
          <div className="requirements-cta">
            <div>
              <strong>¿Listo para arrancar?</strong>
              <span>Descarga ACME Driver y activa tu cuenta hoy mismo.</span>
            </div>
            <StoreButtons />
          </div>
        </div>
      </section>

    </div>
  );
}
