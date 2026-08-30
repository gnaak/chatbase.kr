import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePost } from "@shared/hooks/common/useAPI";

interface GoogleCallbackProps {
  apiURL: string;
  redirectURL: string;
  onSuccess: () => void;
  onError: (error: { status?: number; message?: string }) => void;
}

const GoogleCallback = ({ apiURL, redirectURL, onSuccess, onError }: GoogleCallbackProps) => {
  const navigate = useNavigate();
  const exchangeMutation = usePost<{ code: string }, unknown>(apiURL);

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
    } catch {}

    exchangeMutation.mutate(
      { code },
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
