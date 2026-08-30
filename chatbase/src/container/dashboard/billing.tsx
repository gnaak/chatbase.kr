import { useEffect, useRef, useState } from "react";
import {
  Check,
  CreditCard,
  Mail,
  Minus,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { useQueryClient } from "@tanstack/react-query";
import Topbar from "@/component/layout/topbar";
import Card from "@/ui/card";
import Button from "@/ui/button";
import ConfirmModal from "@/ui/confirmModal";
import UpgradeModal from "@/component/billing/upgradeModal";
import Skeleton from "@/ui/skeleton";
import { useGet, usePost } from "@/hooks/common/useAPI";
import { useToast } from "@/hooks/common/useToast";
import {
  BILLING_BETA,
  ENTERPRISE,
  PLANS,
  planLosses,
  type Plan,
} from "@/types/plan";
import { planToPlanName, type UsageSummary } from "@/types/usage";
import {
  describeMethod,
  type BillingMethod,
  type MethodSelection,
  type SchedulePlanRequest,
  type PaymentConfig,
  type PaymentHistory,
  type SubscribeRequest,
  type Subscription,
} from "@/types/payment";

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("ko-KR") : "—";

/**
 * 토스 에러를 한 줄로 다시 쓴 문구.
 * 토스 원문은 "…입니다. 다른 카드를 이용해 주시기 바랍니다." 처럼 길어서
 * 토스트가 여러 줄로 접힌다. 사용자가 할 일만 남겨 한 줄로 만든다.
 */
const BILLING_ERROR_MESSAGES: Record<string, string> = {
  // 자동결제는 국내 발급 카드만 지원한다. 해외 카드·기프트·선불카드는 등록되지 않는다.
  NOT_SUPPORTED_CARD_TYPE: "국내 발급 신용·체크카드만 등록할 수 있습니다.",
  INVALID_CARD_NUMBER: "카드번호를 다시 확인해 주세요.",
  INVALID_CARD_EXPIRATION: "유효기간을 다시 확인해 주세요.",
  INVALID_CARD_PASSWORD: "카드 비밀번호를 다시 확인해 주세요.",
  EXCEED_MAX_AUTH_COUNT: "인증 시도 횟수를 초과했습니다. 잠시 후 시도해 주세요.",
  REJECT_CARD_COMPANY: "카드사에서 거절했습니다. 카드사에 문의해 주세요.",
};

const Billing = () => {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: usage, isLoading: usageLoading } = useGet<UsageSummary>(
    "api/usage/",
    ["usage"],
  );
  const { data: subscription, isLoading: subLoading } = useGet<Subscription>(
    "api/payment/subscription",
    ["subscription"],
  );
  const { data: config } = useGet<PaymentConfig>("api/payment/config", [
    "payment-config",
  ]);
  const { data: methods, isLoading: methodsLoading } = useGet<BillingMethod[]>(
    "api/payment/methods",
    ["billing-methods"],
  );
  const { data: payments } = useGet<PaymentHistory[]>("api/payment/payments", [
    "payments",
  ]);

  const cards = methods ?? [];
  // 카드 목록과 구독 상태를 둘 다 알아야 "어떤 카드로 결제 중인지"를 그릴 수 있다.
  const cardsLoading = methodsLoading || subLoading;
  // 토스 등록창을 열려면 클라이언트 키와 customerKey가 둘 다 있어야 한다.
  const canRegisterCard = !!config?.client_key && !!subscription?.customer_key;

  const [target, setTarget] = useState<Plan | null>(null);
  const [selected, setSelected] = useState<MethodSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<BillingMethod | null>(null);
  const [downgradeTarget, setDowngradeTarget] = useState<Plan | null>(null);

  const subscribeMutation = usePost<
    SubscribeRequest,
    { subscription: Subscription; plan: string }
  >("api/payment/subscribe");
  const defaultMutation = usePost<{ method_id: number }, BillingMethod>(
    "api/payment/methods/default",
  );
  const removeMutation = usePost<{ method_id: number }, void>(
    "api/payment/methods/delete",
  );
  const cancelMutation = usePost<void, Subscription>(
    "api/payment/subscription/cancel",
  );
  const scheduleMutation = usePost<SchedulePlanRequest, Subscription>(
    "api/payment/subscription/schedule",
  );

  const refresh = (...keys: string[]) =>
    keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

  /**
   * 토스 등록창이 실패하면 failUrl(이 화면)로 `code`·`message`를 붙여 돌려보낸다.
   * 이걸 읽지 않으면 등록이 실패해도 화면에는 "등록된 카드가 없습니다"만 남아
   * 사용자도 우리도 원인을 알 수 없다.
   */
  const errorShown = useRef(false);
  useEffect(() => {
    if (errorShown.current) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const message = params.get("message");
    if (!code && !message) return;

    errorShown.current = true;
    // 아는 코드면 우리 한 줄 문구로 갈음하고, 모르는 코드만 토스 원문을 쓴다.
    const known = code ? BILLING_ERROR_MESSAGES[code] : undefined;
    toast.error(known ?? message ?? `카드 등록에 실패했습니다. (${code})`);
    // 새로고침할 때마다 같은 토스트가 뜨지 않도록 주소에서 지운다.
    window.history.replaceState({}, "", "/dashboard/billing");
  }, [toast]);

  /**
   * 토스 카드 등록창을 연다. 등록이 끝나면 successUrl로 리다이렉트되고,
   * 빌링키 발급은 그 화면(billingSuccess)에서 서버가 처리한다.
   *
   * `planKey`를 함께 넘기면 등록에 이어 결제까지 진행된다.
   * 결제수단만 추가할 때는 넘기지 않는다.
   *
   * 토스 자동결제는 국내 발급 카드만 지원한다 — 수단을 고를 여지가 없어
   * `method: "CARD"`로 고정한다.
   */
  const openCardRegistration = async (planKey?: string) => {
    if (!config?.client_key || !subscription?.customer_key) {
      toast.error("결제 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    setBusy(true);
    try {
      const tossPayments = await loadTossPayments(config.client_key);
      const payment = tossPayments.payment({
        customerKey: subscription.customer_key,
      });
      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: `${window.location.origin}/dashboard/billing/success${
          planKey ? `?plan=${planKey}` : ""
        }`,
        failUrl: `${window.location.origin}/dashboard/billing`,
      });
    } catch (err) {
      // 사용자가 등록창을 닫은 경우도 여기로 온다 — 조용히 닫는다.
      const message = err instanceof Error ? err.message : "";
      if (message && !/cancel/i.test(message)) toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * 모달에서 고른 카드로 결제한다.
   * 등록된 카드면 바로 청구하고, 새 카드면 등록창을 거쳐
   * successUrl에서 등록 → 결제가 이어진다.
   */
  const handleSubscribe = () => {
    if (!target || !selected) return;
    const planKey = target.name.toLowerCase();

    if (selected.kind === "new") {
      void openCardRegistration(planKey);
      return;
    }

    setBusy(true);
    subscribeMutation.mutate(
      { plan: planKey, method_id: selected.id },
      {
        onSuccess: () => {
          toast.success(`${target.name} 플랜이 시작되었습니다.`);
          refresh("subscription", "payments", "usage");
          setTarget(null);
        },
        onError: (err) => toast.error(err.message || "결제에 실패했습니다."),
        onSettled: () => setBusy(false),
      },
    );
  };

  const handleSetDefault = (method: BillingMethod) => {
    defaultMutation.mutate(
      { method_id: method.id },
      {
        onSuccess: () => {
          toast.success("다음 결제부터 이 카드로 청구됩니다.");
          refresh("billing-methods", "subscription");
        },
        onError: (err) => toast.error(err.message || "변경에 실패했습니다."),
      },
    );
  };

  const handleRemove = () => {
    if (!removeTarget) return;
    removeMutation.mutate(
      { method_id: removeTarget.id },
      {
        onSuccess: () => {
          toast.success("카드가 삭제되었습니다.");
          refresh("billing-methods", "subscription");
          setRemoveTarget(null);
        },
        onError: (err) => toast.error(err.message || "삭제에 실패했습니다."),
      },
    );
  };

  /**
   * 플랜 하향. 지금 결제하지 않고 다음 결제일에 반영되도록 예약한다.
   * 즉시 처리하면 이미 낸 상위 플랜 요금이 그대로 날아간다.
   */
  const handleDowngrade = () => {
    if (!downgradeTarget) return;
    scheduleMutation.mutate(
      { plan: downgradeTarget.name.toLowerCase() },
      {
        onSuccess: () => {
          toast.success(
            `다음 결제일부터 ${downgradeTarget.name} 플랜으로 청구됩니다.`,
          );
          refresh("subscription");
          setDowngradeTarget(null);
        },
        onError: (err) => toast.error(err.message || "변경에 실패했습니다."),
      },
    );
  };

  const handleCancelSchedule = () => {
    scheduleMutation.mutate(
      { plan: null },
      {
        onSuccess: () => {
          toast.success("플랜 변경 예약을 취소했습니다.");
          refresh("subscription");
        },
        onError: (err) => toast.error(err.message || "취소에 실패했습니다."),
      },
    );
  };

  const handleCancel = () => {
    cancelMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(
          "구독이 해지되었습니다. 남은 기간은 그대로 이용하실 수 있습니다.",
        );
        refresh("subscription");
        setCancelOpen(false);
      },
      onError: (err) => toast.error(err.message || "해지에 실패했습니다."),
    });
  };

  /**
   * 플랜 모달을 열 때 결제 수단을 미리 골라둔다.
   * 등록된 게 있으면 정기결제 중인 것 > 기본 > 첫 번째 순,
   * 하나도 없으면 새 카드 등록을 기본값으로 둔다(버튼을 바로 누를 수 있게).
   */
  const openPlanModal = (plan: Plan) => {
    const preferred =
      cards.find((card) => card.id === subscription?.billing_method_id) ??
      cards.find((card) => card.is_default) ??
      cards[0];
    setSelected(
      preferred
        ? { kind: "saved", id: preferred.id }
        : { kind: "new" },
    );
    setTarget(plan);
  };

  // 플랜을 못 불러온 동안은 가장 보수적인 Free로 그린다(권한을 넓게 보여주지 않는다).
  const currentPlanName = usage ? planToPlanName(usage.plan) : "FREE";
  const foundIdx = PLANS.findIndex((plan) => plan.name === currentPlanName);
  const currentIdx = foundIdx >= 0 ? foundIdx : 0;
  const currentPlan = PLANS[currentIdx];

  // 하향 확인창에서 "무엇이 빠지는지" 미리 보여주기 위한 목록.
  const downgradeLosses = downgradeTarget
    ? planLosses(currentPlan.limits, downgradeTarget.limits)
    : [];

  const limit = usage?.messages_limit ?? null;
  const used = usage?.messages_used ?? 0;
  const ratio =
    limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <>
      <Topbar title="결제" description="요금제와 결제 정보를 관리합니다." />

      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
          {BILLING_BETA && (
            <Card variant="outline" className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-text-sub" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-text-main">
                    유료 플랜은 준비 중입니다
                  </div>
                  <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
                    정식 출시되면 가입하신 메일로 알려드릴게요. 그전까지 결제는 받지
                    않습니다. 지금 더 필요한 기능이 있으시면 왼쪽 1:1 문의로 알려주세요
                    — 베타 기간에는 열어드립니다.
                  </p>
                </div>
              </div>
            </Card>
          )}
          {/* 현재 플랜 — 플랜을 모르는 동안 FREE로 그려두면 유료 사용자에게 플랜이
              바뀌는 깜빡임으로 보인다. 값이 올 때까지는 스켈레톤을 유지한다. */}
          <Card variant="elevated" className="p-6">
            {usageLoading ? (
              <div className="flex flex-col gap-1">
                <Skeleton className="h-[13px] w-16" />
                <Skeleton className="h-[29px] w-40 mt-1" />
                <Skeleton className="h-[17px] w-full max-w-md mt-1.5" />
              </div>
            ) : (
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div className="min-w-0">
                  <span className="text-[11px] font-mono text-text-sub">
                    현재 플랜
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-[24px] font-semibold tracking-display text-text-main">
                      {currentPlan.name}
                    </span>
                    <span className="text-[14px] text-text-sub">
                      {currentPlan.price}
                      {currentPlan.unit && ` ${currentPlan.unit}`}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-text-sub leading-relaxed">
                    {currentIdx === 0
                      ? "무료 플랜을 이용 중입니다. 유료 플랜으로 올리시면 대화 건수 제한이 없어집니다."
                      : "매달 자동으로 결제됩니다. 언제든 해지하실 수 있습니다."}
                  </p>

                  {/* 하향 예약 — 지금은 상위 플랜을 그대로 쓰고 있으므로
                      "언제부터 무엇으로 바뀌는지"를 분명히 알려야 한다. */}
                  {subscription?.scheduled_plan && (
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] text-text-sub">
                        {formatDate(subscription.next_billing_at)}부터{" "}
                        <span className="text-text-main font-medium">
                          {subscription.scheduled_plan.toUpperCase()}
                        </span>
                        로 변경됩니다
                      </span>
                      <button
                        type="button"
                        onClick={handleCancelSchedule}
                        className="text-[12px] text-text-sub hover:text-text-main underline underline-offset-2 transition-colors"
                      >
                        예약 취소
                      </button>
                    </div>
                  )}
                </div>

                {currentIdx === 0 && (
                  <a href="#plans" className="shrink-0 ml-auto">
                    <Button size="md" pill variant="primary">
                      플랜 올리기
                    </Button>
                  </a>
                )}
              </div>
            )}
          </Card>

          {/* 이번 달 사용량 */}
          <Card variant="outline" className="p-6">
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
              <h3 className="text-[14px] font-semibold tracking-tight text-text-main">
                이번 달 대화
                {usage && (
                  <span className="ml-2 text-[12px] font-normal font-mono text-text-sub">
                    {usage.year_month}
                  </span>
                )}
              </h3>
              {usageLoading ? (
                // 0건 · 제한 없음 → 실제 사용량으로 갈아치우는 대신 자리만 잡아둔다.
                <Skeleton className="h-[22px] w-28" />
              ) : (
                <span className="text-[13px] text-text-main">
                  <span className="font-semibold tracking-display text-[18px]">
                    {used.toLocaleString()}
                  </span>
                  <span className="text-text-sub">
                    {limit === null
                      ? " 건 · 제한 없음"
                      : ` / ${limit.toLocaleString()}건`}
                  </span>
                </span>
              )}
            </div>

            {usageLoading && <Skeleton className="h-1.5 w-full rounded-full" />}

            {!usageLoading && limit !== null && (
              <>
                <div className="h-1.5 rounded-full bg-bg-sub overflow-hidden">
                  <div
                    className={[
                      "h-full rounded-full transition-[width] duration-300",
                      usage?.exceeded
                        ? "bg-point-red"
                        : usage?.warn
                          ? "bg-warning"
                          : "bg-text-main",
                    ].join(" ")}
                    style={{ width: `${ratio}%` }}
                  />
                </div>
                {usage?.exceeded ? (
                  <p className="mt-2.5 text-[12px] text-text-sub leading-relaxed">
                    한도를 모두 사용했습니다. 플랜을 올리면 제한 없이 이용할 수
                    있습니다.
                  </p>
                ) : usage?.warn ? (
                  <p className="mt-2.5 text-[12px] text-text-sub leading-relaxed">
                    한도의 80%를 넘었습니다. 유료 플랜은 대화 건수 제한이 없습니다.
                  </p>
                ) : null}
              </>
            )}

            {usage && usage.per_bot.length > 0 && (
              <div className="mt-5 pt-4 border-t border-line flex flex-col gap-2">
                <span className="text-[11px] font-mono text-text-sub">
                  챗봇별
                </span>
                {usage.per_bot.map((row) => (
                  <div
                    key={row.bot_id}
                    className="flex items-center justify-between gap-3 text-[12px]"
                  >
                    <span className="text-text-sub truncate">
                      {row.bot_name || `삭제된 챗봇 #${row.bot_id}`}
                    </span>
                    <span className="text-text-main shrink-0">
                      {row.message_count.toLocaleString()}건
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-[11px] text-text-sub leading-relaxed">
              방문자 질문 1건을 1건으로 셉니다. 대시보드 미리보기는 포함되지
              않습니다.
            </p>
          </Card>

          {/* 플랜 선택 */}
          <Card variant="outline" className="p-6" id="plans">
            <h3 className="text-[14px] font-semibold tracking-tight text-text-main mb-1">
              요금제
            </h3>
            <p className="text-[12px] text-text-sub mb-5">
              유료 플랜은 대화 건수를 제한하지 않습니다 · 부가세 별도 · 연간
              결제 시 2개월 무료
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PLANS.map((plan, idx) => {
                const isCurrent = idx === currentIdx;
                // 하향 예약이 걸린 플랜. 아직 적용 전이라 "이용 중"과 구분해야 한다.
                const isScheduled =
                  subscription?.scheduled_plan === plan.name.toLowerCase();
                return (
                  <div
                    key={plan.name}
                    className={[
                      "p-5 rounded-comfy bg-bg-card flex flex-col",
                      !usageLoading && isCurrent
                        ? "shadow-card dark:shadow-card-dark"
                        : "shadow-border",
                    ].join(" ")}
                  >
                    {/* min-h-5: '이용 중' 배지가 뒤늦게 붙어도 카드 높이가 밀리지 않게 자리를 미리 준다. */}
                    <div className="flex items-center justify-between gap-2 min-h-5">
                      <span className="text-[13px] font-semibold tracking-tight text-text-main">
                        {plan.name}
                      </span>
                      {!usageLoading && isCurrent && (
                        <span className="inline-flex items-center px-2 h-5 rounded-full bg-info-bg text-info text-[10px] font-medium">
                          이용 중
                        </span>
                      )}
                      {!usageLoading && !isCurrent && isScheduled && (
                        <span className="inline-flex items-center px-2 h-5 rounded-full bg-bg-sub text-text-sub text-[10px] font-medium">
                          변경 예정
                        </span>
                      )}
                    </div>
                    <div className="text-[18px] font-semibold tracking-tight text-text-main mt-1.5 mb-4">
                      {plan.price}
                      {plan.unit && (
                        <span className="ml-1 text-[12px] font-normal text-text-sub">
                          {plan.unit}
                        </span>
                      )}
                    </div>

                    <ul className="flex flex-col gap-2 mb-5 flex-1">
                      {plan.features.map(({ label, off, note }) => (
                        <li key={label} className="flex items-start gap-2">
                          <span
                            className={[
                              "shrink-0 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full mt-0.5",
                              off ? "bg-bg-sub" : "bg-success-bg",
                            ].join(" ")}
                          >
                            {off ? (
                              <Minus className="w-2 h-2 text-text-disabled" />
                            ) : (
                              <Check className="w-2 h-2 text-success" />
                            )}
                          </span>
                          <span
                            className={[
                              "text-[12px] leading-relaxed",
                              off ? "text-text-disabled" : "text-text-main",
                            ].join(" ")}
                          >
                            {label}
                            {note && (
                              <span className="ml-1 text-[10px] text-text-sub font-mono">
                                {note}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* 현재 플랜을 모르면 올리기/내리기 중 무엇인지 알 수 없다.
                        추측해서 그리면 라벨이 바뀌므로 버튼과 같은 높이의 스켈레톤을 둔다. */}
                    {usageLoading ? (
                      <Skeleton className="h-8 w-full rounded-full" />
                    ) : (
                      <Button
                        size="sm"
                        pill
                        full
                        variant={idx > currentIdx ? "primary" : "secondary"}
                        disabled={
                          (BILLING_BETA && idx > 0) ||
                          isCurrent ||
                          idx === 0 ||
                          isScheduled
                        }
                        onClick={() =>
                          // 상향은 지금 결제하고 바로 올린다.
                          // 하향은 결제 없이 다음 결제일에 반영되도록 예약한다.
                          idx > currentIdx
                            ? openPlanModal(plan)
                            : setDowngradeTarget(plan)
                        }
                      >
                        {BILLING_BETA && idx > 0
                          ? "준비 중"
                          : isCurrent
                            ? "이용 중"
                            : isScheduled
                              ? "변경 예정"
                              : idx > currentIdx
                                ? "이 플랜으로 올리기"
                                : "이 플랜으로 내리기"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 결제 수단 */}
          <Card variant="outline" className="p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-[14px] font-semibold tracking-tight text-text-main">
                  결제 수단
                </h3>
                {subLoading ? (
                  // 구독 상태를 모르는 채 "등록해두면..." 안내를 먼저 띄우면
                  // 구독 중인 사용자에게 다음 결제일로 문장이 바뀌는 깜빡임이 보인다.
                  <Skeleton className="h-[17px] w-40 mt-0.5" />
                ) : subscription?.status === "active" ? (
                  <p className="text-[12px] text-text-sub mt-0.5">
                    다음 결제일 {formatDate(subscription.next_billing_at)}
                  </p>
                ) : subscription?.status === "canceled" ? (
                  <p className="text-[12px] text-text-sub mt-0.5">
                    해지됨 · {formatDate(subscription.next_billing_at)}까지 이용
                    가능합니다
                  </p>
                ) : (
                  // 위 두 갈래(다음 결제일 / 해지 안내)와 달리 이건 상태가 아니라
                  // 권유 문구다. 좁은 화면에서 "카드 등록" 버튼과 자리를 다툴
                  // 값어치가 없어 여기만 감춘다.
                  <p className="hidden sm:block text-[12px] text-text-sub mt-0.5">
                    등록해두면 플랜을 시작할 때 바로 선택할 수 있습니다.
                  </p>
                )}
              </div>
              <Button
                size="sm"
                pill
                variant="secondary"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                disabled={BILLING_BETA || busy || !canRegisterCard}
                onClick={() => void openCardRegistration()}
              >
                카드 등록
              </Button>
            </div>

            {cardsLoading ? (
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="w-9 h-9 rounded-DEFAULT shrink-0" />
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
            ) : cards.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-7 rounded-DEFAULT border border-dashed border-line">
                <div className="w-9 h-9 rounded-full bg-bg-sub flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-text-sub" />
                </div>
                <p className="text-[12px] text-text-sub">등록된 카드가 없습니다.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {cards.map((card) => {
                  const inUse = card.id === subscription?.billing_method_id;
                  return (
                    <div
                      key={card.id}
                      className={[
                        "group flex items-center gap-3 px-3 py-2.5 rounded-DEFAULT transition-colors",
                        inUse ? "bg-bg-card shadow-border" : "hover:bg-bg-hover",
                      ].join(" ")}
                    >
                      <div className="w-9 h-9 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center shrink-0">
                        <CreditCard className="w-4 h-4 text-text-sub" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[13px] tabular-nums text-text-main truncate">
                            {card.masked_number ?? describeMethod(card)}
                          </span>
                          {inUse ? (
                            <span className="shrink-0 inline-flex items-center px-1.5 h-[18px] rounded-full bg-info-bg text-info text-[10px] font-medium">
                              정기결제
                            </span>
                          ) : (
                            card.is_default && (
                              <span className="shrink-0 inline-flex items-center px-1.5 h-[18px] rounded-full bg-bg-sub text-text-sub text-[10px] font-medium">
                                기본
                              </span>
                            )
                          )}
                        </div>
                        <div className="text-[11px] text-text-sub mt-0.5 truncate">
                          {[card.issuer, card.card_type].filter(Boolean).join(" · ") ||
                            "카드"}
                        </div>
                      </div>

                      {/* 아이콘 버튼 — 카드가 여러 장일 때 회색 버튼이 줄줄이 늘어서지 않게 */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {!card.is_default && (
                          <button
                            type="button"
                            title="기본 카드로 지정"
                            aria-label="기본 카드로 지정"
                            onClick={() => handleSetDefault(card)}
                            className="
                              inline-flex items-center justify-center w-7 h-7 rounded-full
                              text-text-sub hover:text-text-main hover:bg-bg-hover
                              transition-colors
                            "
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="카드 삭제"
                          aria-label="카드 삭제"
                          onClick={() => setRemoveTarget(card)}
                          className="
                            inline-flex items-center justify-center w-7 h-7 rounded-full
                            text-text-sub hover:text-point-red hover:bg-bg-hover
                            transition-colors
                          "
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {subscription?.status === "active" && (
              <div className="flex items-center justify-between gap-3 flex-wrap pt-3 mt-3 border-t border-line">
                <p className="text-[11px] text-text-sub leading-relaxed">
                  해지하셔도 {formatDate(subscription.next_billing_at)}까지는 그대로
                  이용하실 수 있습니다.
                </p>
                <Button
                  size="sm"
                  pill
                  variant="ghost"
                  onClick={() => setCancelOpen(true)}
                >
                  구독 해지
                </Button>
              </div>
            )}
          </Card>

          {/* 결제 내역 */}
          {payments && payments.length > 0 && (
            <Card variant="outline" className="p-5">
              <h3 className="text-[14px] font-semibold tracking-tight text-text-main mb-3">
                결제 내역
              </h3>
              <div className="flex flex-col divide-y divide-line">
                {payments.map((payment) => (
                  <div
                    key={payment.order_id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] text-text-main">
                        {payment.plan.toUpperCase()} 1개월
                      </div>
                      <div className="text-[11px] text-text-sub mt-0.5">
                        {formatDate(payment.approved_at ?? payment.created_at)}
                        {payment.failure_message && (
                          <span className="ml-1.5 text-point-red">
                            {payment.failure_message}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={[
                          "text-[13px] tabular-nums",
                          payment.status === "done"
                            ? "text-text-main"
                            : "text-text-disabled line-through",
                        ].join(" ")}
                      >
                        ₩{payment.amount.toLocaleString()}
                      </span>
                      {payment.receipt_url && (
                        <a
                          href={payment.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-text-sub hover:text-text-main underline underline-offset-2"
                        >
                          영수증
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 구축(SI) 문의 */}
          <Card variant="outline" className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-text-sub" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-text-main">
                    {ENTERPRISE.title}
                  </div>
                  <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
                    {ENTERPRISE.description}
                  </p>
                </div>
              </div>
              <a href={ENTERPRISE.href} className="shrink-0 ml-auto">
                <Button size="sm" pill variant="secondary">
                  {ENTERPRISE.cta}
                </Button>
              </a>
            </div>
          </Card>
        </div>
      </div>

      <UpgradeModal
        open={!!target}
        plan={target}
        amount={target ? config?.prices?.[target.name.toLowerCase()] : undefined}
        methods={cards}
        selected={selected}
        onSelect={setSelected}
        pending={busy}
        onConfirm={handleSubscribe}
        onClose={() => setTarget(null)}
      />

      <ConfirmModal
        open={!!downgradeTarget}
        icon={<Minus className="w-4 h-4" />}
        title={`${downgradeTarget?.name ?? ""} 플랜으로 내릴까요?`}
        description={
          <>
            <span className="text-text-main">
              {formatDate(subscription?.next_billing_at ?? null)}
            </span>
            까지는 {currentPlan.name} 플랜 그대로 이용하세요.
            <br />
            다음 결제일부터 {downgradeTarget?.name} 요금으로 청구되며, 환불은
            없어요.
            {/* 요금만 알려주면, 오픈빌더에 등록해둔 카카오톡 채널이 어느 날
                조용히 멈추는 걸 주인이 모른 채로 하향하게 된다. */}
            {downgradeLosses.length > 0 && (
              <span className="block mt-3 pt-3 border-t border-line text-left">
                <span className="block text-[12px] font-medium text-text-main mb-1.5">
                  이때부터 아래 기능이 빠집니다
                </span>
                <span className="block text-[12px] text-text-sub leading-relaxed">
                  {downgradeLosses.map((loss) => (
                    <span key={loss} className="block">
                      · {loss}
                    </span>
                  ))}
                </span>
              </span>
            )}
          </>
        }
        confirmLabel="변경 예약"
        cancelLabel="닫기"
        onConfirm={handleDowngrade}
        onCancel={() => setDowngradeTarget(null)}
      />

      <ConfirmModal
        open={!!removeTarget}
        icon={<Trash2 className="w-4 h-4" />}
        title="이 카드를 삭제할까요?"
        description={
          removeTarget ? (
            <>
              <span className="font-mono tabular-nums text-text-main">
                {removeTarget.masked_number ?? describeMethod(removeTarget)}
              </span>
              <br />
              목록에서 제거되며 이 카드로는 더 이상 청구되지 않아요.
            </>
          ) : undefined
        }
        variant="danger"
        confirmLabel="삭제"
        cancelLabel="닫기"
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />

      <ConfirmModal
        open={cancelOpen}
        icon={<CreditCard className="w-4 h-4" />}
        title="구독을 해지할까요?"
        description={
          <>
            다음 결제부터 청구되지 않아요.
            <br />
            <span className="text-text-main">
              {formatDate(subscription?.next_billing_at ?? null)}
            </span>
            까지는 지금 플랜 그대로 이용하실 수 있어요.
          </>
        }
        variant="danger"
        confirmLabel="해지하기"
        cancelLabel="닫기"
        onConfirm={handleCancel}
        onCancel={() => setCancelOpen(false)}
      />
    </>
  );
};

export default Billing;
