/**
 * 관리자 결제 관리 화면 타입 — 백엔드 `module/admin`의 결제 조회 응답과 1:1로 맞춘다.
 *
 *   지표 `GET /api/admin/billing/summary`
 *   구독 `GET /api/admin/subscriptions`
 *   내역 `GET /api/admin/payments?limit=200`
 *
 * 사용자 화면과 같은 도메인이라 상태값·결제수단 타입은 `types/payment.ts`를 그대로 쓴다.
 * 여기서 다시 정의하면 한쪽만 바뀔 때 화면끼리 어긋난다.
 */

import type {
  BillingMethod,
  PaymentStatus,
  SubscriptionStatus,
} from "@chatbase/types/payment";

/**
 * 결제 내역을 한 번에 받아올 건수. 관리자 대시보드와 결제 관리 화면이
 * 같은 값을 써야 쿼리 캐시를 공유한다(키에 이 숫자가 들어간다).
 */
export const PAYMENT_FETCH_LIMIT = 500;

export interface AdminBillingSummary {
  /** ACTIVE 구독의 월 청구액 합. 해지 예정은 다음 달에 안 나가므로 제외된다. */
  mrr: number;
  active_count: number;
  /** 해지 신청됨 — 이용 종료일까지는 플랜 유지. */
  canceled_count: number;
  /** 정기 청구가 실패해 재시도 대기 중. */
  past_due_count: number;
  /** 결제 프로필만 만들어진 상태(카드 등록 화면까지 온 사용자). */
  none_count: number;
  /** `user.plan` 기준 사용자 수. { free, standard, premium } */
  plan_counts: Record<string, number>;
  revenue_this_month: number;
  revenue_total: number;
  /** 최근 30일 결제 실패 건수. */
  failed_30d: number;
}

export interface AdminSubscription {
  user_id: number;
  email: string;
  name: string | null;
  /** 게이팅이 실제로 보는 값. `plan`과 다르면 돈과 권한이 따로 논다. */
  /** 어느 상품의 구독인가. 'chatbot' | 'aeo' */
  product: string;
  status: SubscriptionStatus;
  plan: string | null;
  /** 다음 결제일에 적용될 하향 예약. */
  scheduled_plan: string | null;
  /** 다음 청구에 쓸 카드. billingKey는 내려오지 않는다. */
  method: BillingMethod | null;
  method_count: number;
  /** 이번 주기 청구 실패 횟수. */
  retry_count: number;
  paid_total: number;
  paid_count: number;
  started_at: string | null;
  /** 다음 청구 예정일. 해지 상태에서는 이용 종료일. */
  next_billing_at: string | null;
  canceled_at: string | null;
  created_at: string | null;
}

export interface AdminPayment {
  id: number;
  user_id: number;
  email: string;
  name: string | null;
  order_id: string;
  /** 토스 콘솔에서 같은 건을 찾을 때 쓰는 키. */
  payment_key: string | null;
  plan: string;
  amount: number;
  status: PaymentStatus;
  method: string | null;
  receipt_url: string | null;
  failure_code: string | null;
  failure_message: string | null;
  approved_at: string | null;
  created_at: string | null;
}

export interface AdminPaymentList {
  items: AdminPayment[];
  /** 전체 결제 건수. items가 limit에서 잘렸는지 판단하는 데 쓴다. */
  total: number;
  limit: number;
}

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "구독중",
  canceled: "해지 예정",
  past_due: "청구 실패",
  none: "미구독",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  done: "성공",
  failed: "실패",
  canceled: "취소",
};

/** 구독 목록 상태 필터. `all`은 필터 없음. */
export type SubscriptionFilter = SubscriptionStatus | "all";

export const SUBSCRIPTION_FILTERS: { value: SubscriptionFilter; label: string }[] =
  [
    { value: "all", label: "전체" },
    { value: "active", label: "구독중" },
    { value: "canceled", label: "해지 예정" },
    { value: "past_due", label: "청구 실패" },
    { value: "none", label: "미구독" },
  ];
