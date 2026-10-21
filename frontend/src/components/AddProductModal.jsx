import { useState } from 'react';
import { api, getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import BarcodeScanner from './BarcodeScanner';
import { lookupProductByBarcode, matchCategory } from '../services/productLookup';

const emptyForm = { name: '', barcode: '', description: '', price: '', category_id: '', initial_stock: 0, low_stock_threshold: 10, expiry_date: '' };

/**
 * Add-product modal shared by the Products page and the Inventory page.
 * Two ways in: scan a barcode (tries a free online lookup to pre-fill name
 * and description) or just fill the form in by hand — both always available,
 * since not every product has a barcode or an online match.
 */
export default function AddProductModal({ categories, onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [showScanner, setShowScanner] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function handleBarcodeScanned(barcode) {
    setShowScanner(false);
    setForm((f) => ({ ...f, barcode }));
    setLookingUp(true);
    try {
      const result = await lookupProductByBarcode(barcode);
      if (result) {
        const matchedCategoryId = matchCategory(result.categoryGuess, categories);
        setForm((f) => ({
          ...f,
          barcode,
          name: f.name || result.name,
          description: f.description || result.description,
          category_id: f.category_id || matchedCategoryId,
        }));
        if (result.description || matchedCategoryId) {
          toast.success('Found this product online — details pre-filled. Check them, set the price, then save.');
        } else {
          toast.info('Found a name match online, but this product has no description or category data available. Fill in the rest manually.');
        }
      } else {
        toast.info(`Barcode ${barcode} captured, but no online match was found. Fill in the details manually.`);
      }
    } catch (err) {
      toast.error('Could not reach the online product database. Barcode captured — fill in the rest manually.');
      console.error(err);
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/products', {
        name: form.name,
        barcode: form.barcode || null,
        description: form.description,
        price: Number(form.price),
        category_id: form.category_id || null,
        initial_stock: Number(form.initial_stock) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 10,
        expiry_date: form.expiry_date || null,
      });
      toast.success('Product created.');
      onCreated?.(data.product);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,34,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <form
        className="card"
        style={{ padding: '1.8rem', width: 440, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSave}
      >
        <h3>Add product</h3>

        {!showScanner && (
          <button type="button" className="btn btn-outline btn-block" style={{ marginBottom: '1.1rem' }} onClick={() => setShowScanner(true)}>
            📷 Scan barcode to auto-fill details
          </button>
        )}

        {showScanner && (
          <div style={{ marginBottom: '1.1rem' }}>
            <BarcodeScanner onDetected={handleBarcodeScanned} onClose={() => setShowScanner(false)} />
          </div>
        )}

        {lookingUp && (
          <p style={{ fontSize: '0.82rem', color: 'var(--color-ink-soft)', marginBottom: '1rem' }}>
            🔎 Looking up this barcode online…
          </p>
        )}

        {!showScanner && (
          <p style={{ fontSize: '0.78rem', color: 'var(--color-ink-soft)', marginTop: '-0.7rem', marginBottom: '1.1rem' }}>
            Or skip scanning and fill in the details manually below.
          </p>
        )}

        <div className="form-group">
          <label className="label">Name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="label">Barcode</label>
          <input className="input" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Optional — scan or type" />
        </div>
        <div className="form-group">
          <label className="label">Description</label>
          <textarea className="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">Price (₹)</label>
            <input className="input" type="number" step="0.01" min="0" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">Category</label>
            <select className="select" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">Initial stock</label>
            <input className="input" type="number" min="0" value={form.initial_stock} onChange={(e) => setForm({ ...form, initial_stock: e.target.value })} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">Low-stock threshold</label>
            <input className="input" type="number" min="0" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="label">Expiry date <span style={{ fontWeight: 400, color: 'var(--color-ink-soft)' }}>(optional — leave blank for non-perishable items)</span></label>
          <input className="input" type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.6rem' }}>
          <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
