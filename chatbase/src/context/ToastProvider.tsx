import {
  createContext,
  type ReactNode,
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

/**
 * 종류별 표시 시간.
 * 에러는 사용자가 읽고 판단해야 하는 정보라 훨씬 길게 둔다 —
 * 성공 토스트와 같은 3초면 문장을 다 읽기도 전에 사라진다.
 */
const DURATION_MS: Record<ToastType, number> = {
  success: 3000,
  info: 3000,
  warning: 6000,
  error: 10000,
};

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
  // 마우스를 올려두면 타이머가 멈춘다 — 긴 에러를 읽는 도중 사라지지 않게.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(
      () => onDismiss(toast.id),
      DURATION_MS[toast.type],
    );
    return () => window.clearTimeout(t);
  }, [toast.id, toast.type, paused, onDismiss]);

  const Icon = ICONS[toast.type];
  const color = COLORS[toast.type];

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="
        pointer-events-auto
        flex items-center gap-2.5 min-w-[280px] max-w-[min(90vw,42rem)]
        px-3.5 py-3 rounded-comfy
        bg-bg-card shadow-card dark:shadow-card-dark
        animate-fade-slide
      "
    >
      <Icon className={`w-4 h-4 shrink-0 ${color}`} />
      <p className="flex-1 min-w-0 text-[13px] leading-relaxed text-text-main break-keep">
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
