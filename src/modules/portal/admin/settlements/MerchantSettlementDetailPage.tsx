import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminEntityHeader } from '../../../../components/admin/AdminEntityHeader';
import { AdminInlineRelationTable } from '../../../../components/admin/AdminInlineRelationTable';
import { AdminPageFrame, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { LoadingScreen } from '../../../../components/shared/LoadingScreen';
import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { getPortalActorLabel, getScopeLabel } from '../../../../core/auth/portalAccess';
import { AppRoutes } from '../../../../core/constants/routes';
import { adminSettlementsService, MerchantSettlementDetail } from '../../../../core/services/adminSettlementsService';
import { PortalContext } from '../../../auth/session/PortalContext';

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string) {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function getStatusTone(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'paid') return 'success' as const;
  if (normalized === 'pending' || normalized === 'draft') return 'warning' as const;
  if (normalized === 'overdue' || normalized === 'failed') return 'danger' as const;
  return 'info' as const;
}

export function MerchantSettlementDetailPage() {
  const navigate = useNavigate();
  const { settlementId } = useParams();
  const portal = useContext(PortalContext);
  const merchantId = portal.currentMerchant?.id ?? portal.merchant?.id;
  const [detail, setDetail] = useState<MerchantSettlementDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!merchantId || !settlementId) return;
      setLoading(true);
      setError(null);
      const result = await adminSettlementsService.fetchMerchantSettlementDetail(merchantId, settlementId);
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setDetail(result.data ?? null);
    };

    load();
  }, [merchantId, settlementId]);

  if (!merchantId) {
    return <div>No hay comercio activo para revisar liquidaciones.</div>;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (error && !detail) {
    return <ErrorBanner message={error} />;
  }

  if (!detail) {
    return <div>No se encontro la liquidacion de comercio.</div>;
  }

  return (
    <AdminPageFrame
      title="Liquidacion de comercio"
      description="Detalle economico del cierre del comercio actual con sus pedidos incluidos."
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Liquidaciones', to: AppRoutes.portal.admin.settlements },
        { label: detail.id },
      ]}
      contextItems={[
        { label: 'Capa', value: getScopeLabel(portal.currentScopeType), tone: 'info' },
        { label: 'Actor', value: getPortalActorLabel({ roleAssignments: portal.roleAssignments, profile: portal.profile, staffAssignment: portal.staffAssignment }), tone: 'info' },
        { label: 'Comercio', value: portal.currentMerchant?.name || portal.merchant?.name || 'sin comercio', tone: 'neutral' },
        { label: 'Entidad', value: 'Liquidacion comercio', tone: 'info' },
        { label: 'Estado', value: detail.status || 'sin estado', tone: getStatusTone(detail.status) },
      ]}
    >
      <div>
        <button type="button" onClick={() => navigate(-1)} className="btn btn--secondary btn--sm">
          Volver
        </button>
      </div>

      <AdminEntityHeader
        title="Liquidacion de comercio"
        description={`${formatDateTime(detail.period_start)} - ${formatDateTime(detail.period_end)}`}
        status={{ label: detail.status || 'sin estado', tone: getStatusTone(detail.status) }}
      />

      <SectionCard title="Resumen financiero" description="Lectura del cierre economico y su cronologia.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          {[
            { label: 'Ventas brutas', value: formatMoney(detail.gross_sales) },
            { label: 'Comision', value: formatMoney(detail.commission_amount) },
            { label: 'Ajustes', value: formatMoney(detail.adjustments) },
            { label: 'Neto pagable', value: formatMoney(detail.net_payable) },
            { label: 'Generada', value: formatDateTime(detail.generated_at) },
            { label: 'Pagada', value: detail.paid_at ? formatDateTime(detail.paid_at) : 'Pendiente' },
          ].map((item) => (
            <div key={item.label} style={{ padding: '14px', borderRadius: '14px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <div style={{ color: '#6b7280', fontSize: '13px' }}>{item.label}</div>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </SectionCard>

      <AdminInlineRelationTable title="Pedidos incluidos" description="merchant_settlement_items se expone aqui para justificar el cierre pedido por pedido.">
        <AdminDataTable
          rows={detail.items}
          getRowId={(record) => record.id}
          emptyMessage="No hay items de liquidacion registrados."
          columns={[
            {
              id: 'order',
              header: 'Pedido',
              render: (record) =>
                record.order_id ? (
                  <Link to={AppRoutes.portal.admin.orderDetail.replace(':orderId', record.order_id)} style={{ color: '#2563eb', fontWeight: 700 }}>
                    #{record.order_code || record.order_id}
                  </Link>
                ) : (
                  'Sin pedido'
                ),
            },
            { id: 'total', header: 'Total pedido', render: (record) => formatMoney(record.order_total) },
            { id: 'commission', header: 'Comision', render: (record) => formatMoney(record.commission_amount) },
            { id: 'net', header: 'Neto', align: 'right', render: (record) => formatMoney(record.net_amount) },
          ]}
        />
      </AdminInlineRelationTable>
    </AdminPageFrame>
  );
}
