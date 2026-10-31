import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MessageCircle, Send } from 'lucide-react';
import { StoreBrandLoader } from '../../components/store/StoreBrandLoader';
import { formatStoreSlugLabel } from '../../utils/storeSlugLabel';
import { storesAPI, getMediaUrl } from '../../services/api';
import '../../styles/store/index.css';

export function StoreSupport() {
  const { storeSlug } = useParams();
  const [store, setStore] = useState(null);
  const [storeReady, setStoreReady] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    setStore(null);
    setStoreReady(false);
    loadStore();
  }, [storeSlug]);

  async function loadStore() {
    try {
      const response = await storesAPI.getBySlug(storeSlug);
      setStore(response.data);
      setTimeout(() => setStoreReady(true), 100);
    } catch (error) {
      console.error('Error loading store:', error);
    }
  }

  function handleSendMessage(e) {
    e.preventDefault();
    if (!message.trim()) return;

    // TODO: Implementar envío de mensaje
    setMessages([...messages, {
      id: Date.now(),
      text: message,
      sender: 'user',
      timestamp: new Date()
    }]);
    setMessage('');
  }

  if (!store) {
    return (
      <StoreBrandLoader
        overlay
        storeName={formatStoreSlugLabel(storeSlug)}
        message="Buscando tu tienda"
      />
    );
  }

  if (!storeReady) {
    return (
      <StoreBrandLoader
        overlay
        storeName={store.name}
        logoUrl={getMediaUrl(store.logo_url)}
        message="Abriendo tienda"
      />
    );
  }

  return (
    <div className="store-page">
        <div className="store-container">
          <div className="store-support">
            <h1>Soporte</h1>

            <div className="store-support__content">
              <div className="store-support__chat">
                <div className="store-support__messages">
                  {messages.length === 0 ? (
                    <div className="store-support__empty">
                      <MessageCircle size={48} />
                      <p>Inicia una conversación con el vendedor</p>
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div 
                        key={msg.id}
                        className={`store-support__message store-support__message--${msg.sender}`}
                      >
                        <div className="store-support__message-content">
                          {msg.text}
                        </div>
                        <div className="store-support__message-time">
                          {msg.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form className="store-support__input" onSubmit={handleSendMessage}>
                  <input 
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escribe tu mensaje..."
                  />
                  <button type="submit" className="store-btn">
                    <Send size={20} />
                  </button>
                </form>
              </div>

              <div className="store-support__info">
                <h2>Información de contacto</h2>
                {store.email && (
                  <div className="store-support__contact">
                    <strong>Email:</strong>
                    <a href={`mailto:${store.email}`}>{store.email}</a>
                  </div>
                )}
                {store.discord_invite && (
                  <div className="store-support__contact">
                    <strong>Discord:</strong>
                    <a href={store.discord_invite} target="_blank" rel="noopener noreferrer">
                      Únete al servidor
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
