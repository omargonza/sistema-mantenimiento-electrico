export default function NumericInput({ label, value, onChange }) {
    return (
        <label className="campo">
            {label}
            <input
                type="number"
                inputMode="numeric"
                className="input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    );
}
