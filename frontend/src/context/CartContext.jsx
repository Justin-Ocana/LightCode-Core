import { createContext, useContext, useState, useEffect } from 'react';
import { cartAPI } from '../services/api';
import { BuyerContext } from './BuyerContext';
import { useStoreSlug } from '../hooks/useStoreSlug';
import toast from 'react-hot-toast';

const CartContext = createContext(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const storeSlug = useStoreSlug(); // Usar hook que funciona en white-label
  
  // ALWAYS call useBuyer in the same order
  const buyerContext = useContext(BuyerContext);
  const buyer = buyerContext?.buyer;

  const [cart, setCart] = useState(() => {
    // Intentar cargar el carrito desde localStorage como caché inicial
    const cached = localStorage.getItem(`app_cart_${storeSlug || 'default'}`);
    return cached ? JSON.parse(cached) : { items: [], total_items: 0, total_price: "0.00" };
  });
  const [loading, setLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState(null); // Para disparar animaciones

  // Guardar en caché cada vez que cambie el carrito
  useEffect(() => {
    if (cart && storeSlug) {
      localStorage.setItem(`app_cart_${storeSlug}`, JSON.stringify(cart));
    }
  }, [cart, storeSlug]);

  // Cargar el carrito cuando el comprador inicia sesión o cuando cambia la tienda
  useEffect(() => {
    if (storeSlug) {
      loadCart();
    } else {
      setLoading(false);
    }
  }, [buyer, storeSlug]);

  const loadCart = async () => {
    try {
      // Si ya tenemos caché, no ponemos loading=true para evitar saltos visuales
      if (!cart || cart.items.length === 0) setLoading(true);
      
      const response = await cartAPI.get(storeSlug);
      setCart(response.data);
    } catch (error) {
      // Si es 401 (no autenticado), usar carrito local - esto es normal para usuarios anónimos
      if (error.response?.status === 401) {
        // Carrito anónimo desde localStorage
        const localCart = localStorage.getItem(`app_cart_${storeSlug}`);
        if (localCart) {
          setCart(JSON.parse(localCart));
        } else {
          setCart({ items: [], total_items: 0, total_price: "0.00" });
        }
        // No mostrar error en consola para 401 - es comportamiento esperado
      } else {
        console.error('Error loading cart:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (productId, quantity = 1, productData = null) => {
    try {
      // Guardar el último item añadido para efectos visuales (fly-to-cart)
      setLastAddedItem({ productId, timestamp: Date.now() });
      
      const response = await cartAPI.addItem(productId, quantity, storeSlug);
      
      // Si el usuario está autenticado, el backend devuelve el carrito completo
      if (response.data.items) {
        setCart(response.data);
      } else if (response.data.product) {
        // Usuario anónimo: el backend devuelve los datos del producto
        // Actualizar carrito local
        const localCart = cart || { items: [], total_items: 0, total_price: "0.00" };
        const newItems = [...localCart.items];
        const existingIndex = newItems.findIndex(item => {
          const itemProductId = item.product?.id || item.product_id;
          return itemProductId === productId;
        });
        
        if (existingIndex > -1) {
          newItems[existingIndex].quantity += quantity;
        } else {
          newItems.push({
            product_id: response.data.product.id,
            product_name: response.data.product.name,
            price: response.data.product.price,
            image: response.data.product.image,
            quantity: quantity,
            product: productData || {
              id: response.data.product.id,
              name: response.data.product.name,
              price: parseFloat(response.data.product.price),
              image: response.data.product.image
            }
          });
        }
        
        const totalItems = newItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = newItems.reduce((sum, item) => {
          const price = parseFloat(item.price || item.product?.price || 0);
          return sum + (price * item.quantity);
        }, 0).toFixed(2);
        
        const updatedCart = {
          items: newItems,
          total_items: totalItems,
          total_price: totalPrice
        };
        
        setCart(updatedCart);
        
        if (storeSlug) {
          localStorage.setItem(`app_cart_${storeSlug}`, JSON.stringify(updatedCart));
        }
      }
      
      toast.success('Producto añadido al carrito');
      return true;
    } catch (error) {
      console.error('Error adding item to cart:', error);
      
      // Mostrar mensaje de error más específico
      const errorMessage = error.response?.data?.error || 'No se pudo añadir el producto al carrito.';
      toast.error(errorMessage);
      
      // Log adicional para depuración
      if (error.response?.status === 400) {
        console.error('Error 400 details:', {
          data: error.response.data,
          headers: error.config?.headers,
          url: error.config?.url,
          storeSlug: storeSlug
        });
      }
      
      return false;
    }
  };

  const updateItem = async (productId, quantity) => {
    try {
      const response = await cartAPI.updateItem(productId, quantity, storeSlug);
      
      // Si el usuario está autenticado, el backend devuelve el carrito completo
      if (response.data.items) {
        setCart(response.data);
      } else {
        // Usuario anónimo: actualizar carrito local
        const localCart = cart || { items: [], total_items: 0, total_price: "0.00" };
        const newItems = localCart.items.map(item => {
          const itemProductId = item.product?.id || item.product_id;
          if (itemProductId === productId) {
            return { ...item, quantity };
          }
          return item;
        }).filter(item => item.quantity > 0);
        
        const totalItems = newItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = newItems.reduce((sum, item) => {
          const price = parseFloat(item.price || item.product?.price || 0);
          return sum + (price * item.quantity);
        }, 0).toFixed(2);
        
        const updatedCart = {
          items: newItems,
          total_items: totalItems,
          total_price: totalPrice
        };
        
        setCart(updatedCart);
        
        if (storeSlug) {
          localStorage.setItem(`app_cart_${storeSlug}`, JSON.stringify(updatedCart));
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error updating cart item:', error);
      toast.error('No se pudo actualizar la cantidad.');
      return false;
    }
  };

  const removeItem = async (productId) => {
    try {
      const response = await cartAPI.removeItem(productId, storeSlug);
      
      // Si el usuario está autenticado, el backend devuelve el carrito completo
      if (response.data.items) {
        setCart(response.data);
      } else {
        // Usuario anónimo: actualizar carrito local
        const localCart = cart || { items: [], total_items: 0, total_price: "0.00" };
        const newItems = localCart.items.filter(item => {
          const itemProductId = item.product?.id || item.product_id;
          return itemProductId !== productId;
        });
        
        const totalItems = newItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = newItems.reduce((sum, item) => {
          const price = parseFloat(item.price || item.product?.price || 0);
          return sum + (price * item.quantity);
        }, 0).toFixed(2);
        
        const updatedCart = {
          items: newItems,
          total_items: totalItems,
          total_price: totalPrice
        };
        
        setCart(updatedCart);
        
        if (storeSlug) {
          localStorage.setItem(`app_cart_${storeSlug}`, JSON.stringify(updatedCart));
        }
      }
      
      toast.success('Producto eliminado del carrito');
      return true;
    } catch (error) {
      console.error('Error removing cart item:', error);
      toast.error('No se pudo eliminar el producto.');
      return false;
    }
  };

  const clearCart = async (silent = false) => {
    try {
      const response = await cartAPI.clear(storeSlug);
      
      const emptyCart = {
        items: [],
        total_items: 0,
        total_price: "0.00"
      };
      
      setCart(emptyCart);
      
      // Limpiar localStorage
      if (storeSlug) {
        localStorage.setItem(`app_cart_${storeSlug}`, JSON.stringify(emptyCart));
      }
      
      // Solo mostrar toast si no es silencioso
      if (!silent) {
        toast.success('Carrito vaciado');
      }
      return true;
    } catch (error) {
      console.error('Error clearing cart:', error);
      return false;
    }
  };

  const toggleCart = () => setIsCartOpen(!isCartOpen);
  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  const value = {
    cart,
    loading,
    isCartOpen,
    lastAddedItem,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    toggleCart,
    openCart,
    closeCart,
    refreshCart: loadCart,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
