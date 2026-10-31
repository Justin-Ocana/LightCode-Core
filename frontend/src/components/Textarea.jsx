export default function Textarea({ label, required = false, ...props }) {
    return (
        <div className="form-group">
            {label && (
                <label className={`form-label${required ? ' form-label-required' : ''}`}>
                    {label}
                </label>
            )}
            <textarea className="textarea" {...props}></textarea>
        </div>
    );
}
