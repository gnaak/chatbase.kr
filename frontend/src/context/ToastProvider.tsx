import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { Check, X, AlertTriangle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (type: ToastType, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DURATION_MS = 3000;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const ctx: ToastContextValue = {
    show,
    success: (m) => show("success", m),
    error: (m) => show("error", m),
    info: (m) => show("info", m),
    warning: (m) => show("warning", m),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <ToastViewport
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((prev) => prev.filter((t) => t.id !== id))
        }
      />
    </ToastContext.Provider>
  );
};

const ToastViewport = ({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) => (
  <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
    {toasts.map((toast) => (
      <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
    ))}
  </div>
);

const ICONS: Record<ToastType, typeof Check> = {
  success: Check,
  error: AlertTriangle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS: Record<ToastType, string> = {
  success: "text-success",
  error: "text-point-red",
  info: "text-info",
  warning: "text-warning",
};

const ToastItem = ({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) => {
  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(toast.id), DURATION_MS);
    return () => window.clearTimeout(t);
  }, [toast.id, onDismiss]);

  const Icon = ICONS[toast.type];
  const color = COLORS[toast.type];

  return (
    <div
      className="
        pointer-events-auto
        flex items-start gap-2.5 min-w-[280px] max-w-md
        px-3.5 py-3 rounded-comfy
        bg-bg-card shadow-card dark:shadow-card-dark
        animate-fade-slide
      "
    >
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
      <p className="flex-1 text-[13px] leading-relaxed text-text-main">
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="닫기"
        className="
          shrink-0 inline-flex items-center justify-center w-5 h-5
          text-text-sub hover:text-text-main rounded-DEFAULT transition-colors
        "
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
