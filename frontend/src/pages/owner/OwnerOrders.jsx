import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, getErrorMessage } from '../../services/api';
import { useSocketEvent } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate, statusBadgeClass } from '../../utils/format';
import { EmptyState, ErrorState, SkeletonRows } from '../../components/Feedback';
import Receipt from '../../components/Receipt';

const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD'];

const NEXT_ACTIONS = {
  PENDING: [{ label: 'Accept', status: 'ACCEPTED', variant: 'btn-primary' }, { label: 'Reject', status: 'REJECTED', variant: 'btn-danger' }],
  ACCEPTED: [{ label: 'Start preparing', status: 'PREPARING', variant: 'btn-primary' }, { label: 'Reject', status: 'REJECTED', variant: 'btn-danger' }],
  PREPARING: [{ label: 'Mark ready', status: 'READY', variant: 'btn-primary' }],
  READY: [{ label: 'Collect payment & complete', status: 'COMPLETED', variant: 'btn-primary' }],
  COMPLETED: [],
  REJECTED: [],
};

export default function OwnerOrders() {
  const { refreshPendingCount } = useOutletContext() || {};
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [payingOrder, setPayingOrder] = useState(null); // order object mid-payment-collection, or null
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [receipt, setReceipt] = useState(null); // receipt to display after completion
  const toast = useToast();

  const loadOrders = useCallback(() => {
    setStatus('loading');
    api
      .get('/orders', { params: statusFilter ? { status: statusFilter } : {} })
      .then(({ data }) => {
        setOrders(data.orders);
        setStatus('ready');
      })
      .catch((err) => {
        setErrorMsg(getErrorMessage(err));
        setStatus('error');
      });
  }, [statusFilter]);

  useEffect(loadOrders, [loadOrders]);

  // The toast/sound/desktop-notification for a new order now live in
  // OwnerLayout so they fire regardless of which owner page is open. This
  // listener's only job, while this page happens to be mounted, is to keep
  // the visible order list itself in sync live — no toast here, to avoid
  // double-notifying when this page is the one currently open.
  const handleNewOrder = useCallback(
    (order) => {
      setOrders((prev) => {
        if (statusFilter && statusFilter !== 'PENDING') return prev;
        if (prev.some((o) => o.id === order.id)) return prev;
        return [order, ...prev];
      });
    },
    [statusFilter]
  );
  useSocketEvent('new-order', handleNewOrder);

  async function updateStatus(orderId, newStatus) {
    // Completing an order means the customer is paying right now, at
    // handover — route through the payment-collection modal instead of
    // completing immediately, so the owner picks a payment method and gets
    // a printable receipt, same as a POS sale.
    if (newStatus === 'COMPLETED') {
      const order = orders.find((o) => o.id === orderId);
      setPayingOrder(order);
      setPaymentMethod('CASH');
      return;
    }

    setUpdatingId(orderId);
    try {
      const { data } = await api.put(`/orders/${orderId}/status`, { status: newStatus });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...data.order } : o)));
      toast.success(`Order #${orderId} updated to ${newStatus}.`);
      refreshPendingCount?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleConfirmPayment() {
    if (!payingOrder) return;
    setUpdatingId(payingOrder.id);
    try {
      const { data } = await api.put(`/orders/${payingOrder.id}/status`, {
        status: 'COMPLETED',
        payment_method: paymentMethod,
      });
      setOrders((prev) => prev.map((o) => (o.id === payingOrder.id ? { ...o, ...data.order } : o)));
      toast.success(`Order #${payingOrder.id} completed.`);
      setPayingOrder(null);
      setReceipt(data.receipt);
      refreshPendingCount?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div style={{ padding: '1.8rem 2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>Orders</h1>
          <p style={{ color: 'var(--color-ink-soft)' }}>New orders appear here instantly — no refresh needed.</p>
        </div>
        <select className="select" style={{ maxWidth: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {status === 'loading' && <SkeletonRows count={4} height={130} />}
      {status === 'error' && <ErrorState message={errorMsg} onRetry={loadOrders} />}
      {status === 'ready' && orders.length === 0 && (
        <EmptyState icon="🔔" title="No orders to show" message="Orders matching this filter will appear here." />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {orders.map((order) => (
          <div key={order.id} className="card" style={{ padding: '1.3rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Order #{order.id} — {order.customer_name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-soft)' }}>{formatDate(order.created_at)}</div>
              </div>
              <span className={statusBadgeClass(order.status)}>{order.status}</span>
            </div>

            <div style={{ margin: '0.8rem 0', fontSize: '0.88rem' }}>
              {(order.items || []).map((item) => (
                <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.15rem 0' }}>
                  <span>{item.quantity} × {item.product_name}</span>
                  <span>{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '0.8rem' }}>
              <strong>Total: {formatCurrency(order.total_amount)}</strong>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(NEXT_ACTIONS[order.status] || []).map((action) => (
                  <button
                    key={action.status}
                    className={`btn btn-sm ${action.variant}`}
                    disabled={updatingId === order.id}
                    onClick={() => updateStatus(order.id, action.status)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {payingOrder && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,34,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setPayingOrder(null)}
        >
          <div className="card" style={{ padding: '1.8rem', width: 380, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.3rem' }}>Collect payment</h3>
            <p style={{ color: 'var(--color-ink-soft)', fontSize: '0.88rem', marginBottom: '1.2rem' }}>
              Order #{payingOrder.id} — {payingOrder.customer_name}
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem' }}>
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  className={`btn btn-sm ${paymentMethod === m ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1 }}
                  onClick={() => setPaymentMethod(m)}
                >
                  {m}
                </button>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1.3rem',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                marginBottom: '1.2rem',
                paddingTop: '0.8rem',
                borderTop: '1px solid var(--color-border)',
              }}
            >
              <span>Amount due</span>
              <span>{formatCurrency(payingOrder.total_amount)}</span>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setPayingOrder(null)}>
                Cancel
              </button>
              <button
                className="btn btn-accent"
                style={{ flex: 1 }}
                disabled={updatingId === payingOrder.id}
                onClick={handleConfirmPayment}
              >
                {updatingId === payingOrder.id ? 'Completing…' : 'Confirm & complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {receipt && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,34,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setReceipt(null)}
        >
          <div style={{ width: 360, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
            <Receipt receipt={receipt} title="Order Receipt" />
            <button className="btn btn-outline btn-block" style={{ marginTop: '0.6rem' }} onClick={() => setReceipt(null)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
