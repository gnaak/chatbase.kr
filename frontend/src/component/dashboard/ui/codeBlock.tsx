import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

const CodeBlock = ({ code, language, className = "" }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("복사 실패", e);
    }
  };

  return (
    <div
      className={[
        "relative group rounded-comfy bg-bg-sub shadow-border overflow-hidden",
        className,
      ].join(" ")}
    >
      {language && (
        <div className="flex items-center justify-between gap-2 px-3.5 h-8 border-b border-line">
          <span className="font-mono text-[11px] uppercase tracking-tight text-text-sub">
            {language}
          </span>
        </div>
      )}
      <pre className="px-3.5 py-3 overflow-x-auto scrollbar-visible font-mono text-[12px] leading-relaxed text-text-main">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="코드 복사"
        className="
          absolute top-2 right-2
          inline-flex items-center justify-center w-7 h-7 rounded-DEFAULT
          bg-bg-card text-text-sub shadow-border
          hover:text-text-main hover:bg-bg-hover
          opacity-0 group-hover:opacity-100 focus:opacity-100
          transition-opacity
        "
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-success" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
};

export default CodeBlock;
