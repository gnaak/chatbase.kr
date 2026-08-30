import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import SidebarContent from "./sidebarContent";

/**
 * 모바일 대시보드 내비게이션.
 *
 * md 미만에서는 고정 사이드바가 숨는데 그것을 대신할 것이 없어서, 폰으로
 * 로그인하면 결제·API 키·통계로 갈 방법이 주소창밖에 없었다. 그 구멍을 메운다.
 *
 * 메뉴 내용은 데스크톱과 같은 [`sidebarContent.tsx`]를 쓴다.
 */
const MobileNav = () => {
  const [open, setOpen] = useState(false);

  // 화면을 다 덮는 오버레이라 닫는 길이 X 버튼 하나뿐이면 갇힌 느낌을 준다.
  // 배경 탭과 Esc를 함께 연다.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        aria-expanded={open}
        className="
          md:hidden shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full -ml-2
          text-text-sub hover:text-text-main hover:bg-bg-hover active:bg-bg-active
          transition-colors duration-150
          focus:outline-none focus-visible:shadow-focus
        "
      >
        <Menu className="w-5 h-5" />
      </button>

      {/*
        body로 포탈을 쏜다. Topbar가 `backdrop-blur-md`를 쓰는데, backdrop-filter는
        fixed 자식의 containing block이 되어버린다. 그 안에 두면 `fixed inset-0`이
        화면이 아니라 헤더(높이 56px)를 기준으로 잡혀서 드로어가 헤더 안에 갇힌다.
      */}
      {open &&
        createPortal(
          <div
            className="md:hidden fixed inset-0 z-50 flex"
            role="dialog"
            aria-modal="true"
            aria-label="대시보드 메뉴"
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label="메뉴 닫기"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/40 animate-fade-in motion-reduce:animate-none"
            />

            <div
              className="
                relative flex flex-col w-64 max-w-[80vw] h-full
                bg-bg border-r border-line shadow-[0_0_40px_rgba(0,0,0,0.18)]
                animate-drawer-in motion-reduce:animate-none
              "
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="메뉴 닫기"
                className="
                  absolute top-0 right-0 z-10 inline-flex items-center justify-center w-14 h-14
                  text-text-sub hover:text-text-main transition-colors duration-150
                  focus:outline-none focus-visible:shadow-focus
                "
              >
                <X className="w-4 h-4" />
              </button>

              <SidebarContent onNavigate={() => setOpen(false)} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default MobileNav;
