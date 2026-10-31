export default function Checkbox({ label, disabled = false, ...props }) {
    return (
        <label className="checkbox-group">
            <input type="checkbox" disabled={disabled} {...props} />
            <span style={disabled ? { opacity: 0.5 } : {}}>{label}</span>
        </label>
    );
}
