import { Route } from "react-router-dom";

import AdminLogin from "@/admin/container/login";
import AdminLayout from "@/admin/container/layout";
import AdminMain from "@/admin/container/main";
import AdminGroup from "@/admin/container/group";
import AdminCustomers from "@/admin/container/customers";
import AdminPayments from "@/admin/container/payments";
import AdminModels from "@/admin/container/models";
import AdminInquiries from "@/admin/container/inquiries";
import {
  AdminProtectedRoute,
  AdminPublicOnlyRoute,
} from "@/hooks/auth/protectedRoute";

/**
 * 어드민. 두 상품을 한 화면에서 관리하므로 상품 폴더 밖에 둔다.
 * 지금은 chatbase.kr 진입점에만 붙인다 — 운영자가 들어오는 주소가 하나면 충분하다.
 */
const adminRoutes = () => (
  <>
    {/* admin 비로그인 전용: 이미 로그인된 관리자는 /admin으로 */}
    <Route element={<AdminPublicOnlyRoute />}>
      <Route path="/admin/login" element={<AdminLogin />} />
    </Route>

    {/* admin 로그인 필수: 비로그인 시 /admin/login으로 */}
    <Route element={<AdminProtectedRoute />}>
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<AdminMain />} />
        <Route path="/admin/group" element={<AdminGroup />} />
        <Route path="/admin/customers" element={<AdminCustomers />} />
        <Route path="/admin/payments" element={<AdminPayments />} />
        <Route path="/admin/models" element={<AdminModels />} />
        <Route path="/admin/inquiries" element={<AdminInquiries />} />
      </Route>
    </Route>
  </>
);

export default adminRoutes;
