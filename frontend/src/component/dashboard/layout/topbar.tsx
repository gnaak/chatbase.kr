import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface TopbarProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  backTo?: string;
}

const Topbar = ({ title, description, actions, backTo }: TopbarProps) => {
  return (
    <header className="sticky top-0 z-10 bg-bg/80 backdrop-blur-md border-b border-line">
      <div className="flex items-center justify-between gap-4 px-6 md:px-8 h-14">
        <div className="flex items-center gap-2 min-w-0">
          {backTo && (
            <Link
              to={backTo}
              aria-label="뒤로 가기"
              className="
                shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full
                text-text-sub hover:text-text-main hover:bg-bg-hover active:bg-bg-active
                transition-colors -ml-1
              "
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold tracking-tight text-text-main truncate">
              {title}
            </h1>
            {description && (
              <p className="text-[12px] text-text-sub truncate">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
