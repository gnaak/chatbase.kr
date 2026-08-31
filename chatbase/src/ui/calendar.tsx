import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react";

/**
 * 날짜 범위 선택.
 *
 * ## 왜 `admin/component/ui/form/calendar.tsx` 를 안 쓰나
 *
 * 로직은 그쪽이 먼저지만 **스타일이 라이트 모드로 박혀 있다**(`bg-white`,
 * `text-gray-800`, `border-gray-300`). 어드민은 다크 테마가 없어서 문제가 없지만
 * 대시보드는 `ThemeProvider` 가 있어서 그대로 가져오면 다크에서 흰 판이 뜬다.
 * 게다가 `@/admin/.../form/button` 을 끌고 와 어드민 디자인 시스템이 딸려 온다.
 *
 * 그래서 **동작과 API 는 그대로 두고 토큰만 대시보드 것으로** 옮겼다.
 * 팝업·외부 클릭·포커스 처리는 [`ui/select.tsx`](select.tsx) 의 관례를 따른다.
 *
 * ## 하루만 고르는 것도 된다
 *
 * 한 날짜만 찍고 "확인"을 누르면 `{start: d, end: d}` 로 확정된다.
 * 범위 선택기 하나로 "그날만 보기"와 "이번 주 보기"를 둘 다 덮는다.
 */

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface CalendarProps {
  value: DateRange;
  /** "확인"을 눌렀을 때만 불린다. 지우기는 `{null, null}` 로 온다. */
  onChange: (value: DateRange) => void;
  /** 트리거에 값이 없을 때 보이는 문구 */
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const MONTHS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const ymd = (d: Date) =>
  `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const isSameDay = (a: Date | null, b: Date | null) =>
  !!a && !!b && a.toDateString() === b.toDateString();

const Calendar = ({
  value,
  onChange,
  placeholder = "전체 기간",
  className = "",
  disabled,
}: CalendarProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const anchor = value.start ?? new Date();
  const [viewYear, setViewYear] = useState(anchor.getFullYear());
  const [viewMonth, setViewMonth] = useState(anchor.getMonth());

  const close = useCallback(() => setOpen(false), []);

  // 외부 클릭 시 닫기 — select.tsx 와 같은 방식
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  /** 달력 격자. 첫 주 앞은 빈칸으로 민다. */
  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const out: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d += 1) {
      out.push(new Date(viewYear, viewMonth, d));
    }
    return out;
  }, [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const handlePick = (picked: Date) => {
    // start 가 없거나 이미 범위가 완성됐으면 새로 시작한다
    if (!draft.start || draft.end) {
      setDraft({ start: picked, end: null });
      return;
    }
    if (picked < draft.start) setDraft({ start: picked, end: draft.start });
    else setDraft({ start: draft.start, end: picked });
  };

  const handleOpen = () => {
    if (disabled) return;
    if (!open) setDraft(value);
    setOpen((v) => !v);
  };

  const handleConfirm = () => {
    // 하루만 찍고 확인 → 그 하루만
    onChange(
      draft.start && !draft.end ? { start: draft.start, end: draft.start } : draft,
    );
    close();
  };

  const handleClear = () => {
    setDraft({ start: null, end: null });
    onChange({ start: null, end: null });
    close();
  };

  const hasValue = !!value.start;
  const label = !hasValue
    ? placeholder
    : isSameDay(value.start, value.end)
      ? ymd(value.start!)
      : `${ymd(value.start!)} ~ ${value.end ? ymd(value.end) : ""}`;

  const inRange = (d: Date) =>
    !!draft.start && !!draft.end && d >= draft.start && d <= draft.end;

  return (
    <div ref={wrapperRef} className={["relative", className].join(" ")}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={[
          "w-full flex items-center gap-2 h-9 pl-3 pr-2 rounded-comfy bg-input-bg",
          "shadow-border transition-shadow duration-150",
          "text-[13px] outline-none",
          "focus-visible:shadow-[0_0_0_1px_rgb(var(--text-main))]",
          open ? "shadow-[0_0_0_1px_rgb(var(--text-main))]" : "",
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
      >
        <CalendarIcon className="shrink-0 w-4 h-4 text-text-sub" />
        <span
          className={[
            "flex-1 text-left truncate tabular-nums",
            hasValue ? "text-text-main" : "text-text-placeholder",
          ].join(" ")}
        >
          {label}
        </span>
        {hasValue && (
          // 값이 있을 때만 뜨는 지우기. 달력을 열지 않고 바로 전체 기간으로 되돌린다.
          <span
            role="button"
            tabIndex={0}
            aria-label="기간 지우기"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                handleClear();
              }
            }}
            className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-text-sub hover:text-text-main hover:bg-bg-hover transition-colors"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="기간 선택"
          className="
            absolute right-0 top-full mt-1.5 z-30 w-[268px] p-3
            rounded-comfy bg-bg-card shadow-card dark:shadow-card-dark
            animate-fade-slide
          "
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="이전 달"
              className="inline-flex items-center justify-center w-7 h-7 rounded-DEFAULT text-text-sub hover:text-text-main hover:bg-bg-hover transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[13px] font-semibold text-text-main tabular-nums">
              {viewYear}년 {MONTHS[viewMonth]}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="다음 달"
              className="inline-flex items-center justify-center w-7 h-7 rounded-DEFAULT text-text-sub hover:text-text-main hover:bg-bg-hover transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div
                key={d}
                className="h-6 flex items-center justify-center text-[11px] text-text-sub"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((d, i) => {
              if (!d) return <div key={`x${i}`} className="h-8" />;
              const isStart = isSameDay(d, draft.start);
              const isEnd = isSameDay(d, draft.end);
              const mid = inRange(d) && !isStart && !isEnd;
              const isToday = isSameDay(d, new Date());
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => handlePick(d)}
                  className={[
                    "h-8 flex items-center justify-center text-[12px] tabular-nums transition-colors",
                    isStart || isEnd
                      ? "bg-text-main text-text-inverse font-medium"
                      : mid
                        ? "bg-bg-sub text-text-main"
                        : "text-text-main hover:bg-bg-hover",
                    isStart && isEnd
                      ? "rounded-DEFAULT"
                      : isStart
                        ? "rounded-l-DEFAULT"
                        : isEnd
                          ? "rounded-r-DEFAULT"
                          : mid
                            ? ""
                            : "rounded-DEFAULT",
                    // 오늘은 선택 안 됐을 때만 표시한다. 선택되면 반전색이라 안 보인다.
                    isToday && !isStart && !isEnd ? "font-semibold underline underline-offset-4" : "",
                  ].join(" ")}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-line">
            <button
              type="button"
              onClick={handleClear}
              className="h-7 px-2.5 rounded-full text-[12px] text-text-sub hover:text-text-main hover:bg-bg-hover transition-colors"
            >
              전체 기간
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!draft.start}
              className="h-7 px-3.5 rounded-full bg-text-main text-text-inverse text-[12px] font-medium hover:opacity-90 disabled:bg-bg-disabled disabled:text-text-disabled disabled:cursor-not-allowed transition-opacity"
            >
              적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
