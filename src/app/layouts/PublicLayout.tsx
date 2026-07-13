import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AppRoutes } from '../../core/constants/routes';
import headerLogo from '../../images/logo/acme-pedidos-off.png';
import footerLogo from '../../images/logo/acme-white.png';
import { usePublicStore } from '../../modules/public/store/PublicStoreContext';
import { MobileAppBanner } from '../components/MobileAppBanner';

function isActive(pathname: string, route: string) {
  return pathname === route;
}

export function PublicLayout() {
  const location = useLocation();
  const publicStore = usePublicStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openFooterSec, setOpenFooterSec] = useState<Record<string, boolean>>({});

  const toggleFooterSec = (sec: string) => {
    setOpenFooterSec(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  return (
    <div className="page-shell" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;900&family=Poppins:wght@400;500;600;800&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .acme-nav-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: .9rem;
          font-weight: 700;
          color: #5b4b78;
          text-decoration: none;
          padding: 9px 14px;
          border-radius: 999px;
          transition: background .18s, color .18s, border-color .18s;
          border: 1px solid transparent;
          white-space: nowrap;
        }

        .acme-nav-link:hover,
        .acme-nav-link.active {
          background: #f0e8ff;
          color: #4d148c !important;
          border-color: rgba(77, 20, 140, .12);
        }

        .acme-nav-portal {
          background: #ff6200 !important;
          color: #ffffff !important;
          border-color: rgba(255, 98, 0, .2) !important;
        }

        .acme-nav-portal:hover {
          background: #ff8533 !important;
        }

        .acme-cart-link {
          position: relative;
          width: 44px;
          height: 44px;
          padding: 0 !important;
          border-radius: 14px;
        }

        .acme-cart-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          border-radius: 999px;
          background: #ff6200;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 18px rgba(255,98,0,.35);
        }

        .acme-footer-top {
          background:
            radial-gradient(680px 320px at 100% 0%, rgba(255,255,255,.13), transparent 60%),
            radial-gradient(520px 280px at 0% 100%, rgba(77,20,140,.16), transparent 62%),
            linear-gradient(180deg, #ff8a1d 0%, #ff6b14 100%);
          color: #fff;
          padding: 58px 80px 50px;
        }

        .acme-footer-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1.25fr;
          gap: 48px;
          align-items: start;
        }

        .acme-footer-brand {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .acme-footer-logo {
          display: inline-flex;
          align-items: center;
        }

        .acme-footer-text {
          max-width: 360px;
          font-size: .96rem;
          line-height: 1.7;
          color: rgba(255,255,255,.92);
          margin: 0;
        }

        .acme-footer-social-title,
        .acme-footer-col-title {
          font-family: 'Poppins', sans-serif;
          font-weight: 800;
          font-size: 1.05rem;
          margin: 0 0 16px;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .acme-footer-col-btn {
          display: none;
          background: none;
          border: none;
          color: inherit;
          padding: 0;
          cursor: pointer;
          width: 100%;
          text-align: inherit;
        }

        .acme-footer-socials {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .acme-footer-social {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          color: #fff;
          background: rgba(255,255,255,.14);
          border: 1px solid rgba(255,255,255,.18);
          transition: transform .18s ease, background .18s ease;
          font-weight: 800;
          font-size: 1rem;
        }

        .acme-footer-social:hover {
          transform: translateY(-2px);
          background: rgba(255,255,255,.22);
        }

        .acme-footer-links {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .acme-footer-link {
          display: inline-flex;
          width: fit-content;
          color: rgba(255,255,255,.95);
          text-decoration: none;
          font-size: 1rem;
          font-weight: 600;
          padding: 8px 0;
          transition: opacity .18s ease, transform .18s ease;
        }

        .acme-footer-link:hover {
          opacity: .82;
          transform: translateX(3px);
        }

        /* Columna de contacto */
        .acme-footer-contact {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .acme-footer-contact-item {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: #fff;
          transition: transform .18s ease;
        }

        a.acme-footer-contact-item:hover { transform: translateX(3px); }

        .acme-footer-contact-ic {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,.15);
          border: 1px solid rgba(255,255,255,.20);
          flex-shrink: 0;
        }

        .acme-footer-contact-item > span:last-child {
          display: flex;
          flex-direction: column;
          line-height: 1.32;
          font-weight: 700;
          font-size: .95rem;
        }

        .acme-footer-contact-item small {
          font-size: .72rem;
          font-weight: 600;
          letter-spacing: .02em;
          color: rgba(255,255,255,.72);
        }

        .acme-footer-bottom {
          background: #070b34;
          color: rgba(255,255,255,.92);
          padding: 18px 80px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          flex-wrap: wrap;
        }

        .acme-powered-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: #fff;
          padding: 10px 18px;
          border-radius: 999px;
          font-weight: 800;
          font-size: .92rem;
          background: linear-gradient(135deg, #4d148c 0%, #6f2dbd 100%);
          box-shadow: 0 8px 24px rgba(77,20,140,.35);
          border: 1px solid rgba(255,255,255,.08);
          transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease;
        }

        .acme-powered-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(77,20,140,.45);
          opacity: .97;
        }

        /* ==== MOBILE DRAWER ==== */
        .acme-mobile-menu-btn {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: #1a0a2e;
          padding: 8px;
          border-radius: 8px;
          line-height: 0;
        }
        .acme-mobile-menu-btn:hover { background: rgba(77,20,140,0.06); }

        .acme-mobile-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(4px);
          z-index: 998;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        .acme-mobile-overlay.open { opacity: 1; visibility: visible; }

        /* Drawer slides from the RIGHT edge inward */
        .acme-mobile-drawer {
          position: fixed;
          top: 0;
          right: 0;
          width: min(320px, 85vw);
          height: 100dvh;
          height: 100vh;
          background: #fff;
          z-index: 999;
          box-shadow: -15px 0 50px rgba(0,0,0,0.12);
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
          border-radius: 32px 0 0 0;
        }
        .acme-mobile-drawer.open { transform: translateX(0); }

        .acme-mobile-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          border-bottom: 1px solid #f0e8ff;
          flex-shrink: 0;
        }
        .acme-mobile-drawer-header img { height: 36px; object-fit: contain; }

        .acme-mobile-drawer-close {
          width: 38px; height: 38px;
          border-radius: 10px;
          background: #f0e8ff;
          border: none;
          cursor: pointer;
          color: #4d148c;
          font-size: 22px;
          display: flex; align-items: center; justify-content: center;
          line-height: 1;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .acme-mobile-drawer-close:hover { background: #e0d0ff; }

        .acme-mobile-drawer-content {
          padding: 16px 16px 32px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow-y: auto;
          flex: 1;
        }

        .acme-mobile-nav-link {
          display: block;
          font-size: 1.05rem;
          font-weight: 700;
          color: #1a0a2e;
          text-decoration: none;
          padding: 13px 16px;
          border-radius: 12px;
          transition: background 0.18s, color 0.18s;
        }
        .acme-mobile-nav-link:hover { background: #f5f0ff; color: #4d148c; }
        .acme-mobile-nav-link.active { background: #f0e8ff; color: #4d148c; }

        .acme-mobile-divider {
          height: 1px;
          background: #f0e8ff;
          margin: 8px 0;
        }

        /* ==== RESPONSIVE BREAKPOINTS ==== */
        @media (max-width: 1180px) {
          .public-header-shell {
            height: auto !important;
            padding: 10px 16px !important;
          }
          .public-header-nav { display: none !important; }
          .public-header-actions > .acme-nav-link:not(.acme-cart-link) { display: none !important; }
          .acme-mobile-menu-btn { display: flex !important; }
          .public-header-actions { margin-left: auto; }
        }

        @media (max-width: 980px) {
          .acme-footer-top { padding: 44px 28px 38px; }
          .acme-footer-bottom { padding: 16px 28px; justify-content: center; }
          .acme-footer-grid { grid-template-columns: 1fr; gap: 40px; }
          .acme-footer-brand .acme-footer-text,
          .acme-footer-col-title { text-align: center; margin-left: auto; margin-right: auto; }
          .acme-footer-socials { justify-content: center; }
          .acme-footer-links { align-items: center; }
          .acme-footer-logo { justify-content: center; display: flex; }
          .acme-footer-contact { align-items: center; }
          .acme-footer-contact-item { text-align: left; }
          
          /* Footer Accordion Mobile Styling */
          .acme-footer-col-btn { display: flex !important; }
          .acme-footer-links {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease, margin 0.3s ease;
            gap: 4px;
            margin-top: 0;
            width: 100%;
          }
          .acme-footer-links.is-open {
            max-height: 400px;
            margin-top: 10px;
          }
          .acme-footer-col-title {
            padding: 12px 0;
            margin-bottom: 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
          }
          .acme-footer-col-arrow {
            transition: transform 0.3s ease;
          }
          .acme-footer-col-arrow.is-open {
            transform: rotate(180deg);
          }
        }

        @media (max-width: 640px) {
          .public-header-shell {
            margin: 0 10px !important;
            max-width: calc(100vw - 20px) !important;
          }
          .acme-powered-btn { width: 100%; justify-content: center; }
        }
      `}</style>

      <header
        className="public-header-shell"
        style={{
          position: 'fixed',
          top: '10px',
          left: '8px',
          right: '8px',
          zIndex: 100,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(12px)',
          borderRadius: '20px',
          border: '1px solid var(--acme-border)',
          padding: '0 22px',
          height: '66px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: 'var(--acme-shadow-md)',
          gap: '14px',
        }}
      >
        <Link to={AppRoutes.public.home} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
          <img src={headerLogo} alt="ACME Logo" style={{ height: '42px' }} />
        </Link>

        <nav className="public-header-nav" style={{ display: 'flex', gap: '6px', alignItems: 'center', minWidth: 0, flex: 1 }}>
          <Link to={AppRoutes.public.home} className={`acme-nav-link${isActive(location.pathname, AppRoutes.public.home) ? ' active' : ''}`}>Inicio</Link>
          <Link to={AppRoutes.public.howItWorks} className={`acme-nav-link${isActive(location.pathname, AppRoutes.public.howItWorks) ? ' active' : ''}`}>Como funciona</Link>
          <Link to={AppRoutes.public.marketplace} className={`acme-nav-link${isActive(location.pathname, AppRoutes.public.marketplace) ? ' active' : ''}`}>Pide ahora</Link>
          <Link to={AppRoutes.public.businesses} className={`acme-nav-link${isActive(location.pathname, AppRoutes.public.businesses) ? ' active' : ''}`}>Para negocios</Link>
          <Link to={AppRoutes.public.hazteDriver} className={`acme-nav-link${isActive(location.pathname, AppRoutes.public.hazteDriver) ? ' active' : ''}`}>HAZTE DRIVER</Link>
          <Link to={AppRoutes.public.contact} className={`acme-nav-link${isActive(location.pathname, AppRoutes.public.contact) ? ' active' : ''}`}>Contacto</Link>
        </nav>

        <div className="public-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <Link
            to={AppRoutes.public.cart}
            className={`acme-nav-link acme-cart-link${isActive(location.pathname, AppRoutes.public.cart) ? ' active' : ''}`}
            aria-label={`Carrito${publicStore.cartCount > 0 ? ` con ${publicStore.cartCount} productos` : ''}`}
            title="Carrito"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 5h2l2.1 8.2a1 1 0 0 0 .97.75h8.76a1 1 0 0 0 .97-.76L20 7H7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10" cy="19" r="1.5" fill="currentColor" />
              <circle cx="17" cy="19" r="1.5" fill="currentColor" />
            </svg>
            {publicStore.cartCount > 0 ? <span className="acme-cart-badge">{publicStore.cartCount}</span> : null}
          </Link>

          <Link to={AppRoutes.public.account} className={`acme-nav-link${isActive(location.pathname, AppRoutes.public.account) ? ' active' : ''}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            {publicStore.sessionUser ? 'Mi cuenta' : 'Ingreso'}
          </Link>

          <Link to={AppRoutes.public.portalLogin} className="acme-nav-link acme-nav-portal">
            Portal para locales
          </Link>

          <button className="acme-mobile-menu-btn" onClick={() => setIsMenuOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </header>

      <div className={`acme-mobile-overlay${isMenuOpen ? ' open' : ''}`} onClick={() => setIsMenuOpen(false)} />
      <div className={`acme-mobile-drawer${isMenuOpen ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label="Menú de navegación">
        <div className="acme-mobile-drawer-header">
          <img src={headerLogo} alt="ACME Logo" />
          <button className="acme-mobile-drawer-close" onClick={() => setIsMenuOpen(false)} aria-label="Cerrar menú">✕</button>
        </div>
        <div className="acme-mobile-drawer-content">
          <Link to={AppRoutes.public.home} className={`acme-mobile-nav-link${isActive(location.pathname, AppRoutes.public.home) ? ' active' : ''}`}>Inicio</Link>
          <Link to={AppRoutes.public.howItWorks} className={`acme-mobile-nav-link${isActive(location.pathname, AppRoutes.public.howItWorks) ? ' active' : ''}`}>Como funciona</Link>
          <Link to={AppRoutes.public.marketplace} className={`acme-mobile-nav-link${isActive(location.pathname, AppRoutes.public.marketplace) ? ' active' : ''}`}>Pide ahora</Link>
          <Link to={AppRoutes.public.businesses} className={`acme-mobile-nav-link${isActive(location.pathname, AppRoutes.public.businesses) ? ' active' : ''}`}>Para negocios</Link>
          <Link to={AppRoutes.public.hazteDriver} className={`acme-mobile-nav-link${isActive(location.pathname, AppRoutes.public.hazteDriver) ? ' active' : ''}`}>HAZTE DRIVER</Link>
          <Link to={AppRoutes.public.contact} className={`acme-mobile-nav-link${isActive(location.pathname, AppRoutes.public.contact) ? ' active' : ''}`}>Contacto</Link>
          
          <Link to={AppRoutes.public.account} className={`acme-mobile-nav-link${isActive(location.pathname, AppRoutes.public.account) ? ' active' : ''}`}>
            {publicStore.sessionUser ? 'Mi cuenta' : 'Ingreso'}
          </Link>
          <Link
            to={AppRoutes.public.portalLogin}
            className="acme-mobile-nav-link"
            style={{ 
              background: '#ff6200', 
              color: '#fff', 
              textAlign: 'center', 
              marginTop: '4px', 
              borderRadius: '14px',
              width: 'fit-content',
              padding: '10px 24px'
            }}
          >
            Portal para locales
          </Link>

          <div className="acme-mobile-divider" style={{ margin: '6px 0' }} />

          {/* Botones de Descarga en Menú Móvil */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 8px' }}>
            <Link to={AppRoutes.public.marketplace} style={{
              display: 'flex', alignItems: 'center', gap: '12px', background: '#000000', color: '#ffffff',
              padding: '10px 18px', borderRadius: '16px', textDecoration: 'none', width: 'fit-content'
            }}>
              <svg width="22" height="22" viewBox="0 0 512 512" fill="currentColor">
                <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
              </svg>
              <div>
                <div style={{ fontSize: '8px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Disponible en</div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>Google Play</div>
              </div>
            </Link>

            <Link to={AppRoutes.public.marketplace} style={{
              display: 'flex', alignItems: 'center', gap: '12px', background: '#000000', color: '#ffffff',
              padding: '10px 18px', borderRadius: '16px', textDecoration: 'none', width: 'fit-content'
            }}>
              <svg width="22" height="22" viewBox="0 0 384 512" fill="currentColor">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
              </svg>
              <div>
                <div style={{ fontSize: '8px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Consíguelo en el</div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>App Store</div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      <main>
        <Outlet />
      </main>

      <MobileAppBanner />

      <footer>
        <div className="acme-footer-top">
          <div className="acme-footer-grid">
            <div className="acme-footer-brand">
              <Link to={AppRoutes.public.home} className="acme-footer-logo">
                <img src={footerLogo} alt="ACME Footer Logo" style={{ height: '50px' }} />
              </Link>
              <p className="acme-footer-text">
                Soluciones de delivery y gestion para negocios que quieren vender mas,
                operar mejor y ofrecer una experiencia moderna a sus clientes.
              </p>
              <div>
                <h4 className="acme-footer-social-title">Síguenos en redes</h4>
                <div className="acme-footer-socials">
                  <a href="#" className="acme-footer-social" aria-label="Facebook">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </a>
                  <a href="#" className="acme-footer-social" aria-label="Instagram">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>
                  </a>
                  <a href="#" className="acme-footer-social" aria-label="WhatsApp">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                  </a>
                  <a href="#" className="acme-footer-social" aria-label="TikTok">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.1v12.45a2.6 2.6 0 1 1-2.6-2.6c.27 0 .53.04.78.12v-3.17a5.73 5.73 0 0 0-.78-.05 5.72 5.72 0 1 0 5.72 5.72V8.9a7.35 7.35 0 0 0 4.3 1.38V7.18a4.3 4.3 0 0 1-3.27-1.36z"/></svg>
                  </a>
                </div>
              </div>
            </div>

            <div>
              <button className="acme-footer-col-btn" onClick={() => toggleFooterSec('explora')}>
                <h4 className="acme-footer-col-title">
                  Explora
                  <span className={`acme-footer-col-arrow${openFooterSec['explora'] ? ' is-open' : ''}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </span>
                </h4>
              </button>
              <div className={`acme-footer-links${openFooterSec['explora'] ? ' is-open' : ''}`}>
                <Link to={AppRoutes.public.home} className="acme-footer-link">Inicio</Link>
                <Link to={AppRoutes.public.howItWorks} className="acme-footer-link">Como funciona</Link>
                <Link to={AppRoutes.public.marketplace} className="acme-footer-link">Pide ahora</Link>
                <Link to={AppRoutes.public.businesses} className="acme-footer-link">Para negocios</Link>
              </div>
            </div>

            <div>
              <button className="acme-footer-col-btn" onClick={() => toggleFooterSec('accesos')}>
                <h4 className="acme-footer-col-title">
                  Accesos
                  <span className={`acme-footer-col-arrow${openFooterSec['accesos'] ? ' is-open' : ''}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </span>
                </h4>
              </button>
              <div className={`acme-footer-links${openFooterSec['accesos'] ? ' is-open' : ''}`}>
                <Link to={AppRoutes.public.hazteDriver} className="acme-footer-link">HAZTE DRIVER</Link>
                <Link to={AppRoutes.public.contact} className="acme-footer-link">Contacto</Link>
                <Link to={AppRoutes.public.cart} className="acme-footer-link">Carrito</Link>
                <Link to={AppRoutes.public.account} className="acme-footer-link">Mi cuenta</Link>
                <Link to={AppRoutes.public.portalLogin} className="acme-footer-link">Portal para locales</Link>
              </div>
            </div>

            <div className="acme-footer-contact-col">
              <h4 className="acme-footer-col-title">Contacto</h4>
              <div className="acme-footer-contact">
                <a className="acme-footer-contact-item" href="mailto:soporte@acme.pe">
                  <span className="acme-footer-contact-ic">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="3.5"/><path d="m3.5 7.5 7.3 5.1a2 2 0 0 0 2.4 0l7.3-5.1"/></svg>
                  </span>
                  <span><small>Escríbenos</small>soporte@acme.pe</span>
                </a>
                <a className="acme-footer-contact-item" href="https://wa.me/51967000000" target="_blank" rel="noopener noreferrer">
                  <span className="acme-footer-contact-ic">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 3h-2A1.5 1.5 0 0 0 3 4.6C3 13 11 21 19.4 21A1.5 1.5 0 0 0 21 19.5v-2a1.5 1.5 0 0 0-1.2-1.47l-2.5-.5a1.5 1.5 0 0 0-1.5.6l-.6.8a12.5 12.5 0 0 1-5.6-5.6l.8-.6a1.5 1.5 0 0 0 .6-1.5l-.5-2.5A1.5 1.5 0 0 0 6.5 3z"/></svg>
                  </span>
                  <span><small>WhatsApp / Llamada</small>+51 967 000 000</span>
                </a>
                <div className="acme-footer-contact-item acme-footer-contact-item--static">
                  <span className="acme-footer-contact-ic">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10.5c0 5.8-6.4 10.8-8 12-1.6-1.2-8-6.2-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10.5" r="2.7"/></svg>
                  </span>
                  <span><small>Ubicación</small>Huancavelica, Perú</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="acme-footer-bottom">
          <span>© Copyright 2026 Acme Pedidos. Todos los derechos reservados.</span>
          <a
            href="https://accuracynexus.kesug.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="acme-powered-btn"
          >
            Powered by Accuracy Nexus
          </a>
        </div>
      </footer>
    </div>
  );
}
