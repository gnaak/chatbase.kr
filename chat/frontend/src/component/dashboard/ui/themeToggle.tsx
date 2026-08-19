import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/common/useTheme";

const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title={isDark ? "라이트 모드" : "다크 모드"}
      className="
        inline-flex items-center justify-center
        h-8 w-8 rounded-full
        text-text-sub hover:text-text-main
        hover:bg-bg-hover active:bg-bg-active
        transition-colors duration-150
        focus:outline-none focus-visible:shadow-focus
      "
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};

export default ThemeToggle;
