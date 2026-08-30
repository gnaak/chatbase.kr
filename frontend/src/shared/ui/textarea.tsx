import { TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  mono?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", invalid, mono, disabled, rows = 4, ...rest }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        className={[
          "block w-full px-3 py-2.5 rounded-comfy bg-input-bg",
          "shadow-border transition-shadow duration-150",
          "text-[13px] text-text-main placeholder:text-text-placeholder",
          "outline-none border-0 resize-none leading-relaxed",
          mono ? "font-mono text-[12px]" : "",
          invalid
            ? "shadow-[0_0_0_1px_rgb(var(--point-red))]"
            : "focus:shadow-[0_0_0_1px_rgb(var(--text-main))]",
          disabled ? "opacity-60 cursor-not-allowed" : "",
          className,
        ].join(" ")}
        {...rest}
      />
    );
  },
);

Textarea.displayName = "DashTextarea";

export default Textarea;
