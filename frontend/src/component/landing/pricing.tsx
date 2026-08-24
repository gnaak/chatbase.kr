import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import Button from "@/component/dashboard/ui/button";

interface Feature {
  label: string;
  /** 아직 제공되지 않는 항목 — 라벨 옆에 '준비 중' 표시 */
  soon?: boolean;
}

interface Plan {
  name: string;
  price: string;
  unit?: string;
  tagline: string;
  features: Feature[];
  cta: string;
  href: string;
  external?: boolean;
  featured?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "₩0",
    tagline: "먼저 만들어보기",
    features: [
      { label: "챗봇 1개" },
      { label: "월 대화 300건" },
      { label: "텍스트 학습 1만자" },
      { label: "위젯·iframe 임베드" },
      { label: "대화 기록 7일" },
    ],
    cta: "무료로 시작",
    href: "/dashboard",
  },
  {
    name: "Standard",
    price: "₩19,000",
    unit: "/ 월",
    tagline: "홈페이지 상담 자동화",
    features: [
      { label: "챗봇 1개" },
      { label: "월 대화 3,000건" },
      { label: "텍스트·파일·웹페이지 학습" },
      { label: "대화 기록 90일" },
      { label: "Powered by 배지 제거" },
    ],
    cta: "시작하기",
    href: "/dashboard",
  },
  {
    name: "Premium",
    price: "₩49,000",
    unit: "/ 월",
    tagline: "여러 채널 + 사내 활용",
    features: [
      { label: "챗봇 5개 · 멤버 5명" },
      { label: "월 대화 20,000건" },
      { label: "카카오톡 채널 연동" },
      { label: "사내 모드 (로그인 전용)", soon: true },
      { label: "대화 기록 무제한" },
    ],
    cta: "시작하기",
    href: "/dashboard",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "문의",
    tagline: "규모에 맞춰 협의",
    features: [
      { label: "챗봇·멤버 무제한" },
      { label: "관리형 파일 학습", soon: true },
      { label: "SSO · 도메인 제한", soon: true },
      { label: "전담 지원 · SLA" },
      { label: "세금계산서 발행" },
    ],
    cta: "문의하기",
    href: "mailto:hello@chatbase.kr",
    external: true,
  },
];

const Pricing = () => {
  return (
    <section
      id="pricing"
      className="border-b border-line min-h-screen flex items-center"
    >
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 py-24 md:py-32">
        <div className="text-center mb-14">
          <h2 className="text-[32px] md:text-[40px] font-semibold tracking-heading text-text-main">
            쓰는 만큼만, 부담 없이.
          </h2>
          <p className="mt-3 text-[15px] text-text-sub max-w-xl mx-auto leading-relaxed">
            무료로 만들어보고, 필요해지면 올리세요. 모델 사용료는 본인 키로
            직접 결제되니 저희 요금에 얹히지 않습니다.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={[
                "p-6 rounded-comfy bg-bg-card flex flex-col",
                plan.featured
                  ? "shadow-card dark:shadow-card-dark"
                  : "shadow-border",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[14px] font-semibold tracking-tight text-text-main">
                  {plan.name}
                </span>
                {plan.featured && (
                  <span className="inline-flex items-center px-2 h-5 rounded-full bg-info-bg text-info text-[10px] font-medium">
                    추천
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5 mt-3">
                <span className="text-[30px] font-semibold tracking-display text-text-main">
                  {plan.price}
                </span>
                {plan.unit && (
                  <span className="text-[13px] text-text-sub">{plan.unit}</span>
                )}
              </div>
              <p className="mt-1 text-[12px] text-text-sub">{plan.tagline}</p>

              <div className="my-5 border-t border-line" />

              <ul className="flex flex-col gap-2.5 mb-7 flex-1">
                {plan.features.map(({ label, soon }) => (
                  <li key={label} className="flex items-start gap-2">
                    <span className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-success-bg mt-0.5">
                      <Check className="w-2.5 h-2.5 text-success" />
                    </span>
                    <span className="text-[12.5px] text-text-main leading-relaxed">
                      {label}
                      {soon && (
                        <span className="ml-1.5 text-[10px] text-text-sub font-mono">
                          준비 중
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              {plan.external ? (
                <a href={plan.href} className="block">
                  <Button
                    size="md"
                    pill
                    full
                    variant={plan.featured ? "primary" : "secondary"}
                  >
                    {plan.cta}
                  </Button>
                </a>
              ) : (
                <Link to={plan.href} className="block">
                  <Button
                    size="md"
                    pill
                    full
                    variant={plan.featured ? "primary" : "secondary"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <p className="text-[12px] text-text-sub">
            모든 가격은 부가세 별도 · 연간 결제 시 2개월 무료
          </p>
          <p className="text-[12px] text-text-sub max-w-xl leading-relaxed">
            결제 시스템은 준비 중입니다. 지금 가입하시면 무료로 이용하실 수 있고,
            유료 플랜이 열리면 가입 이메일로 미리 안내드립니다.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
