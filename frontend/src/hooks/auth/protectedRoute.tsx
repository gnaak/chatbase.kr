import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/common/useAuth";
import LoadingScreen from "@/component/auth/loadingScreen";

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
