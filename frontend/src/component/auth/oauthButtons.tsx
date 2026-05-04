import google from "@/assets/client/login/google.svg";
import kakao from "@/assets/client/login/kakao.svg";

const googleClientId = import.meta.env.VITE_APP_PUBLIC_GOOGLE_CLIENT_ID;
const googleRedirectUri = import.meta.env.VITE_APP_PUBLIC_GOOGLE_REDIRECT_URI;
const kakaoClientId = import.meta.env.VITE_APP_PUBLIC_KAKAO_REST_API_KEY;
const kakaoRedirectUri = import.meta.env.VITE_APP_PUBLIC_KAKAO_REDIRECT_URI;

const buildGoogleUrl = () => {
  const scope = encodeURIComponent("openid email profile");
  return (
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${googleClientId}` +
    `&redirect_uri=${encodeURIComponent(googleRedirectUri)}` +
    `&response_type=code&access_type=offline&scope=${scope}`
  );
};

const buildKakaoUrl = () =>
  `https://kauth.kakao.com/oauth/authorize?client_id=${kakaoClientId}&redirect_uri=${kakaoRedirectUri}&response_type=code&lang=ko`;

interface OAuthButtonProps {
  provider: "google" | "kakao";
}

export const OAuthButton = ({ provider }: OAuthButtonProps) => {
  const config = {
    google: {
      icon: google,
      label: "Google 계정으로 계속",
      onClick: () => (window.location.href = buildGoogleUrl()),
    },
    kakao: {
      icon: kakao,
      label: "카카오 계정으로 계속",
      onClick: () => (window.location.href = buildKakaoUrl()),
    },
  }[provider];

  return (
    <button
      type="button"
      onClick={config.onClick}
      className="
        flex items-center justify-center gap-2.5
        w-full h-10 px-4 rounded-comfy
        bg-bg shadow-border
        text-[13px] font-medium text-text-main
        hover:bg-bg-hover active:bg-bg-active
        transition-colors duration-150
        focus:outline-none focus-visible:shadow-focus
      "
    >
      <img src={config.icon} alt="" className="w-4 h-4 shrink-0" />
      {config.label}
    </button>
  );
};
