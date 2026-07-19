import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((title, msg, type = 'success') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, title, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const iconFor = (type) =>
    type === 'error' ? 'fa-triangle-exclamation'
      : type === 'delete' ? 'fa-trash-can'
      : 'fa-circle-check';

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div id="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + (t.type === 'error' || t.type === 'delete' ? 'error' : '')}>
            <div className="dot"><i className={'fa-solid ' + iconFor(t.type)}></i></div>
            <div className="msg"><strong>{t.title}</strong>{t.msg}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
