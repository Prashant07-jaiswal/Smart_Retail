import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, aiApi, getErrorMessage } from '../services/api';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../utils/format';
import { Spinner, ErrorState } from '../components/Feedback';

export default function ProductDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [recs, setRecs] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const { addItem } = useCart();

  useEffect(() => {
    setStatus('loading');
    api
      .get(`/products/${id}`)
      .then(({ data }) => {
        setProduct(data.product);
        setStatus('ready');
      })
      .catch((err) => {
        setErrorMsg(getErrorMessage(err));
        setStatus('error');
      });

    // AI recommendations are a "nice to have" — fail silently if the AI
    // service isn't running so the core shopping flow is never blocked by it.
    aiApi
      .get(`/recommendations/${id}`)
      .then(({ data }) => setRecs(data))
      .catch(() => setRecs(null));
  }, [id]);

  if (status === 'loading') return <Spinner label="Loading product…" />;
  if (status === 'error') return <ErrorState message={errorMsg} />;
  if (!product) return null;

  const outOfStock = product.stock <= 0;

  function handleAdd() {
    addItem(product, quantity);
  }

  const recGroups = [
    { key: 'frequently_bought_together', title: t('products.frequentlyBoughtTogether') },
    { key: 'similar_products', title: t('products.similarProducts') },
    { key: 'alternative_products', title: t('products.youMightAlsoLike') },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.8rem 1.5rem' }}>
      <Link to="/products" style={{ color: 'var(--color-ink-soft)', fontSize: '0.85rem' }}>{t('products.backToProducts')}</Link>

      <div className="card" style={{ padding: '2rem', marginTop: '1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-primary-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '3.5rem',
          }}
        >
          🛍️
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary)' }}>
            {product.category_name || 'General'}
          </span>
          <h1 style={{ margin: '0.3rem 0' }}>{product.name}</h1>
          <p style={{ color: 'var(--color-ink-soft)' }}>{product.description}</p>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-soft)', marginBottom: '0.8rem' }}>
            {t('products.barcode')}: <code>{product.barcode || '—'}</code>
          </div>
          {product.expiry_date && (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-soft)', marginBottom: '0.8rem' }}>
              {t('products.bestBefore', {
                date: new Date(product.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
              })}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.8rem' }}>
              {formatCurrency(product.price)}
            </span>
            {outOfStock ? (
              <span className="badge badge-rejected">{t('products.outOfStock')}</span>
            ) : (
              <span className="badge badge-accepted">{t('products.inStock', { count: product.stock })}</span>
            )}
          </div>

          {!outOfStock && (
            <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
              <input
                type="number"
                min={1}
                max={product.stock}
                className="input"
                style={{ width: 80 }}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock, Number(e.target.value))))}
              />
              <button className="btn btn-accent" onClick={handleAdd}>{t('products.addToCart')}</button>
            </div>
          )}
        </div>
      </div>

      {recs && recGroups.some((g) => recs[g.key]?.length > 0) && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem' }}>{t('products.recommendedForYou')}</h2>
          {recGroups.map(
            (g) =>
              recs[g.key]?.length > 0 && (
                <div key={g.key} style={{ marginBottom: '1.2rem' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--color-ink-soft)', marginBottom: '0.6rem' }}>{g.title}</h4>
                  <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
                    {recs[g.key].map((r) => (
                      <Link
                        key={r.product_id}
                        to={`/product/${r.product_id}`}
                        className="card"
                        style={{ padding: '0.8rem 1rem', minWidth: 160 }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{r.product_name}</div>
                        {r.price != null && (
                          <div style={{ fontSize: '0.82rem', color: 'var(--color-ink-soft)' }}>{formatCurrency(r.price)}</div>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}
