import logoBlanco from '../assets/loader.svg';

export default function Sidebar() {
    return (
        <aside className="ds-sidebar">
            <div className="ds-sidebar-logo">
                <img src={logoBlanco} alt="lightcode" height="32" />
            </div>
            <nav>
                <div className="ds-nav-group"><div className="ds-nav-group-label">Fundamentos</div></div>
                <a href="#tokens">Design Tokens</a>
                <a href="#spacing">Spacing</a>
                <a href="#typography">Tipografía</a>
                <a href="#colors">Colores</a>

                <div className="ds-nav-group"><div className="ds-nav-group-label">Componentes</div></div>
                <a href="#buttons">Botones</a>
                <a href="#forms">Forms</a>
                <a href="#badges">Badges</a>
                <a href="#alerts">Alerts</a>
                <a href="#toasts">Toasts</a>

                <div className="ds-nav-group"><div className="ds-nav-group-label">Dashboard</div></div>
                <a href="#stats">Stats</a>
                <a href="#tables">Tablas</a>
            </nav>
        </aside>
    );
}
