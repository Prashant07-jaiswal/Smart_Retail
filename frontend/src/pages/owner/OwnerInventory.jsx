import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { EmptyState, ErrorState, SkeletonRows } from '../../components/Feedback';
import AddProductModal from '../../components/AddProductModal';

export default function OwnerInventory() {
  const [inventory, setInventory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [adjusting, setAdjusting] = useState(null); // product_id being adjusted
  const [adjustAmount, setAdjustAmount] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const toast = useToast();

  function load() {
    setStatus('loading');
    api
      .get('/inventory')
      .then(({ data }) => {
        setInventory(data.inventory);
        setStatus('ready');
      })
      .catch((err) => {
        setErrorMsg(getErrorMessage(err));
        setStatus('error');
      });
  }

  useEffect(load, []);

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data.categories)).catch(() => {});
  }, []);

  async function submitAdjustment(productId, direction) {
    const amount = Number(adjustAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a positive quantity.');
      return;
    }
    try {
      await api.post(`/inventory/${productId}/adjust`, {
        change: direction === 'add' ? amount : -amount,
        movement_type: direction === 'add' ? 'RESTOCK' : 'MANUAL_ADJUSTMENT',
        reference: direction === 'add' ? 'Manual restock' : 'Manual removal',
      });
      toast.success(`Stock ${direction === 'add' ? 'added' : 'removed'} successfully.`);
      setAdjusting(null);
      setAdjustAmount('');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function updateThreshold(productId, value) {
    try {
      await api.put(`/inventory/${productId}/threshold`, { low_stock_threshold: Number(value) });
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  if (status === 'loading') return <div style={{ padding: '1.8rem 2rem' }}><SkeletonRows count={6} height={44} /></div>;
  if (status === 'error') return <div style={{ padding: '1.8rem 2rem' }}><ErrorState message={errorMsg} onRetry={load} /></div>;

  return (
    <div style={{ padding: '1.8rem 2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>Inventory</h1>
          <p style={{ color: 'var(--color-ink-soft)', marginBottom: '1.2rem' }}>
            Stock never goes negative — every change is recorded as a stock movement.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add product</button>
      </div>

      {inventory.length === 0 ? (
        <EmptyState
          icon="📥"
          title="No inventory records"
          message="Add your first product to start tracking stock."
          action={
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowAddModal(true)}>
              + Add product
            </button>
          }
        />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th><th>Barcode</th><th>Quantity</th><th>Low-stock threshold</th><th></th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((inv) => (
                <tr key={inv.product_id}>
                  <td>{inv.product_name}</td>
                  <td><code style={{ fontSize: '0.8rem' }}>{inv.barcode || '—'}</code></td>
                  <td>
                    <span style={{ fontWeight: 700, color: inv.is_low_stock ? 'var(--color-danger)' : 'inherit' }}>
                      {inv.quantity}
                    </span>
                    {inv.is_low_stock && <span className="badge badge-rejected" style={{ marginLeft: '0.5rem' }}>Low</span>}
                  </td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      defaultValue={inv.low_stock_threshold}
                      style={{ width: 90 }}
                      onBlur={(e) => {
                        if (Number(e.target.value) !== inv.low_stock_threshold) updateThreshold(inv.product_id, e.target.value);
                      }}
                    />
                  </td>
                  <td>
                    {adjusting === inv.product_id ? (
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <input
                          className="input"
                          type="number"
                          min="1"
                          placeholder="Qty"
                          style={{ width: 80 }}
                          value={adjustAmount}
                          onChange={(e) => setAdjustAmount(e.target.value)}
                          autoFocus
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => submitAdjustment(inv.product_id, 'add')}>Add</button>
                        <button className="btn btn-danger btn-sm" onClick={() => submitAdjustment(inv.product_id, 'remove')}>Remove</button>
                        <button className="btn btn-outline btn-sm" onClick={() => { setAdjusting(null); setAdjustAmount(''); }}>✕</button>
                      </div>
                    ) : (
                      <button className="btn btn-outline btn-sm" onClick={() => setAdjusting(inv.product_id)}>Adjust stock</button>
                    )}
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
          onCreated={load}
        />
      )}
    </div>
  );
}
