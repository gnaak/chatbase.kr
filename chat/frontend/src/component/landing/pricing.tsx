import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import Button from "@/component/dashboard/ui/button";

const BETA_FEATURES = [
  "챗봇 개수 무제한",
  "OpenAI / Anthropic / Google 모델 자유 선택",
  "자기 API 키 사용 (플랫폼 수수료 없음)",
  "임베드 위젯 + iframe 둘 다 지원",
  "대화 로그 + 통계 무제한 보관",
  "정식 출시 후 베타 사용자 전용 할인",
];

const Pricing = () => {
  return (
    <section id="pricing" className="border-b border-line min-h-screen flex items-center">
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 py-24 md:py-32">
        <div className="text-center mb-14">
          <h2 className="text-[32px] md:text-[40px] font-semibold tracking-heading text-text-main">
            지금은 베타, 그래서 무료.
          </h2>
          <p className="mt-3 text-[15px] text-text-sub max-w-xl mx-auto leading-relaxed">
            정식 출시 전까지 모든 기능을 무료로 사용할 수 있습니다.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="rounded-comfy bg-bg-card shadow-card dark:shadow-card-dark p-8">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[14px] font-semibold tracking-tight text-text-main">
                Standard
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full bg-info-bg text-info text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-info" />
                BETA
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-4 mb-1">
              <span className="text-[40px] font-semibold tracking-display text-text-main">
                ₩0
              </span>
              <span className="text-[14px] text-text-sub">/ 베타 기간</span>
            </div>
            <p className="text-[12px] text-text-sub">
              정식 출시 시 월 19,000원으로 전환되며, 베타 사용자에게는 할인이
              적용됩니다.
            </p>

            <div className="my-6 border-t border-line" />

            <ul className="flex flex-col gap-3 mb-8">
              {BETA_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <span className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-success-bg mt-0.5">
                    <Check className="w-2.5 h-2.5 text-success" />
                  </span>
                  <span className="text-[13px] text-text-main leading-relaxed">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <Link to="/dashboard" className="block">
              <Button
                size="lg"
                pill
                full
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                베타 무료로 시작하기
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
