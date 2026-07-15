import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PortalContext } from '../../../modules/auth/session/PortalContext';
import { ordersService } from '../../../core/services/ordersService';
import { OrderDetail, OrderStatus } from '../../../core/types';
import { SectionSkeleton } from '../../../components/shared/Skeleton';
import { ErrorBanner } from '../../../components/shared/ErrorBanner';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TRANSITIONS } from '../../../core/utils/orderStatus';

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const portal = useContext(PortalContext);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const branchId = portal.currentBranch?.id;

  useEffect(() => {
    const load = async () => {
      if (!branchId || !id) return;
      setLoading(true);
      const result = await ordersService.fetchOrderDetail(id, branchId);
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setOrder(result.data ?? null);
    };

    load();
  }, [branchId, id]);

  const handleStatusChange = async (status: OrderStatus) => {
    if (!order) return;
    setActionLoading(true);
    const result = await ordersService.updateOrderStatus(order.id, status);
    setActionLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    const refreshed = await ordersService.fetchOrderDetail(order.id, branchId!);
    setOrder(refreshed.data ?? null);
  };

  if (!branchId) {
    return <div>No hay sucursal seleccionada.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div style={{ marginBottom: '10px' }}>
        <button onClick={() => navigate(-1)} className="btn btn--secondary btn--sm">Volver</button>
      </div>
      {loading ? (
        <SectionSkeleton lines={5} />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : !order ? (
        <div>No se encontró el pedido.</div>
      ) : (
        <div style={{ display: 'grid', gap: '18px' }}>
          <div style={{ padding: '24px', borderRadius: '18px', background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <h1>Pedido #{order.id}</h1>
            <div style={{ marginTop: '14px', color: '#6b7280' }}>{ORDER_STATUS_LABELS[order.status]}</div>
            <div style={{ marginTop: '12px' }}>Total: ${order.total.toFixed(2)}</div>
            <div>Cliente: {order.customer_name || 'Sin nombre'}</div>
            <div>Método de pago: {order.payment_method || 'No disponible'}</div>
            <div>Dirección: {order.delivery_address || 'No disponible'}</div>
          </div>
          <div style={{ padding: '24px', borderRadius: '18px', background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <h2>Items</h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              {(order.items || []).map((item) => (
                <div key={item.id} style={{ padding: '14px', borderRadius: '14px', background: '#f9fafb' }}>
                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                  <div>Cantidad: {item.quantity}</div>
                  <div>Precio unitario: ${item.unit_price.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gap: '12px', padding: '24px', borderRadius: '18px', background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <h2>Acciones</h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {ORDER_STATUS_TRANSITIONS[order.status]?.map((nextStatus) => (
                <button
                  key={nextStatus}
                  disabled={actionLoading}
                  onClick={() => handleStatusChange(nextStatus)}
                  className="btn btn--primary btn--sm"
                >
                  Marcar como {ORDER_STATUS_LABELS[nextStatus]}
                </button>
              ))}
            </div>
          </div>
          {order.status_history && order.status_history.length > 0 && (
            <div style={{ padding: '24px', borderRadius: '18px', background: '#ffffff', border: '1px solid #e5e7eb' }}>
              <h2>Historial de estado</h2>
              <div style={{ display: 'grid', gap: '10px' }}>
                {order.status_history.map((history, index) => (
                  <div key={index} style={{ padding: '14px', borderRadius: '12px', background: '#f9fafb' }}>
                    <div>{ORDER_STATUS_LABELS[history.status]}</div>
                    <div style={{ color: '#6b7280' }}>{history.changed_at}</div>
                    {history.note && <div>Nota: {history.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
