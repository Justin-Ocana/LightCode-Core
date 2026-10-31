import { Link } from 'react-router-dom';
import logoBlanco from '../assets/loader.svg';

export default function Footer() {
    return (
        <footer className="landing-footer">
            <div className="landing-footer-content">
                <div className="landing-footer-section">
                    <div className="landing-footer-logo">
                        <img src={logoBlanco} alt="lightcode" height="32" />
                    </div>
                    <p className="landing-footer-description">
                        Panel de control central para gestionar tu servidor de Minecraft en Latinoamérica.
                    </p>
                    <p className="landing-footer-built">
                        Built by <a href="#" style={{ color: 'var(--accent)' }}>Justin Ocaña</a> & <a href="#" style={{ color: 'var(--accent)' }}>Luis Sánchez</a>
                    </p>
                </div>
                
                <div className="landing-footer-section">
                    <h4 className="landing-footer-title">Ecosistema</h4>
                    <ul className="landing-footer-links">
                        <li><Link to="/">lightcode Stores</Link></li>
                        <li><Link to="/plugsessentials">PlugsEssentials</Link></li>
                        <li><span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>lightcode Community <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>(próximamente)</span></span></li>
                    </ul>
                </div>
                
                <div className="landing-footer-section">
                    <h4 className="landing-footer-title">Producto</h4>
                    <ul className="landing-footer-links">
                        <li><a href="/#features">Características</a></li>
                        <li><a href="/#precios">Precios</a></li>
                        <li><a href="/#faq">FAQ</a></li>
                        <li><a href="/#founder">Historia</a></li>
                    </ul>
                </div>
                
                <div className="landing-footer-section">
                    <h4 className="landing-footer-title">Legal</h4>
                    <ul className="landing-footer-links">
                        <li><Link to="/terms">Términos</Link></li>
                        <li><Link to="/privacy">Privacidad</Link></li>
                    </ul>
                </div>
            </div>
            
            <div className="landing-footer-bottom">
                <p>© 2026 lightcode · Todos los derechos reservados</p>
                <p>Built by Justin Ocaña & Luis Sánchez</p>
            </div>
        </footer>
    );
}
