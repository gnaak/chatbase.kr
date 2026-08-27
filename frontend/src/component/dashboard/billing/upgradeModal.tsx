import { Check, CreditCard, Loader2, Plus, X } from "lucide-react";
import Button from "@/component/dashboard/ui/button";
import type { Plan } from "@/types/plan";
import {
  describeMethod,
  type BillingMethod,
  type MethodSelection,
} from "@/types/payment";

interface UpgradeModalProps {
  open: boolean;
  plan: Plan | null;
  /** 서버가 정한 실제 청구 금액(원). 없으면 표기 가격만 보여준다. */
  amount?: number;
  methods: BillingMethod[];
  selected: MethodSelection | null;
  onSelect: (selection: MethodSelection) => void;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const rowClass = (selected: boolean) =>
  [
    "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-DEFAULT text-left transition-colors",
    selected ? "bg-bg-card shadow-border" : "hover:bg-bg-hover",
  ].join(" ");

const UpgradeModal = ({
  open,
  plan,
  amount,
  methods,
  selected,
  onSelect,
  pending,
  onConfirm,
  onClose,
}: UpgradeModalProps) => {
  if (!open || !plan) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay/60 backdrop-blur-sm px-6"
      onClick={pending ? undefined : onClose}
    >
      <div
        className="
          w-full max-w-sm max-h-[85svh] rounded-comfy bg-bg-card
          shadow-card dark:shadow-card-dark
          flex flex-col animate-fade-slide overflow-hidden
        "
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 flex items-start justify-between gap-3 px-6 pt-5">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-tight text-text-sub">
              SUBSCRIBE
            </p>
            <h2 className="text-[15px] font-semibold tracking-tight text-text-main">
              {plan.name} 플랜 시작하기
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="닫기"
            className="
              shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full
              text-text-sub hover:text-text-main hover:bg-bg-hover
              disabled:opacity-40 transition-colors -mr-1
            "
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-line">
            <span className="text-[13px] text-text-sub">오늘 결제 금액</span>
            <span className="text-[18px] font-semibold tracking-display text-text-main">
              {amount != null ? `₩${amount.toLocaleString()}` : plan.price}
            </span>
          </div>

          <div className="flex flex-col gap-1 -mx-3">
            <span className="px-3 text-[11px] font-mono text-text-sub">
              결제 카드
            </span>

            {/* 등록된 수단 */}
            {methods.map((method) => {
              const isSelected =
                selected?.kind === "saved" && selected.id === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => onSelect({ kind: "saved", id: method.id })}
                  disabled={pending}
                  className={rowClass(isSelected)}
                >
                  <CreditCard
                    className={[
                      "w-4 h-4 shrink-0",
                      isSelected ? "text-text-main" : "text-text-sub",
                    ].join(" ")}
                  />
                  <span
                    className={[
                      "flex-1 min-w-0 truncate text-[12.5px]",
                      isSelected ? "text-text-main font-medium" : "text-text-sub",
                    ].join(" ")}
                  >
                    {describeMethod(method)}
                  </span>
                  {method.is_default && (
                    <span className="shrink-0 text-[10px] font-mono text-text-sub">
                      기본
                    </span>
                  )}
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 shrink-0 text-text-main" />
                  )}
                </button>
              );
            })}

            {/* 새 카드로 결제 — 고르면 등록창을 거쳐 그대로 결제까지 이어진다 */}
            <button
              type="button"
              onClick={() => onSelect({ kind: "new" })}
              disabled={pending}
              className={rowClass(selected?.kind === "new")}
            >
              <Plus
                className={[
                  "w-4 h-4 shrink-0",
                  selected?.kind === "new" ? "text-text-main" : "text-text-sub",
                ].join(" ")}
              />
              <span
                className={[
                  "flex-1 min-w-0 truncate text-[12.5px]",
                  selected?.kind === "new"
                    ? "text-text-main font-medium"
                    : "text-text-sub",
                ].join(" ")}
              >
                새 카드로 결제
              </span>
              {selected?.kind === "new" && (
                <Check className="w-3.5 h-3.5 shrink-0 text-text-main" />
              )}
            </button>
          </div>

          <ul className="flex flex-col gap-1 text-[11.5px] leading-relaxed text-text-sub">
            <li>· 지금 1개월치가 결제되고, 이후 매달 같은 날 자동으로 청구됩니다.</li>
            <li>· 언제든 해지할 수 있고, 해지해도 남은 기간은 그대로 사용합니다.</li>
            {selected?.kind === "new" && (
              <li>· 결제하기를 누르면 토스페이먼츠 카드 등록창이 열립니다.</li>
            )}
          </ul>
        </div>

        <div className="shrink-0 px-6 pb-5 pt-1 flex items-center gap-2">
          <Button
            size="sm"
            pill
            variant="secondary"
            onClick={onClose}
            disabled={pending}
            className="flex-1"
          >
            취소
          </Button>
          <Button
            size="sm"
            pill
            variant="primary"
            onClick={onConfirm}
            disabled={pending || !selected}
            className="flex-1"
          >
            {pending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                처리 중
              </span>
            ) : (
              "결제하기"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
