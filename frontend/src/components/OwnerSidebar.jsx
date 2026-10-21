import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import LanguageSwitcher from './LanguageSwitcher';

export default function OwnerSidebar({ pendingCount = 0 }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();

  const NAV_ITEMS = [
    { to: '/owner/dashboard', label: t('owner.sidebar.dashboard'), icon: '📊' },
    { to: '/owner/orders', label: t('owner.sidebar.orders'), icon: '🔔' },
    { to: '/owner/pos', label: t('owner.sidebar.pos'), icon: '🧾' },
    { to: '/owner/products', label: t('owner.sidebar.products'), icon: '📦' },
    { to: '/owner/inventory', label: t('owner.sidebar.inventory'), icon: '📥' },
    { to: '/owner/analytics', label: t('owner.sidebar.analytics'), icon: '🤖' },
  ];

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        flexShrink: 0,
        background: 'var(--color-primary-dark)',
        color: '#F1F5F1',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
      }}
    >
      <div style={{ padding: '1.4rem 1.3rem 1rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700 }}>
          {t('nav.brand')}
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.15rem' }}>{t('owner.sidebar.console')}</div>
      </div>

      <div style={{ margin: '0 1.3rem 0.8rem' }}>
        <LanguageSwitcher dark style={{ width: '100%' }} />
      </div>

      <div
        style={{
          margin: '0 1.3rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.75rem',
          opacity: 0.85,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: connected ? '#5FD98A' : '#8A968D',
          }}
        />
        {connected ? t('owner.sidebar.liveConnected') : t('owner.sidebar.connecting')}
      </div>

      <nav style={{ flex: 1, padding: '0 0.7rem' }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.65rem 0.9rem',
              borderRadius: 8,
              marginBottom: '0.2rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: isActive ? '#fff' : '#C9D6CB',
              background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
            })}
          >
            <span>{item.icon}</span>
            {item.label}
            {item.to === '/owner/orders' && pendingCount > 0 && (
              <span
                style={{
                  marginLeft: 'auto',
                  background: 'var(--color-accent)',
                  color: 'var(--color-primary-dark)',
                  borderRadius: '50%',
                  minWidth: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                }}
              >
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '1rem 1.3rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.name}</div>
        <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.7rem' }}>{user?.email}</div>
        <button
          className="btn btn-outline btn-sm btn-block"
          style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)' }}
          onClick={() => {
            logout();
            navigate('/owner/login');
          }}
        >
          {t('common.signOut')}
        </button>
      </div>
    </aside>
  );
}
