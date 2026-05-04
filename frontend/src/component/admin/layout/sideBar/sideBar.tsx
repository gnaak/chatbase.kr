import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import GroupLink from "./groupLink";
import SubLink from "./subLink";
import { usePost } from "@/hooks/common/useAPI";
import { AdminSidebarProps } from "@/types/admin/sidebar";
import { parseUserInfo } from "@/hooks/common/getCookie";
import Modal from "@/component/admin/ui/feedback/modal";

const AdminSidebar = ({ adminMenu }: AdminSidebarProps) => {
  const navigate = useNavigate();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const logoutMutation = usePost<void, void>("api/auth/logout_admin");
  const user = parseUserInfo("admin");
  const initial = (user?.email || "A").trim().charAt(0).toUpperCase();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => navigate("/admin/login"),
    });
  };

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 h-svh sticky top-0 border-r border-line bg-bg">
      <div className="px-5 h-14 flex items-center">
        <span className="font-mono text-[13px] font-medium tracking-tight text-text-main">
          chatbase.kr · admin
        </span>
      </div>

      <nav className="flex flex-col gap-1 px-2 py-2">
        {adminMenu.map((item, idx) =>
          item.type === "link" ? (
            <SubLink key={`${item.to}-${idx}`} {...item} />
          ) : (
            <GroupLink key={`${item.title}-${idx}`} item={item} />
          ),
        )}
      </nav>

      <div className="mt-auto px-3 py-3 border-t border-line">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-bg-sub shadow-border flex items-center justify-center text-[11px] font-medium text-text-sub shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-text-main truncate">
              {user?.email ?? "관리자"}
            </div>
            <div className="text-[11px] text-text-sub truncate">관리자</div>
          </div>
          <button
            type="button"
            onClick={() => setLogoutModalOpen(true)}
            aria-label="로그아웃"
            title="로그아웃"
            className="
              shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full
              text-text-sub hover:text-text-main
              hover:bg-bg-hover active:bg-bg-active
              transition-colors duration-150
            "
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Modal
        open={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        title="로그아웃"
        description="로그아웃 하시겠습니까?"
        buttonCount={2}
        primaryText="로그아웃"
        primaryVariant="danger"
        onPrimary={handleLogout}
        secondaryText="취소"
        onSecondary={() => setLogoutModalOpen(false)}
      />
    </aside>
  );
};

export default AdminSidebar;
