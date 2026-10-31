export default function Toggle({ label, checked = false, onChange, ...props }) {
    return (
        <label className="toggle">
            <input type="checkbox" checked={checked} onChange={onChange} {...props} />
            <div className="toggle-track">
                <div className="toggle-thumb"></div>
            </div>
            <span className="toggle-label">{label}</span>
        </label>
    );
}
