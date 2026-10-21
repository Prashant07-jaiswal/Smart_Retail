import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/format';
import { EmptyState, ErrorState, SkeletonRows } from '../../components/Feedback';
import AddProductModal from '../../components/AddProductModal';

export default function OwnerProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null | product object
  const [savingEdit, setSavingEdit] = useState(false);
  const toast = useToast();

  function loadProducts() {
    setStatus('loading');
    api
      .get('/products', { params: { limit: 200 } })
      .then(({ data }) => {
        setProducts(data.products);
        setStatus('ready');
      })
      .catch((err) => {
        setErrorMsg(getErrorMessage(err));
        setStatus('error');
      });
  }

  useEffect(() => {
    loadProducts();
    api.get('/categories').then(({ data }) => setCategories(data.categories)).catch(() => {});
  }, []);

  function openEdit(product) {
    setEditingProduct({
      id: product.id,
      name: product.name,
      barcode: product.barcode || '',
      description: product.description || '',
      price: product.price,
      category_id: product.category_id || '',
      // Postgres DATE comes back as a full ISO timestamp; <input type="date"> needs just YYYY-MM-DD.
      expiry_date: product.expiry_date ? product.expiry_date.slice(0, 10) : '',
    });
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await api.put(`/products/${editingProduct.id}`, {
        name: editingProduct.name,
        barcode: editingProduct.barcode || null,
        description: editingProduct.description,
        price: Number(editingProduct.price),
        category_id: editingProduct.category_id || null,
        expiry_date: editingProduct.expiry_date || null,
      });
      toast.success('Product updated.');
      setEditingProduct(null);
      loadProducts();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(product) {
    if (!confirm(`Deactivate "${product.name}"? It will be hidden from customers but order history is preserved.`)) return;
    try {
      await api.delete(`/products/${product.id}`);
      toast.success('Product deactivated.');
      loadProducts();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div style={{ padding: '1.8rem 2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>Products</h1>
          <p style={{ color: 'var(--color-ink-soft)' }}>Manage your catalog.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add product</button>
      </div>

      {status === 'loading' && <SkeletonRows count={6} height={44} />}
      {status === 'error' && <ErrorState message={errorMsg} onRetry={loadProducts} />}
      {status === 'ready' && products.length === 0 && (
        <EmptyState icon="📦" title="No products yet" message="Add your first product to start selling." />
      )}

      {status === 'ready' && products.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Barcode</th><th>Category</th><th>Price</th><th>Stock</th><th>Expiry</th><th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td><code style={{ fontSize: '0.8rem' }}>{p.barcode || '—'}</code></td>
                  <td>{p.category_name || '—'}</td>
                  <td>{formatCurrency(p.price)}</td>
                  <td>{p.stock}</td>
                  <td><ExpiryBadge expiryDate={p.expiry_date} /></td>
                  <td style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>Edit</button>
                    <button className="btn btn-outline btn-sm" onClick={() => handleDelete(p)}>Deactivate</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <AddProductModal
          categories={categories}
          onClose={() => setShowAddModal(false)}
          onCreated={loadProducts}
        />
      )}

      {editingProduct && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,34,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setEditingProduct(null)}
        >
          <form className="card" style={{ padding: '1.8rem', width: 440, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()} onSubmit={handleSaveEdit}>
            <h3>Edit product</h3>

            <div className="form-group">
              <label className="label">Name</label>
              <input className="input" required value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Barcode</label>
              <input className="input" value={editingProduct.barcode} onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })} placeholder="Optional" />
            </div>
            <div className="form-group">
              <label className="label">Description</label>
              <textarea className="textarea" rows={2} value={editingProduct.description} onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">Price (₹)</label>
                <input className="input" type="number" step="0.01" min="0" required value={editingProduct.price} onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">Category</label>
                <select className="select" value={editingProduct.category_id} onChange={(e) => setEditingProduct({ ...editingProduct, category_id: e.target.value })}>
                  <option value="">None</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="label">Expiry date <span style={{ fontWeight: 400, color: 'var(--color-ink-soft)' }}>(optional)</span></label>
              <input className="input" type="date" value={editingProduct.expiry_date} onChange={(e) => setEditingProduct({ ...editingProduct, expiry_date: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.6rem' }}>
              <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditingProduct(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/**
 * Small colored badge showing how urgent a product's expiry is — reused by
 * the products table here. Products with no expiry_date (most non-perishable
 * goods) simply show a dash, no badge.
 */
function ExpiryBadge({ expiryDate }) {
  if (!expiryDate) return <span style={{ color: 'var(--color-ink-soft)' }}>—</span>;

  const today = new Date(new Date().toDateString());
  const expiry = new Date(expiryDate);
  const daysLeft = Math.round((expiry - today) / (1000 * 60 * 60 * 24));
  const dateLabel = expiry.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  if (daysLeft < 0) {
    return <span className="badge badge-rejected">Expired · {dateLabel}</span>;
  }
  if (daysLeft <= 7) {
    return <span className="badge badge-pending">{daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`} · {dateLabel}</span>;
  }
  return <span style={{ fontSize: '0.85rem', color: 'var(--color-ink-soft)' }}>{dateLabel}</span>;
}
