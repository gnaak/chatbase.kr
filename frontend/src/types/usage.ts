/** `GET /api/usage/` 응답. 백엔드 `usage_service.get_summary`와 짝. */
export interface UsageSummary {
  plan: "free" | "standard" | "premium";
  /** "YYYY-MM" (KST) */
  year_month: string;
  messages_used: number;
  /** null = 무제한 (유료 플랜) */
  messages_limit: number | null;
  unlimited: boolean;
  /** 한도의 80% 이상 사용 */
  warn: boolean;
  exceeded: boolean;
  /** 서버에서 한도를 실제로 강제하는 중인지(enforce_plan_limits). false면 초과해도 통과된다. */
  enforced: boolean;
  bots_limit: number | null;
  per_bot: { bot_id: number; bot_name: string | null; message_count: number }[];
}

/** plan 값("free") → 가격표 플랜명("Free") */
export const planToPlanName = (plan: UsageSummary["plan"]): string =>
  plan.charAt(0).toUpperCase() + plan.slice(1);
