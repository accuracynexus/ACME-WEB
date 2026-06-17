import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './CartPage.css';
import { AppRoutes } from '../../../core/constants/routes';
import { CourierCulqiOrderResponse, courierPaymentService } from '../../../core/services/courierPaymentService';
import { CustomerAddressForm, publicCustomerService } from '../../../core/services/publicCustomerService';
import { usePublicStore } from '../store/PublicStoreContext';

type FulfillmentType = 'delivery' | 'pickup';

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

function createEmptyAddress(): CustomerAddressForm {
  return {
    label: 'Casa',
    is_default: true,
    line1: '',
    line2: '',
    reference: '',
    district: '',
    city: 'Huancayo',
    region: 'Junin',
    country: 'Peru',
  };
}

export function CartPage() {
  const navigate = useNavigate();
  const publicStore = usePublicStore();
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('delivery');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [addressForm, setAddressForm] = useState<CustomerAddressForm>(createEmptyAddress());
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const isAccountValidated = Boolean(publicStore.sessionUser?.email_confirmed_at);

  useEffect(() => {
    if (publicStore.profile) {
      setRecipientName((current) => current || publicStore.profile?.full_name || '');
      setRecipientPhone((current) => current || publicStore.profile?.phone || '');
    }
  }, [publicStore.profile]);

  useEffect(() => {
    return () => {
      window.culqi = undefined;
    };
  }, []);

  const canCheckout =
    publicStore.cartItems.length > 0 &&
    publicStore.sessionUser &&
    isAccountValidated &&
    recipientName.trim() &&
    recipientPhone.trim() &&
    (fulfillmentType === 'pickup' || (addressForm.line1.trim() && addressForm.city.trim()));

  const cartSummary = useMemo(() => {
    const subtotal = publicStore.cartSubtotal;
    return {
      subtotal,
      total: subtotal,
    };
  }, [publicStore.cartSubtotal]);

  const customerEmail = (publicStore.sessionUser?.email || publicStore.profile?.email || '').trim() || undefined;
  const culqiPublicKey = String(import.meta.env.VITE_CULQI_PUBLIC_KEY || '').trim();
  const isCulqiSandbox = culqiPublicKey.startsWith('pk_test');

  useEffect(() => {
    if (!culqiPublicKey || publicStore.cartItems.length === 0) return;
    void loadCulqiScript().catch(() => undefined);
  }, [culqiPublicKey, publicStore.cartItems.length]);

  const clearPendingOrder = () => {
    setPendingOrderId(null);
    setPaymentMessage(null);
  };

  const finishCheckout = (orderId: string) => {
    window.Culqi?.close?.();
    window.culqi = undefined;
    publicStore.clearCart();
    navigate(`${AppRoutes.public.account}?tab=orders&orderId=${orderId}`);
  };

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
          setCheckoutError(result.mensaje || 'Culqi no confirmo el pago.');
          setPaymentMessage(`Pedido ${orderId} creado con pago pendiente.`);
          return;
        }

        finishCheckout(orderId);
      } catch (err) {
        setCheckoutError(err instanceof Error ? err.message : 'No se pudo confirmar el pago con Culqi.');
        setPaymentMessage(`Pedido ${orderId} creado con pago pendiente.`);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (currentCulqi?.order) {
      currentCulqi.close?.();
      setPaymentMessage('Pago iniciado en Culqi. El pedido queda pendiente hasta la confirmacion del proveedor.');
      finishCheckout(orderId);
      return;
    }

    const message =
      currentCulqi?.error?.user_message ||
      currentCulqi?.error?.merchant_message ||
      'Culqi no genero una respuesta de pago.';
    currentCulqi?.close?.();
    setCheckoutError(message);
    setPaymentMessage(`Pedido ${orderId} creado con pago pendiente.`);
    setSubmitting(false);
  };

  const openCulqiForOrder = async (orderId: string) => {
    const culqiRsaId = String(import.meta.env.VITE_CULQI_RSA_ID || '').trim();
    const culqiRsaPublicKey = String(import.meta.env.VITE_CULQI_RSA_PUBLIC_KEY || '').replace(/\\n/g, '\n').trim();
    const canUseCardPayment = Boolean(culqiRsaId && culqiRsaPublicKey);
    if (!culqiPublicKey) {
      setCheckoutError('Falta VITE_CULQI_PUBLIC_KEY en el frontend.');
      return;
    }
    if (!customerEmail) {
      setCheckoutError('Tu cuenta no tiene un email valido para Culqi.');
      return;
    }

    setSubmitting(true);
    setCheckoutError(null);
    setPaymentMessage('Creando orden segura Culqi...');

    try {
      await loadCulqiScript();
      const culqi = window.Culqi;
      if (!culqi) throw new Error('Culqi Checkout no esta disponible.');

      const culqiOrder = await courierPaymentService.createCheckoutOrder({
        order_id: orderId,
        email_cliente: customerEmail,
        nombre_cliente: recipientName,
        telefono_cliente: isCulqiSandbox ? CULQI_SANDBOX_YAPE_PHONE : recipientPhone,
        descripcion: `Pedido ACME Courier ${orderId}`,
      });

      window.culqi = () => {
        void handleCulqiCallback(orderId, culqiOrder);
      };

      culqi.publicKey = culqiPublicKey;
      const culqiSettings: Record<string, unknown> = {
        title: 'ACME Pedidos',
        currency: 'PEN',
        amount: culqiOrder.monto_centimos,
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
            : 'Checkout Culqi abierto. Pago con tarjeta no esta disponible temporalmente; usa Yape, PagoEfectivo o billeteras.',
          isCulqiSandbox ? `Modo sandbox: para probar Yape usa ${CULQI_SANDBOX_YAPE_LABEL} y cualquier codigo de 6 digitos.` : '',
        ].filter(Boolean).join(' ')
      );
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'No se pudo abrir Culqi.');
      setPaymentMessage(`Pedido ${orderId} creado con pago pendiente.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async () => {
    if (!publicStore.sessionUser || publicStore.cartItems.length === 0) return;

    if (pendingOrderId) {
      await openCulqiForOrder(pendingOrderId);
      return;
    }

    setSubmitting(true);
    setCheckoutError(null);
    setPaymentMessage(null);

    const firstItem = publicStore.cartItems[0];
    const result = await publicCustomerService.placeOrderFromCart(publicStore.sessionUser.id, {
      merchant_id: firstItem.merchant_id,
      branch_id: firstItem.branch_id,
      fulfillment_type: fulfillmentType,
      special_instructions: specialInstructions,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      address: addressForm,
      save_address: fulfillmentType === 'delivery',
      items: publicStore.cartItems.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        unit_price: item.unit_price,
        quantity: item.quantity,
        notes: item.notes,
        modifiers: item.modifiers,
      })),
    });

    if (result.error) {
      setSubmitting(false);
      setCheckoutError(result.error.message);
      return;
    }

    const orderId = result.data?.order_id;
    if (!orderId) {
      setSubmitting(false);
      setCheckoutError('El pedido se creo sin identificador de Supabase.');
      return;
    }

    setPendingOrderId(orderId);
    await openCulqiForOrder(orderId);
  };

  return (
    <section className="cart-page">
      <div className="cart-shell">
        <section className="cart-head">
          <div>
            <div className="cart-head__eyebrow"><BagIcon size={14} /> Confirmación de Pedido</div>
            <h1 className="cart-head__title">Tu carrito</h1>
            <p className="cart-head__sub">
              Revisa tus productos y completa los datos de entrega. Recuerda que operamos exclusivamente en la provincia de Huancavelica.
            </p>
          </div>
          <Link to={AppRoutes.public.marketplace} className="cart-back-btn">
            <ArrowLeftIcon /> Seguir comprando
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
          <div className="cart-grid-layout">
            <div className="cart-col">
              <section className="account-card" style={{ padding: '24px' }}>
                <h2 className="cart-card-title">
                  <span className="cart-card-title__icon"><BagIcon size={20} /></span>
                  Productos en el carrito
                  <span className="cart-card-title__count">{publicStore.cartItems.length} {publicStore.cartItems.length === 1 ? 'ítem' : 'ítems'}</span>
                </h2>
                <div style={{ display: 'grid', gap: '16px' }}>
                  {publicStore.cartItems.map((item) => (
                    <div key={item.id} className="cart-item">
                      {item.image_url ? (
                        <img className="cart-item__thumb" src={item.image_url} alt={item.product_name} loading="lazy"
                          onError={(e) => { const el = e.currentTarget; el.style.display = 'none'; const ph = el.nextElementSibling as HTMLElement | null; if (ph) ph.style.display = 'flex'; }}
                        />
                      ) : null}
                      <div className="cart-item__thumb cart-item__thumb--ph" style={{ display: item.image_url ? 'none' : 'flex' }}>
                        <ImageIcon />
                      </div>
                      <div className="cart-item__main">
                        <div className="cart-item__top">
                          <div style={{ minWidth: 0 }}>
                            <div className="cart-item__name">{item.product_name}</div>
                            <div className="cart-item__meta"><StoreIcon size={13} /> {item.merchant_name} · {item.branch_name}</div>
                            {item.modifiers.length > 0 ? (
                              <div className="cart-item__mods">{item.modifiers.map((modifier) => modifier.name).join(', ')}</div>
                            ) : null}
                          </div>
                          <strong className="cart-item__price">{formatMoney((item.unit_price + item.modifiers.reduce((sum, modifier) => sum + modifier.price_delta * modifier.quantity, 0)) * item.quantity)}</strong>
                        </div>
                        <div className="cart-item__controls">
                          <div className="cart-stepper">
                            <button type="button" aria-label="Quitar uno" onClick={() => { clearPendingOrder(); publicStore.updateItemQuantity(item.id, Math.max(1, item.quantity - 1)); }}><MinusIcon /></button>
                            <span className="cart-stepper__count">{item.quantity}</span>
                            <button type="button" aria-label="Agregar uno" onClick={() => { clearPendingOrder(); publicStore.updateItemQuantity(item.id, item.quantity + 1); }}><PlusIcon /></button>
                          </div>
                          <div className="cart-note-wrap">
                            <PencilIcon size={15} />
                            <input
                              className="account-input"
                              value={item.notes}
                              onChange={(event) => { clearPendingOrder(); publicStore.updateItemNotes(item.id, event.target.value); }}
                              placeholder="Notas especiales"
                            />
                          </div>
                          <button type="button" className="cart-remove-btn" onClick={() => { clearPendingOrder(); publicStore.removeItem(item.id); }}>
                            <TrashIcon /> Borrar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

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
                  <div className="cart-fulfillment">
                    <button
                      type="button"
                      className={`account-tab-btn ${fulfillmentType === 'delivery' ? 'account-tab-btn--active' : ''}`}
                      onClick={() => setFulfillmentType('delivery')}
                    >
                      <TruckIcon /> Delivery
                    </button>
                    <button
                      type="button"
                      className={`account-tab-btn ${fulfillmentType === 'pickup' ? 'account-tab-btn--active' : ''}`}
                      onClick={() => setFulfillmentType('pickup')}
                    >
                      <StoreIcon /> Recojo en tienda
                    </button>
                  </div>

                  <div className="account-form">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="account-field">
                        <label className="account-label cart-label"><UserIcon size={15} /> Nombre de quien recibe</label>
                        <input className="account-input" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Juan Pérez" style={{ paddingLeft: '16px' }} />
                      </div>
                      <div className="account-field">
                        <label className="account-label cart-label"><PhoneIcon size={15} /> Teléfono</label>
                        <input className="account-input" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="987 654 321" style={{ paddingLeft: '16px' }} />
                      </div>
                    </div>

                    {fulfillmentType === 'delivery' && (
                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div className="account-field">
                          <label className="account-label cart-label"><MapPinIcon size={15} /> Dirección exacta</label>
                          <input className="account-input" value={addressForm.line1} onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })} placeholder="Calle, número, dpto" style={{ paddingLeft: '16px' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                          <div className="account-field">
                            <label className="account-label">Distrito</label>
                            <input className="account-input" value={addressForm.district} onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })} style={{ paddingLeft: '16px' }} />
                          </div>
                          <div className="account-field">
                            <label className="account-label">Ciudad</label>
                            <input className="account-input" value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} style={{ paddingLeft: '16px' }} />
                          </div>
                          <div className="account-field">
                            <label className="account-label">Región</label>
                            <input className="account-input" value={addressForm.region} onChange={(e) => setAddressForm({ ...addressForm, region: e.target.value })} style={{ paddingLeft: '16px' }} />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="account-field">
                      <label className="account-label cart-label"><PencilIcon size={15} /> Instrucciones especiales</label>
                      <textarea
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
                    Para completar o continuar con tu pedido, por favor inicia sesión o crea una nueva cuenta. Solo operamos en la provincia de Huancavelica.
                  </p>
                  <Link
                    to={`${AppRoutes.public.account}?redirect=${encodeURIComponent(AppRoutes.public.cart)}`}
                    className="btn-primary"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '16px 32px' }}
                  >
                    <LockIcon size={18} /> Ingresar para completar pedido
                  </Link>
                </section>
              )}
            </div>

            <aside className="cart-summary-aside">
              <section className="account-card" style={{ padding: '24px' }}>
                <h2 className="cart-card-title">
                  <span className="cart-card-title__icon"><ReceiptIcon size={20} /></span>
                  Resumen
                </h2>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div className="cart-summary-row">
                    <span>Subtotal</span>
                    <strong>{formatMoney(cartSummary.subtotal)}</strong>
                  </div>
                  <div className="cart-summary-row">
                    <span>Delivery</span>
                    <span style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><MapPinIcon size={14} /> Huancavelica Prov.</span>
                  </div>
                  <div className="cart-summary-total">
                    <strong>Total</strong>
                    <strong>{formatMoney(cartSummary.total)}</strong>
                  </div>
                </div>
                {isCulqiSandbox && (
                  <div className="account-alert account-alert--warning" style={{ marginTop: '16px' }}>
                    Modo sandbox Culqi: para probar Yape usa {CULQI_SANDBOX_YAPE_LABEL} y cualquier codigo de 6 digitos.
                  </div>
                )}
                {checkoutError && <div className="account-alert account-alert--error" style={{ marginTop: '16px' }}>{checkoutError}</div>}
                {paymentMessage && <div className="account-alert account-alert--warning" style={{ marginTop: '16px' }}>{paymentMessage}</div>}

                {publicStore.sessionUser ? (
                  <>
                    <button
                      type="button"
                      className="cart-pay-btn"
                      disabled={!canCheckout || submitting}
                      onClick={handleCheckout}
                    >
                      <LockIcon size={18} />
                      {submitting ? 'Procesando...' : pendingOrderId ? 'Reintentar pago Culqi' : 'Pagar pedido'}
                    </button>
                    <div className="cart-trust">
                      <span className="cart-trust__item"><ShieldIcon /> Pago seguro</span>
                      <span className="cart-trust__item"><LockIcon size={15} /> Datos cifrados</span>
                      <span className="cart-trust__item"><ZapIcon /> Yape y tarjetas</span>
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,98,0,0.05)', borderRadius: '16px', border: '1px solid rgba(255,98,0,0.1)' }}>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--acme-text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                      Identifícate para poder habilitar el botón de confirmación.
                    </p>
                  </div>
                )}
              </section>
              
              {!publicStore.sessionUser && (
                <div style={{ textAlign: 'center', padding: '0 12px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--acme-text-muted)', lineHeight: 1.6 }}>
                    ¿Aún no tienes cuenta? <br/>
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
