import SidebarContent from "./sidebarContent";

/**
 * 데스크톱 고정 사이드바. md 미만에서는 숨고, 그 자리를 모바일 드로어
 * ([`mobileNav.tsx`], topbar의 햄버거)가 대신한다.
 *
 * 메뉴 내용은 [`sidebarContent.tsx`]에 있다 — 여기는 껍데기만.
 */
const Sidebar = () => (
  <aside className="hidden md:flex flex-col w-60 shrink-0 h-svh sticky top-0 border-r border-line bg-bg">
    <SidebarContent />
  </aside>
);

export default Sidebar;
