import { Check, CreditCard, Mail, Minus, Plus } from "lucide-react";
import Topbar from "@/component/dashboard/layout/topbar";
import Card from "@/component/dashboard/ui/card";
import Button from "@/component/dashboard/ui/button";
import { ENTERPRISE, PLANS } from "@/types/plan";

/**
 * TODO(백엔드): 구독 API가 붙으면 교체한다.
 * `GET /api/subscription` → { plan, nextBillingAt, card } 형태를 상정.
 */
const currentPlanName = "Free";

const Billing = () => {
  const currentIdx = PLANS.findIndex((plan) => plan.name === currentPlanName);
  const currentPlan = PLANS[currentIdx];

  return (
    <>
      <Topbar title="결제" description="요금제와 결제 정보를 관리합니다." />

      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
          {/* 현재 플랜 */}
          <Card variant="elevated" className="p-6">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="min-w-0">
                <span className="text-[11px] font-mono text-text-sub">
                  현재 플랜
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-[24px] font-semibold tracking-display text-text-main">
                    {currentPlan.name}
                  </span>
                  <span className="text-[14px] text-text-sub">
                    {currentPlan.price}
                    {currentPlan.unit && ` ${currentPlan.unit}`}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] text-text-sub leading-relaxed">
                  {currentIdx === 0
                    ? "무료 플랜을 이용 중입니다. 유료 플랜으로 올리시면 대화 건수 제한이 없어집니다."
                    : "매달 자동으로 결제됩니다. 언제든 해지하실 수 있습니다."}
                </p>
              </div>

              {currentIdx === 0 && (
                <a href="#plans" className="shrink-0">
                  <Button size="md" pill variant="primary">
                    플랜 올리기
                  </Button>
                </a>
              )}
            </div>
          </Card>

          {/* 플랜 선택 */}
          <Card variant="outline" className="p-6" id="plans">
            <h3 className="text-[14px] font-semibold tracking-tight text-text-main mb-1">
              요금제
            </h3>
            <p className="text-[12px] text-text-sub mb-5">
              유료 플랜은 대화 건수를 제한하지 않습니다 · 부가세 별도 · 연간
              결제 시 2개월 무료
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PLANS.map((plan, idx) => {
                const isCurrent = idx === currentIdx;
                return (
                  <div
                    key={plan.name}
                    className={[
                      "p-5 rounded-comfy bg-bg-card flex flex-col",
                      isCurrent
                        ? "shadow-card dark:shadow-card-dark"
                        : "shadow-border",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold tracking-tight text-text-main">
                        {plan.name}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center px-2 h-5 rounded-full bg-info-bg text-info text-[10px] font-medium">
                          이용 중
                        </span>
                      )}
                    </div>
                    <div className="text-[18px] font-semibold tracking-tight text-text-main mt-1.5 mb-4">
                      {plan.price}
                      {plan.unit && (
                        <span className="ml-1 text-[12px] font-normal text-text-sub">
                          {plan.unit}
                        </span>
                      )}
                    </div>

                    <ul className="flex flex-col gap-2 mb-5 flex-1">
                      {plan.features.map(({ label, off, note }) => (
                        <li key={label} className="flex items-start gap-2">
                          <span
                            className={[
                              "shrink-0 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full mt-0.5",
                              off ? "bg-bg-sub" : "bg-success-bg",
                            ].join(" ")}
                          >
                            {off ? (
                              <Minus className="w-2 h-2 text-text-disabled" />
                            ) : (
                              <Check className="w-2 h-2 text-success" />
                            )}
                          </span>
                          <span
                            className={[
                              "text-[12px] leading-relaxed",
                              off ? "text-text-disabled" : "text-text-main",
                            ].join(" ")}
                          >
                            {label}
                            {note && (
                              <span className="ml-1 text-[10px] text-text-sub font-mono">
                                {note}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      size="sm"
                      pill
                      full
                      variant={idx > currentIdx ? "primary" : "secondary"}
                      disabled={isCurrent}
                    >
                      {isCurrent
                        ? "이용 중"
                        : idx > currentIdx
                          ? "이 플랜으로 올리기"
                          : "이 플랜으로 내리기"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 결제 수단 */}
          <Card variant="outline" className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4 text-text-sub" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-text-main">
                    결제 수단
                  </div>
                  <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
                    등록된 카드가 없습니다. 유료 플랜을 시작하시면 등록해주세요.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                pill
                variant="secondary"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                카드 등록
              </Button>
            </div>
          </Card>

          {/* 구축(SI) 문의 */}
          <Card variant="outline" className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-text-sub" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-text-main">
                    {ENTERPRISE.title}
                  </div>
                  <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
                    {ENTERPRISE.description}
                  </p>
                </div>
              </div>
              <a href={ENTERPRISE.href}>
                <Button size="sm" pill variant="secondary">
                  {ENTERPRISE.cta}
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
