export default function Button({ 
    variant = 'primary', 
    size = 'md', 
    loading = false, 
    disabled = false,
    children,
    ...props 
}) {
    const className = `btn btn-${size} btn-${variant}${loading ? ' btn-loading' : ''}`;
    
    return (
        <button className={className} disabled={disabled} {...props}>
            {children}
        </button>
    );
}
