import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Bot, Send, RotateCcw, X, MessageCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
// 홑 개행(\n)을 줄바꿈으로 렌더링. 없으면 마크다운 규칙상 공백으로 합쳐져
// LLM 답변과 인사 메시지의 줄이 전부 붙어 나온다.
import remarkBreaks from "remark-breaks";
import { useChatStream, useGet } from "@/hooks/common/useAPI";
import { getVisitorId } from "@/hooks/common/visitorId";
import { remarkGfmKo } from "@/utils/format/markdown";

interface BotPublicDto {
  id: string;
  name: string;
  logo: string | null;
  widget_icon: string | null;
  greeting: string | null;
  active: boolean;
  faqs: { q: string; a: string }[] | null;
  /** 유료 플랜은 false. 응답 전이거나 필드가 없으면 표시하는 쪽으로 기운다. */
  show_badge?: boolean;
}

interface ChatMessage {
  id: number;
  role: "user" | "bot";
  content: string;
  created_at: string | null;
}

interface StreamRequest {
  bot_id: string;
  visitor_id: string;
  content: string;
  session_id: number | undefined;
}

const EmbedChat = () => {
  const { botId } = useParams();
  const params = new URLSearchParams(window.location.search);
  // widget.js가 iframe에 ?mode=widget을 붙여서 호출 → 버블 버튼 없이 채팅창만 표시
  const isWidgetMode = params.get("mode") === "widget";
  /**
   * ?badge=1 — 유료 플랜이라 배지가 꺼진 봇에서도 배지를 되살린다.
   *
   * 홍보용 데모봇이 이 상황이다. 봇을 여러 개 두려면 유료 플랜이어야 하는데
   * 유료는 배지를 지우므로, 정작 사람을 데려와야 할 링크에 돌아올 곳이 없어진다.
   *
   * 인증 없이 열어둬도 되는 이유: 이 파라미터는 배지를 **켜기만** 한다.
   * 끄는 건 여전히 플랜만 할 수 있어서, 알아내도 자기 링크에 우리 표시를
   * 붙이는 것 외에 할 수 있는 게 없다.
   */
  const forceBadge = params.get("badge") === "1";
  /**
   * iframe 밖에서 이 주소를 직접 연 경우 — 카페·메일에 뿌리는 공유 링크가 여기다.
   * 닫아줄 부모가 없고 화면 폭도 우리가 정해야 해서 세 곳에서 갈린다:
   * 창 크기(windowClass) · 헤더의 X · 최종 렌더 분기.
   */
  const isStandalone = window.parent === window;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const visitorId = useRef(getVisitorId());
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: bot, isLoading: botLoading } = useGet<BotPublicDto>(
    `api/bot/public/${botId}`,
    ["bot-public", botId ?? ""],
    !!botId,
  );
  const { sendMessage } = useChatStream<StreamRequest>("api/chat/stream");

  useEffect(() => {
    if (bot?.greeting) {
      setMessages([{ id: 0, role: "bot", content: bot.greeting, created_at: null }]);
    }
  }, [bot?.greeting]);

  const lastContent = messages[messages.length - 1]?.content ?? "";
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, lastContent]);

  const sendText = async (text: string) => {
    if (!text || !botId || isStreaming) return;

    const optimisticUserId = -Date.now();
    const streamingBotId = optimisticUserId - 1;

    setMessages((prev) => [
      ...prev,
      { id: optimisticUserId, role: "user", content: text, created_at: new Date().toISOString() },
      { id: streamingBotId, role: "bot", content: "", created_at: null },
    ]);
    setError(null);
    setIsStreaming(true);

    let buffer = "";
    let acc = "";
    const handleChunk = (raw: string) => {
      buffer += raw;
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const block of events) {
        let evt = "";
        let dataStr = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) evt = line.slice(6).trim();
          else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
        }
        if (!dataStr) continue;
        let data: Record<string, unknown>;
        try { data = JSON.parse(dataStr) as Record<string, unknown>; } catch { continue; }

        if (evt === "meta") {
          const sid = data.session_id;
          if (typeof sid === "number") setSessionId(sid);
          const um = data.user_message as ChatMessage | undefined;
          if (um) setMessages((prev) => prev.map((m) => (m.id === optimisticUserId ? um : m)));
        } else if (evt === "chunk") {
          acc += typeof data.text === "string" ? data.text : "";
          const snapshot = acc;
          setMessages((prev) => prev.map((m) => m.id === streamingBotId ? { ...m, content: snapshot } : m));
        } else if (evt === "done") {
          const bm = data.bot_message as ChatMessage | undefined;
          if (bm) setMessages((prev) => prev.map((m) => (m.id === streamingBotId ? bm : m)));
        } else if (evt === "error") {
          const msg = typeof data.message === "string" ? data.message : "";
          setError(msg || "응답을 받지 못했습니다.");
          setMessages((prev) => prev.filter((m) => m.id !== streamingBotId));
        }
      }
    };

    try {
      await sendMessage({ bot_id: botId, visitor_id: visitorId.current, content: text, session_id: sessionId }, handleChunk);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "응답을 받지 못했습니다.";
      setError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== streamingBotId));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    await sendText(text);
    setInput("");
  };

  const handleFaq = (q: string, a: string) => {
    if (isStreaming) return;
    const userId = -Date.now();
    const botId_ = userId - 1;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: q, created_at: new Date().toISOString() },
      { id: botId_, role: "bot", content: a, created_at: new Date().toISOString() },
    ]);
  };

  const handleReset = () => {
    setMessages(bot?.greeting ? [{ id: 0, role: "bot", content: bot.greeting, created_at: null }] : []);
    setSessionId(undefined);
    setError(null);
  };

  /**
   * 위젯 모드에서는 창을 여닫는 주체가 부모의 widget.js라 여기서 닫을 수 없다.
   * 모바일은 패널이 전체화면이라 버블(닫기 버튼)이 가려지므로,
   * 헤더의 X가 부모에게 닫으라고 알린다. 호스트 사이트 origin은 알 수 없어 "*",
   * 대신 보내는 값에 식별용 source를 넣고 부모는 e.source로 우리 iframe인지 검사한다.
   *
   * 공유 링크(isStandalone)에는 그 메시지를 받을 부모가 없다. 눌러도 아무 일이
   * 안 일어나는 버튼이 되므로 그쪽에서는 X를 아예 그리지 않는다.
   */
  const handleClose = () => {
    if (!isWidgetMode) {
      setIsOpen(false);
      return;
    }
    window.parent.postMessage({ source: "chatbase-widget", type: "close" }, "*");
  };

  const windowClass = [
    "flex flex-col bg-bg-card overflow-hidden",
    isWidgetMode || isStandalone
      ? "w-full h-screen"
      : "w-[360px] h-[560px] rounded-comfy shadow-[0_8px_32px_rgba(0,0,0,0.18)] animate-fade-slide",
  ].join(" ");

  /**
   * 봇 설정이 오기 전의 채팅창.
   *
   * 설정 없이 그리면 "챗봇" → 실제 봇 이름, 인사말 없음 → 인사말,
   * FAQ 버튼과 배지가 뒤늦게 붙는 식으로 방문자 눈앞에서 창이 몇 번 갈아치워진다.
   */
  const loadingWindow = (
    <div className={windowClass}>
      {/* 로딩 중에도 닫을 수 있어야 한다 — 모바일 전체화면에서는 이 X가 유일한 탈출구다. */}
      <header className="shrink-0 flex items-center justify-between px-3.5 h-12 border-b border-line">
        <div className="flex items-center gap-2.5">
          <Bar className="w-7 h-7 rounded-full shrink-0" />
          <div className="flex flex-col gap-1.5">
            <Bar className="h-3 w-28" />
            <Bar className="h-2.5 w-16" />
          </div>
        </div>
        {!isStandalone && (
          <IconBtn label="닫기" onClick={handleClose}>
            <X className="w-3.5 h-3.5" />
          </IconBtn>
        )}
      </header>

      <div className="flex-1 px-3.5 py-3.5 space-y-2.5 bg-bg-sub/40">
        <div className="flex items-start gap-2">
          <Bar className="w-7 h-7 rounded-full shrink-0" />
          <Bar className="h-12 w-3/5 rounded-comfy" />
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-t border-line bg-bg-card">
        <Bar className="h-9 flex-1 rounded-comfy" />
        <Bar className="h-9 w-9 rounded-comfy shrink-0" />
      </div>
    </div>
  );

  const chatWindow = (
    <div className={windowClass}>
      <header className="shrink-0 flex items-center justify-between px-3.5 h-12 border-b border-line">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-bg-sub shadow-border flex items-center justify-center shrink-0 overflow-hidden">
            {bot?.logo ? (
              <img src={bot.logo} alt={bot?.name} className="w-full h-full object-cover" />
            ) : (
              <Bot className="w-3.5 h-3.5 text-text-sub" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold tracking-tight text-text-main truncate">
              {bot?.name || "챗봇"}
            </div>
            <div className="text-[11px] text-text-sub flex items-center gap-1">
              <span className={["w-1.5 h-1.5 rounded-full", bot?.active === false ? "bg-text-disabled" : "bg-point-green"].join(" ")} />
              {bot?.active === false ? "비활성" : "온라인"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <IconBtn label="대화 초기화" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5" />
          </IconBtn>
          {!isStandalone && (
            <IconBtn label="닫기" onClick={handleClose}>
              <X className="w-3.5 h-3.5" />
            </IconBtn>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-2.5 bg-bg-sub/40">
        {messages.map((msg) => {
          if (!msg.content && msg.id >= 0) return null;
          return msg.role === "bot" ? (
            <div key={msg.id} className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-bg-sub shadow-border flex items-center justify-center shrink-0 overflow-hidden">
                {bot?.logo ? (
                  <img src={bot.logo} alt={bot.name} className="w-full h-full object-cover" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-text-sub" />
                )}
              </div>
              <div className="px-3 py-2 rounded-comfy bg-bg-card shadow-border text-[13px] leading-relaxed text-text-main max-w-[90%]">
                {msg.content ? <Markdown text={msg.content} /> : <TypingDots />}
              </div>
            </div>
          ) : (
            <div key={msg.id} className="flex justify-end">
              <div className="px-3 py-2 rounded-comfy bg-text-main text-text-inverse text-[13px] leading-relaxed max-w-[80%] whitespace-pre-wrap">
                {msg.content}
              </div>
            </div>
          );
        })}
        {error && <p className="text-[11px] text-point-red text-center">{error}</p>}
      </div>

      {bot?.faqs && bot.faqs.length > 0 && (
        <div className="shrink-0 flex flex-wrap gap-1.5 px-3.5 py-2 border-t border-line bg-bg-card">
          {bot.faqs.map((faq, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleFaq(faq.q, faq.a)}
              disabled={isStreaming}
              className="px-3 py-1.5 rounded-full bg-bg-sub shadow-border text-[12px] text-text-main hover:bg-bg-hover transition-colors disabled:opacity-50"
            >
              {faq.q}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSend} className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-t border-line bg-bg-card">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isStreaming ? "응답을 기다리는 중..." : "메시지를 입력하세요"}
          disabled={isStreaming}
          className="flex-1 h-9 px-3 rounded-comfy bg-input-bg shadow-border text-[13px] text-text-main placeholder:text-text-placeholder outline-none border-0 focus:shadow-[0_0_0_1px_rgb(var(--text-main))] transition-shadow disabled:opacity-60"
        />
        <button
          type="submit"
          aria-label="전송"
          disabled={!input.trim() || isStreaming}
          className="inline-flex items-center justify-center w-9 h-9 rounded-comfy bg-text-main text-text-inverse hover:bg-text-main/90 disabled:bg-bg-disabled disabled:text-text-disabled disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
      {(forceBadge || bot?.show_badge !== false) && (
        <div className="shrink-0 flex justify-center py-1.5 bg-bg-card">
          <a
            href="https://chatbase.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-text-disabled hover:text-text-sub transition-colors"
          >
            Powered by chatbase.kr
          </a>
        </div>
      )}
    </div>
  );

  /**
   * 공유 링크로 직접 연 경우 — 카페·메일에 붙이는 주소가 여기로 온다.
   *
   * ?mode=widget이 없으면 원래는 버블 하나만 떠 있는 빈 화면이 나오는데, 링크를
   * 받은 사람은 그게 눌러야 하는 물건인지 모른다. 그래서 파라미터와 무관하게
   * 채팅창을 바로 띄운다.
   *
   * 폭을 480px로 묶는 이유: 위젯 창은 iframe이 크기를 정해주는 걸 전제로 w-full이라,
   * 모니터에서 그냥 열면 말풍선이 화면 끝까지 늘어난다.
   * 기둥은 배경색이 아니라 shadow-border로 나눈다 (DESIGN.md 6).
   */
  if (isStandalone) {
    return (
      <div className="min-h-screen flex justify-center bg-bg-card font-sans">
        <div className="w-full max-w-[480px] shadow-border">
          {botLoading ? loadingWindow : chatWindow}
        </div>
      </div>
    );
  }

  // widget.js 사용 시: 채팅창만 (버블 버튼은 widget.js가 관리)
  if (isWidgetMode) return botLoading ? loadingWindow : chatWindow;

  // iframe 직접 삽입 시: 버블 버튼 + 채팅창
  return (
    <div className="fixed bottom-4 right-4 flex flex-col items-end gap-3 font-sans">
      {isOpen && (botLoading ? loadingWindow : chatWindow)}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "채팅 닫기" : "채팅 열기"}
        className="w-12 h-12 rounded-full bg-text-main text-text-inverse shadow-[0_4px_16px_rgba(0,0,0,0.24)] flex items-center justify-center overflow-hidden transition-transform duration-150 hover:scale-105 active:scale-95"
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : bot?.widget_icon ? (
          <img src={bot.widget_icon} alt={bot.name} className="w-full h-full object-cover" />
        ) : (
          <MessageCircle className="w-5 h-5" />
        )}
      </button>
    </div>
  );
};

/** 로딩 자리를 채우는 스켈레톤 블록. 크기는 className으로 지정한다. */
const Bar = ({ className = "" }: { className?: string }) => (
  <div
    aria-hidden="true"
    className={["relative overflow-hidden bg-skeleton-base rounded-DEFAULT", className].join(" ")}
  >
    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-skeleton-shine to-transparent animate-shimmer motion-reduce:animate-none" />
  </div>
);

const IconBtn = ({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-text-sub hover:text-text-main hover:bg-bg-hover transition-colors"
  >
    {children}
  </button>
);

const normalizeMarkdown = (text: string) =>
  text.replace(/(\*\*|__)(?=["'"'"])/g, "$1​");

const Markdown = ({ text }: { text: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfmKo, remarkBreaks]}
    components={{
      p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      ul: ({ children }) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
      li: ({ children }) => <li>{children}</li>,
      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-text-main hover:opacity-80">{children}</a>,
      code: ({ children }) => <code className="px-1 py-0.5 rounded bg-bg-sub text-[12px] font-mono break-all">{children}</code>,
      pre: ({ children }) => <pre className="px-2 py-1.5 my-1 rounded bg-bg-sub text-[12px] font-mono whitespace-pre-wrap break-all">{children}</pre>,
      h1: ({ children }) => <h3 className="text-[14px] font-semibold mt-1 mb-0.5">{children}</h3>,
      h2: ({ children }) => <h3 className="text-[14px] font-semibold mt-1 mb-0.5">{children}</h3>,
      h3: ({ children }) => <h3 className="text-[13px] font-semibold mt-1 mb-0.5">{children}</h3>,
    }}
  >
    {normalizeMarkdown(text)}
  </ReactMarkdown>
);

const TypingDots = () => (
  <span className="inline-flex items-center gap-1">
    <span className="w-[3px] h-[3px] rounded-full bg-text-sub animate-pulse" />
    <span className="w-[3px] h-[3px] rounded-full bg-text-sub animate-pulse [animation-delay:120ms]" />
    <span className="w-[3px] h-[3px] rounded-full bg-text-sub animate-pulse [animation-delay:240ms]" />
  </span>
);

export default EmbedChat;
