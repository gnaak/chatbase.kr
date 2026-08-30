import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Check,
  CreditCard,
  Cpu,
  KeyRound,
  MessagesSquare,
  TrendingUp,
  TriangleAlert,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import StatCard from "@/admin/component/ui/statCard";
import Skeleton from "@/admin/component/ui/skeleton";
import { useGet } from "@/hooks/common/useAPI";
import { formatCurrencyKRW } from "@/utils/format/number";
import {
  PAYMENT_FETCH_LIMIT,
  PAYMENT_STATUS_LABEL,
  type AdminBillingSummary,
  type AdminPaymentList,
  type AdminSubscription,
} from "@/admin/types/billing";

interface UserDto {
  id: number;
  email: string;
  name: string;
  plan: string;
  created_at: string | null;
  last_login_at: string | null;
  bot_count: number;
  session_count: number;
  key_providers: string[];
}

interface ModelDto {
  id: number;
  is_active: boolean;
}

/** 유입 출처 한 줄. 서버가 결제 → 키 등록 → 가입 순으로 정렬해서 준다. */
interface AcquisitionRow {
  /** UTM이 없는 가입은 서버가 "(직접)" 으로 묶어 보낸다. */
  source: string;
  medium: string;
  campaign: string;
  signups: number;
  keyed: number;
  paid: number;
}

interface AcquisitionSummary {
  rows: AcquisitionRow[];
  total_signups: number;
  untracked_signups: number;
}

/** 매출 추이에 보여줄 개월 수. */
const TREND_MONTHS = 6;
/** "다가오는 청구"로 볼 기간. 7일은 대개 비어서 2주로 잡는다. */
const UPCOMING_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 플랜은 등급이 있는 값이라 색도 한 색조의 농도로만 구분한다(FREE 옅음 → PREMIUM 진함). */
const PLAN_TIERS = [
  { key: "free", label: "FREE", fill: "bg-point-blue/20" },
  { key: "standard", label: "STANDARD", fill: "bg-point-blue/55" },
  { key: "premium", label: "PREMIUM", fill: "bg-point-blue" },
];

const formatMonthDay = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("ko-KR", {
        month: "numeric",
        day: "numeric",
      })
    : "-";

const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS);

const Panel = ({
  title,
  subtitle,
  action,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) => (
  <section
    className={[
      "rounded-comfy bg-bg-card shadow-border px-4 py-3.5 flex flex-col gap-3",
      className,
    ].join(" ")}
  >
    <header className="flex items-start justify-between gap-2">
      <div>
        <h2 className="text-[13px] font-semibold tracking-tight text-text-main">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11px] text-text-sub mt-0.5">{subtitle}</p>
        )}
      </div>
      {action}
    </header>
    {children}
  </section>
);

const PanelLink = ({ to, label }: { to: string; label: string }) => (
  <Link
    to={to}
    className="inline-flex items-center gap-0.5 text-[11px] text-text-sub hover:text-text-main transition-colors"
  >
    {label}
    <ArrowRight className="w-3 h-3" />
  </Link>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="py-8 text-center text-[12px] text-text-disabled">{children}</p>
);

const Rows = ({ loading, children }: { loading: boolean; children: React.ReactNode }) =>
  loading ? (
    <div className="flex flex-col gap-2.5 py-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  ) : (
    <>{children}</>
  );

const AdminMain = () => {
  const { data: users, isLoading: usersLoading } = useGet<UserDto[]>(
    "api/admin/users",
    ["admin-users"],
  );
  const { data: acquisition, isLoading: acqLoading } =
    useGet<AcquisitionSummary>("api/admin/acquisition", ["admin-acquisition"]);
  const { data: models, isLoading: modelsLoading } = useGet<ModelDto[]>(
    "api/admin/models",
    ["admin-models"],
  );
  const { data: billing, isLoading: billingLoading } =
    useGet<AdminBillingSummary>("api/admin/billing/summary", [
      "admin-billing-summary",
    ]);
  const { data: subscriptions, isLoading: subsLoading } = useGet<
    AdminSubscription[]
  >("api/admin/subscriptions", ["admin-subscriptions"]);
  const { data: payments, isLoading: paymentsLoading } =
    useGet<AdminPaymentList>(
      `api/admin/payments?limit=${PAYMENT_FETCH_LIMIT}`,
      ["admin-payments", PAYMENT_FETCH_LIMIT],
    );

  const userList = useMemo(() => users ?? [], [users]);
  const paymentItems = useMemo(() => payments?.items ?? [], [payments]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * DAY_MS;
    return {
      users: userList.length,
      bots: userList.reduce((s, u) => s + u.bot_count, 0),
      sessions: userList.reduce((s, u) => s + u.session_count, 0),
      keys: userList.reduce((s, u) => s + u.key_providers.length, 0),
      newThisWeek: userList.filter(
        (u) => u.created_at && new Date(u.created_at).getTime() >= weekAgo,
      ).length,
      activeThisWeek: userList.filter(
        (u) => u.last_login_at && new Date(u.last_login_at).getTime() >= weekAgo,
      ).length,
      withoutKey: userList.filter((u) => u.key_providers.length === 0).length,
      withoutBot: userList.filter((u) => u.bot_count === 0).length,
      activeModels: (models ?? []).filter((m) => m.is_active).length,
      totalModels: models?.length ?? 0,
    };
  }, [userList, models]);

  const planTotal = billing
    ? PLAN_TIERS.reduce((s, t) => s + (billing.plan_counts[t.key] ?? 0), 0)
    : 0;
  const paidUsers = billing
    ? (billing.plan_counts.standard ?? 0) + (billing.plan_counts.premium ?? 0)
    : 0;
  const paidRatio = planTotal > 0 ? (paidUsers / planTotal) * 100 : 0;

  /**
   * 최근 6개월 매출. 결제 내역을 승인월로 묶는다.
   * 내역이 `PAYMENT_FETCH_LIMIT`에서 잘리면 오래된 달이 실제보다 적게 잡힐 수 있어
   * 잘린 경우에는 패널에 그 사실을 적어둔다.
   */
  const trend = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: TREND_MONTHS }, (_, i) => {
      const d = new Date(
        now.getFullYear(),
        now.getMonth() - (TREND_MONTHS - 1 - i),
        1,
      );
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: `${d.getMonth() + 1}월`,
        total: 0,
      };
    });
    const index = new Map(buckets.map((b, i) => [b.key, i]));

    for (const p of paymentItems) {
      if (p.status !== "done") continue;
      const iso = p.approved_at ?? p.created_at;
      if (!iso) continue;
      const d = new Date(iso);
      const i = index.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (i !== undefined) buckets[i].total += p.amount;
    }
    return buckets;
  }, [paymentItems]);

  const trendMax = Math.max(...trend.map((b) => b.total));

  const upcoming = useMemo(() => {
    const limit = Date.now() + UPCOMING_DAYS * DAY_MS;
    return (subscriptions ?? [])
      .filter(
        (s) =>
          s.status === "active" &&
          s.next_billing_at &&
          new Date(s.next_billing_at).getTime() <= limit,
      )
      .sort(
        (a, b) =>
          new Date(a.next_billing_at!).getTime() -
          new Date(b.next_billing_at!).getTime(),
      )
      .slice(0, 5);
  }, [subscriptions]);

  const mismatchCount = (subscriptions ?? []).filter(
    (s) => s.plan_mismatch,
  ).length;

  /** 방치하면 매출이나 온보딩이 새는 항목들. 0이면 "정상"으로 접어둔다. */
  const alerts = [
    {
      key: "past_due",
      icon: <TriangleAlert className="w-3.5 h-3.5" />,
      label: "청구 실패 대기",
      hint: "재시도 중인 구독",
      count: billing?.past_due_count ?? 0,
      tone: "text-point-red",
      to: "/admin/payments",
    },
    {
      key: "mismatch",
      icon: <TriangleAlert className="w-3.5 h-3.5" />,
      label: "플랜 불일치",
      hint: "구독과 실제 권한이 다름",
      count: mismatchCount,
      tone: "text-point-red",
      to: "/admin/payments",
    },
    {
      key: "failed",
      icon: <CreditCard className="w-3.5 h-3.5" />,
      label: "최근 30일 결제 실패",
      hint: "실패 사유 확인",
      count: billing?.failed_30d ?? 0,
      tone: "text-point-amber",
      to: "/admin/payments",
    },
    {
      key: "no_key",
      icon: <KeyRound className="w-3.5 h-3.5" />,
      label: "API 키 미등록",
      hint: "키가 없으면 챗봇이 답하지 못한다",
      count: stats.withoutKey,
      tone: "text-point-amber",
      to: "/admin/customers",
    },
    {
      key: "no_bot",
      icon: <Bot className="w-3.5 h-3.5" />,
      label: "봇 미생성",
      hint: "가입 후 봇을 만들지 않음",
      count: stats.withoutBot,
      tone: "text-point-blue",
      to: "/admin/customers",
    },
  ];

  return (
    <div className="px-6 md:px-8 py-6 flex flex-col gap-3">
      <div className="mb-1">
        <h1 className="text-[18px] font-semibold tracking-tight text-text-main">
          대시보드
        </h1>
        <p className="text-[13px] text-text-sub mt-1">
          전체 운영 현황을 한 눈에 확인합니다.
        </p>
      </div>

      {/* 값이 오기 전에 0을 먼저 그리면 실제 수치로 바뀔 때 숫자가 튀는 깜빡임이 된다. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Wallet className="w-4 h-4" />}
          label="MRR"
          value={formatCurrencyKRW(billing?.mrr ?? 0)}
          note={
            billing
              ? `구독중 ${billing.active_count} · 해지 예정 ${billing.canceled_count}`
              : undefined
          }
          loading={billingLoading}
          large
        />
        <StatCard
          icon={<CreditCard className="w-4 h-4" />}
          label="이번 달 매출"
          value={formatCurrencyKRW(billing?.revenue_this_month ?? 0)}
          note={
            billing ? `누적 ${formatCurrencyKRW(billing.revenue_total)}` : undefined
          }
          loading={billingLoading}
          large
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="유료 전환율"
          value={`${paidRatio.toFixed(1)}%`}
          note={billing ? `유료 ${paidUsers} / 전체 ${planTotal}명` : undefined}
          loading={billingLoading}
          large
        />
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="가입 사용자"
          value={stats.users.toLocaleString()}
          note={
            users
              ? `최근 7일 신규 ${stats.newThisWeek} · 접속 ${stats.activeThisWeek}`
              : undefined
          }
          loading={usersLoading}
          large
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* 퍼널의 시작이라 맨 앞에 둔다. 폭이 넓어 3칸을 다 쓴다. */}
        <Panel
          title="유입 출처"
          subtitle="어느 채널이 결제까지 갔는가 · 가입 시점의 UTM 기준"
          className="lg:col-span-3"
        >
          <Rows loading={acqLoading}>
            {!acquisition || acquisition.rows.length === 0 ? (
              <Empty>가입한 사용자가 없습니다.</Empty>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-text-sub border-b border-line">
                        <th className="text-left font-medium py-1.5">출처</th>
                        <th className="text-left font-medium py-1.5">매체</th>
                        <th className="text-left font-medium py-1.5">캠페인</th>
                        <th className="text-right font-medium py-1.5">가입</th>
                        <th className="text-right font-medium py-1.5">키 등록</th>
                        <th className="text-right font-medium py-1.5">유료</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acquisition.rows.map((r) => (
                        <tr
                          key={`${r.source}|${r.medium}|${r.campaign}`}
                          className="border-b border-line last:border-0 hover:bg-bg-hover transition-colors"
                        >
                          <td className="py-1.5 text-text-main">{r.source}</td>
                          <td className="py-1.5 text-text-sub">
                            {r.medium || "—"}
                          </td>
                          <td className="py-1.5 text-text-sub">
                            {r.campaign || "—"}
                          </td>
                          <td className="py-1.5 text-right font-mono text-text-main">
                            {r.signups}
                          </td>
                          <td className="py-1.5 text-right font-mono text-text-sub">
                            {r.keyed}
                          </td>
                          <td className="py-1.5 text-right font-mono text-text-main">
                            {r.paid}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {acquisition.untracked_signups > 0 && (
                  <p className="text-[11px] text-text-sub leading-relaxed">
                    전체 {acquisition.total_signups}명 중{" "}
                    <strong className="text-text-main">
                      {acquisition.untracked_signups}명
                    </strong>
                    은 UTM 없이 가입했습니다. 직접 방문·검색이거나, 꼬리표를 안 단
                    링크로 들어온 경우입니다.
                  </p>
                )}
              </>
            )}
          </Rows>
        </Panel>

        <Panel
          title="월별 매출"
          subtitle={
            payments && payments.total > paymentItems.length
              ? `최근 ${paymentItems.length}건 기준 (전체 ${payments.total}건)`
              : `최근 ${TREND_MONTHS}개월 · 결제 성공 건 합계`
          }
          action={
            <span className="text-[13px] font-semibold text-text-main">
              {formatCurrencyKRW(trend[trend.length - 1]?.total ?? 0)}
            </span>
          }
          className="lg:col-span-2"
        >
          {paymentsLoading ? (
            <Skeleton className="h-[168px] w-full" />
          ) : trendMax === 0 ? (
            <Empty>아직 결제 내역이 없습니다.</Empty>
          ) : (
            <div className="flex items-stretch gap-2 h-[168px] pt-1">
              {trend.map((b, i) => {
                const isCurrent = i === trend.length - 1;
                return (
                  <div
                    key={b.key}
                    className="flex-1 min-w-0 flex flex-col items-center gap-1.5"
                    title={`${b.label} ${formatCurrencyKRW(b.total)}`}
                  >
                    <div className="flex-1 w-full flex items-end justify-center">
                      <div
                        className="w-full max-w-[44px] rounded-t-[4px] bg-point-blue"
                        style={{
                          height: `${Math.max((b.total / trendMax) * 100, b.total > 0 ? 3 : 0)}%`,
                        }}
                      />
                    </div>
                    <span
                      className={[
                        "text-[10px] border-t border-line w-full text-center pt-1",
                        isCurrent ? "text-text-main font-medium" : "text-text-sub",
                      ].join(" ")}
                    >
                      {b.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="플랜 분포" subtitle="챗봇 구독 기준">
          <Rows loading={billingLoading}>
            {planTotal === 0 ? (
              <Empty>사용자가 없습니다.</Empty>
            ) : (
              <div className="flex flex-col gap-3">
                {/* 세그먼트 사이 2px는 카드 배경이 드러나는 간격이다. */}
                <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden">
                  {PLAN_TIERS.map((t) => {
                    const count = billing?.plan_counts[t.key] ?? 0;
                    if (count === 0) return null;
                    return (
                      <div
                        key={t.key}
                        className={t.fill}
                        style={{ flex: count }}
                        title={`${t.label} ${count}명`}
                      />
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2">
                  {PLAN_TIERS.map((t) => {
                    const count = billing?.plan_counts[t.key] ?? 0;
                    const pct = planTotal > 0 ? (count / planTotal) * 100 : 0;
                    return (
                      <div
                        key={t.key}
                        className="flex items-center gap-2 text-[12px]"
                      >
                        <span
                          className={["w-2 h-2 rounded-full shrink-0", t.fill].join(
                            " ",
                          )}
                        />
                        <span className="text-text-main font-medium">
                          {t.label}
                        </span>
                        <span className="ml-auto font-mono text-text-main">
                          {count}명
                        </span>
                        <span className="w-11 text-right text-[11px] text-text-sub">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Rows>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel
          title="조치 필요"
          subtitle="방치하면 매출·온보딩이 새는 항목"
        >
          <Rows loading={billingLoading || usersLoading || subsLoading}>
            <div className="flex flex-col">
              {alerts.map((a) => (
                <Link
                  key={a.key}
                  to={a.to}
                  className="flex items-center gap-2 py-1.5 border-b border-line last:border-0 hover:bg-bg-hover -mx-1 px-1 rounded transition-colors"
                >
                  {/* 상태는 색만으로 두지 않는다 — 아이콘과 라벨이 항상 함께 간다. */}
                  <span
                    className={a.count > 0 ? a.tone : "text-text-disabled"}
                  >
                    {a.count > 0 ? a.icon : <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="text-[12px] text-text-main">{a.label}</span>
                  <span className="text-[11px] text-text-sub truncate">
                    {a.hint}
                  </span>
                  <span
                    className={[
                      "ml-auto font-mono text-[12px] shrink-0",
                      a.count > 0 ? a.tone : "text-text-disabled",
                    ].join(" ")}
                  >
                    {a.count > 0 ? `${a.count}건` : "정상"}
                  </span>
                </Link>
              ))}
            </div>
          </Rows>
        </Panel>

        <Panel
          title={`다가오는 청구 (${UPCOMING_DAYS}일)`}
          subtitle="정기 청구가 예정된 구독"
          action={<PanelLink to="/admin/payments" label="결제 관리" />}
        >
          <Rows loading={subsLoading}>
            {upcoming.length === 0 ? (
              <Empty>{UPCOMING_DAYS}일 안에 예정된 청구가 없습니다.</Empty>
            ) : (
              <div className="flex flex-col">
                {upcoming.map((s) => {
                  const left = daysUntil(s.next_billing_at!);
                  return (
                    <div
                      key={s.user_id}
                      className="flex items-center gap-2 py-1.5 border-b border-line last:border-0"
                    >
                      <span
                        className="font-mono text-[12px] text-text-main truncate"
                        title={s.email}
                      >
                        {s.email}
                      </span>
                      <span className="text-[11px] text-text-sub shrink-0">
                        {(s.scheduled_plan ?? s.plan ?? "").toUpperCase()}
                      </span>
                      <span className="ml-auto text-[11px] text-text-sub shrink-0">
                        {formatMonthDay(s.next_billing_at)}
                      </span>
                      <span className="w-12 text-right text-[11px] font-medium text-text-main shrink-0">
                        {left <= 0 ? "오늘" : `D-${left}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Rows>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel
          title="최근 결제"
          subtitle="성공·실패 모두"
          action={<PanelLink to="/admin/payments" label="전체 보기" />}
        >
          <Rows loading={paymentsLoading}>
            {paymentItems.length === 0 ? (
              <Empty>결제 내역이 없습니다.</Empty>
            ) : (
              <div className="flex flex-col">
                {paymentItems.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 py-1.5 border-b border-line last:border-0"
                  >
                    <span className="text-[11px] text-text-sub shrink-0 w-10">
                      {formatMonthDay(p.approved_at ?? p.created_at)}
                    </span>
                    <span
                      className="font-mono text-[12px] text-text-main truncate"
                      title={p.email}
                    >
                      {p.email}
                    </span>
                    <span className="text-[11px] text-text-sub shrink-0">
                      {p.plan.toUpperCase()}
                    </span>
                    <span className="ml-auto font-mono text-[12px] text-text-main shrink-0">
                      {formatCurrencyKRW(p.amount)}
                    </span>
                    <span
                      className={[
                        "w-8 text-right text-[11px] shrink-0",
                        p.status === "done"
                          ? "text-point-green"
                          : p.status === "failed"
                            ? "text-point-red"
                            : "text-text-sub",
                      ].join(" ")}
                    >
                      {PAYMENT_STATUS_LABEL[p.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Rows>
        </Panel>

        <Panel
          title="최근 가입"
          subtitle="가입 순"
          action={<PanelLink to="/admin/customers" label="고객 관리" />}
        >
          <Rows loading={usersLoading}>
            {userList.length === 0 ? (
              <Empty>가입한 사용자가 없습니다.</Empty>
            ) : (
              <div className="flex flex-col">
                {userList.slice(0, 5).map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-2 py-1.5 border-b border-line last:border-0"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-text-disabled shrink-0" />
                    <span
                      className="font-mono text-[12px] text-text-main truncate"
                      title={u.email}
                    >
                      {u.email}
                    </span>
                    <span className="text-[11px] text-text-sub shrink-0">
                      {(u.plan ?? "free").toUpperCase()}
                    </span>
                    <span className="ml-auto text-[11px] text-text-sub shrink-0">
                      {formatMonthDay(u.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Rows>
        </Panel>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Cpu className="w-4 h-4" />}
          label="총 챗봇"
          value={stats.bots.toLocaleString()}
          loading={usersLoading}
        />
        <StatCard
          icon={<MessagesSquare className="w-4 h-4" />}
          label="누적 세션"
          value={stats.sessions.toLocaleString()}
          loading={usersLoading}
        />
        <StatCard
          icon={<KeyRound className="w-4 h-4" />}
          label="등록된 키"
          value={stats.keys}
          loading={usersLoading}
        />
        <StatCard
          icon={<Cpu className="w-4 h-4" />}
          label="활성 모델"
          value={`${stats.activeModels} / ${stats.totalModels}`}
          loading={modelsLoading}
        />
      </div>
    </div>
  );
};

export default AdminMain;
