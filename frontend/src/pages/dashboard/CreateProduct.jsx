/**
 * CreateProduct Page - Formulario completo de creación de producto
 * Layout de 2 columnas con preview en tiempo real
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import api from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import Alert from '../../components/Alert';
import ProductPreview from '../../components/ProductPreview';
import CommandEditor from '../../components/CommandEditor';
import ProductGalleryManager from '../../components/ProductGalleryManager';
import ImageCropModal from '../../components/ImageCropModal';
import ConfigWarningModal from '../../components/ConfigWarningModal';
import { useStoreConfig } from '../../hooks/useStoreConfig';
import javaLogo from '../../assets/java_edition.png';
import bedrockLogo from '../../assets/bedrock_edition.png';
import '../../styles/product-form.css';
import '../../styles/product-content.css';

/** Misma proporción que `.preview-image` / cards de producto en la tienda */
const PRODUCT_CARD_ASPECT_RATIO = 16 / 9;

const ALLOWED_VARIABLES = [
  '{username}',
  '{uuid}',
  '{price}',
  '{product_name}',
  '{transaction_id}',
  '{store_slug}'
];

function CreateProduct() {
  const navigate = useNavigate();
  const { activeStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [pageAlert, setPageAlert] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [tempProductImage, setTempProductImage] = useState(null);
  const [showProductImageCrop, setShowProductImageCrop] = useState(false);
  const [productImageCropKey, setProductImageCropKey] = useState(0);
  
  // Config warning modal
  const [showConfigWarning, setShowConfigWarning] = useState(false);
  const [configWarningType, setConfigWarningType] = useState('rcon');
  const [pendingDeliveryMode, setPendingDeliveryMode] = useState(null);
  
  // Verificar configuraciones de la tienda
  const storeConfig = useStoreConfig(activeStore?.id);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    purchase_type: 'ONE_TIME',
    subscription_interval: '',
    global_limit: '',
    per_player_limit: '',
    require_online: false,
    command_delay: 0,
    delivery_mode: 'MANUAL',
    status: 'DRAFT',
    sort_order: 0,
    show_gallery: false,
    content: [],
    // Configuración avanzada de entrega (Bedrock/Mod)
    delivery_config: {
      retry_if_offline: true,
      max_retry_hours: 5,
      success_message: '¡Gracias por tu compra! Tu pedido ha sido entregado.',
      server_chat_message: '',
      server_chat_enabled: false,
      notify_seller_on_fail: true,
    }
  });

  const [commands, setCommands] = useState({
    ON_PURCHASE: [],
    ON_EXPIRY: [],
    ON_REFUND: [],
    ON_CHARGEBACK: [],
    ON_RENEWAL: []
  });

  const [errors, setErrors] = useState({});
  const [commandErrors, setCommandErrors] = useState({});
  const [stagedGalleryImages, setStagedGalleryImages] = useState([]);

  useEffect(() => {
    if (activeStore) {
      fetchCategories();
    } else {
      setLoading(false);
    }
  }, [activeStore]);

  const fetchCategories = async () => {
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
  };

  const showAlert = useCallback((message, type = 'success', options = {}) => {
    const { title } = options;
    setPageAlert({ message, type, title: title ?? undefined });
    setTimeout(() => setPageAlert(null), 5000);
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'delivery_mode' && value === 'RCON') {
      if (!storeConfig.loading && !storeConfig.rcon.configured) {
        setPendingDeliveryMode(value);
        setConfigWarningType('rcon');
        setShowConfigWarning(true);
        return;
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleDeliveryConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      delivery_config: {
        ...prev.delivery_config,
        [name]: type === 'checkbox' ? checked : value,
      }
    }));
  };
  
  const handleConfigWarningContinue = () => {
    // Usuario decidió continuar sin configurar
    if (pendingDeliveryMode) {
      setFormData(prev => ({
        ...prev,
        delivery_mode: pendingDeliveryMode
      }));
      setPendingDeliveryMode(null);
    }
  };

  const addContentItem = () => {
    setFormData(prev => ({
      ...prev,
      content: [...prev.content, { icon: '📦', text: '' }]
    }));
  };

  const removeContentItem = (index) => {
    setFormData(prev => ({
      ...prev,
      content: prev.content.filter((_, i) => i !== index)
    }));
  };

  const updateContentItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      content: prev.content.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const resetProductImageInput = () => {
    const el = document.getElementById('image');
    if (el) el.value = '';
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showAlert('La imagen no puede superar 5MB', 'error');
      resetProductImageInput();
      return;
    }
    if (!file.type.startsWith('image/')) {
      showAlert('Solo se permiten imágenes', 'error');
      resetProductImageInput();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProductImageCropKey((k) => k + 1);
      setTempProductImage(reader.result);
      setShowProductImageCrop(true);
    };
    reader.readAsDataURL(file);
  };

  const handleProductImageCropSave = async (croppedImage) => {
    setImagePreview(croppedImage);
    const blob = await fetch(croppedImage).then((r) => r.blob());
    setImageFile(new File([blob], 'product-image.png', { type: 'image/png' }));
    setShowProductImageCrop(false);
    setTempProductImage(null);
  };

  const handleProductImageCropCancel = () => {
    setShowProductImageCrop(false);
    setTempProductImage(null);
    resetProductImageInput();
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name || formData.name.trim().length < 3) {
      newErrors.name = 'El nombre debe tener al menos 3 caracteres';
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      newErrors.price = 'El precio debe ser mayor a 0';
    }

    if (!formData.category) {
      newErrors.category = 'Selecciona una categoría';
    }

    if (formData.purchase_type === 'SUBSCRIPTION' && !formData.subscription_interval) {
      newErrors.subscription_interval = 'Selecciona un intervalo para la suscripción';
    }

    // Validar comandos ON_PURCHASE solo si no es entrega manual
    if (formData.status === 'ACTIVE' && formData.delivery_mode !== 'MANUAL' && commands.ON_PURCHASE.length === 0) {
      newErrors.commands = 'Debes agregar al menos un comando ON_PURCHASE para publicar';
    }

    setErrors(newErrors);
    const valid = Object.keys(newErrors).length === 0;
    return { valid, fieldErrors: newErrors };
  };

  const handleSubmit = async (publishNow = false) => {
    if (publishNow) {
      formData.status = 'ACTIVE';
    }

    const { valid, fieldErrors } = validateForm();
    if (!valid) {
      if (fieldErrors.commands) {
        showAlert(fieldErrors.commands, 'error', { title: 'Comandos obligatorios' });
      } else {
        showAlert('Por favor corrige los errores en el formulario', 'error');
      }
      return;
    }

    setSubmitting(true);

    try {
      const submitData = new FormData();
      
      // Agregar campos básicos (show_gallery aparte: multipart + boolean fiable)
      Object.keys(formData).forEach(key => {
        if (key === 'show_gallery') return;
        if (key === 'content' || key === 'delivery_config') {
          submitData.append(key, JSON.stringify(formData[key]));
          return;
        }
        const v = formData[key];
        if (v !== '' && v !== null && v !== undefined) {
          submitData.append(key, v);
        }
      });
      submitData.append('show_gallery', formData.show_gallery ? 'true' : 'false');

      // Agregar imagen si existe
      if (imageFile) {
        submitData.append('image_file', imageFile);
      }

      // Agregar tienda
      submitData.append('store', activeStore.id);

      // Crear producto
      const productResponse = await api.post(
        `/stores/${activeStore.id}/products/`,
        submitData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      const productId = productResponse.data.id;

      if (formData.show_gallery && stagedGalleryImages.length > 0) {
        for (let i = 0; i < stagedGalleryImages.length; i++) {
          const galleryForm = new FormData();
          galleryForm.append('image_file', stagedGalleryImages[i].file);
          galleryForm.append('order', String(i));
          await api.post(`/products/${productId}/gallery/`, galleryForm, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }

      // Agregar comandos
      for (const [event, commandList] of Object.entries(commands)) {
        for (let i = 0; i < commandList.length; i++) {
          const entry = commandList[i];
          const isObj = typeof entry === 'object';
          await api.post(`/products/${productId}/commands/`, {
            command:       isObj ? entry.cmd : entry,
            event:         event,
            order:         i,
            exec_type:     isObj ? (entry.exec_type ?? 'player') : 'player',
            delay_seconds: isObj ? (entry.delay_seconds ?? 0) : 0,
          });
        }
      }

      showAlert(
        publishNow ? 'Producto publicado exitosamente' : 'Producto guardado como borrador',
        'success'
      );

      setTimeout(() => {
        navigate(`/dashboard/${activeStore.slug}/products`);
      }, 1500);

    } catch (error) {
      console.error('Error creating product:', error);
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      }
      showAlert('Error al crear el producto', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Cargando formulario" />;
  }

  if (!activeStore) {
    return (
      <div className="product-form-empty">
        <h2>Espera un momento...</h2>
        <p>Para crear productos, primero Espera un momento...</p>
      </div>
    );
  }

  return (
    <div className="product-form-page">
      {pageAlert && (
        <div className="dashboard-floating-alerts" role="status" aria-live="polite">
          <Alert
            message={pageAlert.message}
            type={pageAlert.type}
            title={pageAlert.title}
            onClose={() => setPageAlert(null)}
          />
        </div>
      )}

      {/* Header */}
      <div className="form-header">
        <button 
          className="btn-back"
          onClick={() => navigate(`/dashboard/${activeStore.slug}/products`)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Volver
        </button>
        <h1 className="form-title">Nuevo Producto</h1>
      </div>

      {/* Layout de 2 columnas */}
      <div className="form-layout">
        {/* Columna izquierda - Formulario */}
        <div className="form-column">
          {/* Información básica */}
          <section className="form-section">
            <h2 className="section-title">Información básica</h2>

            <div className="form-group">
              <label htmlFor="name" className="form-label form-label-required">Nombre</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Ej: VIP Gold Rank"
                className={`input ${errors.name ? 'input-error' : ''}`}
                required
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">Descripción</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe tu producto..."
                rows="4"
                maxLength="2000"
                className="textarea"
              />
              <span className="form-hint">{formData.description.length}/2000 caracteres</span>
            </div>

            <div className="form-group">
              <label htmlFor="image" className="form-label">Imagen</label>
              <div className="image-upload">
                {imagePreview ? (
                  <div className="image-preview">
                    <img src={imagePreview} alt="Preview" />
                    <button 
                      type="button"
                      className="btn-remove-image"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        resetProductImageInput();
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <label htmlFor="image" className="image-upload-label">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" 
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span>Subir imagen</span>
                    <span className="upload-hint">PNG, JPG hasta 5MB · recorte 16:9</span>
                  </label>
                )}
                <input
                  type="file"
                  id="image"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="image-input"
                />
              </div>
              <span className="form-hint" style={{ textAlign: 'center' }}>
                Mismo formato que en las tarjetas de la tienda. Tras elegir archivo podrás encuadrar y alejar el zoom.
              </span>
            </div>

          </section>

          {/* Contenido del producto */}
          <section className="form-section">
            <div className="section-header-with-action">
              <h2 className="section-title">Contenido del producto</h2>
              <button 
                type="button" 
                className="btn-add-content"
                onClick={addContentItem}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Agregar item
              </button>
            </div>
            <p className="section-description">
              Lista de items, beneficios o recursos que incluye este producto. Se mostrará en la página de detalles.
            </p>

            <div className="product-content-list">
              {formData.content.length === 0 ? (
                <div className="content-empty-state">
                  <p>No hay items agregados. Haz click en "Agregar item" para empezar.</p>
                </div>
              ) : (
                formData.content.map((item, index) => (
                  <div key={index} className="content-item-row">
                    <div className="content-item-icon">
                      <input
                        type="text"
                        value={item.icon}
                        onChange={(e) => updateContentItem(index, 'icon', e.target.value)}
                        placeholder="Icono"
                        className="input input-icon"
                        title="Usa un emoji o icono"
                      />
                    </div>
                    <div className="content-item-text">
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => updateContentItem(index, 'text', e.target.value)}
                        placeholder="Ej: Espada de Obsidiana: (Filo V, Aspecto Ígneo II)"
                        className="input"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-remove-content"
                      onClick={() => removeContentItem(index)}
                      title="Eliminar item"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <ProductGalleryManager
            showGallery={formData.show_gallery}
            onShowGalleryChange={(value) => {
              setFormData((prev) => ({ ...prev, show_gallery: value }));
              if (!value) setStagedGalleryImages([]);
            }}
            stagedGallery={stagedGalleryImages}
            onStagedGalleryChange={setStagedGalleryImages}
            onPageAlert={showAlert}
          />

          {/* Precio y tipo */}
          <section className="form-section">
            <h2 className="section-title">Precio y tipo</h2>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="price" className="form-label form-label-required">Precio</label>
                <div className="input-with-addon input-with-addon--currency">
                  <span className="input-addon">$</span>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={`input input-with-addon-input ${errors.price ? 'input-error' : ''}`}
                    required
                  />
                  <span className="input-addon-right">USD</span>
                </div>
                {errors.price && <span className="form-error">{errors.price}</span>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de compra</label>
              <div className="segmented-control segmented-control-2" role="radiogroup" aria-label="Tipo de compra">
                <label className="segmented-option">
                  <input
                    type="radio"
                    name="purchase_type"
                    value="ONE_TIME"
                    checked={formData.purchase_type === 'ONE_TIME'}
                    onChange={handleInputChange}
                  />
                  <span className="segmented-cell">Único</span>
                </label>
                <label className="segmented-option">
                  <input
                    type="radio"
                    name="purchase_type"
                    value="SUBSCRIPTION"
                    checked={formData.purchase_type === 'SUBSCRIPTION'}
                    onChange={handleInputChange}
                  />
                  <span className="segmented-cell">Suscripción</span>
                </label>
              </div>
            </div>

            {formData.purchase_type === 'SUBSCRIPTION' && (
              <div className="form-group">
                <label htmlFor="subscription_interval" className="form-label form-label-required">
                  Intervalo de renovación
                </label>
                <select
                  id="subscription_interval"
                  name="subscription_interval"
                  value={formData.subscription_interval}
                  onChange={handleInputChange}
                  className={`input ${errors.subscription_interval ? 'input-error' : ''}`}
                >
                  <option value="">Seleccionar...</option>
                  <option value="MONTHLY">Mensual</option>
                  <option value="QUARTERLY">Trimestral</option>
                  <option value="YEARLY">Anual</option>
                </select>
                {errors.subscription_interval && (
                  <span className="form-error">{errors.subscription_interval}</span>
                )}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="category" className="form-label form-label-required">Categoría</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className={`input ${errors.category ? 'input-error' : ''}`}
                required
              >
                <option value="">Seleccionar categoría...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} {cat.is_default ? '(Base)' : ''}
                  </option>
                ))}
              </select>
              {errors.category && <span className="form-error">{errors.category}</span>}
            </div>
          </section>

          {/* Límites */}
          <section className="form-section">
            <h2 className="section-title">Límites</h2>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="global_limit" className="form-label">Límite global</label>
                <input
                  type="number"
                  id="global_limit"
                  name="global_limit"
                  value={formData.global_limit}
                  onChange={handleInputChange}
                  placeholder="Ilimitado"
                  min="1"
                  className="input"
                />
                <span className="form-hint">Total de unidades disponibles</span>
              </div>

              <div className="form-group">
                <label htmlFor="per_player_limit" className="form-label">Límite por jugador</label>
                <input
                  type="number"
                  id="per_player_limit"
                  name="per_player_limit"
                  value={formData.per_player_limit}
                  onChange={handleInputChange}
                  placeholder="Ilimitado"
                  min="1"
                  className="input"
                />
                <span className="form-hint">Compras máximas por jugador</span>
              </div>
            </div>
          </section>

          {/* Configuración de entrega */}
          <section className="form-section">
            <h2 className="section-title">Entrega</h2>

            {/* Paso 1: Manual vs Automático */}
            <div className="form-group">
              <label className="form-label">¿Cómo se entrega este producto?</label>
              <div className="segmented-control segmented-control-2" role="radiogroup">
                <label className="segmented-option">
                  <input type="radio" name="delivery_mode" value="MANUAL"
                    checked={formData.delivery_mode === 'MANUAL'} onChange={handleInputChange} />
                  <span className="segmented-cell">Manual</span>
                </label>
                <label className="segmented-option">
                  <input type="radio" name="delivery_mode" value="__AUTO__"
                    checked={formData.delivery_mode === 'RCON' || formData.delivery_mode === 'PLUGIN'}
                    onChange={() => {
                      // Si ya tiene uno elegido, no resetear
                      if (formData.delivery_mode !== 'RCON' && formData.delivery_mode !== 'PLUGIN') {
                        setFormData(prev => ({ ...prev, delivery_mode: '__CHOOSE__' }));
                      }
                    }} />
                  <span className="segmented-cell">Automático</span>
                </label>
              </div>
              {formData.delivery_mode === 'MANUAL' && (
                <span className="form-hint">Deberás entregar el producto manualmente a cada comprador.</span>
              )}
            </div>

            {/* Paso 2: Elegir tipo si es automático */}
            {(formData.delivery_mode === '__CHOOSE__' || formData.delivery_mode === 'RCON' || formData.delivery_mode === 'PLUGIN') && (
              <div className="form-group">
                <label className="form-label">Tipo de servidor</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    {
                      mode: 'RCON',
                      logo: javaLogo,
                      title: 'Java / Crossplay',
                      subtitle: 'Entrega via RCON',
                      configured: storeConfig.rcon?.configured,
                      warningType: 'rcon',
                    },
                    {
                      mode: 'PLUGIN',
                      logo: bedrockLogo,
                      title: 'Bedrock',
                      subtitle: 'Entrega via PlugsEssentials',
                      configured: storeConfig.bedrock?.configured,
                      warningType: 'bedrock',
                      disabled: true, // Bedrock deshabilitado
                    },
                  ].map(({ mode, logo, title, subtitle, configured, warningType, disabled }) => {
                    const isSelected = formData.delivery_mode === mode;
                    return (
                      <button key={mode} type="button"
                        onClick={() => {
                          if (disabled) {
                            toast.error('Función no disponible en el plan actual');
                            return;
                          }
                          if (!storeConfig.loading && !configured) {
                            setPendingDeliveryMode(mode);
                            setConfigWarningType(warningType);
                            setShowConfigWarning(true);
                          } else {
                            setFormData(prev => ({ ...prev, delivery_mode: mode }));
                          }
                        }}
                        style={{
                          background: isSelected ? 'rgba(124,58,237,0.12)' : 'var(--bg-card)',
                          border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                          borderRadius: '12px', padding: '1rem 1.25rem',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          display: 'flex', flexDirection: 'column', gap: '6px',
                          opacity: disabled ? 0.5 : 1,
                        }}>
                        <img src={logo} alt={title} style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{subtitle}</div>
                        {disabled ? (
                          <span style={{ fontSize: '0.75rem', color: '#F59E0B' }}> No disponible en el modulo actual</span>
                        ) : !storeConfig.loading && (
                          configured
                            ? <span style={{ fontSize: '0.75rem', color: '#10B981' }}>✓ Configurado</span>
                            : <span style={{ fontSize: '0.75rem', color: '#F59E0B' }}>⚠ No configurado</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Opciones avanzadas Bedrock — solo si PLUGIN */}
          {formData.delivery_mode === 'PLUGIN' && (
            <section className="form-section">
              <h2 className="section-title">Opciones de entrega Bedrock</h2>

              <div className="form-group">
                <label htmlFor="required_slots" className="form-label">Slots de inventario requeridos</label>
                <div className="input-with-addon input-with-addon--suffix-only">
                  <input
                    type="number"
                    id="required_slots"
                    name="required_slots"
                    value={formData.delivery_config.required_slots ?? 0}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      delivery_config: { ...prev.delivery_config, required_slots: parseInt(e.target.value) || 0 }
                    }))}
                    min="0" max="36"
                    className="input input-with-addon-input"
                  />
                  <span className="input-addon-right">slots</span>
                </div>
                <span className="form-hint">Slots libres que el jugador necesita para recibir este producto (0 = sin requisito)</span>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input type="checkbox" name="retry_if_offline"
                    checked={formData.delivery_config.retry_if_offline}
                    onChange={handleDeliveryConfigChange} />
                  <span>Reintentar si el jugador está offline</span>
                </label>
                <span className="form-hint">El sistema reintentará cada 10s hasta que el jugador entre</span>
              </div>

              {formData.delivery_config.retry_if_offline && (
                <div className="form-group">
                  <label className="form-label">Tiempo máximo de espera</label>
                  <div className="input-with-addon input-with-addon--suffix-only">
                    <input type="number" name="max_retry_hours"
                      value={formData.delivery_config.max_retry_hours}
                      onChange={handleDeliveryConfigChange}
                      min="1" max="72" className="input input-with-addon-input" />
                    <span className="input-addon-right">horas</span>
                  </div>
                  <span className="form-hint">Si el jugador no entra en este tiempo, la orden se marca como fallida</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Mensaje de éxito (notificación web)</label>
                <input type="text" name="success_message"
                  value={formData.delivery_config.success_message}
                  onChange={handleDeliveryConfigChange}
                  placeholder="¡Gracias por tu compra! Tu pedido ha sido entregado."
                  className="input" />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input type="checkbox" name="server_chat_enabled"
                    checked={formData.delivery_config.server_chat_enabled}
                    onChange={handleDeliveryConfigChange} />
                  <span>Enviar mensaje en el chat del servidor</span>
                </label>
              </div>

              {formData.delivery_config.server_chat_enabled && (
                <div className="form-group">
                  <input type="text" name="server_chat_message"
                    value={formData.delivery_config.server_chat_message}
                    onChange={handleDeliveryConfigChange}
                    placeholder="§a¡{player} acaba de recibir su compra!"
                    className="input" />
                  <span className="form-hint">Usa {'{player}'} para el nombre. Soporta códigos §</span>
                </div>
              )}

              <div className="form-group">
                <label className="checkbox-label">
                  <input type="checkbox" name="notify_seller_on_fail"
                    checked={formData.delivery_config.notify_seller_on_fail}
                    onChange={handleDeliveryConfigChange} />
                  <span>Notificarme si la entrega falla</span>
                </label>
              </div>
            </section>
          )}

          {/* Comandos — solo si entrega automática */}
          {(formData.delivery_mode === 'RCON' || formData.delivery_mode === 'PLUGIN') && (
            <section className="form-section">
              <CommandEditor
                commands={commands}
                setCommands={setCommands}
                commandErrors={commandErrors}
                setCommandErrors={setCommandErrors}
                allowedVariables={ALLOWED_VARIABLES}
                deliveryMode={formData.delivery_mode}
              />
            </section>
          )}

          {/* Footer con acciones */}
          <div className="form-footer">
            <button
              type="button"
              className="btn btn-lg btn-secondary"
              onClick={() => navigate(`/dashboard/${activeStore.slug}/products`)}
              disabled={submitting}
            >
              Cancelar
            </button>
            <div className="form-footer-actions">
              <button
                type="button"
                className="btn btn-lg btn-secondary"
                onClick={() => handleSubmit(false)}
                disabled={submitting}
              >
                {submitting ? 'Guardando...' : 'Guardar borrador'}
              </button>
              <button
                type="button"
                className="btn btn-lg btn-primary"
                onClick={() => handleSubmit(true)}
                disabled={submitting}
              >
                {submitting ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>

        {/* Columna derecha - Preview */}
        <div className="preview-column">
          <ProductPreview
            name={formData.name}
            description={formData.description}
            price={formData.price}
            image={imagePreview}
            category={categories.find(c => c.id === formData.category)}
            purchaseType={formData.purchase_type}
            subscriptionInterval={formData.subscription_interval}
            status={formData.status}
          />
        </div>
      </div>

      {showProductImageCrop && tempProductImage && (
        <ImageCropModal
          key={productImageCropKey}
          image={tempProductImage}
          onSave={handleProductImageCropSave}
          onCancel={handleProductImageCropCancel}
          aspectRatio={PRODUCT_CARD_ASPECT_RATIO}
          minZoom={0.15}
          exportLongSide={1280}
        />
      )}
      
      {/* Modal de advertencia de configuración */}
      <ConfigWarningModal
        isOpen={showConfigWarning}
        onClose={() => {
          setShowConfigWarning(false);
          setPendingDeliveryMode(null);
        }}
        onContinue={handleConfigWarningContinue}
        type={configWarningType}
        storeSlug={activeStore?.slug}
      />
    </div>
  );
}

export default CreateProduct;
