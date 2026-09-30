import { useEffect, useState, useContext, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import './BusinessPage.css';
import { resolvePortalLandingRoute } from '../../../core/auth/portalLanding';
import { publicBusinessService } from '../../../core/services/publicBusinessService';
import { PortalContext } from '../../auth/session/PortalContext';
import { AppRoutes } from '../../../core/constants/routes';
import localLeftImg from '../../../images/local-izquierda.png';
import localRightImg from '../../../images/local-derecha.png';

interface FormData {
  email: string;
  password: string;
  businessName: string;
  branchName: string;
  address: string;
  phone: string;
  ownerName: string;
}

function Arrow({ dir = 'right' }: { dir?: 'right' | 'left' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {dir === 'right' ? (
        <path d="M3 9h12M11 5l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M15 9H3M7 5L3 9l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 9l5 5 7-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Icons instead of Emojis ──────────────────────────────────────────────────

function IconBuilding() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="10" width="20" height="12" rx="2" />
      <path d="M6 10V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5" />
      <path d="M10 15h4" />
      <path d="M10 18h4" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconTrending() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconTruck() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function IconLayout() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h3v-4z" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function InputField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  rows,
  hint,
  error,
}: {
  label: string;
  name: keyof FormData;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  rows?: number;
  hint?: string;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const border = error ? '#f87171' : focused ? '#8b5cf6' : '#e4e4e7';

  const sharedStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    border: `1.8px solid ${border}`,
    borderRadius: 12,
    fontSize: '0.94rem',
    outline: 'none',
    background: focused ? '#faf8ff' : '#fafafa',
    color: '#18181b',
    transition: 'all 0.18s ease',
    fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#52525b', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {hint ? <p style={{ margin: 0, fontSize: '0.76rem', color: '#a1a1aa' }}>{hint}</p> : null}
      {rows ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          rows={rows}
          required
          style={{ ...sharedStyle, resize: 'none' }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          required
          style={sharedStyle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      )}
      {error ? <p style={{ margin: 0, fontSize: '0.76rem', color: '#ef4444' }}>⚠ {error}</p> : null}
    </div>
  );
}

function Stepper({ step, authMode }: { step: number; authMode?: boolean }) {
  const labels = authMode ? ['Negocio', 'Contacto'] : ['Cuenta', 'Negocio', 'Contacto'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {labels.map((label, index) => {
        const active = index === step;
        const done = index < step;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: done ? 'rgba(255,255,255,.28)' : active ? '#fff' : 'rgba(255,255,255,.1)',
                  color: active ? '#7c3aed' : '#fff',
                  border: active ? 'none' : '2px solid rgba(255,255,255,.2)',
                  fontWeight: 800,
                }}
              >
                {done ? '✓' : index + 1}
              </div>
              <span style={{ fontSize: '0.66rem', color: active ? '#fff' : 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>
                {label}
              </span>
            </div>
            {index < labels.length - 1 ? <div style={{ width: 44, height: 2, margin: '0 8px 20px', background: done ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.15)' }} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, color = '#7c3aed' }: { icon: any; title: string; description: string; color?: string }) {
  return (
    <div style={{ borderRadius: 22, background: '#fff', border: '1px solid #f0eeff', padding: '34px 28px', boxShadow: '0 12px 30px rgba(17,24,39,.04)', transition: 'transform 0.25s ease', cursor: 'default' }}>
      <div style={{ width: 54, height: 54, borderRadius: 16, background: `${color}10`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Icon />
      </div>
      <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#18181b', margin: '0 0 10px' }}>{title}</h3>
      <p style={{ color: '#71717a', fontSize: '0.94rem', lineHeight: 1.65, margin: 0 }}>{description}</p>
    </div>
  );
}

export function BusinessPage() {
  const navigate = useNavigate();
  const portal = useContext(PortalContext);
  const totalSteps = portal.sessionUserId ? 2 : 3;
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [success, setSuccess] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    businessName: '',
    branchName: '',
    address: '',
    phone: '',
    ownerName: '',
  });

  useEffect(() => {
    // Check if user is already a partner
    if (portal.sessionUserId && !portal.isLoading) {
      if (portal.hasBusinessAccess || portal.businessAssignments.length > 0) {
        navigate(resolvePortalLandingRoute(portal));
        return;
      }

      // If logged in but no business, pre-fill owner data and auto-open if intended
      if (portal.profile && !formData.ownerName) {
        setFormData(prev => ({
          ...prev,
          ownerName: portal.profile?.full_name || '',
          email: portal.profile?.email || '',
        }));
      }

      // Auto-open modal if the user was just redirected back from login
      const wasRedirected = window.location.search.includes('redirect=');
      if (wasRedirected && !modalOpen && !success) {
        setModalOpen(true);
      }
    }
  }, [portal.sessionUserId, portal.hasBusinessAccess, portal.businessAssignments, portal.isLoading, navigate, portal.profile]);

  useEffect(() => {
    document.body.style.overflow = modalOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [modalOpen]);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    if (name === 'email') {
      setEmailError(value && !validateEmail(value) ? 'Email invalido, ej: contacto@tuempresa.com' : '');
    }
  };

  const canAdvance = () => {
    if (portal.sessionUserId) {
      if (step === 0) return Boolean(formData.businessName.trim() && formData.branchName.trim());
      return Boolean(formData.address.trim() && formData.phone.trim());
    }

    if (step === 0) return Boolean(formData.ownerName.trim() && validateEmail(formData.email) && !emailError && formData.password.length >= 6);
    if (step === 1) return Boolean(formData.businessName.trim() && formData.branchName.trim());
    return Boolean(formData.address.trim() && formData.phone.trim());
  };

  const goTo = (nextStep: number) => {
    if (animating) return;
    setAnimating(true);
    window.setTimeout(() => {
      setStep(nextStep);
      setAnimating(false);
    }, 220);
  };

  const resetModal = () => {
    setStep(0);
    setApiError('');
    setSuccess(false);
    setAwaitingConfirmation(false);
  };

  const openModal = () => {
    if (!portal.sessionUserId) {
      navigate(`${AppRoutes.public.portalLogin}?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    resetModal();
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!canAdvance()) return;
    setIsSubmitting(true);
    setApiError('');

    try {
      if (portal.sessionUserId) {
        const result = await publicBusinessService.finalizeBusinessOnboarding(portal.sessionUserId, {
          ownerName: formData.ownerName || portal.profile?.full_name || 'Owner',
          email: portal.profile?.email || formData.email,
          phone: formData.phone,
          businessName: formData.businessName,
          branchName: formData.branchName,
          address: formData.address,
        });

        if (result.error) throw result.error;
        await portal.reloadPortalContext();
        setSuccess(true);
        return;
      }

      const result = await publicBusinessService.registerBusinessAccount({
        ownerName: formData.ownerName,
        email: formData.email,
        phone: formData.phone,
        businessName: formData.businessName,
        branchName: formData.branchName,
        address: formData.address,
        password: formData.password,
      });

      if (result.error) throw result.error;

      if (result.data?.status === 'awaiting_confirmation') {
        setAwaitingConfirmation(true);
        return;
      }

      setSuccess(true);
    } catch (error: any) {
      const message = String(error?.message ?? error ?? 'Ocurrio un error inesperado');
      if (message.toLowerCase().includes('user already registered')) {
        setApiError('Ese correo ya esta registrado. Inicia sesion en el portal o usa otro correo.');
      } else {
        setApiError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToFeatures = () => {
    const target = document.getElementById('business-benefits');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const stepContent = portal.sessionUserId ? [
    <div key="business" style={{ display: 'grid', gap: 14 }}>
      <InputField label="Nombre del negocio" name="businessName" value={formData.businessName} onChange={handleChange} />
      <InputField label="Sucursal principal" name="branchName" value={formData.branchName} onChange={handleChange} />
    </div>,
    <div key="contact" style={{ display: 'grid', gap: 14 }}>
      <InputField label="Direccion" name="address" value={formData.address} onChange={handleChange} rows={2} />
      <InputField label="Telefono" name="phone" value={formData.phone} onChange={handleChange} />
    </div>,
  ] : [
    <div key="account" style={{ display: 'grid', gap: 14 }}>
      <InputField label="Nombre completo" name="ownerName" value={formData.ownerName} onChange={handleChange} />
      <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} hint="Recibiras un enlace de confirmacion." error={emailError} />
      <InputField label="Contrasena" name="password" type="password" value={formData.password} onChange={handleChange} hint="Minimo 6 caracteres." />
    </div>,
    <div key="business" style={{ display: 'grid', gap: 14 }}>
      <InputField label="Nombre del negocio" name="businessName" value={formData.businessName} onChange={handleChange} />
      <InputField label="Sucursal principal" name="branchName" value={formData.branchName} onChange={handleChange} />
    </div>,
    <div key="contact" style={{ display: 'grid', gap: 14 }}>
      <InputField label="Direccion" name="address" value={formData.address} onChange={handleChange} rows={2} />
      <InputField label="Telefono" name="phone" value={formData.phone} onChange={handleChange} />
    </div>,
  ];

  return (
    <>
      <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;700&display=swap');
          @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes floatBlob { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(28px,-18px) scale(1.04); } 66% { transform: translate(-18px,14px) scale(0.97); } }
          @keyframes modalIn { from { opacity: 0; transform: scale(.94) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }
          @keyframes spin { to { transform: rotate(360deg); } }
          .business-hero-btn:hover { transform: translateY(-2px); }
        `}</style>

      <div className="biz-page" style={{ background: '#faf8ff', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
        <section style={{ background: '#4d148c', padding: '160px 24px 110px', position: 'relative', overflow: 'hidden' }}>
          {[
            { w: 420, h: 420, top: -100, right: -80, color: 'rgba(167,139,250,0.14)', delay: '0s' },
            { w: 300, h: 300, bottom: 100, left: -60, color: 'rgba(255,98,0,0.1)', delay: '5s' },
            { w: 200, h: 200, top: '38%', left: '45%', color: 'rgba(139,92,246,0.16)', delay: '9s' },
          ].map((blob, index) => (
            <div key={index} style={{ position: 'absolute', width: blob.w, height: blob.h, top: blob.top as any, right: blob.right as any, bottom: blob.bottom as any, left: blob.left as any, background: blob.color, borderRadius: '50%', filter: 'blur(64px)', animation: `floatBlob 14s ease-in-out ${blob.delay} infinite`, pointerEvents: 'none' }} />
          ))}

          <div className="business-hero__side-img business-hero__side-img--left">
            <img src={localLeftImg} alt="" className="bhero-img__shadow" aria-hidden="true" />
            <img src={localLeftImg} alt="" className="bhero-img__main" />
          </div>
          <div className="business-hero__side-img business-hero__side-img--right">
            <img src={localRightImg} alt="" className="bhero-img__shadow" aria-hidden="true" />
            <img src={localRightImg} alt="" className="bhero-img__main" />
          </div>

          <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 100, padding: '6px 18px', marginBottom: 28, color: 'rgba(255,255,255,0.88)', fontSize: '0.8rem', fontWeight: 600, animation: 'fadeUp .6s ease both' }}>
              ✦ Potencia tu ventas con el portal de negocios
            </div>
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(2rem,5.5vw,3.8rem)', fontWeight: 800, color: '#fff', lineHeight: 1.14, margin: '0 0 22px', animation: 'fadeUp .65s .1s ease both' }}>
              Haz crecer tu negocio
              <br />
              <span style={{ background: 'linear-gradient(90deg,#c084fc,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>con la tecnología de ACME</span>
            </h1>
            <p style={{ fontSize: 'clamp(.95rem,2vw,1.1rem)', color: 'rgba(255,255,255,.72)', lineHeight: 1.72, maxWidth: 560, margin: '0 auto 38px', animation: 'fadeUp .65s .2s ease both' }}>
              Digitaliza tu catálogo, gestiona pedidos en tiempo real y llega a miles de clientes en Huancavelica con nuestra plataforma profesional.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', animation: 'fadeUp .65s .3s ease both' }}>
              <button className="business-hero-btn" onClick={openModal} style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', border: 'none', borderRadius: 12, padding: '15px 32px', fontSize: '0.97rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Sora', sans-serif", boxShadow: '0 8px 24px rgba(124,58,237,.38)', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all .22s ease' }}>
                Registrar mi negocio <Arrow />
              </button>
              <button onClick={scrollToFeatures} style={{ background: 'transparent', color: 'rgba(255,255,255,.84)', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 12, padding: '15px 26px', fontSize: '0.92rem', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                Ver beneficios
              </button>
            </div>
          </div>
        </section>

        {/* ── Wave: hero purple → page background ── */}
        <div style={{ background: '#4d148c', lineHeight: 0, fontSize: 0, overflow: 'hidden' }}>
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none"
            style={{ display: 'block', width: '100%', height: 60, verticalAlign: 'bottom' }}>
            <path d="M0,35 C180,70 360,0 540,35 C720,70 900,0 1080,35 C1260,70 1380,15 1440,35 L1440,90 L0,90 Z" fill="#faf8ff" />
          </svg>
        </div>

        {/* ── BENEFITS SECTION ── */}
        <section id="business-benefits" className="biz-section">
          <div className="biz-wrap">
            <div className="biz-head">
              <span className="biz-eyebrow">¿Por qué ACME?</span>
              <h2 className="biz-title">Potenciamos cada aspecto de tu <em>negocio</em></h2>
              <p className="biz-subtitle">No es solo recibir pedidos: es una plataforma completa pensada para que vendas más, operes mejor y crezcas sin complicaciones.</p>
            </div>
            <div className="biz-benefits">
              {[
                {
                  icon: <IconTrending />, accent: '#7c3aed', title: 'Aumento de ventas',
                  desc: 'Llega a clientes que antes no podían visitarte, con una vitrina digital activa todo el día.',
                  list: ['Visibilidad en todo Huancavelica', 'Nuevos clientes cada día', 'Vitrina abierta 24/7'],
                },
                {
                  icon: <IconTruck />, accent: '#ff6200', title: 'Logística simplificada',
                  desc: 'Nosotros movemos tu producto. Olvídate de contratar y coordinar repartidores externos.',
                  list: ['Repartidores ACME incluidos', 'Entregas rastreadas en tiempo real', 'Sin personal extra que pagar'],
                },
                {
                  icon: <IconLayout />, accent: '#059669', title: 'Control total',
                  desc: 'Un panel claro e intuitivo para administrar tu operación completa desde un solo lugar.',
                  list: ['Dashboard en tiempo real', 'Edita menú, precios y horarios', 'Reportes de ventas claros'],
                },
              ].map((b) => (
                <article key={b.title} className="biz-bcard" style={{ ['--accent']: b.accent } as React.CSSProperties}>
                  <div className="biz-bcard__icon">{b.icon}</div>
                  <h3>{b.title}</h3>
                  <p>{b.desc}</p>
                  <ul className="biz-blist">
                    {b.list.map((li) => (
                      <li key={li}><CheckIcon /> {li}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS BAND ── */}
        <section className="biz-section biz-stats-band">
          <div className="biz-wrap">
            <div className="biz-stats">
              {[
                { icon: <IconWallet />, num: 'S/ 0', label: 'Inversión inicial para empezar' },
                { icon: <IconClock />, num: '24/7', label: 'Recepción de pedidos' },
                { icon: <IconPin />, num: '100%', label: 'Cobertura en la provincia' },
                { icon: <IconBolt />, num: 'En vivo', label: 'Sincronización al instante' },
              ].map((s) => (
                <div key={s.label} className="biz-stat">
                  <div className="biz-stat__icon">{s.icon}</div>
                  <div className="biz-stat__num">{s.num}</div>
                  <div className="biz-stat__label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STEPS SECTION ── */}
        <section className="biz-section" style={{ background: '#f5f3ff' }}>
          <div className="biz-wrap">
            <div className="biz-head">
              <span className="biz-eyebrow">Simple y rápido</span>
              <h2 className="biz-title">Empieza a vender en <em>3 pasos</em></h2>
              <p className="biz-subtitle">Desde el registro hasta tu primera venta en cuestión de minutos, con acompañamiento de nuestro equipo.</p>
            </div>
            <div className="biz-steps">
              {[
                { n: '01', icon: <IconBuilding />, t: 'Regístrate', d: 'Crea tu cuenta de negocio y carga la información básica de tu sucursal principal.' },
                { n: '02', icon: <IconLayout />, t: 'Configura', d: 'Sube tus productos, fotos y precios. Te ayudamos a optimizar tu menú para vender más.' },
                { n: '03', icon: <IconTruck />, t: 'Vende', d: 'Recibe tu primera orden, prepárala y un repartidor de ACME pasará por ella en minutos.' },
              ].map((s) => (
                <div key={s.n} className="biz-step">
                  <span className="biz-step__n">{s.n}</span>
                  <div className="biz-step__badge">{s.icon}</div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHAT IS CREATED SECTION ── */}
        <section className="biz-section">
          <div className="biz-wrap">
            <div className="biz-deliver">
              <div className="biz-deliver__left">
                <div className="biz-head">
                  <span className="biz-eyebrow">Alta funcional</span>
                  <h2 className="biz-title">Lo que obtienes <em>al instante</em></h2>
                  <p className="biz-subtitle">Al registrarte, tu operación queda lista de inmediato. Sin esperas técnicas ni configuraciones interminables.</p>
                </div>
              </div>
              <div className="biz-deliver__panel">
                {[
                  { icon: <IconBuilding />, accent: '#7c3aed', t: 'Estructura real', d: 'Tu negocio, sucursal y dirección base creados en nuestra base de datos al momento.' },
                  { icon: <IconClock />, accent: '#ff6200', t: 'Operación lista', d: 'Horarios base y estado operativo configurados para que empieces hoy mismo.' },
                  { icon: <IconShield />, accent: '#059669', t: 'Acceso seguro', d: 'Tu cuenta como Owner vinculada, con control total desde el primer segundo.' },
                  { icon: <IconStar />, accent: '#7c3aed', t: 'Vitrina activa', d: 'Tras la aprobación, tu local aparece en el marketplace listo para recibir clientes.' },
                ].map((d) => (
                  <div key={d.t} className="biz-deliver-item" style={{ ['--accent']: d.accent } as React.CSSProperties}>
                    <div className="biz-deliver-item__icon">{d.icon}</div>
                    <div>
                      <h4>{d.t}</h4>
                      <p>{d.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ── */}
        <div className="biz-cta">
          <div className="biz-cta__inner">
            <h2>¿Listo para hacer crecer tu negocio?</h2>
            <p>Únete a los negocios de Huancavelica que ya venden con ACME. El registro es gratis y toma solo unos minutos.</p>
            <button className="biz-cta__btn" onClick={openModal}>
              Registrar mi negocio <Arrow />
            </button>
          </div>
        </div>

        {modalOpen ? (
          <div onClick={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(12,0,28,.8)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 468, boxShadow: '0 32px 80px rgba(0,0,0,.3)', animation: 'modalIn .28s cubic-bezier(.34,1.2,.64,1) both', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg,#2d0a6b,#7c3aed)', padding: '22px 22px 20px', position: 'relative' }}>
                <button onClick={() => setModalOpen(false)} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff' }}>
                  <span style={{ fontSize: 16 }}>×</span>
                </button>
                {!success && !awaitingConfirmation ? <Stepper step={step} authMode={Boolean(portal.sessionUserId)} /> : null}
              </div>

              <div style={{ padding: '22px 26px 26px' }}>
                {success ? (
                  <div style={{ textAlign: 'center', display: 'grid', gap: 14 }}>
                    <div style={{ width: 68, height: 68, margin: '0 auto', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'grid', placeItems: 'center', fontSize: 28 }}>✓</div>
                    <h3 style={{ margin: 0, fontFamily: "'Sora', sans-serif", fontSize: '1.15rem', color: '#18181b' }}>Tu solicitud ya quedo registrada</h3>
                    <p style={{ margin: 0, color: '#71717a', lineHeight: 1.65, fontSize: '0.88rem' }}>Tu cuenta, tu negocio y la sucursal principal ya quedaron creados. Ahora la plataforma debe aprobar el acceso operativo.</p>
                    <button onClick={() => setModalOpen(false)} style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '0.93rem', cursor: 'pointer' }}>Cerrar</button>
                  </div>
                ) : awaitingConfirmation ? (
                  <div style={{ textAlign: 'center', display: 'grid', gap: 14 }}>
                    <div style={{ width: 68, height: 68, margin: '0 auto', borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'grid', placeItems: 'center', fontSize: 28 }}><IconShield /></div>
                    <h3 style={{ margin: 0, fontFamily: "'Sora', sans-serif", fontSize: '1.15rem', color: '#18181b' }}>Confirma tu correo</h3>
                    <p style={{ margin: 0, color: '#71717a', lineHeight: 1.65, fontSize: '0.88rem' }}>Te enviamos el enlace de confirmacion. Cuando lo abras, tu negocio terminara de configurarse y quedara pendiente de aprobacion por plataforma.</p>
                    <button onClick={() => setModalOpen(false)} style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '0.93rem', cursor: 'pointer' }}>Entendido</button>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 18 }}>
                      <h3 style={{ margin: '0 0 4px', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '1.05rem', color: '#18181b' }}>
                        {portal.sessionUserId
                          ? ['Tu negocio', 'Donde encontrarte'][step]
                          : ['Crea tu cuenta', 'Tu negocio', 'Donde encontrarte'][step]
                        }
                      </h3>
                      <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.82rem' }}>
                        {portal.sessionUserId
                          ? ['Cuéntanos sobre tu negocio y su sucursal principal.', 'Direccion y telefono de contacto.'][step]
                          : ['Datos de acceso al portal.', 'Cuéntanos sobre tu negocio y su sucursal principal.', 'Direccion y telefono de contacto.'][step]
                        }
                      </p>
                    </div>

                    <form onSubmit={(event) => { event.preventDefault(); if (step < totalSteps - 1) { goTo(step + 1); return; } handleSubmit(); }}>
                      <div style={{ display: 'grid', gap: 14 }}>
                        {!animating ? stepContent[step] : null}
                      </div>

                      {apiError ? <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: '0.8rem' }}>⚠ {apiError}</div> : null}

                      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                        {step > 0 ? (
                          <button type="button" onClick={() => goTo(step - 1)} style={{ flex: '0 0 auto', background: '#f4f0ff', color: '#7c3aed', border: 'none', borderRadius: 10, padding: '12px 16px', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <Arrow dir="left" /> Atras
                          </button>
                        ) : null}
                        <button type="submit" disabled={!canAdvance() || isSubmitting} style={{ flex: 1, background: !canAdvance() || isSubmitting ? '#c4b5fd' : 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontWeight: 700, fontSize: '0.93rem', cursor: !canAdvance() || isSubmitting ? 'not-allowed' : 'pointer', fontFamily: "'Sora', sans-serif", display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          {isSubmitting ? (
                            <>
                              <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'spin .8s linear infinite' }}>
                                <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,.35)" strokeWidth="2.5" fill="none" />
                                <path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                              </svg>
                              Registrando...
                            </>
                          ) : step < totalSteps - 1 ? (
                            <>Continuar <Arrow /></>
                          ) : (
                            <>Finalizar registro <CheckIcon /></>
                          )}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
