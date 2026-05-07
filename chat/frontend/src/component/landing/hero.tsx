import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, Send } from "lucide-react";
import Button from "@/component/dashboard/ui/button";

const Hero = () => {
  return (
    <section className="relative overflow-hidden border-b border-line min-h-screen flex items-center">
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 py-24 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* 좌측: 텍스트 + CTA (상단 정렬) */}
          <div className="flex flex-col items-start lg:self-start">
            <span className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-info-bg text-info text-[12px] font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-info" />
              BETA · 모든 기능 무료
            </span>

            <h1 className="text-[40px] md:text-[56px] font-semibold tracking-display leading-[1.05] text-text-main">
              고객 응대, 챗봇에게.
              <br />
              <span className="text-text-sub">10분이면 끝.</span>
            </h1>

            <p className="mt-6 text-[16px] md:text-[18px] text-text-sub leading-relaxed max-w-xl">
              자주 묻는 질문, 영업시간, 환불 정책 — 답변시킬 내용만 입력하면
              내 사이트에 임베드할 수 있는 AI 챗봇이 완성됩니다.{" "}
              <span className="text-text-main">
                코드 한 줄 붙이고, 24시간 자동 응대를 시작하세요.
              </span>
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Link to="/dashboard">
                <Button
                  size="lg"
                  pill
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  30초 만에 시작
                </Button>
              </Link>
              <a href="#how">
                <Button size="lg" pill variant="secondary">
                  작동 방식 보기
                </Button>
              </a>
            </div>

            <p className="mt-5 text-[12px] text-text-sub flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>신용카드 없이 시작</span>
              <span className="text-text-disabled">·</span>
              <span>베타 기간 모든 기능 무료</span>
              <span className="text-text-disabled">·</span>
              <span>사용량은 등록한 API 키로 직접 청구</span>
            </p>
          </div>

          {/* 우측: 챗봇 미리보기 (애니메이션) */}
          <div className="lg:justify-self-end w-full">
            <FakeChatPreview />
          </div>
        </div>
      </div>
    </section>
  );
};

/* ── 가짜 채팅 애니메이션 ─────────────────── */

interface ScriptStep {
  role: "user" | "bot";
  text: string;
  /** 직전 단계가 끝난 뒤 이 단계가 시작되기까지 대기(ms) */
  delay: number;
}

const SCRIPT: ScriptStep[] = [
  { role: "bot", text: "안녕하세요! 무엇을 도와드릴까요?", delay: 600 },
  { role: "user", text: "영업시간이 어떻게 되나요?", delay: 1400 },
  {
    role: "bot",
    text: "평일 오전 10시부터 오후 7시까지 운영합니다. 점심시간은 12-1시예요.",
    delay: 1000,
  },
  { role: "user", text: "주말도 운영하나요?", delay: 1500 },
  {
    role: "bot",
    text: "주말은 휴무입니다. 토·일 모두 운영하지 않으니 평일 시간대를 이용해주세요.",
    delay: 1000,
  },
];

const TYPING_DOT_MS = 700; // 봇이 말하기 전 typing dot 표시
const BOT_CHAR_MS = 22; // 봇 typewriter 속도 (LLM streaming 느낌)
const USER_CHAR_MS = 55; // 사용자 typewriter 속도 (사람 타이핑 느낌)
const RESTART_DELAY_MS = 4500; // 한 사이클 끝난 뒤 다시 시작까지

interface RenderedMsg {
  id: number;
  role: "user" | "bot";
  text: string;
}

const FakeChatPreview = () => {
  const [messages, setMessages] = useState<RenderedMsg[]>([]);
  const [typing, setTyping] = useState(false);
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let mounted = true;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = window.setTimeout(resolve, ms);
        // cancellable
        if (cancelledRef.current) window.clearTimeout(t);
      });

    const typewriter = async (id: number, full: string, charMs: number) => {
      for (let i = 1; i <= full.length; i++) {
        if (cancelledRef.current || !mounted) return;
        const partial = full.slice(0, i);
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, text: partial } : m)),
        );
        await wait(charMs);
      }
    };

    const typewriterInput = async (full: string, charMs: number) => {
      for (let i = 1; i <= full.length; i++) {
        if (cancelledRef.current || !mounted) return;
        setInputText(full.slice(0, i));
        await wait(charMs);
      }
    };

    const run = async () => {
      while (!cancelledRef.current && mounted) {
        setMessages([]);
        setTyping(false);
        setInputText("");
        await wait(400);

        let nextId = 1;
        for (const step of SCRIPT) {
          if (cancelledRef.current || !mounted) return;
          await wait(step.delay);

          if (step.role === "user") {
            // 1) 입력창에 글자가 한 글자씩 타이핑
            await typewriterInput(step.text, USER_CHAR_MS);
            await wait(280); // 잠시 멈췄다가
            if (cancelledRef.current || !mounted) return;
            // 2) 전송 — 입력창 비우고 풍선 추가
            setInputText("");
            setMessages((prev) => [
              ...prev,
              { id: nextId++, role: "user", text: step.text },
            ]);
          } else {
            setTyping(true);
            await wait(TYPING_DOT_MS);
            if (cancelledRef.current || !mounted) return;
            setTyping(false);
            const id = nextId++;
            setMessages((prev) => [...prev, { id, role: "bot", text: "" }]);
            await typewriter(id, step.text, BOT_CHAR_MS);
          }
        }

        await wait(RESTART_DELAY_MS);
      }
    };

    run();
    return () => {
      cancelledRef.current = true;
      mounted = false;
    };
  }, []);

  // 자동 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  return (
    <div className="w-full flex justify-center lg:justify-end">
      <div
        className="
          flex flex-col
          w-full max-w-[460px]
          h-[min(640px,calc(100svh-12rem))]
          lg:h-[700px]
          rounded-comfy bg-bg-card
          shadow-card dark:shadow-card-dark
          overflow-hidden
        "
      >
        {/* 헤더 */}
        <div className="shrink-0 flex items-center justify-between px-3.5 h-12 border-b border-line">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold tracking-tight text-text-main">
              고객지원 봇
            </div>
            <div className="text-[11px] text-text-sub flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-point-green" />
              온라인
            </div>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scrollbar-visible px-5 py-5 space-y-3 bg-bg-sub/40"
        >
          {messages.map((m) =>
            m.role === "bot" ? (
              <BotMsg key={m.id}>{m.text}</BotMsg>
            ) : (
              <UserMsg key={m.id}>{m.text}</UserMsg>
            ),
          )}
          {typing && <TypingIndicator />}
        </div>

        {/* 입력창 */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-t border-line">
          <div className="flex-1 h-9 rounded-comfy bg-input-bg shadow-border px-3 flex items-center text-[13px] truncate">
            {inputText ? (
              <span className="text-text-main">
                {inputText}
                <span className="inline-block w-[1px] h-[14px] bg-text-main align-middle ml-[1px] animate-caret" />
              </span>
            ) : (
              <span className="text-text-placeholder">메시지를 입력하세요</span>
            )}
          </div>
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-comfy bg-text-main text-text-inverse">
            <Send className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

const BotMsg = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-start gap-2 animate-fade-slide">
    <div className="w-7 h-7 rounded-full bg-bg-sub shadow-border flex items-center justify-center shrink-0">
      <Bot className="w-3.5 h-3.5 text-text-sub" />
    </div>
    <div className="px-3 py-2 rounded-comfy bg-bg-card shadow-border text-[13px] leading-relaxed text-text-main max-w-[80%] whitespace-pre-wrap">
      {children}
    </div>
  </div>
);

const UserMsg = ({ children }: { children: React.ReactNode }) => (
  <div className="flex justify-end animate-fade-slide">
    <div className="px-3 py-2 rounded-comfy bg-text-main text-text-inverse text-[13px] leading-relaxed max-w-[80%] whitespace-pre-wrap">
      {children}
    </div>
  </div>
);

const TypingIndicator = () => (
  <div className="flex items-start gap-2 animate-fade-slide">
    <div className="w-7 h-7 rounded-full bg-bg-sub shadow-border flex items-center justify-center shrink-0">
      <Bot className="w-3.5 h-3.5 text-text-sub" />
    </div>
    <div className="px-2.5 py-2 rounded-comfy bg-bg-card shadow-border">
      <span className="inline-flex gap-1">
        <span className="w-[3px] h-[3px] rounded-full bg-text-sub animate-pulse" />
        <span className="w-[3px] h-[3px] rounded-full bg-text-sub animate-pulse [animation-delay:120ms]" />
        <span className="w-[3px] h-[3px] rounded-full bg-text-sub animate-pulse [animation-delay:240ms]" />
      </span>
    </div>
  </div>
);

export default Hero;
