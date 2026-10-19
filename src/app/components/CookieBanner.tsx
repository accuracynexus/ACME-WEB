import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppRoutes } from '../../core/constants/routes';
import { saveCookieConsent, useCookieConsent } from '../../core/consent/cookieConsent';

/**
 * Aviso de cookies. Sale hasta que la persona elige; "Rechazar" debe ser tan
 * facil como "Aceptar", y las categorias opcionales arrancan apagadas.
 */
export function CookieBanner() {
  const { consent, settingsRequested } = useCookieConsent();
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (settingsRequested === 0) return;
    setAnalytics(consent?.analytics ?? false);
    setMarketing(consent?.marketing ?? false);
    setShowSettings(true);
    // Solo reacciona a una nueva peticion de abrir el panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsRequested]);

  if (consent && !showSettings) return null;

  const decide = (choice: { analytics: boolean; marketing: boolean }) => {
    saveCookieConsent(choice);
    setShowSettings(false);
  };

  return (
    <div className="cookie-banner" role="dialog" aria-modal="false" aria-labelledby="cookie-banner-title">
      <style>{`
        .cookie-banner {
          position: fixed;
          left: 16px;
          right: 16px;
          bottom: 16px;
          z-index: 300;
          max-width: 560px;
          background: #fff;
          color: var(--acme-navy, #0f172a);
          border: 1px solid var(--acme-border, #e2e8f0);
          border-radius: 18px;
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.22);
          padding: 18px 18px 16px;
          font-size: 14px;
          line-height: 1.55;
        }
        .cookie-banner h2 {
          font-size: 16px;
          font-weight: 800;
          margin: 0 0 6px;
        }
        .cookie-banner p { margin: 0 0 12px; color: #475569; }
        .cookie-banner a { color: var(--acme-purple, #4d148c); font-weight: 700; }
        .cookie-banner__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .cookie-banner__btn {
          flex: 1 1 140px;
          border-radius: 12px;
          padding: 10px 14px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          border: 1px solid var(--acme-purple, #4d148c);
          background: #fff;
          color: var(--acme-purple, #4d148c);
        }
        .cookie-banner__btn--primary {
          background: var(--acme-purple, #4d148c);
          color: #fff;
        }
        .cookie-banner__btn--link {
          flex: 0 0 auto;
          border-color: transparent;
          text-decoration: underline;
        }
        .cookie-banner__options {
          display: grid;
          gap: 10px;
          margin: 0 0 14px;
        }
        .cookie-banner__option {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 10px 12px;
          border: 1px solid var(--acme-border, #e2e8f0);
          border-radius: 12px;
        }
        .cookie-banner__option input { margin-top: 4px; accent-color: var(--acme-purple, #4d148c); }
        .cookie-banner__option strong { display: block; }
        .cookie-banner__option small { color: #64748b; }
      `}</style>

      <h2 id="cookie-banner-title">Usamos cookies</h2>
      <p>
        Usamos cookies y almacenamiento del navegador necesarios para mantener tu sesión, tu
        carrito y procesar pagos de forma segura. Las cookies opcionales de analítica y
        publicidad solo se activan si las aceptas. Más detalle en nuestra{' '}
        <Link to={AppRoutes.public.cookies}>Política de cookies</Link>.
      </p>

      {showSettings && (
        <div className="cookie-banner__options">
          <label className="cookie-banner__option">
            <input type="checkbox" checked disabled />
            <span>
              <strong>Necesarias (siempre activas)</strong>
              <small>Sesión, carrito, seguridad y pagos. Sin ellas la tienda no funciona.</small>
            </span>
          </label>
          <label className="cookie-banner__option">
            <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
            <span>
              <strong>Analítica</strong>
              <small>Nos ayudan a medir cómo se usa la web para mejorarla.</small>
            </span>
          </label>
          <label className="cookie-banner__option">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            <span>
              <strong>Publicidad</strong>
              <small>Permiten mostrarte promociones relevantes en otros sitios.</small>
            </span>
          </label>
        </div>
      )}

      <div className="cookie-banner__actions">
        {showSettings ? (
          <button
            type="button"
            className="cookie-banner__btn cookie-banner__btn--primary"
            onClick={() => decide({ analytics, marketing })}
          >
            Guardar preferencias
          </button>
        ) : (
          <>
            <button
              type="button"
              className="cookie-banner__btn"
              onClick={() => decide({ analytics: false, marketing: false })}
            >
              Solo necesarias
            </button>
            <button
              type="button"
              className="cookie-banner__btn cookie-banner__btn--primary"
              onClick={() => decide({ analytics: true, marketing: true })}
            >
              Aceptar todas
            </button>
            <button
              type="button"
              className="cookie-banner__btn cookie-banner__btn--link"
              onClick={() => setShowSettings(true)}
            >
              Configurar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
