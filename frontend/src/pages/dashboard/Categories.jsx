import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import api from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import Alert from '../../components/Alert';
import ConfirmModal from '../../components/ConfirmModal';
import '../../styles/categories.css';

// SVG Icons para categorías globales
const CategoryIcons = {
  rank: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  kit: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 7V5C8 3.89543 8.89543 3 10 3H14C15.1046 3 16 3.89543 16 5V7" 
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 11V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  item: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  ),
  cosmetic: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" 
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  subscription: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M23 6L13.5 15.5L8.5 10.5L1 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 6H23V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  custom: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 1V4M12 20V23M4.22 4.22L6.34 6.34M17.66 17.66L19.78 19.78M1 12H4M20 12H23M4.22 19.78L6.34 17.66M17.66 6.34L19.78 4.22" 
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  default: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
      <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
};

// Custom hook para manejo de formularios
const useForm = (initialValues) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setValues(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return { values, errors, touched, handleChange, handleBlur, reset, setErrors, setValues };
};

export default function Categories() {
  const { activeStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [alert, setAlert] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const form = useForm({
    name: '',
    slug: '',
    description: '',
    icon: 'default',
    sort_order: 0
  });

  // Memoizar funciones para evitar re-renders innecesarios
  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  }, []);

  const fetchCategories = useCallback(async () => {
    if (!activeStore) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const response = await api.get(`/stores/${activeStore.id}/categories/`);
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      showAlert('Error al cargar las categorías', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeStore, showAlert]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Handlers con optimistic updates
  const handleCreateCategory = useCallback(async (e) => {
    e.preventDefault();
    form.setErrors({});
    setSubmitting(true);

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticCategory = {
      id: tempId,
      ...form.values,
      is_default: false,
      is_custom: true,
      products_count: 0,
      created_at: new Date().toISOString(),
      _optimistic: true
    };

    setCategories(prev => [...prev, optimisticCategory]);
    setShowCreateModal(false);

    try {
      const response = await api.post(
        `/stores/${activeStore.id}/categories/create/`,
        form.values
      );
      
      // Reemplazar categoría optimista con la real
      setCategories(prev => prev.map(cat => 
        cat.id === tempId ? response.data : cat
      ));
      
      form.reset();
      showAlert('Categoría creada exitosamente', 'success');
    } catch (error) {
      // Revertir optimistic update
      setCategories(prev => prev.filter(cat => cat.id !== tempId));
      setShowCreateModal(true);
      
      console.error('Error creating category:', error);
      if (error.response?.data?.errors) {
        form.setErrors(error.response.data.errors);
      } else if (error.response?.data?.error) {
        showAlert(error.response.data.error, 'error');
      } else {
        showAlert('Error al crear la categoría', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, activeStore, showAlert]);

  const handleUpdateCategory = useCallback(async (e) => {
    e.preventDefault();
    form.setErrors({});
    setSubmitting(true);

    // Optimistic update
    const updatedCategory = { ...editingCategory, ...form.values };
    setCategories(prev => prev.map(cat => 
      cat.id === editingCategory.id ? updatedCategory : cat
    ));
    setEditingCategory(null);

    try {
      const response = await api.patch(
        `/categories/${editingCategory.id}/`,
        form.values
      );
      
      // Actualizar con datos reales del servidor
      setCategories(prev => prev.map(cat => 
        cat.id === editingCategory.id ? response.data : cat
      ));
      
      form.reset();
      showAlert('Categoría actualizada exitosamente', 'success');
    } catch (error) {
      // Revertir optimistic update
      setCategories(prev => prev.map(cat => 
        cat.id === editingCategory.id ? editingCategory : cat
      ));
      setEditingCategory(editingCategory);
      
      console.error('Error updating category:', error);
      if (error.response?.data?.errors) {
        form.setErrors(error.response.data.errors);
      } else {
        showAlert('Error al actualizar la categoría', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, editingCategory, showAlert]);

  const handleDeleteCategory = useCallback(async (categoryId) => {
    setPendingDeleteId(categoryId);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;

    setDeleteBusy(true);
    setDeletingId(pendingDeleteId);

    // Optimistic update
    const deletedCategory = categories.find(cat => cat.id === pendingDeleteId);
    setCategories(prev => prev.filter(cat => cat.id !== pendingDeleteId));

    try {
      await api.delete(`/categories/${pendingDeleteId}/`);
      showAlert('Categoría eliminada exitosamente', 'success');
      setPendingDeleteId(null);
    } catch (error) {
      // Revertir optimistic update
      setCategories(prev => [...prev, deletedCategory].sort((a, b) => a.sort_order - b.sort_order));
      
      console.error('Error deleting category:', error);
      if (error.response?.data?.error) {
        showAlert(error.response.data.error, 'error');
      } else {
        showAlert('Error al eliminar la categoría', 'error');
      }
    } finally {
      setDeleteBusy(false);
      setDeletingId(null);
    }
  }, [pendingDeleteId, categories, showAlert]);

  const closeDeleteModal = useCallback(() => {
    if (!deleteBusy) setPendingDeleteId(null);
  }, [deleteBusy]);

  const openEditModal = useCallback((category) => {
    setEditingCategory(category);
    form.setValues({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      icon: category.icon || 'default',
      sort_order: category.sort_order || 0
    });
  }, [form]);

  const closeModal = useCallback(() => {
    setShowCreateModal(false);
    setEditingCategory(null);
    form.reset();
  }, [form]);

  const getCategoryIcon = useCallback((iconKey) => {
    return CategoryIcons[iconKey] || CategoryIcons.default;
  }, []);

  // Memoizar cálculos costosos
  const { defaultCategories, additionalCategories } = useMemo(() => {
    const defaultCats = categories.filter(cat => cat.is_default);
    const additionalCats = categories.filter(cat => !cat.is_default);

    return {
      defaultCategories: defaultCats,
      additionalCategories: additionalCats
    };
  }, [categories]);

  if (loading) {
    return <LoadingScreen message="Cargando categorías" />;
  }

  if (!activeStore) {
    return (
      <div className="categories-empty-state">
        <div className="empty-state-icon">
          {CategoryIcons.default}
        </div>
        <h2 className="empty-state-title">Espera un momento...</h2>
        <p className="empty-state-description">Para gestionar categorías, primero Espera un momento...</p>
      </div>
    );
  }

  return (
    <div className="categories-page">
      {alert && <Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}

      <ConfirmModal
        isOpen={!!pendingDeleteId}
        title="Eliminar categoría"
        message="¿Estás seguro de eliminar esta categoría? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={confirmDelete}
        onClose={closeDeleteModal}
      />

      {/* Header */}
      <div className="categories-header">
        <div className="categories-header-content">
          <div className="categories-header-left">
            <h1>Categorías de Productos</h1>
            <p className="categories-subtitle">Organiza tus productos con categorías globales y personalizadas</p>
          </div>
          <button 
            className="categories-create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M10 5V15M5 10H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Nueva Categoría
          </button>
        </div>
      </div>

      {/* Grid Unificado de Categorías */}
      <section className="categories-section">
        <div className="section-header">
          <h2 className="section-title">Todas las Categorías</h2>
          <span className="badge badge-info">{categories.length} en total</span>
        </div>
        <p className="section-description">
          Gestiona las categorías de productos de tu tienda
        </p>

        {categories.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              {CategoryIcons.default}
            </div>
            <h3 className="empty-state-title">No tienes categorías</h3>
            <p className="empty-state-description">Crea categorías para organizar tus productos</p>
            <button 
              className="btn btn-md btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              Crear Primera Categoría
            </button>
          </div>
        ) : (
          <div className="categories-grid">
            {categories.map(category => (
              <div 
                key={category.id} 
                className={`category-card ${category.is_default ? 'category-card-global' : 'category-card-custom'} ${category._optimistic ? 'category-card-optimistic' : ''}`}
                style={{ opacity: deletingId === category.id ? 0.5 : 1, pointerEvents: deletingId === category.id ? 'none' : 'auto' }}
              >
                <div className="category-card-header">
                  <div className={`category-icon ${category.is_default ? 'category-icon-global' : 'category-icon-custom'}`}>
                    {getCategoryIcon(category.icon || category.slug)}
                  </div>
                  <div className="category-actions">
                    <button 
                      className="btn-icon"
                      onClick={() => openEditModal(category)}
                      title="Editar"
                      aria-label={`Editar categoría ${category.name}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" 
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" 
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                    <button 
                      className="btn-icon btn-icon-danger"
                      onClick={() => handleDeleteCategory(category.id)}
                      title="Eliminar"
                      aria-label={`Eliminar categoría ${category.name}`}
                      disabled={deletingId === category.id}
                    >
                      {deletingId === category.id ? (
                        <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
                          <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" 
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      )}
                    </button>
                    {category.is_default && <span className="badge badge-premium">Base</span>}
                  </div>
                </div>
                <h3 className="category-name">{category.name}</h3>
                <p className="category-description">{category.description || 'Sin descripción'}</p>
                <div className="category-stats">
                  <div className="category-stat">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" 
                        stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    <span>{category.products_count || 0} productos</span>
                  </div>
                </div>
                {category._optimistic && (
                  <div className="category-optimistic-badge">
                    <span>Guardando...</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
  
        {/* Modal Crear/Editar */}
      {(showCreateModal || editingCategory) && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
              <button className="modal-close" onClick={closeModal}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <form onSubmit={editingCategory ? handleUpdateCategory : handleCreateCategory} className="modal-form">
              <div className="form-group">
                <label htmlFor="name" className="form-label form-label-required">Nombre</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={form.values.name}
                  onChange={form.handleChange}
                  onBlur={form.handleBlur}
                  placeholder="Ej: Armas Legendarias"
                  required
                  className={`input ${form.errors.name ? 'input-error' : ''}`}
                  aria-invalid={form.errors.name ? 'true' : 'false'}
                  aria-describedby={form.errors.name ? 'name-error' : undefined}
                />
                {form.errors.name && (
                  <span id="name-error" className="form-error" role="alert">{form.errors.name}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="slug" className="form-label">Slug</label>
                <input
                  type="text"
                  id="slug"
                  name="slug"
                  value={form.values.slug}
                  onChange={form.handleChange}
                  onBlur={form.handleBlur}
                  placeholder="Se genera automáticamente"
                  className={`input ${form.errors.slug ? 'input-error' : ''}`}
                  aria-invalid={form.errors.slug ? 'true' : 'false'}
                  aria-describedby="slug-hint slug-error"
                />
                <span id="slug-hint" className="form-hint">URL amigable. Déjalo vacío para generarlo automáticamente.</span>
                {form.errors.slug && (
                  <span id="slug-error" className="form-error" role="alert">{form.errors.slug}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="icon" className="form-label">Icono</label>
                <div className="icon-selector" role="radiogroup" aria-label="Seleccionar icono">
                  {[
                    { value: 'default', label: 'Por defecto', icon: CategoryIcons.default },
                    { value: 'rank', label: 'Rank (Corona)', icon: CategoryIcons.rank },
                    { value: 'kit', label: 'Kit (Mochila)', icon: CategoryIcons.kit },
                    { value: 'item', label: 'Item (Diamante)', icon: CategoryIcons.item },
                    { value: 'cosmetic', label: 'Cosmetic (Estrella)', icon: CategoryIcons.cosmetic },
                    { value: 'subscription', label: 'Subscription (Gráfico)', icon: CategoryIcons.subscription },
                    { value: 'custom', label: 'Custom (Engranaje)', icon: CategoryIcons.custom },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={form.values.icon === option.value}
                      className={`icon-option ${form.values.icon === option.value ? 'icon-option-selected' : ''}`}
                      onClick={() => form.setValues(prev => ({ ...prev, icon: option.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          form.setValues(prev => ({ ...prev, icon: option.value }));
                        }
                      }}
                    >
                      <div className="icon-option-preview">
                        {option.icon}
                      </div>
                      <span className="icon-option-label">{option.label}</span>
                    </button>
                  ))}
                </div>
                <span className="form-hint">Selecciona un icono para representar la categoría</span>
              </div>

              <div className="form-group">
                <label htmlFor="description" className="form-label">Descripción</label>
                <textarea
                  id="description"
                  name="description"
                  value={form.values.description}
                  onChange={form.handleChange}
                  onBlur={form.handleBlur}
                  placeholder="Describe esta categoría..."
                  rows="3"
                  maxLength="500"
                  className="textarea"
                  aria-describedby="description-hint"
                />
                <span id="description-hint" className="form-hint">{form.values.description.length}/500 caracteres</span>
              </div>

              <div className="form-group">
                <label htmlFor="sort_order" className="form-label">Orden</label>
                <input
                  type="number"
                  id="sort_order"
                  name="sort_order"
                  value={form.values.sort_order}
                  onChange={form.handleChange}
                  onBlur={form.handleBlur}
                  min="0"
                  className="input"
                  aria-describedby="sort-order-hint"
                />
                <span id="sort-order-hint" className="form-hint">Orden de visualización (menor = primero)</span>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-md btn-secondary" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-md btn-primary" disabled={submitting}>
                  {submitting ? (
                    <span className="btn-loading">Guardando...</span>
                  ) : (
                    editingCategory ? 'Actualizar' : 'Crear Categoría'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
