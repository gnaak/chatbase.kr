import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@shared/hooks/common/useAuth";
import { useRefreshToken } from "@shared/hooks/common/useAPI";
import { parseUserInfo, refreshExp } from "@shared/hooks/common/getCookie";
import LoadingScreen from "@shared/component/auth/loadingScreen";

/**
 * 로그인이 필요한 라우트 가드. AuthProvider의 쿠키 파싱 결과로 1차 판단.
 * 실제 보안은 각 API의 @with_login에서 보장됨.
 */
export const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen title="세션 확인 중" description="잠시만 기다려주세요..." />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

/**
 * 이미 로그인된 사용자가 /login, /signup에 들어오면 /dashboard로 보냄.
 */
export const PublicOnlyRoute = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

/**
 * admin_user_info(1시간)는 만료됐지만 admin_refresh_exp(6시간)가 남아있는 경우
 * refresh_token_admin으로 세션을 되살리고 context를 갱신한다.
 * reload 없이 상태만 갱신하므로 admin 라우트 전체가 context 한 곳만 본다.
 *
 * @returns 복구 시도 중이면 true
 */
const useAdminSessionRestore = () => {
  const { admin, isLoading, setAdmin } = useAuth();
  const refresh = useRefreshToken("admin");
  const [restoring, setRestoring] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (isLoading || admin || attempted.current) return;
    if (!refreshExp("admin")) return;

    attempted.current = true;
    setRestoring(true);
    refresh()
      .then((ok) => {
        if (ok) setAdmin(parseUserInfo("admin"));
      })
      .catch(() => {})
      .finally(() => setRestoring(false));
  }, [isLoading, admin, refresh, setAdmin]);

  return restoring;
};

/**
 * admin 로그인이 필요한 라우트 가드.
 */
export const AdminProtectedRoute = () => {
  const { admin, isLoading } = useAuth();
  const restoring = useAdminSessionRestore();

  if (isLoading || restoring) {
    return <LoadingScreen title="세션 확인 중" description="잠시만 기다려주세요..." />;
  }
  if (!admin || admin.auth_type !== "admin") {
    return <Navigate to="/admin/login" replace />;
  }
  return <Outlet />;
};

/**
 * 이미 로그인된 관리자가 /admin/login에 들어오면 /admin으로 보냄.
 */
export const AdminPublicOnlyRoute = () => {
  const { admin, isLoading } = useAuth();
  const restoring = useAdminSessionRestore();

  if (isLoading || restoring) return null;
  if (admin?.auth_type === "admin") return <Navigate to="/admin" replace />;
  return <Outlet />;
};
