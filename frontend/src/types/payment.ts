/**
 * 결제 도메인 타입 — 백엔드 `module/payment`의 응답과 1:1로 맞춘다.
 *
 * 카드 등록과 결제는 분리돼 있다:
 *   등록 `POST /api/payment/methods` (결제 없음) → 목록에 카드가 쌓인다
 *   결제 `POST /api/payment/subscribe { plan, method_id }` → 선택한 카드로 청구
 *   변경 `POST /api/payment/methods/default` → 다음 청구부터 그 카드로
 *
 * 금액의 SOT는 백엔드 `core/utils/plan.py`의 `PLAN_PRICES`다.
 */

/** `none` = 결제 프로필만 있고 구독하지 않은 상태. */
export type SubscriptionStatus = "none" | "active" | "canceled" | "past_due";

/**
 * 등록된 수단의 종류.
 *
 * **토스 자동결제는 국내 발급 카드만 지원한다**(해외카드·계좌이체 불가).
 * `transfer`는 API 응답 스펙에만 있는 값이라 실제로는 오지 않지만,
 * 토스가 지원 범위를 넓히면 그대로 받도록 남겨둔다.
 */
export type BillingMethodType = "card" | "transfer";

export interface BillingMethod {
  id: number;
  method_type: BillingMethodType;
  /** 카드사 코드 또는 은행명. */
  issuer: string | null;
  /** 마스킹된 카드번호 또는 계좌번호. */
  masked_number: string | null;
  /** 카드 전용 — 신용 / 체크 / 기프트. */
  card_type: string | null;
  is_default: boolean;
  created_at: string | null;
}

export interface Subscription {
  /** 토스 카드 등록창에 넘기는 구매자 식별자. 서버가 발급한다. */
  customer_key: string;
  status: SubscriptionStatus;
  /** 구독 중인 유료 플랜(소문자). 미구독이면 null. */
  plan: string | null;
  /** 다음 결제일에 적용될 플랜(하향 예약). 없으면 null. */
  scheduled_plan: string | null;
  /** 다음 청구에 쓸 카드. 등록된 카드가 없으면 null. */
  billing_method_id: number | null;
  started_at: string | null;
  /** 다음 청구 예정일. 해지 상태에서는 이용 종료일로 읽는다. */
  next_billing_at: string | null;
  canceled_at: string | null;
}

export interface PaymentConfig {
  /** 토스 SDK 초기화용 공개 키. 서버에 설정이 없으면 null. */
  client_key: string | null;
  /** { standard: 19000, premium: 49000 } */
  prices: Record<string, number>;
}

export type PaymentStatus = "done" | "failed" | "canceled";

export interface PaymentHistory {
  order_id: string;
  plan: string;
  amount: number;
  status: PaymentStatus;
  method: string | null;
  receipt_url: string | null;
  failure_message: string | null;
  approved_at: string | null;
  created_at: string | null;
}

export interface RegisterMethodRequest {
  authKey: string;
  customerKey: string;
}

/**
 * 결제 모달에서 고른 결제 수단.
 * `saved`는 등록돼 있는 카드, `new`는 등록창을 거쳐야 하는 새 카드 —
 * 결제 버튼 하나로 두 흐름을 모두 받는다.
 */
export type MethodSelection =
  | { kind: "saved"; id: number }
  | { kind: "new" };

/** 하향 예약. plan을 null로 보내면 예약 취소. */
export interface SchedulePlanRequest {
  plan: string | null;
}

export interface SubscribeRequest {
  plan: string;
  /** 생략하면 기본 카드로 청구된다. */
  method_id?: number;
}

/**
 * 결제수단 표시용 한 줄.
 * 카드사는 토스가 코드(41)로 주는 경우가 있어 이름 대신 번호를 앞세운다.
 */
export const describeMethod = (method: BillingMethod) => {
  if (method.method_type === "transfer") {
    return [method.issuer ?? "계좌", method.masked_number].filter(Boolean).join(" ");
  }
  const parts = [method.masked_number, method.card_type].filter(Boolean);
  return parts.length ? parts.join(" · ") : "등록된 카드";
};
