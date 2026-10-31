export default function Badge({ variant = 'new', dot = false, children }) {
    const className = `badge badge-${variant}${dot ? ' badge-dot' : ''}`;
    
    return (
        <span className={className}>{children}</span>
    );
}
