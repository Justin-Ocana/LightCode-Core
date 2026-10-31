import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import LoadingScreen from './components/LoadingScreen';
import Alert from './components/Alert';
import Toast from './components/Toast';

// Toast Container Component
function ToastContainerWrapper() {
  const { toasts, dismissToast } = useNotifications();

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onClose={dismissToast}
        />
      ))}
    </div>
  );
}

// Pages
import Auth from './pages/Auth';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Cookies from './pages/Cookies';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';
import { StoreLayout } from './layouts/StoreLayout';

// Dashboard Pages
import DashboardHome from './pages/dashboard/DashboardHome';
import Settings from './pages/dashboard/Settings';
import Categories from './pages/dashboard/Categories';
import Products from './pages/dashboard/Products';
import CreateProduct from './pages/dashboard/CreateProduct';
import EditProduct from './pages/dashboard/EditProduct';
import Discounts from './pages/dashboard/Discounts';
import OrderDetail from './pages/dashboard/OrderDetailV2';
import Orders from './pages/dashboard/Orders';
import Analytics from './pages/dashboard/Analytics';
import Customers from './pages/dashboard/Customers';
import Support from './pages/dashboard/Support';
import RCONConfig from './pages/dashboard/RCONConfig';
import RCONPanel from './pages/dashboard/RCONPanel';

// Store Pages (Public)
import { 
  StoreHome, 
  StoreShop, 
  StoreProduct, 
  StoreCart, 
  StoreCheckout, 
  StoreOrder, 
  StoreAccount, 
  StoreSupport
} from './pages/store';
import { StoreCheckoutSuccess } from './pages/store/StoreCheckoutSuccess';
import { StoreCheckoutCancel } from './pages/store/StoreCheckoutCancel';
import { StoreOrders } from './pages/store/StoreOrders';
import { StoreOrderDetail } from './pages/store/StoreOrderDetail';
import { StoreLogin } from './pages/store/StoreLogin';
import { StoreRegister } from './pages/store/StoreRegister';

// Debug Pages
import { LoaderDebug } from './pages/debug';

// Components
import StoreAlert from './components/store/StoreAlert';

import './App.css';

// Componente para renderizar la alerta adecuada según la ruta
function UniversalAlert({ t }) {
  const location = useLocation();
  const isDashboardRoute = location.pathname.startsWith('/dashboard');
  
  const type = t.type === 'success' ? 'success' 
             : t.type === 'error' ? 'error'
             : t.type === 'loading' ? 'info'
             : 'info';

  const handleClose = () => {
    toast.dismiss(t.id);
    window.dispatchEvent(new CustomEvent('toast-closed', { detail: { id: t.id } }));
  };

  // Dashboard usa Alert normal, Store usa StoreAlert
  if (isDashboardRoute) {
    return (
      <Alert
        type={type}
        title={t.type === 'success' ? '¡Éxito!'
             : t.type === 'error' ? 'Error'
             : t.type === 'loading' ? 'Cargando...'
             : 'Información'}
        message={typeof t.message === 'string' ? t.message : ''}
        onClose={handleClose}
      />
    );
  }

  return (
    <StoreAlert
      type={type}
      title={t.type === 'success' ? '¡Éxito!' : t.type === 'error' ? 'Error' : 'Información'}
      message={typeof t.message === 'string' ? t.message : ''}
      onClose={handleClose}
    />
  );
}

// Protected Route Component - Solo requiere autenticación
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading: authLoading } = useAuth();

  if (authLoading) {
    return <LoadingScreen message="Verificando sesión" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NotificationProvider>
          <ToastContainerWrapper />
          <Toaster
            position="top-right"
            containerStyle={{
              top: 100,
              right: 20,
            }}
            toastOptions={{
              duration: 4000,
              style: {
                background: 'transparent',
                boxShadow: 'none',
                padding: 0,
              },
              success: { icon: null },
              error: { icon: null },
              loading: { icon: null },
            }}
          >
            {(t) => (
              <div style={{ maxWidth: 400, width: '100%' }}>
                <UniversalAlert t={t} />
              </div>
            )}
          </Toaster>
          
          <Routes>
            {/* Debug Routes - Solo en desarrollo */}
            <Route path="/debug/loader" element={<LoaderDebug />} />
            
            {/* Public Store Routes - La tienda es la raíz (sin slug) */}
            <Route path="/" element={
              <StoreProvider>
                <StoreLayout />
              </StoreProvider>
            }>
              <Route index element={<StoreHome />} />
              <Route path="shop" element={<StoreShop />} />
              <Route path="shop/:productSlug" element={<StoreProduct />} />
              <Route path="cart" element={<StoreCart />} />
              <Route path="checkout" element={<StoreCheckout />} />
              <Route path="checkout/success" element={<StoreCheckoutSuccess />} />
              <Route path="checkout/cancel" element={<StoreCheckoutCancel />} />
              <Route path="orders" element={<StoreOrders />} />
              <Route path="orders/:orderId" element={<StoreOrderDetail />} />
              <Route path="order/:orderId" element={<StoreOrder />} />
              <Route path="account" element={<StoreAccount />} />
              <Route path="support" element={<StoreSupport />} />
              <Route path="login" element={<StoreLogin />} />
              <Route path="register" element={<StoreRegister />} />
            </Route>
            
            {/* Admin Login */}
            <Route path="/admin/login" element={<Auth />} />
            
            {/* Legal Pages */}
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/cookies" element={<Cookies />} />
            
            {/* Dashboard Routes - Panel de administración (sin StoreProvider) */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<DashboardHome />} />
              <Route path=":storeSlug" element={<DashboardHome />} />
              <Route path=":storeSlug/orders" element={<Orders />} />
              <Route path=":storeSlug/orders/:orderId" element={<OrderDetail />} />
              <Route path=":storeSlug/products" element={<Products />} />
              <Route path=":storeSlug/products/create" element={<CreateProduct />} />
              <Route path=":storeSlug/products/:productId/edit" element={<EditProduct />} />
              <Route path=":storeSlug/categories" element={<Categories />} />
              <Route path=":storeSlug/discounts" element={<Discounts />} />
              <Route path=":storeSlug/customers" element={<Customers />} />
              <Route path=":storeSlug/analytics" element={<Analytics />} />
              <Route path=":storeSlug/support" element={<Support />} />
              <Route path=":storeSlug/settings" element={<Settings />} />
              <Route path=":storeSlug/rcon" element={<RCONConfig />} />
              <Route path=":storeSlug/rcon-config" element={<RCONConfig />} />
              <Route path=":storeSlug/rcon/panel" element={<RCONPanel />} />
              <Route path=":storeSlug/rcon-lab" element={<RCONPanel />} />
            </Route>

            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </NotificationProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
