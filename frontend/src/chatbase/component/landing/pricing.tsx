import { Link } from "react-router-dom";
import { Check, Minus, Sparkles } from "lucide-react";
import Button from "@shared/ui/button";
import { ENTERPRISE, PLANS } from "@chatbase/types/plan";

const Pricing = () => {
  return (
    <section
      id="pricing"
      className="border-b border-line min-h-screen flex items-center"
    >
      <div className="w-full max-w-6xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <div className="text-center mb-9">
          <h2 className="text-[32px] md:text-[40px] font-semibold tracking-heading text-text-main">
            쓰는 만큼만, 부담 없이.
          </h2>
          <p className="mt-3 text-[15px] text-text-sub max-w-xl mx-auto leading-relaxed">
            무료로 내 사이트에 붙여 먼저 써보세요. 모델 사용료는 본인 키로 직접
            결제되니, 유료 플랜은 대화가 몇 건이든 추가 과금이 없습니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={[
                "p-5 rounded-comfy bg-bg-card flex flex-col",
                plan.featured
                  ? "shadow-card dark:shadow-card-dark"
                  : "shadow-border",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold tracking-tight text-text-main">
                  {plan.name}
                </span>
                {plan.featured && (
                  <span className="inline-flex items-center px-2 h-5 rounded-full bg-info-bg text-info text-[10px] font-medium">
                    추천
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5 mt-2.5">
                <span className="text-[28px] font-semibold tracking-display text-text-main">
                  {plan.price}
                </span>
                {plan.unit && (
                  <span className="text-[13px] text-text-sub">{plan.unit}</span>
                )}
              </div>
              <p className="mt-1 text-[12px] text-text-sub">{plan.tagline}</p>

              <div className="my-4 border-t border-line" />

              <ul className="flex flex-col gap-2 mb-5 flex-1">
                {plan.features.map(({ label, off, note }) => (
                  <li key={label} className="flex items-start gap-2">
                    <span
                      className={[
                        "shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full mt-0.5",
                        off ? "bg-bg-sub" : "bg-success-bg",
                      ].join(" ")}
                    >
                      {off ? (
                        <Minus className="w-2.5 h-2.5 text-text-disabled" />
                      ) : (
                        <Check className="w-2.5 h-2.5 text-success" />
                      )}
                    </span>
                    <span
                      className={[
                        "text-[12.5px] leading-relaxed",
                        off ? "text-text-disabled" : "text-text-main",
                      ].join(" ")}
                    >
                      {label}
                      {note && (
                        <span className="ml-1.5 text-[10px] text-text-sub font-mono">
                          {note}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

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
            </div>
          ))}
        </div>

        {/* 구축(SI) 상품 — 플랜 카드와 성격이 달라 별도 블록으로 분리 */}
        <div className="mt-4 px-5 py-4 rounded-comfy bg-bg-sub shadow-border">
          <div className="flex items-center justify-between gap-5 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-text-sub shrink-0" />
                <h3 className="text-[15px] font-semibold tracking-tight text-text-main">
                  {ENTERPRISE.title}
                </h3>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {ENTERPRISE.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 h-6 rounded-full bg-bg-card shadow-border text-[11px] text-text-main"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <a href={ENTERPRISE.href} className="shrink-0">
              <Button size="md" pill variant="primary">
                {ENTERPRISE.cta}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
