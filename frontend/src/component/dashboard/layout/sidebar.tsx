import { Link, NavLink } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  KeyRound,
  CreditCard,
  Settings,
  MessagesSquare,
  MessageCircle,
  LogOut,
  BookOpen,
} from "lucide-react";
import { useGet, usePost } from "@/hooks/common/useAPI";
import Skeleton from "@/component/dashboard/ui/skeleton";

interface MeDto {
  id: number;
  email: string;
  name: string;
  profile_image: string | null;
}

const navItems = [
  { to: "/dashboard", label: "챗봇", icon: Bot, end: true },
  { to: "/dashboard/conversations", label: "대화 로그", icon: MessagesSquare },
  { to: "/dashboard/keys", label: "API 키", icon: KeyRound },
  // 플랜 게이팅은 kakao.tsx 안에서 처리한다. 사이드바에는 항상 노출해
  // 무료 사용자도 기능 존재를 인지하고 업그레이드 동선을 타게 한다.
  { to: "/dashboard/kakao", label: "카카오톡", icon: MessageCircle },
  { to: "/dashboard/billing", label: "결제", icon: CreditCard },
  { to: "/dashboard/settings", label: "설정", icon: Settings },
  { to: "/dashboard/guide", label: "가이드", icon: BookOpen },
];

const Sidebar = () => {
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
    <aside className="hidden md:flex flex-col w-60 shrink-0 h-svh sticky top-0 border-r border-line bg-bg">
      <div className="px-5 h-14 flex items-center">
        <Link
          to="/"
          className="
            font-mono text-[13px] font-medium tracking-tight text-text-main
            hover:opacity-70 transition-opacity
          "
        >
          chatbase.kr
        </Link>
      </div>

      <nav className="flex flex-col gap-1.5 px-2 py-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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
        ))}
      </nav>

      <div className="mt-auto px-3 py-3 border-t border-line">
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
    </aside>
  );
};

export default Sidebar;
