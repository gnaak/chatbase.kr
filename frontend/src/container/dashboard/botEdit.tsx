import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Save,
  Activity,
  MessagesSquare,
  Cpu,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import Topbar from "@/component/dashboard/layout/topbar";
import Button from "@/component/dashboard/ui/button";
import Card from "@/component/dashboard/ui/card";
import ConfirmModal from "@/component/dashboard/ui/confirmModal";
import Field from "@/component/dashboard/ui/field";
import Input from "@/component/dashboard/ui/input";
import Textarea from "@/component/dashboard/ui/textarea";
import Select, { SelectOption } from "@/component/dashboard/ui/select";
import LogoUpload from "@/component/dashboard/ui/logoUpload";
import CodeBlock from "@/component/dashboard/ui/codeBlock";
import ChatPreview from "@/component/dashboard/bot/chatPreview";
import FileLearning from "@/component/dashboard/bot/fileLearning";
import { baseURL, useDelete, useGet, usePatch, usePost } from "@/hooks/common/useAPI";
import { useToast } from "@/hooks/common/useToast";

interface ModelDto {
  value: string;
  label: string;
  provider: "openai" | "anthropic" | "gemini";
  type: "chat" | "image";
}

interface ApiKeyDto {
  provider: "openai" | "anthropic" | "google";
  last4: string;
  registered_at: string | null;
}

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google",
};

// llm_model의 provider('gemini')와 api_key의 provider('google')는 표기가 다름
const MODEL_PROVIDER_TO_KEY: Record<string, string> = {
  openai: "openai",
  anthropic: "anthropic",
  gemini: "google",
};

const PROVIDER_ORDER = ["openai", "anthropic", "gemini"];

type TrainingType = "text" | "file";

interface BotForm {
  name: string;
  logo?: string;
  widgetIcon?: string;
  greeting: string;
  systemPrompt: string;
  trainingData: string;
  trainingType: TrainingType;
  fallback: string;
  model: string;
}

interface BotDto {
  id: string; // slug
  name: string;
  logo: string | null;
  widget_icon: string | null;
  greeting: string | null;
  system_prompt: string | null;
  training_text: string | null;
  training_type: TrainingType;
  fallback: string | null;
  model: string;
  active: boolean;
}

interface BotPayload {
  name: string;
  logo?: string;
  widget_icon?: string;
  greeting?: string;
  system_prompt?: string;
  training_text?: string;
  training_type?: TrainingType;
  fallback?: string;
  model: string;
  active?: boolean;
}

const DEFAULT_FORM: BotForm = {
  name: "",
  logo: undefined,
  widgetIcon: undefined,
  greeting: "",
  systemPrompt: "",
  trainingData: "",
  trainingType: "text",
  fallback: "",
  model: "",
};

const dtoToForm = (dto: BotDto): BotForm => ({
  name: dto.name,
  logo: dto.logo ?? undefined,
  widgetIcon: dto.widget_icon ?? undefined,
  greeting: dto.greeting ?? "",
  systemPrompt: dto.system_prompt ?? "",
  trainingData: dto.training_text ?? "",
  trainingType: dto.training_type === "file" ? "file" : "text",
  fallback: dto.fallback ?? "",
  model: dto.model,
});

const formToPayload = (form: BotForm): BotPayload => ({
  name: form.name,
  logo: form.logo,
  widget_icon: form.widgetIcon,
  greeting: form.greeting,
  system_prompt: form.systemPrompt,
  training_text: form.trainingData,
  training_type: form.trainingType,
  fallback: form.fallback,
  model: form.model,
});

const EMBED_ORIGIN =
  (import.meta.env.VITE_APP_EMBED_ORIGIN as string | undefined) ||
  window.location.origin;

const buildScript = (botId: string) =>
  `<script
  src="${EMBED_ORIGIN}/widget.js"
  data-bot-id="${botId}"
  defer></script>`;

const buildIframe = (botId: string) =>
  `<iframe
  src="${EMBED_ORIGIN}/embed/${botId}"
  width="100%"
  height="640"
  frameborder="0"
  allow="clipboard-write"></iframe>`;

const BotEdit = () => {
  const { slug } = useParams<{ slug?: string }>();
  const isNew = !slug;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState<BotForm>(DEFAULT_FORM);
  const [active, setActive] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [confirmKind, setConfirmKind] = useState<"toggle" | "delete" | null>(null);

  const { data: botDto } = useGet<BotDto>(
    `api/bot/${slug}`,
    ["bot", slug ?? "new"],
    !isNew,
  );

  const { data: sessions } = useGet<{ id: number }[]>(
    `api/chat/sessions?bot_id=${slug}`,
    ["bot-sessions", slug ?? ""],
    !isNew,
  );

  const { data: chatModels } = useGet<ModelDto[]>(
    "api/model/?type=chat",
    ["models", "chat"],
  );

  const { data: registeredKeys } = useGet<ApiKeyDto[]>(
    "api/api-key/",
    ["api-keys"],
  );

  const registeredKeyProviders = useMemo(
    () => new Set<string>((registeredKeys ?? []).map((k) => k.provider)),
    [registeredKeys],
  );

  const isOpenAIModel = useMemo(() => {
    const m = chatModels?.find((x) => x.value === form.model);
    return m?.provider === "openai";
  }, [chatModels, form.model]);

  const modelOptions: SelectOption[] = useMemo(() => {
    const sorted = [...(chatModels ?? [])].sort((a, b) => {
      const ai = PROVIDER_ORDER.indexOf(a.provider);
      const bi = PROVIDER_ORDER.indexOf(b.provider);
      if (ai !== bi) return ai - bi;
      return 0;
    });
    return sorted.map((m) => {
      const keyProvider = MODEL_PROVIDER_TO_KEY[m.provider] ?? m.provider;
      const hasKey = registeredKeyProviders.has(keyProvider);
      const providerLabel = PROVIDER_LABEL[m.provider] ?? m.provider;
      return {
        value: m.value,
        label: hasKey
          ? `${providerLabel} · ${m.label}`
          : `${providerLabel} · ${m.label} (키 미등록)`,
        disabled: !hasKey,
      };
    });
  }, [chatModels, registeredKeyProviders]);

  // 로드된 봇 정보를 폼에 반영
  useEffect(() => {
    if (botDto) {
      setForm(dtoToForm(botDto));
      setActive(botDto.active);
    }
  }, [botDto]);

  const createMutation = usePost<BotPayload, BotDto>("api/bot/");
  const updateMutation = usePatch<BotDto, BotPayload>(`api/bot/${slug ?? ""}`);
  const deleteMutation = useDelete<void>(`api/bot/${slug ?? ""}`);

  const update = <K extends keyof BotForm>(key: K, value: BotForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bots"] });
    if (slug) queryClient.invalidateQueries({ queryKey: ["bot", slug] });
  };

  const uploadPendingFiles = async (targetSlug: string) => {
    if (!pendingFiles.length) return;
    const fd = new FormData();
    pendingFiles.forEach((f) => fd.append("files", f));
    const res = await fetch(`${baseURL}/api/bot/${targetSlug}/files`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) throw new Error(`파일 업로드 실패 (status: ${res.status})`);
    queryClient.invalidateQueries({ queryKey: ["bot-files", targetSlug] });
    setPendingFiles([]);
  };

  const handleSave = async () => {
    const payload = formToPayload(form);
    try {
      if (isNew) {
        const created = await createMutation.mutateAsync(payload);
        if (isOpenAIModel && form.trainingType === "file") {
          await uploadPendingFiles(created.id);
        }
        invalidate();
        toast.success(
          pendingFiles.length
            ? `챗봇 생성 + 파일 ${pendingFiles.length}개 업로드`
            : "챗봇이 생성되었습니다.",
        );
        navigate(`/dashboard/bots/${created.id}`);
      } else {
        await updateMutation.mutateAsync(payload);
        if (isOpenAIModel && form.trainingType === "file" && pendingFiles.length) {
          await uploadPendingFiles(slug!);
        }
        invalidate();
        toast.success("저장되었습니다.");
      }
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || "저장에 실패했습니다.");
      return;
    }
  };

  const handleToggleActive = async () => {
    if (isNew) return;
    const next = !active;
    try {
      await updateMutation.mutateAsync({ ...formToPayload(form), active: next });
      setActive(next);
      invalidate();
      toast.success(next ? "활성화되었습니다." : "비활성화되었습니다.");
    } catch (err) {
      const e = err as { message?: string; status?: number };
      console.error("toggle active failed", e);
      toast.error(e?.message || `변경 실패 (status: ${e?.status ?? "?"})`);
    }
  };

  const handleDelete = async () => {
    if (isNew) return;
    try {
      await deleteMutation.mutateAsync();
      invalidate();
      toast.success("챗봇이 삭제되었습니다.");
      navigate("/dashboard");
    } catch (err) {
      const e = err as { message?: string; status?: number };
      console.error("delete bot failed", e);
      toast.error(e?.message || `삭제 실패 (status: ${e?.status ?? "?"})`);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Topbar
        title={isNew ? "새 챗봇" : form.name || "챗봇"}
        description={
          isNew
            ? "시스템 프롬프트 + 학습 데이터로 챗봇을 만듭니다."
            : "기본 정보, 대화 설정, 학습 데이터를 자유롭게 수정할 수 있습니다."
        }
        backTo="/dashboard"
        actions={
          <Button
            size="sm"
            pill
            leftIcon={<Save className="w-4 h-4" />}
            onClick={handleSave}
            disabled={!form.name.trim() || !form.model || isSaving}
          >
            {isSaving ? "저장 중..." : "저장"}
          </Button>
        }
      />

      <div className="flex-1 relative min-h-0">
        <div className="h-full overflow-y-auto px-8 md:px-12 py-8">
          <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
          {!isNew && (
            <StatsRow
              active={active}
              model={form.model}
              conversations={sessions?.length ?? 0}
            />
          )}

          <Section title="기본 정보">
            <Field
              label="챗봇 아바타"
              description="대화 중 봇 메시지 옆에 표시되는 아이콘입니다. 비워두면 기본 봇 아이콘이 표시됩니다."
            >
              <LogoUpload
                value={form.logo}
                onChange={(dataUrl) => update("logo", dataUrl)}
              />
            </Field>

            <Field
              label="위젯 버블 아이콘"
              description="사이트 우측 하단에 떠있는 동그란 버튼에 사용됩니다. 비워두면 기본 메시지 아이콘이 표시됩니다."
            >
              <LogoUpload
                value={form.widgetIcon}
                onChange={(dataUrl) => update("widgetIcon", dataUrl)}
              />
            </Field>

            <Field
              label="챗봇 이름"
              htmlFor="bot-name"
              required
              description="대시보드 + 임베드 위젯 헤더에 표시됩니다."
            >
              <Input
                id="bot-name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="예: 고객지원 봇"
              />
            </Field>

            <Field
              label="모델"
              description="응답에 사용할 LLM. 키는 API 키 페이지에서 등록하세요."
            >
              <Select
                value={form.model}
                onChange={(v) => update("model", v)}
                options={modelOptions}
                placeholder="모델을 선택하세요"
              />
            </Field>
          </Section>

          <Section title="대화 설정">
            <Field
              label="인사 메시지"
              description="대화를 처음 열었을 때 봇이 먼저 보내는 메시지."
            >
              <Input
                value={form.greeting}
                onChange={(e) => update("greeting", e.target.value)}
                placeholder="안녕하세요! 무엇을 도와드릴까요?"
              />
            </Field>

            <Field
              label="시스템 프롬프트"
              description="페르소나, 톤, 답변 규칙을 정의합니다."
            >
              <Textarea
                rows={5}
                value={form.systemPrompt}
                onChange={(e) => update("systemPrompt", e.target.value)}
                placeholder="당신은 ~~~ 어시스턴트입니다."
              />
            </Field>

            <Field
              label="Fallback 메시지"
              description="학습 데이터에 없는 질문일 때 사용할 응답."
            >
              <Input
                value={form.fallback}
                onChange={(e) => update("fallback", e.target.value)}
                placeholder="죄송합니다, 해당 내용은 제가 가진 정보에 포함되어 있지 않습니다."
              />
            </Field>
          </Section>

          <Section
            title="학습 데이터"
            description="자주 묻는 질문, 회사/제품 설명, 정책 등을 자유롭게 입력하거나 파일로 업로드하세요."
          >
            {isOpenAIModel && (
              <div className="inline-flex items-center gap-1 p-1 rounded-full bg-bg-sub shadow-border w-fit">
                {(["text", "file"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => update("trainingType", tab)}
                    className={[
                      "h-7 px-3.5 rounded-full text-[12px] font-medium transition-colors",
                      form.trainingType === tab
                        ? "bg-bg-card text-text-main shadow-border"
                        : "text-text-sub hover:text-text-main",
                    ].join(" ")}
                  >
                    {tab === "text" ? "텍스트" : "파일"}
                  </button>
                ))}
              </div>
            )}

            {(!isOpenAIModel || form.trainingType === "text") && (
              <Field
                label="학습 텍스트"
                description="짧은 FAQ나 가이드는 직접 입력하는 편이 빠릅니다."
              >
                <Textarea
                  rows={10}
                  value={form.trainingData}
                  onChange={(e) => update("trainingData", e.target.value)}
                  placeholder={`Q. 영업시간이 어떻게 되나요?\nA. 평일 오전 10시 ~ 오후 7시입니다.\n\nQ. 환불 정책은 어떻게 되나요?\nA. ...`}
                />
              </Field>
            )}

            {isOpenAIModel && form.trainingType === "file" && (
              <Field
                label="파일 업로드"
                description="긴 문서(PDF, DOCX 등)는 저장 시 OpenAI vector store에 일괄 업로드됩니다."
              >
                <FileLearning
                  slug={slug}
                  isOpenAIModel={true}
                  pending={pendingFiles}
                  onPendingChange={setPendingFiles}
                />
              </Field>
            )}
          </Section>

          {!isNew && (
            <Section
              title="임베드 코드"
              description="아래 코드를 자기 사이트의 </body> 직전에 붙여넣으세요."
            >
              <EmbedTabs botId={slug!} />
            </Section>
          )}

          {!isNew && (
            <Section
              title="운영"
              description="봇의 활성 상태와 삭제를 관리합니다."
            >
              <Card variant="outline" className="p-5 flex flex-col gap-3">
                <Row
                  title={active ? "이 봇을 비활성화" : "이 봇을 활성화"}
                  description={
                    active
                      ? "비활성화하면 임베드 위젯에서 응답이 중단됩니다."
                      : "활성화하면 즉시 임베드 위젯에서 응답을 시작합니다."
                  }
                  action={
                    <Button
                      size="sm"
                      pill
                      variant={active ? "secondary" : "primary"}
                      leftIcon={
                        active ? (
                          <PowerOff className="w-3.5 h-3.5" />
                        ) : (
                          <Power className="w-3.5 h-3.5" />
                        )
                      }
                      onClick={() => setConfirmKind("toggle")}
                      disabled={updateMutation.isPending}
                    >
                      {active ? "비활성화" : "활성화"}
                    </Button>
                  }
                />
                <div className="border-t border-line" />
                <Row
                  title="이 봇을 삭제"
                  description="삭제하면 대화 로그를 포함한 모든 데이터가 즉시 사라집니다. 복구할 수 없습니다."
                  action={
                    <Button
                      size="sm"
                      pill
                      variant="danger"
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => setConfirmKind("delete")}
                      disabled={deleteMutation.isPending}
                    >
                      삭제
                    </Button>
                  }
                />
              </Card>
            </Section>
          )}
          </div>
        </div>

        {/* 라이브 미리보기 */}
        <div className="hidden lg:block absolute bottom-6 right-6 w-[480px] h-[760px] z-40 pointer-events-none">
          <div className="h-full">
            <ChatPreview
              botName={form.name}
              greeting={form.greeting}
              fallback={form.fallback}
              logo={form.logo}
              widgetIcon={form.widgetIcon}
              slug={slug}
              model={form.model}
              systemPrompt={form.systemPrompt}
              trainingData={form.trainingData}
            />
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmKind === "toggle"}
        title={active ? "이 봇을 비활성화할까요?" : "이 봇을 활성화할까요?"}
        description={
          active
            ? "비활성화하면 임베드 위젯에서 응답이 즉시 중단됩니다."
            : "활성화하면 임베드 위젯에서 즉시 응답을 시작합니다."
        }
        confirmLabel={active ? "비활성화" : "활성화"}
        onConfirm={() => {
          setConfirmKind(null);
          handleToggleActive();
        }}
        onCancel={() => setConfirmKind(null)}
      />

      <ConfirmModal
        open={confirmKind === "delete"}
        variant="danger"
        title="이 봇을 삭제할까요?"
        description="대화 로그를 포함한 모든 데이터가 즉시 사라집니다. 복구할 수 없습니다."
        confirmLabel="삭제"
        onConfirm={() => {
          setConfirmKind(null);
          handleDelete();
        }}
        onCancel={() => setConfirmKind(null)}
      />
    </>
  );
};

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-4">
    <div>
      <h2 className="text-[14px] font-semibold tracking-tight text-text-main">
        {title}
      </h2>
      {description && (
        <p className="text-[12px] text-text-sub mt-1 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    <div className="flex flex-col gap-5">{children}</div>
  </section>
);

const StatsRow = ({
  active,
  conversations,
  model,
}: {
  active: boolean;
  conversations: number;
  model: string;
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <StatCard
      icon={<Activity className="w-4 h-4" />}
      label="상태"
      value={
        <span className="inline-flex items-center gap-1.5">
          <span
            className={[
              "w-1.5 h-1.5 rounded-full",
              active ? "bg-point-green" : "bg-text-disabled",
            ].join(" ")}
          />
          {active ? "활성" : "비활성"}
        </span>
      }
    />
    <StatCard
      icon={<MessagesSquare className="w-4 h-4" />}
      label="누적 대화"
      value={conversations.toLocaleString()}
    />
    <StatCard
      icon={<Cpu className="w-4 h-4" />}
      label="모델"
      value={<span className="font-mono text-[13px]">{model}</span>}
    />
  </div>
);

const StatCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) => (
  <Card variant="outline" className="px-4 py-3.5 flex flex-col gap-1.5">
    <div className="flex items-center gap-1.5 text-text-sub">
      {icon}
      <span className="text-[11px] font-medium uppercase tracking-tight">
        {label}
      </span>
    </div>
    <div className="text-[18px] font-semibold tracking-tight text-text-main">
      {value}
    </div>
  </Card>
);

const Row = ({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) => (
  <div className="flex items-start justify-between gap-4">
    <div className="min-w-0">
      <div className="text-[13px] font-medium text-text-main">{title}</div>
      <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
        {description}
      </p>
    </div>
    <div className="shrink-0">{action}</div>
  </div>
);

interface TabItem {
  key: string;
  label: string;
  hint?: string;
  code: string;
  language?: string;
}

const EmbedTabs = ({ botId }: { botId: string }) => {
  const tabs: TabItem[] = [
    {
      key: "script",
      label: "Script (권장)",
      hint: "우측 하단에 채팅 버블이 자동 생성됩니다.",
      code: buildScript(botId),
      language: "html",
    },
    {
      key: "iframe",
      label: "iframe",
      hint: "페이지 안에 채팅창을 직접 박을 때 사용합니다.",
      code: buildIframe(botId),
      language: "html",
    },
  ];

  const [active, setActive] = useState(tabs[0].key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-bg-sub shadow-border w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={[
              "h-7 px-3.5 rounded-full text-[12px] font-medium transition-colors",
              active === tab.key
                ? "bg-bg-card text-text-main shadow-border"
                : "text-text-sub hover:text-text-main",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {current.hint && (
        <p className="text-[12px] text-text-sub leading-relaxed">
          {current.hint}
        </p>
      )}
      <CodeBlock code={current.code} language={current.language} />
    </div>
  );
};

export default BotEdit;
