import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, Trash2, Save, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Topbar from "@/component/layout/topbar";
import Button from "@/ui/button";
import Card from "@/ui/card";
import ConfirmModal from "@/ui/confirmModal";
import Field from "@/ui/field";
import Input from "@/ui/input";
import Skeleton from "@/ui/skeleton";
import { useTheme } from "@/hooks/common/useTheme";
import type { Theme } from "@/context/ThemeProvider";
import { useGet, usePatch, usePost } from "@/hooks/common/useAPI";
import { useToast } from "@/hooks/common/useToast";

interface MeDto {
  id: number;
  email: string;
  name: string;
  profile_image: string | null;
  has_password: boolean;
}

interface UpdateMePayload {
  name?: string;
  profile_image?: string;
}

interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

interface WithdrawPayload {
  password?: string;
}

//: 백엔드 `user_service.MIN_PASSWORD_LENGTH`와 같은 값이어야 한다.
//  여기서 먼저 막는 건 왕복을 아끼기 위한 것이고, 진짜 검사는 서버가 한다.
const MIN_PASSWORD_LENGTH = 8;

const ME_QUERY_KEY = ["me"];

const Settings = () => {
  return (
    <>
      <Topbar title="설정" description="계정 정보와 외관을 관리합니다." />

      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
          <ProfileSection />
          <AppearanceSection />
          <DangerSection />
        </div>
      </div>
    </>
  );
};

/* ── 프로필 ───────────────────────────────────── */

const ProfileSection = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: me, isLoading } = useGet<MeDto>("api/user/me", ME_QUERY_KEY);
  const updateMe = usePatch<MeDto, UpdateMePayload>("api/user/me");
  const changePassword = usePost<ChangePasswordPayload, unknown>(
    "api/user/me/password",
  );

  const [name, setName] = useState("");
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  useEffect(() => {
    if (me) setName(me.name ?? "");
  }, [me]);

  const handleSaveProfile = () => {
    updateMe.mutate(
      { name },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
          toast.success("프로필이 저장되었습니다.");
        },
        onError: (err) => toast.error(err?.message || "저장에 실패했습니다."),
      },
    );
  };

  const closePasswordForm = () => {
    setPwOpen(false);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  };

  const handleSavePassword = () => {
    if (!currentPw) {
      toast.error("현재 비밀번호를 입력해 주세요.");
      return;
    }
    if (newPw.length < MIN_PASSWORD_LENGTH) {
      toast.error(`새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("새 비밀번호와 확인이 일치하지 않습니다.");
      return;
    }

    changePassword.mutate(
      { current_password: currentPw, new_password: newPw },
      {
        onSuccess: () => {
          toast.success("비밀번호가 변경되었습니다.");
          closePasswordForm();
        },
        // 입력값은 지우지 않는다 — 틀렸을 때 처음부터 다시 치게 하면 짜증난다.
        onError: (err) =>
          toast.error(err?.message || "비밀번호 변경에 실패했습니다."),
      },
    );
  };

  return (
    <Section title="프로필" description="계정 이름과 이메일을 관리합니다.">
      <Card variant="outline" className="p-5 flex flex-col gap-5">
        {/* 빈 입력창을 먼저 그리면 값이 도착할 때 글자가 튀어들어오는 깜빡임이 된다. */}
        <Field label="이름" htmlFor="profile-name">
          {isLoading ? (
            <Skeleton className="h-9 w-full rounded-comfy" />
          ) : (
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>

        <Field
          label="이메일"
          description="이메일 변경은 고객센터를 통해서만 가능합니다."
        >
          {isLoading ? (
            <Skeleton className="h-9 w-full rounded-comfy" />
          ) : (
            <Input value={me?.email ?? ""} disabled />
          )}
        </Field>

        {me?.has_password && (
          <>
            <div className="border-t border-line" />

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-text-main">
                  비밀번호
                </div>
                <p className="text-[12px] text-text-sub mt-0.5">
                  주기적으로 변경하는 것을 권장합니다.
                </p>
              </div>
              {!pwOpen && (
                <Button
                  size="sm"
                  pill
                  variant="secondary"
                  onClick={() => setPwOpen(true)}
                >
                  비밀번호 변경
                </Button>
              )}
            </div>

            {pwOpen && (
              <div className="flex flex-col gap-3">
                <Field label="현재 비밀번호">
                  <Input
                    type="password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    autoComplete="current-password"
                  />
                </Field>
                <Field label="새 비밀번호">
                  <Input
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="새 비밀번호 확인">
                  <Input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    autoComplete="new-password"
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    pill
                    onClick={handleSavePassword}
                    disabled={changePassword.isPending}
                  >
                    {changePassword.isPending ? "변경 중..." : "저장"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={closePasswordForm}
                    disabled={changePassword.isPending}
                  >
                    취소
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end">
          <Button
            size="sm"
            pill
            leftIcon={<Save className="w-3.5 h-3.5" />}
            onClick={handleSaveProfile}
            // 로딩 중에는 name이 빈 문자열이라 그대로 저장되면 이름이 지워진다.
            disabled={isLoading || updateMe.isPending}
          >
            {updateMe.isPending ? "저장 중..." : "프로필 저장"}
          </Button>
        </div>
      </Card>
    </Section>
  );
};

/* ── 외관 ────────────────────────────────────── */

const AppearanceSection = () => {
  const { theme, setTheme } = useTheme();

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "라이트", icon: <Sun className="w-3.5 h-3.5" /> },
    { value: "dark", label: "다크", icon: <Moon className="w-3.5 h-3.5" /> },
    {
      value: "system",
      label: "시스템 자동",
      icon: <Monitor className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <Section title="외관" description="대시보드의 테마를 설정합니다.">
      <Card variant="outline" className="p-5">
        <Field label="테마">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-bg-sub shadow-border w-fit">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={[
                  "h-8 px-3.5 inline-flex items-center gap-1.5 rounded-full",
                  "text-[12px] font-medium transition-colors",
                  theme === opt.value
                    ? "bg-bg-card text-text-main shadow-border"
                    : "text-text-sub hover:text-text-main",
                ].join(" ")}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </Field>
      </Card>
    </Section>
  );
};

/* ── 위험 영역 ───────────────────────────────── */

const DangerSection = () => {
  const toast = useToast();
  const { data: me } = useGet<MeDto>("api/user/me", ME_QUERY_KEY);
  const withdraw = usePost<WithdrawPayload, unknown>("api/user/me/withdraw");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");

  const closeConfirm = () => {
    setConfirmOpen(false);
    setPassword("");
  };

  const handleDelete = () => {
    // 소셜 로그인 전용 계정은 비밀번호가 없다. 서버도 같은 기준으로 판단한다.
    if (me?.has_password && !password) {
      toast.error("비밀번호를 입력해 주세요.");
      return;
    }

    withdraw.mutate(
      me?.has_password ? { password } : {},
      {
        onSuccess: () => {
          // 서버가 쿠키를 지웠다. 라우터로 넘기면 죽은 세션으로 대시보드를
          // 한 번 더 그리게 되므로, 통째로 다시 띄워 상태를 비운다.
          window.location.href = "/";
        },
        onError: (err) => {
          toast.error(err?.message || "계정 삭제에 실패했습니다.");
          setPassword("");
        },
      },
    );
  };

  return (
    <Section title="위험 영역" description="복구 불가능한 작업입니다. 신중히 진행하세요.">
      <Card
        variant="outline"
        className="p-5 shadow-[0_0_0_1px_rgb(var(--point-red)/0.3)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-text-main">계정 삭제</div>
            {/*
              좁은 화면에서는 감춘다. 경고를 없애는 것처럼 보이지만 아니다 —
              아래 ConfirmModal이 같은 내용을 다시 띄우고, 그걸 지나야만 실제로
              삭제된다. 즉 경고는 흐름에서 빠지지 않고 "누르기 직전"으로 옮겨진다.
              이 문구를 지울 때는 반드시 그 모달이 살아 있는지 먼저 확인할 것.
            */}
            <p className="hidden sm:block text-[12px] text-text-sub mt-0.5 leading-relaxed">
              모든 챗봇, 대화 로그, 등록된 API 키, 결제수단이 즉시 삭제됩니다. 이
              작업은 되돌릴 수 없습니다. 결제 내역은 법령에 따라 보관됩니다.
            </p>
          </div>
          <Button
            size="sm"
            pill
            variant="danger"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => setConfirmOpen(true)}
          >
            계정 삭제
          </Button>
        </div>
      </Card>

      <ConfirmModal
        open={confirmOpen}
        variant="danger"
        icon={<AlertTriangle className="w-4 h-4 text-point-red" />}
        title="정말로 계정을 삭제할까요?"
        description={
          <div className="flex flex-col gap-3">
            <p>
              모든 챗봇, 대화 로그, 등록된 API 키가 삭제되며 복구할 수 없습니다.
            </p>
            {me?.has_password && (
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 확인"
                autoComplete="current-password"
                // 모달 안이라 Enter로 바로 지워지면 사고가 난다. 버튼만 받는다.
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              />
            )}
          </div>
        }
        confirmLabel={withdraw.isPending ? "삭제 중..." : "계정 삭제"}
        onConfirm={handleDelete}
        onCancel={closeConfirm}
      />
    </Section>
  );
};

/* ── 공통 ────────────────────────────────────── */

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-3">
    <div>
      <h2 className="text-[14px] font-semibold tracking-tight text-text-main">
        {title}
      </h2>
      {description && (
        <p className="text-[12px] text-text-sub mt-1 leading-relaxed">{description}</p>
      )}
    </div>
    {children}
  </section>
);

export default Settings;
