import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext';
import { api, getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/format';
import { EmptyState } from '../components/Feedback';

export default function Cart() {
  const { t } = useTranslation();
  const { items, setQuantity, removeItem, subtotal, clearCart } = useCart();
  const [placing, setPlacing] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  async function handlePlaceOrder() {
    setPlacing(true);
    try {
      const payload = { items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })) };
      const { data } = await api.post('/orders', payload);
      clearCart();
      toast.success(`Order #${data.order.id} placed! The store owner has been notified.`);
      navigate('/orders');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPlacing(false);
    }
  }

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <EmptyState
          icon="🛒"
          title={t('cart.empty')}
          message={t('cart.emptySubtitle')}
          action={
            <Link to="/products" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              {t('cart.browseProducts')}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.8rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.8rem' }}>{t('cart.title')}</h1>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('cart.product')}</th>
                <th>{t('cart.price')}</th>
                <th>{t('cart.quantity')}</th>
                <th>{t('cart.subtotal')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.product_id}>
                  <td>{item.name}</td>
                  <td>{formatCurrency(item.price)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setQuantity(item.product_id, item.quantity - 1)}>−</button>
                      <span style={{ minWidth: 24, textAlign: 'center' }}>{item.quantity}</span>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setQuantity(item.product_id, item.quantity + 1)}
                        disabled={item.stock != null && item.quantity >= item.stock}
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td>{formatCurrency(item.price * item.quantity)}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => removeItem(item.product_id)}>{t('cart.remove')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="card"
        style={{ marginTop: '1rem', padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-ink-soft)' }}>{t('cart.total')}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.6rem' }}>{formatCurrency(subtotal)}</div>
        </div>
        <button className="btn btn-primary" onClick={handlePlaceOrder} disabled={placing}>
          {placing ? t('cart.placingOrder') : t('cart.placeOrder')}
        </button>
      </div>
      <p style={{ marginTop: '0.8rem', fontSize: '0.82rem', color: 'var(--color-ink-soft)' }}>
        {t('cart.checkoutNote')}
      </p>
    </div>
  );
}
