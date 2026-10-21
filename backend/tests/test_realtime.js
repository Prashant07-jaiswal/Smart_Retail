// One-off test: simulate an OWNER device and a CUSTOMER device connected
// to the same backend, then run through the full order lifecycle and
// confirm both sides receive live Socket.IO events with no polling/refresh.
const { io } = require('socket.io-client');

const BASE = 'http://localhost:5000';

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

async function main() {
  const owner = await login('owner@smartretail.com', 'password123');
  const customer = await login('aditi@example.com', 'password123');

  const ownerSocket = io(BASE, { auth: { token: owner.token } });
  const customerSocket = io(BASE, { auth: { token: customer.token } });

  let ownerGotNewOrder = false;
  let customerGotAccepted = false;
  let customerGotPreparing = false;

  ownerSocket.on('connect', () => console.log('[OWNER DEVICE] connected via socket'));
  customerSocket.on('connect', () => console.log('[CUSTOMER DEVICE] connected via socket'));

  ownerSocket.on('new-order', (order) => {
    ownerGotNewOrder = true;
    console.log(`[OWNER DEVICE] 🔔 NEW ORDER RECEIVED — #${order.id}, customer ${order.customer_name}, total ₹${order.total_amount}`);
  });

  customerSocket.on('order-status-updated', (order) => {
    console.log(`[CUSTOMER DEVICE] live update — order #${order.id} is now ${order.status}`);
    if (order.status === 'ACCEPTED') customerGotAccepted = true;
    if (order.status === 'PREPARING') customerGotPreparing = true;
  });

  await new Promise((r) => setTimeout(r, 500));

  // CUSTOMER places an order
  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer.token}` },
    body: JSON.stringify({ items: [{ product_id: 2, quantity: 1 }] }),
  });
  const { order } = await orderRes.json();
  console.log(`[CUSTOMER DEVICE] placed order #${order.id}`);

  await new Promise((r) => setTimeout(r, 500));

  // OWNER accepts, then moves to PREPARING
  await fetch(`${BASE}/api/orders/${order.id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
    body: JSON.stringify({ status: 'ACCEPTED' }),
  });
  await new Promise((r) => setTimeout(r, 500));

  await fetch(`${BASE}/api/orders/${order.id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
    body: JSON.stringify({ status: 'PREPARING' }),
  });
  await new Promise((r) => setTimeout(r, 800));

  console.log('\n=== RESULTS ===');
  console.log('Owner received new-order event:', ownerGotNewOrder);
  console.log('Customer received ACCEPTED event:', customerGotAccepted);
  console.log('Customer received PREPARING event:', customerGotPreparing);

  const pass = ownerGotNewOrder && customerGotAccepted && customerGotPreparing;
  console.log(pass ? '\n✅ REAL-TIME FLOW PASSED' : '\n❌ REAL-TIME FLOW FAILED');

  ownerSocket.close();
  customerSocket.close();
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
