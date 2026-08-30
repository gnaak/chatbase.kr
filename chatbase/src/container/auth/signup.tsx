import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "@/ui/button";
import Card from "@/ui/card";
import Field from "@/ui/field";
import Input from "@/ui/input";
import { OAuthButton } from "@/component/auth/oauthButtons";
import { usePost } from "@/hooks/common/useAPI";
import { useAuth } from "@/hooks/common/useAuth";
import { parseUserInfo } from "@/hooks/common/getCookie";
import { LegalModalLink } from "@/component/landing/legalModal";

interface SignupBody {
  email: string;
  password: string;
  nickname: string;
}

interface LoginBody {
  email: string;
  password: string;
  type: "user";
}

const Signup = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const signupMutation = usePost<SignupBody, void>("api/auth/signup");
  const loginMutation = usePost<LoginBody, void>("api/auth/login");

  const submitting = signupMutation.isPending || loginMutation.isPending;
  const isValid = name.trim() && email.trim() && password.length >= 8;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    signupMutation.mutate(
      { email, password, nickname: name },
      {
        onSuccess: () => {
          // 가입 직후 자동 로그인
          loginMutation.mutate(
            { email, password, type: "user" },
            {
              onSuccess: () => {
                const u = parseUserInfo();
                if (u) setUser(u);
                navigate("/dashboard", { replace: true });
              },
              onError: () => navigate("/login", { replace: true }),
            },
          );
        },
        onError: (err) => {
          setError(err?.message || "가입에 실패했습니다.");
        },
      },
    );
  };

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
            가입하기
          </h1>
          <p className="text-[13px] text-text-sub mb-6">
            30초면 챗봇 만들 준비 완료. 카드 등록은 필요 없습니다.
          </p>

          <div className="flex flex-col gap-2 mb-5">
            <OAuthButton provider="google" />
            <OAuthButton provider="kakao" />
          </div>

          <Divider />

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="이름" htmlFor="signup-name">
              <Input
                id="signup-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                autoComplete="name"
                required
              />
            </Field>

            <Field label="이메일" htmlFor="signup-email">
              <Input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </Field>

            <Field
              label="비밀번호"
              htmlFor="signup-password"
              description="8자 이상으로 설정하세요."
            >
              <Input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>

            {error && (
              <p className="text-[12px] text-point-red leading-relaxed">{error}</p>
            )}

            <Button type="submit" pill full disabled={submitting || !isValid}>
              {submitting ? "가입 중..." : "무료로 가입하기"}
            </Button>

            <p className="text-[11px] text-text-sub leading-relaxed">
              가입 시{" "}
              <LegalModalLink
                type="terms"
                className="text-text-main hover:underline"
              >
                이용약관
              </LegalModalLink>{" "}
              및{" "}
              <LegalModalLink
                type="privacy"
                className="text-text-main hover:underline"
              >
                개인정보처리방침
              </LegalModalLink>
              에 동의하는 것으로 간주됩니다.
            </p>
          </form>
        </Card>

        <p className="mt-6 text-center text-[12px] text-text-sub">
          이미 계정이 있으신가요?{" "}
          <Link to="/login" className="text-text-main font-medium hover:underline">
            로그인
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

export default Signup;
