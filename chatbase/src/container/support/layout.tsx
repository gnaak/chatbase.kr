import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface SupportLayoutProps {
  title: string;
  description?: ReactNode;
  /** 제목 위 작은 라벨. 스레드 화면에서는 문의 번호를 넣는다. */
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * 공개 문의 페이지 셸. 로그인 없이 열리므로 대시보드 사이드바가 없다.
 * 약관 페이지(`container/legal/layout.tsx`)와 같은 골격을 쓴다.
 */
const SupportLayout = ({
  title,
  description,
  eyebrow = "SUPPORT",
  actions,
  children,
}: SupportLayoutProps) => {
  return (
    <div className="min-h-svh bg-bg text-text-main">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-line">
        <div className="max-w-3xl mx-auto h-14 px-6 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-text-sub hover:text-text-main transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            chatbase.kr
          </Link>
          {actions}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <div className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-tight text-text-sub mb-3">
            {eyebrow}
          </p>
          <h1 className="text-[28px] md:text-[36px] font-semibold tracking-heading leading-tight text-text-main">
            {title}
          </h1>
          {description && (
            <p className="mt-3 text-[14px] text-text-sub leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {children}

        <footer className="mt-16 pt-6 border-t border-line text-[11px] text-text-sub flex flex-wrap gap-x-6 gap-y-2">
          <Link to="/terms" className="hover:text-text-main">
            이용약관
          </Link>
          <Link to="/privacy" className="hover:text-text-main">
            개인정보처리방침
          </Link>
          <a href="mailto:hello@chatbase.kr" className="hover:text-text-main">
            hello@chatbase.kr
          </a>
        </footer>
      </main>
    </div>
  );
};

export default SupportLayout;
