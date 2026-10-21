import { useEffect, useState } from 'react';
import { aiApi, getErrorMessage } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { Spinner, ErrorState, EmptyState } from '../../components/Feedback';

const TABS = [
  { key: 'stockout', label: 'Stock-out risk' },
  { key: 'demand', label: 'Demand forecast' },
  { key: 'deadstock', label: 'Dead / slow stock' },
];

const RISK_COLOR = {
  HIGH: 'var(--color-danger)',
  MEDIUM: 'var(--color-warning)',
  LOW: 'var(--color-success)',
};

export default function OwnerAnalytics() {
  const [tab, setTab] = useState('stockout');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');

  function load(activeTab) {
    setStatus('loading');
    const endpoint = { stockout: '/predict-stockout', demand: '/predict-demand', deadstock: '/dead-stock' }[activeTab];
    aiApi
      .get(endpoint)
      .then(({ data }) => {
        setData(data);
        setStatus('ready');
      })
      .catch((err) => {
        setErrorMsg(
          err.code === 'ERR_NETWORK'
            ? 'Could not reach the AI service. Make sure it is running (see README → "Starting the AI service").'
            : getErrorMessage(err)
        );
        setStatus('error');
      });
  }

  useEffect(() => load(tab), [tab]);

  return (
    <div style={{ padding: '1.8rem 2rem' }}>
      <h1 style={{ fontSize: '1.8rem' }}>AI Insights</h1>
      <p style={{ color: 'var(--color-ink-soft)', marginBottom: '1.2rem' }}>
        Lightweight, explainable predictions from the FastAPI AI service — trained on your actual sales history.
      </p>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.2rem' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {status === 'loading' && <Spinner label="Running model…" />}
      {status === 'error' && <ErrorState message={errorMsg} onRetry={() => load(tab)} />}

      {status === 'ready' && tab === 'stockout' && <StockoutView predictions={data.predictions} />}
      {status === 'ready' && tab === 'demand' && <DemandView predictions={data.predictions} />}
      {status === 'ready' && tab === 'deadstock' && <DeadStockView items={data.dead_stock} />}
    </div>
  );
}

function StockoutView({ predictions }) {
  if (!predictions?.length) return <EmptyState icon="📦" title="No stock-out predictions available" />;
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr><th>Product</th><th>Current stock</th><th>Avg daily sales (14d)</th><th>Est. days until stock-out</th><th>Risk</th><th>Recommendation</th></tr>
        </thead>
        <tbody>
          {predictions.map((p) => (
            <tr key={p.product_id}>
              <td>{p.product_name}</td>
              <td>{p.current_stock}</td>
              <td>{p.avg_daily_sales_last_14_days}</td>
              <td>{p.estimated_days_until_stockout ?? '—'}</td>
              <td>
                <span style={{ color: RISK_COLOR[p.risk_level], fontWeight: 700 }}>{p.risk_level}</span>
              </td>
              <td style={{ maxWidth: 280, fontSize: '0.85rem' }}>{p.recommendation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DemandView({ predictions }) {
  if (!predictions?.length) return <EmptyState icon="📈" title="No demand predictions available" />;
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr><th>Product</th><th>Avg daily demand</th><th>Predicted (7 days)</th><th>Predicted (30 days)</th><th>Recommended reorder qty</th><th>Method</th></tr>
        </thead>
        <tbody>
          {predictions.map((p) => (
            <tr key={p.product_id}>
              <td>{p.product_name}</td>
              <td>{p.avg_daily_demand}</td>
              <td>{p.predicted_demand_7_days}</td>
              <td>{p.predicted_demand_30_days}</td>
              <td style={{ fontWeight: 700 }}>{p.recommended_reorder_quantity}</td>
              <td style={{ fontSize: '0.78rem', color: 'var(--color-ink-soft)' }}>{p.method?.replaceAll('_', ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeadStockView({ items }) {
  if (!items?.length) return <EmptyState icon="✨" title="No dead or slow-moving stock detected" message="Everything is selling at a healthy pace." />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
      {items.map((item) => (
        <div key={item.product_id} className="card" style={{ padding: '1.1rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}>{item.product_name}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-ink-soft)', marginBottom: '0.5rem' }}>
            {formatCurrency(item.price)} · {item.current_stock} units in stock
          </div>
          <div style={{ fontSize: '0.82rem', marginBottom: '0.6rem' }}>
            Sold {Object.entries(item).find(([k]) => k.startsWith('units_sold_last'))?.[1] ?? 0} units recently
          </div>
          <div
            style={{
              fontSize: '0.82rem',
              background: 'var(--color-warning-soft)',
              color: 'var(--color-warning)',
              padding: '0.5rem 0.7rem',
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            💡 {item.recommendation}
          </div>
        </div>
      ))}
    </div>
  );
}
