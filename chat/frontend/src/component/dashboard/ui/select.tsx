import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  id?: string;
}

const Select = ({
  value,
  onChange,
  options,
  placeholder = "선택하세요",
  disabled,
  invalid,
  className = "",
  id,
}: SelectProps) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
  }, []);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  // 열릴 때 현재 값으로 highlight 이동
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlight(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => {
        for (let i = 1; i <= options.length; i++) {
          const next = (h + i) % options.length;
          if (!options[next].disabled) return next;
        }
        return h;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => {
        for (let i = 1; i <= options.length; i++) {
          const prev = (h - i + options.length) % options.length;
          if (!options[prev].disabled) return prev;
        }
        return h;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[highlight];
      if (opt && !opt.disabled) {
        onChange(opt.value);
        close();
      }
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={["relative", className].join(" ")}
    >
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          "w-full flex items-center gap-2 h-9 pl-3 pr-2 rounded-comfy bg-input-bg",
          "shadow-border transition-shadow duration-150",
          "text-[13px] text-text-main outline-none",
          "focus-visible:shadow-[0_0_0_1px_rgb(var(--text-main))]",
          invalid
            ? "shadow-[0_0_0_1px_rgb(var(--point-red))]"
            : open
              ? "shadow-[0_0_0_1px_rgb(var(--text-main))]"
              : "",
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
      >
        <span
          className={[
            "flex-1 text-left truncate",
            !selected ? "text-text-placeholder" : "",
          ].join(" ")}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={[
            "shrink-0 w-4 h-4 text-text-sub transition-transform duration-150",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="
            absolute left-0 right-0 top-full mt-1.5 z-30
            rounded-comfy bg-bg-card shadow-card dark:shadow-card-dark
            p-1 max-h-64 overflow-y-auto
            [scrollbar-width:none] [-ms-overflow-style:none]
            [&::-webkit-scrollbar]:hidden
            animate-fade-slide
          "
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlight = idx === highlight && !opt.disabled;
            const isDisabled = !!opt.disabled;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-disabled={isDisabled}
                disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) return;
                  onChange(opt.value);
                  close();
                }}
                onMouseEnter={() => !isDisabled && setHighlight(idx)}
                className={[
                  "w-full flex items-center gap-2 h-8 px-2.5 rounded-DEFAULT",
                  "text-[13px] text-left transition-colors",
                  isHighlight ? "bg-bg-hover" : "",
                  isDisabled
                    ? "text-text-disabled cursor-not-allowed"
                    : isSelected
                      ? "text-text-main font-medium"
                      : "text-text-main",
                ].join(" ")}
              >
                <span className="flex-1 truncate">{opt.label}</span>
                {isSelected && !isDisabled && (
                  <Check className="shrink-0 w-3.5 h-3.5 text-text-main" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Select;
