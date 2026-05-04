import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Bot, Send, RotateCcw } from "lucide-react";
import { getVisitorId } from "@/hooks/common/visitorId";

interface BotPublicDto {
  id: string; // slug
  name: string;
  logo: string | null;
  greeting: string | null;
  active: boolean;
}

interface ChatMessage {
  id: number;
  role: "user" | "bot";
  content: string;
  created_at: string | null;
}

const EmbedChat = () => {
  const { botId } = useParams();
  const [bot, setBot] = useState<BotPublicDto | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const visitorId = useRef(getVisitorId());
  const scrollRef = useRef<HTMLDivElement>(null);

  // 봇 메타 로드 (이름/인사말/로고). 로그인 없이 호출해야 하므로 직접 fetch.
  useEffect(() => {
    if (!botId) return;
    const baseURL = import.meta.env.VITE_APP_PUBLIC_BASE_URL ?? "";
    fetch(`${baseURL}/api/bot/public/${botId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && json.data) {
          const data: BotPublicDto = json.data;
          setBot(data);
          if (data.greeting) {
            setMessages([
              {
                id: 0,
                role: "bot",
                content: data.greeting,
                created_at: null,
              },
            ]);
          }
        }
      })
      .catch(() => null);
  }, [botId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !botId || isStreaming) return;

    const optimisticUserId = -Date.now();
    const optimisticUser: ChatMessage = {
      id: optimisticUserId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    const streamingBotId = optimisticUserId - 1;
    const streamingBot: ChatMessage = {
      id: streamingBotId,
      role: "bot",
      content: "",
      created_at: null,
    };

    setMessages((prev) => [...prev, optimisticUser, streamingBot]);
    setInput("");
    setError(null);
    setIsStreaming(true);

    const baseURL = import.meta.env.VITE_APP_PUBLIC_BASE_URL ?? "";

    try {
      const response = await fetch(`${baseURL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId, // slug
          visitor_id: visitorId.current,
          content: text,
          session_id: sessionId,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`서버 오류 ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

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
          let data: any;
          try {
            data = JSON.parse(dataStr);
          } catch {
            continue;
          }

          if (evt === "meta") {
            if (data.session_id) setSessionId(data.session_id);
            if (data.user_message) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === optimisticUserId ? data.user_message : m,
                ),
              );
            }
          } else if (evt === "chunk") {
            acc += data.text ?? "";
            const snapshot = acc;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingBotId ? { ...m, content: snapshot } : m,
              ),
            );
          } else if (evt === "done") {
            if (data.bot_message) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingBotId ? data.bot_message : m,
                ),
              );
            }
          } else if (evt === "error") {
            setError(data.message || "응답을 받지 못했습니다.");
            setMessages((prev) =>
              prev.filter((m) => m.id !== streamingBotId),
            );
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "응답을 받지 못했습니다.";
      setError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== streamingBotId));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleReset = () => {
    setMessages(
      bot?.greeting
        ? [
            {
              id: 0,
              role: "bot",
              content: bot.greeting,
              created_at: null,
            },
          ]
        : [],
    );
    setSessionId(undefined);
    setError(null);
  };

  return (
    <div className="flex flex-col h-svh bg-bg text-text-main">
      {/* 헤더 */}
      <header className="shrink-0 flex items-center justify-between px-3.5 h-12 border-b border-line">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold tracking-tight text-text-main truncate">
            {bot?.name || "챗봇"}
          </div>
          <div className="text-[11px] text-text-sub flex items-center gap-1">
            <span
              className={[
                "w-1.5 h-1.5 rounded-full",
                bot?.active ? "bg-point-green" : "bg-text-disabled",
              ].join(" ")}
            />
            {bot?.active === false ? "비활성" : "온라인"}
          </div>
        </div>
        <button
          type="button"
          onClick={handleReset}
          aria-label="대화 초기화"
          className="
            inline-flex items-center justify-center w-7 h-7 rounded-DEFAULT
            text-text-sub hover:text-text-main hover:bg-bg-hover transition-colors
          "
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* 메시지 영역 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-visible px-3.5 py-3.5 space-y-2.5 bg-bg-sub/40"
      >
        {messages.map((msg) => {
          if (!msg.content) return null;
          return msg.role === "bot" ? (
            <div key={msg.id} className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-bg-sub shadow-border flex items-center justify-center shrink-0 overflow-hidden">
                {bot?.logo ? (
                  <img
                    src={bot.logo}
                    alt={bot.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-text-sub" />
                )}
              </div>
              <div className="px-3 py-2 rounded-comfy bg-bg-card shadow-border text-[13px] leading-relaxed text-text-main max-w-[80%] whitespace-pre-wrap">
                {msg.content}
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
        {isStreaming && messages[messages.length - 1]?.content === "" && (
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-bg-sub shadow-border flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-text-sub" />
            </div>
            <div className="px-3 py-2 rounded-comfy bg-bg-card shadow-border">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-text-sub animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-text-sub animate-pulse [animation-delay:120ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-text-sub animate-pulse [animation-delay:240ms]" />
              </span>
            </div>
          </div>
        )}
        {error && (
          <p className="text-[11px] text-point-red text-center">{error}</p>
        )}
      </div>

      {/* 입력창 */}
      <form
        onSubmit={handleSend}
        className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-t border-line bg-bg-card"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요"
          className="
            flex-1 h-9 px-3 rounded-comfy bg-input-bg shadow-border
            text-[13px] text-text-main placeholder:text-text-placeholder
            outline-none border-0
            focus:shadow-[0_0_0_1px_rgb(var(--text-main))]
            transition-shadow
          "
        />
        <button
          type="submit"
          aria-label="전송"
          disabled={!input.trim() || isStreaming}
          className="
            inline-flex items-center justify-center w-9 h-9 rounded-comfy
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

export default EmbedChat;
