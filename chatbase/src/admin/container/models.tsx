import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CpuIcon,
  ImageIcon,
  Loader2Icon,
  MessageSquareIcon,
  PencilIcon,
  RefreshCwIcon,
  UsersIcon,
} from "lucide-react";
import { useGet, usePatch, usePost } from "@/hooks/common/useAPI";
import ConfirmModal from "@/admin/component/ui/feedback/confirmModal";
import FormModal from "@/admin/component/ui/feedback/formModal";
import InputBox from "@/admin/component/ui/form/inputbox";
import TextareaBox from "@/admin/component/ui/form/textareaBox";

type ModelKind = "chat" | "image";

interface Pricing {
  input?: number;
  output?: number;
  per_image?: number;
}

interface ModelUser {
  id: number;
  email: string;
  name: string;
  bot_count: number;
}

interface DiscoveredModel {
  id: number;
  value: string;
  label: string;
  /** 사용자 모델 드롭다운에 라벨 아래로 노출된다. 비어 있으면 단가만 보인다. */
  description: string | null;
  pricing: Pricing | null;
  registered: boolean;
  bot_count: number;
  user_count: number;
  users: ModelUser[];
}

interface ProviderBlock {
  provider: string;
  label: string;
  chat: DiscoveredModel[];
  image: DiscoveredModel[];
  error?: string;
}

interface RefreshResult {
  added: number;
  updated: number;
  errors: string[];
}

const formatChatPricing = (p: Pricing | null) => {
  if (!p || p.input == null || p.output == null) return "—";
  return `$${p.input.toFixed(2)} / $${p.output.toFixed(2)} (1M tokens)`;
};

const formatImagePricing = (p: Pricing | null) => {
  if (!p || p.per_image == null) return "—";
  return `$${p.per_image.toFixed(3)} / image`;
};

const QUERY_KEY = ["admin-models-catalog"];

const AdminModels = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGet<ProviderBlock[]>(
    "api/admin/models/catalog",
    QUERY_KEY,
  );

  const refreshMutation = usePost<void, RefreshResult>(
    "api/admin/models/refresh",
  );
  const setActiveMutation = usePost<
    { value: string; active: boolean; force?: boolean },
    { value: string; active: boolean }
  >("api/admin/models/set_active");

  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const [refreshSummary, setRefreshSummary] = useState<RefreshResult | null>(
    null,
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [confirmModel, setConfirmModel] = useState<DiscoveredModel | null>(null);

  // 표시 정보(라벨/설명) 편집. refresh_catalog은 이 두 값을 덮지 않으므로 여기서 쓴 건 보존된다.
  const [editing, setEditing] = useState<DiscoveredModel | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const updateMutation = usePatch<
    DiscoveredModel,
    { label: string; description: string }
  >(`api/admin/models/${editing?.id ?? 0}`);

  const openEdit = (m: DiscoveredModel) => {
    setEditing(m);
    setEditLabel(m.label);
    setEditDescription(m.description ?? "");
    setEditError(null);
  };

  const closeEdit = () => {
    setEditing(null);
    setEditError(null);
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    setEditError(null);
    updateMutation.mutate(
      { label: editLabel, description: editDescription },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
          closeEdit();
        },
        onError: (err) =>
          setEditError(err?.message || "저장에 실패했습니다."),
      },
    );
  };

  const toggleCollapsed = (provider: string) =>
    setCollapsed((prev) => ({ ...prev, [provider]: !prev[provider] }));

  const patchRegistered = (value: string, registered: boolean) => {
    queryClient.setQueryData<ProviderBlock[]>(QUERY_KEY, (old) =>
      old?.map((p) => ({
        ...p,
        chat: p.chat.map((m) => (m.value === value ? { ...m, registered } : m)),
        image: p.image.map((m) =>
          m.value === value ? { ...m, registered } : m,
        ),
      })),
    );
  };

  const performToggle = (m: DiscoveredModel, next: boolean, force = false) => {
    setPendingValue(m.value);
    setActiveMutation.mutate(
      { value: m.value, active: next, force },
      {
        onSuccess: () => {
          patchRegistered(m.value, next);
          queryClient.invalidateQueries({ queryKey: ["models", "chat"] });
          queryClient.invalidateQueries({ queryKey: ["admin-models"] });
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
        onSettled: () => setPendingValue(null),
      },
    );
  };

  const handleToggle = (m: DiscoveredModel) => {
    const next = !m.registered;
    // 사용 해제 시 사용 중인 봇 있으면 확인 모달
    if (!next && m.bot_count > 0) {
      setConfirmModel(m);
      return;
    }
    performToggle(m, next);
  };

  const handleRefresh = () => {
    setRefreshSummary(null);
    refreshMutation.mutate(undefined, {
      onSuccess: (res) => {
        setRefreshSummary(res);
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      },
    });
  };

  // 카탈로그는 챗 모델만 내려온다(이미지 모델은 쓰는 기능이 없어 수집하지 않는다).
  // 응답의 image 배열은 형태 유지용으로 남아 있어 비어 있다.
  const totals = useMemo(() => {
    if (!data) return { chat: 0, registered: 0 };
    let chat = 0;
    let registered = 0;
    for (const p of data) {
      chat += p.chat.length;
      registered += p.chat.filter((m) => m.registered).length;
    }
    return { chat, registered };
  }, [data]);

  const isRefreshing = refreshMutation.isPending;

  return (
    <div className="px-6 md:px-8 py-6 flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-text-main">
            모델 관리
          </h1>
          <p className="text-[13px] text-text-sub mt-1">
            저장된 모델 카탈로그. 새로고침을 누르면 OpenAI / Anthropic / Gemini
            SDK로 신규 모델을 가져옵니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-[11px] text-text-sub">
              모델 {totals.chat} · 사용 중 {totals.registered}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="
              inline-flex items-center gap-1.5 h-8 px-3 rounded-full
              bg-bg-card shadow-border text-[12px] font-medium text-text-main
              hover:bg-bg-hover disabled:opacity-60 transition-colors
            "
          >
            <RefreshCwIcon
              className={[
                "w-3.5 h-3.5",
                isRefreshing ? "animate-spin" : "",
              ].join(" ")}
            />
            {isRefreshing ? "조회 중..." : "새로고침"}
          </button>
        </div>
      </div>

      {refreshSummary && (
        <div className="rounded-comfy bg-bg-card shadow-border px-4 py-3 text-[12px] text-text-main flex flex-col gap-1">
          <div>
            새로고침 완료 — 새 모델{" "}
            <span className="font-semibold">{refreshSummary.added}</span>개 추가
            · 갱신{" "}
            <span className="font-semibold">{refreshSummary.updated}</span>개
          </div>
          {refreshSummary.errors.length > 0 && (
            <div className="text-[11px] text-point-red flex items-start gap-1.5">
              <AlertCircleIcon className="w-3 h-3 mt-0.5 shrink-0" />
              <div className="flex flex-col gap-0.5">
                {refreshSummary.errors.map((e, i) => (
                  <span key={i}>{e}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-[12px] text-text-sub">
          <Loader2Icon className="w-4 h-4 animate-spin" />
          카탈로그를 불러오는 중...
        </div>
      ) : !data || data.every((p) => p.chat.length === 0 && p.image.length === 0) ? (
        <Empty />
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((provider) => (
            <ProviderSection
              key={provider.provider}
              provider={provider}
              onToggle={handleToggle}
              onEdit={openEdit}
              pendingValue={pendingValue}
              collapsed={!!collapsed[provider.provider]}
              onToggleCollapsed={() => toggleCollapsed(provider.provider)}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirmModel}
        onCancel={() => setConfirmModel(null)}
        onConfirm={() => {
          if (confirmModel) {
            performToggle(confirmModel, false, true);
            setConfirmModel(null);
          }
        }}
        title="이 모델을 정말 사용 해제할까요?"
        variant="danger"
        size="lg"
        confirmLabel="강제 해제"
        cancelLabel="취소"
        description={
          confirmModel ? (
            <>
              <p>
                <span className="font-mono text-neutral-900">
                  {confirmModel.value}
                </span>{" "}
                는 현재{" "}
                <span className="font-semibold text-neutral-900">
                  {confirmModel.user_count}명
                </span>
                의 사용자가{" "}
                <span className="font-semibold text-neutral-900">
                  봇 {confirmModel.bot_count}개
                </span>
                에서 사용 중입니다. 해제하면 해당 봇들이 즉시 응답 불가 상태가
                됩니다.
              </p>
              {confirmModel.users.length > 0 && (
                <div className="rounded-xl ring-1 ring-neutral-200 bg-white overflow-hidden">
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-tight text-neutral-500 bg-neutral-50 border-b border-neutral-100">
                    사용 중인 사용자 · 상위 {confirmModel.users.length}명
                  </div>
                  <ul className="divide-y divide-neutral-100">
                    {confirmModel.users.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center justify-between gap-3 px-3 py-2"
                      >
                        <div className="min-w-0 flex flex-col">
                          <span className="text-[13px] font-medium text-neutral-900 truncate">
                            {u.name || "—"}
                          </span>
                          <span className="text-[11px] text-neutral-500 truncate font-mono">
                            {u.email}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-neutral-600 shrink-0">
                          봇 {u.bot_count}개
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : undefined
        }
      />

      <FormModal
        open={!!editing}
        onClose={closeEdit}
        headerType="left"
        title="모델 표시 정보"
        description={editing?.value}
        size="md"
        footerType={2}
        footerAlign="right"
        primaryText="저장"
        secondaryText="취소"
        onPrimary={handleSaveEdit}
        onSecondary={closeEdit}
        primaryDisabled={updateMutation.isPending}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-neutral-700">
              라벨
            </label>
            <InputBox
              value={editLabel}
              onChange={(v) => setEditLabel(v.slice(0, 120))}
              placeholder="예) GPT-5 mini"
            />
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              사용자 모델 선택 목록에 굵게 표시됩니다. 비워두면 기존 값이
              유지됩니다.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-neutral-700">
              설명
            </label>
            <TextareaBox
              value={editDescription}
              onChange={(v) => setEditDescription(v.slice(0, 200))}
              rows={3}
              placeholder="예) 빠르고 저렴합니다. 일반 상담용으로 충분합니다."
            />
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              라벨 아래 한 줄로 붙습니다. 토큰 단가는 자동으로 함께 표시되니
              모델의 성격만 적어주세요. {editDescription.length}/200
            </p>
          </div>

          {editError && (
            <p className="text-[12px] text-red-600">{editError}</p>
          )}
        </div>
      </FormModal>
    </div>
  );
};

const Empty = () => (
  <div className="rounded-comfy bg-bg-card shadow-border px-6 py-16">
    <div className="flex flex-col items-center justify-center gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-bg-sub flex items-center justify-center">
        <CpuIcon className="w-5 h-5 text-text-sub" />
      </div>
      <p className="text-[14px] font-medium text-text-main">
        카탈로그가 비어있습니다
      </p>
      <p className="text-[12px] text-text-sub max-w-md leading-relaxed">
        우측 상단 <span className="font-medium text-text-main">새로고침</span>
        을 눌러 OpenAI / Anthropic / Gemini SDK에서 모델을 가져오세요.
      </p>
    </div>
  </div>
);

interface ProviderSectionProps {
  provider: ProviderBlock;
  onToggle: (m: DiscoveredModel) => void;
  onEdit: (m: DiscoveredModel) => void;
  pendingValue: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const ProviderSection = ({
  provider,
  onToggle,
  onEdit,
  pendingValue,
  collapsed,
  onToggleCollapsed,
}: ProviderSectionProps) => {
  const total = provider.chat.length + provider.image.length;
  const registered =
    provider.chat.filter((m) => m.registered).length +
    provider.image.filter((m) => m.registered).length;

  return (
    <section className="rounded-comfy bg-bg-card shadow-border overflow-hidden">
      <button
        type="button"
        onClick={onToggleCollapsed}
        className={[
          "w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-bg-hover transition-colors",
          collapsed ? "" : "border-b border-line",
        ].join(" ")}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-DEFAULT bg-bg-sub flex items-center justify-center shrink-0">
            <CpuIcon className="w-4 h-4 text-text-sub" />
          </div>
          <h2 className="text-[14px] font-semibold text-text-main truncate">
            {provider.label}
          </h2>
          <span className="text-[11px] text-text-sub shrink-0">
            {total}개 · 사용 중 {registered}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {provider.error && (
            <div className="flex items-center gap-1.5 text-[11px] text-point-red">
              <AlertCircleIcon className="w-3.5 h-3.5" />
              {provider.error}
            </div>
          )}
          <ChevronDownIcon
            className={[
              "w-4 h-4 text-text-sub transition-transform duration-200",
              collapsed ? "-rotate-90" : "",
            ].join(" ")}
          />
        </div>
      </button>

      {!collapsed && (
        <>
          <ModelGroup
            kind="chat"
            models={provider.chat}
            onToggle={onToggle}
            onEdit={onEdit}
            pendingValue={pendingValue}
          />
          {provider.image.length > 0 && (
            <ModelGroup
              kind="image"
              models={provider.image}
              onToggle={onToggle}
              onEdit={onEdit}
              pendingValue={pendingValue}
            />
          )}
        </>
      )}
    </section>
  );
};

interface ModelGroupProps {
  kind: ModelKind;
  models: DiscoveredModel[];
  onToggle: (m: DiscoveredModel) => void;
  onEdit: (m: DiscoveredModel) => void;
  pendingValue: string | null;
}

const ModelGroup = ({
  kind,
  models,
  onToggle,
  onEdit,
  pendingValue,
}: ModelGroupProps) => {
  if (models.length === 0) return null;
  return (
    <div>
      <div className="px-5 pt-4 pb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-tight text-text-sub">
        {kind === "chat" ? (
          <MessageSquareIcon className="w-3 h-3" />
        ) : (
          <ImageIcon className="w-3 h-3" />
        )}
        {kind}
      </div>
      <div className="flex flex-col">
        {models.map((m) => (
          <ModelRow
            key={m.value}
            model={m}
            kind={kind}
            onToggle={onToggle}
            onEdit={onEdit}
            pending={pendingValue === m.value}
          />
        ))}
      </div>
    </div>
  );
};

interface ModelRowProps {
  model: DiscoveredModel;
  kind: ModelKind;
  onToggle: (m: DiscoveredModel) => void;
  onEdit: (m: DiscoveredModel) => void;
  pending: boolean;
}

const ModelRow = ({
  model,
  kind,
  onToggle,
  onEdit,
  pending,
}: ModelRowProps) => {
  const pricing =
    kind === "chat"
      ? formatChatPricing(model.pricing)
      : formatImagePricing(model.pricing);

  const inUse = model.bot_count > 0;

  return (
    <div className="px-5 py-3 flex items-center justify-between gap-3 border-t border-line">
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-text-main truncate">
            {model.label}
          </span>
          {model.registered && (
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 h-5 rounded-full bg-bg-sub text-[10px] font-medium text-text-main">
              <CheckCircle2Icon className="w-3 h-3" />
              사용 중
            </span>
          )}
          {inUse && (
            <span
              className="shrink-0 inline-flex items-center gap-1 px-1.5 h-5 rounded-full bg-amber-100 text-[10px] font-medium text-amber-800"
              title={model.users
                .map((u) => `${u.name || u.email} · 봇 ${u.bot_count}개`)
                .join("\n")}
            >
              <UsersIcon className="w-3 h-3" />
              {model.user_count}명 · 봇 {model.bot_count}개
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-text-sub">
          <span className="font-mono truncate">{model.value}</span>
          <span className="text-text-disabled">·</span>
          <span className="font-mono">{pricing}</span>
        </div>
        <p
          className={[
            "text-[11px] leading-relaxed truncate",
            model.description ? "text-text-sub" : "text-text-disabled italic",
          ].join(" ")}
        >
          {model.description || "설명 없음 — 사용자에게는 단가만 표시됩니다"}
        </p>
      </div>
      <button
        onClick={() => onEdit(model)}
        aria-label="표시 정보 편집"
        title="라벨 · 설명 편집"
        className="
          shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full
          text-text-sub hover:text-text-main hover:bg-bg-hover
          transition-colors
        "
      >
        <PencilIcon className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onToggle(model)}
        disabled={pending}
        className={[
          "shrink-0 inline-flex items-center justify-center h-8 px-3 rounded-full",
          "text-[12px] font-medium transition-colors disabled:opacity-60",
          model.registered
            ? "bg-bg-card shadow-border text-text-main hover:bg-bg-hover"
            : "bg-text-main text-text-inverse hover:bg-text-main/90",
        ].join(" ")}
      >
        {pending ? "처리 중..." : model.registered ? "사용 해제" : "사용 설정"}
      </button>
    </div>
  );
};

export default AdminModels;
