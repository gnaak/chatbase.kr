import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import MobileNav from "./mobileNav";

interface TopbarProps {
  /** 로딩 중에는 스켈레톤을 넣을 수 있도록 ReactNode를 받는다. */
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backTo?: string;
}

const Topbar = ({ title, description, actions, backTo }: TopbarProps) => {
  return (
    <header className="sticky top-0 z-10 bg-bg/80 backdrop-blur-md border-b border-line">
      <div className="flex items-center justify-between gap-4 px-6 md:px-8 h-14">
        <div className="flex items-center gap-2 min-w-0">
          {/* md 미만 전용. 데스크톱에서는 고정 사이드바가 이 역할을 한다. */}
          <MobileNav />
          {backTo && (
            <Link
              to={backTo}
              aria-label="뒤로 가기"
              className="
                shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full
                text-text-sub hover:text-text-main hover:bg-bg-hover active:bg-bg-active
                transition-colors -ml-1
              "
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold tracking-tight text-text-main truncate">
              {title}
            </h1>
            {/*
              좁은 화면에서는 숨긴다. 햄버거 + 제목 + 액션 버튼이 56px 한 줄을
              나눠 쓰는 상황이라, 설명은 어떻게 줄여도 "답변은 이 화면과..."처럼
              말줄임으로 잘린다. 잘린 문장은 없는 것보다 나쁘다 — 읽히지도 않으면서
              자리는 차지하고, 제목까지 밀어낸다.
            */}
            {description && (
              <p className="hidden sm:block text-[12px] text-text-sub truncate">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
