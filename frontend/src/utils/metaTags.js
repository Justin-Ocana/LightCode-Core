/**
 * Utility to update meta tags dynamically for SEO and social sharing
 */

export function updateMetaTags({
  title,
  description,
  image,
  url,
  type = 'website',
  siteName = 'lightcode'
}) {
  // Update title
  document.title = title;

  // Helper to set or update meta tag
  const setMetaTag = (property, content, isProperty = true) => {
    if (!content) return;
    
    const attribute = isProperty ? 'property' : 'name';
    let element = document.querySelector(`meta[${attribute}="${property}"]`);
    
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, property);
      document.head.appendChild(element);
    }
    
    element.setAttribute('content', content);
  };

  // Standard meta tags
  setMetaTag('description', description, false);

  // Open Graph tags (Facebook, WhatsApp, LinkedIn)
  setMetaTag('og:title', title);
  setMetaTag('og:description', description);
  setMetaTag('og:image', image);
  setMetaTag('og:url', url);
  setMetaTag('og:type', type);
  setMetaTag('og:site_name', siteName);

  // Twitter Card tags
  setMetaTag('twitter:card', image ? 'summary_large_image' : 'summary', false);
  setMetaTag('twitter:title', title, false);
  setMetaTag('twitter:description', description, false);
  if (image) {
    setMetaTag('twitter:image', image, false);
  }

  // Additional tags for better preview
  setMetaTag('og:image:width', '1200');
  setMetaTag('og:image:height', '630');
}

export function resetMetaTags() {
  updateMetaTags({
    title: 'lightcode — Tu panel de control central para servidores de Minecraft',
    description: 'Gestiona tu tienda, tu servidor y tu comunidad desde un solo lugar. lightcode centraliza lightcode Stores, PlugsEssentials y lightcode Community bajo una sola cuenta.',
    url: window.location.origin
  });
}
