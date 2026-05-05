import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { publicCustomerService, CustomerAccountSnapshot, CustomerAddressForm } from '../../../core/services/publicCustomerService';
import { usePublicStore } from '../store/PublicStoreContext';
import './AccountPage.css';

type AccountTab = 'profile' | 'addresses' | 'orders';
type AuthMode = 'login' | 'register';

function formatMoney(value: number, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function emptyAddress(): CustomerAddressForm {
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

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'placed' || normalized === 'pending') return '#9a3412';
  if (normalized === 'confirmed' || normalized === 'preparing' || normalized === 'ready' || normalized === 'on_the_way') return '#1d4ed8';
  if (normalized === 'delivered') return '#166534';
  if (normalized === 'cancelled' || normalized === 'rejected') return '#b91c1c';
  return '#4b5563';
}

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const MailIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <polyline points="22,6 12,13 2,6"></polyline>
  </svg>
);

const PhoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

const MapPinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);

const PackageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.6"></line>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
);

const LocationIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>
);

const ShieldAlertIcon = () => (
  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

export function AccountPage() {
  const navigate = useNavigate();
  const publicStore = usePublicStore();
  const [searchParams] = useSearchParams();
  const requestedTab = (searchParams.get('tab') as AccountTab | null) ?? 'profile';
  const requestedOrderId = searchParams.get('orderId');
  const [activeTab, setActiveTab] = useState<AccountTab>(requestedTab);
  const [snapshot, setSnapshot] = useState<CustomerAccountSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '', phone: '' });
  const [addressForm, setAddressForm] = useState<CustomerAddressForm>(emptyAddress());
  const [saving, setSaving] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerForm, setRegisterForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(requestedOrderId);

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);

  const loadAccount = async () => {
    if (!publicStore.sessionUser) return;
    setLoading(true);
    setError(null);
    const result = await publicCustomerService.fetchAccountSnapshot(publicStore.sessionUser.id);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSnapshot(result.data);
    setProfileForm({
      full_name: result.data?.profile.full_name || '',
      email: result.data?.profile.email || publicStore.sessionUser.email || '',
      phone: result.data?.profile.phone || '',
    });
    if (!selectedOrderId && result.data?.orders[0]?.id) {
      setSelectedOrderId(result.data.orders[0].id);
    }
  };

  useEffect(() => {
    loadAccount();
  }, [publicStore.sessionUser]);

  useEffect(() => {
    if (requestedOrderId) {
      setSelectedOrderId(requestedOrderId);
      setActiveTab('orders');
    }
  }, [requestedOrderId]);

  const selectedOrder = useMemo(
    () => snapshot?.orders.find((order) => order.id === selectedOrderId) ?? snapshot?.orders[0] ?? null,
    [selectedOrderId, snapshot]
  );

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!publicStore.sessionUser) return;
    setSaving(true);
    setError(null);
    const result = await publicCustomerService.saveProfile(publicStore.sessionUser.id, {
      full_name: profileForm.full_name,
      email: profileForm.email,
      phone: profileForm.phone,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await publicStore.reloadPublicSession();
    await loadAccount();
  };

  const saveAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!publicStore.sessionUser) return;
    setSaving(true);
    setError(null);
    const result = await publicCustomerService.saveAddress(publicStore.sessionUser.id, addressForm);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setAddressForm(emptyAddress());
    await loadAccount();
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setSaving(true);

    if (authMode === 'login') {
      const result = await publicStore.signInCustomer(loginEmail, loginPassword);
      setSaving(false);
      if (result.error) {
        setAuthError(result.error.message);
      } else {
        const redirectTo = searchParams.get('redirect');
        if (redirectTo) {
          navigate(redirectTo);
        }
      }
      return;
    }

    const result = await publicStore.signUpCustomer(registerForm);
    setSaving(false);
    if (result.error) {
      setAuthError(result.error.message);
      return;
    }
    
    if (result.data.session) {
      const redirectTo = searchParams.get('redirect');
      if (redirectTo) {
        navigate(redirectTo);
      }
    } else {
      setAuthError('Tu cuenta fue creada. Revisa tu correo para validarla y vuelve a entrar.');
    }
  };

  if (!publicStore.sessionUser) {
    return (
      <main className="account-page">
        <div className="account-container">
          <header className="account-header">
            <div className="account-header__eyebrow">Acceso Seguro</div>
            <h1 className="account-header__title">
              {authMode === 'login' ? 'Bienvenido de nuevo' : 'Únete a ACME'}
            </h1>
            <p className="account-header__subtitle">
              Gestiona tus pedidos y direcciones en la red más eficiente de la provincia.
            </p>
          </header>

          <section className="account-card auth-card">
            <div className="account-tabs">
              <button
                type="button"
                className={`account-tab-btn ${authMode === 'login' ? 'account-tab-btn--active' : ''}`}
                onClick={() => { setAuthMode('login'); setAuthError(null); }}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                className={`account-tab-btn ${authMode === 'register' ? 'account-tab-btn--active' : ''}`}
                onClick={() => { setAuthMode('register'); setAuthError(null); }}
              >
                Crear Cuenta
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="account-form">
              {authMode === 'register' ? (
                <>
                  <div className="account-field">
                    <label className="account-label">Nombre completo</label>
                    <div className="account-input-wrapper">
                      <input
                        className="account-input"
                        value={registerForm.full_name}
                        onChange={(e) => setRegisterForm({ ...registerForm, full_name: e.target.value })}
                        placeholder="Ej. Juan Pérez"
                        required
                      />
                      <div className="account-input-icon"><UserIcon /></div>
                    </div>
                  </div>
                  <div className="account-field">
                    <label className="account-label">Teléfono</label>
                    <div className="account-input-wrapper">
                      <input
                        className="account-input"
                        value={registerForm.phone}
                        onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                        placeholder="987 654 321"
                        required
                      />
                      <div className="account-input-icon"><PhoneIcon /></div>
                    </div>
                  </div>
                </>
              ) : null}

              <div className="account-field">
                <label className="account-label">Correo electrónico</label>
                <div className="account-input-wrapper">
                  <input
                    className="account-input"
                    type="email"
                    value={authMode === 'register' ? registerForm.email : loginEmail}
                    onChange={(e) => authMode === 'register' 
                      ? setRegisterForm({ ...registerForm, email: e.target.value })
                      : setLoginEmail(e.target.value)
                    }
                    placeholder="usuario@correo.com"
                    required
                  />
                  <div className="account-input-icon"><MailIcon /></div>
                </div>
              </div>

              <div className="account-field">
                <label className="account-label">Contraseña</label>
                <div className="account-input-wrapper">
                  <input
                    className="account-input"
                    type="password"
                    value={authMode === 'register' ? registerForm.password : loginPassword}
                    onChange={(e) => authMode === 'register'
                      ? setRegisterForm({ ...registerForm, password: e.target.value })
                      : setLoginPassword(e.target.value)
                    }
                    placeholder="••••••••"
                    required
                  />
                  <div className="account-input-icon"><LockIcon /></div>
                </div>
              </div>

              {authError && (
                <div className="account-alert account-alert--error">
                  <ShieldAlertIcon />
                  <span>{authError}</span>
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? (
                  <>
                    <div className="spinner" style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <span>{authMode === 'register' ? 'Registrarme ahora' : 'Ingresar a mi cuenta'}</span>
                )}
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="account-page">
      <div className="account-container">
        <header className="account-header">
          <div className="account-header__eyebrow">Panel de Cliente</div>
          <h1 className="account-header__title">Mi Cuenta</h1>
          <p className="account-header__subtitle">
            Gestiona tus datos personales, direcciones de entrega y revisa el historial de tus pedidos realizados.
          </p>
        </header>

        {!publicStore.sessionUser.email_confirmed_at && (
          <div className="account-alert account-alert--warning" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <LocationIcon />
              <span>Tu cuenta aún no está confirmada. Revisa tu correo para validar el acceso.</span>
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '13px' }}
              onClick={async () => {
                if (publicStore.sessionUser?.email) {
                  await publicStore.resendVerification(publicStore.sessionUser.email);
                }
              }}
            >
              Reenviar correo
            </button>
          </div>
        )}

        <nav className="account-tabs">
          <button
            type="button"
            className={`account-tab-btn ${activeTab === 'profile' ? 'account-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <UserIcon />
            Perfil
          </button>
          <button
            type="button"
            className={`account-tab-btn ${activeTab === 'addresses' ? 'account-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('addresses')}
          >
            <MapPinIcon />
            Direcciones
          </button>
          <button
            type="button"
            className={`account-tab-btn ${activeTab === 'orders' ? 'account-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <PackageIcon />
            Pedidos
          </button>
        </nav>

        {loading && (
          <div className="account-card" style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 10px', width: '24px', height: '24px', border: '3px solid rgba(77,20,140,0.1)', borderTopColor: 'var(--acme-purple)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--acme-text-muted)' }}>Cargando información...</p>
          </div>
        )}
        
        {error && <div className="account-alert account-alert--error">{error}</div>}

        {!loading && activeTab === 'profile' && (
          <section className="account-card">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Datos Personales</h2>
            <form onSubmit={saveProfile} className="account-form" style={{ maxWidth: '600px' }}>
              <div className="account-field">
                <label className="account-label">Nombre Completo</label>
                <div className="account-input-wrapper">
                  <input
                    className="account-input"
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    placeholder="Tu nombre"
                    required
                  />
                  <div className="account-input-icon"><UserIcon /></div>
                </div>
              </div>
              <div className="account-field">
                <label className="account-label">Correo Electrónico (Solo lectura)</label>
                <div className="account-input-wrapper">
                  <input
                    className="account-input"
                    value={profileForm.email}
                    readOnly
                    placeholder="tu@correo.com"
                  />
                  <div className="account-input-icon"><MailIcon /></div>
                </div>
              </div>
              <div className="account-field">
                <label className="account-label">Teléfono de contacto</label>
                <div className="account-input-wrapper">
                  <input
                    className="account-input"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="987 654 321"
                    required
                  />
                  <div className="account-input-icon"><PhoneIcon /></div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--acme-text-muted)', fontSize: '14px' }}>
                  <span>⭐ Rating de cliente:</span>
                  <strong style={{ color: 'var(--acme-text)' }}>{snapshot?.profile.rating_avg ?? 0} / 5</strong>
                </div>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Actualizar Perfil'}
                </button>
              </div>
            </form>
          </section>
        )}

        {!loading && activeTab === 'addresses' && (
          <div className="account-grid">
            <section className="account-card">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Mis Direcciones</h2>
              <div className="card-list">
                {snapshot?.addresses.length ? (
                  snapshot.addresses.map((address) => (
                    <button
                      key={address.relation_id}
                      type="button"
                      className={`card-item ${addressForm.relation_id === address.relation_id ? 'card-item--active' : ''}`}
                      onClick={() => setAddressForm(address)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '15px' }}>{address.label}</strong>
                        {address.is_default && <span className="status-badge" style={{ background: 'rgba(77,20,140,0.1)', color: 'var(--acme-purple)' }}>Principal</span>}
                      </div>
                      <span style={{ color: 'var(--acme-text-muted)', fontSize: '14px' }}>{address.line1}</span>
                      <span style={{ color: 'var(--acme-text-muted)', fontSize: '12px', opacity: 0.8 }}>
                        {[address.district, address.city, address.region].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  ))
                ) : (
                  <p style={{ color: 'var(--acme-text-muted)', textAlign: 'center', padding: '2rem 0' }}>Aún no has registrado direcciones.</p>
                )}
              </div>
            </section>

            <section className="account-card">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>
                {addressForm.relation_id ? 'Editar Dirección' : 'Nueva Dirección'}
              </h2>
              <form onSubmit={saveAddress} className="account-form">
                <div className="account-field">
                  <label className="account-label">Etiqueta (Ej. Casa, Oficina)</label>
                  <input
                    className="account-input"
                    value={addressForm.label}
                    onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                    placeholder="Nombre del lugar"
                    required
                    style={{ paddingLeft: '16px' }}
                  />
                </div>
                <div className="account-field">
                  <label className="account-label">Dirección exacta</label>
                  <input
                    className="account-input"
                    value={addressForm.line1}
                    onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                    placeholder="Calle, número, dpto"
                    required
                    style={{ paddingLeft: '16px' }}
                  />
                </div>
                <div className="account-field">
                  <label className="account-label">Referencia (Opcional)</label>
                  <input
                    className="account-input"
                    value={addressForm.reference}
                    onChange={(e) => setAddressForm({ ...addressForm, reference: e.target.value })}
                    placeholder="Ej. Cerca al parque central"
                    style={{ paddingLeft: '16px' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="account-field">
                    <label className="account-label">Distrito</label>
                    <input
                      className="account-input"
                      value={addressForm.district}
                      onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })}
                      required
                      style={{ paddingLeft: '16px' }}
                    />
                  </div>
                  <div className="account-field">
                    <label className="account-label">Ciudad</label>
                    <input
                      className="account-input"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      required
                      style={{ paddingLeft: '16px' }}
                    />
                  </div>
                </div>
                <label style={{ display: 'inline-flex', gap: '10px', alignItems: 'center', cursor: 'pointer', userSelect: 'none', color: 'var(--acme-text-muted)', fontSize: '14px' }}>
                  <input type="checkbox" checked={addressForm.is_default} onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })} />
                  Establecer como dirección principal
                </label>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="button" className="btn-secondary" onClick={() => setAddressForm(emptyAddress())}>
                    Limpiar
                  </button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar Dirección'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {!loading && activeTab === 'orders' && (
          <div className="account-grid" style={{ gridTemplateColumns: '400px 1fr' }}>
            <section className="account-card">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Historial</h2>
              <div className="card-list">
                {snapshot?.orders.length ? (
                  snapshot.orders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      className={`card-item ${selectedOrderId === order.id ? 'card-item--active' : ''}`}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--acme-purple)' }}>#{order.order_code}</strong>
                        <span className="status-badge" style={{ background: statusTone(order.status) + '20', color: statusTone(order.status) }}>
                          {order.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{order.merchant_label}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--acme-text-muted)' }}>
                        <span>{formatDateTime(order.placed_at)}</span>
                        <strong style={{ color: 'var(--acme-text)' }}>{formatMoney(order.total, order.currency)}</strong>
                      </div>
                    </button>
                  ))
                ) : (
                  <p style={{ color: 'var(--acme-text-muted)', textAlign: 'center' }}>No tienes pedidos registrados.</p>
                )}
              </div>
            </section>

            <section className="account-card">
              {selectedOrder ? (
                <div className="detail-view">
                  <header className="detail-header">
                    <div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Pedido #{selectedOrder.order_code}</h2>
                      <p style={{ margin: '4px 0', color: 'var(--acme-text-muted)' }}>{selectedOrder.merchant_label} · {selectedOrder.branch_label}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="status-badge" style={{ background: statusTone(selectedOrder.status) + '20', color: statusTone(selectedOrder.status), fontSize: '14px' }}>
                        {selectedOrder.status}
                      </span>
                      <h3 style={{ margin: '8px 0 0', fontSize: '1.25rem' }}>{formatMoney(selectedOrder.total, selectedOrder.currency)}</h3>
                    </div>
                  </header>

                  <div className="detail-section">
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, borderBottom: '1px solid var(--acme-border)', paddingBottom: '8px' }}>Resumen del pedido</h3>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {selectedOrder.items.map((item) => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                          <div style={{ display: 'grid', gap: '2px' }}>
                            <strong style={{ fontSize: '14px' }}>{item.quantity}x {item.product_name_snapshot}</strong>
                            {item.modifiers.length > 0 && (
                              <span style={{ fontSize: '12px', color: 'var(--acme-text-muted)' }}>
                                Extras: {item.modifiers.map(m => m.option_name_snapshot).join(', ')}
                              </span>
                            )}
                            {item.notes && <span style={{ fontSize: '12px', color: 'var(--acme-orange)', fontStyle: 'italic' }}>Nota: {item.notes}</span>}
                          </div>
                          <span>{formatMoney(item.line_total, selectedOrder.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section" style={{ background: 'rgba(241, 245, 249, 0.5)', padding: '16px', borderRadius: '16px' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: '0 0 8px' }}>Información de Entrega</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--acme-text-muted)' }}>
                      {selectedOrder.fulfillment_type === 'delivery' 
                        ? selectedOrder.address_snapshot || 'Entrega a domicilio'
                        : 'Recojo en tienda local'}
                    </p>
                  </div>

                  <div className="detail-section">
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: '0 0 12px' }}>Línea de tiempo</h3>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {selectedOrder.history.map((entry) => (
                        <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--acme-purple)', marginTop: '5px' }} />
                            <div style={{ display: 'grid' }}>
                              <strong style={{ color: 'var(--acme-text)' }}>{entry.to_status}</strong>
                              <span style={{ color: 'var(--acme-text-muted)' }}>{entry.note || 'Actualización de estado'}</span>
                            </div>
                          </div>
                          <span style={{ color: 'var(--acme-text-muted)' }}>{formatDateTime(entry.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--acme-text-muted)' }}>
                  <PackageIcon />
                  <p style={{ marginTop: '1rem', fontWeight: 600 }}>Selecciona un pedido para ver los detalles completos.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
