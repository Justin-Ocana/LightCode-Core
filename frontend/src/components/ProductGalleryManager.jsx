import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import ConfirmModal from './ConfirmModal';

function newStagedId() {
  return globalThis.crypto?.randomUUID?.() ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ProductGalleryManager({
  productId,
  showGallery,
  onShowGalleryChange,
  stagedGallery = [],
  onStagedGalleryChange,
  onPageAlert,
}) {
  const isPersisted = Boolean(productId);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadGalleryImages = useCallback(async () => {
    if (!isPersisted || !showGallery) {
      setImages([]);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get(`/products/${productId}/gallery/`);
      setImages(response.data || []);
    } catch (error) {
      console.error('Error loading gallery:', error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [productId, showGallery, isPersisted]);

  useEffect(() => {
    if (isPersisted && showGallery) {
      loadGalleryImages();
    } else if (isPersisted) {
      setImages([]);
    }
  }, [showGallery, productId, isPersisted, loadGalleryImages]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onPageAlert?.('La imagen no puede superar 5MB', 'error');
      return;
    }

    if (!file.type.startsWith('image/')) {
      onPageAlert?.('Solo se permiten imágenes', 'error');
      return;
    }

    if (!isPersisted) {
      if (!onStagedGalleryChange) return;
      const id = newStagedId();
      const reader = new FileReader();
      reader.onloadend = () => {
        onStagedGalleryChange((prev) => [...prev, { id, file, preview: reader.result }]);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('image_file', file);
      formData.append('order', images.length);

      const response = await api.post(`/products/${productId}/gallery/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setImages((prev) => [...prev, response.data]);
      onPageAlert?.('Imagen añadida a la galería', 'success');
    } catch (error) {
      console.error('Error uploading image:', error);
      onPageAlert?.('Error al subir la imagen', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const closeDeleteModal = () => {
    if (!deleteBusy) setPendingDeleteId(null);
  };

  const confirmDelete = async () => {
    if (pendingDeleteId == null) return;
    const imageId = pendingDeleteId;

    if (!isPersisted) {
      onStagedGalleryChange?.((prev) => prev.filter((img) => img.id !== imageId));
      setPendingDeleteId(null);
      return;
    }

    try {
      setDeleteBusy(true);
      await api.delete(`/products/gallery/${imageId}/`);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      setPendingDeleteId(null);
      onPageAlert?.('Imagen eliminada', 'success');
    } catch (error) {
      console.error('Error deleting image:', error);
      onPageAlert?.('No se pudo eliminar la imagen', 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const reorderList = (list, fromIndex, toIndex) => {
    const next = [...list];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    return next;
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedIndex === null || draggedIndex === index) return;

    if (isPersisted) {
      setImages((prev) => reorderList(prev, draggedIndex, index));
    } else {
      onStagedGalleryChange?.((prev) => reorderList(prev, draggedIndex, index));
    }
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    if (isPersisted && images.length > 0) {
      try {
        await Promise.all(
          images.map((img, idx) => api.patch(`/products/gallery/${img.id}/`, { order: idx }))
        );
      } catch (error) {
        console.error('Error updating order:', error);
        onPageAlert?.('No se pudo guardar el orden de la galería', 'error');
        loadGalleryImages();
      }
    }

    setDraggedIndex(null);
  };

  const listForGrid = isPersisted ? images : stagedGallery;
  const itemCount = listForGrid.length;

  return (
    <section className="form-section">
      <ConfirmModal
        isOpen={pendingDeleteId != null}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title="Eliminar imagen"
        message="Esta imagen se quitará de la galería del producto. ¿Seguro que deseas continuar?"
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />

      <h2 className="section-title">Galería de imágenes</h2>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showGallery}
            onChange={(e) => onShowGalleryChange(e.target.checked)}
          />
          <span className="checkbox-custom"></span>
          Mostrar galería de imágenes
        </label>
        <span className="form-hint">
          {isPersisted
            ? 'Permite añadir múltiples imágenes adicionales del producto'
            : 'Añade imágenes aquí; se subirán al guardar el producto'}
        </span>
      </div>

      {showGallery && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          {isPersisted && loading ? (
            <div className="gallery-loading">Cargando galería...</div>
          ) : (
            <>
              <div className="gallery-grid">
                {isPersisted
                  ? images.map((image, index) => (
                      <div
                        key={image.id}
                        className="gallery-item"
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                      >
                        <img src={image.image_url} alt={`Galería ${index + 1}`} />
                        <button
                          type="button"
                          className="gallery-item-delete"
                          onClick={() => setPendingDeleteId(image.id)}
                          title="Eliminar imagen"
                        >
                          ×
                        </button>
                        <div className="gallery-item-drag">⋮⋮</div>
                      </div>
                    ))
                  : stagedGallery.map((image, index) => (
                      <div
                        key={image.id}
                        className="gallery-item"
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                      >
                        <img src={image.preview} alt={`Galería ${index + 1}`} />
                        <button
                          type="button"
                          className="gallery-item-delete"
                          onClick={() => setPendingDeleteId(image.id)}
                          title="Eliminar imagen"
                        >
                          ×
                        </button>
                        <div className="gallery-item-drag">⋮⋮</div>
                      </div>
                    ))}

                <label className="gallery-upload">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    disabled={uploading}
                  />
                  <div className="gallery-upload-content">
                    {uploading ? (
                      <span>Subiendo...</span>
                    ) : (
                      <>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <span>Añadir imagen</span>
                      </>
                    )}
                  </div>
                </label>
              </div>

              {itemCount > 0 && (
                <p className="form-hint" style={{ marginTop: 'var(--space-3)' }}>
                  Arrastra las imágenes para reordenarlas
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
