import { FormEvent, useContext, useMemo, useState, useRef, useEffect } from 'react';
import { toast } from '../../core/utils/toast';
import { PortalContext } from '../../modules/auth/session/PortalContext';
import { getAdminModuleByPath } from '../../core/admin/registry/moduleRegistry';
import { useLocation } from 'react-router-dom';
import { AdminModalForm } from '../../components/admin/AdminModalForm';
import { FieldGroup } from '../../components/admin/AdminFields';
import { FormStatusBar } from '../../components/admin/AdminScaffold';
import { TextField } from '../../components/ui/TextField';
import { getPortalActorLabel, getScopeLabel } from '../../core/auth/portalAccess';
import { authService } from '../../core/services/authService';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface PortalHeaderProps {
  onMenuClick: () => void;
}

export function PortalHeader({ onMenuClick }: PortalHeaderProps) {
  const portal = useContext(PortalContext);
  const location = useLocation();
  const activeModule = getAdminModuleByPath(location.pathname);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
  });

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const title = activeModule?.label ?? 'Resumen';
  const actorLabel = useMemo(
    () =>
      getPortalActorLabel({
        roleAssignments: portal.roleAssignments,
        profile: portal.profile,
        staffAssignment: portal.staffAssignment,
      }),
    [portal.profile, portal.roleAssignments, portal.staffAssignment]
  );

  const openProfileModal = () => {
    setProfileForm({
      full_name: portal.profile?.full_name ?? '',
      phone: portal.profile?.phone ?? '',
    });
    setProfileError(null);
    setProfileOpen(true);
    setDropdownOpen(false);
  };

  const closeProfileModal = () => {
    if (savingProfile) return;
    setProfileOpen(false);
  };

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!portal.sessionUserId) {
      setProfileError('No se encontró la sesión del usuario.');
      return;
    }

    setSavingProfile(true);
    setProfileError(null);

    const result = await authService.updateOwnPortalProfile({
      userId: portal.sessionUserId,
      full_name: profileForm.full_name,
      phone: profileForm.phone,
    });

    if (result.error) {
      setSavingProfile(false);
      setProfileError(result.error.message);
      toast.error('Error', result.error.message);
      return;
    }

    await portal.reloadPortalContext();
    setSavingProfile(false);
    toast.success('Perfil actualizado', 'Tus cambios han sido guardados correctamente.');
    setProfileOpen(false);
  };

  const handleLogoutRequested = () => {
    setDropdownOpen(false);
    setLogoutConfirmOpen(true);
  };

  const confirmLogout = async () => {
    setLogoutConfirmOpen(false);
    try {
      await authService.signOut();
      toast.success('Sesión cerrada', 'Hasta pronto.');
    } catch (err: any) {
      toast.error('Error al cerrar sesión', err.message);
    }
  };

  const initials = portal.profile?.full_name
    ? portal.profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'A';

  return (
    <>
      <header className="portal-header">
        <div className="portal-header__container">
          {/* Left: hamburger + title */}
          <div className="portal-header__left">
            <button className="portal-menu-btn" onClick={onMenuClick} aria-label="Abrir menú">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <div>
              <div className="portal-header__breadcrumb">Portal</div>
              <h1 className="portal-header__title">{title}</h1>
            </div>
          </div>

          {/* Center: Search */}
          <div className="portal-header__search">
            <div className="portal-header__search-input-wrapper">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="portal-header__search-placeholder">Buscar funciones...</span>
              <kbd className="portal-header__search-kbd">/</kbd>
            </div>
          </div>

          {/* Right: actions + user */}
          <div className="portal-header__right">
            <button className="portal-header-action" title="Notificaciones" aria-label="Notificaciones">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>

            <button className="portal-header-action" title="Ayuda" aria-label="Ayuda">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>

            <div className="portal-header-divider" />

            <div className="portal-header__user-wrapper" ref={dropdownRef}>
              <button
                type="button"
                className={`portal-user-btn ${dropdownOpen ? 'portal-user-btn--active' : ''}`}
                onClick={() => setDropdownOpen(!dropdownOpen)}
                title="Menú de usuario"
              >
                <div className="portal-user-btn__avatar">{initials}</div>
                <div className="portal-user-btn__info">
                  <span className="portal-user-btn__name">{portal.profile?.full_name || 'Admin'}</span>
                  <span className="portal-user-btn__scope">{getScopeLabel(portal.currentScopeType)}</span>
                </div>
                <svg className="portal-user-btn__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="portal-header__user-dropdown">
                  <button className="portal-header__user-dropdown-item" onClick={openProfileModal}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Editar perfil
                  </button>
                  <div className="portal-header__user-dropdown-divider" />
                  <button className="portal-header__user-dropdown-item portal-header__user-dropdown-item--danger" onClick={handleLogoutRequested}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Logout Confirmation */}
      <ConfirmDialog
        open={logoutConfirmOpen}
        title="¿Cerrar sesión?"
        description="Estás a punto de salir de tu cuenta ACME. Asegúrate de haber guardado tus cambios pendientes."
        confirmLabel="Cerrar sesión"
        cancelLabel="Volver"
        onConfirm={confirmLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      {/* Profile modal */}
      <AdminModalForm
        open={profileOpen}
        title="Mi perfil"
        description="Actualiza tus datos base del portal. Tus permisos y accesos se administran desde Seguridad."
        onClose={closeProfileModal}
        actions={
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', width: '100%' }}>
            <button 
              type="button" 
              onClick={closeProfileModal} 
              disabled={savingProfile} 
              className="btn btn--secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Cancelar
            </button>
            <button
              type="submit"
              form="portal-profile-form"
              disabled={savingProfile}
              className="btn btn--primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}
            >
              {savingProfile ? (
                 <>
                   <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                   Guardando...
                 </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Guardar cambios
                </>
              )}
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: '24px' }}>
          {/* Avatar Hero Section */}
          <div style={{ 
            padding: '24px', 
            borderRadius: '20px', 
            background: 'linear-gradient(135deg, var(--acme-purple-light) 0%, rgba(255,255,255,1) 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            border: '1px solid rgba(77,20,140,0.1)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'var(--acme-purple)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 800,
              boxShadow: '0 8px 16px rgba(77,20,140,0.2)'
            }}>
              {initials}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, color: 'var(--acme-text)', fontSize: '16px' }}>{portal.profile?.full_name || 'Admin de Sistema'}</div>
              <div style={{ color: 'var(--acme-text-faint)', fontSize: '12px' }}>{portal.profile?.email}</div>
            </div>
          </div>

          <FormStatusBar dirty saving={savingProfile} error={profileError} successMessage={null} />

          <form id="portal-profile-form" onSubmit={handleProfileSave} style={{ display: 'grid', gap: '20px' }}>
            <div className="form-grid">
              <FieldGroup label="Nombre maestro" hint="Nombre oficial para reportes y cabecera.">
                <TextField
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm((curr) => ({ ...curr, full_name: e.target.value }))}
                  placeholder="Tu nombre completo"
                />
              </FieldGroup>
              <FieldGroup label="Teléfono móvil" hint="Dato de contacto para soporte interno.">
                <TextField
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((curr) => ({ ...curr, phone: e.target.value }))}
                  placeholder="+51 000 000 000"
                />
              </FieldGroup>
            </div>

            <FieldGroup label="Credencial SSS (Solo lectura)" hint="El identificador de acceso es inmutable desde este panel.">
              <TextField value={portal.profile?.email || ''} disabled style={{ background: 'var(--acme-bg-soft)', borderStyle: 'dashed' }} />
            </FieldGroup>

            {/* Security Status Card */}
            <div style={{ 
              padding: '16px', 
              borderRadius: '16px', 
              background: 'var(--acme-bg-soft)', 
              border: '1px solid var(--acme-border)',
              display: 'grid',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--acme-purple)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.02em' }}>ESTADO DE SEGURIDAD</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'grid', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--acme-text-faint)', fontWeight: 600 }}>CAPA DE ACCESO</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--acme-text)' }}>{getScopeLabel(portal.currentScopeType).toUpperCase()}</span>
                </div>
                <div style={{ display: 'grid', gap: '4px', textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: 'var(--acme-text-faint)', fontWeight: 600 }}>PERFIL ACTIVO</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--acme-purple)' }}>{actorLabel.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      </AdminModalForm>
    </>
  );
}
