import { parseUserInfo, refreshExp } from "@/hooks/common/getCookie";
import { useRefreshToken } from "@/hooks/common/useAPI";
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import AdminSidebar from "@/component/admin/layout/sideBar/sideBar";
import { AdminMenuItem } from "@/types/admin/sidebar";
import {
  ChartColumnIcon,
  UsersIcon,
  CreditCardIcon,
  CpuIcon,
} from "lucide-react";

const adminMenu: AdminMenuItem[] = [
  {
    type: "link",
    label: "대시보드",
    to: "/admin",
    icon: ChartColumnIcon,
    end: true,
  },
  {
    type: "link",
    label: "고객 관리",
    to: "/admin/customers",
    icon: UsersIcon,
  },
  {
    type: "link",
    label: "결제 관리",
    to: "/admin/payments",
    icon: CreditCardIcon,
  },
  {
    type: "link",
    label: "모델 관리",
    to: "/admin/models",
    icon: CpuIcon,
  },
];

const AdminLayout = () => {
  const user = parseUserInfo("admin");
  const isRefresh = refreshExp("admin");
  const refresh = useRefreshToken();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user && isRefresh) {
      refresh()
        .then(() => {
          window.location.reload();
        })
        .catch(() => {
          navigate("/admin/login");
        });
      return;
    }

    if (!user || user.auth_type !== "admin") {
      navigate("/admin/login");
    }
  }, [user, isRefresh, navigate, refresh]);

  if (!user || user.auth_type !== "admin") {
    return null;
  }

  return (
    <div className="flex h-svh overflow-hidden bg-bg text-text-main">
      <AdminSidebar adminMenu={adminMenu} />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
