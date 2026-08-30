import GoogleCallback from "@/hooks/auth/googleCallback";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "@/component/auth/loadingScreen";
import InactiveAccountModal from "@/component/auth/inactiveAccountModal";
import { useAuth } from "@/hooks/common/useAuth";
import { parseUserInfo } from "@/hooks/common/getCookie";

const Google = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  return (
    <>
      {isLoading && <LoadingScreen title="Google 로그인 처리 중" />}
      <InactiveAccountModal
        open={showInactive}
        onConfirm={() => navigate("/")}
      />
      <GoogleCallback
        apiURL="api/auth/google"
        onSuccess={() => {
          const u = parseUserInfo();
          if (u) setUser(u);
        }}
        redirectURL="/dashboard"
        onError={(error) => {
          setIsLoading(false);
          if (error.status === 403) setShowInactive(true);
        }}
      />
    </>
  );
};

export default Google;
