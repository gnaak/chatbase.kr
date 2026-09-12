import {
  Upload,
  QrCode,
  Languages,
  Users,
  MessageCircle,
  Wallet,
} from "lucide-react";

/**
 * QR·다국어를 위쪽에 둔다. 나머지는 챗봇 SaaS면 대개 하는 것이고,
 * **사이트 없이 시작되는 것**과 **손님 언어로 답하는 것**이 우리가 다른 지점이다.
 * 스크롤을 끝까지 내리지 않는 사람이 그 둘을 보고 나가야 한다.
 */
const FEATURES = [
  {
    icon: Upload,
    title: "자료만 올리면 끝",
    description:
      "텍스트로 붙여넣거나, 파일로 올리거나, 웹페이지 주소만 넣어도 됩니다.",
  },
  {
    icon: QrCode,
    title: "홈페이지가 없어도 됩니다",
    description:
      "QR 한 장을 인쇄해 카운터나 테이블에 두세요. 손님이 찍으면 바로 열립니다. 사이트도, 앱 설치도 필요 없습니다.",
  },
  {
    icon: Languages,
    title: "손님이 쓰는 말로 답합니다",
    description:
      "한국어·영어·일본어·중국어. 인사말과 자주 묻는 질문은 미리 번역해두고, 대화는 손님이 쓴 말을 따라갑니다.",
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
    title: "API 키 없이 바로",
    description:
      "GPT 사용료는 저희가 냅니다. 내 키를 등록하면 모델 선택과 무제한 대화가 열립니다.",
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
            만드는 데 30초, 내거는 데 한 줄.
          </h2>
          <p className="mt-3 text-[15px] text-text-sub max-w-xl mx-auto leading-relaxed">
            사이트에는 코드 한 줄, 매장에는 QR 한 장.
            자료만 준비하시면 나머지는 저희가 합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="p-6 rounded-comfy bg-bg-card shadow-border min-h-[200px] flex flex-col"
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
