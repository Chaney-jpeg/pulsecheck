import { useEffect, useState } from 'react';

export type ToastMessage = {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
};

let _nextId = 1;
let _addToast: ((msg: Omit<ToastMessage, 'id'>) => void) | null = null;

/** Call from anywhere to push a toast notification. */
export function toast(type: ToastMessage['type'], text: string) {
  _addToast?.({ type, text });
}

export function ToastContainer() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    _addToast = (msg) => {
      const id = _nextId++;
      setMessages((prev) => [...prev, { ...msg, id }]);
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }, 4000);
    };
    return () => {
      _addToast = null;
    };
  }, []);

  const dismiss = (id: number) => setMessages((prev) => prev.filter((m) => m.id !== id));

  if (messages.length === 0) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {messages.map((m) => (
        <div key={m.id} className={`toast toast-${m.type}`}>
          <span>{m.text}</span>
          <button onClick={() => dismiss(m.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
