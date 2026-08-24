import { Check, CreditCard, Mail } from "lucide-react";
import Topbar from "@/component/dashboard/layout/topbar";
import Card from "@/component/dashboard/ui/card";
import Button from "@/component/dashboard/ui/button";

interface PlanSummary {
  name: string;
  price: string;
  highlights: string[];
  featured?: boolean;
}

const PLANS: PlanSummary[] = [
  {
    name: "Free",
    price: "₩0",
    highlights: ["챗봇 1개", "월 대화 300건", "대화 기록 7일"],
  },
  {
    name: "Standard",
    price: "₩19,000 / 월",
    highlights: [
      "챗봇 1개",
      "월 대화 3,000건",
      "텍스트·파일·웹페이지 학습",
      "Powered by 배지 제거",
    ],
  },
  {
    name: "Premium",
    price: "₩49,000 / 월",
    highlights: [
      "챗봇 5개 · 멤버 5명",
      "월 대화 20,000건",
      "카카오톡 채널 연동",
      "대화 기록 무제한",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "문의",
    highlights: ["챗봇·멤버 무제한", "전담 지원 · SLA", "세금계산서 발행"],
  },
];

const Billing = () => {
  return (
    <>
      <Topbar title="결제" description="요금제와 결제 정보를 관리합니다." />

      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
          {/* 현재 상태 */}
          <Card variant="outline" className="p-8 text-center">
            <div className="w-10 h-10 rounded-full bg-bg-sub shadow-border flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-4 h-4 text-text-sub" />
            </div>
            <h2 className="text-[20px] font-semibold tracking-tight text-text-main mb-2">
              아직 요금이 부과되지 않습니다
            </h2>
            <p className="text-[13px] text-text-sub leading-relaxed max-w-md mx-auto">
              결제 시스템을 준비하고 있습니다. 지금은 기능 제한 없이 이용하실 수
              있고, 유료 플랜이 열리면 가입하신 이메일로 미리 안내드립니다.
              등록하신 결제 정보는 아직 필요하지 않습니다.
            </p>
          </Card>

          {/* 플랜 안내 */}
          <Card variant="outline" className="p-6">
            <h3 className="text-[14px] font-semibold tracking-tight text-text-main mb-1">
              준비 중인 요금제
            </h3>
            <p className="text-[12px] text-text-sub mb-5">
              부가세 별도 · 연간 결제 시 2개월 무료
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={[
                    "p-5 rounded-comfy bg-bg-card flex flex-col",
                    plan.featured ? "shadow-card dark:shadow-card-dark" : "shadow-border",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold tracking-tight text-text-main">
                      {plan.name}
                    </span>
                    {plan.featured && (
                      <span className="inline-flex items-center px-2 h-5 rounded-full bg-info-bg text-info text-[10px] font-medium">
                        추천
                      </span>
                    )}
                  </div>
                  <div className="text-[18px] font-semibold tracking-tight text-text-main mt-1.5 mb-4">
                    {plan.price}
                  </div>
                  <ul className="flex flex-col gap-2">
                    {plan.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2">
                        <span className="shrink-0 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-success-bg mt-0.5">
                          <Check className="w-2 h-2 text-success" />
                        </span>
                        <span className="text-[12px] text-text-main leading-relaxed">
                          {h}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          {/* 엔터프라이즈 문의 */}
          <Card variant="outline" className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-text-sub" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-text-main">
                    규모가 더 크신가요?
                  </div>
                  <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
                    챗봇·멤버 수, 전담 지원, 세금계산서 발행 등은 별도로 협의해
                    드립니다.
                  </p>
                </div>
              </div>
              <a href="mailto:hello@chatbase.kr">
                <Button size="sm" pill variant="secondary">
                  문의하기
                </Button>
              </a>
            </div>
          </Card>

          {/* 메모 */}
          <p className="text-[11px] text-text-sub text-center font-mono leading-relaxed">
            모델 사용료는 등록하신 OpenAI / Anthropic / Google 키로 각 제공자에
            직접 결제됩니다 (BYOK).
          </p>
        </div>
      </div>
    </>
  );
};

export default Billing;
