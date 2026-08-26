import { useState, ReactNode } from "react";
import { ExternalLink, Plus } from "lucide-react";
import Button from "@/component/dashboard/ui/button";

interface FaqItem {
  q: string;
  a: ReactNode;
}

/** 각 제공자 API 키 발급 페이지. 본문 인라인 링크는 눈에 안 띄어 버튼으로 노출한다. */
const API_KEY_LINKS = [
  { label: "OpenAI 키 발급", href: "https://platform.openai.com/api-keys" },
  {
    label: "Anthropic 키 발급",
    href: "https://console.anthropic.com/settings/keys",
  },
  { label: "Google 키 발급", href: "https://aistudio.google.com/app/apikey" },
];

const ITEMS: FaqItem[] = [
  {
    q: "BYOK가 뭐예요? 왜 API 키를 직접 등록해야 하나요?",
    a: (
      <>
        BYOK(Bring Your Own Key)는 OpenAI, Anthropic, Google의 API 키를 직접
        발급받아 등록하는 방식입니다. 챗봇이 답할 때 회원님 키로 호출되므로,{" "}
        <strong>모델 사용료는 해당 제공자에 직접 결제</strong>됩니다.
        chatbase.kr는 호출비를 중간에서 받지 않습니다. 그래서 대화가 늘어도
        저희 쪽 요금은 그대로입니다.
      </>
    ),
  },
  {
    q: "API 키 등록이 어렵지 않나요?",
    a: (
      <>
        각 제공자 사이트에서 5분 안에 발급받을 수 있습니다. 발급받은 키를
        대시보드 &gt; API 키 페이지에 한 번만 등록하면 됩니다. 세 곳 모두
        등록하실 필요는 없고, 쓰실 모델의 키 하나만 있으면 됩니다.
        <div className="mt-4 flex flex-wrap gap-2">
          {API_KEY_LINKS.map(({ label, href }) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer">
              <Button
                size="sm"
                pill
                variant="secondary"
                rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
              >
                {label}
              </Button>
            </a>
          ))}
        </div>
      </>
    ),
  },
  {
    q: "등록한 키는 안전한가요?",
    a: (
      <>
        모든 API 키는 Fernet(AES-128) 대칭키 암호화로 데이터베이스에 저장됩니다.
        평문은 어떤 시점에도 저장되지 않으며, 챗봇이 응답을 생성하는 순간에만
        복호화되어 외부 LLM 호출에 사용됩니다. 회원이 직접 삭제하거나 탈퇴 시
        즉시 파기됩니다.
      </>
    ),
  },
  {
    q: "답변에 쓸 자료는 어떻게 넣나요?",
    a: (
      <>
        세 가지 방법이 있습니다. 대시보드에 <strong>텍스트로 직접 입력</strong>
        하거나, <strong>파일을 업로드</strong>하거나,{" "}
        <strong>웹페이지 주소를 넣어</strong> 내용을 읽어올 수 있습니다. FAQ,
        영업시간, 환불 정책, 사내 규정 등 답변시킬 내용을 자유롭게 넣으면
        됩니다. 자료에 없는 질문에는 미리 설정한 fallback 메시지로 안내합니다.
        <br />
        <br />
        <span className="text-text-sub">
          참고 — 파일 업로드 학습은 현재 OpenAI 모델을 선택한 경우에 지원됩니다.
          다른 모델에서는 텍스트·웹페이지 방식을 이용해주세요.
        </span>
      </>
    ),
  },
  {
    q: "사내 매뉴얼이나 직원 교육용으로도 쓸 수 있나요?",
    a: (
      <>
        네. 고객 응대와 같은 방식으로 만들면 됩니다. 인사 규정, 업무 매뉴얼,
        복지 안내 같은 자료를 넣어두면 직원이 "육아휴직 신청 절차가
        어떻게 되나요?" 같은 질문을 챗봇에 바로 물어볼 수 있습니다. 홈페이지에
        붙이지 않고 사내에 링크만 공유하셔도 동작합니다.
        <br />
        <br />
        <span className="text-text-sub">
          링크를 아는 사람이면 누구나 이용할 수 있으니, 민감한 자료는 이 점을
          고려해주세요. 사내 구성원만 쓰는 전용 챗봇 사이트가 필요하시면
          Enterprise 구축으로 문의해주세요.
        </span>
      </>
    ),
  },
  {
    q: "카카오톡 채널에도 붙일 수 있나요?",
    a: (
      <>
        네. 카카오 오픈빌더의 스킬 서버로 연결하면 카카오톡 채널에서도 같은
        챗봇이 답합니다. 대시보드에서 스킬 URL과 시크릿을 발급받아 오픈빌더에
        등록하시면 됩니다. 홈페이지 위젯과 카카오톡을 함께 쓰실 수 있고, 대화
        기록도 한곳에서 확인됩니다.
      </>
    ),
  },
  {
    q: "정말 코드 한 줄로 임베드되나요?",
    a: (
      <>
        네. 챗봇을 생성하면 다음과 같은 한 줄짜리 script 태그가 발급됩니다:
        <code className="block mt-2 px-3 py-2 rounded-DEFAULT bg-bg-sub shadow-border font-mono text-[12px] text-text-main overflow-x-auto">
          {`<script src="https://chatbase.kr/widget.js" data-bot-id="..." defer></script>`}
        </code>
        이 한 줄을 자기 사이트의{" "}
        <code className="font-mono text-[12px]">&lt;/body&gt;</code> 직전에
        붙여넣으면, 우측 하단에 채팅 버블이 자동 생성됩니다. iframe 방식도 같이
        제공합니다.
      </>
    ),
  },
  {
    q: "요금은 어떻게 되나요?",
    a: (
      <>
        무료 플랜은 챗봇 1개에 <strong>월 대화 100건</strong>까지이고, 내 사이트
        임베드도 그대로 됩니다. 먼저 붙여보시고 한도가 모자라면 올리시면 됩니다.
        Standard(월 19,000원)부터는 <strong>대화 건수 제한이 없고</strong>,
        카카오톡 채널까지 쓰시려면 Premium(월 49,000원)입니다. 부가세 별도이며,
        사내 전용 챗봇 구축은 Enterprise로 별도 협의합니다. 자세한 구성은{" "}
        <a href="#pricing" className="text-text-main underline underline-offset-2">
          가격
        </a>{" "}
        섹션에서 확인하실 수 있습니다.
      </>
    ),
  },
  {
    q: "한국어 응답이 자연스러운가요?",
    a: (
      <>
        OpenAI, Anthropic, Google의 최신 모델 모두 한국어 응답이 매우
        자연스럽습니다. 시스템 프롬프트에서 말투(존댓말/반말, 공식적/친근함)를
        지정할 수 있고, 자료를 한국어로 넣으면 그 톤을 따라갑니다. 모델은
        대시보드에서 언제든 바꿀 수 있습니다.
      </>
    ),
  },
  {
    q: "어떤 사이트에 임베드할 수 있나요?",
    a: (
      <>
        HTML 코드를 수정할 수 있는 모든 사이트에서 동작합니다. 카페24, 아임웹,
        식스샵, Shopify, WordPress, Webflow, 자체 제작 사이트 모두 지원합니다.
        script 태그 또는 iframe 둘 다 사용할 수 있어요.
      </>
    ),
  },
];

const Faq = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="border-b border-line min-h-screen flex items-center"
    >
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 py-24 md:py-32">
        <div className="text-center mb-14">
          <h2 className="text-[32px] md:text-[40px] font-semibold tracking-heading text-text-main">
            자주 묻는 질문
          </h2>
          <p className="mt-3 text-[15px] text-text-sub max-w-xl mx-auto leading-relaxed">
            궁금한 점이 있으신가요? 아래에서 먼저 확인해보세요.
          </p>
        </div>

        <div className="max-w-3xl mx-auto rounded-comfy bg-bg-card shadow-border overflow-hidden">
          {ITEMS.map((item, i) => {
            const isOpen = i === openIdx;
            return (
              <div
                key={i}
                className={[
                  "border-b border-line last:border-0",
                  isOpen ? "bg-bg-sub/40" : "",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  className="w-full flex items-start justify-between gap-4 text-left px-5 md:px-6 py-5 hover:bg-bg-hover/40 transition-colors"
                >
                  <span className="text-[15px] font-medium text-text-main flex-1">
                    {item.q}
                  </span>
                  <Plus
                    className={[
                      "shrink-0 w-4 h-4 mt-1 text-text-sub transition-transform duration-200",
                      isOpen ? "rotate-45" : "",
                    ].join(" ")}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 md:px-6 pb-5 text-[14px] leading-relaxed text-text-sub animate-fade-slide">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-[13px] text-text-sub">
          답을 찾지 못하셨나요?{" "}
          <a
            href="mailto:hello@chatbase.kr"
            className="text-text-main underline underline-offset-2"
          >
            hello@chatbase.kr
          </a>
          로 문의주세요.
        </p>
      </div>
    </section>
  );
};

export default Faq;
