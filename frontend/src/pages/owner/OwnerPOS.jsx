import { useEffect, useRef, useState } from 'react';
import { api, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/format';
import BarcodeScanner from '../../components/BarcodeScanner';
import Receipt from '../../components/Receipt';
import TransactionStatementDownload from '../../components/TransactionStatementDownload';

const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD'];

export default function OwnerPOS() {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [bill, setBill] = useState([]); // { product_id, name, price, quantity, stock }
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [completing, setCompleting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const barcodeRef = useRef(null);
  const lastScannedRef = useRef({ code: '', time: 0 });
  const toast = useToast();

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  async function lookupAndAdd(code) {
    if (!code.trim()) return;
    try {
      const { data } = await api.get(`/products/barcode/${encodeURIComponent(code.trim())}`);
      addToBill(data.product);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBarcodeInput('');
      barcodeRef.current?.focus();
    }
  }

  /**
   * Handles a detection from the camera scanner. Unlike manual/USB-scanner
   * entry, the camera keeps firing "detected" repeatedly for the same
   * barcode every frame it's visible — so we (a) never close the camera
   * after a scan, letting the owner keep scanning item after item, and
   * (b) ignore repeat detections of the *same* code within a short cooldown
   * window so one barcode held in front of the camera doesn't get added
   * to the bill a dozen times before it's pulled away.
   */
  function handleCameraScan(code) {
    const now = Date.now();
    const { code: lastCode, time: lastTime } = lastScannedRef.current;
    if (code === lastCode && now - lastTime < 2000) {
      return; // same barcode scanned again too soon — ignore, camera stays open
    }
    lastScannedRef.current = { code, time: now };
    lookupAndAdd(code);
  }

  function addToBill(product) {
    setBill((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        if (existing.quantity + 1 > product.stock) {
          toast.error(`Only ${product.stock} units of "${product.name}" in stock.`);
          return prev;
        }
        toast.success(`+1 ${product.name} (now ${existing.quantity + 1})`);
        return prev.map((i) => (i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      if (product.stock <= 0) {
        toast.error(`"${product.name}" is out of stock.`);
        return prev;
      }
      toast.success(`Added ${product.name}`);
      return [...prev, { product_id: product.id, name: product.name, price: Number(product.price), quantity: 1, stock: product.stock }];
    });
  }

  function changeQuantity(productId, delta) {
    setBill((prev) =>
      prev
        .map((i) => {
          if (i.product_id !== productId) return i;
          const newQty = i.quantity + delta;
          if (newQty > i.stock) {
            toast.error(`Only ${i.stock} units in stock.`);
            return i;
          }
          return { ...i, quantity: newQty };
        })
        .filter((i) => i.quantity > 0)
    );
  }

  const total = bill.reduce((sum, i) => sum + i.price * i.quantity, 0);

  async function completeSale() {
    if (bill.length === 0) return;
    setCompleting(true);
    try {
      const { data } = await api.post('/sales', {
        items: bill.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        payment_method: paymentMethod,
      });
      setReceipt(data.receipt);
      setBill([]);
      toast.success('Sale completed and inventory updated.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div style={{ padding: '1.8rem 2rem', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.8rem' }}>POS / Billing</h1>
        <p style={{ color: 'var(--color-ink-soft)', marginBottom: '1rem' }}>Scan or type a barcode to add items to the bill.</p>

        <div style={{ marginBottom: '1.2rem' }}>
          <TransactionStatementDownload />
        </div>

        <div className="card" style={{ padding: '1.2rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <input
              ref={barcodeRef}
              className="input"
              placeholder="Scan barcode or type manually, then press Enter…"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookupAndAdd(barcodeInput)}
            />
            <button className="btn btn-outline" onClick={() => lookupAndAdd(barcodeInput)}>Add</button>
            <button className="btn btn-outline" onClick={() => setScannerOpen((s) => !s)}>
              {scannerOpen ? 'Close camera' : '📷 Scan with camera'}
            </button>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-ink-soft)', marginTop: '0.5rem', marginBottom: 0 }}>
            Compatible with USB barcode scanners (they type + Enter automatically) or manual entry.
          </p>
        </div>

        {scannerOpen && (
          <BarcodeScanner
            onDetected={handleCameraScan}
            onClose={() => setScannerOpen(false)}
          />
        )}

        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Product</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr>
            </thead>
            <tbody>
              {bill.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-ink-soft)', padding: '2rem' }}>Bill is empty — scan a product to begin.</td></tr>
              ) : (
                bill.map((item) => (
                  <tr key={item.product_id}>
                    <td>{item.name}</td>
                    <td>{formatCurrency(item.price)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => changeQuantity(item.product_id, -1)}>−</button>
                        {item.quantity}
                        <button className="btn btn-outline btn-sm" onClick={() => changeQuantity(item.product_id, 1)}>+</button>
                      </div>
                    </td>
                    <td>{formatCurrency(item.price * item.quantity)}</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => setBill((prev) => prev.filter((i) => i.product_id !== item.product_id))}>Remove</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="card" style={{ padding: '1.4rem', position: 'sticky', top: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem' }}>Payment</h3>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                className={`btn btn-sm ${paymentMethod === m ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setPaymentMethod(m)}
                style={{ flex: 1 }}
              >
                {m}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '1rem', paddingTop: '0.8rem', borderTop: '1px solid var(--color-border)' }}>
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>

          <button className="btn btn-accent btn-block" disabled={bill.length === 0 || completing} onClick={completeSale}>
            {completing ? 'Completing sale…' : 'Complete sale'}
          </button>
        </div>

        {receipt && <Receipt receipt={receipt} title="POS Receipt" />}
      </div>
    </div>
  );
}
