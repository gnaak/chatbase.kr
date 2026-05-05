import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Bot, Send, RotateCcw, X, MessageCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatStream, useGet } from "@/hooks/common/useAPI";
import { getVisitorId } from "@/hooks/common/visitorId";

interface BotPublicDto {
  id: string;
  name: string;
  logo: string | null;
  widget_icon: string | null;
  greeting: string | null;
  active: boolean;
  faqs: { q: string; a: string }[] | null;
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
  // widget.js가 iframe에 ?mode=widget을 붙여서 호출 → 버블 버튼 없이 채팅창만 표시
  const isWidgetMode = new URLSearchParams(window.location.search).get("mode") === "widget";

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const visitorId = useRef(getVisitorId());
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: bot } = useGet<BotPublicDto>(
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

  const chatWindow = (
    <div className={[
      "flex flex-col bg-bg-card overflow-hidden",
      isWidgetMode
        ? "w-full h-screen"
        : "w-[360px] h-[560px] rounded-comfy shadow-[0_8px_32px_rgba(0,0,0,0.18)] animate-fade-slide",
    ].join(" ")}>
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
          {!isWidgetMode && (
            <IconBtn label="닫기" onClick={() => setIsOpen(false)}>
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
    </div>
  );

  // widget.js 사용 시: 채팅창만 (버블 버튼은 widget.js가 관리)
  if (isWidgetMode) return chatWindow;

  // standalone iframe 사용 시: 버블 버튼 + 채팅창
  return (
    <div className="fixed bottom-4 right-4 flex flex-col items-end gap-3 font-sans">
      {isOpen && chatWindow}
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
    remarkPlugins={[remarkGfm]}
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
