import { useMemo, useState } from "react";
import {
  CreditCard,
  ExternalLink,
  ReceiptText,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import Table, { Column } from "@admin/component/ui/table/table";
import Pagination from "@admin/component/ui/pagination";
import StatCard from "@admin/component/ui/statCard";
import { useGet } from "@shared/hooks/common/useAPI";
import { formatCurrencyKRW } from "@shared/utils/format/number";
import { describeMethod } from "@chatbase/types/payment";
import {
  PAYMENT_FETCH_LIMIT,
  PAYMENT_STATUS_LABEL,
  SUBSCRIPTION_FILTERS,
  SUBSCRIPTION_STATUS_LABEL,
  type AdminBillingSummary,
  type AdminPayment,
  type AdminPaymentList,
  type AdminSubscription,
  type SubscriptionFilter,
} from "@admin/types/billing";

const PAGE_SIZE = 10;

/** 값이 없는 칸. 한 줄 표에서 눈에 덜 걸리게 짧은 하이픈을 쓴다. */
const EMPTY = "-";

type Tab = "subscriptions" | "payments";

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("ko-KR") : EMPTY;

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { hour12: false }) : EMPTY;

const planLabel = (plan: string | null) => (plan ? plan.toUpperCase() : EMPTY);

type Tone = "green" | "amber" | "red" | "gray";

const toneClass: Record<Tone, string> = {
  green: "bg-success-bg text-point-green",
  amber: "bg-warning-bg text-point-amber",
  red: "bg-error-bg text-point-red",
  gray: "bg-bg-sub text-text-sub",
};

const Badge = ({
  tone,
  label,
  title,
}: {
  tone: Tone;
  label: string;
  title?: string;
}) => (
  <span
    title={title}
    className={[
      "inline-flex items-center shrink-0 px-1.5 h-5 rounded text-[11px] font-medium",
      toneClass[tone],
    ].join(" ")}
  >
    {label}
  </span>
);

const SUBSCRIPTION_TONE: Record<AdminSubscription["status"], Tone> = {
  active: "green",
  canceled: "amber",
  past_due: "red",
  none: "gray",
};

const PAYMENT_TONE: Record<AdminPayment["status"], Tone> = {
  done: "green",
  failed: "red",
  canceled: "gray",
};

/** 표는 한 줄로 읽는다. 넘치는 값은 잘라내고 전체는 title로 넘긴다. */
const Line = ({
  children,
  className = "",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) => (
  <span
    title={title}
    className={["block truncate text-[12px] text-text-main", className].join(
      " ",
    )}
  >
    {children}
  </span>
);

const AdminPayments = () => {
  const [tab, setTab] = useState<Tab>("subscriptions");
  const [filter, setFilter] = useState<SubscriptionFilter>("all");
  const [subPage, setSubPage] = useState(1);
  const [payPage, setPayPage] = useState(1);

  const { data: summary, isLoading: summaryLoading } =
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

  const filteredSubs = useMemo(() => {
    const rows = subscriptions ?? [];
    return filter === "all" ? rows : rows.filter((s) => s.status === filter);
  }, [subscriptions, filter]);

  const pagedSubs = useMemo(
    () => filteredSubs.slice((subPage - 1) * PAGE_SIZE, subPage * PAGE_SIZE),
    [filteredSubs, subPage],
  );

  const paymentItems = useMemo(() => payments?.items ?? [], [payments]);
  const pagedPayments = useMemo(
    () => paymentItems.slice((payPage - 1) * PAGE_SIZE, payPage * PAGE_SIZE),
    [paymentItems, payPage],
  );

  const subscriptionColumns: Column[] = useMemo(
    () => [
      {
        key: "name",
        header: "이름",
        width: "110px",
        align: "center",
        render: (r: AdminSubscription) => (
          <Line title={r.name ?? undefined}>{r.name || EMPTY}</Line>
        ),
      },
      {
        key: "email",
        header: "이메일",
        width: "230px",
        align: "center",
        render: (r: AdminSubscription) => (
          <Line className="font-mono" title={r.email}>
            {r.email}
          </Line>
        ),
      },
      {
        key: "status",
        header: "상태",
        width: "130px",
        align: "center",
        render: (r: AdminSubscription) => (
          <div className="flex items-center justify-center gap-1">
            <Badge
              tone={SUBSCRIPTION_TONE[r.status]}
              label={SUBSCRIPTION_STATUS_LABEL[r.status]}
            />
            {r.retry_count > 0 && (
              <span
                className="text-[10px] text-point-red shrink-0"
                title={`이번 주기 청구 실패 ${r.retry_count}회`}
              >
                재시도 {r.retry_count}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "plan",
        header: "플랜",
        width: "150px",
        align: "center",
        render: (r: AdminSubscription) => (
          <div className="flex items-center justify-center gap-1">
            <span className="text-[12px] font-medium text-text-main">
              {planLabel(r.plan)}
            </span>
            {r.scheduled_plan && (
              <span
                className="text-[10px] text-text-sub shrink-0"
                title="다음 결제일부터 적용될 플랜"
              >
                → {planLabel(r.scheduled_plan)}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "method",
        header: "결제수단",
        width: "170px",
        align: "center",
        render: (r: AdminSubscription) => {
          if (!r.method) {
            return (
              <Line className="text-text-disabled text-[11px]">
                {r.method_count > 0 ? `미지정 (${r.method_count}장)` : EMPTY}
              </Line>
            );
          }
          const label = describeMethod(r.method);
          return (
            <Line title={label}>
              {label}
              {r.method_count > 1 && (
                <span className="text-text-sub"> +{r.method_count - 1}</span>
              )}
            </Line>
          );
        },
      },
      {
        key: "next_billing_at",
        header: "다음 청구",
        width: "130px",
        align: "center",
        render: (r: AdminSubscription) => (
          <Line
            className={r.status === "canceled" ? "text-point-amber" : ""}
            title={r.status === "canceled" ? "이용 종료일" : undefined}
          >
            {formatDate(r.next_billing_at)}
          </Line>
        ),
      },
      {
        key: "paid_total",
        header: "누적 결제",
        width: "140px",
        align: "center",
        render: (r: AdminSubscription) => (
          <Line className="font-mono">
            {formatCurrencyKRW(r.paid_total)}
            <span className="text-text-sub"> · {r.paid_count}건</span>
          </Line>
        ),
      },
      {
        key: "started_at",
        header: "구독 시작",
        width: "120px",
        align: "center",
        render: (r: AdminSubscription) => (
          <Line className="text-text-sub text-[11px]">
            {formatDate(r.started_at)}
          </Line>
        ),
      },
    ],
    [],
  );

  const paymentColumns: Column[] = useMemo(
    () => [
      {
        key: "created_at",
        header: "일시",
        width: "160px",
        align: "center",
        render: (r: AdminPayment) => (
          <Line className="text-text-sub text-[11px]">
            {formatDateTime(r.approved_at ?? r.created_at)}
          </Line>
        ),
      },
      {
        key: "name",
        header: "이름",
        width: "110px",
        align: "center",
        render: (r: AdminPayment) => (
          <Line title={r.name ?? undefined}>{r.name || EMPTY}</Line>
        ),
      },
      {
        key: "email",
        header: "이메일",
        width: "230px",
        align: "center",
        render: (r: AdminPayment) => (
          <Line className="font-mono" title={r.email}>
            {r.email}
          </Line>
        ),
      },
      {
        key: "plan",
        header: "플랜",
        width: "100px",
        align: "center",
        render: (r: AdminPayment) => (
          <Line className="font-medium">{planLabel(r.plan)}</Line>
        ),
      },
      {
        key: "amount",
        header: "금액",
        width: "110px",
        align: "center",
        render: (r: AdminPayment) => (
          <Line className="font-mono">{formatCurrencyKRW(r.amount)}</Line>
        ),
      },
      {
        key: "status",
        header: "상태",
        width: "230px",
        align: "center",
        render: (r: AdminPayment) => (
          <div className="flex items-center justify-center gap-1 min-w-0">
            <Badge
              tone={PAYMENT_TONE[r.status]}
              label={PAYMENT_STATUS_LABEL[r.status]}
              title={r.failure_code ?? undefined}
            />
            {/* 실패 사유가 CS의 시작점이라 표에서 바로 읽히게 둔다. */}
            {r.failure_message && (
              <span
                className="text-[10px] text-point-red truncate"
                title={r.failure_message}
              >
                {r.failure_message}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "receipt_url",
        header: "영수증",
        width: "90px",
        align: "center",
        render: (r: AdminPayment) =>
          r.receipt_url ? (
            <a
              href={r.receipt_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-point-blue hover:underline"
            >
              열기
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="text-[11px] text-text-disabled">{EMPTY}</span>
          ),
      },
      {
        key: "order_id",
        header: "주문번호",
        width: "210px",
        align: "center",
        render: (r: AdminPayment) => (
          <Line
            className="font-mono text-[11px] text-text-sub"
            title={
              r.payment_key ? `${r.order_id}\n${r.payment_key}` : r.order_id
            }
          >
            {r.order_id}
          </Line>
        ),
      },
    ],
    [],
  );

  const handleChangeFilter = (next: SubscriptionFilter) => {
    setFilter(next);
    setSubPage(1);
  };

  return (
    <div className="px-6 md:px-8 pt-6 flex flex-col gap-5 min-h-full">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight text-text-main">
          결제 관리
        </h1>
        <p className="text-[13px] text-text-sub mt-1">
          토스페이먼츠 정기결제 구독 현황과 결제 내역 (조회 전용)
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Wallet className="w-4 h-4" />}
          label="MRR"
          value={formatCurrencyKRW(summary?.mrr ?? 0)}
          note={
            summary
              ? `구독중 ${summary.active_count} · 해지 예정 ${summary.canceled_count}`
              : undefined
          }
          loading={summaryLoading}
        />
        <StatCard
          icon={<CreditCard className="w-4 h-4" />}
          label="이번 달 매출"
          value={formatCurrencyKRW(summary?.revenue_this_month ?? 0)}
          note={
            summary
              ? `누적 ${formatCurrencyKRW(summary.revenue_total)}`
              : undefined
          }
          loading={summaryLoading}
        />
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="유료 사용자"
          value={
            (summary?.plan_counts.standard ?? 0) +
            (summary?.plan_counts.premium ?? 0)
          }
          note={
            summary
              ? `STANDARD ${summary.plan_counts.standard ?? 0} · PREMIUM ${
                  summary.plan_counts.premium ?? 0
                } · FREE ${summary.plan_counts.free ?? 0}`
              : undefined
          }
          loading={summaryLoading}
        />
        {/* 청구 실패는 방치하면 그대로 이탈이라 항상 눈에 걸리게 둔다. */}
        <StatCard
          icon={<TriangleAlert className="w-4 h-4" />}
          label="청구 실패"
          value={summary?.past_due_count ?? 0}
          note={summary ? `최근 30일 실패 ${summary.failed_30d}건` : undefined}
          loading={summaryLoading}
          tone={(summary?.past_due_count ?? 0) > 0 ? "danger" : "default"}
        />
      </div>

      <div className="flex items-center gap-1 border-b border-line">
        {(
          [
            { value: "subscriptions", label: "구독 현황", icon: CreditCard },
            { value: "payments", label: "결제 내역", icon: ReceiptText },
          ] as const
        ).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={[
              "inline-flex items-center gap-1.5 px-3 h-9 text-[13px] font-medium border-b-2 -mb-px transition-colors",
              tab === value
                ? "border-text-main text-text-main"
                : "border-transparent text-text-sub hover:text-text-main",
            ].join(" ")}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* 페이지네이션은 mt-auto로 페이지 맨 아래에 붙인다 — 건수가 적은 페이지에서도
          위치가 흔들리지 않아야 다음 장으로 넘기는 자리가 매번 같다. */}
      {tab === "subscriptions" ? (
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {SUBSCRIPTION_FILTERS.map(({ value, label }) => {
                const count =
                  value === "all"
                    ? (subscriptions ?? []).length
                    : (subscriptions ?? []).filter((s) => s.status === value)
                        .length;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleChangeFilter(value)}
                    className={[
                      "inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[12px] font-medium transition-colors",
                      filter === value
                        ? "bg-main-active text-white"
                        : "bg-bg-sub text-text-sub hover:text-text-main",
                    ].join(" ")}
                  >
                    {label}
                    <span className="font-mono text-[11px] opacity-70">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <span className="text-[12px] text-text-sub">
              총{" "}
              <span className="font-semibold text-text-main">
                {filteredSubs.length}
              </span>
              건
            </span>
          </div>

          <Table
            columns={subscriptionColumns}
            data={pagedSubs}
            size="sm"
            loading={subsLoading}
          />

          <div className="mt-auto pt-2 pb-5">
            <Pagination
              page={subPage}
              total={filteredSubs.length}
              pageSize={PAGE_SIZE}
              onChange={setSubPage}
              variant="flow"
              size="sm"
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-end justify-end gap-3">
            <span className="text-[12px] text-text-sub">
              {payments && payments.total > paymentItems.length
                ? `최근 ${paymentItems.length}건 표시 (전체 ${payments.total}건)`
                : `총 ${paymentItems.length}건`}
            </span>
          </div>

          <Table
            columns={paymentColumns}
            data={pagedPayments}
            size="sm"
            loading={paymentsLoading}
          />

          <div className="mt-auto pt-2 pb-5">
            <Pagination
              page={payPage}
              total={paymentItems.length}
              pageSize={PAGE_SIZE}
              onChange={setPayPage}
              variant="flow"
              size="sm"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPayments;
