import React, { useEffect, useState } from 'react';
import { useCart } from '../../context/CartContext';
import { getMediaUrl } from '../../services/api';

/**
 * Componente que maneja el efecto visual de un item volando hacia el carrito.
 */
export function FlyToCartEffect() {
  const { lastAddedItem, cart } = useCart();
  const [flyingItems, setFlyingItems] = useState([]);

  useEffect(() => {
    if (!lastAddedItem) return;

    // Buscar la imagen del producto en el carrito (debería estar ya por el Optimistic UI)
    const productItem = cart?.items.find(item => item.product.id === lastAddedItem.productId);
    if (!productItem) return;

    const imageUrl = getMediaUrl(productItem.product.image_url) || '/placeholder-product.png';
    
    // Intentar encontrar el botón que disparó la acción para el punto de origen
    // Usamos un selector genérico o data-attributes si los tuviéramos
    const sourceEl = document.querySelector(`[data-product-id="${lastAddedItem.productId}"]`) || 
                     document.activeElement;
    
    const targetEl = document.querySelector('.store-navbar__cart');
    
    if (!sourceEl || !targetEl) return;

    const sourceRect = sourceEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    const newItem = {
      id: lastAddedItem.timestamp,
      url: imageUrl,
      start: {
        x: sourceRect.left + sourceRect.width / 2 - 30,
        y: sourceRect.top + sourceRect.height / 2 - 30
      },
      end: {
        x: targetRect.left + targetRect.width / 2 - 10,
        y: targetRect.top + targetRect.height / 2 - 10
      }
    };

    setFlyingItems(prev => [...prev, newItem]);

    // Limpiar el item después de la animación
    setTimeout(() => {
      setFlyingItems(prev => prev.filter(item => item.id !== newItem.id));
    }, 850);

  }, [lastAddedItem]);

  return (
    <>
      {flyingItems.map(item => (
        <img
          key={item.id}
          src={item.url}
          className="fly-item"
          style={{
            left: item.start.x,
            top: item.start.y,
            animation: 'flyToCart 0.8s ease-in-out forwards',
            '--target-x': `${item.end.x - item.start.x}px`,
            '--target-y': `${item.end.y - item.start.y}px`,
            transform: `translate(var(--target-x), var(--target-y)) scale(0.2)`,
            opacity: 0
          }}
          alt="Flying product"
        />
      ))}
      <style>{`
        @keyframes flyToCart {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--target-x), var(--target-y)) scale(0.2);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}
