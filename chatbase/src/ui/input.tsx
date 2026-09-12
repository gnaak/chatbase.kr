import { type InputHTMLAttributes, type ReactNode, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", invalid, leftIcon, rightIcon, disabled, ...rest }, ref) => {
    return (
      <div
        className={[
          "flex items-center gap-2 h-9 px-3 rounded-comfy bg-input-bg",
          "shadow-border transition-shadow duration-150",
          invalid
            ? "shadow-[0_0_0_1px_rgb(var(--point-red))]"
            : "focus-within:shadow-[0_0_0_1px_rgb(var(--text-main))]",
          disabled ? "opacity-60 cursor-not-allowed" : "",
          className,
        ].join(" ")}
      >
        {leftIcon && (
          <span className="shrink-0 text-text-sub flex items-center">{leftIcon}</span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className="
            flex-1 min-w-0 bg-transparent outline-none border-0
            text-[13px] text-text-main
            placeholder:text-text-placeholder
            disabled:cursor-not-allowed
          "
          {...rest}
        />
        {rightIcon && (
          <span className="shrink-0 text-text-sub flex items-center">{rightIcon}</span>
        )}
      </div>
    );
  },
);

Input.displayName = "DashInput";

export default Input;
