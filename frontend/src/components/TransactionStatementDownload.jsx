import { useState } from 'react';
import { api, getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Lets the owner download a CSV transaction statement (covers both POS
 * sales and completed customer orders, since both write to the same sales
 * table on the backend) for a chosen date range.
 *
 * The endpoint is JWT-protected, so a plain <a href> download won't carry
 * the auth header — instead we fetch it as a blob with the authenticated
 * axios instance, then trigger the browser's save dialog manually.
 */
export default function TransactionStatementDownload() {
  const [from, setFrom] = useState(daysAgoStr(30));
  const [to, setTo] = useState(todayStr());
  const [downloading, setDownloading] = useState(false);
  const toast = useToast();

  async function handleDownload() {
    setDownloading(true);
    try {
      const response = await api.get('/sales/export', {
        params: { from, to },
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sales-statement-${from}_to_${to}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Statement downloaded.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="card" style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'flex-end', gap: '0.7rem', flexWrap: 'wrap' }}>
      <div>
        <label className="label" htmlFor="statement-from">From</label>
        <input id="statement-from" className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="statement-to">To</label>
        <input id="statement-to" className="input" type="date" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)} />
      </div>
      <button className="btn btn-outline" disabled={downloading} onClick={handleDownload}>
        {downloading ? 'Preparing…' : '📄 Download statement (CSV)'}
      </button>
    </div>
  );
}
