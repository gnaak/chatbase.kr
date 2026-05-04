import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, Trash2, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Topbar from "@/component/dashboard/layout/topbar";
import Button from "@/component/dashboard/ui/button";
import Card from "@/component/dashboard/ui/card";
import Field from "@/component/dashboard/ui/field";
import Input from "@/component/dashboard/ui/input";
import { useTheme } from "@/hooks/common/useTheme";
import type { Theme } from "@/context/ThemeProvider";
import { useGet, usePatch } from "@/hooks/common/useAPI";
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
  const { data: me } = useGet<MeDto>("api/user/me", ME_QUERY_KEY);
  const updateMe = usePatch<MeDto, UpdateMePayload>("api/user/me");

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

  const handleSavePassword = () => {
    if (!newPw || newPw !== confirmPw) {
      toast.error("새 비밀번호와 확인이 일치하지 않습니다.");
      return;
    }
    // TODO: 비밀번호 변경 API (Phase 후속)
    toast.info("비밀번호 변경 API는 추후 지원될 예정입니다.");
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setPwOpen(false);
  };

  return (
    <Section title="프로필" description="계정 이름과 이메일을 관리합니다.">
      <Card variant="outline" className="p-5 flex flex-col gap-5">
        <Field label="이름" htmlFor="profile-name">
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field
          label="이메일"
          description="이메일 변경은 고객센터를 통해서만 가능합니다."
        >
          <Input value={me?.email ?? ""} disabled />
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
                  <Button size="sm" pill onClick={handleSavePassword}>
                    저장
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPwOpen(false);
                      setCurrentPw("");
                      setNewPw("");
                      setConfirmPw("");
                    }}
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
            disabled={updateMe.isPending}
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

  const handleDelete = () => {
    const ok = window.confirm(
      "정말로 계정을 삭제할까요? 모든 챗봇, 대화 로그, 워크스페이스 데이터가 사라지며 복구할 수 없습니다.",
    );
    if (!ok) return;
    // TODO: 계정 삭제 API
    toast.info("계정 삭제 API는 추후 지원될 예정입니다.");
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
            <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
              모든 챗봇, 대화 로그, 등록된 API 키, 결제 정보가 즉시 삭제됩니다. 이
              작업은 되돌릴 수 없습니다.
            </p>
          </div>
          <Button
            size="sm"
            pill
            variant="danger"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={handleDelete}
          >
            계정 삭제
          </Button>
        </div>
      </Card>
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
