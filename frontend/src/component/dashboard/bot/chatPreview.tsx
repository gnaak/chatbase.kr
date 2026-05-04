import { useState, FormEvent } from "react";
import { Send, Bot, RotateCcw, X, MessageCircle } from "lucide-react";

interface ChatPreviewProps {
  botName: string;
  greeting: string;
  fallback: string;
  logo?: string;
  widgetIcon?: string;
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
}: ChatPreviewProps) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="relative h-full">
      {/* 위젯 영역 (우측 하단, 실제 임베드 시 위치 그대로) */}
      <div className="absolute bottom-0 right-0 flex flex-col items-end gap-3">
        {isOpen && (
          <ChatWindow
            botName={botName}
            greeting={greeting}
            fallback={fallback}
            logo={logo}
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

const ChatWindow = ({ botName, greeting, fallback, logo, onClose }: ChatWindowProps) => {
  const initial: PreviewMessage[] = [{ role: "bot", text: greeting || "안녕하세요!" }];
  const [messages, setMessages] = useState<PreviewMessage[]>(initial);
  const [input, setInput] = useState("");

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "bot", text: fallback || "(미리보기에서는 실제 응답이 생성되지 않습니다)" },
    ]);
    setInput("");
  };

  const handleReset = () => {
    setMessages([{ role: "bot", text: greeting || "안녕하세요!" }]);
    setInput("");
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
            온라인
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

      <div className="flex-1 overflow-y-auto scrollbar-visible px-3.5 py-3.5 space-y-2.5 bg-bg-sub/40">
        {messages.map((msg, i) => (
          <Bubble key={i} role={msg.role} text={msg.text} logo={logo} botName={botName} />
        ))}
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-3 py-2.5 border-t border-line bg-bg-card"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요"
          className="
            flex-1 h-9 px-3 rounded-DEFAULT bg-input-bg shadow-border
            text-[13px] text-text-main placeholder:text-text-placeholder
            outline-none border-0
            focus:shadow-[0_0_0_1px_rgb(var(--text-main))]
            transition-shadow
          "
        />
        <button
          type="submit"
          aria-label="전송"
          disabled={!input.trim()}
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
}

const Bubble = ({ role, text, logo, botName }: BubbleProps) => {
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
        <div className="max-w-[78%] px-3 py-2 rounded-comfy text-[13px] leading-relaxed whitespace-pre-wrap bg-bg-card shadow-border text-text-main">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] px-3 py-2 rounded-comfy text-[13px] leading-relaxed whitespace-pre-wrap bg-text-main text-text-inverse">
        {text}
      </div>
    </div>
  );
};

export default ChatPreview;
