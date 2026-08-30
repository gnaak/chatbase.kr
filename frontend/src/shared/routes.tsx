import { Route } from "react-router-dom";

import ClientLayOut from "@shared/container/client/layout";
import Google from "@shared/container/client/auth/google";
import Kakao from "@shared/container/client/auth/kakao";
import Login from "@shared/container/auth/login";
import Signup from "@shared/container/auth/signup";
import Terms from "@shared/container/legal/terms";
import Privacy from "@shared/container/legal/privacy";
import SupportForm from "@shared/container/support";
import SupportThread from "@shared/container/support/thread";
import { PublicOnlyRoute } from "@shared/hooks/auth/protectedRoute";

/**
 * 상품과 무관한 라우트. 두 진입점이 모두 이걸 깐다.
 *
 * 로그인·약관·문의는 어느 상품에서 들어와도 같은 화면이어야 한다 —
 * 계정과 문의 창구가 하나이기 때문이다.
 */
const sharedRoutes = () => (
  <>
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

export default sharedRoutes;
