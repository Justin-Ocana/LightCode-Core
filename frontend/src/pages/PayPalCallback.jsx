import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LoadingScreen from '../components/LoadingScreen';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function PayPalCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code) {
        toast.error('No se recibió código de autorización de PayPal');
        navigate('/dashboard');
        return;
      }

      // Extraer store_slug del state (formato: "random_token:store-slug")
      let storeSlug = null;
      if (state && state.includes(':')) {
        const parts = state.split(':');
        storeSlug = parts[1];
      }

      if (!storeSlug) {
        toast.error('Error: no se pudo identificar la tienda');
        navigate('/dashboard');
        return;
      }

      try {
        // Completar OAuth con el backend
        const response = await api.post(
          `/stores/${storeSlug}/payment-integrations/paypal/oauth/complete`,
          { code, state }
        );

        if (response.data.success) {
          toast.success('¡PayPal conectado exitosamente!');
          navigate(`/dashboard/${storeSlug}/payment-methods`);
        } else {
          toast.error('Error al completar la conexión de PayPal');
          navigate(`/dashboard/${storeSlug}/payment-methods`);
        }
      } catch (error) {
        console.error('Error completing PayPal OAuth:', error);
        toast.error(error.response?.data?.error || 'Error al conectar PayPal');
        navigate(`/dashboard/${storeSlug}/payment-methods`);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return <LoadingScreen message="Conectando con PayPal..." />;
}
