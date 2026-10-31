import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, Package, Download } from 'lucide-react';
import { StoreNavbar } from '../../components/store/StoreNavbar';
import { StoreBrandLoader } from '../../components/store/StoreBrandLoader';
import { StoreInlineSpinner } from '../../components/store/StoreInlineSpinner';
import { formatStoreSlugLabel } from '../../utils/storeSlugLabel';
import { storesAPI, getMediaUrl } from '../../services/api';
import '../../styles/store/index.css';

export function StoreOrder() {
  const { storeSlug, orderId } = useParams();
  const [store, setStore] = useState(null);
  const [storeReady, setStoreReady] = useState(false);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setStore(null);
    setStoreReady(false);
    loadStore();
    loadOrder();
  }, [storeSlug, orderId]);

  async function loadStore() {
    try {
      const response = await storesAPI.getBySlug(storeSlug);
      setStore(response.data);
      setTimeout(() => setStoreReady(true), 100);
    } catch (error) {
      console.error('Error loading store:', error);
    }
  }

  async function loadOrder() {
    try {
      setLoading(true);
      // TODO: Implementar endpoint de orden
      setOrder(null);
    } catch (error) {
      console.error('Error loading order:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!store) {
    return (
      <StoreBrandLoader
        overlay
        storeName={formatStoreSlugLabel(storeSlug)}
        message="Buscando tu tienda"
      />
    );
  }

  if (!storeReady) {
    return (
      <StoreBrandLoader
        overlay
        storeName={store.name}
        logoUrl={getMediaUrl(store.logo_url)}
        message="Abriendo tienda"
      />
    );
  }

  if (loading) {
    return (
      <div className="store-page">
        <StoreNavbar storeName={store.name} logo={getMediaUrl(store.logo_url)} storeId={store.id} />
        <div className="store-container">
          <StoreInlineSpinner label="Cargando pedido…" />
        </div>
      </div>
    );
  }

  return (
    <div className="store-page">
      <StoreNavbar storeName={store.name} logo={getMediaUrl(store.logo_url)} storeId={store.id} />

      <div className="store-container">
        <div className="store-order">
          <div className="store-order__success">
            <CheckCircle size={64} className="store-order__icon" />
            <h1>¡Compra exitosa!</h1>
            <p>Tu pedido ha sido procesado correctamente</p>
          </div>

          <div className="store-order__details">
            <h2>Detalles del pedido</h2>
            <div className="store-order__info">
              <div className="store-order__info-row">
                <span>Número de orden:</span>
                <strong>#{orderId}</strong>
              </div>
              <div className="store-order__info-row">
                <span>Estado:</span>
                <span className="store-order__status">Completado</span>
              </div>
              <div className="store-order__info-row">
                <span>Fecha:</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
            </div>

            <div className="store-order__message">
              <Package size={24} />
              <p>Los productos han sido entregados a tu cuenta de Minecraft.</p>
              <p>Conéctate al servidor para recibirlos.</p>
            </div>

            <div className="store-order__actions">
              <Link to={`/${storeSlug}`} className="store-btn">
                Volver al inicio
              </Link>
              <Link to={`/${storeSlug}/shop`} className="store-btn">
                Seguir comprando
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
