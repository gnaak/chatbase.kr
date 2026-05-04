import { Check, Bell } from "lucide-react";
import Topbar from "@/component/dashboard/layout/topbar";
import Card from "@/component/dashboard/ui/card";
import Button from "@/component/dashboard/ui/button";

const BETA_BENEFITS = [
  "모든 기능 무제한 사용",
  "챗봇 개수 제한 없음",
  "BYOK라 자기 API 키만 있으면 호출도 무제한",
  "정식 출시 후 베타 사용자 전용 할인 제공",
];

const Billing = () => {
  return (
    <>
      <Topbar
        title="결제"
        description="현재 베타 기간 — 모든 기능을 무료로 사용할 수 있습니다."
      />

      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
          {/* 베타 안내 카드 */}
          <Card variant="outline" className="p-8 text-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full bg-info-bg text-info text-[11px] font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-info" />
              BETA · 무료 운영 중
            </div>
            <h2 className="text-[20px] font-semibold tracking-tight text-text-main mb-2">
              아직은 결제가 필요 없어요
            </h2>
            <p className="text-[13px] text-text-sub leading-relaxed max-w-md mx-auto whitespace-pre-line">
              {"지금은 베타 기간으로, 모든 기능을 무료로 사용하실 수 있습니다.\n정식 출시까지 결제 정보를 등록하실 필요가 없어요."}
            </p>
          </Card>

          {/* 베타 혜택 */}
          <Card variant="outline" className="p-6">
            <h3 className="text-[14px] font-semibold tracking-tight text-text-main mb-4">
              베타 기간 혜택
            </h3>
            <ul className="flex flex-col gap-3">
              {BETA_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5">
                  <span className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-success-bg mt-0.5">
                    <Check className="w-2.5 h-2.5 text-success" />
                  </span>
                  <span className="text-[13px] text-text-main leading-relaxed">
                    {benefit}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {/* 출시 알림 */}
          <Card variant="outline" className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-text-sub" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-text-main">
                    정식 출시 시 알림 받기
                  </div>
                  <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
                    유료 전환 시점과 베타 사용자 전용 할인 혜택을 가입하신
                    이메일로 안내해드립니다.
                  </p>
                </div>
              </div>
              <Button size="sm" pill variant="secondary" disabled>
                자동 등록됨
              </Button>
            </div>
          </Card>

          {/* 메모 */}
          <p className="text-[11px] text-text-sub text-center font-mono">
            베타 사용 중 발생하는 LLM API 호출 비용은 사용자 본인 OpenAI / Anthropic /
            Google 키로 청구됩니다 (BYOK).
          </p>
        </div>
      </div>
    </>
  );
};

export default Billing;
