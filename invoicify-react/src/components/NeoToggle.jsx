// "Neo" toggle switch — from Uiverse.io by chicogale, converted to JSX.
// id must be unique per instance on the page (multiple toggles = multiple
// unique ids), since the <label htmlFor> match relies on it.
export default function NeoToggle({ id, checked, onChange, disabled }) {
  return (
    <div className="neo-toggle-container">
      <input
        className="neo-toggle-input"
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <label className="neo-toggle" htmlFor={id}>
        <div className="neo-track">
          <div className="neo-background-layer"></div>
          <div className="neo-grid-layer"></div>
          <div className="neo-spectrum-analyzer">
            <div className="neo-spectrum-bar"></div>
            <div className="neo-spectrum-bar"></div>
            <div className="neo-spectrum-bar"></div>
            <div className="neo-spectrum-bar"></div>
            <div className="neo-spectrum-bar"></div>
          </div>
          <div className="neo-track-highlight"></div>
        </div>
        <div className="neo-thumb">
          <div className="neo-thumb-ring"></div>
          <div className="neo-thumb-core">
            <div className="neo-thumb-icon">
              <div className="neo-thumb-wave"></div>
              <div className="neo-thumb-pulse"></div>
            </div>
          </div>
        </div>
        <div className="neo-gesture-area"></div>
        <div className="neo-interaction-feedback">
          <div className="neo-ripple"></div>
          <div className="neo-progress-arc"></div>
        </div>
        <div className="neo-status">
          <div className="neo-status-indicator">
            <div className="neo-status-dot"></div>
            <div className="neo-status-text"></div>
          </div>
        </div>
      </label>
    </div>
  );
}