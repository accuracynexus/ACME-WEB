import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppRoutes } from '../../../core/constants/routes';
import { courierPaymentService } from '../../../core/services/courierPaymentService';
import { LEGAL_TEXTS_VERSION } from '../../../core/services/publicCustomerService';
import { supabase } from '../../../integrations/supabase/client';

interface GuestCheckoutCardProps {
  /** Se llama cuando la sesion de invitado ya esta activa, con los datos para la entrega. */
  onStarted: (data: { nombre: string; telefono: string }) => void;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * Reemplaza el "Acceso requerido" del carrito: se puede pagar como invitado
 * (nombre, celular y correo) o entrar con Google en un toque. Quien ya tiene
 * cuenta puede ingresar con su contrasena.
 */
export function GuestCheckoutCard({ onStarted }: GuestCheckoutCardProps) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const phoneDigits = telefono.replace(/\D/g, '').replace(/^51(?=9\d{8}$)/, '');
  const valid = nombre.trim().length >= 2 && /^9\d{8}$/.test(phoneDigits) && EMAIL_RE.test(email.trim()) && acepta;
  const loginLink = `${AppRoutes.public.account}?redirect=${encodeURIComponent(AppRoutes.public.cart)}`;

  const continueAsGuest = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setNeedsLogin(false);
    try {
      await courierPaymentService.startGuestSession({
        email: email.trim(),
        nombre: nombre.trim(),
        telefono: phoneDigits,
        acepta_terminos: acepta,
        version_textos_legales: LEGAL_TEXTS_VERSION,
      });
      onStarted({ nombre: nombre.trim(), telefono: phoneDigits });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No pudimos continuar. Intenta de nuevo.';
      setNeedsLogin(/ya tiene una cuenta/i.test(message));
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${AppRoutes.public.cart}` },
    });
    if (oauthError) setError('No pudimos abrir Google. Intenta con tus datos.');
  };

  return (
    <section className="account-card guest-card">
      <h2 className="guest-card__title">¿A nombre de quién va el pedido?</h2>
      <p className="guest-card__lead">No necesitas crear una cuenta. Con estos datos te avisamos del pedido y te enviamos el comprobante.</p>

      <button type="button" className="guest-card__google" onClick={() => void continueWithGoogle()}>
        <GoogleIcon /> Continuar con Google
      </button>

      <div className="guest-card__divider"><span>o con tus datos</span></div>

      <div className="guest-card__fields">
        <label className="account-field">
          <span className="account-label">Nombre</span>
          <input className="account-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ana Quispe" autoComplete="name" />
        </label>
        <label className="account-field">
          <span className="account-label">Celular</span>
          <input
            className="account-input"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="987 654 321"
            inputMode="tel"
            autoComplete="tel"
          />
        </label>
        <label className="account-field guest-card__wide">
          <span className="account-label">Correo</span>
          <input
            className="account-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@gmail.com"
            inputMode="email"
            autoComplete="email"
          />
        </label>
      </div>

      <label className="guest-card__terms">
        <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
        <span>
          Acepto los <Link to="/terminos-y-condiciones" target="_blank">términos y condiciones</Link> y la{' '}
          <Link to="/politica-de-privacidad" target="_blank">política de privacidad</Link>.
        </span>
      </label>

      {error && (
        <div className="account-alert account-alert--error guest-card__error">
          {error} {needsLogin ? <Link to={loginLink}>Ingresar</Link> : null}
        </div>
      )}

      <button type="button" className="cart-pay-btn guest-card__continue" disabled={!valid || busy} onClick={() => void continueAsGuest()}>
        {busy ? 'Un momento…' : 'Continuar con mi pedido'}
      </button>

      <p className="guest-card__login">
        ¿Ya tienes cuenta? <Link to={loginLink}>Ingresa aquí</Link>
      </p>
    </section>
  );
}
