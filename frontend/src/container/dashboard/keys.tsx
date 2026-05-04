import { useMemo, useState } from "react";
import { Eye, EyeOff, Check, KeyRound, Trash2, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Topbar from "@/component/dashboard/layout/topbar";
import Button from "@/component/dashboard/ui/button";
import Card from "@/component/dashboard/ui/card";
import Input from "@/component/dashboard/ui/input";
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
  models: string[];
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4o-mini 등 OpenAI의 모델을 사용합니다.",
    prefix: "sk-",
    docsUrl: "https://platform.openai.com/api-keys",
    models: ["gpt-4o-mini", "gpt-4o"],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude Haiku, Sonnet, Opus 등 Anthropic의 Claude 모델을 사용합니다.",
    prefix: "sk-ant-",
    docsUrl: "https://console.anthropic.com/settings/keys",
    models: ["claude-haiku", "claude-sonnet"],
  },
  {
    id: "google",
    name: "Google",
    description: "Gemini 1.5 Flash / Pro 등 Google의 Gemini 모델을 사용합니다.",
    prefix: "AIza",
    docsUrl: "https://aistudio.google.com/app/apikey",
    models: ["gemini-1.5-flash", "gemini-1.5-pro"],
  },
];

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
  const { data: keysList } = useGet<ApiKeyDto[]>("api/api-key/", KEYS_QUERY_KEY);

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
          {PROVIDERS.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              state={keys[provider.id]}
              onSave={(plain) => handleSave(provider.id, plain)}
              onRemove={() => handleRemove(provider.id)}
            />
          ))}
        </div>
      </div>
    </>
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
  onSave: (plain: string) => void;
  onRemove: () => void;
}

const ProviderCard = ({ provider, state, onSave, onRemove }: ProviderCardProps) => {
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
            {isRegistered && (
              <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full bg-success-bg text-success text-[11px] font-medium">
                <Check className="w-3 h-3" />
                등록됨
              </span>
            )}
          </div>
          <p className="text-[12px] text-text-sub leading-relaxed mb-2">
            {provider.description}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {provider.models.map((model) => (
              <span
                key={model}
                className="font-mono text-[11px] text-text-sub bg-bg-sub shadow-border px-1.5 h-5 inline-flex items-center rounded-DEFAULT"
              >
                {model}
              </span>
            ))}
          </div>
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

      {!editing && isRegistered && (
        <div className="flex items-center justify-between gap-3 px-3 h-10 rounded-DEFAULT bg-bg-sub shadow-border">
          <div className="flex items-center gap-2 min-w-0 font-mono text-[12px] text-text-main">
            <span>{provider.prefix}</span>
            <span className="text-text-sub">{"•".repeat(20)}</span>
            <span>{state.last4}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" pill variant="secondary" onClick={() => setEditing(true)}>
              변경
            </Button>
            <Button
              size="sm"
              pill
              variant="ghost"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={onRemove}
              className="text-text-sub hover:text-point-red"
            >
              삭제
            </Button>
          </div>
        </div>
      )}

      {!editing && !isRegistered && (
        <Button size="sm" pill onClick={() => setEditing(true)}>
          키 등록
        </Button>
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
          <div className="flex items-center gap-2">
            <Button size="sm" type="submit" pill disabled={!plain.trim()}>
              저장
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={handleCancel}>
              취소
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
