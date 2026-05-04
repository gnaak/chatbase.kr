import { ReactNode } from "react";

interface FieldProps {
  label?: string;
  htmlFor?: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  count?: number;
  max?: number;
}

const Field = ({
  label,
  htmlFor,
  description,
  error,
  required,
  children,
  className = "",
  count,
  max,
}: FieldProps) => {
  const showCounter = typeof count === "number" && typeof max === "number";
  const over = showCounter && count! > max!;

  return (
    <div className={["flex flex-col gap-2", className].join(" ")}>
      {(label || showCounter) && (
        <div className="flex items-center justify-between gap-2">
          {label ? (
            <label
              htmlFor={htmlFor}
              className="text-[13px] font-medium text-text-main tracking-tight"
            >
              {label}
              {required && <span className="ml-1 text-point-red">*</span>}
            </label>
          ) : (
            <span />
          )}
          {showCounter && (
            <span
              className={[
                "text-[11px] font-mono tabular-nums",
                over ? "text-point-red" : "text-text-sub",
              ].join(" ")}
            >
              {count!.toLocaleString()} / {max!.toLocaleString()}
            </span>
          )}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-[12px] text-point-red">{error}</p>
      ) : description ? (
        <p className="text-[12px] text-text-sub leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
};

export default Field;
