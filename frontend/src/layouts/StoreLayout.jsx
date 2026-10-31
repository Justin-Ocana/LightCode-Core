import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { TemplateProvider } from '../context/TemplateContext';
import { BuyerProvider } from '../context/BuyerContext';
import { CartProvider } from '../context/CartContext';
import { StoreNavbar } from '../components/store/StoreNavbar';
import { StoreFooter } from '../components/store/StoreFooter';
import { CartSidebar } from '../components/store/CartSidebar';
import { FlyToCartEffect } from '../components/store/FlyToCartEffect';
import { StoreBrandLoader } from '../components/store/StoreBrandLoader';
import { getMediaUrl } from '../services/api';
import { updateMetaTags, resetMetaTags } from '../utils/metaTags';
import api from '../services/api';

/**
 * Layout simplificado para la tienda pública (white-label)
 * Carga la primera (y única) tienda que exista en el sistema
 */
export function StoreLayout() {
  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Cargar la primera tienda disponible (solo hay una en white-label)
    const loadStore = async () => {
      try {
        setLoading(true);
        
        // Obtener la primera tienda pública
        const response = await api.get('/stores/public/');
        
        // Manejar el formato correcto: {stores: [...], is_single_store: true, auto_select: true}
        const data = response.data;
        const stores = data.stores || data; // Fallback para formato legacy
        
        if (stores && stores.length > 0) {
          const storeData = stores[0];
          setStore(storeData);
          
          // Cargar categorías de la tienda
          try {
            const categoriesResponse = await api.get(`/public/stores/${storeData.slug}/categories/`);
            setCategories(categoriesResponse.data || []);
          } catch (err) {
            console.warn('No se pudieron cargar las categorías:', err);
            setCategories([]);
          }
          
          // Actualizar meta tags
          document.title = `${storeData.name} — Tienda Minecraft`;
          
          const link = document.querySelector("link[rel~='icon']");
          const logoUrl = getMediaUrl(storeData.logo_url);
          if (link && logoUrl) {
            link.href = logoUrl;
          }
          
          const description = storeData.description || `Tienda de Minecraft ${storeData.name}. Compra rangos, items y más para el servidor.`;
          
          updateMetaTags({
            title: `${storeData.name} — Tienda Minecraft`,
            description: description,
            image: logoUrl,
            url: window.location.origin,
            type: 'website',
            siteName: storeData.name
          });
          
          // Retrasar un poco para que el tema cargue
          setTimeout(() => setReady(true), 100);
        } else {
          setError({ message: 'No hay tiendas configuradas. Ejecuta setup_whitelabel.py' });
        }
      } catch (err) {
        console.error('Error al cargar la tienda:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    loadStore();
    
    // Cleanup
    return () => {
      document.title = 'Tienda';
      const link = document.querySelector("link[rel~='icon']");
      if (link) {
        link.href = '/favicon.svg';
      }
      resetMetaTags();
    };
  }, []);

  if (loading && !store) {
    return (
      <StoreBrandLoader
        overlay
        storeName="Cargando"
        message="Buscando tu tienda"
      />
    );
  }

  if (store && !ready) {
    return (
      <StoreBrandLoader
        overlay
        storeName={store.name}
        logoUrl={getMediaUrl(store.logo_url)}
        message="Abriendo tienda"
      />
    );
  }

  if (error || !store) {
    return (
      <div className="store-error" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Tienda no encontrada</h1>
        <p style={{ color: '#666', marginBottom: '2rem' }}>
          {error?.response?.data?.detail || error?.message || 'La tienda no está disponible en este momento.'}
        </p>
      </div>
    );
  }

  // Envolver con providers
  return (
    <BuyerProvider storeSlug={store.slug}>
      <CartProvider>
        <TemplateProvider>
          <div style={{ 
            display: 'grid',
            gridTemplateRows: 'auto 1fr auto',
            minHeight: '100vh'
          }}>
            {/* Premium Navbar */}
            <StoreNavbar 
              storeName={store.name}
              logo={getMediaUrl(store.logo_url)}
              storeSlug={store.slug}
            />
            
            <CartSidebar />
            <FlyToCartEffect />
            
            {/* Main Content */}
            <main>
              <Outlet context={{ store, categories }} />
            </main>
            
            {/* Premium Footer */}
            <StoreFooter 
              storeName={store.name}
              storeSlug={store.slug}
            />
          </div>
        </TemplateProvider>
      </CartProvider>
    </BuyerProvider>
  );
}
