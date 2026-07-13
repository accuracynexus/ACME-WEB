import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppRoutes } from '../../core/constants/routes';

const VISIBLE_ROUTES: string[] = [AppRoutes.public.marketplace, AppRoutes.public.cart];

export function MobileAppBanner() {
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !VISIBLE_ROUTES.includes(location.pathname)) return null;

  return (
    <div className="mobile-app-banner" role="dialog" aria-label="Descarga la app de ACME">
      <style>{`
        .mobile-app-banner {
          display: none;
          position: fixed;
          left: 12px;
          right: 12px;
          bottom: 14px;
          z-index: 250;
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 14px 38px rgba(26,10,46,0.22);
          border: 1px solid rgba(77,20,140,0.1);
          padding: 16px 16px 14px;
        }

        .mobile-app-banner__close {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 26px;
          height: 26px;
          border-radius: 999px;
          border: none;
          background: #f0e8ff;
          color: #4d148c;
          font-size: 14px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .mobile-app-banner__text {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-right: 32px;
          margin-bottom: 12px;
        }

        .mobile-app-banner__text strong {
          font-family: 'Poppins', sans-serif;
          font-size: 0.92rem;
          line-height: 1.3;
          color: #1a0a2e;
        }

        .mobile-app-banner__text span {
          font-size: 0.82rem;
          color: #5b4b78;
          line-height: 1.4;
        }

        .mobile-app-banner__actions {
          display: flex;
          gap: 10px;
        }

        .mobile-app-banner__btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #000000;
          color: #ffffff;
          padding: 9px 10px;
          border-radius: 14px;
          text-decoration: none;
        }

        .mobile-app-banner__btn-label {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
        }

        .mobile-app-banner__btn-label small {
          font-size: 7px;
          opacity: 0.75;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .mobile-app-banner__btn-label span {
          font-size: 12px;
          font-weight: 700;
        }

        @media (max-width: 640px) {
          .mobile-app-banner { display: block; }
        }
      `}</style>

      <button className="mobile-app-banner__close" onClick={() => setDismissed(true)} aria-label="Cerrar aviso">✕</button>

      <div className="mobile-app-banner__text">
        <strong>¡Ya estamos disponibles para Android y iOS!</strong>
        <span>Descarga la app y encuentra descuentos y promociones únicas solo para usuarios de la aplicación.</span>
      </div>

      <div className="mobile-app-banner__actions">
        <a href="#" className="mobile-app-banner__btn" aria-label="Descargar en Google Play">
          <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor">
            <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
          </svg>
          <span className="mobile-app-banner__btn-label">
            <small>Disponible en</small>
            <span>Google Play</span>
          </span>
        </a>

        <a href="#" className="mobile-app-banner__btn" aria-label="Descargar en App Store">
          <svg width="18" height="18" viewBox="0 0 384 512" fill="currentColor">
            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
          </svg>
          <span className="mobile-app-banner__btn-label">
            <small>Consíguelo en el</small>
            <span>App Store</span>
          </span>
        </a>
      </div>
    </div>
  );
}
