import { Upload, Users, MessageCircle, Wallet } from "lucide-react";

const FEATURES = [
  {
    icon: Upload,
    title: "자료만 올리면 끝",
    description:
      "텍스트로 붙여넣거나, 파일로 올리거나, 웹페이지 주소만 넣어도 됩니다.",
  },
  {
    icon: Users,
    title: "고객에게도, 직원에게도",
    description:
      "홈페이지에서는 고객 문의를, 사내에서는 규정·매뉴얼 질문을 받습니다.",
  },
  {
    icon: MessageCircle,
    title: "카카오톡 채널까지",
    description:
      "위젯뿐 아니라 카카오톡 채널에도 연결됩니다. 고객이 있는 곳에서 답합니다.",
  },
  {
    icon: Wallet,
    title: "요금은 그대로",
    description:
      "등록해둔 본인 키로 답합니다. 대화가 늘어도 더 받는 요금은 없습니다.",
  },
];

const Features = () => {
  return (
    <section
      id="features"
      className="border-b border-line min-h-screen flex items-center"
    >
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 py-24 md:py-32">
        <div className="text-center mb-14">
          <h2 className="text-[32px] md:text-[40px] font-semibold tracking-heading text-text-main">
            만드는 데 30초, 붙이는 데 한 줄.
          </h2>
          <p className="mt-3 text-[15px] text-text-sub max-w-xl mx-auto leading-relaxed">
            자료만 준비하시면 나머지는 저희가 합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="p-6 rounded-comfy bg-bg-card shadow-border min-h-[240px] flex flex-col"
            >
              <div className="w-10 h-10 rounded-comfy bg-bg-sub shadow-border flex items-center justify-center mb-5">
                <Icon className="w-4 h-4 text-text-main" />
              </div>
              <h3 className="text-[16px] font-semibold tracking-title text-text-main mb-2.5">
                {title}
              </h3>
              <p className="text-[14px] text-text-sub leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
