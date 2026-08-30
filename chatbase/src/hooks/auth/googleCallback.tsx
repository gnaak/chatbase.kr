import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePost } from "@/hooks/common/useAPI";
import { readUtm, type Utm } from "@/hooks/common/utm";

interface GoogleCallbackProps {
  apiURL: string;
  redirectURL: string;
  onSuccess: () => void;
  onError: (error: { status?: number; message?: string }) => void;
}

const GoogleCallback = ({ apiURL, redirectURL, onSuccess, onError }: GoogleCallbackProps) => {
  const navigate = useNavigate();
  const exchangeMutation = usePost<{ code: string } & Utm, unknown>(apiURL);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const rawState = params.get("state");

    if (!code) {
      onError({ message: "code 없음" });
      return;
    }

    let stateObj: { next?: string; isPopup?: boolean } = {};
    try {
      if (rawState) stateObj = JSON.parse(decodeURIComponent(rawState));
    } catch {
      // state 는 우리가 만든 값이지만 사용자가 주소를 고칠 수 있다.
      // 깨져 있으면 기본 경로로 보내면 되고, 로그인 자체를 막을 이유는 없다.
    }

    /**
      * utm_* 을 같이 보낸다. OAuth 는 구글로 갔다 돌아오는 사이에 주소의
      * 쿼리스트링이 날아가지만, localStorage 에 담아둔 값은 살아남는다.
      * 이걸 빼먹으면 소셜 가입자의 유입 출처만 통째로 비게 된다.
      */
    exchangeMutation.mutate(
      { code, ...readUtm() },
      {
        onSuccess: () => {
          if (stateObj.isPopup && window.opener) {
            window.opener.postMessage(
              { type: "GOOGLE_LOGIN_SUCCESS", next: stateObj.next },
              window.location.origin,
            );
            window.close();
          } else {
            onSuccess();
            navigate(stateObj.next || redirectURL);
          }
        },
        onError: (err) => onError({ status: err?.status, message: err?.message }),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

export default GoogleCallback;
