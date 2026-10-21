import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar,
} from 'recharts';
import { api, getErrorMessage } from '../../services/api';
import { formatCurrency, statusBadgeClass } from '../../utils/format';
import { Spinner, ErrorState, EmptyState } from '../../components/Feedback';

export default function OwnerDashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');

  function load() {
    setStatus('loading');
    api
      .get('/dashboard/summary')
      .then((res) => {
        setData(res.data);
        setStatus('ready');
      })
      .catch((err) => {
        setErrorMsg(getErrorMessage(err));
        setStatus('error');
      });
  }

  useEffect(load, []);

  if (status === 'loading') return <Spinner label={`${t('common.loading')}`} />;
  if (status === 'error') return <ErrorState message={errorMsg} onRetry={load} />;

  const kpis = [
    { label: t('owner.dashboard.todaySales'), value: formatCurrency(data.todaySales), icon: '💰' },
    { label: t('owner.dashboard.totalRevenue'), value: formatCurrency(data.totalRevenue), icon: '📈' },
    { label: t('owner.dashboard.totalOrders'), value: data.totalOrders, icon: '🧾' },
    { label: t('owner.dashboard.pendingOrders'), value: data.pendingOrders, icon: '⏳', highlight: data.pendingOrders > 0 },
  ];

  const trend = data.revenueTrend.map((d) => ({
    day: new Date(d.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    revenue: Number(d.revenue),
  }));

  const bestSellers = data.bestSellers.map((p) => ({ name: p.name, units: Number(p.units_sold) }));

  return (
    <div style={{ padding: '1.8rem 2rem' }}>
      <h1 style={{ fontSize: '1.8rem' }}>{t('owner.dashboard.title')}</h1>
      <p style={{ color: 'var(--color-ink-soft)', marginBottom: '1.5rem' }}>{t('owner.dashboard.subtitle')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.8rem' }}>
        {kpis.map((k) => (
          <div key={k.label} className="card" style={{ padding: '1.2rem 1.4rem', borderColor: k.highlight ? 'var(--color-warning)' : undefined }}>
            <div style={{ fontSize: '1.4rem' }}>{k.icon}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)', margin: '0.3rem 0' }}>{k.value}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-ink-soft)' }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.2rem', marginBottom: '1.8rem' }}>
        <div className="card" style={{ padding: '1.4rem' }}>
          <h3 style={{ fontSize: '1rem' }}>{t('owner.dashboard.revenueTrend')}</h3>
          {trend.length === 0 ? (
            <EmptyState icon="📉" title={t('owner.dashboard.noRecentSales')} message="Revenue will chart here once sales come in." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Line type="monotone" dataKey="revenue" stroke="#24462E" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card" style={{ padding: '1.4rem' }}>
          <h3 style={{ fontSize: '1rem' }}>{t('owner.dashboard.bestSellers')}</h3>
          {bestSellers.length === 0 ? (
            <EmptyState icon="🏆" title={t('owner.dashboard.noSalesYet')} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={bestSellers} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                <Tooltip />
                <Bar dataKey="units" fill="#D9A21B" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.2rem' }}>
        <div className="card" style={{ padding: '1.4rem' }}>
          <h3 style={{ fontSize: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            {t('owner.dashboard.lowStockAlerts')}
            <Link to="/owner/inventory" style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>{t('owner.dashboard.manage')}</Link>
          </h3>
          {data.lowStock.length === 0 ? (
            <p style={{ color: 'var(--color-ink-soft)', fontSize: '0.88rem' }}>{t('owner.dashboard.allAboveThreshold')}</p>
          ) : (
            data.lowStock.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.88rem' }}>
                <span>{p.name}</span>
                <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{p.quantity} left</span>
              </div>
            ))
          )}
        </div>

        <div className="card" style={{ padding: '1.4rem' }}>
          <h3 style={{ fontSize: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            {t('owner.dashboard.expiringSoon')}
            <Link to="/owner/products" style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>{t('owner.dashboard.manage')}</Link>
          </h3>
          {data.expiringProducts.length === 0 ? (
            <p style={{ color: 'var(--color-ink-soft)', fontSize: '0.88rem' }}>{t('owner.dashboard.nothingExpiringSoon')}</p>
          ) : (
            data.expiringProducts.map((p) => {
              const daysLeft = Math.round((new Date(p.expiry_date) - new Date(new Date().toDateString())) / 86400000);
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.88rem' }}>
                  <span>{p.name}</span>
                  <span style={{ color: p.is_expired ? 'var(--color-danger)' : 'var(--color-warning)', fontWeight: 700 }}>
                    {p.is_expired ? t('owner.dashboard.expired') : daysLeft === 0 ? t('owner.dashboard.expiresToday') : `${daysLeft}d`}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="card" style={{ padding: '1.4rem' }}>
          <h3 style={{ fontSize: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            {t('owner.dashboard.recentOrders')}
            <Link to="/owner/orders" style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>{t('owner.dashboard.viewAll')}</Link>
          </h3>
          {data.recentOrders.length === 0 ? (
            <p style={{ color: 'var(--color-ink-soft)', fontSize: '0.88rem' }}>{t('owner.dashboard.noOrdersYet')}</p>
          ) : (
            data.recentOrders.map((o) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.88rem' }}>
                <span>#{o.id} · {o.customer_name}</span>
                <span className={statusBadgeClass(o.status)}>{o.status}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
