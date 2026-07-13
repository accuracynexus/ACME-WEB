import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppRoutes } from '../../../core/constants/routes';
import { publicMarketplaceService, type PublicBrandLogo } from '../../../core/services/publicMarketplaceService';
import mochilaImg from '../../../images/mochila.png';
import abarrotesImg from '../../../images/abarrotes.png';
import brasaImg from '../../../images/brasa.png';
import celImg from '../../../images/cel.png';
import mapaHvcaImg from '../../../images/mapa-hvca.png';
import superiorSvg from '../../../images/superior.svg';

// Custom category icons
import catRestaurantesImg from '../../../images/restaurantes.png';
import catMarketImg from '../../../images/market.png';
import catFarmaciaImg from '../../../images/farmacia.png';
import catFerreteriaImg from '../../../images/ferreteria.png';
import catLicoresImg from '../../../images/licores.png';
import coyoteImg from '../../../images/coyote.png';
import correcaminosImg from '../../../images/correcaminos.png';
import acmeIconWebp from '../../../images/logo/acme-icon.webp';

// ─── Inline styles as constants to keep the component clean ───────────────────

const S = {
  // Hero
  hero: {
    minHeight: '88vh',
    background: '#ffffff',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    alignItems: 'center',
    padding: '120px 80px 60px',
    position: 'relative' as const,
    overflow: 'hidden',
    gap: '48px',
  } as React.CSSProperties,
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(77, 20, 140, 0.1)',
    border: '1px solid rgba(77, 20, 140, 0.3)',
    color: '#4d148c',
    fontSize: '.82rem',
    fontWeight: 700,
    letterSpacing: '.5px',
    padding: '6px 16px',
    borderRadius: '20px',
    marginBottom: '24px',
  } as React.CSSProperties,
  heroBadgeDot: {
    width: '8px',
    height: '8px',
    background: '#ff6200',
    borderRadius: '50%',
    display: 'inline-block',
  } as React.CSSProperties,
  heroH1: {
    fontFamily: "'Poppins', sans-serif",
    fontSize: '3.6rem',
    fontWeight: 800,
    lineHeight: 1.1,
    color: '#1a0a2e',
    marginBottom: '20px',
  } as React.CSSProperties,
  heroSub: {
    color: '#5b4b78',
    fontSize: '1.05rem',
    lineHeight: 1.7,
    maxWidth: '460px',
    marginBottom: '36px',
  } as React.CSSProperties,
  heroCtas: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  btnPrimary: {
    background: '#ff6200',
    color: '#ffffff',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 700,
    fontSize: '1rem',
    padding: '14px 30px',
    borderRadius: '14px',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
    boxShadow: '0 8px 24px rgba(255,98,0,.4)',
  } as React.CSSProperties,
  btnSecondary: {
    background: 'transparent',
    color: '#4d148c',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 600,
    fontSize: '1rem',
    padding: '14px 30px',
    borderRadius: '14px',
    border: '2px solid #4d148c',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
  } as React.CSSProperties,
  storeBadges: {
    display: 'flex',
    gap: '12px',
    marginTop: '28px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  storeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#1a0a2e',
    color: '#ffffff',
    borderRadius: '12px',
    padding: '10px 18px',
    fontSize: '.82rem',
    fontWeight: 600,
    textDecoration: 'none',
    border: '1px solid rgba(255,255,255,.1)',
  } as React.CSSProperties,
};

export function HomePage() {
  const [brands, setBrands] = useState<PublicBrandLogo[]>([]);

  useEffect(() => {
    let active = true;
    void publicMarketplaceService.fetchBrandLogos().then(({ data }) => {
      if (active) setBrands(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      {/* Google Fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;900&family=Poppins:wght@400;500;600;800&display=swap"
        rel="stylesheet"
      />

      <style>{`
        @keyframes acme-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.4)} }
        @keyframes acme-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes acme-scroll { 0%{transform: translateX(0)} 100%{transform: translateX(-50%)} }
        .acme-pulse { animation: acme-pulse 2s infinite; }
        .acme-float { animation: acme-float 3s ease-in-out infinite; }
        .acme-float-delay { animation: acme-float 3s ease-in-out .5s infinite; }
        .acme-cat-card { transition: transform .25s, box-shadow .25s; }
        .acme-cat-card:hover { transform: translateY(-6px); }
        .acme-feat-card { transition: border-color .2s, transform .2s, box-shadow .2s; }
        .acme-feat-card:hover { border-color: #4d148c !important; transform: translateY(-4px); box-shadow: 0 16px 40px rgba(77,20,140,.12) !important; }
        .acme-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(255,98,0,.5) !important; }
        .acme-btn-secondary:hover { background: rgba(77,20,140,.1) !important; }
        .acme-nav-link:hover { background: #f0e8ff; color: #4d148c !important; }
        /* padding vertical para que el lift + sombra del hover no se recorten (el contenedor tiene overflow:hidden) */
        .acme-brands-scroll { display: flex; align-items: center; padding: 22px 0; animation: acme-scroll 60s linear infinite; width: fit-content; }
        .acme-brands-container { overflow: hidden; white-space: nowrap; }

        /* Decorative Characters Responsive */
        .acme-char-coyote {
          position: absolute;
          right: -100px;
          top: -120px;
          width: 590px;
          z-index: 99;
          pointer-events: none;
          filter: drop-shadow(0 30px 60px rgba(0,0,0,0.12));
          transform: rotate(-5deg);
          transition: all 0.4s ease;
        }
        .acme-char-correcaminos {
          position: absolute;
          left: -40px;
          top: -290px;
          width: 320px;
          z-index: 99;
          pointer-events: none;
          filter: drop-shadow(0 20px 40px rgba(0,0,0,0.12));
          transform: rotate(5deg);
          transition: all 0.4s ease;
        }

        @media (max-width: 1400px) {
          .acme-char-coyote { width: 480px; right: -80px; top: -100px; }
        }
        @media (max-width: 1200px) {
          .acme-char-coyote { width: 380px; right: -60px; top: -80px; }
          .acme-char-correcaminos { width: 240px; left: -20px; top: -200px; }
        }
        @media (max-width: 960px) {
          .acme-char-coyote { display: none; }
          .acme-char-correcaminos { display: none; }
        }

        /* Responsive Layouts */
        .acme-hero { display: grid; grid-template-columns: 1fr 1fr; padding: 120px 80px 60px; gap: 48px; align-items: center; position: relative; overflow: hidden; min-height: 88vh; background: #fff; }
        .acme-hero-bg { position: absolute; left: -150px; top: -150px; width: 1000px; height: 820px; pointer-events: none; transform: scaleX(-1); opacity: 0.9; }
        .acme-cats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; max-width: 900px; margin: 0 auto; }
        .acme-feats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        .acme-city-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; padding: 80px; }
        .acme-section { padding: 80px; text-align: center; }
        .acme-cta-sec { padding: 60px 80px; display: flex; justify-content: center; }
        .acme-cta-card { background: #fff; border-radius: 24px; padding: 48px 60px; display: flex; align-items: center; gap: 60px; max-width: 960px; width: 100%; box-shadow: 0 2px 24px rgba(0,0,0,0.06); position: relative; overflow: hidden; }
        .acme-hero-h1 { font-family: 'Poppins', sans-serif; font-size: 3.6rem; font-weight: 800; line-height: 1.1; color: #1a0a2e; margin-bottom: 20px; }
        .acme-hero-sub { color: #5b4b78; font-size: 1.05rem; line-height: 1.7; max-width: 460px; margin-bottom: 36px; }
        .acme-hero-ctas { display: flex; gap: 14px; flex-wrap: wrap; }
        .acme-store-badges { display: flex; gap: 12px; margin-top: 28px; flex-wrap: wrap; }
        .acme-cta-buttons { display: flex; gap: 12px; flex-wrap: wrap; }
        .acme-section-h2 { font-family: 'Poppins', sans-serif; font-weight: 800; font-size: 2.8rem; color: #1a0a2e; margin-bottom: 48px; }
        .acme-feats-h2 { font-family: 'Poppins', sans-serif; font-weight: 800; font-size: 2.4rem; color: #1a0a2e; }
        .acme-brands-title { color: #5b4b78; font-size: 1.2rem; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; margin-bottom: 22px; }
        .acme-city-h2 { font-family: 'Poppins', sans-serif; font-weight: 800; font-size: 2.4rem; color: #1a0a2e; margin-bottom: 20px; }

        /* Brand Item Styling */
        .acme-brand-item {
          background: #fff;
          border-radius: 50%;
          padding: 10px;
          border: 1px solid #ede8f7;
          margin-right: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 88px;
          height: 88px;
          flex-shrink: 0;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(0,0,0,0.04);
        }
        .acme-brand-item:hover {
          border-color: #4d148c;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(77,20,140,0.12);
        }
        .acme-brand-logo {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 50%;
          display: block;
        }
        .acme-brand-fallback {
          font-family: 'Poppins', sans-serif;
          font-weight: 800;
          font-size: .58rem;
          color: #6b5b8a;
          text-align: center;
          line-height: 1.15;
          padding: 4px;
        }

        /* Category Card Styling */
        .acme-cat-card {
          position: relative;
          overflow: hidden;
          z-index: 1;
        }
        .acme-cat-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%);
          z-index: -1;
        }
        .acme-cat-card:hover {
          transform: translateY(-10px) scale(1.02);
          box-shadow: 0 20px 40px var(--shadow-color) !important;
        }
        .acme-cat-card-soon {
          background: #fff !important;
          border: 2px dashed #e0e0e0;
          color: #a0a0a0 !important;
          box-shadow: none !important;
          cursor: default;
          opacity: 0.8;
          filter: grayscale(0.5);
          position: relative;
        }
        .acme-cat-card-soon .soon-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          background: #f0f0f0;
          color: #666;
          font-size: 0.65rem;
          padding: 4px 8px;
          border-radius: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 700;
        }
        .acme-section-soon-title {
          font-family: 'Poppins', sans-serif;
          font-weight: 700;
          font-size: 1.2rem;
          color: #5b4b78;
          margin: 60px 0 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 15px;
        }
        .acme-section-soon-title::before, .acme-section-soon-title::after {
          content: '';
          height: 1px;
          flex: 1;
          background: linear-gradient(90deg, transparent, #e0e0e0, transparent);
          max-width: 100px;
        }

        /* Waves and Premium Section Styles */
        .acme-waves-section {
          position: relative;
          background: #ffffff;
          padding: 120px 80px;
          overflow: hidden;
        }
        .acme-feat-card-premium {
          background: #fff;
          border-radius: 32px;
          padding: 48px 36px;
          border: 1px solid rgba(0,0,0,0.04);
          box-shadow: 0 10px 30px rgba(0,0,0,0.02);
          transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 20px;
          position: relative;
          z-index: 1;
        }
        .acme-feat-card-premium:hover {
          transform: translateY(-12px);
          box-shadow: 0 24px 48px rgba(77,20,140,0.08);
          border-color: rgba(77,20,140,0.1);
        }
        .acme-icon-box {
          width: 70px;
          height: 70px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
          transition: transform 0.3s ease;
        }
        .acme-feat-card-premium:hover .acme-icon-box {
          transform: scale(1.1) rotate(5deg);
        }
        .acme-btn-know-more {
          margin-top: 60px;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: #fff;
          color: #4d148c;
          padding: 16px 36px;
          border-radius: 100px;
          font-weight: 700;
          font-family: 'Poppins', sans-serif;
          text-decoration: none;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          border: 1px solid rgba(77,20,140,0.15);
          transition: all 0.3s ease;
        }
        .acme-btn-know-more:hover {
          background: #4d148c;
          color: #fff;
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(77,20,140,0.25);
        }

        @media (max-width: 1024px) {
          .acme-hero { padding: 100px 40px 50px; gap: 24px; }
          .acme-section { padding: 60px 40px; }
          .acme-city-grid { padding: 60px 40px; gap: 40px; }
          .acme-cta-sec { padding: 60px 40px; }
          .acme-cats-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 768px) {
          /* Hero: single column, image first then text */
          .acme-hero {
            grid-template-columns: 1fr;
            padding: 100px 20px 44px;
            gap: 0;
            min-height: auto;
            overflow: hidden;
          }
          /* Hide the large purple blob on mobile — it bleeds over text */
          .acme-hero-bg { display: none; }

          .acme-hero .hero-svg-wrapper {
            order: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            overflow: hidden;
            position: relative;
          }
          /* Scale SVG to fit screen width */
          .acme-hero .hero-svg-wrapper svg {
            width: min(360px, 94vw);
            height: auto;
          }
          /* Add a coloured blob behind just the SVG area for context */
          .acme-hero .hero-svg-wrapper::before {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(ellipse 85% 75% at 50% 55%, #6f2dbd33 0%, transparent 80%);
            border-radius: 50%;
            pointer-events: none;
          }

          .acme-hero .hero-content {
            order: 2;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            width: 100%;
            padding-top: 20px;
            position: relative;
            z-index: 2;
          }

          /* Typography */
          .acme-hero-h1 { font-size: 2.2rem; word-break: break-word; margin-bottom: 12px; line-height: 1.15; }
          .acme-hero-sub { font-size: .95rem; margin-bottom: 20px; max-width: 100%; line-height: 1.65; }
          .acme-section-h2 { font-size: 1.8rem; margin-bottom: 28px; }
          .acme-feats-h2 { font-size: 1.7rem; }
          .acme-brands-title { font-size: 1rem; }
          .acme-city-h2 { font-size: 1.7rem; }

          /* Buttons */
          .acme-hero-ctas { width: 100%; flex-direction: column; gap: 10px; }
          .acme-btn-hero-primary, .acme-btn-hero-secondary {
            width: 100% !important;
            text-align: center !important;
            display: block !important;
            padding: 15px 20px !important;
            box-sizing: border-box;
            border-radius: 14px !important;
          }
          .acme-store-badges { flex-direction: row; gap: 10px; margin-top: 20px; }
          .acme-store-badges a { flex: 1; justify-content: center; min-width: 0; }

          /* Sections */
          .acme-feats-grid { grid-template-columns: 1fr; }
          .acme-city-grid { grid-template-columns: 1fr; text-align: center; padding: 40px 20px; }
          .acme-section { padding: 40px 20px; }
          .acme-cta-sec { padding: 32px 16px; }
          .acme-cta-card { flex-direction: column; padding: 28px 20px; gap: 28px; text-align: center; align-items: center; }
          .acme-cta-buttons { justify-content: center; flex-wrap: wrap; gap: 10px; }
          .acme-cta-card .phone-mockup-wrapper { margin: 0 auto; order: 2; }
          .acme-cta-card .cta-content-wrapper { order: 1; width: 100%; }
          .acme-cta-card h2 { font-size: 1.4rem !important; }
        }

        @media (max-width: 480px) {
          .acme-cats-grid { grid-template-columns: 1fr 1fr; }
          .acme-hero-h1 { font-size: 2rem; }
          .acme-section-h2 { font-size: 1.55rem; }
          .acme-hero .hero-svg-wrapper svg { width: 90vw; }
        }
      `}</style>

      {/* ── HERO ── */}
      <section className="acme-hero">
        {/* decorative blob — visible only on desktop via CSS */}
        <img
          src={superiorSvg}
          alt=""
          className="acme-hero-bg"
        />

        {/* Left: SVG with images */}
        <div className="hero-svg-wrapper" style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <svg width="500" height="500" viewBox="0 0 500 500" style={{ overflow: 'visible' }}>
            {/* Images */}
            <image
              href={mochilaImg}
              x="100"
              y="120"
              width="300"
              height="300"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}
            />

            <image
              href={brasaImg}
              x="330"
              y="260"
              width="160"
              height="160"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}
            />
            <image
              href={celImg}
              x="-50"
              y="190"
              width="240"
              height="240"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}
            />
            <image
              href={abarrotesImg}
              x="35"
              y="230"
              width="350"
              height="350"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}
            />
          </svg>
        </div>

        {/* Right: text */}
        <div className="hero-content" style={{ position: 'relative', zIndex: 2 }}>
          <div style={S.heroBadge}>
            <span className="acme-pulse" style={S.heroBadgeDot} />
            Huancavelica ya tiene delivery
          </div>
          <h1 className="acme-hero-h1">
            ¿Lo quieres?<br />
            <span style={{ color: '#ff6200' }}>¡Lo tienes!</span>
          </h1>
          <p className="acme-hero-sub">
            Somos la primera plataforma de delivery 100% local en{' '}
            <strong style={{ color: '#ff8533' }}>Huancavelica</strong>. Pedidos rápidos,
            seguimiento en tiempo real, y tus negocios favoritos en un solo lugar.
          </p>
          <div className="acme-hero-ctas">
            <Link
              to={AppRoutes.public.marketplace}
              className="acme-btn-primary acme-btn-hero-primary"
              style={{
                background: '#ff6200', color: '#ffffff',
                fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '1rem',
                padding: '14px 30px', borderRadius: '14px', border: 'none',
                cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
                boxShadow: '0 8px 24px rgba(255,98,0,.4)',
              }}
            >
              Ordenar ahora
            </Link>
            <Link
              to={AppRoutes.public.businesses}
              className="acme-btn-secondary acme-btn-hero-secondary"
              style={{
                background: 'transparent', color: '#4d148c',
                fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '1rem',
                padding: '14px 30px', borderRadius: '14px',
                border: '2px solid #4d148c', cursor: 'pointer',
                textDecoration: 'none', display: 'inline-block',
              }}
            >
              Afilia tu negocio
            </Link>
          </div>
          <div className="acme-store-badges">
            <a href="#" style={S.storeBadge}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M3 20.5v-17c0-.83 1-1.3 1.7-.8l14 8.5c.7.4.7 1.5 0 1.9l-14 8.5c-.7.5-1.7.03-1.7-.8z" fill="#4caf50" />
              </svg>
              <span>
                <small style={{ display: 'block', fontSize: '.65rem', opacity: .7 }}>Disponible en</small>
                Google Play
              </span>
            </a>
            <a href="#" style={S.storeBadge}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <span>
                <small style={{ display: 'block', fontSize: '.65rem', opacity: .7 }}>Disponible en</small>
                App Store
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* ---- BRANDS ---- */}
      <div style={{ background: '#ffffffff', padding: '36px 0', textAlign: 'center' }}>
        <p className="acme-brands-title" style={{ padding: '0 20px' }}>
          Negocios que confían en nosotros
        </p>
        <div className="acme-brands-container">
          <div className="acme-brands-scroll">
            {/* Duplicamos la lista para que el scroll infinito (acme-scroll → -50%) no tenga cortes */}
            {(brands.length ? [...brands, ...brands] : []).map((b, idx) => (
              <div key={`${b.id}-${idx}`} className="acme-brand-item" title={b.trade_name}>
                <img
                  className="acme-brand-logo"
                  src={b.logo_url}
                  alt={b.trade_name}
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.style.display = 'none';
                    const fallback = img.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = 'inline';
                  }}
                />
                <span className="acme-brand-fallback" style={{ display: 'none' }}>{b.trade_name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CATEGORIES ── */}
      <section className="acme-section" style={{ position: 'relative', overflow: 'hidden', padding: '0' }}>

        {/* Ola superior — el de arriba es blanco */}
        <div style={{ lineHeight: 0, marginBottom: '-2px' }}>
          <svg viewBox="0 0 1440 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ width: '100%', display: 'block' }}>
            <path d="M0,0 C360,100 720,0 1080,80 C1260,110 1380,40 1440,60 L1440,0 Z" fill="#ffffff" />
          </svg>
        </div>

        <div style={{ padding: '40px 24px 60px' }}>
          <h2 className="acme-section-h2">
            Todo lo que <span style={{ color: '#4d148c' }}>necesitas</span>
          </h2>
          <div className="acme-cats-grid" style={{ maxWidth: '1100px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {[
              { img: catRestaurantesImg, label: 'Restaurantes', grad: 'linear-gradient(145deg, #ff6200, #ff9a55)', shadow: 'rgba(255,98,0,.3)' },
              { img: catMarketImg, label: 'Supermercados', grad: 'linear-gradient(145deg, #4d148c, #7b2fd4)', shadow: 'rgba(77,20,140,.3)' },
              { img: catFarmaciaImg, label: 'Farmacias', grad: 'linear-gradient(145deg, #eb4d4b, #ff7979)', shadow: 'rgba(235,77,75,.3)' },
              { img: catFerreteriaImg, label: 'Ferreterías', grad: 'linear-gradient(145deg, #535c68, #95afc0)', shadow: 'rgba(83,92,104,.3)' },
              { img: catLicoresImg, label: 'Licores', grad: 'linear-gradient(145deg, #00b894, #00d4aa)', shadow: 'rgba(0,184,148,.3)' },
            ].map(c => (
              <a key={c.label} href="#" className="acme-cat-card" style={{
                borderRadius: '24px', padding: '32px 20px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
                textDecoration: 'none', fontWeight: 800, fontSize: '1rem', color: '#fff',
                background: c.grad, boxShadow: `0 15px 35px ${c.shadow}`,
                '--shadow-color': c.shadow
              } as React.CSSProperties}>
                <div style={{
                  width: '75px', height: '75px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.25))',
                  transition: 'transform 0.3s ease'
                }}>
                  <img src={c.img} alt={c.label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                {c.label}
              </a>
            ))}
          </div>

          <div className="acme-section-soon-title">
            🚀 Próximamente nuevas soluciones
          </div>

          <div className="acme-cats-grid" style={{ maxWidth: '600px', gridTemplateColumns: 'repeat(2, 1fr)', margin: '0 auto' }}>
            {[
              { emoji: '🛍️', label: 'Personal Shopper' },
              { emoji: '🚚', label: 'Envíos y Compras Externas' },
            ].map(c => (
              <div key={c.label} className="acme-cat-card-soon" style={{
                borderRadius: '24px', padding: '32px 20px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
                fontWeight: 800, fontSize: '1rem',
              }}>
                <span className="soon-badge">Muy pronto</span>
                <span style={{ fontSize: '2.8rem' }}>{c.emoji}</span>
                <div style={{ textAlign: 'center', lineHeight: 1.2 }}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POR QUÉ ELEGIRNOS ── */}
      <section
        className="acme-section"
        style={{ position: 'relative', overflow: 'visible', background: '#ffffff', padding: '0' }}
      >
        <img
          src={coyoteImg}
          alt="Coyote"
          className="acme-char-coyote"
        />
        {/* Ola superior */}
        <div style={{ lineHeight: 0, marginBottom: '-2px' }}>
          <svg viewBox="0 0 1440 90" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ width: '100%', display: 'block' }}>
            <path d="M0,0 C240,90 480,0 720,60 C960,110 1200,20 1440,70 L1440,0 Z" fill="#f0f2f8" />
          </svg>
        </div>

        {/* Contenido */}
        <div style={{ padding: '60px 24px 80px', background: '#ffffff' }}>
          <div style={{ marginBottom: '56px', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'linear-gradient(90deg,#ff6200,#ff9a00)',
              color: '#fff', fontSize: '.75rem', fontWeight: 800,
              letterSpacing: '2px', textTransform: 'uppercase',
              padding: '6px 18px', borderRadius: '999px', marginBottom: '16px'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              ¿Por qué elegirnos?
            </div>
            <h2 className="acme-feats-h2" style={{ marginBottom: '16px' }}>
              Todo lo que necesitas,{' '}
              <span style={{ color: '#4d148c' }}>en un solo lugar</span>
            </h2>
            <p style={{ color: '#6b5a8a', fontSize: '1rem', maxWidth: '500px', margin: '0 auto', lineHeight: 1.7 }}>
              Diseñado para la vida en Huancavelica. Rápido, confiable y siempre cerca de ti.
            </p>
          </div>

          <div className="acme-feats-grid" style={{ gap: '24px' }}>
            {[
              {
                icon: (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ff6200" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                  </svg>
                ),
                bg: 'rgba(255,98,0,.08)',
                accent: '#ff6200',
                badge: 'Velocidad',
                title: 'Entrega express',
                desc: 'Tu pedido llega en menos de 30 minutos. Sin esperas, sin excusas. La velocidad que mereces cada día.',
              },
              {
                icon: (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4d148c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                ),
                bg: 'rgba(77,20,140,.08)',
                accent: '#4d148c',
                badge: 'Control total',
                title: 'Rastreo en vivo',
                desc: 'Sigue cada movimiento de tu repartidor en tiempo real. Siempre sabes exactamente dónde está tu pedido.',
              },
              {
                icon: (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#00b894" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                ),
                bg: 'rgba(0,184,148,.08)',
                accent: '#00b894',
                badge: 'Variedad',
                title: 'Miles de productos',
                desc: 'Restaurantes, farmacias, tiendas y negocios locales en un solo app. Pide lo que quieras, cuando quieras.',
              },
              {
                icon: (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#e84393" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ),
                bg: 'rgba(232,67,147,.08)',
                accent: '#e84393',
                badge: 'Confianza',
                title: 'Pagos 100% seguros',
                desc: 'Paga con efectivo, tarjeta o billetera digital. Tu información siempre protegida con cifrado de nivel bancario.',
              },
              {
                icon: (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#f39c12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                  </svg>
                ),
                bg: 'rgba(243,156,18,.08)',
                accent: '#f39c12',
                badge: 'Beneficios',
                title: 'Recompensas exclusivas',
                desc: 'Acumula puntos en cada pedido y canjéalos por descuentos, envíos gratis y sorpresas especiales.',
              },
              {
                icon: (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0984e3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.07 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                ),
                bg: 'rgba(9,132,227,.08)',
                accent: '#0984e3',
                badge: 'Soporte',
                title: 'Atención 24/7',
                desc: 'Nuestro equipo está disponible todo el día para resolver cualquier duda o inconveniente al instante.',
              },
            ].map(f => (
              <div
                key={f.title}
                className="acme-feat-card"
                style={{
                  background: '#fff',
                  borderRadius: '24px',
                  padding: '36px 28px',
                  border: `1.5px solid ${f.accent}20`,
                  cursor: 'default',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform .2s, box-shadow .2s',
                  boxShadow: '0 4px 24px rgba(77,20,140,.06)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-6px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 16px 40px ${f.accent}22`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 24px rgba(77,20,140,.06)';
                }}
              >
                <div style={{
                  position: 'absolute', top: '-20px', right: '-20px',
                  width: '100px', height: '100px', borderRadius: '50%',
                  background: f.bg, pointerEvents: 'none'
                }} />
                <div style={{
                  display: 'inline-block', fontSize: '.68rem', fontWeight: 700,
                  color: f.accent, background: f.bg,
                  padding: '3px 10px', borderRadius: '999px',
                  marginBottom: '16px', letterSpacing: '1px', textTransform: 'uppercase'
                }}>
                  {f.badge}
                </div>
                <div style={{
                  width: 60, height: 60, borderRadius: 18, background: f.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 20
                }}>
                  {f.icon}
                </div>
                <h3 style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#1a0a2e', marginBottom: 10 }}>
                  {f.title}
                </h3>
                <p style={{ color: '#5b4b78', fontSize: '.88rem', lineHeight: 1.75, marginBottom: 0 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Botón Conoce más */}
          <div style={{ textAlign: 'center', marginTop: '52px' }}>
            <Link
              to={AppRoutes.public.contact}
              className="acme-btn-know-more"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '10px',
                background: 'linear-gradient(135deg,#4d148c,#7b2ff7)',
                color: '#fff', fontFamily: "'Poppins',sans-serif",
                fontWeight: 700, fontSize: '1rem',
                padding: '16px 40px', borderRadius: '999px',
                textDecoration: 'none',
                boxShadow: '0 8px 28px rgba(77,20,140,.35)',
                transition: 'transform .2s, box-shadow .2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-3px)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 14px 36px rgba(77,20,140,.45)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 28px rgba(77,20,140,.35)';
              }}
            >
              Conoce más sobre nosotros
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <p style={{ color: '#9b8ab0', fontSize: '.82rem', marginTop: '14px' }}>
              Conoce al equipo detrás de cada entrega 🚀
            </p>
          </div>
        </div>

        {/* Ola inferior */}
        <div style={{ lineHeight: 0, marginTop: '-2px' }}>
          <svg viewBox="0 0 1440 90" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ width: '100%', display: 'block' }}>
            <path d="M0,90 C240,0 480,90 720,30 C960,-20 1200,70 1440,20 L1440,90 Z" fill="#f0f2f8" />
          </svg>
        </div>
      </section>

      {/* ── CITY ── */}
      <section className="acme-city-grid" style={{ position: 'relative', overflow: 'visible' }}>
        <img
          src={correcaminosImg}
          alt="Correcaminos"
          className="acme-char-correcaminos"
        />
        <div>
          <div style={{ color: '#ff6200', fontSize: '.82rem', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>Cobertura</div>
          <h2 className="acme-city-h2">
            La app de delivery que <span style={{ color: '#4d148c' }}>llegó a Huancavelica</span>
          </h2>
          <p style={{ color: '#5b4b78', lineHeight: 1.8, marginBottom: '28px' }}>
            Somos la primera plataforma de delivery local que conecta a los huancavelicanos con sus negocios favoritos. Comenzamos aquí y seguiremos creciendo.
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            background: 'linear-gradient(135deg, #4d148c, #6a22b8)',
            color: '#fff', padding: '14px 28px', borderRadius: '16px',
            fontWeight: 800, fontSize: '1.1rem',
            boxShadow: '0 10px 30px rgba(77,20,140,.3)',
          }}>
            <span>📍</span> Huancavelica — Activo ahora
          </div>
          <p style={{ marginTop: '18px', fontSize: '.88rem', color: '#5b4b78' }}>
            Próximamente expandiéndonos a más ciudades de la región.
          </p>
        </div>
        <div style={{
          background: '#ffffff',
          borderRadius: '28px',
          padding: '20px',
          boxShadow: '0 24px 60px rgba(77,20,140,.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <img
            src={mapaHvcaImg}
            alt="Mapa de Huancavelica"
            style={{
              maxWidth: '100%',
              height: 'auto',
              borderRadius: '20px'
            }}
          />
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="acme-cta-sec" style={{ padding: '160px 20px 80px', display: 'flex', justifyContent: 'center', backgroundColor: '#f0f2f8' }}>

        {/* ── ESTILOS RESPONSIVOS ── */}
        <style>{`
        .acme-card-container {
          display: flex;
          flex-direction: row;
          background: #ffffff;
          border-radius: 32px;
          box-shadow: 0 24px 48px rgba(0,0,0,0.06);
          max-width: 1050px;
          width: 100%;
          position: relative;
        }

        .acme-content-side {
          flex: 1 1 55%;
          padding: 45px 50px;
          z-index: 2;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .acme-visual-side {
          flex: 1 1 45%;
          position: relative;
          background: linear-gradient(135deg, #ff8c00 0%, #ff4500 100%);
          border-radius: 0 32px 32px 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .acme-waves-bg {
          position: absolute;
          top: 0; right: 0; bottom: 0; left: 0;
          overflow: hidden;
          border-radius: 0 32px 32px 0;
          z-index: 0;
        }

        .acme-phone-wrapper {
          position: relative;
          z-index: 1;
          transform: translateY(-100px);
          margin-bottom: -100px;
        }

        .acme-cta-buttons {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        /* ── MODO MÓVIL / TABLET ── */
        @media (max-width: 960px) {
          .acme-card-container {
            flex-direction: column-reverse;
            margin-top: 100px;
          }
          .acme-visual-side {
            border-radius: 32px 32px 0 0;
            align-items: flex-end;
          }
          .acme-waves-bg {
            border-radius: 32px 32px 0 0;
          }
          .acme-phone-wrapper {
            transform: translateY(-80px);
            margin-bottom: -50px;
          }
          .acme-content-side {
            padding: 40px 24px;
            text-align: center;
            align-items: center;
          }
          .acme-cta-buttons {
            justify-content: center;
          }
          .acme-cta-title {
            font-size: 2.2rem !important;
          }
        }
      `}</style>

        <div className="acme-card-container">

          {/* ── IZQUIERDA: CONTENIDO Y BOTONES ── */}
          <div className="acme-content-side">

            {/* Ícono de Flama Premium (Imagen WebP) */}
            <img
              src={acmeIconWebp}
              alt="Acme Icon"
              style={{
                width: '64px',
                height: '64px',
                objectFit: 'contain',
                marginBottom: '24px'
              }}
            />

            <h2 className="acme-cta-title" style={{
              fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: '2.5rem',
              color: '#111111', lineHeight: 1.15, margin: '0 0 16px', letterSpacing: '-0.03em'
            }}>
              Pide hoy. <span style={{ color: '#ff4500' }}>Únete a más de 800,000</span> personas en Acme.
            </h2>

            <p style={{ fontFamily: 'sans-serif', fontSize: '1.1rem', color: '#555', marginBottom: '32px', lineHeight: 1.6, maxWidth: '480px' }}>
              Descarga nuestra aplicación y descubre los mejores restaurantes cerca de ti. Comida rápida, segura y caliente en minutos.
            </p>

            <div className="acme-cta-buttons">
              {/* Botón Google Play */}
              <Link to="/marketplace" style={{
                display: 'flex', alignItems: 'center', gap: '12px', background: '#000000', color: '#ffffff',
                padding: '12px 24px', borderRadius: '14px', textDecoration: 'none',
                boxShadow: '0 10px 20px rgba(0,0,0,0.15)'
              }}>
                <svg width="24" height="24" viewBox="0 0 512 512" fill="currentColor">
                  <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
                </svg>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '10px', opacity: 0.8, fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Disponible en</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'sans-serif', marginTop: '-2px' }}>Google Play</div>
                </div>
              </Link>

              {/* Botón App Store */}
              <Link to="/marketplace" style={{
                display: 'flex', alignItems: 'center', gap: '12px', background: '#000000', color: '#ffffff',
                padding: '12px 24px', borderRadius: '14px', textDecoration: 'none',
                boxShadow: '0 10px 20px rgba(0,0,0,0.15)'
              }}>
                <svg width="24" height="24" viewBox="0 0 384 512" fill="currentColor">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                </svg>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '10px', opacity: 0.8, fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Consíguelo en el</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'sans-serif', marginTop: '-2px' }}>App Store</div>
                </div>
              </Link>
            </div>
          </div>

          {/* ── DERECHA: FONDO Y CELULAR ── */}
          <div className="acme-visual-side">

            {/* Fondo de Olas */}
            <div className="acme-waves-bg">
              <svg style={{ position: 'absolute', top: 0, right: '-20%', width: '150%', height: '100%', opacity: 0.15 }} preserveAspectRatio="none" viewBox="0 0 100 100">
                <path d="M100,50 C80,20 60,80 40,40 C20,0 0,60 0,50 L0,100 L100,100 Z" fill="#ffffff" />
                <path d="M100,70 C70,40 50,90 20,60 C0,40 0,70 0,70 L0,100 L100,100 Z" fill="#ffffff" opacity="0.5" />
                <circle cx="80" cy="20" r="40" fill="transparent" stroke="#ffffff" strokeWidth="2" opacity="0.3" />
                <circle cx="20" cy="80" r="60" fill="transparent" stroke="#ffffff" strokeWidth="4" opacity="0.2" />
              </svg>
            </div>

            {/* Celular */}
            <div className="acme-phone-wrapper">
              {/* Sombra proyectada */}
              <div style={{
                position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
                width: '210px', height: '85%', background: '#000000',
                borderRadius: '40px', filter: 'blur(35px)', opacity: 0.35, zIndex: 0,
              }} />

              {/* Marco del celular */}
              <div style={{
                position: 'relative', width: '260px', height: '520px', background: '#f8f9fa',
                borderRadius: '40px', border: '12px solid #1c1c1e',
                zIndex: 1, overflow: 'hidden',
                boxShadow: 'inset 0 0 4px rgba(255,255,255,0.8), 0 20px 40px rgba(0,0,0,0.2)',
              }}>
                {/* Dynamic Island */}
                <div style={{
                  position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
                  width: '80px', height: '24px', background: '#000000', borderRadius: '12px', zIndex: 10
                }} />

                {/* Pantalla UI */}
                <div style={{ padding: '54px 20px 20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px', background: '#ffffff' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ width: '44px', height: '44px', background: '#ffebe0', borderRadius: '50%', border: '2px solid #ff6200' }} />
                    <div style={{ flex: 1, marginLeft: '12px' }}>
                      <div style={{ width: '60%', height: '8px', background: '#e0e0e0', borderRadius: '4px', marginBottom: '8px' }} />
                      <div style={{ width: '40%', height: '6px', background: '#f0f0f0', borderRadius: '3px' }} />
                    </div>
                  </div>

                  <div style={{ width: '100%', height: '42px', background: '#f5f6f8', borderRadius: '14px', border: '1px solid #eaeaea' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {['🍔', '🍕', '🌮', '☕'].map((ic, i) => (
                      <div key={i} style={{ width: '46px', height: '46px', background: '#ffffff', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                        {ic}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
                    {[1, 2, 3].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: '#ffffff', borderRadius: '18px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1px solid #f9f9f9' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: i === 0 ? 'linear-gradient(135deg, #ff8c00, #ff6200)' : '#f0f0f0', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ height: '8px', background: i === 0 ? '#111' : '#ccc', borderRadius: '4px', marginBottom: '8px', width: '75%' }} />
                          <div style={{ height: '6px', background: '#e0e0e0', borderRadius: '3px', width: '45%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
