import GoogleLoginBtn from "@shared/hooks/auth/googleLogin";
import GoogleLoginPopup from "@shared/hooks/auth/googleLoginPopup";
import KakaoLoginBtn from "@shared/hooks/auth/kakaoLogin";

const ClientMain = () => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
      <GoogleLoginBtn />
      <GoogleLoginPopup />
      <KakaoLoginBtn />
    </div>
  );
};

export default ClientMain;