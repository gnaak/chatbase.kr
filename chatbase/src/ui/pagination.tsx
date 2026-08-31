import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * 페이지 넘김.
 *
 * `admin/component/ui/pagination.tsx` 와 같은 계산을 쓰지만 스타일이 그쪽은
 * 라이트 모드로 박혀 있어(`bg-white`, `border-gray-300`) 대시보드 토큰으로 옮겼다.
 * [`ui/calendar.tsx`](calendar.tsx) 와 같은 이유다.
 *
 * 페이지 번호는 `visibleCount` 개씩 묶어서 보여준다 — 100페이지짜리에서
 * 번호를 다 그리면 표보다 페이지네이션이 길어진다.
 */

interface PaginationProps {
  /** 1-based */
  page: number;
  /** 전체 항목 수 (페이지 수가 아니다) */
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  /** 한 번에 보여줄 페이지 번호 개수 */
  visibleCount?: number;
  className?: string;
}

const Pagination = ({
  page,
  total,
  pageSize,
  onChange,
  visibleCount = 5,
  className = "",
}: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 한 장뿐이면 아예 안 그린다. 쓸 수 없는 버튼만 남는 줄은 자리만 먹는다.
  if (totalPages <= 1) return null;

  const count = Math.max(1, Math.min(visibleCount, totalPages));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = Math.floor((current - 1) / count) * count + 1;
  const end = Math.min(totalPages, start + count - 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const box =
    "inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-DEFAULT text-[12px] tabular-nums transition-colors";
  const idle = "text-text-sub hover:text-text-main hover:bg-bg-hover";
  const off = "text-text-disabled pointer-events-none";

  return (
    <nav
      aria-label="페이지"
      className={["flex items-center justify-center gap-1 select-none", className].join(" ")}
    >
      <button
        type="button"
        aria-label="이전"
        disabled={start === 1}
        onClick={() => onChange(Math.max(1, start - 1))}
        className={[box, start === 1 ? off : idle].join(" ")}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === current ? "page" : undefined}
          onClick={() => p !== current && onChange(p)}
          className={[
            box,
            p === current
              ? "bg-text-main text-text-inverse font-medium"
              : idle,
          ].join(" ")}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        aria-label="다음"
        disabled={end === totalPages}
        onClick={() => onChange(Math.min(totalPages, start + count))}
        className={[box, end === totalPages ? off : idle].join(" ")}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
};

export default Pagination;
