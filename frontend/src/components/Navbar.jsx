import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoBlanco from '../assets/loader.svg';
import lightcodeIcono from '../assets/loader.svg';
import lightcodeCommIcono from '../assets/loader.svg';
import '../styles/navbar-mobile.css';

export default function Navbar({ variant = 'transparent', sticky = false, bannerVisible = false, bannerHeight = 0 }) {
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const [productsDropdownOpen, setProductsDropdownOpen] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(false);
    const { isAuthenticated } = useAuth();
    const location = useLocation();
    
    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    
    // Detectar si estamos en páginas de PlugsEssentials
    const isPlugsEssentialsPage = location.pathname.includes('/plugsessentials');
    
    // Calcular el top dinámicamente según si el banner está visible
    const topPosition = sticky && bannerVisible ? bannerHeight : 0;
    
    const className = `navbar ${variant === 'solid' ? 'navbar-solid' : 'navbar-transparent'}${sticky ? ' navbar-sticky' : ''}${isPlugsEssentialsPage ? ' navbar-plugsessentials' : ''}`;
    
    return (
        <div 
            className={className}
            style={sticky ? { top: `${topPosition}px` } : undefined}
        >
            <Link to="/" className="navbar-logo">
                <img src={logoBlanco} alt="lightcode" />
            </Link>
            
            <button 
                className="navbar-mobile-toggle"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    {mobileMenuOpen ? (
                        <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    ) : (
                        <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    )}
                </svg>
            </button>
            
            <div className={`navbar-links ${mobileMenuOpen ? 'active' : ''}`}>
                {/* Dropdown de Productos */}
                <div 
                    className={`navbar-dropdown ${productsDropdownOpen ? 'active' : ''}`}
                    onMouseEnter={() => window.innerWidth > 768 && setProductsDropdownOpen(true)}
                    onMouseLeave={() => window.innerWidth > 768 && setProductsDropdownOpen(false)}
                >
                    <button 
                        className="navbar-dropdown-trigger"
                        onClick={() => {
                            if (window.innerWidth <= 768) {
                                setProductsDropdownOpen(!productsDropdownOpen);
                            }
                        }}
                    >
                        Productos
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                    
                    {productsDropdownOpen && (
                        <div className="navbar-dropdown-menu">
                            <Link 
                                to="/" 
                                className="navbar-dropdown-card navbar-dropdown-card-stores"
                                onClick={() => {
                                    setMobileMenuOpen(false);
                                    setProductsDropdownOpen(false);
                                }}
                            >
                                <div className="navbar-dropdown-card-icon" style={{ background: 'transparent', padding: '0' }}>
                                    <img src={lightcodeIcono} alt="lightcode" width="40" height="40" />
                                </div>
                                <div className="navbar-dropdown-card-content">
                                    <h3>lightcode Stores</h3>
                                    <p>Crea tu tienda de Minecraft</p>
                                </div>
                            </Link>
                            
                            <Link 
                                to="/plugsessentials" 
                                className="navbar-dropdown-card navbar-dropdown-card-plugs"
                                onClick={() => {
                                    setMobileMenuOpen(false);
                                    setProductsDropdownOpen(false);
                                }}
                            >
                                <div className="navbar-dropdown-card-icon" style={{ background: 'rgba(234, 179, 8, 0.15)', border: '2px solid rgba(234, 179, 8, 0.3)' }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2">
                                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                        <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                    </svg>
                                </div>
                                <div className="navbar-dropdown-card-content">
                                    <h3>PlugsEssentials</h3>
                                    <p>Monta tu servidor Bedrock</p>
                                </div>
                            </Link>
                            
                            <div className="navbar-dropdown-card navbar-dropdown-card-community disabled">
                                <div className="navbar-dropdown-card-icon" style={{ background: 'transparent', padding: '0' }}>
                                    <img 
                                        src={lightcodeCommIcono} 
                                        alt="lightcode Community" 
                                        width="48" 
                                        height="48" 
                                        style={{ 
                                            filter: 'drop-shadow(0 0 12px rgba(0, 200, 150, 0.4)) drop-shadow(0 0 24px rgba(0, 200, 150, 0.2))'
                                        }} 
                                    />
                                </div>
                                <div className="navbar-dropdown-card-content">
                                    <h3>Community</h3>
                                    <p>Publica tus servidores</p>
                                </div>
                                <div className="navbar-dropdown-card-badge coming-soon">Próximamente</div>
                            </div>
                        </div>
                    )}
                </div>
                
                <a href="/#precios" onClick={() => setMobileMenuOpen(false)}>Precios</a>
                
                <a href="/#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
                
                {/* Discord */}
                <a 
                    href="" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="navbar-discord-link"
                    title="Únete a Discord"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    <span>Únete a Discord</span>
                </a>
                
                {/* CTAs principales */}
                {isAuthenticated ? (
                    <Link 
                        to="/home" 
                        className="btn btn-sm btn-primary" 
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        Ir a lightcode →
                    </Link>
                ) : (
                    <>
                        <Link 
                            to="/login" 
                            className="btn btn-sm btn-ghost" 
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Iniciar sesión
                        </Link>
                        <Link 
                            to="/register" 
                            className="btn btn-sm btn-primary" 
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Empezar gratis →
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
