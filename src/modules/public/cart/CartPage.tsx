import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './CartPage.css';
import { AppRoutes } from '../../../core/constants/routes';
import {
  CourierCulqiOrderResponse,
  CourierQuoteResponse,
  courierPaymentService,
} from '../../../core/services/courierPaymentService';
import { CustomerAddressForm, publicCustomerService } from '../../../core/services/publicCustomerService';
import { usePublicStore } from '../store/PublicStoreContext';

type FulfillmentType = 'delivery' | 'pickup';
type TipOption = 0 | 1 | 2 | 'custom';

declare global {
  interface Window {
    Culqi?: {
      publicKey: string;
      token?: { id: string };
      order?: { id?: string; payment_code?: string; state?: string };
      error?: { user_message?: string; merchant_message?: string };
      settings: (config: Record<string, unknown>) => void;
      options: (config: Record<string, unknown>) => void;
      open: () => void;
      close?: () => void;
    };
    culqi?: () => void;
  }
}

const CULQI_SCRIPT_ID = 'culqi-checkout-v4';
const CULQI_SANDBOX_YAPE_PHONE = '900000001';
const CULQI_SANDBOX_YAPE_LABEL = '900 000 001';
const TIP_PRESETS = [0, 1, 2] as const; // S/0, S/1, S/2
const QUOTE_TTL_MS = 4.5 * 60 * 1000; // 4.5 min (expires_at es 5 min)
let culqiScriptPromise: Promise<void> | null = null;

function formatMoney(value: number, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function loadCulqiScript() {
  if (window.Culqi) return Promise.resolve();
  if (culqiScriptPromise) return culqiScriptPromise;

  culqiScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(CULQI_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('No se pudo cargar Culqi Checkout.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = CULQI_SCRIPT_ID;
    script.src = 'https://checkout.culqi.com/js/v4';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      culqiScriptPromise = null;
      reject(new Error('No se pudo cargar Culqi Checkout.'));
    };
    document.body.appendChild(script);
  });

  return culqiScriptPromise;
}

type IconProps = { size?: number };
const svgBase = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

const UserIcon = ({ size = 24 }: IconProps) => (
  <svg {...svgBase(size)}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const BagIcon = ({ size = 20 }: IconProps) => (
  <svg {...svgBase(size)}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);
const ArrowLeftIcon = ({ size = 18 }: IconProps) => (
  <svg {...svgBase(size)}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
);
const MinusIcon = ({ size = 16 }: IconProps) => (
  <svg {...svgBase(size)}><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const PlusIcon = ({ size = 16 }: IconProps) => (
  <svg {...svgBase(size)}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const TrashIcon = ({ size = 15 }: IconProps) => (
  <svg {...svgBase(size)}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const TruckIcon = ({ size = 18 }: IconProps) => (
  <svg {...svgBase(size)}>
    <rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 5v3h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);
const StoreIcon = ({ size = 18 }: IconProps) => (
  <svg {...svgBase(size)}>
    <path d="M3 9 4 3h16l1 6" /><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
    <path d="M3 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" /><path d="M9 21v-6h6v6" />
  </svg>
);
const PhoneIcon = ({ size = 16 }: IconProps) => (
  <svg {...svgBase(size)}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
);
const MapPinIcon = ({ size = 16 }: IconProps) => (
  <svg {...svgBase(size)}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
);
const PencilIcon = ({ size = 16 }: IconProps) => (
  <svg {...svgBase(size)}><path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
);
const ReceiptIcon = ({ size = 20 }: IconProps) => (
  <svg {...svgBase(size)}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1V2l-2 1-2-1-2 1-2-1-2 1-2-1Z" />
    <line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="16" y2="11" /><line x1="8" y1="15" x2="13" y2="15" />
  </svg>
);
const ImageIcon = ({ size = 26 }: IconProps) => (
  <svg {...svgBase(size)}>
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" />
  </svg>
);
const ShieldIcon = ({ size = 15 }: IconProps) => (
  <svg {...svgBase(size)}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);
const LockIcon = ({ size = 18 }: IconProps) => (
  <svg {...svgBase(size)}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);
const ZapIcon = ({ size = 15 }: IconProps) => (
  <svg {...svgBase(size)}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
);

const SpinnerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

function createEmptyAddress(): CustomerAddressForm {
  return {
    label: 'Casa',
    is_default: true,
    line1: '',
    line2: '',
    reference: '',
    district: '',
    city: 'Huancavelica',
    region: 'Huancavelica',
    country: 'Peru',
  };
}

// ─── Línea del resumen ─────────────────────────────────────────────────────────
function SummaryRow({ label, value, highlight, muted, small }: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
  small?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: muted ? 'var(--acme-text-muted)' : undefined, fontSize: small ? '13px' : undefined }}>{label}</span>
      <strong style={{ color: highlight ? 'var(--acme-purple)' : undefined, fontSize: highlight ? '1.1rem' : small ? '13px' : undefined }}>
        {value}
      </strong>
    </div>
  );
}

export function CartPage() {
  const navigate = useNavigate();
  const publicStore = usePublicStore();

  // Entrega
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('delivery');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [addressForm, setAddressForm] = useState<CustomerAddressForm>(createEmptyAddress());

  // Propina
  const [tipOption, setTipOption] = useState<TipOption>(0);
  const [customTip, setCustomTip] = useState('');
  const tipAmount = tipOption === 'custom' ? Math.max(0, parseFloat(customTip) || 0) : tipOption;

  // Cotización
  const [quote, setQuote] = useState<CourierQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteExpiredAt, setQuoteExpiredAt] = useState<number | null>(null);

  // Pago
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  const isAccountValidated = Boolean(publicStore.sessionUser?.email_confirmed_at);
  const customerEmail = (publicStore.sessionUser?.email || publicStore.profile?.email || '').trim() || undefined;
  const culqiPublicKey = String(import.meta.env.VITE_CULQI_PUBLIC_KEY || '').trim();
  const isCulqiSandbox = culqiPublicKey.startsWith('pk_test');

  // Pre-fill recipient from profile
  useEffect(() => {
    if (publicStore.profile) {
      setRecipientName((c) => c || publicStore.profile?.full_name || '');
      setRecipientPhone((c) => c || publicStore.profile?.phone || '');
    }
  }, [publicStore.profile]);

  // Cleanup Culqi on unmount
  useEffect(() => {
    return () => { window.culqi = undefined; };
  }, []);

  // Cargar script de Culqi en background
  useEffect(() => {
    if (!culqiPublicKey || publicStore.cartItems.length === 0) return;
    void loadCulqiScript().catch(() => undefined);
  }, [culqiPublicKey, publicStore.cartItems.length]);

  // Auto-expirar cotización
  useEffect(() => {
    if (!quoteExpiredAt) return;
    const remaining = quoteExpiredAt - Date.now();
    if (remaining <= 0) { invalidateQuote(); return; }
    const timer = setTimeout(() => {
      invalidateQuote();
      setQuoteError('La cotización expiró. Solicita una nueva para continuar.');
    }, remaining);
    return () => clearTimeout(timer);
  }, [quoteExpiredAt]);

  const invalidateQuote = () => {
    setQuote(null);
    setQuoteExpiredAt(null);
    setPendingOrderId(null);
    setPaymentMessage(null);
    setCheckoutError(null);
  };

  const canRequestQuote =
    publicStore.cartItems.length > 0 &&
    publicStore.sessionUser &&
    isAccountValidated &&
    recipientName.trim() &&
    recipientPhone.trim() &&
    (fulfillmentType === 'pickup' || (addressForm.line1.trim() && addressForm.city.trim()));

  const canCheckout = canRequestQuote && quote !== null;

  // Extraer branch_id del primer item del carrito
  const firstItem = publicStore.cartItems[0];

  // ─── Solicitar cotización al backend ────────────────────────────────────────
  const handleRequestQuote = async () => {
    if (!publicStore.sessionUser || publicStore.cartItems.length === 0) return;

    setQuoteLoading(true);
    setQuoteError(null);
    setQuote(null);
    setPendingOrderId(null);
    setPaymentMessage(null);
    setCheckoutError(null);

    try {
      const result = await courierPaymentService.createQuote({
        branch_id: firstItem.branch_id,
        payment_method: 'card',
        tip_amount: tipAmount,
        latitude: null, // Sin geolocalización aún
        longitude: null,
        fulfillment_type: fulfillmentType,
        items: publicStore.cartItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          modifier_ids: item.modifiers.map((m) => m.option_id),
        })),
      });

      setQuote(result);
      setQuoteExpiredAt(Date.now() + QUOTE_TTL_MS);
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'No se pudo obtener la cotización.');
    } finally {
      setQuoteLoading(false);
    }
  };

  // ─── Callback de Culqi ──────────────────────────────────────────────────────
  const handleCulqiCallback = async (orderId: string, culqiOrder: CourierCulqiOrderResponse) => {
    const currentCulqi = window.Culqi;

    if (currentCulqi?.token?.id) {
      const token = currentCulqi.token.id;
      currentCulqi.close?.();
      setSubmitting(true);
      setCheckoutError(null);
      setPaymentMessage('Validando pago con Culqi...');

      try {
        const result = await courierPaymentService.charge({
          order_id: orderId,
          payment_id: culqiOrder.payment_id,
          token,
          email_cliente: customerEmail,
          nombre_cliente: recipientName,
        });

        if (!result.exito) {
          setCheckoutError(result.mensaje || 'Culqi no confirmó el pago.');
          setPaymentMessage(`Pedido #${orderId.slice(-6)} creado con pago pendiente.`);
          setPaymentStatus('failed');
          return;
        }

        // Pago exitoso — limpiar carrito y redirigir
        setPaymentStatus('paid');
        finishCheckout(orderId);
      } catch (err) {
        setCheckoutError(err instanceof Error ? err.message : 'No se pudo confirmar el pago con Culqi.');
        setPaymentMessage(`Pedido creado con pago pendiente.`);
        setPaymentStatus('pending');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (currentCulqi?.order) {
      currentCulqi.close?.();
      setPaymentMessage('Pago iniciado en Culqi. El pedido queda pendiente hasta la confirmación del proveedor.');
      setPaymentStatus('pending');
      return;
    }

    const message =
      currentCulqi?.error?.user_message ||
      currentCulqi?.error?.merchant_message ||
      'Culqi no generó una respuesta de pago.';
    currentCulqi?.close?.();
    setCheckoutError(message);
    setPaymentMessage(`Pedido creado con pago pendiente.`);
    setPaymentStatus('pending');
    setSubmitting(false);
  };

  const finishCheckout = (orderId: string) => {
    window.Culqi?.close?.();
    window.culqi = undefined;
    publicStore.clearCart();
    navigate(`${AppRoutes.public.account}?tab=orders&orderId=${orderId}`);
  };

  // ─── Abrir Culqi para un pedido ya creado ────────────────────────────────────
  const openCulqiForOrder = async (orderId: string) => {
    const culqiRsaId = String(import.meta.env.VITE_CULQI_RSA_ID || '').trim();
    const culqiRsaPublicKey = String(import.meta.env.VITE_CULQI_RSA_PUBLIC_KEY || '').replace(/\\n/g, '\n').trim();
    const canUseCardPayment = Boolean(culqiRsaId && culqiRsaPublicKey);

    if (!culqiPublicKey) {
      setCheckoutError('Falta VITE_CULQI_PUBLIC_KEY en el frontend.');
      return;
    }
    if (!customerEmail) {
      setCheckoutError('Tu cuenta no tiene un email válido para Culqi.');
      return;
    }
    if (!quote) {
      setCheckoutError('No hay cotización vigente. Solicita una nueva.');
      return;
    }

    setSubmitting(true);
    setCheckoutError(null);
    setPaymentMessage('Creando orden segura Culqi...');

    try {
      await loadCulqiScript();
      const culqi = window.Culqi;
      if (!culqi) throw new Error('Culqi Checkout no está disponible.');

      // Crear orden Culqi usando el order_id del backend
      const culqiOrder = await courierPaymentService.createCheckoutOrder({
        order_id: orderId,
        email_cliente: customerEmail,
        nombre_cliente: recipientName,
        telefono_cliente: isCulqiSandbox ? CULQI_SANDBOX_YAPE_PHONE : recipientPhone,
        descripcion: `Pedido ACME #${orderId.slice(-6)}`,
      });

      window.culqi = () => {
        void handleCulqiCallback(orderId, culqiOrder);
      };

      culqi.publicKey = culqiPublicKey;
      const culqiSettings: Record<string, unknown> = {
        title: 'ACME Pedidos',
        currency: 'PEN',
        amount: culqiOrder.monto_centimos, // Viene del backend — orders.total * 100
        order: culqiOrder.order_id,
      };
      if (canUseCardPayment) {
        culqiSettings.xculqirsaid = culqiRsaId;
        culqiSettings.rsapublickey = culqiRsaPublicKey;
      }

      culqi.settings(culqiSettings);
      culqi.options({
        lang: 'es',
        installments: false,
        paymentMethods: {
          tarjeta: canUseCardPayment,
          yape: true,
          bancaMovil: true,
          agente: true,
          billetera: true,
          cuotealo: true,
        },
        style: {
          buttonBackground: '#ff6200',
          buttonText: 'Pagar',
          buttonTextColor: '#ffffff',
          priceColor: '#111827',
        },
      });
      culqi.open();
      setPaymentMessage(
        [
          canUseCardPayment
            ? 'Checkout Culqi abierto. Completa el pago en la ventana segura.'
            : 'Checkout abierto. Usa Yape, PagoEfectivo o billeteras.',
          isCulqiSandbox ? `Modo sandbox: Yape → ${CULQI_SANDBOX_YAPE_LABEL} + cualquier código de 6 dígitos.` : '',
        ].filter(Boolean).join(' ')
      );
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'No se pudo abrir Culqi.');
      setPaymentMessage(null);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Flujo principal de checkout ────────────────────────────────────────────
  const handleCheckout = async () => {
    if (!publicStore.sessionUser || !quote) return;

    // Si ya hay un pedido pendiente, reintentar el pago
    if (pendingOrderId) {
      await openCulqiForOrder(pendingOrderId);
      return;
    }

    setSubmitting(true);
    setCheckoutError(null);
    setPaymentMessage('Creando tu pedido...');

    try {
      // FASE 2: Crear pedido en el backend a partir del quote_id
      const orderResult = await courierPaymentService.createOrder({
        quote_id: quote.quote_id,
        fulfillment_type: fulfillmentType,
        special_instructions: specialInstructions || undefined,
        recipient_name: recipientName || undefined,
        recipient_phone: recipientPhone || undefined,
        address:
          fulfillmentType === 'delivery'
            ? {
                line1: addressForm.line1,
                line2: addressForm.line2 || undefined,
                reference: addressForm.reference || undefined,
                district: addressForm.district || undefined,
                city: addressForm.city || undefined,
                region: addressForm.region || undefined,
                country: addressForm.country || 'Peru',
              }
            : undefined,
      });

      const orderId = orderResult.order_id;
      setPendingOrderId(orderId);
      setSubmitting(false);

      // FASE 3: Abrir Culqi con el total que viene del backend
      await openCulqiForOrder(orderId);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'No se pudo crear el pedido.');
      setPaymentMessage(null);
      setSubmitting(false);
    }
  };

  // ─── UI ─────────────────────────────────────────────────────────────────────

  // Resumen de la cotización activa (o subtotal referencial del carrito)
  const cartSubtotal = publicStore.cartSubtotal;
  const activeQuote = quote;

  return (
    <section
      style={{
        minHeight: '100vh',
        padding: '108px 24px 56px',
        background:
          'radial-gradient(900px 320px at -10% 0%, rgba(77,20,140,.10), transparent 55%), radial-gradient(820px 360px at 105% 10%, rgba(255,98,0,.10), transparent 55%), #f7f7fb',
      }}
    >
      <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'grid', gap: '24px' }}>
        <section style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'end', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#ff6200' }}>Confirmación de Pedido</div>
            <h1 style={{ margin: 0, fontFamily: "'Poppins', sans-serif", fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#1d1630' }}>Tu carrito</h1>
            <p style={{ margin: 0, color: '#6b7280', lineHeight: 1.7, maxWidth: '760px' }}>
              Revisa tus productos, elige la propina y confirma los datos de entrega. El precio final lo calcula nuestro sistema.
            </p>
          </div>
          <Link to={AppRoutes.public.marketplace} className="btn-secondary" style={{ textDecoration: 'none' }}>
            Seguir comprando
          </Link>
        </section>

        {publicStore.cartItems.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty__icon"><BagIcon size={40} /></div>
            <strong style={{ fontSize: '1.25rem' }}>Tu carrito está vacío</strong>
            <span style={{ color: '#6b7280' }}>Explora locales y elige tus productos favoritos.</span>
            <div style={{ marginTop: '6px' }}>
              <Link to={AppRoutes.public.marketplace} className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <StoreIcon size={18} /> Ver negocios
              </Link>
            </div>
          </div>
        ) : (
          <div className="cart-grid-layout" style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: '24px', alignItems: 'start' }}>
            {/* ─── Columna izquierda ─── */}
            <div style={{ display: 'grid', gap: '24px' }}>

              {/* Productos */}
              <section className="account-card" style={{ padding: '24px' }}>
                <h2 className="cart-card-title">
                  <span className="cart-card-title__icon"><BagIcon size={20} /></span>
                  Productos en el carrito
                  <span className="cart-card-title__count">{publicStore.cartItems.length} {publicStore.cartItems.length === 1 ? 'ítem' : 'ítems'}</span>
                </h2>
                <div style={{ display: 'grid', gap: '16px' }}>
                  {publicStore.cartItems.map((item) => (
                    <div key={item.id} style={{ borderRadius: '22px', border: '1px solid #ecebf5', padding: '18px', display: 'grid', gap: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start' }}>
                        <div style={{ display: 'grid', gap: '4px' }}>
                          <strong style={{ fontSize: '15px' }}>{item.product_name}</strong>
                          <span style={{ color: '#6b7280', fontSize: '13px' }}>{item.merchant_name} · {item.branch_name}</span>
                          {item.modifiers.length > 0 && (
                            <span style={{ color: '#6b7280', fontSize: '13px' }}>
                              {item.modifiers.map((m) => m.name).join(', ')}
                            </span>
                          )}
                        </div>
                        <strong style={{ color: 'var(--acme-purple)', whiteSpace: 'nowrap' }}>
                          {formatMoney((item.unit_price + item.modifiers.reduce((s, m) => s + m.price_delta * m.quantity, 0)) * item.quantity)}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden' }}>
                          <button type="button" onClick={() => { invalidateQuote(); publicStore.updateItemQuantity(item.id, Math.max(1, item.quantity - 1)); }} style={{ border: 'none', background: '#fff', padding: '10px 14px', cursor: 'pointer' }}>−</button>
                          <strong style={{ minWidth: '40px', textAlign: 'center' }}>{item.quantity}</strong>
                          <button type="button" onClick={() => { invalidateQuote(); publicStore.updateItemQuantity(item.id, item.quantity + 1); }} style={{ border: 'none', background: '#fff', padding: '10px 14px', cursor: 'pointer' }}>+</button>
                        </div>
                        <input
                          className="account-input"
                          value={item.notes}
                          onChange={(e) => publicStore.updateItemNotes(item.id, e.target.value)}
                          placeholder="Notas especiales"
                          style={{ flex: 1, minWidth: '180px', paddingLeft: '16px' }}
                        />
                        <button type="button" className="btn-secondary" onClick={() => { invalidateQuote(); publicStore.removeItem(item.id); }} style={{ padding: '10px 16px', fontSize: '13px', color: '#ef4444', borderColor: '#fee2e2' }}>
                          Borrar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Datos de entrega */}
              {publicStore.sessionUser ? (
                <section className="account-card" style={{ padding: '24px' }}>
                  <h2 className="cart-card-title">
                    <span className="cart-card-title__icon cart-card-title__icon--orange"><TruckIcon size={20} /></span>
                    Entrega y contacto
                  </h2>
                  {!isAccountValidated && (
                    <div className="account-alert account-alert--warning" style={{ marginBottom: '20px' }}>
                      Debes validar tu correo electrónico antes de poder confirmar tu primer pedido.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button type="button" id="btn-fulfillment-delivery" className={`account-tab-btn ${fulfillmentType === 'delivery' ? 'account-tab-btn--active' : ''}`} onClick={() => { invalidateQuote(); setFulfillmentType('delivery'); }}>
                      Delivery
                    </button>
                    <button type="button" id="btn-fulfillment-pickup" className={`account-tab-btn ${fulfillmentType === 'pickup' ? 'account-tab-btn--active' : ''}`} onClick={() => { invalidateQuote(); setFulfillmentType('pickup'); }}>
                      Recojo en tienda
                    </button>
                  </div>

                  <div className="account-form">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="account-field">
                        <label className="account-label">Nombre de quien recibe</label>
                        <input id="input-recipient-name" className="account-input" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Juan Pérez" style={{ paddingLeft: '16px' }} />
                      </div>
                      <div className="account-field">
                        <label className="account-label">Teléfono</label>
                        <input id="input-recipient-phone" className="account-input" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="987 654 321" style={{ paddingLeft: '16px' }} />
                      </div>
                    </div>

                    {fulfillmentType === 'delivery' && (
                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div className="account-field">
                          <label className="account-label">Dirección exacta</label>
                          <input id="input-address-line1" className="account-input" value={addressForm.line1} onChange={(e) => { invalidateQuote(); setAddressForm({ ...addressForm, line1: e.target.value }); }} placeholder="Calle, número, dpto" style={{ paddingLeft: '16px' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                          <div className="account-field">
                            <label className="account-label">Distrito</label>
                            <input id="input-address-district" className="account-input" value={addressForm.district} onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })} style={{ paddingLeft: '16px' }} />
                          </div>
                          <div className="account-field">
                            <label className="account-label">Ciudad</label>
                            <input id="input-address-city" className="account-input" value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} style={{ paddingLeft: '16px' }} />
                          </div>
                          <div className="account-field">
                            <label className="account-label">Región</label>
                            <input id="input-address-region" className="account-input" value={addressForm.region} onChange={(e) => setAddressForm({ ...addressForm, region: e.target.value })} style={{ paddingLeft: '16px' }} />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="account-field">
                      <label className="account-label cart-label"><PencilIcon size={15} /> Instrucciones especiales</label>
                      <textarea
                        id="input-special-instructions"
                        className="account-input"
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        placeholder="Nota para el repartidor o restaurante..."
                        style={{ minHeight: '80px', paddingTop: '12px', paddingLeft: '16px' }}
                      />
                    </div>
                  </div>
                </section>
              ) : (
                <section className="account-card" style={{ padding: '3.5rem 2rem', textAlign: 'center', border: '2px dashed var(--acme-border)', borderRadius: '32px' }}>
                  <div style={{ width: '72px', height: '72px', background: 'rgba(77,20,140,0.08)', color: 'var(--acme-purple)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                    <UserIcon />
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>Acceso Requerido</h2>
                  <p style={{ color: 'var(--acme-text-muted)', maxWidth: '440px', margin: '0 auto 2rem', lineHeight: 1.6, fontSize: '0.95rem' }}>
                    Para completar tu pedido, inicia sesión o crea una cuenta nueva.
                  </p>
                  <Link to={`${AppRoutes.public.account}?redirect=${encodeURIComponent(AppRoutes.public.cart)}`} className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', padding: '16px 32px' }}>
                    Ingresar para completar pedido
                  </Link>
                </section>
              )}
            </div>

            {/* ─── Columna derecha: resumen y cotización ─── */}
            <aside style={{ position: 'sticky', top: '108px', display: 'grid', gap: '16px' }}>

              {/* Propina */}
              {publicStore.sessionUser && isAccountValidated && (
                <section className="account-card" style={{ padding: '20px' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px' }}>Propina para el repartidor</h2>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: tipOption === 'custom' ? '12px' : 0 }}>
                    {TIP_PRESETS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        id={`btn-tip-${t}`}
                        onClick={() => { setTipOption(t); invalidateQuote(); }}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          borderRadius: '12px',
                          border: `2px solid ${tipOption === t ? 'var(--acme-purple)' : '#e5e7eb'}`,
                          background: tipOption === t ? 'rgba(77,20,140,0.07)' : '#fff',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          color: tipOption === t ? 'var(--acme-purple)' : '#374151',
                          transition: 'all 0.15s',
                        }}
                      >
                        {t === 0 ? 'Sin propina' : `S/ ${t}.00`}
                      </button>
                    ))}
                    <button
                      type="button"
                      id="btn-tip-custom"
                      onClick={() => { setTipOption('custom'); invalidateQuote(); }}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        borderRadius: '12px',
                        border: `2px solid ${tipOption === 'custom' ? 'var(--acme-purple)' : '#e5e7eb'}`,
                        background: tipOption === 'custom' ? 'rgba(77,20,140,0.07)' : '#fff',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        color: tipOption === 'custom' ? 'var(--acme-purple)' : '#374151',
                        transition: 'all 0.15s',
                      }}
                    >
                      Otro monto
                    </button>
                  </div>
                  {tipOption === 'custom' && (
                    <input
                      id="input-custom-tip"
                      type="number"
                      min="0"
                      step="0.50"
                      className="account-input"
                      value={customTip}
                      onChange={(e) => { setCustomTip(e.target.value); invalidateQuote(); }}
                      placeholder="S/ 0.00"
                      style={{ paddingLeft: '16px', width: '100%' }}
                    />
                  )}
                </section>
              )}

              {/* Resumen de precio */}
              <section className="account-card" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '20px' }}>Resumen</h2>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {activeQuote ? (
                    /* Desglose completo de la cotización */
                    <>
                      <SummaryRow label="Subtotal productos" value={formatMoney(activeQuote.subtotal)} muted />
                      {activeQuote.discount > 0 && (
                        <SummaryRow label="Descuento" value={`-${formatMoney(activeQuote.discount)}`} muted small />
                      )}
                      <SummaryRow
                        label={`Tarifa de servicio (${(activeQuote.service_fee_rate * 100).toFixed(1)}%)`}
                        value={formatMoney(activeQuote.service_fee)}
                        muted
                        small
                      />
                      <SummaryRow
                        label={fulfillmentType === 'pickup' ? 'Recojo en tienda' : 'Envío'}
                        value={fulfillmentType === 'pickup' ? 'S/ 0.00' : formatMoney(activeQuote.delivery_fee)}
                        muted
                        small
                      />
                      {activeQuote.tip_amount > 0 && (
                        <SummaryRow label="Propina repartidor" value={formatMoney(activeQuote.tip_amount)} muted small />
                      )}
                      <div style={{ borderTop: '1px solid var(--acme-border)', paddingTop: '12px', marginTop: '4px' }}>
                        <SummaryRow label="Total" value={formatMoney(activeQuote.total)} highlight />
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                        ✓ Precio calculado y verificado por el servidor
                      </div>
                    </>
                  ) : (
                    /* Sin cotización: mostrar subtotal referencial */
                    <>
                      <SummaryRow label="Subtotal" value={formatMoney(cartSubtotal)} muted />
                      <SummaryRow label="Tarifa de servicio (3.6%)" value="—" muted small />
                      <SummaryRow label={fulfillmentType === 'pickup' ? 'Recojo en tienda' : 'Envío'} value="—" muted small />
                      {tipAmount > 0 && <SummaryRow label="Propina" value={formatMoney(tipAmount)} muted small />}
                      <div style={{ borderTop: '1px solid var(--acme-border)', paddingTop: '12px', marginTop: '4px' }}>
                        <SummaryRow label="Total estimado" value="Solicita cotización" highlight={false} />
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                        El precio final lo calcula el servidor
                      </div>
                    </>
                  )}
                </div>

                {/* Alertas */}
                {isCulqiSandbox && (
                  <div className="account-alert account-alert--warning" style={{ marginTop: '16px' }}>
                    Modo sandbox Culqi: para probar Yape usa {CULQI_SANDBOX_YAPE_LABEL} y cualquier código de 6 dígitos.
                  </div>
                )}
                {quoteError && <div className="account-alert account-alert--error" style={{ marginTop: '16px' }}>{quoteError}</div>}
                {checkoutError && <div className="account-alert account-alert--error" style={{ marginTop: '16px' }}>{checkoutError}</div>}
                {paymentMessage && (
                  <div className={`account-alert ${paymentStatus === 'paid' ? 'account-alert--success' : 'account-alert--warning'}`} style={{ marginTop: '16px' }}>
                    {paymentMessage}
                  </div>
                )}

                {/* Botones de acción */}
                {publicStore.sessionUser && (
                  <div style={{ display: 'grid', gap: '10px', marginTop: '20px' }}>
                    {/* Botón: Solicitar cotización */}
                    {!pendingOrderId && (
                      <button
                        id="btn-request-quote"
                        type="button"
                        className="btn-secondary"
                        style={{
                          width: '100%',
                          background: canRequestQuote && !quoteLoading ? 'rgba(77,20,140,0.08)' : '#f1f5f9',
                          borderColor: canRequestQuote ? 'var(--acme-purple)' : '#cbd5e1',
                          color: canRequestQuote ? 'var(--acme-purple)' : '#94a3b8',
                        }}
                        disabled={!canRequestQuote || quoteLoading}
                        onClick={handleRequestQuote}
                      >
                        {quoteLoading ? <><SpinnerIcon />Calculando...</> : activeQuote ? '↺ Recalcular precio' : 'Calcular precio final'}
                      </button>
                    )}

                    {/* Botón: Confirmar y pagar */}
                    <button
                      id="btn-checkout"
                      type="button"
                      className="btn-primary"
                      style={{
                        width: '100%',
                        background: canCheckout && !submitting ? 'var(--acme-orange)' : '#cbd5e1',
                      }}
                      disabled={!canCheckout || submitting}
                      onClick={handleCheckout}
                    >
                      {submitting
                        ? <><SpinnerIcon />Procesando...</>
                        : pendingOrderId
                        ? 'Reintentar pago Culqi'
                        : 'Confirmar y pagar'}
                    </button>
                  </div>
                )}
              </section>

              {!publicStore.sessionUser && (
                <div style={{ textAlign: 'center', padding: '0 12px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--acme-text-muted)', lineHeight: 1.6 }}>
                    ¿Aún no tienes cuenta? <br />
                    <Link to={`${AppRoutes.public.account}?tab=register&redirect=${encodeURIComponent(AppRoutes.public.cart)}`} style={{ color: 'var(--acme-purple)', fontWeight: 700, textDecoration: 'none' }}>Regístrate ahora</Link>
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
