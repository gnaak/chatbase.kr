import { useState, ReactNode } from "react";
import { Plus } from "lucide-react";

interface FaqItem {
  q: string;
  a: ReactNode;
}

const ITEMS: FaqItem[] = [
  {
    q: "BYOK가 뭐예요? 왜 API 키를 직접 등록해야 하나요?",
    a: (
      <>
        BYOK(Bring Your Own Key)는 OpenAI, Anthropic, Google의 API 키를 직접
        발급받아 등록하는 방식입니다. 챗봇이 응답할 때 회원님 키로 호출되어,{" "}
        <strong>사용량과 과금이 회원님 계정에 직접 청구</strong>됩니다.
        chatbase.kr는 호출비를 중간에서 받지 않으므로, 트래픽이 폭증해도 우리
        쪽으로 추가 결제가 발생하지 않습니다.
      </>
    ),
  },
  {
    q: "API 키 등록이 어렵지 않나요?",
    a: (
      <>
        OpenAI는{" "}
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-main hover:underline"
        >
          platform.openai.com
        </a>
        , Anthropic은{" "}
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-main hover:underline"
        >
          console.anthropic.com
        </a>
        , Google은{" "}
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-main hover:underline"
        >
          aistudio.google.com
        </a>
        에서 5분 안에 발급받을 수 있습니다. 발급받은 키를 대시보드 &gt; API 키
        페이지에 한 번만 등록하면 됩니다.
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
    q: "학습 데이터는 어떻게 입력하나요?",
    a: (
      <>
        대시보드에서 텍스트로 직접 입력합니다. FAQ, 영업시간, 환불 정책, 회사
        소개 등 답변시킬 내용을 자유롭게 작성하면 됩니다. 챗봇은 입력된 내용을
        바탕으로 응답하며, 학습 데이터에 없는 질문은 미리 설정한 fallback
        메시지로 안내합니다.
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
        이 한 줄을 자기 사이트의 <code className="font-mono text-[12px]">&lt;/body&gt;</code>{" "}
        직전에 붙여넣으면, 우측 하단에 채팅 버블이 자동 생성됩니다. iframe
        방식도 같이 제공합니다.
      </>
    ),
  },
  {
    q: "베타 기간이 끝나면 어떻게 되나요?",
    a: (
      <>
        정식 출시 시점에 유료 플랜(예정 월 19,000원)으로 전환될 수 있습니다.
        베타 기간 중 가입한 회원에게는 별도의 할인 또는 혜택이 적용되며, 변경
        시점 최소 7일 전에 가입 이메일로 안내합니다. 기존 챗봇과 데이터는 그대로
        유지됩니다.
      </>
    ),
  },
  {
    q: "한국어 응답이 자연스러운가요?",
    a: (
      <>
        OpenAI GPT-4o, Anthropic Claude, Google Gemini 모두 한국어 응답이 매우
        자연스럽습니다. 시스템 프롬프트에서 말투(존댓말/반말, 공식적/친근함)를
        지정할 수 있고, 학습 데이터를 한국어로 입력하면 그 톤을 따라갑니다.
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
    <section id="faq" className="border-b border-line min-h-screen flex items-center">
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
            className="text-text-main hover:underline"
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
