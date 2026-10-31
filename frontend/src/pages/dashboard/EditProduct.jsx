/**
 * EditProduct Page - Edición de producto existente
 * Incluye gestión de galería de imágenes
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import '../../styles/product-form.css';
import '../../styles/product-content.css';

const PRODUCT_CARD_ASPECT_RATIO = 16 / 9;

const ALLOWED_VARIABLES = [
  '{username}',
  '{uuid}',
  '{price}',
  '{product_name}',
  '{transaction_id}',
  '{store_slug}'
];

function EditProduct() {
  const navigate = useNavigate();
  const { productId } = useParams();
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
    delivery_mode: 'RCON',
    status: 'DRAFT',
    sort_order: 0,
    show_gallery: false,
    content: []
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

  useEffect(() => {
    if (activeStore && productId) {
      fetchData();
    } else if (!activeStore) {
      setLoading(false);
    }
  }, [activeStore, productId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productRes, categoriesRes, commandsRes] = await Promise.all([
        api.get(`/products/${productId}/`),
        api.get(`/stores/${activeStore.id}/categories/`),
        api.get(`/products/${productId}/commands/`)
      ]);

      const product = productRes.data;
      
      // Cargar datos del producto
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price,
        category: product.category,
        purchase_type: product.purchase_type,
        subscription_interval: product.subscription_interval || '',
        global_limit: product.global_limit || '',
        per_player_limit: product.per_player_limit || '',
        require_online: product.require_online,
        command_delay: product.command_delay,
        delivery_mode: product.delivery_mode,
        status: product.status,
        sort_order: product.sort_order,
        show_gallery: product.show_gallery || false,
        content: Array.isArray(product.content) ? product.content : []
      });

      // Cargar imagen si existe
      if (product.image_url) {
        setImagePreview(product.image_url);
      }

      // Cargar categorías
      setCategories(categoriesRes.data);

      // Organizar comandos por evento
      const commandsByEvent = {
        ON_PURCHASE: [],
        ON_EXPIRY: [],
        ON_REFUND: [],
        ON_CHARGEBACK: [],
        ON_RENEWAL: []
      };

      commandsRes.data.forEach(cmd => {
        if (commandsByEvent[cmd.event]) {
          commandsByEvent[cmd.event].push({
            cmd:           cmd.command,
            exec_type:     cmd.exec_type     ?? 'player',
            delay_seconds: cmd.delay_seconds ?? 0,
          });
        }
      });

      setCommands(commandsByEvent);

    } catch (error) {
      console.error('Error fetching data:', error);
      showAlert('Error al cargar el producto', 'error');
      navigate(`/dashboard/${activeStore.slug}/products`);
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
    
    // Bloquear selección de PLUGIN (Bedrock)
    if (name === 'delivery_mode' && value === 'PLUGIN') {
      toast.error('Función no disponible en el plan actual');
      return;
    }
    
    // Si cambia delivery_mode a RCON y no está configurado, mostrar advertencia
    if (name === 'delivery_mode' && value === 'RCON') {
      if (!storeConfig.loading && !storeConfig.rcon.configured) {
        setPendingDeliveryMode(value);
        setConfigWarningType('rcon');
        setShowConfigWarning(true);
        return; // No cambiar aún
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
        if (key === 'content') {
          submitData.append(key, JSON.stringify(formData[key]));
          return;
        }
        const v = formData[key];
        if (v !== '' && v !== null && v !== undefined) {
          submitData.append(key, v);
        }
      });
      submitData.append('show_gallery', formData.show_gallery ? 'true' : 'false');

      // Agregar imagen si hay una nueva
      if (imageFile) {
        submitData.append('image_file', imageFile);
      }

      // Actualizar producto
      await api.patch(
        `/products/${productId}/`,
        submitData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      // Eliminar comandos existentes
      const existingCommands = await api.get(`/products/${productId}/commands/`);
      for (const cmd of existingCommands.data) {
        await api.delete(`/products/commands/${cmd.id}/`);
      }

      // Agregar nuevos comandos
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

      showAlert('Producto actualizado exitosamente', 'success');

      setTimeout(() => {
        navigate(`/dashboard/${activeStore.slug}/products`);
      }, 1500);

    } catch (error) {
      console.error('Error updating product:', error);
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      }
      showAlert('Error al actualizar el producto', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Cargando producto" />;
  }

  if (!activeStore) {
    return (
      <div className="product-form-empty">
        <h2>Espera un momento...</h2>
        <p>Para editar productos, primero Espera un momento...</p>
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
        <h1 className="form-title">Editar Producto</h1>
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
              <label htmlFor="image" className="form-label">Imagen principal</label>
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
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
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

          {/* Galería de imágenes */}
          <ProductGalleryManager
            productId={productId}
            showGallery={formData.show_gallery}
            onShowGalleryChange={(value) => {
              setFormData(prev => ({ ...prev, show_gallery: value }));
              // Actualizar en el backend inmediatamente
              api.patch(`/products/${productId}/`, { show_gallery: value })
                .catch(err => console.error('Error updating show_gallery:', err));
            }}
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
            <h2 className="section-title">Configuración de entrega</h2>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="require_online"
                  checked={formData.require_online}
                  onChange={handleInputChange}
                />
                <span className="checkbox-custom"></span>
                Requiere jugador online
              </label>
              <span className="form-hint">El jugador debe estar conectado para recibir el producto</span>
            </div>

            <div className="form-group">
              <label htmlFor="command_delay" className="form-label">Delay de comandos</label>
              <div className="input-with-addon input-with-addon--suffix-only">
                <input
                  type="number"
                  id="command_delay"
                  name="command_delay"
                  value={formData.command_delay}
                  onChange={handleInputChange}
                  min="0"
                  max="3600"
                  className="input input-with-addon-input"
                />
                <span className="input-addon-right">segundos</span>
              </div>
              <span className="form-hint">Tiempo de espera antes de ejecutar comandos (máx 1 hora)</span>
            </div>

            <div className="form-group">
              <label className="form-label">Modo de entrega</label>
              <div className="segmented-control" role="radiogroup" aria-label="Modo de entrega">
                <label className="segmented-option">
                  <input
                    type="radio"
                    name="delivery_mode"
                    value="MANUAL"
                    checked={formData.delivery_mode === 'MANUAL'}
                    onChange={handleInputChange}
                  />
                  <span className="segmented-cell">Manual</span>
                </label>
                <label className="segmented-option">
                  <input
                    type="radio"
                    name="delivery_mode"
                    value="RCON"
                    checked={formData.delivery_mode === 'RCON'}
                    onChange={handleInputChange}
                  />
                  <span className="segmented-cell">RCON</span>
                </label>
                <label className="segmented-option" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                  <input
                    type="radio"
                    name="delivery_mode"
                    value="PLUGIN"
                    checked={formData.delivery_mode === 'PLUGIN'}
                    onChange={handleInputChange}
                    disabled={formData.delivery_mode !== 'PLUGIN'}
                  />
                  <span className="segmented-cell">Plugin 🔒</span>
                </label>
              </div>
              {formData.delivery_mode === 'MANUAL' && (
                <span className="form-hint">
                  Los productos manuales requieren que entregues el contenido manualmente a tus clientes
                </span>
              )}
              {formData.delivery_mode === 'RCON' && !storeConfig.loading && !storeConfig.rcon.configured && (
                <span className="form-hint form-hint-warning">
                  RCON no está configurado. Los comandos no se ejecutarán automáticamente.
                </span>
              )}
            </div>
          </section>

          {/* Comandos — solo para RCON y Plugin */}
          {formData.delivery_mode !== 'MANUAL' && (
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
                {submitting ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                className="btn btn-lg btn-primary"
                onClick={() => handleSubmit(true)}
                disabled={submitting}
              >
                {submitting ? 'Publicando...' : formData.status === 'ACTIVE' ? 'Guardar y publicar' : 'Publicar'}
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

export default EditProduct;
