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
}

/** `POST /api/stats/topics` 응답. LLM이 질문을 주제별로 묶은 결과. */
export interface StatsTopics {
  topics: { name: string; count: number; examples: string[] }[];
  analyzed: number;
}
