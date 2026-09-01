import { Route } from "react-router-dom";
import publicRoutes from "@/publicRoutes";
import Guide from "@/container/guide";
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
    {/* 공개·크롤 대상 라우트. 프리렌더가 이 목록만 따로 import 한다 — `@/publicRoutes` 주석 참고 */}
    {publicRoutes()}

    <Route path="/embed/:botId" element={<EmbedChat />} />

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

    {/* 문의 스레드 — 로그인 없이 열리지만 URL 의 토큰 때문에 색인은 막았다(robots.txt) */}
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
