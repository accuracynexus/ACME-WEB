import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminDataTable } from '../../../../components/admin/AdminDataTable';
import { AdminStatCard } from '../../../../components/admin/AdminStatCard';
import { AdminPageFrame, SectionCard, StatusPill } from '../../../../components/admin/AdminScaffold';
import { LoadingScreen } from '../../../../components/shared/LoadingScreen';
import { ErrorBanner } from '../../../../components/shared/ErrorBanner';
import { formatDateTime, formatMoney, formatPeriod, getFinanceStatus } from '../../../../core/admin/utils/financeLabels';
import { AppRoutes } from '../../../../core/constants/routes';
import { adminSettlementsService, MerchantSettlementDetail } from '../../../../core/services/adminSettlementsService';
import { PortalContext } from '../../../auth/session/PortalContext';

function Money({ value, strong }: { value: number; strong?: boolean }) {
  return <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: strong ? 800 : 500 }}>{formatMoney(value)}</span>;
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
    return <div>No se encontro la liquidacion.</div>;
  }

  const status = getFinanceStatus(detail.status);
  const period = formatPeriod(detail.period_start, detail.period_end);

  return (
    <AdminPageFrame
      title={`Liquidacion ${period}`}
      breadcrumbs={[
        { label: 'Admin', to: AppRoutes.portal.admin.root },
        { label: 'Liquidaciones', to: AppRoutes.portal.admin.settlements },
        { label: period },
      ]}
      contextItems={[]}
      actions={
        <button type="button" onClick={() => navigate(-1)} className="btn btn--secondary btn--sm">
          Volver
        </button>
      }
    >
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '-10px' }}>
        <StatusPill label={status.label} tone={status.tone} />
        <span style={{ color: 'var(--acme-text-muted)', fontSize: '14px' }}>
          {detail.paid_at ? `Pagada el ${formatDateTime(detail.paid_at)}` : `Generada el ${formatDateTime(detail.generated_at)}`}
        </span>
      </div>

      <div className="stat-grid" style={{ marginBottom: 0 }}>
        <AdminStatCard label="Ventas" value={formatMoney(detail.gross_sales)} icon="soles" tone="green" />
        <AdminStatCard label="Comision ACME" value={formatMoney(-detail.commission_amount)} icon="percent" tone="purple" />
        {detail.adjustments ? <AdminStatCard label="Ajustes" value={formatMoney(detail.adjustments)} icon="receipt" tone="neutral" /> : null}
        <AdminStatCard label="A pagar" value={formatMoney(detail.net_payable)} icon="wallet" tone="orange" />
      </div>

      <SectionCard title="Pedidos incluidos" description="Cada pedido del periodo: tus productos, la comision y lo que queda para ti.">
        <AdminDataTable
          rows={detail.items}
          getRowId={(record) => record.id}
          emptyMessage="Esta liquidacion no tiene pedidos."
          columns={[
            {
              id: 'order',
              header: 'Pedido',
              render: (record) =>
                record.order_id ? (
                  <Link to={AppRoutes.portal.admin.orderDetail.replace(':orderId', record.order_id)} style={{ color: 'var(--acme-purple)', fontWeight: 700 }}>
                    #{record.order_code || record.order_id}
                  </Link>
                ) : (
                  'Sin pedido'
                ),
            },
            { id: 'products', header: 'Tus productos', align: 'right', render: (record) => <Money value={record.order_products} /> },
            { id: 'commission', header: 'Comision', align: 'right', render: (record) => <Money value={-record.commission_amount} /> },
            { id: 'net', header: 'Para ti', align: 'right', render: (record) => <Money value={record.net_amount} strong /> },
          ]}
        />
      </SectionCard>
    </AdminPageFrame>
  );
}
