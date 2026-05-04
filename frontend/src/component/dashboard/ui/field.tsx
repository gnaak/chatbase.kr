import { ReactNode } from "react";

interface FieldProps {
  label?: string;
  htmlFor?: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

const Field = ({
  label,
  htmlFor,
  description,
  error,
  required,
  children,
  className = "",
}: FieldProps) => {
  return (
    <div className={["flex flex-col gap-2", className].join(" ")}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-[13px] font-medium text-text-main tracking-tight"
        >
          {label}
          {required && <span className="ml-1 text-point-red">*</span>}
        </label>
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
