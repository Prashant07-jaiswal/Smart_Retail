import { formatCurrency } from '../utils/format';

/**
 * Printable receipt, shared by POS billing (immediate sale) and order
 * completion (customer pays at pickup/handover) — same visual format
 * either way, since it's the same kind of proof-of-purchase to the customer.
 */
export default function Receipt({ receipt, title = 'Receipt' }) {
  return (
    <div
      id="receipt-print-area"
      className="card"
      style={{ padding: '1.4rem', marginTop: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
    >
      <div style={{ textAlign: 'center', marginBottom: '0.6rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700 }}>Smart Retail</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-soft)' }}>{title}</div>
        <div>{receipt.receipt_no}</div>
        <div>{new Date(receipt.created_at).toLocaleString('en-IN')}</div>
      </div>
      <div style={{ borderTop: '1px dashed var(--color-border)', borderBottom: '1px dashed var(--color-border)', padding: '0.6rem 0', margin: '0.6rem 0' }}>
        {receipt.items.map((item, i) => (
          <div key={item.id ?? i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
            <span>{item.quantity} × {item.product_name}</span>
            <span>{formatCurrency(item.total_amount)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
        <span>TOTAL</span>
        <span>{formatCurrency(receipt.grand_total)}</span>
      </div>
      <div style={{ marginTop: '0.4rem' }}>Payment: {receipt.payment_method}</div>
      <button className="btn btn-outline btn-block no-print" style={{ marginTop: '1rem' }} onClick={() => window.print()}>
        🖨️ Print receipt
      </button>
    </div>
  );
}
