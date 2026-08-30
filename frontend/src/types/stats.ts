/** `GET /api/stats/` 응답. 백엔드 `stats_service.get_summary`와 짝. */
export type StatsUnit = "day" | "week" | "month";

export interface StatsSummary {
  days: number;
  unit: StatsUnit;
  sessions: number;
  /** 방문자가 보낸 질문 수 */
  questions: number;
  /** 질문 1개만 하고 끝난 세션 — 첫 답이 나빴다는 신호 */
  one_shot_sessions: number;
  /**
   * 기간별 질문 수. **활동이 없는 구간도 count 0으로 포함된다** —
   * 빠뜨리면 꺾은선이 빈 구간을 이어버려 거짓 추세가 된다.
   * bucket 형식: day/week는 "YYYY-MM-DD"(주간은 그 주 월요일), month는 "YYYY-MM".
   */
  series: { bucket: string; count: number }[];
  channels: { channel: "widget" | "kakao"; sessions: number }[];
  unanswered_count: number;
  /** 전체 질문 대비 % */
  unanswered_rate: number;
  unanswered: {
    question: string;
    bot_id: string;
    bot_name: string;
    at: string;
  }[];
  faq_clicks: { question: string; count: number }[];
  /**
   * fallback이 설정된 봇 수. 0이면 "답변 못 한 질문" 지표가 측정 자체가 안 된다
   * (fallback이 비면 웹 검색으로 답해서 봇이 "모른다"고 하지 않는다).
   */
  fallback_measurable_bots: number;
  total_bots: number;
  /** 집계 상한을 넘겨 일부만 반영됨 */
  truncated: boolean;
  /**
   * 방문자 경로(위젯·카카오)에서 난 LLM 호출 실패.
   *
   * 화면의 기간 선택과 **무관하게 최근 24시간 고정**이다. "지금 봇이 죽어 있는가"를
   * 묻는 지표라, 30일을 고르면 한 달 전에 끝난 키 만료가 계속 떠서 못 쓰게 된다.
   */
  llm_errors: {
    hours: number;
    total: number;
    by_kind: { kind: LlmErrorKind; count: number }[];
    /** ISO. 마지막 발생 시각 — "지금도 나는 중"과 "아까 잠깐"을 가른다 */
    last_at: string | null;
  };
}

/**
 * 봇 주인이 취할 조치가 갈리는 단위. 백엔드 `LlmErrorKind`와 값이 일치해야 한다.
 * auth = 키 재등록 / quota = 제공자 결제·한도 / timeout = 모델이 느림 / other = 대개 제공자 장애
 */
export type LlmErrorKind = "auth" | "quota" | "timeout" | "other";

/** `POST /api/stats/topics` 응답. LLM이 질문을 주제별로 묶은 결과. */
export interface StatsTopics {
  topics: { name: string; count: number; examples: string[] }[];
  analyzed: number;
}
