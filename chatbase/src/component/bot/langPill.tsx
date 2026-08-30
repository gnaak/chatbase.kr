import { useState } from "react";
import { ChevronDown } from "lucide-react";

/** 선택 가능한 언어. 원문이 한국어라 `ko` 가 기본값이다. */
export const LANGS = [
  { key: "ko", flag: "🇰🇷", label: "한국어" },
  { key: "en", flag: "🇺🇸", label: "English" },
  { key: "ja", flag: "🇯🇵", label: "日本語" },
  { key: "zh", flag: "🇨🇳", label: "中文" },
] as const;

interface LangPillProps {
  value: string;
  onChange: (lang: string) => void;
}

/**
 * 채팅창 우측 상단 언어 선택 pill.
 *
 * 임베드(방문자)와 대시보드 미리보기가 같이 쓴다. 미리보기에 없으면 봇 주인이
 * 저장 전에 다국어 동작을 확인할 방법이 없다 — 그건 파는 사람이 자기 상품을
 * 못 보는 상태다.
 *
 * 스스로 열림 상태만 들고, 선택값은 부모가 소유한다. 고른 언어가 대화 요청에도
 * 실려야 해서(`lang`) 부모가 알아야 하기 때문이다.
 */
const LangPill = ({ value, onChange }: LangPillProps) => {
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.key === value) ?? LANGS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-bg-sub shadow-border text-[11px] text-text-main hover:bg-bg-hover transition-colors focus:outline-none focus-visible:shadow-focus"
      >
        <span>{current.flag}</span>
        <span>{current.label}</span>
        <ChevronDown className="w-3 h-3 text-text-sub" />
      </button>

      {open && (
        <>
          {/* 바깥을 눌러 닫는다. 좁은 위젯이라 포커스 트랩까지는 걸지 않는다. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className="absolute right-0 top-7 z-20 w-[132px] py-1 rounded-DEFAULT bg-bg-card shadow-card dark:shadow-card-dark"
          >
            {LANGS.map((l) => (
              <button
                key={l.key}
                type="button"
                role="option"
                aria-selected={l.key === value}
                onClick={() => {
                  onChange(l.key);
                  setOpen(false);
                }}
                className={[
                  "w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left transition-colors",
                  l.key === value
                    ? "text-text-main bg-bg-sub"
                    : "text-text-sub hover:bg-bg-sub",
                ].join(" ")}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LangPill;
