import KakaoCallBack from "@shared/hooks/auth/kakaoCallback";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "@shared/component/auth/loadingScreen";
import InactiveAccountModal from "@shared/component/auth/inactiveAccountModal";
import { useAuth } from "@shared/hooks/common/useAuth";
import { parseUserInfo } from "@shared/hooks/common/getCookie";

const Kakao = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  return (
    <>
      {isLoading && <LoadingScreen title="카카오 로그인 처리 중" />}
      <InactiveAccountModal
        open={showInactive}
        onConfirm={() => navigate("/")}
      />
      <KakaoCallBack
        apiURL="api/auth/kakao"
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

export default Kakao;
