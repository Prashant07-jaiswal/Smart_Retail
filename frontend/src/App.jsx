import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import CustomerLayout from './layouts/CustomerLayout';

import OwnerLayout from './layouts/OwnerLayout';
import OwnerDashboard from './pages/owner/OwnerDashboard';
import OwnerOrders from './pages/owner/OwnerOrders';
import OwnerProducts from './pages/owner/OwnerProducts';
import OwnerInventory from './pages/owner/OwnerInventory';
import OwnerPOS from './pages/owner/OwnerPOS';
import OwnerAnalytics from './pages/owner/OwnerAnalytics';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <CartProvider>
            <ToastProvider>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login role="customer" />} />
                <Route path="/register" element={<Register />} />
                <Route path="/owner/login" element={<Login role="owner" />} />

                {/* Customer area */}
                <Route element={<CustomerLayout />}>
                  <Route path="/products" element={<Products />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route
                    path="/cart"
                    element={
                      <ProtectedRoute role="customer">
                        <Cart />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/orders"
                    element={
                      <ProtectedRoute role="customer">
                        <Orders />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                {/* Owner area */}
                <Route
                  element={
                    <ProtectedRoute role="owner">
                      <OwnerLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/owner/dashboard" element={<OwnerDashboard />} />
                  <Route path="/owner/orders" element={<OwnerOrders />} />
                  <Route path="/owner/products" element={<OwnerProducts />} />
                  <Route path="/owner/inventory" element={<OwnerInventory />} />
                  <Route path="/owner/pos" element={<OwnerPOS />} />
                  <Route path="/owner/analytics" element={<OwnerAnalytics />} />
                </Route>

                <Route path="*" element={<Home />} />
              </Routes>
            </ToastProvider>
          </CartProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
