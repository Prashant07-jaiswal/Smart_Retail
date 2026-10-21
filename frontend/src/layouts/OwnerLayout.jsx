import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import OwnerSidebar from '../components/OwnerSidebar';
import GemmaChatbot from '../components/GemmaChatbot';
import { useSocketEvent } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';
import {
  unlockNotificationAudio,
  playNewOrderSound,
  requestDesktopNotificationPermission,
  showNewOrderDesktopNotification,
} from '../utils/notificationSound';

/**
 * Owns the "new order" notification globally for the whole owner app —
 * previously this lived inside the Orders page component, so it only fired
 * while the owner was actively looking at that one page. Now it lives here,
 * wrapping every owner route, so a toast + sound + sidebar badge update
 * fire the instant an order arrives no matter which page is open.
 */
export default function OwnerLayout() {
  const [pendingCount, setPendingCount] = useState(0);
  const toast = useToast();

  const refreshPendingCount = useCallback(() => {
    api
      .get('/orders', { params: { status: 'PENDING' } })
      .then(({ data }) => setPendingCount(data.orders.length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshPendingCount();
    requestDesktopNotificationPermission();
  }, [refreshPendingCount]);

  // Unlock the shared notification AudioContext on the first real click/key
  // press anywhere in the owner app — required once per session so later
  // sounds triggered by a background socket event are actually audible.
  useEffect(() => {
    function unlock() {
      unlockNotificationAudio();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    }
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const handleNewOrder = useCallback(
    (order) => {
      setPendingCount((c) => c + 1);
      toast.success(`🔔 New order #${order.id} from ${order.customer_name} — ${formatCurrency(order.total_amount)}`);
      playNewOrderSound();
      showNewOrderDesktopNotification(order);
    },
    [toast]
  );
  useSocketEvent('new-order', handleNewOrder);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <OwnerSidebar pendingCount={pendingCount} />
      <main style={{ flex: 1, minWidth: 0 }}>
        <Outlet context={{ refreshPendingCount }} />
      </main>
      <GemmaChatbot />
    </div>
  );
}
