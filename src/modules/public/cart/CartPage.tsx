import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

function formatMoney(value: number, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function loadCulqiScript() {
  if (window.Culqi) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
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
    script.onerror = () => reject(new Error('No se pudo cargar Culqi Checkout.'));
    document.body.appendChild(script);
  });
}

const UserIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
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
    const culqiPublicKey = String(import.meta.env.VITE_CULQI_PUBLIC_KEY || '').trim();
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
    setPaymentMessage('Preparando Culqi para el pedido real...');

    try {
      await loadCulqiScript();
      const culqi = window.Culqi;
      if (!culqi) throw new Error('Culqi Checkout no esta disponible.');

      const culqiOrder = await courierPaymentService.createCheckoutOrder({
        order_id: orderId,
        email_cliente: customerEmail,
        nombre_cliente: recipientName,
        telefono_cliente: recipientPhone,
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
        canUseCardPayment
          ? 'Checkout Culqi abierto. Completa el pago en la ventana segura.'
          : 'Checkout Culqi abierto. Pago con tarjeta no esta disponible temporalmente; usa Yape, PagoEfectivo o billeteras.'
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
              Revisa tus productos y completa los datos de entrega. Recuerda que operamos exclusivamente en la provincia de Huancavelica.
            </p>
          </div>
          <Link
            to={AppRoutes.public.marketplace}
            className="btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            Seguir comprando
          </Link>
        </section>

        {publicStore.cartItems.length === 0 ? (
          <div style={{ padding: '48px', borderRadius: '30px', background: '#fff', boxShadow: '0 16px 42px rgba(17,24,39,.06)', display: 'grid', gap: '16px', textAlign: 'center' }}>
            <strong style={{ fontSize: '1.2rem' }}>Tu carrito está vacío.</strong>
            <span style={{ color: '#6b7280' }}>Explora locales y elige tus productos favoritos.</span>
            <div>
              <Link to={AppRoutes.public.marketplace} className="btn-primary" style={{ textDecoration: 'none' }}>
                Ver negocios
              </Link>
            </div>
          </div>
        ) : (
          <div className="cart-grid-layout" style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: '24px', alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: '24px' }}>
              <section className="account-card" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '20px' }}>Productos en el carrito</h2>
                <div style={{ display: 'grid', gap: '16px' }}>
                  {publicStore.cartItems.map((item) => (
                    <div key={item.id} style={{ borderRadius: '22px', border: '1px solid #ecebf5', padding: '18px', display: 'grid', gap: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start' }}>
                        <div style={{ display: 'grid', gap: '4px' }}>
                          <strong style={{ fontSize: '15px' }}>{item.product_name}</strong>
                          <span style={{ color: '#6b7280', fontSize: '13px' }}>{item.merchant_name} · {item.branch_name}</span>
                          {item.modifiers.length > 0 ? (
                            <span style={{ color: '#6b7280', fontSize: '13px' }}>
                              {item.modifiers.map((modifier) => modifier.name).join(', ')}
                            </span>
                          ) : null}
                        </div>
                        <strong style={{ color: 'var(--acme-purple)' }}>{formatMoney((item.unit_price + item.modifiers.reduce((sum, modifier) => sum + modifier.price_delta * modifier.quantity, 0)) * item.quantity)}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden' }}>
                          <button type="button" onClick={() => { clearPendingOrder(); publicStore.updateItemQuantity(item.id, Math.max(1, item.quantity - 1)); }} style={{ border: 'none', background: '#fff', padding: '10px 14px', cursor: 'pointer' }}>−</button>
                          <strong style={{ minWidth: '40px', textAlign: 'center' }}>{item.quantity}</strong>
                          <button type="button" onClick={() => { clearPendingOrder(); publicStore.updateItemQuantity(item.id, item.quantity + 1); }} style={{ border: 'none', background: '#fff', padding: '10px 14px', cursor: 'pointer' }}>+</button>
                        </div>
                        <input
                          className="account-input"
                          value={item.notes}
                          onChange={(event) => { clearPendingOrder(); publicStore.updateItemNotes(item.id, event.target.value); }}
                          placeholder="Notas especiales"
                          style={{ flex: 1, minWidth: '180px', paddingLeft: '16px' }}
                        />
                        <button type="button" className="btn-secondary" onClick={() => { clearPendingOrder(); publicStore.removeItem(item.id); }} style={{ padding: '10px 16px', fontSize: '13px', color: '#ef4444', borderColor: '#fee2e2' }}>
                          Borrar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {publicStore.sessionUser ? (
                <section className="account-card" style={{ padding: '24px' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '20px' }}>Entrega y contacto</h2>
                  {!isAccountValidated && (
                    <div className="account-alert account-alert--warning" style={{ marginBottom: '20px' }}>
                      Debes validar tu correo electrónico antes de poder confirmar tu primer pedido.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button
                      type="button"
                      className={`account-tab-btn ${fulfillmentType === 'delivery' ? 'account-tab-btn--active' : ''}`}
                      onClick={() => setFulfillmentType('delivery')}
                    >
                      Delivery
                    </button>
                    <button
                      type="button"
                      className={`account-tab-btn ${fulfillmentType === 'pickup' ? 'account-tab-btn--active' : ''}`}
                      onClick={() => setFulfillmentType('pickup')}
                    >
                      Recojo en tienda
                    </button>
                  </div>

                  <div className="account-form">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="account-field">
                        <label className="account-label">Nombre de quien recibe</label>
                        <input className="account-input" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Juan Pérez" style={{ paddingLeft: '16px' }} />
                      </div>
                      <div className="account-field">
                        <label className="account-label">Teléfono</label>
                        <input className="account-input" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="987 654 321" style={{ paddingLeft: '16px' }} />
                      </div>
                    </div>

                    {fulfillmentType === 'delivery' && (
                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div className="account-field">
                          <label className="account-label">Dirección exacta</label>
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
                      <label className="account-label">Instrucciones especiales</label>
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
                    style={{ textDecoration: 'none', display: 'inline-flex', padding: '16px 32px' }}
                  >
                    Ingresar para completar pedido
                  </Link>
                </section>
              )}
            </div>

            <aside style={{ position: 'sticky', top: '108px', display: 'grid', gap: '24px' }}>
              <section className="account-card" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '20px' }}>Resumen</h2>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--acme-text-muted)' }}>Subtotal</span>
                    <strong>{formatMoney(cartSummary.subtotal)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--acme-text-muted)' }}>Delivery</span>
                    <span style={{ fontSize: '13px' }}>Huancavelica Prov.</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--acme-border)', paddingTop: '12px', fontSize: '1.1rem' }}>
                    <strong>Total</strong>
                    <strong style={{ color: 'var(--acme-purple)' }}>{formatMoney(cartSummary.total)}</strong>
                  </div>
                </div>
                {checkoutError && <div className="account-alert account-alert--error" style={{ marginTop: '16px' }}>{checkoutError}</div>}
                {paymentMessage && <div className="account-alert account-alert--warning" style={{ marginTop: '16px' }}>{paymentMessage}</div>}
                
                {publicStore.sessionUser ? (
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ marginTop: '20px', width: '100%', background: canCheckout ? 'var(--acme-orange)' : '#cbd5e1' }}
                    disabled={!canCheckout || submitting}
                    onClick={handleCheckout}
                  >
                    {submitting ? 'Procesando...' : pendingOrderId ? 'Reintentar pago Culqi' : 'Pagar pedido'}
                  </button>
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
