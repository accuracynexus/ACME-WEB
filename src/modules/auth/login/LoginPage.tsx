import { FormEvent, useContext, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppRoutes } from '../../../core/constants/routes';
import { resolvePortalLandingRoute } from '../../../core/auth/portalLanding';
import { PortalContext } from '../session/PortalContext';
import { authService } from '../../../core/services/authService';
import { supabase } from '../../../integrations/supabase/client';
import { INTERNAL_EMAIL_PLACEHOLDER } from '../../../core/auth/internalEmail';
import './LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const portal = useContext(PortalContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [magicSent, setMagicSent] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);

  const [searchParams] = useSearchParams();
  const defaultPortalRoute = resolvePortalLandingRoute(portal);

  useEffect(() => {
    const redirectTo = searchParams.get('redirect') || defaultPortalRoute;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate(redirectTo);
    };
    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) navigate(redirectTo);
    });

    return () => listener.subscription?.unsubscribe();
  }, [defaultPortalRoute, navigate, searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setRecoverySent(false);
    setLoading(true);

    if (mode === 'password') {
      const result = await portal.signIn(email, password);
      setLoading(false);
      if (result?.error) {
        setError(result.error.message ?? 'No se pudo iniciar sesión con contraseña');
        return;
      }

      const redirectTo = searchParams.get('redirect') || defaultPortalRoute;
      navigate(redirectTo);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({ 
      email,
      options: {
        // El portal no crea cuentas: negocios, personal y admins reciben su correo @acmedidos.com desde plataforma.
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}${searchParams.get('redirect') || defaultPortalRoute}`
      }
    });
    setLoading(false);
    if (error) {
      setError(error.message ?? 'No se pudo enviar el correo de verificación');
      return;
    }

    setMagicSent(true);
  };

  const handlePasswordRecovery = async () => {
    if (!email.trim()) {
      setError('Ingresa el correo del usuario para enviar la recuperación.');
      return;
    }

    setLoading(true);
    setError(null);
    setMagicSent(false);

    const result = await authService.requestPasswordRecovery(
      email.trim(),
      `${window.location.origin}${AppRoutes.public.portalPasswordRecovery}`
    );

    setLoading(false);
    if (result.error) {
      setError(result.error.message ?? 'No se pudo enviar el correo de recuperación');
      return;
    }

    setRecoverySent(true);
  };

  const StoreIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  );

  const MailIconLarge = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
      <polyline points="22 6 12 13 2 6"></polyline>
    </svg>
  );

  const MailIconSmall = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
      <polyline points="22 6 12 13 2 6"></polyline>
    </svg>
  );

  const LockIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  );

  const AlertCircleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  );

  if (magicSent || recoverySent) {
    return (
      <main className="login-page">
        <div className="login-container">
          <div className="login-card login-success">
            <div className="login-success__icon">
              <MailIconLarge />
            </div>
            <h2 className="login-success__title">Revisa tu correo</h2>
            <p className="login-success__text">
              Hemos enviado un enlace de verificación a{' '}
              <span className="login-email-badge">{email}</span>.
              Haz clic en él para acceder al portal de administración.
            </p>
            
            <div className="login-info-box" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
              <p style={{ margin: 0 }}>
                ¿No lo recibiste? Revisa tu carpeta de spam o contacta al soporte técnico.
              </p>
            </div>

            <button
              className="login-back-btn"
              onClick={() => {
                setMagicSent(false);
                setRecoverySent(false);
              }}
            >
              Volver al formulario
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="login-page">
      <div className="login-container">
        <header className="login-header">
          <div className="login-header__icon">
            <StoreIcon />
          </div>
          <h1 className="login-header__title">Portal Administrativo</h1>
          <p className="login-header__subtitle">
            Acceso exclusivo para establecimientos y personal autorizado.
          </p>
        </header>

        <div className="login-card">
          <div className="login-mode-toggle">
            <button
              type="button"
              className={`login-mode-btn ${mode === 'password' ? 'login-mode-btn--active' : ''}`}
              onClick={() => {
                setMode('password');
                setError(null);
                setRecoverySent(false);
              }}
            >
              Contraseña
            </button>
            <button
              type="button"
              className={`login-mode-btn ${mode === 'magic' ? 'login-mode-btn--active' : ''}`}
              onClick={() => {
                setMode('magic');
                setError(null);
                setRecoverySent(false);
              }}
            >
              Verificar correo
            </button>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label className="login-field__label">Correo electrónico</label>
              <div className="login-input-wrapper">
                <input
                  type="email"
                  className="login-input"
                  placeholder={INTERNAL_EMAIL_PLACEHOLDER}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <div className="login-input-icon">
                  <MailIconSmall />
                </div>
              </div>
            </div>

            {mode === 'password' ? (
              <>
                <div className="login-field">
                  <label className="login-field__label">Contraseña</label>
                  <div className="login-input-wrapper">
                    <input
                      type="password"
                      className="login-input"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <div className="login-input-icon">
                      <LockIcon />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="login-recovery-link"
                  onClick={handlePasswordRecovery}
                  disabled={loading}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </>
            ) : (
              <div className="login-info-box">
                Te enviaremos un correo con un acceso directo para que no tengas que recordar tu contraseña.
              </div>
            )}

            {error && (
              <div className="login-error">
                <AlertCircleIcon />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading && <div className="spinner" />}
              <span>
                {loading
                  ? mode === 'password' ? 'Validando...' : 'Enviando...'
                  : mode === 'password' ? 'Iniciar Sesión' : 'Enviar Link'}
              </span>
            </button>
          </form>
        </div>

        <p className="login-footer-text">
          ACME Pedidos &copy; {new Date().getFullYear()} &bull; Todos los derechos reservados.
        </p>
      </div>
    </main>
  );
}
