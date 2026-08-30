import { Link, NavLink } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bot,
  KeyRound,
  CreditCard,
  Settings,
  MessagesSquare,
  MessageCircle,
  LogOut,
  BookOpen,
  LifeBuoy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGet, usePost } from "@/hooks/common/useAPI";
import Skeleton from "@/ui/skeleton";

/**
 * 사이드바 알맹이 — 데스크톱 고정 사이드바([`sidebar.tsx`])와 모바일 드로어
 * ([`mobileNav.tsx`])가 **같은 것을 쓴다.**
 *
 * 메뉴를 두 벌로 두면 한쪽에만 항목을 추가하는 사고가 반드시 난다.
 * 껍데기(고정/오버레이)만 다르고 내용은 여기 하나다.
 */

interface MeDto {
  id: number;
  email: string;
  name: string;
  profile_image: string | null;
}

/**
 * 메뉴를 세 덩어리로 묶는다. **접지 않는다** — 항목이 9개뿐이라 접기로 얻는
 * 세로 공간보다 "한 번 더 눌러야 보이고, 접혀 있으면 있는 줄도 모르는" 비용이 크다.
 * 라벨은 클릭 대상이 아니라 구분선 역할만 한다.
 *
 * 순서는 평평했던 시절과 같다. 묶기만 했지 위치를 바꾸지 않았다 —
 * 손에 익은 사람의 근육기억을 깨지 않으려는 것.
 */
const navGroups = [
  {
    title: "운영",
    items: [
      { to: "/dashboard", label: "챗봇", icon: Bot, end: true },
      { to: "/dashboard/conversations", label: "대화 로그", icon: MessagesSquare },
      { to: "/dashboard/stats", label: "통계", icon: BarChart3 },
    ],
  },
  {
    title: "연결",
    items: [
      { to: "/dashboard/keys", label: "API 키", icon: KeyRound },
      // 플랜 게이팅은 kakao.tsx 안에서 처리한다. 사이드바에는 항상 노출해
      // 무료 사용자도 기능 존재를 인지하고 업그레이드 동선을 타게 한다.
      { to: "/dashboard/kakao", label: "카카오톡", icon: MessageCircle },
    ],
  },
  {
    title: "계정",
    items: [
      { to: "/dashboard/billing", label: "결제", icon: CreditCard },
      { to: "/dashboard/settings", label: "설정", icon: Settings },
    ],
  },
];

/**
 * 도움말. 일하는 메뉴가 아니라 막혔을 때 찾는 메뉴라 위 그룹과 섞지 않는다.
 * 그룹명 없이 구분선만 두는 이유는, 여기에 "도움말" 라벨을 또 붙이면
 * 두 줄짜리 목록에 머리말이 붙어 배보다 배꼽이 커지기 때문.
 */
const helpItems = [
  { to: "/dashboard/guide", label: "가이드", icon: BookOpen },
  { to: "/dashboard/support", label: "문의", icon: LifeBuoy },
];

interface NavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  onNavigate?: () => void;
}

const NavItem = ({ to, label, icon: Icon, end, onNavigate }: NavItemProps) => (
  <NavLink
    to={to}
    end={end}
    onClick={onNavigate}
    className={({ isActive }) =>
      [
        "group flex items-center gap-2.5 h-9 px-3 rounded-full",
        "text-[13px] font-medium transition-colors duration-150",
        isActive
          ? "bg-bg-hover text-text-main"
          : "text-text-sub hover:text-text-main hover:bg-bg-hover",
      ].join(" ")
    }
  >
    <Icon className="w-4 h-4 shrink-0" />
    <span>{label}</span>
  </NavLink>
);

interface SidebarContentProps {
  /**
   * 모바일 드로어에서 메뉴를 누르면 닫아야 한다. 안 닫으면 이동은 됐는데
   * 화면은 여전히 메뉴로 덮여 있어서 "눌렀는데 아무 일도 안 났다"로 보인다.
   * 데스크톱 사이드바는 넘기지 않는다.
   */
  onNavigate?: () => void;
}

const SidebarContent = ({ onNavigate }: SidebarContentProps) => {
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useGet<MeDto>("api/user/me", ["me"]);
  const logoutMutation = usePost<void, void>("api/auth/logout");

  const handleLogout = () => {
    const finish = () => {
      // setUser(null)이 ProtectedRoute의 Navigate("/login")를 먼저 트리거하므로
      // 강제 새로고침으로 랜딩으로 이동.
      queryClient.clear();
      window.location.replace("/");
    };
    logoutMutation.mutate(undefined, {
      onSuccess: finish,
      onError: finish,
    });
  };

  const initial = (me?.name || me?.email || "U").trim().charAt(0).toUpperCase();

  return (
    <>
      <div className="px-5 h-14 flex items-center shrink-0">
        <Link
          to="/"
          onClick={onNavigate}
          className="
            font-mono text-[13px] font-medium tracking-tight text-text-main
            hover:opacity-70 transition-opacity
          "
        >
          chatbase.kr
        </Link>
      </div>

      {/* 그룹이 늘어 세로가 길어졌다. 화면이 짧아도 하단 계정 영역이 밀려나지
          않도록 목록만 스크롤시킨다. */}
      <nav className="flex-1 overflow-y-auto flex flex-col px-2 py-3">
        {navGroups.map(({ title, items }) => (
          <div key={title} className="flex flex-col gap-1.5 mb-4 last:mb-0">
            <div className="px-3 text-[11px] font-medium text-text-disabled tracking-tight">
              {title}
            </div>
            {items.map((item) => (
              <NavItem key={item.to} {...item} onNavigate={onNavigate} />
            ))}
          </div>
        ))}

        <div className="mt-4 pt-4 border-t border-line flex flex-col gap-1.5">
          {helpItems.map((item) => (
            <NavItem key={item.to} {...item} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      <div className="mt-auto px-3 py-3 border-t border-line shrink-0">
        <div className="flex items-center gap-2 px-2 py-1.5">
          {isLoading ? (
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-bg-sub shadow-border flex items-center justify-center text-[11px] font-medium text-text-sub shrink-0 overflow-hidden">
              {me?.profile_image ? (
                <img
                  src={me.profile_image}
                  alt={me.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                initial
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              // "사용자 / 로그인됨" 을 먼저 보여주면 실제 이름으로 바뀔 때 깜빡인다.
              <div className="flex flex-col gap-1 py-0.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-32" />
              </div>
            ) : (
              <>
                <div className="text-[13px] font-medium text-text-main truncate">
                  {me?.name || "사용자"}
                </div>
                <div className="text-[11px] text-text-sub truncate">
                  {me?.email || "로그인됨"}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="로그아웃"
            title="로그아웃"
            disabled={logoutMutation.isPending}
            className="
              shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full
              text-text-sub hover:text-text-main
              hover:bg-bg-hover active:bg-bg-active
              transition-colors duration-150
              focus:outline-none focus-visible:shadow-focus
              disabled:opacity-60 disabled:cursor-not-allowed
            "
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
};

export default SidebarContent;
