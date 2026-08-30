import { Outlet } from "react-router-dom";
import Sidebar from "@/component/layout/sidebar";

const DashboardLayout = () => {
  return (
    <div className="flex h-svh overflow-hidden bg-bg text-text-main">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
