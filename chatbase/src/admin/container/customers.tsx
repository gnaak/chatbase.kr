import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Table, { type Column } from "@/admin/component/ui/table/table";
import FormModal from "@/admin/component/ui/feedback/formModal";
import Button from "@/admin/component/ui/form/button";
import { useGet, usePatch } from "@/hooks/common/useAPI";
import { useToast } from "@/hooks/common/useToast";
import { formatDate } from "@/utils/format/date";
import { PLANS } from "@/types/plan";
import type { SubscriptionStatus } from "@/types/payment";

interface UserDto {
  id: number;
  email: string;
  name: string;
  active: boolean;
  /** 게이팅이 보는 실제 권한. 구독 상태와의 대조는 결제 관리 화면에서 한다. */
  plan: string;
  /** `granted`면 관리자가 준 플랜. 결제 상태(active 등)면 여기서 못 바꾼다. */
  plan_status: SubscriptionStatus;
  /** 관리자 지정 플랜의 종료일. 무기한이거나 지정이 아니면 null. */
  plan_until: string | null;
  created_at: string | null;
  last_login_at: string | null;
  bot_count: number;
  key_providers: string[];
  session_count: number;
}

interface SetPlanRequest {
  plan: string;
  /** null = 무기한. */
  months: number | null;
}

/** 유료 플랜만 색을 준다. FREE가 대다수라 전부 칠하면 표가 시끄러워진다. */
const PLAN_CLASS: Record<string, string> = {
  global: "bg-warning-bg text-point-amber",
  premium: "bg-info-bg text-point-blue",
  standard: "bg-success-bg text-point-green",
};

/**
 * 돈이 오가는 중인 구독. 어드민에서 plan을 바꾸면 다음 청구가 바뀐 금액으로
 * 나가므로 서버가 거절한다(`PaymentService.admin_set_plan`). 버튼부터 막는다.
 */
const PAID_STATUSES: SubscriptionStatus[] = ["active", "past_due", "canceled"];

const PLAN_OPTIONS = PLANS.map((p) => p.name.toLowerCase());

const MONTH_OPTIONS: { value: number | null; label: string }[] = [
  { value: 1, label: "1개월" },
  { value: 3, label: "3개월" },
  { value: 6, label: "6개월" },
  { value: 12, label: "12개월" },
  { value: null, label: "무기한" },
];

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { hour12: false }) : "-";

const PlanBadge = ({ plan }: { plan: string }) => (
  <span
    className={[
      "inline-flex items-center px-1.5 h-5 rounded text-[11px] font-medium",
      PLAN_CLASS[plan] ?? "bg-bg-sub text-text-sub",
    ].join(" ")}
  >
    {(plan ?? "free").toUpperCase()}
  </span>
);

/** 관리자 지정이면 언제까지인지, 아니면 아무것도 붙이지 않는다. */
const grantText = (u: UserDto) =>
  u.plan_status !== "granted"
    ? null
    : u.plan_until
      ? `${formatDate(u.plan_until, ".")}까지`
      : "무기한";

const Choice = ({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "h-8 px-3 rounded border text-[12px] font-medium transition-colors",
      selected
        ? "border-main bg-main text-white"
        : "border-line text-text-sub hover:bg-bg-hover hover:text-text-main",
    ].join(" ")}
  >
    {children}
  </button>
);

interface PlanModalProps {
  user: UserDto;
  onClose: () => void;
}

/**
 * 결제 없이 플랜을 준다. `BILLING_BETA` 동안은 이게 유료 플랜으로 가는 유일한 길이다.
 * 관리자 지정 기간이 남아 있으면 서버가 **남은 종료일 뒤에 이어 붙인다**(연장).
 * 끝났거나 무기한이었으면 지금부터 센다 — 아래 안내 문구가 그 둘을 가른다.
 */
const PlanModal = ({ user, onClose }: PlanModalProps) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [plan, setPlan] = useState(user.plan);
  const [months, setMonths] = useState<number | null>(1);

  const setPlanMutation = usePatch<unknown, SetPlanRequest>(
    `api/admin/users/${user.id}/plan`,
  );

  const isRevoke = plan === "free";
  // 이미 FREE인 사람에게 FREE를 주는 건 할 일이 없다. 같은 유료 플랜은 기간 연장이라 허용한다.
  const isNoop = isRevoke && user.plan === "free";
  // 연장의 기준이 되는 남은 종료일. 서버와 같은 조건(관리자 지정 · 종료일이 미래)이다.
  const extendsFrom =
    user.plan_status === "granted" &&
    user.plan_until &&
    new Date(user.plan_until) > new Date()
      ? user.plan_until
      : null;
  const isExtend = !isRevoke && months !== null && extendsFrom !== null;

  const handleSubmit = () => {
    setPlanMutation.mutate(
      { plan, months: isRevoke ? null : months },
      {
        onSuccess: () => {
          // 고객 목록뿐 아니라 결제 관리·대시보드의 분포와 구독 목록도 바뀐다.
          queryClient.invalidateQueries({ queryKey: ["admin-users"] });
          queryClient.invalidateQueries({ queryKey: ["admin-billing-summary"] });
          queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
          toast.success(
            isRevoke
              ? `${user.email} — FREE로 되돌렸습니다.`
              : isExtend
                ? `${user.email} — ${plan.toUpperCase()} ${months}개월 연장했습니다.`
                : `${user.email} — ${plan.toUpperCase()} 적용했습니다.`,
          );
          onClose();
        },
        onError: (e) => toast.error(e.message || "플랜 변경에 실패했습니다."),
      },
    );
  };

  const current = grantText(user);

  return (
    <FormModal
      open
      onClose={onClose}
      headerType="left"
      title="플랜 변경"
      description={`${user.name} · ${user.email}`}
      primaryText={isRevoke ? "FREE로 되돌리기" : isExtend ? "연장" : "적용"}
      onPrimary={handleSubmit}
      primaryDisabled={isNoop || setPlanMutation.isPending}
    >
      <div className="flex flex-col gap-4 py-1">
        <div className="flex items-center gap-2 text-[12px] text-text-sub">
          <span>현재</span>
          <PlanBadge plan={user.plan} />
          {current && <span>관리자 지정 · {current}</span>}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-text-main">플랜</span>
          <div className="flex flex-wrap gap-1.5">
            {PLAN_OPTIONS.map((p) => (
              <Choice key={p} selected={plan === p} onClick={() => setPlan(p)}>
                {p.toUpperCase()}
              </Choice>
            ))}
          </div>
        </div>

        {!isRevoke && (
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-medium text-text-main">기간</span>
            <div className="flex flex-wrap gap-1.5">
              {MONTH_OPTIONS.map((m) => (
                <Choice
                  key={m.label}
                  selected={months === m.value}
                  onClick={() => setMonths(m.value)}
                >
                  {m.label}
                </Choice>
              ))}
            </div>
          </div>
        )}

        <p className="text-[12px] text-text-sub leading-relaxed border-t border-line pt-3">
          {isRevoke
            ? "즉시 FREE로 돌아갑니다. 봇 개수·대화 한도가 FREE 기준으로 바로 걸립니다."
            : months === null
              ? "결제 없이 적용됩니다. 되돌리기 전까지 계속 유지됩니다."
              : isExtend
                ? `결제 없이 적용됩니다. 지금 종료일(${formatDate(extendsFrom, ".")})에서 ${months}개월 늘어나고, 그 뒤 자동으로 FREE로 돌아갑니다.`
                : `결제 없이 적용됩니다. 오늘부터 ${months}개월 뒤 자동으로 FREE로 돌아갑니다.`}
        </p>
      </div>
    </FormModal>
  );
};

const AdminCustomers = () => {
  const [editing, setEditing] = useState<UserDto | null>(null);
  const { data: users, isLoading } = useGet<UserDto[]>("api/admin/users", [
    "admin-users",
  ]);

  const columns: Column[] = useMemo(
    () => [
      { key: "id", header: "ID", width: "56px", align: "center" },
      { key: "name", header: "이름", width: "120px", align: "center" },
      {
        key: "email",
        header: "이메일",
        width: "240px",
        align: "center",
        render: (r: UserDto) => (
          <span
            className="font-mono text-[12px] text-text-main truncate block"
            title={r.email}
          >
            {r.email}
          </span>
        ),
      },
      {
        key: "plan",
        header: "플랜",
        width: "190px",
        align: "center",
        render: (r: UserDto) => {
          const grant = grantText(r);
          // 탈퇴 계정은 데이터가 지워졌고, 결제 중인 구독은 서버가 거절한다.
          // active 는 nullable 이라 null(DB에 직접 넣은 행)은 탈퇴로 보지 않는다 — 서버와 같은 기준.
          const locked =
            r.active === false
              ? "탈퇴"
              : PAID_STATUSES.includes(r.plan_status)
                ? "결제 중"
                : null;
          return (
            <div className="flex items-center justify-center gap-1.5">
              <PlanBadge plan={r.plan} />
              {grant && (
                <span
                  className="text-[10px] text-point-blue"
                  title="관리자 지정 — 결제 없이 적용된 플랜"
                >
                  {grant}
                </span>
              )}
              {locked ? (
                <span
                  className="text-[10px] text-text-disabled"
                  title={
                    locked === "결제 중"
                      ? "결제로 이용 중인 구독은 사용자가 직접 바꿔야 합니다"
                      : undefined
                  }
                >
                  {locked}
                </span>
              ) : (
                <Button
                  variant="sub2"
                  size="sm"
                  className="!h-6 !px-2 !text-[11px]"
                  onClick={() => setEditing(r)}
                >
                  변경
                </Button>
              )}
            </div>
          );
        },
      },
      {
        key: "key_providers",
        header: "등록 키",
        width: "180px",
        align: "center",
        render: (r: UserDto) =>
          r.key_providers.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-1">
              {r.key_providers.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center px-1.5 h-5 rounded bg-bg-sub text-[11px] font-medium text-text-sub"
                >
                  {p}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-text-disabled text-[11px]">-</span>
          ),
      },
      {
        key: "bot_count",
        header: "봇",
        width: "60px",
        align: "center",
        render: (r: UserDto) => (
          <span className="font-mono text-[12px]">{r.bot_count}</span>
        ),
      },
      {
        key: "session_count",
        header: "세션",
        width: "72px",
        align: "center",
        render: (r: UserDto) => (
          <span className="font-mono text-[12px]">{r.session_count}</span>
        ),
      },
      {
        key: "active",
        header: "상태",
        width: "84px",
        align: "center",
        render: (r: UserDto) => (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-text-sub">
            <span
              className={[
                "w-1.5 h-1.5 rounded-full",
                r.active ? "bg-point-green" : "bg-text-disabled",
              ].join(" ")}
            />
            {r.active ? "활성" : "비활성"}
          </span>
        ),
      },
      {
        key: "created_at",
        header: "가입",
        width: "150px",
        align: "center",
        render: (r: UserDto) => (
          <span className="text-[11px] text-text-sub">
            {formatDateTime(r.created_at)}
          </span>
        ),
      },
      {
        key: "last_login_at",
        header: "최근 로그인",
        width: "150px",
        align: "center",
        render: (r: UserDto) => (
          <span className="text-[11px] text-text-sub">
            {formatDateTime(r.last_login_at)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="px-6 md:px-8 py-6 flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-text-main">
            고객 관리
          </h1>
          <p className="text-[13px] text-text-sub mt-1">
            전체 사용자 · 플랜 · 봇 수 · 등록 키 provider · 누적 세션 수
          </p>
        </div>
        {users && (
          <span className="text-[12px] text-text-sub">
            총 <span className="font-semibold text-text-main">{users.length}</span>명
          </span>
        )}
      </div>

      <Table
        columns={columns}
        data={users ?? []}
        size="sm"
        loading={isLoading}
      />

      {/* key로 사용자마다 새로 마운트한다 — 이전 사람의 선택값이 남지 않게. */}
      {editing && (
        <PlanModal
          key={editing.id}
          user={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default AdminCustomers;
