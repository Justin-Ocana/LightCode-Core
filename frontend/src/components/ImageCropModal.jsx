import { useState, useRef, useEffect, useCallback } from 'react';
import Button from './Button';
import '../styles/image-crop-modal.css';

export default function ImageCropModal({
  image,
  onSave,
  onCancel,
  aspectRatio = 1,
  /** Zoom mínimo (valores bajos = más “alejado”, se ve más imagen alrededor del recorte) */
  minZoom = 0.2,
  maxZoom = 3,
  /** Lado largo del PNG exportado (px) */
  exportLongSide = 1200,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.55);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    const container = containerRef.current;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Clear canvas
    ctx.fillStyle = '#09090F';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate scaled dimensions
    const scale = Math.max(
      containerWidth / img.width,
      containerHeight / img.height
    ) * zoom;

    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;

    // Center the image
    const x = (containerWidth - scaledWidth) / 2 + crop.x;
    const y = (containerHeight - scaledHeight) / 2 + crop.y;

    // Draw image
    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

    // Draw crop overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    
    // Calculate crop dimensions based on aspect ratio
    let cropWidth, cropHeight;
    if (aspectRatio >= 1) {
      // Landscape or square
      cropWidth = Math.min(containerWidth, containerHeight * aspectRatio) * 0.7;
      cropHeight = cropWidth / aspectRatio;
    } else {
      // Portrait
      cropHeight = Math.min(containerHeight, containerWidth / aspectRatio) * 0.7;
      cropWidth = cropHeight * aspectRatio;
    }
    
    const cropX = (containerWidth - cropWidth) / 2;
    const cropY = (containerHeight - cropHeight) / 2;

    // Top
    ctx.fillRect(0, 0, containerWidth, cropY);
    // Bottom
    ctx.fillRect(0, cropY + cropHeight, containerWidth, containerHeight - cropY - cropHeight);
    // Left
    ctx.fillRect(0, cropY, cropX, cropHeight);
    // Right
    ctx.fillRect(cropX + cropWidth, cropY, containerWidth - cropX - cropWidth, cropHeight);

    // Draw crop border
    ctx.strokeStyle = '#7C3AED';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);
  };

  useEffect(() => {
    if (image && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        drawCanvas();
      };
      img.src = image;
    }
    // drawCanvas depende de crop/zoom/aspectRatio; mantener sincronizado el canvas
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drawCanvas lee refs y estado actual
  }, [image, crop, zoom]);

  useEffect(() => {
    const preventZoom = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    document.addEventListener('wheel', preventZoom, { passive: false });

    return () => {
      document.removeEventListener('wheel', preventZoom);
    };
  }, []);

  const handleMouseDown = (e) => {
    setDragging(true);
    setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    setCrop({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setDragging(true);
    setDragStart({ x: touch.clientX - crop.x, y: touch.clientY - crop.y });
  };

  const handleTouchMove = (e) => {
    if (!dragging) return;
    const touch = e.touches[0];
    setCrop({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  };

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY * -0.001;
    setZoom(prev => Math.min(Math.max(prev + delta, minZoom), maxZoom));
  }, [minZoom, maxZoom]);

  // Agregar el event listener de forma no pasiva para evitar el error de preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel]);

  const getCroppedImage = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return null;

    const container = containerRef.current;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    // Calculate crop dimensions based on aspect ratio
    let cropWidth, cropHeight;
    if (aspectRatio >= 1) {
      cropWidth = Math.min(containerWidth, containerHeight * aspectRatio) * 0.7;
      cropHeight = cropWidth / aspectRatio;
    } else {
      cropHeight = Math.min(containerHeight, containerWidth / aspectRatio) * 0.7;
      cropWidth = cropHeight * aspectRatio;
    }
    
    const cropX = (containerWidth - cropWidth) / 2;
    const cropY = (containerHeight - cropHeight) / 2;

    // Create a new canvas for the cropped image (alta resolución para cards / retina)
    const croppedCanvas = document.createElement('canvas');
    let outputWidth;
    let outputHeight;
    if (aspectRatio >= 1) {
      outputWidth = exportLongSide;
      outputHeight = Math.round(exportLongSide / aspectRatio);
    } else {
      outputHeight = exportLongSide;
      outputWidth = Math.round(exportLongSide * aspectRatio);
    }
    croppedCanvas.width = outputWidth;
    croppedCanvas.height = outputHeight;
    const ctx = croppedCanvas.getContext('2d');

    // Calculate source coordinates
    const scale = Math.max(
      containerWidth / img.width,
      containerHeight / img.height
    ) * zoom;

    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;

    const imgX = (containerWidth - scaledWidth) / 2 + crop.x;
    const imgY = (containerHeight - scaledHeight) / 2 + crop.y;

    const sourceX = (cropX - imgX) / scale;
    const sourceY = (cropY - imgY) / scale;
    const sourceWidth = cropWidth / scale;
    const sourceHeight = cropHeight / scale;

    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      outputWidth,
      outputHeight
    );

    return croppedCanvas.toDataURL('image/png');
  };

  const handleSave = () => {
    const croppedImage = getCroppedImage();
    if (croppedImage) {
      onSave(croppedImage);
    }
  };

  return (
    <div className="image-crop-modal-overlay">
      <div className="image-crop-modal">
        <div className="modal-header">
          <h2>Ajustar imagen</h2>
          <button className="modal-close" onClick={onCancel}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div 
          ref={containerRef}
          className="crop-container"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        >
          <canvas ref={canvasRef} />
        </div>

        <div className="crop-controls">
          <div className="zoom-control">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            <input
              type="range"
              min={minZoom}
              max={maxZoom}
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </div>
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
