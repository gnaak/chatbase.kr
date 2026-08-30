import { Route } from "react-router-dom";

import Landing from "@chatbase/container/landing";
import Guide from "@chatbase/container/guide";
import Test from "@chatbase/container/test";
import EmbedChat from "@chatbase/container/embed";
import DashboardLayout from "@chatbase/container/dashboard/layout";
import DashboardHome from "@chatbase/container/dashboard/home";
import BotEdit from "@chatbase/container/dashboard/botEdit";
import Keys from "@chatbase/container/dashboard/keys";
import Conversations from "@chatbase/container/dashboard/conversations";
import Settings from "@chatbase/container/dashboard/settings";
import Billing from "@chatbase/container/dashboard/billing";
import BillingSuccess from "@chatbase/container/dashboard/billingSuccess";
import DashboardKakao from "@chatbase/container/dashboard/kakao";
import Stats from "@chatbase/container/dashboard/stats";
import Support from "@chatbase/container/dashboard/support";
import SupportDetail from "@chatbase/container/dashboard/supportDetail";
import { ProtectedRoute } from "@shared/hooks/auth/protectedRoute";

/** chatbase.kr — 챗봇 상품. */
const chatbaseRoutes = () => (
  <>
    <Route path="/" element={<Landing />} />
    <Route path="/embed/:botId" element={<EmbedChat />} />
    <Route path="/test" element={<Test />} />

    {/* 로그인 필수: 비로그인 시 /login으로 */}
    <Route element={<ProtectedRoute />}>
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<DashboardHome />} />
        <Route path="/dashboard/bots/new" element={<BotEdit />} />
        <Route path="/dashboard/bots/:slug" element={<BotEdit />} />
        <Route path="/dashboard/keys" element={<Keys />} />
        <Route path="/dashboard/conversations" element={<Conversations />} />
        <Route path="/dashboard/settings" element={<Settings />} />
        <Route path="/dashboard/stats" element={<Stats />} />
        <Route path="/dashboard/kakao" element={<DashboardKakao />} />
        <Route path="/dashboard/billing" element={<Billing />} />
        <Route path="/dashboard/billing/success" element={<BillingSuccess />} />
        <Route path="/dashboard/support" element={<Support />} />
        <Route path="/dashboard/support/:id" element={<SupportDetail />} />
        <Route path="/dashboard/guide" element={<Guide />} />
      </Route>
    </Route>
  </>
);

export default chatbaseRoutes;
