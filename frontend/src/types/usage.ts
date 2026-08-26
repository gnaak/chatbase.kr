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
  bots_limit: number | null;
  per_bot: { bot_id: number; bot_name: string | null; message_count: number }[];
}

/** plan 값("free") → 가격표 플랜명("FREE"). `PLANS[].name`과 정확히 일치해야 한다. */
export const planToPlanName = (plan: UsageSummary["plan"]): string =>
  plan.toUpperCase();
