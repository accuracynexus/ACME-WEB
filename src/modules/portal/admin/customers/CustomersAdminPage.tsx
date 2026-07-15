import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminPageFrame, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { SectionSkeleton } from '../../../../components/shared/Skeleton';
import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { TextField } from '../../../../components/ui/TextField';
import { AppRoutes } from '../../../../core/constants/routes';
import { adminCustomersService, CustomerAdminRecord } from '../../../../core/services/adminCustomersService';
import { PortalContext } from '../../../auth/session/PortalContext';

function formatMoney(value: number, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function UserAvatar({ name, email }: { name: string; email: string }) {
  const initials = (name || email || '?').substring(0, 2).toUpperCase();
  return (
    <div className="module-icon-box" style={{ 
      width: '44px', 
      height: '44px', 
      borderRadius: '50%', 
      background: 'linear-gradient(135deg, var(--acme-blue), var(--acme-purple))',
      color: 'white',
      fontSize: '14px',
      fontWeight: 800,
      flex: '0 0 auto'
    }}>
      {initials}
    </div>
  );
}

export function CustomersAdminPage() {
  const portal = useContext(PortalContext);
  const merchantId = portal.merchant?.id;
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<CustomerAdminRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!merchantId) return;
      setLoading(true);
      setError(null);
      const result = await adminCustomersService.fetchCustomers(merchantId);
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setRecords(result.data ?? []);
    };

    load();
  }, [merchantId]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return records;
    return records.filter((record) =>
      [record.full_name, record.email, record.phone].some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [query, records]);

  if (!merchantId) {
    return <div>No hay comercio activo para gestionar clientes.</div>;
  }

  return (
    <AdminPageFrame
      title="Clientes"
      description="Lista comercial del comercio actual con acceso a la ficha completa de cada cliente."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Clientes' },
      ]}
      contextItems={[
        { label: 'Rol', value: portal.staffAssignment?.role || 'sin rol', tone: 'info' },
        { label: 'Comercio', value: portal.merchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Entidad', value: 'Cliente', tone: 'info' },
        { label: 'Modo', value: 'Consulta', tone: 'info' },
      ]}
    >
      <SectionCard title="Filtrado de clientes" description="Busca por nombre, correo o teléfono para encontrar rapidamente a un cliente frecuente.">
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--acme-text-faint)', zIndex: 1, pointerEvents: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <TextField 
            value={query} 
            onChange={(event) => setQuery(event.target.value)} 
            placeholder="Escribe el nombre, correo o teléfono del cliente..." 
            style={{ paddingLeft: '48px' }}
          />
        </div>
      </SectionCard>

      <SectionCard title="Clientes del comercio" description="Se listan clientes con pedidos o carritos vinculados al comercio actual.">
        {loading ? (
          <SectionSkeleton lines={5} />
        ) : error ? (
          <ErrorBanner message={error} />
        ) : (
          <AdminDataTable
            rows={filteredRecords}
            getRowId={(record) => record.id}
            emptyMessage="No se encontraron clientes que coincidan con la búsqueda."
            columns={[
              {
                id: 'customer',
                header: 'Información del Cliente',
                render: (record) => (
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <UserAvatar name={record.full_name} email={record.email} />
                    <div className="module-info">
                      <strong style={{ fontWeight: 800 }}>{record.full_name || 'Nombre no registrado'}</strong>
                      <span style={{ color: 'var(--acme-text-faint)', fontSize: '12px' }}>{record.email || 'Sin correo vinculado'}</span>
                    </div>
                  </div>
                ),
              },
              {
                id: 'activity',
                header: 'Historial / Actividad',
                render: (record) => (
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 600 }}>{record.order_count} pedidos</span>
                      {record.active_cart_count > 0 && (
                        <span style={{ color: 'var(--acme-purple)', fontSize: '11px', fontWeight: 700 }}>· {record.active_cart_count} en curso</span>
                      )}
                    </div>
                    <span style={{ color: 'var(--acme-text-faint)', fontSize: '11px' }}>
                      Última vez: {record.last_order_at ? new Date(record.last_order_at).toLocaleDateString('es-PE') : 'Nunca'}
                    </span>
                  </div>
                ),
              },
              {
                id: 'value',
                header: 'Valor Acumulado',
                render: (record) => (
                  <div style={{ display: 'grid', gap: '2px' }}>
                    <strong style={{ color: 'var(--acme-purple)', fontSize: '15px' }}>{formatMoney(record.total_spent)}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--acme-text-faint)', fontSize: '11px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#FFB800' }}><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                      <span>{record.rating_avg.toFixed(1)} rating</span>
                    </div>
                  </div>
                ),
              },
              {
                id: 'status',
                header: 'Estado',
                render: (record) => (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <StatusPill label={record.is_active ? 'ACTIVO' : 'RESTRINGIDO'} tone={record.is_active ? 'success' : 'neutral'} />
                    <StatusPill label={record.default_role || 'CLIENTE'} tone="info" />
                  </div>
                ),
              },
              {
                id: 'action',
                header: '',
                align: 'right',
                width: '140px',
                render: (record) => (
                  <Link 
                    to={AppRoutes.portal.admin.customerDetail.replace(':customerId', record.id)} 
                    className="btn btn--sm btn--ghost" 
                    style={{ color: 'var(--acme-purple)', fontWeight: 700 }}
                  >
                    Abrir ficha
                  </Link>
                ),
              },
            ]}
          />
        )}
      </SectionCard>
    </AdminPageFrame>
  );
}
