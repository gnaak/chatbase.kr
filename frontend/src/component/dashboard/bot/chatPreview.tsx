import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { Send, Bot, RotateCcw, X, MessageCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useChatStream } from "@/hooks/common/useAPI";
import { getVisitorId } from "@/hooks/common/visitorId";

interface StreamRequest {
  bot_id: string;
  visitor_id: string;
  content: string;
  session_id: number | null;
}

interface ChatPreviewProps {
  botName: string;
  greeting: string;
  fallback: string;
  logo?: string;
  widgetIcon?: string;
  slug?: string;
}

interface PreviewMessage {
  role: "bot" | "user";
  text: string;
}

const ChatPreview = ({
  botName,
  greeting,
  fallback,
  logo,
  widgetIcon,
  slug,
}: ChatPreviewProps) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="relative h-full">
      <div className="absolute bottom-0 right-0 flex flex-col items-end gap-3">
        {isOpen && (
          <ChatWindow
            botName={botName}
            greeting={greeting}
            fallback={fallback}
            logo={logo}
            slug={slug}
            onClose={() => setIsOpen(false)}
          />
        )}
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-label={isOpen ? "채팅 닫기" : "채팅 열기"}
          className="
            w-12 h-12 rounded-full bg-text-main text-text-inverse
            shadow-card dark:shadow-card-dark
            flex items-center justify-center overflow-hidden
            transition-transform duration-150 hover:scale-105 active:scale-95
          "
        >
          {widgetIcon ? (
            <img src={widgetIcon} alt={botName} className="w-full h-full object-cover" />
          ) : (
            <MessageCircle className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
};

interface ChatWindowProps extends ChatPreviewProps {
  onClose: () => void;
}

const ChatWindow = ({
  botName,
  greeting,
  fallback,
  logo,
  slug,
  onClose,
}: ChatWindowProps) => {
  const initialMessages: PreviewMessage[] = [
    { role: "bot", text: greeting || "안녕하세요!" },
  ];
  const [messages, setMessages] = useState<PreviewMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const sessionIdRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { sendMessage } = useChatStream<StreamRequest>("api/chat/stream");
  const visitorId = useMemo(() => getVisitorId(), []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const updateLastBot = (mutator: (text: string) => string) => {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === "bot") {
          next[i] = { ...next[i], text: mutator(next[i].text) };
          break;
        }
      }
      return next;
    });
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;

    // 봇 미저장 상태(생성 전): 모킹 답변
    if (!slug) {
      setMessages((prev) => [
        ...prev,
        { role: "user", text },
        {
          role: "bot",
          text:
            fallback ||
            "(미리보기에서는 실제 응답이 생성되지 않습니다. 봇을 저장하면 실제 LLM이 응답합니다.)",
        },
      ]);
      setInput("");
      return;
    }

    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "bot", text: "" },
    ]);
    setInput("");
    setPending(true);

    let buffer = "";
    const handleChunk = (raw: string) => {
      buffer += raw;
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        if (!block.trim()) continue;
        let event = "message";
        let data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data = line.slice(5).trim();
        }
        if (!data) continue;
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(data) as Record<string, unknown>;
        } catch {
          continue;
        }

        if (event === "meta") {
          const sid = payload.session_id;
          if (typeof sid === "number") {
            sessionIdRef.current = sid;
          }
        } else if (event === "chunk") {
          const piece = typeof payload.text === "string" ? payload.text : "";
          if (piece) updateLastBot((prev) => prev + piece);
        } else if (event === "error") {
          const msg = typeof payload.message === "string" ? payload.message : "";
          updateLastBot(() => msg || fallback || "응답을 받지 못했습니다.");
        }
      }
    };

    try {
      await sendMessage(
        {
          bot_id: slug,
          visitor_id: visitorId,
          content: text,
          session_id: sessionIdRef.current,
        },
        handleChunk,
      );
    } catch (err: any) {
      updateLastBot((prev) =>
        prev || fallback || `오류: ${err?.message ?? "알 수 없는 오류"}`,
      );
    } finally {
      setPending(false);
    }
  };

  const handleReset = () => {
    setMessages([{ role: "bot", text: greeting || "안녕하세요!" }]);
    setInput("");
    sessionIdRef.current = null;
  };

  return (
    <div
      className="
        flex flex-col
        w-[460px] max-w-full
        h-[700px] max-h-[calc(100svh-8rem)]
        bg-bg-card rounded-comfy
        shadow-card dark:shadow-card-dark
        overflow-hidden
        animate-fade-slide
      "
    >
      <div className="flex items-center justify-between gap-3 px-3.5 h-12 border-b border-line">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold tracking-tight text-text-main truncate">
            {botName || "내 챗봇"}
          </div>
          <div className="text-[11px] text-text-sub flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-point-green" />
            {pending ? "응답 중..." : slug ? "온라인" : "미리보기"}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <IconBtn label="대화 초기화" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5" />
          </IconBtn>
          <IconBtn label="닫기" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </IconBtn>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-hide px-3.5 py-3.5 space-y-2.5 bg-bg-sub/40"
      >
        {messages.map((msg, i) => (
          <Bubble
            key={i}
            role={msg.role}
            text={msg.text}
            logo={logo}
            botName={botName}
            typing={pending && i === messages.length - 1 && msg.role === "bot" && !msg.text}
          />
        ))}
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-3 py-2.5 border-t border-line bg-bg-card"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={pending ? "응답을 기다리는 중..." : "메시지를 입력하세요"}
          disabled={pending}
          className="
            flex-1 h-9 px-3 rounded-DEFAULT bg-input-bg shadow-border
            text-[13px] text-text-main placeholder:text-text-placeholder
            outline-none border-0
            focus:shadow-[0_0_0_1px_rgb(var(--text-main))]
            transition-shadow disabled:opacity-60
          "
        />
        <button
          type="submit"
          aria-label="전송"
          disabled={!input.trim() || pending}
          className="
            inline-flex items-center justify-center w-9 h-9 rounded-DEFAULT
            bg-text-main text-text-inverse
            hover:bg-text-main/90
            disabled:bg-bg-disabled disabled:text-text-disabled disabled:cursor-not-allowed
            transition-colors
          "
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

const IconBtn = ({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="
      inline-flex items-center justify-center w-7 h-7 rounded-full
      text-text-sub hover:text-text-main hover:bg-bg-hover
      transition-colors
    "
  >
    {children}
  </button>
);

interface BubbleProps extends PreviewMessage {
  logo?: string;
  botName?: string;
  typing?: boolean;
}

const Bubble = ({ role, text, logo, botName, typing }: BubbleProps) => {
  const isBot = role === "bot";

  if (isBot) {
    return (
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-bg-sub shadow-border flex items-center justify-center shrink-0 overflow-hidden">
          {logo ? (
            <img src={logo} alt={botName || "bot"} className="w-full h-full object-cover" />
          ) : (
            <Bot className="w-3.5 h-3.5 text-text-sub" />
          )}
        </div>
        <div className="max-w-[95%] px-3 py-2 rounded-comfy text-[13px] leading-relaxed bg-bg-card shadow-border text-text-main">
          {typing ? <TypingDots /> : <Markdown text={text} />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="max-w-[calc(100%-36px)] px-3 py-2 rounded-comfy text-[13px] leading-relaxed whitespace-pre-wrap bg-text-main text-text-inverse">
        {text}
      </div>
    </div>
  );
};

const Markdown = ({ text }: { text: string }) => (
  <ReactMarkdown
    components={{
      p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      ul: ({ children }) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
      li: ({ children }) => <li>{children}</li>,
      a: ({ href, children }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-text-main hover:opacity-80"
        >
          {children}
        </a>
      ),
      code: ({ children }) => (
        <code className="px-1 py-0.5 rounded bg-bg-sub text-[12px] font-mono">
          {children}
        </code>
      ),
      pre: ({ children }) => (
        <pre className="px-2 py-1.5 my-1 rounded bg-bg-sub overflow-x-auto text-[12px] font-mono">
          {children}
        </pre>
      ),
      h1: ({ children }) => <h3 className="text-[14px] font-semibold mt-1 mb-0.5">{children}</h3>,
      h2: ({ children }) => <h3 className="text-[14px] font-semibold mt-1 mb-0.5">{children}</h3>,
      h3: ({ children }) => <h3 className="text-[13px] font-semibold mt-1 mb-0.5">{children}</h3>,
    }}
  >
    {text}
  </ReactMarkdown>
);

const TypingDots = () => (
  <span className="inline-flex items-center gap-1">
    <span className="w-[3px] h-[3px] rounded-full bg-text-sub animate-pulse" />
    <span className="w-[3px] h-[3px] rounded-full bg-text-sub animate-pulse [animation-delay:120ms]" />
    <span className="w-[3px] h-[3px] rounded-full bg-text-sub animate-pulse [animation-delay:240ms]" />
  </span>
);

export default ChatPreview;
