import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import { StorePageLayout } from '../../components/store/StorePageLayout';
import { ProductCard } from '../../components/store/ProductCard';
import { StoreInlineSpinner } from '../../components/store/StoreInlineSpinner';
import { ShopSidebar } from '../../components/store/ShopSidebar';
import { useStoreSlug } from '../../hooks/useStoreSlug';
import { productsAPI } from '../../services/api';
import './StoreShop.css';

export function StoreShop() {
  // Todos los hooks primero, en orden consistente
  const storeSlug = useStoreSlug();
  const { store, categories } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Luego las variables derivadas
  const selectedCategoryId = searchParams.get('category') || null;
  const sort = searchParams.get('sort') || 'newest';
  const priceMin = searchParams.get('price_min') || '';
  const priceMax = searchParams.get('price_max') || '';
  const searchQuery = searchParams.get('search') || '';
  const hasActiveFilters = selectedCategoryId || priceMin || priceMax || sort !== 'newest' || searchQuery;

  // Callbacks
  const patchFilters = useCallback(
    (partial) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(partial).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '' || value === false) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          });
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const clearFilters = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  const loadProducts = useCallback(async () => {
    if (!store) return;

    try {
      setLoading(true);

      const params = {
        store: store.id,
        sort: sort,
      };
      if (selectedCategoryId) params.category = selectedCategoryId;
      if (priceMin) params.price_min = priceMin;
      if (priceMax) params.price_max = priceMax;
      if (searchQuery) params.search = searchQuery;

      const response = await productsAPI.list(params);
      setProducts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [store, sort, selectedCategoryId, priceMin, priceMax, searchQuery]);

  useEffect(() => {
    if (store) {
      loadProducts();
    }
    // Scroll to top when entering shop
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [store, loadProducts]);

  return (
    <StorePageLayout store={store} storeSlug={storeSlug}>
      <div className="shop-container">
        {/* Premium Sidebar Component */}
        <ShopSidebar
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          sort={sort}
          priceMin={priceMin}
          priceMax={priceMax}
          searchQuery={searchQuery}
          onFilterChange={patchFilters}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Main Content */}
        <main className="shop-main">
          <div className="shop-header">
            <h1 className="shop-title">Tienda</h1>
            <p className="shop-count">
              {products.length} {products.length === 1 ? 'producto' : 'productos'}
            </p>
          </div>

          {loading ? (
            <div className="shop-loading">
              <StoreInlineSpinner label="Cargando productos…" />
            </div>
          ) : products.length === 0 ? (
            <div className="shop-empty">
              <h2>No hay productos disponibles</h2>
              <p>Prueba ajustando los filtros o vuelve más tarde.</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="empty-clear-btn">
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="products-grid">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  storeSlug={storeSlug}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </StorePageLayout>
  );
}
