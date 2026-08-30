import { Route } from "react-router-dom";
import Landing from "@/container/landing";
import Guide from "@/container/guide";
import Test from "@/container/test";
import EmbedChat from "@/container/embed";
import DashboardLayout from "@/container/dashboard/layout";
import DashboardHome from "@/container/dashboard/home";
import BotEdit from "@/container/dashboard/botEdit";
import Keys from "@/container/dashboard/keys";
import Conversations from "@/container/dashboard/conversations";
import Settings from "@/container/dashboard/settings";
import Billing from "@/container/dashboard/billing";
import BillingSuccess from "@/container/dashboard/billingSuccess";
import DashboardKakao from "@/container/dashboard/kakao";
import Stats from "@/container/dashboard/stats";
import Support from "@/container/dashboard/support";
import SupportDetail from "@/container/dashboard/supportDetail";
import { ProtectedRoute } from "@/hooks/auth/protectedRoute";
import ClientLayOut from "@/container/client/layout";
import Google from "@/container/client/auth/google";
import Kakao from "@/container/client/auth/kakao";
import Login from "@/container/auth/login";
import Signup from "@/container/auth/signup";
import Terms from "@/container/legal/terms";
import Privacy from "@/container/legal/privacy";
import SupportForm from "@/container/support";
import SupportThread from "@/container/support/thread";
import { PublicOnlyRoute } from "@/hooks/auth/protectedRoute";

/**
 * chatbase.kr 의 모든 라우트.
 *
 * 로그인·약관·문의는 llm 앱에도 있어야 하는 화면이지만, 두 앱을 완전히
 * 독립시키기로 했으므로 각자 자기 것을 갖는다. llm 쪽에서 챗봇 계정 화면이
 * 필요해지면 그때 복사한다.
 */
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

    {/* 계정 · 약관 · 문의 */}
    <Route path="/terms" element={<Terms />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/support" element={<SupportForm />} />
    <Route path="/support/:token" element={<SupportThread />} />

    {/* 비로그인 전용: 이미 로그인된 사용자는 /dashboard로 */}
    <Route element={<PublicOnlyRoute />}>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
    </Route>

    <Route element={<ClientLayOut />}>
      <Route path="/kakao/login" element={<Kakao />} />
      <Route path="/google/login" element={<Google />} />
    </Route>
  </>
);

export default chatbaseRoutes;
