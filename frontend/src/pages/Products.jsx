import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, getErrorMessage } from '../services/api';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import { EmptyState, ErrorState, SkeletonRows } from '../components/Feedback';

export default function Products() {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState('');

  const { addItem } = useCart();

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    const params = {};
    if (search) params.search = search;
    if (category) params.category = category;

    const timeout = setTimeout(() => {
      api
        .get('/products', { params })
        .then(({ data }) => {
          if (cancelled) return;
          setProducts(data.products);
          setStatus('ready');
        })
        .catch((err) => {
          if (cancelled) return;
          setErrorMsg(getErrorMessage(err));
          setStatus('error');
        });
    }, 250); // light debounce for search typing

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, category]);

  function handleAddToCart(product) {
    addItem(product, 1);
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '1.8rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.8rem' }}>{t('products.title')}</h1>
        <p style={{ color: 'var(--color-ink-soft)' }}>{t('products.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          className="input"
          placeholder={t('products.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">{t('products.allCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {status === 'loading' && <SkeletonRows count={6} height={180} />}
      {status === 'error' && <ErrorState message={errorMsg} onRetry={() => setSearch((s) => s)} />}
      {status === 'ready' && products.length === 0 && (
        <EmptyState icon="🔍" title={t('products.noProductsFound')} message={t('products.tryDifferent')} />
      )}
      {status === 'ready' && products.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
            gap: '1rem',
          }}
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />
          ))}
        </div>
      )}
    </div>
  );
}
