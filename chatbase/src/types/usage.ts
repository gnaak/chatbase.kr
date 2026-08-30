/** `GET /api/usage/` 응답. 백엔드 `usage_service.get_summary`와 짝. */
export interface UsageSummary {
  plan: "free" | "standard" | "premium" | "global";
  /**
   * 플랜에 카카오톡이 없는데 과거 유입 이력이 있음 = 쓰다가 끊긴 상태.
   * 플랜에 포함돼 있으면 항상 false다(물어볼 필요가 없어 서버가 조회를 생략한다).
   */
  kakao_in_use: boolean;
  /**
   * 이 플랜이 카카오톡 채널을 포함하는지. 백엔드 `PlanLimits.kakao_channel`이 그대로 온다.
   * 화면에서 `plan === "premium"` 같은 비교를 하지 않기 위한 값 —
   * 카카오를 포함하는 플랜이 늘어나도 프론트는 고칠 게 없어야 한다.
   */
  kakao_channel: boolean;
  /**
   * 다국어 응대를 켤 수 있는지. 백엔드 `PlanLimits.multilingual`.
   * 지금은 GLOBAL만 true지만, 화면에서 `plan === "global"`로 비교하지 않기 위한 값이다.
   */
  multilingual: boolean;
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
