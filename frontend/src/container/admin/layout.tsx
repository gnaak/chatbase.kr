import { Outlet } from "react-router-dom";
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

/** 인증 판정은 AdminProtectedRoute가 담당한다. 여기는 레이아웃만. */
const AdminLayout = () => {
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
