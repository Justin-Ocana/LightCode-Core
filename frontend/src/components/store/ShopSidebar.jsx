import { useState, useEffect, useRef } from 'react';
import { X, Search, Grid3x3, ArrowUpDown, DollarSign, SlidersHorizontal } from 'lucide-react';
import './ShopSidebar.css';

/**
 * Premium Shop Sidebar - Filters Component
 * Responsive: Sidebar on desktop, Drawer/Modal on mobile
 */
export function ShopSidebar({
  categories,
  selectedCategoryId,
  sort,
  priceMin,
  priceMax,
  searchQuery,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef(null);

  // Prevent body scroll when drawer is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  const openDrawer = () => setIsOpen(true);
  const closeDrawer = () => setIsOpen(false);

  const handleFilterChange = (filters) => {
    onFilterChange(filters);
  };

  const handleClearFilters = () => {
    onClearFilters();
    closeDrawer();
  };

  // Count active filters for badge
  const activeFiltersCount = [
    selectedCategoryId,
    priceMin,
    priceMax,
    sort !== 'newest',
    searchQuery
  ].filter(Boolean).length;

  return (
    <>
      {/* Mobile Filter Button */}
      <button 
        className="mobile-filter-btn" 
        onClick={openDrawer}
        aria-label="Abrir filtros"
      >
        <SlidersHorizontal size={20} />
        <span>Filtros</span>
        {activeFiltersCount > 0 && (
          <span className="filter-badge">{activeFiltersCount}</span>
        )}
      </button>

      {/* Overlay */}
      <div 
        className={`shop-sidebar-overlay ${isOpen ? 'shop-sidebar-overlay--active' : ''}`}
        onClick={closeDrawer}
      />

      {/* Sidebar/Drawer */}
      <aside 
        ref={drawerRef}
        className={`shop-sidebar ${isOpen ? 'shop-sidebar--open' : ''}`}
      >
        {/* Mobile Header */}
        <div className="sidebar-mobile-header">
          <div className="sidebar-mobile-title">
            <SlidersHorizontal size={20} />
            <h2>Filtros</h2>
            {activeFiltersCount > 0 && (
              <span className="filter-count-badge">{activeFiltersCount}</span>
            )}
          </div>
          <button 
            className="sidebar-close-btn" 
            onClick={closeDrawer}
            aria-label="Cerrar filtros"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="sidebar-content">
          {/* Search Bar */}
          <div className="sidebar-search">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              className="search-input"
            />
            {searchQuery && (
              <button
                onClick={() => handleFilterChange({ search: '' })}
                className="search-clear"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Categories */}
          <div className="filter-section">
            <div className="filter-title-wrapper">
              <Grid3x3 size={14} className="filter-icon" />
              <h3 className="filter-title">CATEGORÍAS</h3>
            </div>
            <div className="filter-options">
              <button
                onClick={() => handleFilterChange({ category: null })}
                className={`filter-option ${!selectedCategoryId ? 'active' : ''}`}
              >
                Todas
              </button>
              {categories?.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleFilterChange({ category: cat.id })}
                  className={`filter-option ${selectedCategoryId == cat.id ? 'active' : ''}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div className="filter-section">
            <div className="filter-title-wrapper">
              <ArrowUpDown size={14} className="filter-icon" />
              <h3 className="filter-title">ORDENAR</h3>
            </div>
            <select
              value={sort}
              onChange={(e) => handleFilterChange({ sort: e.target.value })}
              className="filter-select"
            >
              <option value="newest">Más recientes</option>
              <option value="price_asc">Precio: Menor a Mayor</option>
              <option value="price_desc">Precio: Mayor a Menor</option>
              <option value="name">Nombre A-Z</option>
            </select>
          </div>

          {/* Price Range */}
          <div className="filter-section">
            <div className="filter-title-wrapper">
              <DollarSign size={14} className="filter-icon" />
              <h3 className="filter-title">RANGO DE PRECIO</h3>
            </div>
            <div className="price-range">
              <div className="price-input-wrapper">
                <span className="price-label">Mín</span>
                <input
                  type="number"
                  placeholder="0"
                  value={priceMin}
                  onChange={(e) => handleFilterChange({ price_min: e.target.value })}
                  className="price-input"
                  min="0"
                />
              </div>
              <div className="price-separator">—</div>
              <div className="price-input-wrapper">
                <span className="price-label">Máx</span>
                <input
                  type="number"
                  placeholder="999"
                  value={priceMax}
                  onChange={(e) => handleFilterChange({ price_max: e.target.value })}
                  className="price-input"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button onClick={handleClearFilters} className="clear-filters-btn">
              <X size={16} />
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Mobile Footer - Apply Button */}
        <div className="sidebar-mobile-footer">
          <button className="apply-filters-btn" onClick={closeDrawer}>
            Ver productos
          </button>
        </div>
      </aside>
    </>
  );
}
