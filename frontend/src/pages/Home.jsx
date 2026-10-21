import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Home() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'radial-gradient(circle at 85% 10%, var(--color-accent-soft), transparent 45%), var(--color-bg)',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
        <LanguageSwitcher />
      </div>
      <div style={{ maxWidth: 560, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🛒</div>
        <h1 style={{ fontSize: '2.4rem' }}>{t('home.title')}</h1>
        <p style={{ color: 'var(--color-ink-soft)', fontSize: '1.05rem', marginBottom: '2rem' }}>
          {t('home.subtitle')}
        </p>
        <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={user?.role === 'customer' ? '/products' : '/login'} className="btn btn-primary">
            {t('home.shopAsCustomer')}
          </Link>
          <Link to="/owner/login" className="btn btn-outline">
            {t('home.signInAsOwner')}
          </Link>
        </div>
      </div>
    </div>
  );
}
