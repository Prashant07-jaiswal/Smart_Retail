import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../utils/format';

export default function CartDrawer() {
  const { t } = useTranslation();
  const { items, isDrawerOpen, closeDrawer, setQuantity, removeItem, subtotal, itemCount } = useCart();
  const navigate = useNavigate();

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!isDrawerOpen) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') closeDrawer();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDrawerOpen, closeDrawer]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeDrawer}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(28,43,34,0.35)',
          opacity: isDrawerOpen ? 1 : 0,
          pointerEvents: isDrawerOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
          zIndex: 200,
        }}
        aria-hidden={!isDrawerOpen}
      />

      {/* Sliding panel */}
      <aside
        role="dialog"
        aria-label="Shopping cart"
        aria-hidden={!isDrawerOpen}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 'min(400px, 100vw)',
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 201,
          transform: isDrawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '1.2rem 1.4rem',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ fontSize: '1.15rem', margin: 0 }}>
            {t('cart.title')} {itemCount > 0 && <span style={{ color: 'var(--color-ink-soft)', fontWeight: 400 }}>({itemCount})</span>}
          </h2>
          <button
            onClick={closeDrawer}
            aria-label="Close cart"
            className="btn btn-outline btn-sm"
            style={{ padding: '0.3em 0.6em' }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.4rem' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-ink-soft)', padding: '3rem 1rem' }}>
              <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>🛒</div>
              {t('cart.empty')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {items.map((item) => (
                <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-ink-soft)' }}>{formatCurrency(item.price)} each</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setQuantity(item.product_id, item.quantity - 1)}>−</button>
                      <span style={{ minWidth: 22, textAlign: 'center' }}>{item.quantity}</span>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setQuantity(item.product_id, item.quantity + 1)}
                        disabled={item.stock != null && item.quantity >= item.stock}
                      >
                        +
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ marginLeft: 'auto', color: 'var(--color-danger)' }}
                        onClick={() => removeItem(item.product_id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(item.price * item.quantity)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div style={{ padding: '1.2rem 1.4rem', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.9rem', fontWeight: 700, fontSize: '1.1rem' }}>
              <span>{t('cart.subtotal')}</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <button
              className="btn btn-primary btn-block"
              style={{ marginBottom: '0.5rem' }}
              onClick={() => {
                closeDrawer();
                navigate('/cart');
              }}
            >
              {t('cart.viewCartCheckout')}
            </button>
            <button className="btn btn-outline btn-block" onClick={closeDrawer}>
              {t('cart.continueShopping')}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
