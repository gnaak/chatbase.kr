import { useEffect, useState, ReactNode } from "react";
import { X } from "lucide-react";
import {
  TermsContent,
  PrivacyContent,
  LEGAL_META,
} from "@/container/legal/content";

type LegalType = "terms" | "privacy";

interface LegalModalProps {
  open: boolean;
  type: LegalType;
  onClose: () => void;
}

export const LegalModal = ({ open, type, onClose }: LegalModalProps) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const meta = LEGAL_META[type];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-overlay/60 backdrop-blur-sm px-4 py-8"
      onClick={onClose}
    >
      <div
        className="
          w-full max-w-2xl max-h-[85svh]
          rounded-comfy bg-bg-card
          shadow-card dark:shadow-card-dark
          flex flex-col overflow-hidden
          animate-fade-slide
        "
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 flex items-center justify-between gap-4 px-6 h-14 border-b border-line">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-tight text-text-sub">
              LEGAL
            </p>
            <h2 className="text-[15px] font-semibold tracking-tight text-text-main truncate">
              {meta.title}
            </h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono text-[11px] text-text-sub">
              시행일 · {meta.effectiveDate}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="
                inline-flex items-center justify-center w-8 h-8 rounded-full
                text-text-sub hover:text-text-main hover:bg-bg-hover
                transition-colors
              "
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-visible px-6 md:px-8 py-6">
          <article>
            {type === "terms" ? <TermsContent /> : <PrivacyContent />}
          </article>
        </div>
      </div>
    </div>
  );
};

interface LegalModalLinkProps {
  type: LegalType;
  children: ReactNode;
  className?: string;
}

export const LegalModalLink = ({
  type,
  children,
  className = "",
}: LegalModalLinkProps) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
      >
        {children}
      </button>
      <LegalModal open={open} type={type} onClose={() => setOpen(false)} />
    </>
  );
};
