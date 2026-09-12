import { useMemo, useState } from "react";
import { Eye, EyeOff, Check, KeyRound, Pencil, Trash2, ExternalLink, BookOpen, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Topbar from "@/component/layout/topbar";
import Button from "@/ui/button";
import Card from "@/ui/card";
import Input from "@/ui/input";
import Skeleton from "@/ui/skeleton";
import { useGet, usePatch, usePost } from "@/hooks/common/useAPI";
import { useToast } from "@/hooks/common/useToast";
import ConfirmModal from "@/ui/confirmModal";

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

/** 사용자가 **등록한** 키. 제공 키는 여기 안 들어온다(`serviceKey` 로 따로 다룬다). */
interface KeyState {
  last4?: string;
  registeredAt?: string;
}

interface ApiKeyDto {
  provider: Provider;
  /** 제공 키는 뒷자리를 안 준다(알 필요가 없고, 계정마다 같은 값이라 알려줄 것도 없다). */
  last4: string | null;
  registered_at: string | null;
  updated_at: string | null;
  source?: "own" | "service";
  model?: string | null;
  /** 지금 실제로 쓰이는 쪽인가. OpenAI 만 제공 키와 경쟁한다. */
  selected?: boolean;
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

  /**
   * 제공 키 / 내 키 선택. 봇이 아니라 **계정** 단위라 사용자 설정으로 저장한다.
   * (usePatch 는 usePost 와 반대로 <응답, 요청> 순서다.)
   */
  const chooseMutation = usePatch<unknown, { use_service_key: boolean }>(
    "api/user/me",
  );

  const choose = (useService: boolean) =>
    chooseMutation.mutate(
      { use_service_key: useService },
      {
        onSuccess: () => {
          invalidate();
          toast.success(
            useService
              ? "무료 제공 키를 사용합니다."
              : "등록한 내 키를 사용합니다.",
          );
        },
        onError: (err) =>
          toast.error(err?.message || "변경에 실패했습니다."),
      },
    );

  const allKeys = useMemo(() => keysList ?? [], [keysList]);

  /**
   * 제공 키(우리가 내주는 것). DB 에 없고 서버가 응답에서 합성해 준다.
   * 본인 OpenAI 키와 **공존**하므로 `keys` 맵에 못 담는다 — 그 맵은 provider 당
   * 하나라서 덮어써진다.
   */
  const serviceKey = useMemo(
    () => allKeys.find((k) => k.source === "service"),
    [allKeys],
  );

  const keys = useMemo<Record<Provider, KeyState>>(() => {
    const map: Record<Provider, KeyState> = {
      openai: {},
      anthropic: {},
      google: {},
    };
    allKeys.forEach((k) => {
      if (k.source === "service") return; // 위 serviceKey 로 따로 다룬다
      map[k.provider] = {
        last4: k.last4 ?? undefined,
        registeredAt: k.registered_at
          ? new Date(k.registered_at).toLocaleString("ko-KR")
          : undefined,
      };
    });
    return map;
  }, [allKeys]);

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
        description="OpenAI는 무료로 제공됩니다. 내 키를 등록해 바꿀 수도 있습니다."
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
              service={provider.id === "openai" ? serviceKey : undefined}
              onChoose={provider.id === "openai" ? choose : undefined}
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
      <p className="font-medium mb-0.5">
        OpenAI는 키 없이 바로 쓸 수 있습니다. 사용량은 저희가 부담합니다.
      </p>
      <p className="text-text-sub">
        Anthropic·Google 모델과 파일 학습·웹 검색은 본인 키가 필요합니다. 등록한
        키는 암호화되어 저장되고 챗봇 응답 시에만 쓰이며, 그 사용량과 과금은 각
        제공자 계정에서 직접 관리됩니다.
      </p>
    </div>
  </div>
);

interface ProviderCardProps {
  provider: ProviderInfo;
  state: KeyState;
  /**
   * 이 provider 에 걸린 제공 키(우리가 내주는 것). 지금은 OpenAI 에만 온다.
   * 본인 키와 **공존**하므로 `state` 와 별개로 받는다 — `state` 는 provider 당
   * 하나라서 둘을 같이 담을 수 없다.
   */
  service?: ApiKeyDto;
  /** 제공/내 키 선택. 없으면 선택 UI 를 안 그린다. */
  onChoose?: (useService: boolean) => void;
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
  service,
  onChoose,
  keyLoading,
  modelsLoading,
  onSave,
  onRemove,
}: ProviderCardProps) => {
  const [editing, setEditing] = useState(false);
  const [plain, setPlain] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasOwn = !!state.last4;
  // 제공 키가 지금 쓰이는 중인가. 본인 키가 같이 등록돼 있어도 참일 수 있다.
  const usingService = !!service?.selected;
  // 제공 키는 last4 가 없다. 그것만 보면 '미등록'으로 그려진다.
  const isRegistered = hasOwn || !!service;
  // 선택지가 둘인 provider 는 선택 블록이 등록·변경 입구까지 겸한다.
  const choosable = !!service && !!onChoose;

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
              (usingService ? (
                <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full bg-info-bg text-info text-[11px] font-medium">
                  무료 제공 중
                </span>
              ) : hasOwn ? (
                <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full bg-success-bg text-success text-[11px] font-medium">
                  <Check className="w-3 h-3" />
                  {choosable ? "내 키 사용 중" : "등록됨"}
                </span>
              ) : null)
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

      {/* 제공 키 / 내 키 선택.
          제공 키는 뒷자리도 삭제 버튼도 없다 — 우리 키라 사용자가 지울 것이 아니다.
          대신 각 줄에 '무엇이 열리는지'를 적어서 등록 동기가 되게 한다.

          줄을 통째로 <button> 으로 감싸면 변경·삭제 버튼이 버튼 안의 버튼이 돼서
          HTML 이 깨진다. 그래서 줄은 div 이고, 고르는 영역만 button 이다. */}
      {!editing && !keyLoading && choosable && (
        <div className="flex flex-col gap-1.5">
          <div
            className={[
              "flex items-start gap-2.5 px-3 py-2.5 rounded-DEFAULT shadow-border transition-colors",
              usingService ? "bg-bg-sub" : "hover:bg-bg-hover",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={() => onChoose!(true)}
              aria-pressed={usingService}
              className="flex items-start gap-2.5 min-w-0 flex-1 text-left focus:outline-none focus-visible:shadow-focus rounded-DEFAULT"
            >
              <Check
                className={[
                  "w-3.5 h-3.5 mt-0.5 shrink-0",
                  usingService ? "text-success" : "text-transparent",
                ].join(" ")}
              />
              <span className="min-w-0">
                <span className="flex items-baseline gap-1.5 flex-wrap text-[12.5px] text-text-main">
                  무료 제공
                  {service!.model && (
                    <span className="font-mono text-[11px] text-text-sub">
                      {service!.model}
                    </span>
                  )}
                </span>
                <span className="block mt-0.5 text-[11px] text-text-sub leading-relaxed">
                  키 등록 없이 바로 쓸 수 있어요. 사용료는 저희가 냅니다. 모델은
                  이 하나로 고정됩니다.
                </span>
              </span>
            </button>
          </div>

          <div
            className={[
              "flex items-start gap-2.5 px-3 py-2.5 rounded-DEFAULT shadow-border transition-colors",
              !usingService && hasOwn ? "bg-bg-sub" : "hover:bg-bg-hover",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={() => (hasOwn ? onChoose!(false) : setEditing(true))}
              aria-pressed={!usingService && hasOwn}
              className="flex items-start gap-2.5 min-w-0 flex-1 text-left focus:outline-none focus-visible:shadow-focus rounded-DEFAULT"
            >
              <Check
                className={[
                  "w-3.5 h-3.5 mt-0.5 shrink-0",
                  !usingService && hasOwn ? "text-success" : "text-transparent",
                ].join(" ")}
              />
              <span className="min-w-0">
                <span className="flex items-baseline gap-1.5 flex-wrap text-[12.5px] text-text-main">
                  내 키 사용
                  {hasOwn ? (
                    <span className="font-mono text-[11px] text-text-sub">
                      {provider.prefix}
                      {"•".repeat(6)}
                      {state.last4}
                    </span>
                  ) : (
                    <span className="text-[11px] text-text-sub">등록 필요</span>
                  )}
                </span>
                <span className="block mt-0.5 text-[11px] text-text-sub leading-relaxed">
                  모델을 직접 고르고, 파일 학습과 웹 검색을 쓸 수 있어요.
                </span>
              </span>
            </button>
            {hasOwn && (
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
            )}
          </div>
        </div>
      )}

      {!editing && !keyLoading && hasOwn && !choosable && (
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
