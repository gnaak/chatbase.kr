/**
 * 요금제 정의 — 랜딩(`component/landing/pricing.tsx`)과
 * 대시보드 결제 화면(`container/dashboard/billing.tsx`)이 공유한다.
 *
 * 가격 정책 요약:
 * - 유료 전환 레버는 **Free의 월 대화 건수**다. 임베드 자체는 Free에도 열어둔다 —
 *   자기 사이트에서 돌아가는 걸 봐야 결제 결심이 서기 때문에, 그 경험을 막으면
 *   Free가 체험 수단이 아니라 그냥 안 쓰는 칸이 된다.
 * - 유료 플랜은 **대화 건수를 제한하지 않는다.** BYOK라 모델 사용료가 우리 원가에
 *   잡히지 않으므로 건수를 조일 이유가 없고, "내 키로 무제한"이 그대로 셀링 포인트가 된다.
 * - Enterprise는 기능 등급이 아니라 구축(SI) 상품이라 별도 블록으로 노출한다.
 * - **웹 검색은 전 플랜 공통**이라 플랜 카드에 넣지 않는다. 이미 3사(OpenAI/Anthropic/
 *   Gemini) 모두에서 동작 중이라(각 `infra` provider의 chat_service) 특정 플랜에 가두면 지금 되던
 *   기능을 회수하는 셈이 된다. 대신 가격표 하단에 공통 제공으로 한 줄 안내한다.
 */

/** Free 플랜 월 대화 한도(방문자 질문 1건 = 1건). 백엔드 게이팅도 이 값을 기준으로 맞춘다. */
export const FREE_MONTHLY_MESSAGES = 100;

export interface PlanFeature {
  label: string;
  /** 해당 플랜에서 제공되지 않는 항목 — 회색 + 빗금 아이콘으로 표시 */
  off?: boolean;
  /** 라벨 뒤 작은 글씨 부연 (예: "OpenAI 키 필요") */
  note?: string;
}

/**
 * 하향 시 무엇을 잃는지 계산하기 위한 구조화된 한도.
 * `features`는 화면 표시용 문장이라 비교에 쓸 수 없다.
 *
 * 백엔드 `app/core/utils/plan.py`의 `PlanLimits`와 값이 일치해야 한다.
 * null = 무제한.
 */
export interface PlanLimits {
  bots: number;
  monthlyMessages: number | null;
  fileLearning: boolean;
  kakaoChannel: boolean;
  historyDays: number | null;
}

export interface Plan {
  name: string;
  price: string;
  unit?: string;
  tagline: string;
  features: PlanFeature[];
  limits: PlanLimits;
  cta: string;
  href: string;
  featured?: boolean;
}

export const PLANS: Plan[] = [
  {
    name: "FREE",
    price: "₩0",
    tagline: "내 사이트에서 먼저 써보기",
    features: [
      { label: "챗봇 1개" },
      { label: `월 대화 ${FREE_MONTHLY_MESSAGES}건` },
      { label: "위젯 · iframe 임베드" },
      { label: "텍스트 · 웹페이지 학습" },
      { label: "대화 기록 7일" },
      { label: "파일 학습", off: true },
    ],
    limits: {
      bots: 1,
      monthlyMessages: FREE_MONTHLY_MESSAGES,
      fileLearning: false,
      kakaoChannel: false,
      historyDays: 7,
    },
    cta: "무료로 시작",
    href: "/dashboard",
  },
  {
    name: "STANDARD",
    price: "₩19,000",
    unit: "/ 월 · VAT 별도",
    tagline: "홈페이지 상담 자동화",
    features: [
      { label: "챗봇 3개" },
      { label: "대화 수 제한 없음" },
      { label: "파일 학습", note: "OpenAI 키 필요" },
      { label: "대화 기록 90일" },
      { label: "Powered by 배지 제거" },
    ],
    limits: {
      bots: 3,
      monthlyMessages: null,
      fileLearning: true,
      kakaoChannel: false,
      historyDays: 90,
    },
    cta: "시작하기",
    href: "/dashboard",
  },
  {
    name: "PREMIUM",
    price: "₩49,000",
    unit: "/ 월 · VAT 별도",
    tagline: "여러 채널 · 여러 봇 운영",
    features: [
      { label: "Standard의 모든 기능" },
      { label: "챗봇 10개" },
      { label: "카카오톡 채널 연동" },
      { label: "대화 기록 무제한" },
      { label: "우선 지원" },
    ],
    limits: {
      bots: 10,
      monthlyMessages: null,
      fileLearning: true,
      kakaoChannel: true,
      historyDays: null,
    },
    cta: "시작하기",
    href: "/dashboard",
    featured: true,
  },
];

/**
 * 상위 → 하위 플랜으로 갈 때 잃는 것들. 하향 확인창에서 미리 알려주는 데 쓴다.
 *
 * 특히 카카오톡은 이미 오픈빌더에 스킬 URL을 등록해둔 상태라, 알려주지 않으면
 * 어느 날 갑자기 채널이 조용히 멈추고 주인은 방문자가 항의할 때까지 모른다.
 */
export const planLosses = (from: PlanLimits, to: PlanLimits): string[] => {
  const losses: string[] = [];

  if (from.kakaoChannel && !to.kakaoChannel) {
    losses.push("카카오톡 채널 연동이 중단됩니다 (오픈빌더에 등록한 챗봇이 응답을 멈춥니다)");
  }
  if (from.fileLearning && !to.fileLearning) {
    losses.push("파일 학습을 쓸 수 없습니다 (기존 업로드 파일도 답변에 사용되지 않습니다)");
  }
  if (to.bots < from.bots) {
    losses.push(`챗봇을 ${to.bots}개까지만 만들 수 있습니다 (현재 한도 ${from.bots}개)`);
  }
  if (to.monthlyMessages !== null && from.monthlyMessages === null) {
    losses.push(`월 대화가 ${to.monthlyMessages.toLocaleString()}건으로 제한됩니다`);
  }
  if (to.historyDays !== null && (from.historyDays === null || to.historyDays < from.historyDays)) {
    losses.push(`대화 기록 보관이 ${to.historyDays}일로 줄어듭니다`);
  }

  return losses;
};

/** 구축(SI) 상품 — 플랜 카드가 아니라 하단 별도 블록으로 노출한다. */
export const ENTERPRISE = {
  title: "사내 전용 챗봇, 저희가 만들어 드립니다",
  description:
    "사내 매뉴얼·규정을 아는 챗봇 사이트를 업무 흐름에 맞춰 설계하고 구축해 드립니다. 요건 정리부터 배포까지 함께합니다.",
  tags: [
    "사내 챗봇 사이트 구축",
    "이미지 생성",
    "문서 분석 · 작성",
    "전담 지원",
    "세금계산서 발행",
  ],
  cta: "구축 문의하기",
  /** 문의 페이지를 제휴 유형으로 열어둔다. 메일과 달리 스레드가 남아 추적된다. */
  href: "/support?category=partnership",
} as const;
