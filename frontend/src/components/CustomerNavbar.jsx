import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useSocket } from '../context/SocketContext';
import LanguageSwitcher from './LanguageSwitcher';

export default function CustomerNavbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const { connected } = useSocket();
  const navigate = useNavigate();

  const linkStyle = ({ isActive }) => ({
    padding: '0.5rem 0.9rem',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: '0.92rem',
    color: isActive ? 'var(--color-primary)' : 'var(--color-ink-soft)',
    background: isActive ? 'var(--color-primary-soft)' : 'transparent',
  });

  return (
    <header
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '0.85rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
        }}
      >
        <NavLink to="/products" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.4rem' }}>🛒</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem' }}>
            {t('nav.brand')}
          </span>
        </NavLink>

        <nav style={{ display: 'flex', gap: '0.3rem', flex: 1 }}>
          <NavLink to="/products" style={linkStyle}>
            {t('nav.browse')}
          </NavLink>
          <NavLink to="/orders" style={linkStyle}>
            {t('nav.myOrders')}
          </NavLink>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <LanguageSwitcher />

          {user && (
            <span
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--color-ink-soft)' }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: connected ? 'var(--color-success)' : 'var(--color-border)',
                }}
              />
              {connected ? t('nav.live') : t('nav.offline')}
            </span>
          )}

          <NavLink
            to="/cart"
            className="btn btn-outline btn-sm"
            style={{ position: 'relative' }}
          >
            {t('nav.cart')}
            {itemCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  background: 'var(--color-accent)',
                  color: 'var(--color-primary-dark)',
                  borderRadius: '50%',
                  minWidth: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                }}
              >
                {itemCount}
              </span>
            )}
          </NavLink>

          {user ? (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              {t('common.signOut')}
            </button>
          ) : (
            <NavLink to="/login" className="btn btn-primary btn-sm">
              {t('common.signIn')}
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
