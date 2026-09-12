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
  /**
   * 파일 학습을 쓸 수 있는 플랜인지. 백엔드 `PlanLimits.file_learning`.
   * 이걸 안 보면 FREE 사용자에게 파일 탭을 띄워놓고 업로드에서 403을 던지게 된다.
   * (플랜과 별개로 **내 OpenAI 키**도 있어야 한다 — 벡터스토어가 계정 귀속이라.)
   */
  file_learning: boolean;
  /** 대화 기록 보관 일수. null = 무제한. 이 기간이 지난 대화는 목록에서 가려진다. */
  history_days: number | null;
  /** "YYYY-MM" (KST) */
  year_month: string;
  messages_used: number;
  /**
   * null = 한도 없음.
   *
   * 플랜이 무제한이거나, **내 키를 등록해 쓰는 중**이거나 둘 중 하나다.
   * 후자에서 서버가 일부러 null로 내려보낸다 — 플랜 숫자를 그대로 보여주면
   * 실제로는 막히지 않는 벽을 "곧 소진"이라고 경고하게 된다.
   */
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
