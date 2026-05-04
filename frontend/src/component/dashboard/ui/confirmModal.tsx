import { ReactNode, useEffect } from "react";
import Button from "@/component/dashboard/ui/button";

type Variant = "default" | "danger";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal = ({
  open,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay/60 backdrop-blur-sm px-6"
      onClick={onCancel}
    >
      <div
        className="
          w-full max-w-sm rounded-comfy bg-bg-card
          shadow-card dark:shadow-card-dark
          p-6 flex flex-col gap-4 animate-fade-slide
        "
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-text-main mb-1">
            {title}
          </h2>
          {description && (
            <div className="text-[13px] text-text-sub leading-relaxed">
              {description}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button size="sm" pill variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            pill
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
