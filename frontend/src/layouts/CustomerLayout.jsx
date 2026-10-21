import { Outlet } from 'react-router-dom';
import CustomerNavbar from '../components/CustomerNavbar';
import CartDrawer from '../components/CartDrawer';

export default function CustomerLayout() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <CustomerNavbar />
      <Outlet />
      <CartDrawer />
    </div>
  );
}
