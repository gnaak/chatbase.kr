import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface DashButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  full?: boolean;
  pill?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-text-main text-text-inverse hover:bg-text-main/90 active:bg-text-main/80 disabled:bg-bg-disabled disabled:text-text-disabled",
  secondary:
    "bg-bg text-text-main shadow-border hover:bg-bg-hover active:bg-bg-active disabled:text-text-disabled",
  ghost:
    "bg-transparent text-text-main hover:bg-bg-hover active:bg-bg-active disabled:text-text-disabled",
  danger:
    "bg-point-red text-white hover:bg-point-red/90 active:bg-point-red/80 disabled:opacity-60",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
};

const pillExtraPadding: Record<Size, string> = {
  sm: "px-3.5",
  md: "px-5",
  lg: "px-6",
};

const Button = forwardRef<HTMLButtonElement, DashButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      leftIcon,
      rightIcon,
      full,
      pill,
      className = "",
      children,
      disabled,
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={[
          "inline-flex items-center justify-center font-medium",
          pill ? "rounded-full" : "rounded-DEFAULT",
          "transition-colors duration-150",
          "focus:outline-none focus-visible:shadow-focus",
          "disabled:cursor-not-allowed",
          // 라벨은 줄바꿈도, 찌그러지지도 않는다.
          // flex 행에서 `min-w-0`인 설명 옆에 놓이면(결제의 "카드 등록",
          // 설정의 "계정 삭제") 버튼이 shrink 대상이 되는데, 좌우 아이콘이
          // shrink-0이라 줄어들 곳이 글자밖에 없어 라벨이 0폭으로 사라진다.
          full ? "w-full" : "shrink-0",
          "whitespace-nowrap",
          variantClasses[variant],
          sizeClasses[size],
          pill ? pillExtraPadding[size] : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  },
);

Button.displayName = "DashButton";

export default Button;
