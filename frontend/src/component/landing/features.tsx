import { Zap, KeyRound, Code } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "30초 셋업",
    description:
      "URL 크롤링이나 복잡한 학습 과정 없이, 시스템 프롬프트와 텍스트만 입력하면 즉시 챗봇이 완성됩니다.",
  },
  {
    icon: KeyRound,
    title: "BYOK · 수수료 없음",
    description:
      "OpenAI / Anthropic / Google API 키를 직접 등록할 수 있습니다. 호출 비용은 본인 계정으로 청구되어, 사용량이 폭증해도 추가 결제가 발생하지 않습니다.",
  },
  {
    icon: Code,
    title: "코드 한 줄 임베드",
    description:
      "<script> 태그 한 줄을 자기 사이트에 붙여넣기만 하면, 우측 하단에 채팅 버블이 자동으로 생성됩니다.",
  },
];

const Features = () => {
  return (
    <section id="features" className="border-b border-line min-h-screen flex items-center">
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 py-24 md:py-32">
        <div className="text-center mb-14">
          <h2 className="text-[32px] md:text-[40px] font-semibold tracking-heading text-text-main">
            챗봇 SaaS, 부담 없이.
          </h2>
          <p className="mt-3 text-[15px] text-text-sub max-w-xl mx-auto leading-relaxed">
            한국 SMB가 부담 없이 쓸 수 있도록 만든 챗봇 임베드 SaaS입니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="p-8 rounded-comfy bg-bg-card shadow-border min-h-[320px] flex flex-col"
            >
              <div className="w-11 h-11 rounded-comfy bg-bg-sub shadow-border flex items-center justify-center mb-6">
                <Icon className="w-5 h-5 text-text-main" />
              </div>
              <h3 className="text-[18px] font-semibold tracking-title text-text-main mb-3">
                {title}
              </h3>
              <p className="text-[14px] text-text-sub leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
