import { type HTMLAttributes, forwardRef } from "react";

type Variant = "outline" | "elevated" | "subtle";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  interactive?: boolean;
}

const variantClasses: Record<Variant, string> = {
  outline: "bg-bg-card shadow-border",
  elevated: "bg-bg-card shadow-card dark:shadow-card-dark",
  subtle: "bg-bg-sub",
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "outline", interactive, className = "", children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={[
          "rounded-comfy",
          variantClasses[variant],
          interactive
            ? "transition-shadow duration-150 hover:shadow-card dark:hover:shadow-card-dark cursor-pointer"
            : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = "DashCard";

export default Card;
