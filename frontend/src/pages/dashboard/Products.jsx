/**
 * Products Page - Lista y gestión de productos
 * Vista de tabla profesional con filtros y acciones
 */
import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useStore } from '../../context/StoreContext';
import api from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import ConfirmModal from '../../components/ConfirmModal';
import '../../styles/products.css';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'DRAFT', label: 'Borrador' }
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'ONE_TIME', label: 'Único' },
  { value: 'SUBSCRIPTION', label: 'Suscripción' }
];

function getStatusBadge(status) {
  const badges = {
    ACTIVE: { label: 'Activo', class: 'badge-success' },
    INACTIVE: { label: 'Inactivo', class: 'badge-secondary' },
    DRAFT: { label: 'Borrador', class: 'badge-muted' },
  };
  return badges[status] || badges.DRAFT;
}

function getPurchaseTypeLabel(purchaseType) {
  const opt = TYPE_OPTIONS.find((o) => o.value === purchaseType);
  return opt?.label || purchaseType;
}

/** Menú ⋮ reutilizable (tabla escritorio + tarjetas móvil) */
const ProductActionsMenu = React.memo(function ProductActionsMenu({
  product,
  isOpen,
  toggleMenu,
  closeMenu,
  onEdit,
  onDuplicate,
  onToggleStatus,
  onDelete,
  onViewInStore,
  triggerClassName = 'btn-icon',
  iconSize = 16,
}) {
  const actionsButtonRef = useRef(null);
  const menuRef = useRef(null);
  const [menuCoords, setMenuCoords] = useState({
    top: 0,
    right: 0,
    bottom: 'auto',
  });

  useLayoutEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const el = actionsButtonRef.current;
    if (!el) {
      return undefined;
    }

    const margin = 8;
    const gap = 8;

    const applyPosition = () => {
      const menu = menuRef.current;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const h = menu?.offsetHeight ?? 260;
      const spaceBelow = vh - r.bottom - margin;
      const spaceAbove = r.top - margin;
      const need = h + gap;
      const fitsBelow = spaceBelow >= need;
      const fitsAbove = spaceAbove >= need;
      let placeAbove = false;
      if (fitsBelow) {
        placeAbove = false;
      } else if (fitsAbove) {
        placeAbove = true;
      } else {
        placeAbove = spaceAbove > spaceBelow;
      }

      const right = Math.max(margin, Math.round(vw - r.right));
      if (placeAbove) {
        setMenuCoords({
          top: 'auto',
          bottom: Math.round(vh - r.top + gap),
          right,
        });
      } else {
        setMenuCoords({
          top: Math.round(r.bottom + gap),
          bottom: 'auto',
          right,
        });
      }
    };

    applyPosition();
    const raf = requestAnimationFrame(applyPosition);
    window.addEventListener('resize', applyPosition);
    document.addEventListener('scroll', applyPosition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', applyPosition);
      document.removeEventListener('scroll', applyPosition, true);
    };
  }, [isOpen]);

  return (
    <div className="actions-menu-wrapper">
      <button
        ref={actionsButtonRef}
        type="button"
        className={triggerClassName}
        onClick={toggleMenu}
        aria-label="Acciones"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="5" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="19" r="1.5" fill="currentColor" />
        </svg>
      </button>

      {isOpen &&
        createPortal(
          <>
            <div
              className="actions-menu-backdrop"
              onClick={closeMenu}
              aria-hidden="true"
            />
            <div
              ref={menuRef}
              className={`actions-menu${menuCoords.top === 'auto' ? ' actions-menu--above' : ''}`}
              role="menu"
              style={{
                top: menuCoords.top === 'auto' ? 'auto' : menuCoords.top,
                bottom: menuCoords.bottom === 'auto' ? 'auto' : menuCoords.bottom,
                right: menuCoords.right,
                left: 'auto',
              }}
            >
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onEdit();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Editar
              </button>
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onDuplicate();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Duplicar
              </button>
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onViewInStore();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path d="M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Ver en tienda
              </button>
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onToggleStatus();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {product.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
              </button>
              <div className="menu-divider" />
              <button
                type="button"
                className="menu-item menu-item-danger"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onDelete();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path
                    d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Eliminar
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  );
});

export default function Products() {
  const navigate = useNavigate();
  const { activeStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [actionMenuOpen, setActionMenuOpen] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  /** Overlay de carga durante acciones (evita pantalla “congelada” hasta que responde el API) */
  const [actionLoadingMessage, setActionLoadingMessage] = useState(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState(() => {
    // Cargar preferencia guardada
    return localStorage.getItem('productsSortBy') || 'created_desc';
  });
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [draggedProduct, setDraggedProduct] = useState(null);
  /** Móvil: panel de filtros colapsado por defecto */
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Guardar preferencia de ordenamiento
  useEffect(() => {
    localStorage.setItem('productsSortBy', sortBy);
  }, [sortBy]);

  const loadProductsAndCategories = useCallback(async () => {
    if (!activeStore) return;
    const [productsRes, categoriesRes] = await Promise.all([
      api.get(`/stores/${activeStore.id}/products/`),
      api.get(`/stores/${activeStore.id}/categories/`),
    ]);
    setProducts(productsRes.data);
    setCategories(categoriesRes.data);
  }, [activeStore]);

  const fetchData = useCallback(async () => {
    if (!activeStore) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      await loadProductsAndCategories();
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los productos');
    } finally {
      setLoading(false);
    }
  }, [activeStore, loadProductsAndCategories]);

  useEffect(() => {
    if (activeStore) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [activeStore, fetchData]);

  const closeDeleteModal = useCallback(() => {
    if (!deleteBusy) setPendingDeleteId(null);
  }, [deleteBusy]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    try {
      setDeleteBusy(true);
      setActionLoadingMessage('Eliminando producto...');
      await api.delete(`/products/${pendingDeleteId}/`);
      setProducts((prev) => prev.filter((p) => p.id !== pendingDeleteId));
      setPendingDeleteId(null);
      toast.success('Producto eliminado');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Error al eliminar el producto');
    } finally {
      setDeleteBusy(false);
      setActionLoadingMessage(null);
    }
  }, [pendingDeleteId]);

  // Filtrado y ordenamiento de productos
  const filteredProducts = useMemo(() => {
    let result = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           product.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
      const matchesType = typeFilter === 'all' || product.purchase_type === typeFilter;
      
      return matchesSearch && matchesCategory && matchesStatus && matchesType;
    });

    // Aplicar ordenamiento
    switch (sortBy) {
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'price_asc':
        result.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        break;
      case 'price_desc':
        result.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        break;
      case 'sales_desc':
        result.sort((a, b) => (b.total_sold || 0) - (a.total_sold || 0));
        break;
      case 'sales_asc':
        result.sort((a, b) => (a.total_sold || 0) - (b.total_sold || 0));
        break;
      case 'created_desc':
        result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'created_asc':
        result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'custom':
        result.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        break;
      default:
        break;
    }

    return result;
  }, [products, searchQuery, categoryFilter, statusFilter, typeFilter, sortBy]);

  // Estadísticas
  const stats = useMemo(() => {
    const active = products.filter(p => p.status === 'ACTIVE').length;
    const draft = products.filter(p => p.status === 'DRAFT').length;
    return { total: products.length, active, draft };
  }, [products]);

  const mobileFiltersActive = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      categoryFilter !== 'all' ||
      statusFilter !== 'all' ||
      typeFilter !== 'all'
    );
  }, [searchQuery, categoryFilter, statusFilter, typeFilter]);

  const handleDuplicate = async (product) => {
    setActionMenuOpen(null);
    setActionLoadingMessage('Duplicando producto...');
    try {
      await api.post(`/products/${product.id}/duplicate/`, {
        name: `${product.name} (copia)`,
        status: 'DRAFT',
      });
      await loadProductsAndCategories();
      toast.success('Producto duplicado');
    } catch (error) {
      console.error('Error duplicating product:', error);
      toast.error('Error al duplicar el producto');
    } finally {
      setActionLoadingMessage(null);
    }
  };

  const handleToggleStatus = async (product) => {
    setActionMenuOpen(null);
    setActionLoadingMessage('Actualizando estado...');
    try {
      const newStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/products/${product.id}/`, { status: newStatus });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, status: newStatus } : p))
      );
      toast.success(newStatus === 'ACTIVE' ? 'Producto activado' : 'Producto desactivado');
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Error al cambiar el estado');
    } finally {
      setActionLoadingMessage(null);
    }
  };

  const handleDelete = (productId) => {
    setActionMenuOpen(null);
    setPendingDeleteId(productId);
  };

  // Funciones para drag & drop y reordenamiento
  const handleDragStart = (e, product) => {
    setDraggedProduct(product);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetProduct) => {
    e.preventDefault();
    
    if (!draggedProduct || draggedProduct.id === targetProduct.id) {
      setDraggedProduct(null);
      return;
    }

    try {
      setIsReordering(true);
      
      // Crear nuevo array con el orden actualizado
      const newProducts = [...filteredProducts];
      const draggedIndex = newProducts.findIndex(p => p.id === draggedProduct.id);
      const targetIndex = newProducts.findIndex(p => p.id === targetProduct.id);
      
      // Remover el producto arrastrado
      const [removed] = newProducts.splice(draggedIndex, 1);
      // Insertarlo en la nueva posición
      newProducts.splice(targetIndex, 0, removed);
      
      // Actualizar sort_order para todos los productos
      const updates = newProducts.map((product, index) => ({
        id: product.id,
        sort_order: index
      }));
      
      // Actualizar UI optimísticamente
      setProducts(prev => {
        const updated = [...prev];
        updates.forEach(update => {
          const idx = updated.findIndex(p => p.id === update.id);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], sort_order: update.sort_order };
          }
        });
        return updated;
      });
      
      // Enviar al backend
      await api.post(`/stores/${activeStore.id}/products/reorder/`, updates);
      toast.success('Orden actualizado');
      
    } catch (error) {
      console.error('Error reordering products:', error);
      toast.error('Error al actualizar el orden');
      // Recargar productos en caso de error
      await loadProductsAndCategories();
    } finally {
      setIsReordering(false);
      setDraggedProduct(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedProduct(null);
  };

  if (loading) {
    return <LoadingScreen message="Cargando productos" />;
  }

  if (!activeStore) {
    return (
      <div className="products-empty-state">
        <h2>Espera un momento...</h2>
        <p>Para gestionar productos, primero Espera un momento...</p>
      </div>
    );
  }

  return (
    <div className="products-page">
      {actionLoadingMessage && (
        <LoadingScreen message={actionLoadingMessage} />
      )}

      <ConfirmModal
        isOpen={!!pendingDeleteId}
        title="Eliminar producto"
        message="¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={confirmDelete}
        onClose={closeDeleteModal}
      />

      {/* Header */}
      <div className="products-header">
        <div className="products-header-content">
          <div className="products-header-left">
            <h1>Productos</h1>
            <div className="products-stats">
              <span className="stat">{stats.total} productos</span>
              <span className="stat-separator">·</span>
              <span className="stat stat-success">{stats.active} activos</span>
              <span className="stat-separator">·</span>
              <span className="stat stat-muted">{stats.draft} borradores</span>
            </div>
          </div>
          <button 
            className="products-create-btn"
            onClick={() => navigate(`/dashboard/${activeStore.slug}/products/create`)}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M10 5V15M5 10H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Filtros rediseñados */}
      <div className="products-filters">
        <div className="filters-container">
          <div className="filters-row">
            <div className="search-box">
              <svg className="search-icon" width="18" height="18" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M14 14L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="filter-select"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Botón de ordenamiento */}
            <div style={{ position: 'relative' }}>
              <button
                className={`sort-button ${sortDropdownOpen ? 'active' : ''}`}
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M7 12h10M11 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Ordenar
              </button>

              {sortDropdownOpen && (
                <>
                  <div 
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 99
                    }}
                    onClick={() => setSortDropdownOpen(false)}
                  />
                  <div className="sort-dropdown">
                    <button
                      className={`sort-option ${sortBy === 'created_desc' ? 'active' : ''}`}
                      onClick={() => { setSortBy('created_desc'); setSortDropdownOpen(false); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14M19 12l-7 7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Más recientes
                    </button>
                    <button
                      className={`sort-option ${sortBy === 'created_asc' ? 'active' : ''}`}
                      onClick={() => { setSortBy('created_asc'); setSortDropdownOpen(false); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Más antiguos
                    </button>
                    <button
                      className={`sort-option ${sortBy === 'name_asc' ? 'active' : ''}`}
                      onClick={() => { setSortBy('name_asc'); setSortDropdownOpen(false); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M3 6h18M3 12h12M3 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Nombre A-Z
                    </button>
                    <button
                      className={`sort-option ${sortBy === 'name_desc' ? 'active' : ''}`}
                      onClick={() => { setSortBy('name_desc'); setSortDropdownOpen(false); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M3 6h6M3 12h12M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Nombre Z-A
                    </button>
                    <button
                      className={`sort-option ${sortBy === 'price_asc' ? 'active' : ''}`}
                      onClick={() => { setSortBy('price_asc'); setSortDropdownOpen(false); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Precio menor
                    </button>
                    <button
                      className={`sort-option ${sortBy === 'price_desc' ? 'active' : ''}`}
                      onClick={() => { setSortBy('price_desc'); setSortDropdownOpen(false); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Precio mayor
                    </button>
                    <button
                      className={`sort-option ${sortBy === 'sales_desc' ? 'active' : ''}`}
                      onClick={() => { setSortBy('sales_desc'); setSortDropdownOpen(false); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                      </svg>
                      Más vendidos
                    </button>
                    <button
                      className={`sort-option ${sortBy === 'custom' ? 'active' : ''}`}
                      onClick={() => { setSortBy('custom'); setSortDropdownOpen(false); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Orden personalizado
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mensaje informativo para drag & drop */}
        {sortBy === 'custom' && filteredProducts.length > 0 && (
          <div className="custom-order-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="custom-order-banner__icon">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="custom-order-banner__text">
              <strong>Modo de reordenamiento activo:</strong> Arrastra y suelta los productos para cambiar su orden. Este orden se guardará y se mostrará en tu tienda pública.
            </span>
          </div>
        )}
      </div>

      {/* Tabla de productos */}
      {filteredProducts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" 
                stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <h3 className="empty-state-title">
            {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'No se encontraron productos'
              : 'No tienes productos todavía'}
          </h3>
          <p className="empty-state-description">
            {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'Crea tu primer producto para empezar a vender'}
          </p>
          {!searchQuery && categoryFilter === 'all' && statusFilter === 'all' && typeFilter === 'all' && (
            <button 
              className="btn btn-md btn-primary"
              onClick={() => navigate(`/dashboard/${activeStore.slug}/products/create`)}
            >
              Crear primer producto
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="products-table-container products-desktop-only">
            <table className="products-table">
              <thead>
                <tr>
                  <th>PRODUCTO</th>
                  <th>CATEGORÍA</th>
                  <th>PRECIO</th>
                  <th>ESTADO</th>
                  <th className="th-actions"></th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    categories={categories}
                    onEdit={() =>
                      navigate(`/dashboard/${activeStore.slug}/products/${product.id}/edit`)
                    }
                    onDuplicate={() => handleDuplicate(product)}
                    onToggleStatus={() => handleToggleStatus(product)}
                    onDelete={() => handleDelete(product.id)}
                    onViewInStore={() =>
                      window.open(`/${activeStore.slug}/products/${product.id}`, '_blank')
                    }
                    actionMenuOpen={actionMenuOpen}
                    setActionMenuOpen={setActionMenuOpen}
                    // Drag & drop props (solo en modo custom)
                    isDraggable={sortBy === 'custom'}
                    isDragging={draggedProduct?.id === product.id}
                    onDragStart={(e) => handleDragStart(e, product)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, product)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="products-mobile-only" aria-label="Lista de productos">
            <ul className="products-mobile-list" role="list">
              {filteredProducts.map((product) => (
                <li key={product.id}>
                  <ProductCardMobile
                    product={product}
                    categories={categories}
                    onEdit={() =>
                      navigate(`/dashboard/${activeStore.slug}/products/${product.id}/edit`)
                    }
                    onDuplicate={() => handleDuplicate(product)}
                    onToggleStatus={() => handleToggleStatus(product)}
                    onDelete={() => handleDelete(product.id)}
                    onViewInStore={() =>
                      window.open(`/${activeStore.slug}/products/${product.id}`, '_blank')
                    }
                    actionMenuOpen={actionMenuOpen}
                    setActionMenuOpen={setActionMenuOpen}
                  />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

/** Tarjeta solo móvil: lectura clara, ancho completo, sin tabla */
const ProductCardMobile = React.memo(function ProductCardMobile({
  product,
  categories,
  onEdit,
  onDuplicate,
  onToggleStatus,
  onDelete,
  onViewInStore,
  actionMenuOpen,
  setActionMenuOpen,
}) {
  const category = categories.find((c) => c.id === product.category);
  const isMenuOpen = actionMenuOpen === product.id;
  const statusBadge = getStatusBadge(product.status);

  return (
    <article className="product-card-mobile">
      <div className="product-card-mobile__header">
        <div className="product-card-mobile__thumb">
          {product.image_url ? (
            <img src={product.image_url} alt="" />
          ) : (
            <div className="product-image-placeholder">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
          )}
        </div>
        <div className="product-card-mobile__titles">
          <h3 className="product-card-mobile__name">{product.name}</h3>
          <p className="product-card-mobile__type">{getPurchaseTypeLabel(product.purchase_type)}</p>
        </div>
        <ProductActionsMenu
          product={product}
          isOpen={isMenuOpen}
          toggleMenu={() => setActionMenuOpen(isMenuOpen ? null : product.id)}
          closeMenu={() => setActionMenuOpen(null)}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
          onViewInStore={onViewInStore}
          triggerClassName="btn-icon product-card-mobile__menu-btn"
          iconSize={18}
        />
      </div>
      <div className="product-card-mobile__meta">
        <span className="category-badge category-badge--mobile">
          <span className="category-dot" />
          {category?.name || 'Sin categoría'}
        </span>
        <span className={`badge ${statusBadge.class}`}>
          <span className="badge-dot" />
          {statusBadge.label}
        </span>
      </div>
      <div className="product-card-mobile__footer">
        <span className="product-card-mobile__price">${parseFloat(product.price).toFixed(2)}</span>
      </div>
    </article>
  );
});

// Componente de fila de producto (escritorio)
const ProductRow = React.memo(
  ({
    product,
    categories,
    onEdit,
    onDuplicate,
    onToggleStatus,
    onDelete,
    onViewInStore,
    actionMenuOpen,
    setActionMenuOpen,
    // Drag & drop props
    isDraggable,
    isDragging,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  }) => {
    const category = categories.find((c) => c.id === product.category);
    const isMenuOpen = actionMenuOpen === product.id;
    const statusBadge = getStatusBadge(product.status);

    return (
      <tr 
        className={`product-row ${isDragging ? 'dragging' : ''} ${isDraggable ? 'draggable' : ''}`}
        draggable={isDraggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        style={{
          opacity: isDragging ? 0.5 : 1,
          cursor: isDraggable ? 'move' : 'default'
        }}
      >
        <td className="td-product">
          <div className="product-info">
            {isDraggable && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-tertiary)', marginRight: 'var(--space-3)', flexShrink: 0 }}>
                <path d="M9 5h2M9 12h2M9 19h2M15 5h2M15 12h2M15 19h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
            <div className="product-image">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} />
              ) : (
                <div className="product-image-placeholder">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              )}
            </div>
            <span className="product-name">{product.name}</span>
          </div>
        </td>
        <td className="td-category">
          <span className="category-badge">
            <span className="category-dot" />
            {category?.name || 'Sin categoría'}
          </span>
        </td>
        <td className="td-price">${parseFloat(product.price).toFixed(2)}</td>
        <td className="td-status">
          <span className={`badge ${statusBadge.class}`}>
            <span className="badge-dot" />
            {statusBadge.label}
          </span>
        </td>
        <td className="td-actions">
          <ProductActionsMenu
            product={product}
            isOpen={isMenuOpen}
            toggleMenu={() => setActionMenuOpen(isMenuOpen ? null : product.id)}
            closeMenu={() => setActionMenuOpen(null)}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
            onViewInStore={onViewInStore}
          />
        </td>
      </tr>
    );
  }
);
