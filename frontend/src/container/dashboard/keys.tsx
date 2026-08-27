import { useMemo, useState } from "react";
import { Eye, EyeOff, Check, KeyRound, Pencil, Trash2, ExternalLink, BookOpen, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Topbar from "@/component/dashboard/layout/topbar";
import Button from "@/component/dashboard/ui/button";
import Card from "@/component/dashboard/ui/card";
import Input from "@/component/dashboard/ui/input";
import Skeleton from "@/component/dashboard/ui/skeleton";
import { useGet, usePost } from "@/hooks/common/useAPI";
import { useToast } from "@/hooks/common/useToast";
import ConfirmModal from "@/component/dashboard/ui/confirmModal";

type Provider = "openai" | "anthropic" | "google";

interface ProviderInfo {
  id: Provider;
  name: string;
  description: string;
  prefix: string;
  docsUrl: string;
  models: { value: string; label: string }[];
}

interface ProviderMeta {
  id: Provider;
  name: string;
  description: string;
  prefix: string;
  docsUrl: string;
}

// 정적 메타데이터(가입/문서 URL 등). 모델 목록은 카탈로그에서 동적으로 채움.
const PROVIDER_META: ProviderMeta[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT 시리즈 모델을 사용합니다.",
    prefix: "sk-",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude 시리즈 모델을 사용합니다.",
    prefix: "sk-ant-",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "google",
    name: "Google",
    description: "Gemini 시리즈 모델을 사용합니다.",
    prefix: "AIza",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
];

interface ModelDto {
  value: string;
  label: string;
  provider: "openai" | "anthropic" | "gemini";
  type: "chat" | "image";
}

// llm_model의 'gemini' ↔ api_key의 'google' 매핑
const MODEL_PROVIDER_TO_KEY: Record<string, Provider> = {
  openai: "openai",
  anthropic: "anthropic",
  gemini: "google",
};

interface KeyState {
  last4?: string;
  registeredAt?: string;
}

interface ApiKeyDto {
  provider: Provider;
  last4: string;
  registered_at: string | null;
  updated_at: string | null;
}

const KEYS_QUERY_KEY = ["api-keys"];

const Keys = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: keysList, isLoading: keysLoading } = useGet<ApiKeyDto[]>(
    "api/api-key/",
    KEYS_QUERY_KEY,
  );
  const { data: chatModels, isLoading: modelsLoading } = useGet<ModelDto[]>(
    "api/model/?type=chat",
    ["models", "chat"],
  );

  const providers: ProviderInfo[] = useMemo(() => {
    const byProvider: Record<Provider, { value: string; label: string }[]> = {
      openai: [],
      anthropic: [],
      google: [],
    };
    (chatModels ?? []).forEach((m) => {
      const key = MODEL_PROVIDER_TO_KEY[m.provider];
      if (key) byProvider[key].push({ value: m.value, label: m.label });
    });
    return PROVIDER_META.map((meta) => ({
      ...meta,
      models: byProvider[meta.id],
    }));
  }, [chatModels]);

  const upsertMutation = usePost<
    { provider: Provider; key: string },
    ApiKeyDto
  >("api/api-key/");

  const deleteMutation = usePost<{ provider: Provider }, void>(
    "api/api-key/delete",
  );

  const keys = useMemo<Record<Provider, KeyState>>(() => {
    const map: Record<Provider, KeyState> = {
      openai: {},
      anthropic: {},
      google: {},
    };
    (keysList ?? []).forEach((k) => {
      map[k.provider] = {
        last4: k.last4,
        registeredAt: k.registered_at
          ? new Date(k.registered_at).toLocaleString("ko-KR")
          : undefined,
      };
    });
    return map;
  }, [keysList]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: KEYS_QUERY_KEY });

  const handleSave = (provider: Provider, plainKey: string) => {
    upsertMutation.mutate(
      { provider, key: plainKey },
      {
        onSuccess: () => {
          invalidate();
          toast.success(`${provider} 키가 등록되었습니다.`);
        },
        onError: (err) => toast.error(err?.message || "키 등록에 실패했습니다."),
      },
    );
  };

  const handleRemove = (provider: Provider) => {
    deleteMutation.mutate(
      { provider },
      {
        onSuccess: () => {
          invalidate();
          toast.success(`${provider} 키가 삭제되었습니다.`);
        },
        onError: (err) => toast.error(err?.message || "키 삭제에 실패했습니다."),
      },
    );
  };

  return (
    <>
      <Topbar
        title="API 키"
        description="사용할 모델 제공자의 API 키를 직접 등록합니다 (BYOK)."
      />

      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        <div className="flex flex-col gap-4 max-w-4xl mx-auto">
          <Notice />
          <KeyGuide />
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              state={keys[provider.id]}
              keyLoading={keysLoading}
              modelsLoading={modelsLoading}
              onSave={(plain) => handleSave(provider.id, plain)}
              onRemove={() => handleRemove(provider.id)}
            />
          ))}
        </div>
      </div>
    </>
  );
};

interface GuideStep {
  /** 이 단계에서 실제로 하는 일. 굵은 첫 줄. */
  action: string;
  /** 어디서 하는지 · 무엇을 주의할지. 옅은 둘째 줄. */
  detail: string;
}

/** 마지막 "등록" 단계는 provider마다 문구가 같아서 렌더링 시점에 붙인다. */
const GUIDE_STEPS: { provider: ProviderMeta; steps: GuideStep[] }[] = [
  {
    provider: PROVIDER_META[0],
    steps: [
      { action: "로그인", detail: "platform.openai.com" },
      { action: "API keys 열기", detail: "우측 상단 프로필 메뉴" },
      { action: "Create new secret key", detail: "생성 직후 한 번만 보이니 바로 복사" },
    ],
  },
  {
    provider: PROVIDER_META[1],
    steps: [
      { action: "로그인", detail: "console.anthropic.com" },
      { action: "API Keys 열기", detail: "좌측 사이드바 메뉴" },
      { action: "Create Key", detail: "생성 직후 한 번만 보이니 바로 복사" },
    ],
  },
  {
    provider: PROVIDER_META[2],
    steps: [
      { action: "로그인", detail: "aistudio.google.com" },
      { action: "Get API key 열기", detail: "좌측 사이드바 메뉴" },
      { action: "Create API key", detail: "프로젝트를 고르면 바로 발급된다" },
    ],
  },
];

const KeyGuide = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-comfy bg-bg-card shadow-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-text-sub" />
          <span className="text-[14px] font-medium text-text-main">
            API 키 발급 방법
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-text-sub transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-line grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
          {GUIDE_STEPS.map(({ provider, steps }) => (
            <div key={provider.id} className="flex flex-col gap-3 px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-text-main">
                  {provider.name}
                </span>
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-text-sub hover:text-text-main transition-colors"
                >
                  키 발급 페이지
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ol className="flex flex-col gap-2.5">
                {[
                  ...steps,
                  {
                    action: "아래 카드에 등록",
                    detail: `${provider.prefix} 로 시작하는 값`,
                  },
                ].map((step, i) => (
                  <li key={step.action} className="flex items-start gap-2.5">
                    <span className="shrink-0 mt-px font-mono text-[10px] tabular-nums text-text-sub/50">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex flex-col gap-0.5">
                      <span className="text-[12px] font-medium leading-snug text-text-main">
                        {step.action}
                      </span>
                      <span className="text-[11px] leading-relaxed text-text-sub">
                        {step.detail}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Notice = () => (
  <div className="flex items-start gap-3 p-4 rounded-comfy bg-info-bg shadow-border">
    <KeyRound className="w-4 h-4 mt-0.5 shrink-0 text-info" />
    <div className="text-[13px] leading-relaxed text-text-main">
      <p className="font-medium mb-0.5">키는 사용자 본인 계정으로 호출됩니다 (BYOK).</p>
      <p className="text-text-sub">
        등록된 키는 암호화되어 저장되며, 챗봇 응답 시에만 사용됩니다. 키 사용량 및
        과금은 각 제공자 계정에서 직접 관리됩니다.
      </p>
    </div>
  </div>
);

interface ProviderCardProps {
  provider: ProviderInfo;
  state: KeyState;
  /** 키 등록 여부를 아직 모르는 상태. 등록/미등록 UI 대신 스켈레톤을 그린다. */
  keyLoading: boolean;
  /** 모델 카탈로그 로딩 중. 모델 칩 자리를 미리 잡아둔다. */
  modelsLoading: boolean;
  onSave: (plain: string) => void;
  onRemove: () => void;
}

const ProviderCard = ({
  provider,
  state,
  keyLoading,
  modelsLoading,
  onSave,
  onRemove,
}: ProviderCardProps) => {
  const [editing, setEditing] = useState(false);
  const [plain, setPlain] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isRegistered = !!state.last4;

  const commitSave = (value: string) => {
    onSave(value);
    setPlain("");
    setEditing(false);
    setShowKey(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = plain.trim();
    if (!value) return;
    if (!value.startsWith(provider.prefix)) {
      setConfirmOpen(true);
      return;
    }
    commitSave(value);
  };

  const handleCancel = () => {
    setPlain("");
    setEditing(false);
    setShowKey(false);
  };

  return (
    <Card variant="outline" className="p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[15px] font-semibold tracking-tight text-text-main">
              {provider.name}
            </h3>
            {keyLoading ? (
              <Skeleton className="h-5 w-16 rounded-full" />
            ) : (
              isRegistered && (
                <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full bg-success-bg text-success text-[11px] font-medium">
                  <Check className="w-3 h-3" />
                  등록됨
                </span>
              )
            )}
          </div>
          <p className="text-[12px] text-text-sub leading-relaxed mb-2">
            {provider.description}
          </p>
          {modelsLoading ? (
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
          ) : (
            provider.models.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {provider.models.map((model) => (
                  <span
                    key={model.value}
                    className="font-mono text-[11px] text-text-sub bg-bg-sub shadow-border px-1.5 h-5 inline-flex items-center rounded-DEFAULT"
                  >
                    {model.label}
                  </span>
                ))}
              </div>
            )
          )}
        </div>
        <a
          href={provider.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="
            shrink-0 inline-flex items-center gap-1 text-[12px] text-text-sub
            hover:text-text-main transition-colors
          "
        >
          키 발급
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* 등록 여부를 모르는 동안 "키 등록" 버튼을 먼저 그리면 등록된 키가 있는 사용자에게
          버튼 → 마스킹된 키로 뒤집히는 깜빡임이 보인다. 그래서 같은 높이의 스켈레톤으로 대신한다. */}
      {!editing && keyLoading && (
        <Skeleton className="h-10 w-full rounded-DEFAULT" />
      )}

      {!editing && !keyLoading && isRegistered && (
        <div className="flex items-center justify-between gap-3 px-3 h-10 rounded-DEFAULT bg-bg-sub shadow-border">
          <div className="flex items-center gap-2 min-w-0 font-mono text-[12px] text-text-main">
            <span>{provider.prefix}</span>
            <span className="text-text-sub">{"•".repeat(20)}</span>
            <span>{state.last4}</span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="키 변경"
              title="키 변경"
              className="
                inline-flex items-center justify-center w-7 h-7 rounded-full
                text-text-sub hover:text-text-main
                hover:bg-bg-hover active:bg-bg-active
                transition-colors duration-150
                focus:outline-none focus-visible:shadow-focus
              "
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label="키 삭제"
              title="키 삭제"
              className="
                inline-flex items-center justify-center w-7 h-7 rounded-full
                text-text-sub hover:text-point-red
                hover:bg-bg-hover active:bg-bg-active
                transition-colors duration-150
                focus:outline-none focus-visible:shadow-focus
              "
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {!editing && !keyLoading && !isRegistered && (
        <div className="flex justify-end">
          <Button size="sm" pill onClick={() => setEditing(true)}>
            키 등록
          </Button>
        </div>
      )}

      {editing && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            type={showKey ? "text" : "password"}
            value={plain}
            onChange={(e) => setPlain(e.target.value)}
            placeholder={`${provider.prefix}...`}
            autoFocus
            rightIcon={
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="text-text-sub hover:text-text-main"
                aria-label={showKey ? "키 숨기기" : "키 표시"}
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            }
          />
          <p className="text-[11px] text-text-sub">
            키는 한 번만 입력하면 다시 표시되지 않습니다. 변경 시 새 키로 덮어씁니다.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={handleCancel}
              className="hover:!bg-transparent"
            >
              취소
            </Button>
            <Button size="sm" type="submit" pill disabled={!plain.trim()}>
              저장
            </Button>
          </div>
        </form>
      )}

      {state.registeredAt && !editing && (
        <p className="text-[11px] text-text-sub mt-3 font-mono">
          등록: {state.registeredAt}
        </p>
      )}

      <ConfirmModal
        open={confirmOpen}
        title="키 형식이 다른 것 같아요"
        description={
          <>
            {provider.name} 키는 보통{" "}
            <span className="font-mono text-text-main">{provider.prefix}</span>
            로 시작합니다. 그래도 저장할까요?
          </>
        }
        confirmLabel="저장"
        cancelLabel="다시 입력"
        onConfirm={() => {
          setConfirmOpen(false);
          commitSave(plain.trim());
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </Card>
  );
};

export default Keys;
