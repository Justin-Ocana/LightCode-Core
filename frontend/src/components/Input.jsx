export default function Input({ 
    label, 
    required = false, 
    error, 
    hint, 
    icon, 
    suffix,
    hasError = false,
    ...props 
}) {
    const hasIcon = !!icon;
    const hasSuffix = !!suffix;
    
    return (
        <>
            {hasIcon || hasSuffix ? (
                <div className="input-group">
                    {hasIcon && (
                        <svg className="input-group-icon" width="16" height="16" viewBox="0 0 20 20" fill="none">
                            {icon}
                        </svg>
                    )}
                    <input 
                        className={`input${error || hasError ? ' input-error' : ''}`} 
                        style={hasSuffix ? { paddingRight: '60px' } : {}}
                        {...props} 
                    />
                    {hasSuffix && (
                        <span className="input-group-suffix">{suffix}</span>
                    )}
                </div>
            ) : (
                <input className={`input${error || hasError ? ' input-error' : ''}`} {...props} />
            )}
            {error && (
                <span className="form-error">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    {error}
                </span>
            )}
            {hint && !error && <span className="form-hint">{hint}</span>}
        </>
    );
}
