import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "./context/AuthProvider";
import { ThemeProvider } from "./context/ThemeProvider";
import { ToastProvider } from "./context/ToastProvider";
import NotFoundPage from "./container/notfound";
import AdminLogin from "./container/admin/login";
import AdminLayout from "./container/admin/layout";
import AdminMain from "./container/admin/main";
import AdminGroup from "./container/admin/group";
import ClientLayOut from "./container/client/layout";
import Landing from "./container/landing";
import Login from "./container/auth/login";
import Signup from "./container/auth/signup";
import Google from "./container/client/auth/google";
import Kakao from "./container/client/auth/kakao";
import Test from "./container/test";
import DashboardLayout from "./container/dashboard/layout";
import DashboardHome from "./container/dashboard/home";
import BotEdit from "./container/dashboard/botEdit";
import Keys from "./container/dashboard/keys";
import Conversations from "./container/dashboard/conversations";
import Settings from "./container/dashboard/settings";
import Billing from "./container/dashboard/billing";
import EmbedChat from "./container/embed";
import Terms from "./container/legal/terms";
import Privacy from "./container/legal/privacy";
import { ProtectedRoute, PublicOnlyRoute } from "./hooks/auth/protectedRoute";

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/embed/:botId" element={<EmbedChat />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />

              {/* 비로그인 전용: 이미 로그인된 사용자는 /dashboard로 */}
              <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
              </Route>

              <Route element={<ClientLayOut />}>
                <Route path="/kakao/login" element={<Kakao />} />
                <Route path="/google/login" element={<Google />} />
              </Route>

              {/* 로그인 필수: 비로그인 시 /login으로 */}
              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<DashboardHome />} />
                  <Route path="/dashboard/bots/new" element={<BotEdit />} />
                  <Route path="/dashboard/bots/:slug" element={<BotEdit />} />
                  <Route path="/dashboard/keys" element={<Keys />} />
                  <Route path="/dashboard/conversations" element={<Conversations />} />
                  <Route path="/dashboard/settings" element={<Settings />} />
                  <Route path="/dashboard/billing" element={<Billing />} />
                </Route>
              </Route>

              <Route path="/test" element={<Test />}></Route>

              <Route path="/admin/login" element={<AdminLogin />} />
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminMain />} />
                <Route path="/admin/group" element={<AdminGroup />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
