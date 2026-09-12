import { useGet } from "@/hooks/common/useAPI";
import { type UserDetail } from "@/types/user";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/common/useAuth";
import LoadingScreen from "@/component/auth/loadingScreen";

const ClientLayOut = () => {
  const { user, isLoading } = useAuth();
  const { data: meData } = useGet<UserDetail>("api/user/me", ["me"], !!user);

  if (isLoading) {
    return <LoadingScreen title="세션 확인 중" />;
  }

  return (
    <main className="min-h-svh bg-bg text-text-main">
      <Outlet context={{ user, meData }} />
    </main>
  );
};

export default ClientLayOut;
