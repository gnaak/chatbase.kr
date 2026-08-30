import { ReactNode, useEffect } from "react";
import Button from "@shared/ui/button";

type Variant = "default" | "danger";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  /**
   * 아이콘을 주면 안내형 레이아웃으로 바뀐다 —
   * 상단 원형 아이콘 + 가운데 정렬 텍스트 + 전체 너비 반반 버튼.
   * 없으면 기존 확인창(왼쪽 정렬 + 우측 작은 버튼)이 그대로 유지된다.
   */
  icon?: ReactNode;
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
  icon,
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
        className={[
          "w-full rounded-comfy bg-bg-card",
          "shadow-card dark:shadow-card-dark",
          "flex flex-col animate-fade-slide",
          icon ? "max-w-xs px-4 py-5 gap-3.5" : "max-w-sm p-6 gap-4",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {icon ? (
          // break-keep: 한국어가 단어 중간에서 끊기는 것을 막는다.
          // text-balance/pretty: 두 줄이 될 때 한 단어만 남는 어색한 줄을 없앤다.
          <div className="flex flex-col items-center text-center">
            <div className="w-9 h-9 rounded-full bg-bg-sub shadow-border flex items-center justify-center text-text-sub mb-3">
              {icon}
            </div>
            <h2 className="text-[14.5px] font-semibold tracking-tight text-text-main break-keep text-balance">
              {title}
            </h2>
            {description && (
              <div className="mt-1 text-[12.5px] text-text-sub leading-relaxed break-keep text-pretty">
                {description}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-text-main mb-1 break-keep">
              {title}
            </h2>
            {description && (
              <div className="text-[13px] text-text-sub leading-relaxed break-keep">
                {description}
              </div>
            )}
          </div>
        )}

        {icon ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              pill
              variant="secondary"
              onClick={onCancel}
              className="flex-1"
            >
              {cancelLabel}
            </Button>
            <Button
              size="sm"
              pill
              variant={variant === "danger" ? "danger" : "primary"}
              onClick={onConfirm}
              className="flex-1"
            >
              {confirmLabel}
            </Button>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default ConfirmModal;
