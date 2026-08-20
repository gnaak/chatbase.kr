import CodeBlock from "@/component/dashboard/ui/codeBlock";

const STEPS = [
  {
    num: "01",
    title: "챗봇 만들기",
    description:
      "이름, 인사 메시지, 시스템 프롬프트, 학습 데이터(자주 묻는 질문 등)를 입력합니다. 라이브 미리보기로 즉시 동작을 확인할 수 있습니다.",
  },
  {
    num: "02",
    title: "임베드 코드 복사",
    description:
      "생성된 <script> 태그 한 줄을 복사해 자기 사이트의 </body> 직전에 붙여넣습니다.",
    code: `<script
  src="https://chatbase.kr/widget.js"
  data-bot-id="abc123"
  defer></script>`,
  },
  {
    num: "03",
    title: "자동 응대 시작",
    description:
      "방문자가 우측 하단 버블을 클릭하면, 챗봇이 학습한 데이터를 바탕으로 응답합니다. BYOK 모델이라 호출은 사용자 본인 키로 처리됩니다.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how" className="border-b border-line bg-bg-sub/40 min-h-screen flex items-center">
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 py-24 md:py-32">
        <div className="text-center mb-14">
          <h2 className="text-[32px] md:text-[40px] font-semibold tracking-heading text-text-main">
            3단계, 30초 안에.
          </h2>
          <p className="mt-3 text-[15px] text-text-sub max-w-xl mx-auto leading-relaxed">
            복잡한 설정도, 별도 인프라도 필요 없습니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="flex flex-col gap-4 p-6 rounded-comfy bg-bg-card shadow-border"
            >
              <div className="font-mono text-[12px] text-text-sub">{step.num}</div>
              <h3 className="text-[18px] font-semibold tracking-title text-text-main">
                {step.title}
              </h3>
              <p className="text-[13px] text-text-sub leading-relaxed flex-1">
                {step.description}
              </p>
              {step.code && <CodeBlock code={step.code} className="mt-2" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
