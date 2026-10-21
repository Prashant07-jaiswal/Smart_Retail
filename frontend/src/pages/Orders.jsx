import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, getErrorMessage } from '../services/api';
import { useSocketEvent } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate, statusBadgeClass } from '../utils/format';
import { EmptyState, ErrorState, SkeletonRows } from '../components/Feedback';

const STATUS_STEPS = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'];

export default function Orders() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const toast = useToast();

  const loadOrders = useCallback(() => {
    setStatus('loading');
    api
      .get('/orders/mine')
      .then(({ data }) => {
        setOrders(data.orders);
        setStatus('ready');
      })
      .catch((err) => {
        setErrorMsg(getErrorMessage(err));
        setStatus('error');
      });
  }, []);

  useEffect(loadOrders, [loadOrders]);

  // The core real-time requirement: when the owner changes an order's status,
  // this event arrives instantly — no refresh, no polling.
  const handleStatusUpdate = useCallback(
    (updatedOrder) => {
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === updatedOrder.id);
        if (!exists) return prev;
        return prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
      });
      toast.info(`Order #${updatedOrder.id} is now ${updatedOrder.status}`);
    },
    [toast]
  );
  useSocketEvent('order-status-updated', handleStatusUpdate);

  if (status === 'loading') {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.8rem 1.5rem' }}>
        <SkeletonRows count={3} height={120} />
      </div>
    );
  }
  if (status === 'error') return <ErrorState message={errorMsg} onRetry={loadOrders} />;
  if (orders.length === 0) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <EmptyState icon="📦" title={t('orders.noOrders')} message={t('orders.noOrdersSubtitle')} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.8rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.8rem' }}>{t('orders.title')}</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order }) {
  const { t } = useTranslation();
  const isRejected = order.status === 'REJECTED';
  const currentStepIndex = STATUS_STEPS.indexOf(order.status);

  return (
    <div className="card" style={{ padding: '1.3rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ fontWeight: 700 }}>{t('orders.orderNumber', { id: order.id })}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-soft)' }}>{formatDate(order.created_at)}</div>
        </div>
        <span className={statusBadgeClass(order.status)}>{order.status}</span>
      </div>

      {!isRejected && (
        <div style={{ display: 'flex', gap: '0.3rem', margin: '1rem 0' }}>
          {STATUS_STEPS.map((step, i) => (
            <div key={step} style={{ flex: 1 }}>
              <div
                style={{
                  height: 5,
                  borderRadius: 3,
                  background: i <= currentStepIndex ? 'var(--color-primary)' : 'var(--color-border)',
                }}
              />
              <div style={{ fontSize: '0.68rem', marginTop: '0.3rem', color: 'var(--color-ink-soft)', textAlign: 'center' }}>
                {step}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '0.8rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.8rem' }}>
        {(order.items || []).map((item) => (
          <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.3rem' }}>
            <span>{item.quantity} × {item.product_name}</span>
            <span>{formatCurrency(item.price * item.quantity)}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.6rem', fontWeight: 700 }}>
        {t('orders.total')}: {formatCurrency(order.total_amount)}
      </div>
    </div>
  );
}
