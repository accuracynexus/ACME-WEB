import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import logo from '../../../images/logo/acme-pedidos-off.png';
import './BetasPage.css';

/* ——— Iconos ——————————————————————————————————— */

const iconProps = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function BagIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function ScooterIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M15 17.5H9" />
      <path d="M5.5 17.5 9 6h3" />
      <path d="M12 6h4l2.5 11.5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/* ——— Configuracion de cada beta —————————————————————— */

interface BetaApp {
  id: 'cliente' | 'driver';
  cardTitle: string;
  cardText: string;
  panelTitle: string;
  panelText: string;
  password: string;
  downloadUrl: string;
  icon: ReactNode;
  accent: CSSProperties;
}

const BETA_APPS: BetaApp[] = [
  {
    id: 'cliente',
    cardTitle: 'Soy cliente',
    cardText: 'La app para pedir a restaurantes, farmacias y tiendas de Huancavelica.',
    panelTitle: 'Beta — App Cliente',
    panelText: 'Ingresa la clave que te compartimos para acceder a la descarga.',
    password: 'acme-cliente-2026',
    downloadUrl: 'https://drive.google.com/file/d/1CE-RVJ0r2n-WHEpMFaxzUR64Bjpa5ef0/view?usp=sharing',
    icon: <BagIcon />,
    accent: {
      '--betas-accent': '#ff6200',
      '--betas-accent-deep': '#e04e00',
      '--betas-accent-soft': 'rgba(255, 98, 0, 0.16)',
      '--betas-accent-line': 'rgba(255, 98, 0, 0.4)',
    } as CSSProperties,
  },
  {
    id: 'driver',
    cardTitle: 'Soy repartidor',
    cardText: 'La app para recibir pedidos, seguir rutas y registrar tus entregas.',
    panelTitle: 'Beta — App Repartidor',
    panelText: 'Ingresa la clave que te compartimos para acceder a la descarga.',
    password: 'acme-driver-2026',
    downloadUrl: 'https://drive.google.com/file/d/1if_dufyTsolDdCQHxT9lxzI3qLv3sXPS/view?usp=sharing',
    icon: <ScooterIcon />,
    accent: {
      '--betas-accent': '#8b5cf6',
      '--betas-accent-deep': '#6d28d9',
      '--betas-accent-soft': 'rgba(139, 92, 246, 0.16)',
      '--betas-accent-line': 'rgba(139, 92, 246, 0.4)',
    } as CSSProperties,
  },
];

/* ——— Pagina ——————————————————————————————————— */

export function BetasPage() {
  const [selectedId, setSelectedId] = useState<BetaApp['id'] | null>(null);
  const [input, setInput] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [failed, setFailed] = useState(false);

  const selected = useMemo(() => BETA_APPS.find((app) => app.id === selectedId) ?? null, [selectedId]);

  // Pagina no listada: que no la indexen los buscadores.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    const previousTitle = document.title;
    document.title = 'ACME — Programa beta';

    return () => {
      document.head.removeChild(meta);
      document.title = previousTitle;
    };
  }, []);

  const choose = (app: BetaApp) => {
    setSelectedId(app.id);
    setInput('');
    setUnlocked(false);
    setFailed(false);
  };

  const reset = () => {
    setSelectedId(null);
    setInput('');
    setUnlocked(false);
    setFailed(false);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    // Tolerante al copiar y pegar desde WhatsApp: sin espacios y sin mayusculas.
    if (input.trim().toLowerCase() === selected.password) {
      setUnlocked(true);
      setFailed(false);
      return;
    }
    setFailed(true);
  };

  return (
    <div className="betas-page">
      <div className="betas-aurora" aria-hidden="true" />
      <div className="betas-grid" aria-hidden="true" />

      <main className="betas-shell">
        <img className="betas-logo" src={logo} alt="ACME Pedidos" />

        <span className="betas-badge">
          <span className="betas-badge__dot" />
          Acceso privado
        </span>

        <div style={{ display: 'grid', gap: '14px', justifyItems: 'center' }}>
          <h1 className="betas-title">
            Programa <span>beta</span>
          </h1>
          <p className="betas-lead">
            Estas probando ACME antes que nadie. Elige tu perfil e ingresa la clave que te compartimos
            para descargar la aplicacion.
          </p>
        </div>

        {/* Paso 1 — eleccion de perfil */}
        {!selected && (
          <div className="betas-choices">
            {BETA_APPS.map((app) => (
              <button key={app.id} type="button" className="betas-card" style={app.accent} onClick={() => choose(app)}>
                <span className="betas-card__icon">{app.icon}</span>
                <span className="betas-card__title">{app.cardTitle}</span>
                <span className="betas-card__text">{app.cardText}</span>
                <span className="betas-card__cue">
                  Continuar <ArrowIcon />
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Paso 2 — clave. Paso 3 — descarga */}
        {selected && (
          <div className="betas-panel" style={selected.accent}>
            <span className="betas-panel__icon">{selected.icon}</span>

            {!unlocked ? (
              <>
                <h2 className="betas-panel__title">{selected.panelTitle}</h2>
                <p className="betas-panel__text">{selected.panelText}</p>

                <form className="betas-form" onSubmit={submit}>
                  <input
                    className={`betas-input ${failed ? 'betas-input--error' : ''}`}
                    type="password"
                    value={input}
                    autoFocus
                    autoComplete="off"
                    placeholder="Clave de acceso"
                    aria-label="Clave de acceso"
                    aria-invalid={failed}
                    onChange={(event) => {
                      setInput(event.target.value);
                      if (failed) setFailed(false);
                    }}
                  />

                  {failed && (
                    <span className="betas-error" role="alert">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      Clave incorrecta. Revisa e intenta de nuevo.
                    </span>
                  )}

                  <button type="submit" className="betas-btn">
                    Desbloquear descarga
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="betas-unlocked">
                  <span className="betas-unlocked__check">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                </div>

                <h2 className="betas-panel__title">Acceso confirmado</h2>
                <p className="betas-panel__text">Ya puedes descargar la version beta.</p>

                <a className="betas-btn" href={selected.downloadUrl} target="_blank" rel="noopener noreferrer">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Descargar APK
                </a>

                <div className="betas-steps">
                  <span className="betas-steps__title">Como instalarla</span>
                  <ol>
                    <li>Descarga el archivo desde Google Drive.</li>
                    <li>Abrelo y acepta instalar desde origenes desconocidos si Android lo pide.</li>
                    <li>Instala y abre ACME. Si algo falla, escribenos.</li>
                  </ol>
                </div>
              </>
            )}

            <button type="button" className="betas-back" onClick={reset}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Cambiar de perfil
            </button>
          </div>
        )}

        <span className="betas-foot">ACME Pedidos — Huancavelica</span>
      </main>
    </div>
  );
}
