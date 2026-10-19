import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppRoutes } from '../../../core/constants/routes';
import { courierPaymentService } from '../../../core/services/courierPaymentService';
import { LEGAL_TEXTS_VERSION } from '../../../core/services/publicCustomerService';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';

interface GuestCheckoutCardProps {
  /** Se llama cuando la sesion de invitado ya esta activa, con los datos para la entrega. */
  onStarted: (data: { nombre: string; telefono: string }) => void;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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

  return (
    <section className="account-card guest-card">
      <h2 className="guest-card__title">¿A nombre de quién va el pedido?</h2>
      <p className="guest-card__lead">No necesitas crear una cuenta. Con estos datos te avisamos del pedido y te enviamos el comprobante.</p>

      <GoogleSignInButton returnTo={AppRoutes.public.cart} />

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
