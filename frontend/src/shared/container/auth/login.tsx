import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "@shared/ui/button";
import Card from "@shared/ui/card";
import Field from "@shared/ui/field";
import Input from "@shared/ui/input";
import { OAuthButton } from "@shared/component/auth/oauthButtons";
import { usePost } from "@shared/hooks/common/useAPI";
import { useAuth } from "@shared/hooks/common/useAuth";
import { parseUserInfo } from "@shared/hooks/common/getCookie";

interface LoginBody {
  email: string;
  password: string;
  type: "user";
}

const Login = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loginMutation = usePost<LoginBody, void>("api/auth/login");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    loginMutation.mutate(
      { email, password, type: "user" },
      {
        onSuccess: () => {
          const u = parseUserInfo();
          if (u) setUser(u);
          navigate("/dashboard", { replace: true });
        },
        onError: (err) => {
          setError(err?.message || "로그인에 실패했습니다.");
        },
      },
    );
  };

  const submitting = loginMutation.isPending;

  return (
    <div className="min-h-svh bg-bg flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="font-mono text-[15px] font-medium tracking-tight text-text-main hover:text-text-sub transition-colors"
          >
            chatbase.kr
          </Link>
        </div>

        <Card variant="outline" className="p-8">
          <h1 className="text-[20px] font-semibold tracking-tight text-text-main mb-1">
            로그인
          </h1>
          <p className="text-[13px] text-text-sub mb-6">
            계정에 로그인하여 챗봇을 관리하세요.
          </p>

          <div className="flex flex-col gap-2 mb-5">
            <OAuthButton provider="google" />
            <OAuthButton provider="kakao" />
          </div>

          <Divider />

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="이메일" htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </Field>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="text-[13px] font-medium text-text-main tracking-tight"
                >
                  비밀번호
                </label>
                <Link
                  to="/forgot"
                  className="text-[11px] text-text-sub hover:text-text-main transition-colors"
                >
                  비밀번호 찾기
                </Link>
              </div>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <p className="text-[12px] text-point-red leading-relaxed">{error}</p>
            )}

            <Button
              type="submit"
              pill
              full
              disabled={submitting || !email || !password}
            >
              {submitting ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-[12px] text-text-sub">
          아직 계정이 없으신가요?{" "}
          <Link
            to="/signup"
            className="text-text-main font-medium hover:underline"
          >
            가입하기
          </Link>
        </p>
      </div>
    </div>
  );
};

const Divider = () => (
  <div className="flex items-center gap-3 my-5">
    <div className="flex-1 h-px bg-line" />
    <span className="text-[10px] uppercase tracking-tight text-text-sub font-medium">
      또는
    </span>
    <div className="flex-1 h-px bg-line" />
  </div>
);

export default Login;
