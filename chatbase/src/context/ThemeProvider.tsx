import {
  createContext,
  useCallback,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const getSystemPrefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const resolveIsDark = (theme: Theme) =>
  theme === "dark" || (theme === "system" && getSystemPrefersDark());

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem("theme") as Theme | null;
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  return "system";
};

// 테마 전환 중에는 .theme-switching 으로 모든 transition 을 끈다.
// 색이 150ms 페이드로 번지지 않고 한 프레임에 바로 바뀌도록.
const applyTheme = (isDark: boolean) => {
  const root = document.documentElement;

  root.classList.add("theme-switching");
  root.classList.toggle("dark", isDark);

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", isDark ? "#121214" : "#ffffff");

  // 강제 리플로우 — transition 이 꺼진 상태로 새 색을 확정시킨다.
  void root.offsetHeight;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.remove("theme-switching"));
  });
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [isDark, setIsDark] = useState(() => resolveIsDark(getInitialTheme()));

  const sync = useCallback((next: boolean) => {
    setIsDark(next);
    applyTheme(next);
  }, []);

  // paint 전에 적용되도록 useLayoutEffect — 한 프레임도 이전 테마가 보이지 않게.
  useLayoutEffect(() => {
    sync(resolveIsDark(theme));
    localStorage.setItem("theme", theme);

    if (theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => sync(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, sync]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((t) => (resolveIsDark(t) ? "light" : "dark")),
    [],
  );

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
