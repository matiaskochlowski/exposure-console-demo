import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cx } from './cx.js';

interface ToastItem {
  id: number;
  message: string;
  tone: 'ok' | 'danger' | 'neutral';
}

const ToastContext = createContext<(message: string, tone?: ToastItem['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const notify = useCallback((message: string, tone: ToastItem['tone'] = 'neutral') => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Polite live region: announced by screen readers without stealing focus. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed top-16 right-4 left-4 z-50 flex flex-col items-end gap-2 sm:left-auto"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto max-w-sm rounded-md border border-line px-3 py-2 text-sm shadow-lg',
              t.tone === 'ok' && 'bg-ok-soft text-ok',
              t.tone === 'danger' && 'bg-danger-soft text-danger',
              t.tone === 'neutral' && 'bg-surface text-fg',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext);
}
