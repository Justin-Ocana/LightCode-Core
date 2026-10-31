export default function Select({ label, required = false, options = [], ...props }) {
    return (
        <div className="form-group">
            {label && (
                <label className={`form-label${required ? ' form-label-required' : ''}`}>
                    {label}
                </label>
            )}
            <select className="select" {...props}>
                {options.map((option, index) => (
                    <option key={index} value={option.value || ''}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
