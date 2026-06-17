import { useState, type ChangeEvent, type FormEvent } from 'react';
import './ContactPage.css';
import contactoImg from '../../../images/contacto.png';
import { publicContactService } from '../../../core/services/publicContactService';

// ── ICONS (set moderno) ──────────────────────────────────────────────────────
type IconProps = { size?: number };
const line = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

function IconMail({ size = 20 }: IconProps) {
  return (
    <svg {...line(size)}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="3.5" />
      <path d="m3.5 7.5 7.3 5.1a2 2 0 0 0 2.4 0l7.3-5.1" />
    </svg>
  );
}
function IconPhone({ size = 20 }: IconProps) {
  return (
    <svg {...line(size)}>
      <path d="M6.5 3h-2A1.5 1.5 0 0 0 3 4.6C3 13 11 21 19.4 21A1.5 1.5 0 0 0 21 19.5v-2a1.5 1.5 0 0 0-1.2-1.47l-2.5-.5a1.5 1.5 0 0 0-1.5.6l-.6.8a12.5 12.5 0 0 1-5.6-5.6l.8-.6a1.5 1.5 0 0 0 .6-1.5l-.5-2.5A1.5 1.5 0 0 0 6.5 3z" />
    </svg>
  );
}
function IconMapPin({ size = 20 }: IconProps) {
  return (
    <svg {...line(size)}>
      <path d="M20 10.5c0 5.8-6.4 10.8-8 12-1.6-1.2-8-6.2-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10.5" r="2.7" />
    </svg>
  );
}
function IconClock({ size = 20 }: IconProps) {
  return (
    <svg {...line(size)}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v4.8l3.2 1.9" /></svg>
  );
}
function IconSend({ size = 18 }: IconProps) {
  return (
    <svg {...line(size)} strokeWidth={2}>
      <path d="M3.4 11.3 20 4.2c.8-.34 1.6.46 1.26 1.26L14.7 22c-.36.84-1.57.78-1.85-.1l-1.9-6a1.5 1.5 0 0 0-.95-.95l-6-1.9c-.88-.28-.94-1.49-.1-1.85z" />
      <path d="M11 13 21 4.5" />
    </svg>
  );
}
function IconCheckCircle({ size = 56 }: IconProps) {
  return (
    <svg {...line(size)} strokeWidth={1.7}><circle cx="12" cy="12" r="9.5" /><path d="m8 12.2 2.7 2.7L16.2 9" /></svg>
  );
}

function IconWhatsApp({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
  );
}
function IconInstagram({ size = 17 }: IconProps) {
  return (
    <svg {...line(size)} strokeWidth={1.9}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconFacebook({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}
function IconTikTok({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.1v12.45a2.6 2.6 0 1 1-2.6-2.6c.27 0 .53.04.78.12v-3.17a5.73 5.73 0 0 0-.78-.05 5.72 5.72 0 1 0 5.72 5.72V8.9a7.35 7.35 0 0 0 4.3 1.38V7.18a4.3 4.3 0 0 1-3.27-1.36z"/>
    </svg>
  );
}

const initialForm = {
  business_name: '', category: '', contact_name: '', phone: '',
  email: '', address: '', daily_orders: '', referral_source: '', message: '',
};

// ── WAVE ────────────────────────────────────────────────────────────────────

function HeroWave() {
  return (
    <div style={{ background: '#4d148c', lineHeight: 0, fontSize: 0, overflow: 'hidden' }}>
      <svg viewBox="0 0 1440 70" preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: 60, verticalAlign: 'bottom' }}>
        <path d="M0,35 C180,70 360,0 540,35 C720,70 900,0 1080,35 C1260,70 1380,15 1440,35 L1440,90 L0,90 Z" fill="#f8f9fa" />
      </svg>
    </div>
  );
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────

export function ContactPage() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const update =
    (key: keyof typeof initialForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    const { error } = await publicContactService.submitContactRequest(form);
    setSubmitting(false);
    if (error) {
      setStatus('error');
      setErrorMsg('No pudimos enviar tu solicitud. Revisa tu conexión e inténtalo de nuevo.');
      return;
    }
    setStatus('success');
    setForm(initialForm);
  };

  return (
    <div className="contact-page">

      {/* ── HERO ── */}
      <section className="contact-hero">
        <div className="contact-hero__text">
          <div className="contact-hero__eyebrow">
            <div className="contact-hero__eyebrow-dot" />
            Ponerse en contacto
          </div>
          <h1>
            Hagamos crecer tu negocio <span>juntos</span>
          </h1>
          <p className="contact-hero__lead">
            Nuestro equipo está listo para ayudarte a integrar tu local en ACME Pedidos. Completa el formulario y un asesor te contactará en menos de 24 horas.
          </p>
        </div>

        <div className="contact-hero__chips">
          <div className="contact-chip">
            <div className="contact-chip__icon"><IconMail /></div>
            <div>
              <span className="contact-chip__label">Email</span>
              <span className="contact-chip__value">soporte@acme.pe</span>
            </div>
          </div>
          <div className="contact-chip">
            <div className="contact-chip__icon"><IconPhone /></div>
            <div>
              <span className="contact-chip__label">WhatsApp</span>
              <span className="contact-chip__value">+51 967 000 000</span>
            </div>
          </div>
          <div className="contact-chip">
            <div className="contact-chip__icon contact-chip__icon--purple"><IconClock /></div>
            <div>
              <span className="contact-chip__label">Horario asesoría</span>
              <span className="contact-chip__value">Lun–Sáb 9:00–18:00</span>
            </div>
          </div>
        </div>

        <div className="contact-hero__img-wrapper">
          <img src={contactoImg} alt="Contacto ACME" className="contact-hero__main-img" />
        </div>
      </section>

      <HeroWave />

      {/* ── BODY ── */}
      <div className="contact-body">
        <div className="contact-grid">

          {/* ── FORM ── */}
          <div className="contact-form-card">
            {status === 'success' ? (
              <div className="contact-success">
                <div className="contact-success__icon"><IconCheckCircle /></div>
                <h2 className="contact-success__title">¡Solicitud enviada!</h2>
                <p className="contact-success__text">
                  Recibimos tu solicitud y ya quedó registrada. Un asesor de ACME se pondrá en contacto contigo en menos de 24 horas.
                </p>
                <button type="button" className="contact-submit-btn" onClick={() => setStatus('idle')}>
                  Enviar otra solicitud
                </button>
              </div>
            ) : (
              <>
                <h2 className="contact-form-card__title">Registra tu negocio en ACME</h2>
                <p className="contact-form-card__subtitle">
                  Completa los datos y nuestro equipo se pondrá en contacto contigo para iniciar la configuración de tu local.
                </p>

                <form className="contact-form" onSubmit={handleSubmit}>
                  <div className="contact-form-row">
                    <div className="contact-form-field">
                      <label className="contact-form-label">Nombre del local *</label>
                      <input className="contact-form-input" type="text" placeholder="Ej: Restaurante El Huancaíno" required value={form.business_name} onChange={update('business_name')} />
                    </div>
                    <div className="contact-form-field">
                      <label className="contact-form-label">Rubro *</label>
                      <select className="contact-form-select" required value={form.category} onChange={update('category')}>
                        <option value="">Selecciona un rubro...</option>
                        <option>Restaurante</option>
                        <option>Cafetería / Café</option>
                        <option>Panadería / Pastelería</option>
                        <option>Pollería</option>
                        <option>Rotisería</option>
                        <option>Comida rápida</option>
                        <option>Farmacia</option>
                        <option>Tienda / Minimarket</option>
                        <option>Otro</option>
                      </select>
                    </div>
                  </div>

                  <div className="contact-form-row">
                    <div className="contact-form-field">
                      <label className="contact-form-label">Nombre del responsable *</label>
                      <input className="contact-form-input" type="text" placeholder="Tu nombre completo" required value={form.contact_name} onChange={update('contact_name')} />
                    </div>
                    <div className="contact-form-field">
                      <label className="contact-form-label">Teléfono de contacto *</label>
                      <input className="contact-form-input" type="tel" placeholder="+51 9XX XXX XXX" required value={form.phone} onChange={update('phone')} />
                    </div>
                  </div>

                  <div className="contact-form-field">
                    <label className="contact-form-label">Correo electrónico *</label>
                    <input className="contact-form-input" type="email" placeholder="tucorreo@ejemplo.com" required value={form.email} onChange={update('email')} />
                  </div>

                  <div className="contact-form-field">
                    <label className="contact-form-label">Dirección del local *</label>
                    <input className="contact-form-input" type="text" placeholder="Calle, número, distrito — Huancavelica" required value={form.address} onChange={update('address')} />
                  </div>

                  <div className="contact-form-row">
                    <div className="contact-form-field">
                      <label className="contact-form-label">¿Cuántos pedidos al día estimas?</label>
                      <select className="contact-form-select" value={form.daily_orders} onChange={update('daily_orders')}>
                        <option value="">Selecciona...</option>
                        <option>Menos de 10</option>
                        <option>10 – 30</option>
                        <option>30 – 60</option>
                        <option>Más de 60</option>
                      </select>
                    </div>
                    <div className="contact-form-field">
                      <label className="contact-form-label">¿Cómo nos conociste?</label>
                      <select className="contact-form-select" value={form.referral_source} onChange={update('referral_source')}>
                        <option value="">Selecciona...</option>
                        <option>Redes sociales</option>
                        <option>Recomendación de otro local</option>
                        <option>Google / Buscador</option>
                        <option>App Store / Play Store</option>
                        <option>Otro</option>
                      </select>
                    </div>
                  </div>

                  <div className="contact-form-field">
                    <label className="contact-form-label">Mensaje adicional (opcional)</label>
                    <textarea className="contact-form-textarea" placeholder="Cuéntanos más sobre tu negocio, horario de atención, o cualquier detalle que nos ayude a preparar tu integración..." value={form.message} onChange={update('message')} />
                  </div>

                  {status === 'error' ? (
                    <div className="contact-form-error">{errorMsg}</div>
                  ) : null}

                  <div className="contact-form-footer">
                    <p className="contact-form-terms">
                      Al enviar aceptas nuestros <a href="#">términos de uso</a> y <a href="#">política de privacidad</a>.
                    </p>
                    <button type="submit" className="contact-submit-btn" disabled={submitting}>
                      <IconSend />
                      {submitting ? 'Enviando...' : 'Enviar solicitud'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* ── SIDEBAR ── */}
          <div className="contact-sidebar">

            {/* Contact channels */}
            <div className="contact-sidebar-card">
              <span className="contact-sidebar-card__label">Canales de contacto</span>
              <div className="contact-info-items">
                <div className="contact-info-item">
                  <div className="contact-info-item__icon contact-info-item__icon--orange"><IconMail /></div>
                  <div>
                    <span className="contact-info-item__label">Email</span>
                    <span className="contact-info-item__value">soporte@acme.pe</span>
                    <span className="contact-info-item__sub">Respuesta en menos de 24 h</span>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="contact-info-item__icon contact-info-item__icon--purple"><IconPhone /></div>
                  <div>
                    <span className="contact-info-item__label">WhatsApp / Llamada</span>
                    <span className="contact-info-item__value">+51 967 000 000</span>
                    <span className="contact-info-item__sub">Lun–Sáb de 9:00 a 18:00</span>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="contact-info-item__icon contact-info-item__icon--orange"><IconMapPin /></div>
                  <div>
                    <span className="contact-info-item__label">Ubicación</span>
                    <span className="contact-info-item__value">Huancavelica, Perú</span>
                    <span className="contact-info-item__sub">Atención presencial con cita previa</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Activation timeline */}
            <div className="contact-sidebar-card">
              <span className="contact-sidebar-card__label">Proceso de activación</span>
              <div className="contact-timeline">
                <div className="contact-timeline-step">
                  <div className="contact-timeline-step__dot contact-timeline-step__dot--orange">1</div>
                  <div className="contact-timeline-step__content">
                    <span className="contact-timeline-step__name">Consulta inicial</span>
                    <span className="contact-timeline-step__desc">Recibimos tu solicitud</span>
                  </div>
                  <span className="contact-timeline-step__badge contact-timeline-step__badge--orange">24 h</span>
                </div>
                <div className="contact-timeline-step">
                  <div className="contact-timeline-step__dot contact-timeline-step__dot--orange">2</div>
                  <div className="contact-timeline-step__content">
                    <span className="contact-timeline-step__name">Configuración</span>
                    <span className="contact-timeline-step__desc">Cargamos tu menú y datos</span>
                  </div>
                  <span className="contact-timeline-step__badge contact-timeline-step__badge--orange">48 h</span>
                </div>
                <div className="contact-timeline-step">
                  <div className="contact-timeline-step__dot contact-timeline-step__dot--purple">3</div>
                  <div className="contact-timeline-step__content">
                    <span className="contact-timeline-step__name">¡Local activo!</span>
                    <span className="contact-timeline-step__desc">Empiezas a recibir pedidos</span>
                  </div>
                  <span className="contact-timeline-step__badge contact-timeline-step__badge--purple">72 h</span>
                </div>
              </div>
            </div>

            {/* Social networks */}
            <div className="contact-sidebar-card">
              <span className="contact-sidebar-card__label">Síguenos en redes</span>
              <div className="contact-socials">
                <a href="#" className="contact-social-link" aria-label="WhatsApp">
                  <span className="contact-social-icon contact-social-icon--whatsapp"><IconWhatsApp size={19} /></span>
                  WhatsApp
                </a>
                <a href="#" className="contact-social-link" aria-label="Instagram">
                  <span className="contact-social-icon contact-social-icon--instagram"><IconInstagram size={19} /></span>
                  Instagram
                </a>
                <a href="#" className="contact-social-link" aria-label="Facebook">
                  <span className="contact-social-icon contact-social-icon--facebook"><IconFacebook size={19} /></span>
                  Facebook
                </a>
                <a href="#" className="contact-social-link" aria-label="TikTok">
                  <span className="contact-social-icon contact-social-icon--tiktok"><IconTikTok size={18} /></span>
                  TikTok
                </a>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}