export default function NumericInput({ label, value, onChange, placeholder }) {
  return (
    <div className="campo">
      {label ? <label className="campo-label">{label}</label> : null}
      <input
        type="number"
        inputMode="numeric"
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
