const { verifyToken } = require('../config/jwt');

const OWNER_ROOM = 'owners';
const customerRoom = (customerId) => `customer:${customerId}`;

/**
 * Wires up Socket.IO auth + rooms.
 *
 * Clients connect with: io(url, { auth: { token: '<jwt>' } })
 * - Owners are joined to a shared "owners" room -> broadcast new orders to all owner screens.
 * - Customers are joined to a room keyed by their own user id -> only they receive their
 *   order status updates, no matter which device/browser they're on.
 */
function setupSocket(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication token required.'));
      const decoded = verifyToken(token);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role, name } = socket.user;

    if (role === 'owner') {
      socket.join(OWNER_ROOM);
    } else {
      socket.join(customerRoom(id));
    }

    console.log(`[socket] connected: ${name} (${role}) — socket ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${name} (${role})`);
    });
  });
}

/** Emit a "new order" alert to every connected owner screen. */
function emitNewOrder(io, order) {
  io.to(OWNER_ROOM).emit('new-order', order);
}

/** Emit a status update to the specific customer who owns the order. */
function emitOrderStatusUpdate(io, customerId, order) {
  io.to(customerRoom(customerId)).emit('order-status-updated', order);
}

/** Emit a low-stock alert to owner screens. */
function emitLowStockAlert(io, product) {
  io.to(OWNER_ROOM).emit('low-stock-alert', product);
}

module.exports = { setupSocket, emitNewOrder, emitOrderStatusUpdate, emitLowStockAlert, OWNER_ROOM };
