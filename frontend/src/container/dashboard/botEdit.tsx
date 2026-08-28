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
  X,
} from "lucide-react";
import Topbar from "@/component/dashboard/layout/topbar";
import Button from "@/component/dashboard/ui/button";
import Card from "@/component/dashboard/ui/card";
import ConfirmModal from "@/component/dashboard/ui/confirmModal";
import Field from "@/component/dashboard/ui/field";
import Input from "@/component/dashboard/ui/input";
import Textarea from "@/component/dashboard/ui/textarea";
import Select, { SelectOption } from "@/component/dashboard/ui/select";
import Skeleton from "@/component/dashboard/ui/skeleton";
import LogoUpload from "@/component/dashboard/ui/logoUpload";
import CodeBlock from "@/component/dashboard/ui/codeBlock";
import ChatPreview from "@/component/dashboard/bot/chatPreview";
import FileLearning from "@/component/dashboard/bot/fileLearning";
import { baseURL, useDelete, useGet, usePatch, usePost } from "@/hooks/common/useAPI";
import { useToast } from "@/hooks/common/useToast";

interface ModelDto {
  value: string;
  label: string;
  description: string | null;
  provider: "openai" | "anthropic" | "gemini";
  type: "chat" | "image";
  /** USD per 1M 토큰. LiteLLM 데이터 기준으로 카탈로그 갱신 시 채워진다. */
  pricing_input: number | null;
  pricing_output: number | null;
}

/** $0.15 처럼 불필요한 0을 떼고 표시. */
const formatUsd = (v: number) => `$${Number(v.toFixed(4))}`;

/**
 * 드롭다운 라벨 아래 줄. BYOK라 모델 사용료를 사용자가 직접 부담하므로
 * 운영자가 쓴 설명과 함께 토큰 단가를 같이 보여준다.
 * 설명이 비어 있어도 단가는 나오므로 빈 줄이 생기지 않는다.
 */
const buildModelDescription = (m: ModelDto, hasKey: boolean): string => {
  if (!hasKey) return "API 키를 먼저 등록해주세요";
  const parts: string[] = [];
  if (m.description) parts.push(m.description);
  if (m.pricing_input !== null && m.pricing_output !== null) {
    parts.push(
      `입력 ${formatUsd(m.pricing_input)} · 출력 ${formatUsd(m.pricing_output)} /1M`,
    );
  }
  return parts.join(" · ");
};

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
  faqs: { q: string; a: string }[];
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
  faqs: { q: string; a: string }[] | null;
}

interface BotPayload {
  name: string;
  logo?: string | null;
  widget_icon?: string | null;
  greeting?: string;
  system_prompt?: string;
  training_text?: string;
  training_type?: TrainingType;
  fallback?: string;
  model: string;
  faqs?: { q: string; a: string }[] | null;
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
  faqs: [],
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
  faqs: dto.faqs ?? [],
});

const formToPayload = (form: BotForm): BotPayload => ({
  name: form.name,
  logo: form.logo ?? null,
  widget_icon: form.widgetIcon ?? null,
  greeting: form.greeting,
  system_prompt: form.systemPrompt,
  training_text: form.trainingData,
  training_type: form.trainingType,
  fallback: form.fallback,
  model: form.model,
  faqs: form.faqs.length > 0 ? form.faqs : null,
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
  src="${EMBED_ORIGIN}/embed/${botId}?mode=widget"
  style="width:100%;height:600px;border:none;border-radius:12px;"
  allow="clipboard-write"
  title="채팅 위젯"></iframe>`;


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
  const [crawlUrl, setCrawlUrl] = useState("");

  const { data: botDto, isLoading: botLoading } = useGet<BotDto>(
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
        label: `${providerLabel} · ${m.label}`,
        description: buildModelDescription(m, hasKey),
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
  const fetchUrlMutation = usePost<{ url: string }, { text: string; char_count: number }>("api/bot/fetch-url");

  const update = <K extends keyof BotForm>(key: K, value: BotForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleFetchUrl = () => {
    if (!crawlUrl.trim()) return;
    fetchUrlMutation.mutate(
      { url: crawlUrl.trim() },
      {
        onSuccess: (res) => {
          if (res?.text) {
            update("trainingData", res.text);
            setCrawlUrl("");
            toast.success(`${res.char_count.toLocaleString()}자 가져왔습니다.`);
          }
        },
        onError: (err) => {
          toast.error(err.message || "URL에서 텍스트를 가져오지 못했습니다.");
        },
      },
    );
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bots"] });
    if (slug) queryClient.invalidateQueries({ queryKey: ["bot", slug] });
  };

  const uploadPendingFiles = async (targetSlug: string) => {
    if (!pendingFiles.length) return;
    const fd = new FormData();
    pendingFiles.forEach((f) => fd.append("files", f));

    try {
      const res = await fetch(`${baseURL}/api/bot/${targetSlug}/files`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        // 서버는 "유료 플랜 전용", "OpenAI 모델만 가능" 같은 구체적인 이유를 준다.
        // status만 보여주면 사용자가 원인을 알 방법이 없다.
        const reason = await res
          .json()
          .then((body) => body?.message)
          .catch(() => null);
        throw new Error(reason || `파일 업로드 실패 (status: ${res.status})`);
      }
      setPendingFiles([]);
    } finally {
      // 성공/실패와 무관하게 서버 상태를 다시 읽는다.
      // 업로드가 오래 걸려 클라이언트만 끊긴 경우, 서버에는 파일이 정상 저장돼
      // 있는데 목록이 그대로라 아무 일도 없었던 것처럼 보인다.
      queryClient.invalidateQueries({ queryKey: ["bot-files", targetSlug] });
    }
  };

  const handleSave = async () => {
    const payload = formToPayload(form);
    try {
      if (isNew) {
        const created = await createMutation.mutateAsync(payload);
        // 생성 응답을 그대로 캐시에 넣어둔다. 안 넣으면 상세로 넘어갈 때 이 봇을
        // 처음부터 다시 받아오면서, 방금 채운 폼이 로딩 스켈레톤으로 한 번 사라진다.
        queryClient.setQueryData(["bot", created.id], created);
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

  // 기존 봇을 여는 경우, 값이 오기 전에 폼을 그리면 빈 입력창 → 채워진 입력창으로
  // 화면 전체가 한 번 갈아치워진다. 값을 받은 뒤에 폼을 그린다.
  if (!isNew && botLoading) return <BotEditSkeleton />;

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
              count={form.name.length}
              max={60}
            >
              <Input
                id="bot-name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="예: 더현대 서울 안내봇 / ABC학원 상담봇"
                maxLength={60}
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
              count={form.greeting.length}
              max={500}
            >
              <Textarea
                rows={3}
                value={form.greeting}
                onChange={(e) => update("greeting", e.target.value)}
                placeholder={`안녕하세요! ABC상사 고객지원 봇입니다 👋\n영업시간·환불·배송 등 무엇이든 물어보세요.`}
                maxLength={500}
              />
            </Field>

            <Field
              label="FAQ 버튼"
              description="채팅창이 열릴 때 인사말 아래 버튼으로 표시됩니다. 클릭하면 LLM 없이 바로 답변이 노출됩니다."
            >
              <FaqEditor
                value={form.faqs}
                onChange={(v) => update("faqs", v)}
              />
            </Field>

            <Field
              label="시스템 프롬프트"
              description="페르소나, 톤, 답변 규칙을 정의합니다. 1,000~3,000자 권장 (길수록 토큰 비용 ↑)."
              count={form.systemPrompt.length}
              max={20000}
            >
              <Textarea
                rows={5}
                value={form.systemPrompt}
                onChange={(e) => update("systemPrompt", e.target.value)}
                placeholder={`당신은 ABC상사 고객지원 어시스턴트입니다.\n\n• 항상 정중한 한국어 존댓말로 답합니다.\n• 답을 모르면 추측하지 말고, 담당자에게 문의하도록 안내하세요.\n• 정치·종교·개인 의견에 대해서는 답하지 않습니다.\n• 답변은 3~4문장 안에 핵심만 짧게 정리해주세요.`}
                maxLength={20000}
              />
            </Field>

            <Field
              label="모르는 질문 답변"
              description="학습 내용에 없는 질문을 받았을 때 보낼 메시지예요. 비워두면 일반 지식으로 최대한 답변해요."
              count={form.fallback.length}
              max={500}
            >
              <Input
                value={form.fallback}
                onChange={(e) => update("fallback", e.target.value)}
                placeholder="죄송해요, 해당 내용은 제가 답변드리기 어려워요. 1588-0000으로 전화 주시거나 help@abc.com 으로 문의해주세요."
                maxLength={500}
              />
            </Field>
          </Section>

          <Section
            title="학습 데이터"
            description="자주 묻는 질문, 회사/제품 설명, 정책 등을 자유롭게 입력하거나 파일로 업로드하세요."
          >
            {!isOpenAIModel && (
              <div className="rounded-comfy bg-bg-sub/40 shadow-border px-4 py-3 text-[12px] text-text-sub leading-relaxed">
                <span className="font-medium text-text-main">
                  파일 업로드 학습은 OpenAI 모델에서만 지원됩니다.
                </span>
                <br />
                현재 선택한 모델은 아래 학습 텍스트만 사용합니다. 파일(PDF, DOCX
                등)로 학습하려면 모델을 OpenAI로 변경하세요.
              </div>
            )}

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
                description="짧은 FAQ나 가이드는 직접 입력. 5,000자 넘어가면 파일 업로드(벡터 스토어) 권장."
                count={form.trainingData.length}
                max={20000}
              >
                <div className="flex flex-col gap-1.5 mb-2">
                  <div className="flex gap-2">
                    <Input
                      className="flex-1"
                      value={crawlUrl}
                      onChange={(e) => setCrawlUrl(e.target.value)}
                      placeholder="URL에서 가져오기 (예: https://example.com)"
                      onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleFetchUrl}
                      disabled={!crawlUrl.trim() || fetchUrlMutation.isPending}
                    >
                      {fetchUrlMutation.isPending ? "가져오는 중..." : "가져오기"}
                    </Button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-text-sub">
                    입력한 주소 <span className="text-text-main">한 페이지의 본문 텍스트</span>를 그대로 가져옵니다
                    (최대 20,000자). 메뉴·푸터·스크립트는 자동으로 걸러지고, 하위 링크는 따라가지 않습니다.
                    가져오면 <span className="text-text-main">아래 학습 텍스트를 덮어쓰니</span> 먼저 확인해주세요.
                    로그인이 필요한 페이지나 자바스크립트로 그려지는 페이지는 내용이 비어 있을 수 있습니다.
                  </p>
                </div>
                <Textarea
                  rows={10}
                  value={form.trainingData}
                  onChange={(e) => update("trainingData", e.target.value)}
                  maxLength={20000}
                  placeholder={`[회사 소개]
ABC상사는 2010년 설립된 사무용품 전문 쇼핑몰입니다.

[영업시간]
평일 10:00 ~ 19:00 (점심 12:30 ~ 13:30)
주말·공휴일 휴무

[배송]
- 평일 14시 이전 결제 → 당일 출고
- 일반: 2~3일 / 제주·도서산간: 4~5일
- 5만원 이상 구매 시 무료배송

[환불 정책]
- 단순 변심: 수령 후 7일 이내, 왕복 배송비 고객 부담
- 제품 하자: 100% 환불 + 배송비 자사 부담

[자주 묻는 질문]
Q. 세금계산서 발급되나요?
A. 네, 결제 후 마이페이지에서 신청 가능합니다.

Q. 매장 방문 픽업 가능한가요?
A. 서울 본사 매장은 영업시간 내 방문 픽업이 가능합니다.`}
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

          {/* 카카오톡 채널 연결 보류 — 오픈빌더 온보딩이 무거워 화면을 내려뒀다.
              되살릴 때는 /dashboard/kakao(container/dashboard/kakao.tsx)를 먼저 켜고
              아래 블록의 주석을 해제한다. PROGRESS.md '(보류) 카카오톡 연동 온보딩' 참고.

          {!isNew && (
            <Section
              title="카카오톡 채널 연결"
              description="카카오 i 오픈빌더 스킬 서버로 이 봇을 연결합니다."
            >
              <Card variant="outline" className="p-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-[13px] text-text-sub leading-relaxed min-w-0">
                    스킬 URL 발급과 연결 상태는 카카오톡 설정에서 관리합니다.
                  </p>
                  <Link to="/dashboard/kakao" className="shrink-0">
                    <Button size="sm" pill variant="secondary">
                      카카오톡 설정으로 이동
                    </Button>
                  </Link>
                </div>
              </Card>
            </Section>
          )}
          */}

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
              trainingType={form.trainingType}
              faqs={form.faqs}
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

/** 폼 한 줄(라벨 + 입력창 + 설명) 자리. Field 컴포넌트와 같은 간격을 쓴다. */
const FieldSkeleton = ({ input = "h-9" }: { input?: string }) => (
  <div className="flex flex-col gap-2">
    <Skeleton className="h-[17px] w-28" />
    <Skeleton className={`w-full rounded-comfy ${input}`} />
    <Skeleton className="h-[15px] w-2/3" />
  </div>
);

const SectionSkeleton = ({ children }: { children: React.ReactNode }) => (
  <section className="flex flex-col gap-4">
    <Skeleton className="h-[17px] w-24" />
    <div className="flex flex-col gap-5">{children}</div>
  </section>
);

/**
 * 봇 편집 화면의 로딩 자리. 실제 폼과 같은 골격으로 그려서
 * 데이터가 들어올 때 스크롤 위치나 섹션 위치가 튀지 않게 한다.
 */
const BotEditSkeleton = () => (
  <>
    <Topbar
      title={<Skeleton className="h-[19px] w-40" />}
      description={<Skeleton className="h-[15px] w-64 mt-1" />}
      backTo="/dashboard"
      actions={<Skeleton className="h-8 w-20 rounded-full" />}
    />

    <div className="flex-1 relative min-h-0">
      <div className="h-full overflow-y-auto px-8 md:px-12 py-8">
        <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Card
                key={i}
                variant="outline"
                className="px-4 py-3.5 flex flex-col gap-1.5"
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-[22px] w-16" />
              </Card>
            ))}
          </div>

          <SectionSkeleton>
            <FieldSkeleton input="h-16" />
            <FieldSkeleton />
            <FieldSkeleton />
          </SectionSkeleton>

          <SectionSkeleton>
            <FieldSkeleton />
            <FieldSkeleton input="h-[116px]" />
          </SectionSkeleton>
        </div>
      </div>

      {/* 미리보기 패널도 자리를 잡아둔다 — 나중에 튀어나오면 그게 또 깜빡임이다. */}
      <div className="hidden lg:block absolute bottom-6 right-6 w-[480px] h-[760px] z-40 pointer-events-none">
        <Skeleton className="w-full h-full rounded-comfy" />
      </div>
    </div>
  </>
);

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

const EMBED_TABS = [
  { key: "script", label: "Script", hint: "우측 하단에 채팅 버블이 자동 생성됩니다. </body> 직전에 붙여넣으세요." },
  { key: "iframe", label: "iframe", hint: "원하는 위치에 직접 배치할 때 사용합니다. width·height를 자유롭게 조절하세요." },
] as const;

const EmbedTabs = ({ botId }: { botId: string }) => {
  const [active, setActive] = useState<"script" | "iframe">("script");
  const code = active === "script" ? buildScript(botId) : buildIframe(botId);
  const hint = EMBED_TABS.find((t) => t.key === active)!.hint;

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-bg-sub shadow-border w-fit">
        {EMBED_TABS.map((tab) => (
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
      <p className="text-[12px] text-text-sub leading-relaxed">{hint}</p>
      <CodeBlock code={code} language="html" />
    </div>
  );
};

type Faq = { q: string; a: string };

const FaqEditor = ({ value, onChange }: { value: Faq[]; onChange: (v: Faq[]) => void }) => {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");

  const add = () => {
    if (!q.trim() || !a.trim() || value.length >= 6) return;
    onChange([...value, { q: q.trim().slice(0, 60), a: a.trim().slice(0, 500) }]);
    setQ("");
    setA("");
  };

  return (
    <div className="flex flex-col gap-3">
      {value.map((faq, i) => (
        <div key={i} className="flex flex-col gap-1 px-3 py-2.5 rounded-comfy bg-bg-sub shadow-border">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[12px] font-medium text-text-main">{faq.q}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="shrink-0 text-text-disabled hover:text-text-main transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[12px] text-text-sub leading-relaxed">{faq.a}</p>
        </div>
      ))}
      {value.length < 6 && (
        <div className="flex flex-col gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="질문 예: 배송은 얼마나 걸리나요?"
            maxLength={60}
            className="h-9 px-3 rounded-comfy bg-input-bg shadow-border text-[13px] text-text-main placeholder:text-text-placeholder outline-none focus:shadow-[0_0_0_1px_rgb(var(--text-main))] transition-shadow"
          />
          <div className="flex gap-2">
            <input
              value={a}
              onChange={(e) => setA(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
              placeholder="답변 예: 보통 2~3 영업일 내 도착합니다."
              maxLength={500}
              className="flex-1 h-9 px-3 rounded-comfy bg-input-bg shadow-border text-[13px] text-text-main placeholder:text-text-placeholder outline-none focus:shadow-[0_0_0_1px_rgb(var(--text-main))] transition-shadow"
            />
            <button
              type="button"
              onClick={add}
              disabled={!q.trim() || !a.trim()}
              className="h-9 px-3.5 rounded-comfy bg-bg-sub shadow-border text-[12px] font-medium text-text-main hover:bg-bg-hover disabled:opacity-40 transition-colors"
            >
              추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BotEdit;
